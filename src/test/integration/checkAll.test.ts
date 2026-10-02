import * as assert from 'assert';
import * as path from 'path';
import * as vscode from 'vscode';
import type { Kind2 } from '../../Kind2';
import type { Component } from '../../treeNode';
import { checkableNodes, checkComponent, examplesRoot, getKind2, LoadedFile, lustreFilesIn, openLustreFile, simulateComponent } from './helpers';

// The default is src/test/lustre-examples.
const examplesDir = path.resolve(process.env.KIND2_TEST_DIR ?? examplesRoot);

// Per-component time budget for a Kind 2 check. Override with KIND2_CHECK_TIMEOUT (ms).
// Underscores are allowed ("30_000"); anything else non-numeric is rejected, since a NaN
// timeout would silently disable both waitFor's and Mocha's timeouts.
const checkTimeout = Number((process.env.KIND2_CHECK_TIMEOUT ?? '120000').replace(/_/g, ''));
if (!Number.isFinite(checkTimeout) || checkTimeout <= 0) {
  throw new Error(`KIND2_CHECK_TIMEOUT must be a positive number of ms, got "${process.env.KIND2_CHECK_TIMEOUT}"`);
}

// Per-component time budget for the simulator's initial Kind 2 call and panel load.
const simulateTimeout = 30_000;

// One suite per file: suiteSetup loads the file and checks every node once,
// then each test asserts one thing about the results.
suite(`Check all components in ${examplesDir}`, function () {
  for (const filePath of lustreFilesIn(examplesDir)) {
    suite(path.basename(filePath), function () {
      let kind2: Kind2;
      let file: LoadedFile;
      let checked: Component[];

      suiteSetup(async function () {
        this.timeout(60_000);
        kind2 = await getKind2();
        file = await openLustreFile(kind2, filePath);
        checked = checkableNodes(file);
        assert.ok(checked.length > 0, 'file has no checkable nodes');

        this.timeout(30_000 + checkTimeout * checked.length);
        for (const component of checked) {
          await checkComponent(file, component, checkTimeout);
          const summary = component.properties.map(p => `${p.name}=${p.state}`).join(', ');
          console.log(`      ${component.name} [${component.state.join(',')}] ${summary}`);
        }
      });

      suiteTeardown(async () => {
        await vscode.commands.executeCommand('workbench.action.closeAllEditors');
      });

      test('no component or property errored', function () {
        const errored = checked
          .filter(c => c.state.includes('errored') || c.properties.some(p => p.state === 'errored'))
          .map(c => c.name);
        assert.deepStrictEqual(errored, []);
      });

      test('gutter icons match check results', function () {
        const applied = kind2.getAppliedDecorationsForTesting(file.uri);
        const has = (state: string, line: number) =>
          applied.some(d => d.state === state && d.line === line);
        const missing: string[] = [];

        for (const component of checked) {
          for (const state of component.state) {
            if (!has(state, component.line)) {
              missing.push(`${component.name} (line ${component.line + 1}): ${state}`);
            }
          }
          // Properties on the node/contract header line share the component's icon.
          for (const property of component.properties) {
            if (vscode.Uri.parse(property.uri).toString() !== file.uri ||
                property.line === component.line || property.line === component.contractLine) {
              continue;
            }
            if (!has(property.state, property.line)) {
              missing.push(`${component.name}.${property.name} (line ${property.line + 1}): ${property.state}`);
            }
          }
        }

        assert.deepStrictEqual(missing, [], 'expected gutter icons were not applied');
        // Unchecked components (imported nodes, types) legitimately stay pending.
        const checkedLines = new Set(checked.flatMap(c => [c.line, c.contractLine]));
        const stale = applied.filter(d =>
          d.state === 'running' || (d.state === 'pending' && checkedLines.has(d.line)));
        assert.deepStrictEqual(stale, [], 'running/pending icons remain after checks finished');
      });

      // Unlike the tests above, this one performs its own action: it opens and closes the simulator.
      test('simulator loads for every node', async function () {
        this.timeout(simulateTimeout * checked.length + 10_000);
        const failures: string[] = [];
        for (const component of checked) {
          try {
            const interp = await simulateComponent(kind2, file, component, simulateTimeout);
            // The simulator panel reads the streams of the first element (simulation.component.ts).
            const streams = JSON.parse(interp)[0]?.streams;
            if (!Array.isArray(streams)) {
              failures.push(`${component.name}: interpretation has no streams: ${interp.slice(0, 200)}`);
            }
          } catch (error) {
            failures.push(`${component.name}: ${error instanceof Error ? error.message : error}`);
          }
        }
        assert.deepStrictEqual(failures, []);
      });
    });
  }
});
