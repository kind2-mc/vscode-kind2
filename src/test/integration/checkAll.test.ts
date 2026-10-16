import * as assert from 'assert';
import * as path from 'path';
import * as vscode from 'vscode';
import type { Kind2 } from '../../Kind2';
import type { Component } from '../../treeNode';
import { FOLDER, Report } from './report';
import { checkableNodes, checkComponent, examplesRoot, getKind2, LoadedFile, lustreFilesIn, openLustreFile, readExpectedResults, simulateComponent } from './helpers';

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

// Expected node results for correctness checks (see readExpectedResults). Anything not listed
// there is not checked for correctness.
const expected = readExpectedResults(examplesDir);

// Opt-in summary file for large runs (KIND2_REPORT_DIR); console output is unaffected.
const report = new Report({
  testDir: examplesDir,
  expectedFile: expected.path,
  checkTimeoutMs: checkTimeout,
  expected: expected.results,
});

// One suite per file: suiteSetup loads the file and checks every node once,
// then each test asserts one thing about the results.
suite(`Check all components in ${examplesDir}`, function () {
  const lustreFiles = lustreFilesIn(examplesDir);

  // Runs after every test, including those in the per-file suites below.
  teardown(function () {
    const test = this.currentTest!;
    // this.test is the hook itself, whose parent is this outer suite; per-file tests are one level deeper.
    const file = test.parent === this.test!.parent ? FOLDER : test.parent!.title;
    const state = test.state === 'passed' ? 'passed' : test.state === 'failed' ? 'failed' : 'pending';
    report.test(file, test.title, state, test.err);
  });

  suiteTeardown(() => report.finish());

  test('expected results only list files in this folder', function () {
    const present = new Set(lustreFiles.map(f => path.basename(f)));
    const stale = [...expected.results.keys()].filter(name => !present.has(name));
    assert.deepStrictEqual(stale, [], `${expected.path} lists files that are not in ${examplesDir}`);
  });

  for (const filePath of lustreFiles) {
    suite(path.basename(filePath), function () {
      let kind2: Kind2;
      let file: LoadedFile;
      let checked: Component[];

      const fileName = path.basename(filePath);
      let started: number;

      suiteSetup(async function () {
        started = Date.now();
        this.timeout(60_000);
        try {
          kind2 = await getKind2();
          file = await openLustreFile(kind2, filePath);
          checked = checkableNodes(file);
          assert.ok(checked.length > 0, 'file has no checkable nodes');
        } catch (error) {
          report.loadFailed(fileName, error);
          throw error;
        }
        report.loaded(fileName);

        this.timeout(30_000 + checkTimeout * checked.length);
        for (const component of checked) {
          const checkStarted = Date.now();
          let checkError: unknown;
          try {
            await checkComponent(file, component, checkTimeout);
          } catch (error) {
            checkError = error;
          }
          const properties: Record<string, number> = {};
          for (const p of component.properties) {
            properties[p.state] = (properties[p.state] ?? 0) + 1;
          }
          report.node(fileName, {
            name: component.name,
            state: component.state,
            properties,
            checkMs: Date.now() - checkStarted,
            error: checkError === undefined ? undefined : (checkError instanceof Error ? checkError.message : String(checkError)),
          });
          if (checkError !== undefined) {
            throw checkError;
          }
          const summary = component.properties.map(p => `${p.name}=${p.state}`).join(', ');
          console.log(`      ${component.name} [${component.state.join(',')}] ${summary}`);
        }
      });

      suiteTeardown(async () => {
        report.fileDone(fileName, Date.now() - started);
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

      test('nodes match expected results', function () {
        const expectedNodes = expected.results.get(path.basename(filePath));
        if (expectedNodes === undefined) {
          this.skip(); // file not listed in expected.json: no correctness check
        }
        const mismatches: string[] = [];
        for (const [name, result] of expectedNodes!) {
          const component = checked.find(c => c.name === name);
          if (component === undefined) {
            mismatches.push(`${name}: not a checked node in this file`);
            continue;
          }
          if (component.state.length !== 1 || component.state[0] !== result) {
            mismatches.push(`${name}: expected ${result}, got ${component.state.join(',')}`);
            continue;
          }
          // A node with passed and unknown properties still shows as passed (Component.state).
          const unknown = component.properties.filter(p => p.state === 'unknown').map(p => p.name);
          if (result === 'passed' && unknown.length > 0) {
            mismatches.push(`${name}: expected passed, but these properties are unknown: ${unknown.join(', ')}`);
          }
        }
        assert.deepStrictEqual(mismatches, [], `results differ from ${expected.path}`);
      });

      // Unlike the tests above, this one performs its own actions: for each node it opens the
      // simulator, presses Simulate with the default inputs, and closes the simulator.
      test('simulator loads and simulates every node', async function () {
        // Two Kind 2 calls per node (initial load + simulate).
        this.timeout(2 * simulateTimeout * checked.length + 10_000);
        const failures: string[] = [];
        for (const component of checked) {
          try {
            const outcome = await simulateComponent(kind2, file, component, simulateTimeout);
            if (outcome.simulated === undefined) {
              console.log(`      ${component.name}: Simulate disabled (${outcome.skipReason})`);
              continue;
            }
            const streams: { name: string, class: string, instantValues: unknown[][] }[] =
              JSON.parse(outcome.simulated)[0]?.streams ?? [];
            // Every stream should have a value at every simulated step.
            const incomplete = streams
              .filter(s => s.instantValues.length !== outcome.steps || s.instantValues.some(v => v.length < 2))
              .map(s => `${s.name} (${s.class}): ${s.instantValues.length}/${outcome.steps} steps`);
            if (streams.length === 0 || incomplete.length > 0) {
              failures.push(`${component.name}: simulation incomplete: ${incomplete.join(', ') || 'no streams'}`);
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
