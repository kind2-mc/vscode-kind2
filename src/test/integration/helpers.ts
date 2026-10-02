import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import type { Kind2 } from '../../Kind2';
import type { Component } from '../../treeNode';

export const examplesRoot = path.resolve(__dirname, '../../../src/test/lustre-examples');

export async function getKind2(): Promise<Kind2> {
  const extension = vscode.extensions.getExtension('kind2-mc.vscode-kind2');
  if (!extension) {
    throw new Error('Kind 2 extension was not found');
  }
  await extension.activate();
  return (extension.exports as { getKind2ForTesting: () => Kind2 }).getKind2ForTesting();
}

// The .lus files directly in dir (subfolders are not scanned), sorted by name.
export function lustreFilesIn(dir: string): string[] {
  return fs.readdirSync(dir)
    .filter(name => name.endsWith('.lus'))
    .sort()
    .map(name => path.join(dir, name));
}

export interface LoadedFile {
  document: vscode.TextDocument;
  uri: string;
  // Components declared in this file (not in files it includes).
  components: Component[];
}

// Opens a Lustre file in an editor and waits for the language server to report its components.
// Throws with the error diagnostics if the file fails to parse.
export async function openLustreFile(kind2: Kind2, filePath: string, timeout = 30_000): Promise<LoadedFile> {
  const document = await vscode.workspace.openTextDocument(filePath);
  await vscode.window.showTextDocument(document);
  const uri = document.uri.toString();
  const name = path.basename(filePath);

  // Components arrive asynchronously via the kind2/updateComponents notification;
  // a file that fails to parse gets error diagnostics instead, so stop at whichever comes first.
  const parseErrors = () => vscode.languages.getDiagnostics(document.uri)
    .filter(d => d.severity === vscode.DiagnosticSeverity.Error)
    .map(d => `${d.range.start.line + 1}:${d.range.start.character + 1} ${d.message}`);
  await waitFor(
    () => kind2.getComponentsForTesting(uri).length > 0 || parseErrors().length > 0,
    timeout, 100, `components or diagnostics of ${name}`
  );
  const errors = parseErrors();
  if (errors.length > 0) {
    throw new Error(`${name} has parse errors:\n  ${errors.join('\n  ')}`);
  }

  return { document, uri, components: kind2.getComponentsForTesting(uri) };
}

// Same set that gets a "Check Properties" code lens on a node.
export function checkableNodes(file: LoadedFile): Component[] {
  return file.components.filter(c => c.nodeDecl && !c.imported);
}

// Runs a Kind 2 check on the component and waits for it to finish.
export async function checkComponent(kind2: Kind2, component: Component, timeout: number): Promise<void> {
  await kind2.check(component);
  await waitFor(
    () => !component.hasRunningAnalysis && component.state[0] !== 'running',
    timeout, 250, `check of ${component.name} to finish`
  );
}

export async function waitFor(
  condition: () => boolean | Promise<boolean>,
  timeout = 10_000,
  interval = 100,
  description = 'condition'
): Promise<void> {
  const start = Date.now();

  while (!(await condition())) {
    if (Date.now() - start >= timeout) {
      throw new Error(`Timed out after ${timeout}ms waiting for ${description}`);
    }

    await sleep(interval);
  }
}

export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
