import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import type { Kind2 } from '../../Kind2';
import type { Component } from '../../treeNode';
import type { WebPanel } from '../../webviewPanel';

export const examplesRoot = path.resolve(__dirname, '../../../src/test/lustre-examples');

export async function getKind2(): Promise<Kind2> {
  const extension = vscode.extensions.getExtension('kind2-mc.vscode-kind2');
  if (!extension) {
    throw new Error('Kind 2 extension was not found');
  }
  await extension.activate();
  return (extension.exports as TestHooks).getKind2ForTesting();
}

interface TestHooks {
  getKind2ForTesting: () => Kind2;
  getWebPanelForTesting: () => WebPanel | undefined;
}

function getWebPanel(): WebPanel | undefined {
  const extension = vscode.extensions.getExtension('kind2-mc.vscode-kind2');
  return (extension?.exports as TestHooks | undefined)?.getWebPanelForTesting();
}

// The .lus files directly in dir (subfolders are not scanned), sorted by name.
export function lustreFilesIn(dir: string): string[] {
  return fs.readdirSync(dir)
    .filter(name => name.endsWith('.lus'))
    .sort()
    .map(name => path.join(dir, name));
}

export type ExpectedResult = 'passed' | 'failed';
// .lus file name -> node name -> expected node state.
export type ExpectedResults = Map<string, Map<string, ExpectedResult>>;

// Reads the expected node results for the files in dir: KIND2_EXPECTED_FILE if set, otherwise
// dir/expected.json. Format: { "abs.lus": { "AbsSpecAndBody": "passed", ... }, ... }.
// A missing file means no expectations (nothing is checked).
export function readExpectedResults(dir: string): { path: string, results: ExpectedResults } {
  const file = path.resolve(process.env.KIND2_EXPECTED_FILE ?? path.join(dir, 'expected.json'));
  const results: ExpectedResults = new Map();
  if (!fs.existsSync(file)) {
    return { path: file, results };
  }

  let json: unknown;
  try {
    json = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (error) {
    throw new Error(`${file} is not valid JSON: ${error instanceof Error ? error.message : error}`);
  }
  const isObject = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null && !Array.isArray(value);
  if (!isObject(json)) {
    throw new Error(`${file} must map .lus file names to objects of node results`);
  }
  for (const [fileName, nodes] of Object.entries(json)) {
    if (!isObject(nodes)) {
      throw new Error(`${file}: "${fileName}" must map node names to "passed" or "failed"`);
    }
    const nodeResults = new Map<string, ExpectedResult>();
    for (const [node, expected] of Object.entries(nodes)) {
      if (expected !== 'passed' && expected !== 'failed') {
        throw new Error(`${file}: "${fileName}" → "${node}" must be "passed" or "failed", got ${JSON.stringify(expected)}`);
      }
      nodeResults.set(node, expected);
    }
    results.set(fileName, nodeResults);
  }
  return { path: file, results };
}

export interface LoadedFile {
  document: vscode.TextDocument;
  uri: string;
  // Components declared in this file.
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

// Finds the component's code lens for the given command and runs it, as a click would.
// Resolves when the command's handler returns.
export async function clickCodeLens(file: LoadedFile, component: Component, command: string): Promise<void> {
  let lens: vscode.CodeLens | undefined;
  await waitFor(async () => {
    const lenses = await vscode.commands.executeCommand<vscode.CodeLens[]>(
      'vscode.executeCodeLensProvider', file.document.uri
    ) ?? [];
    lens = lenses.find(l =>
      l.command?.command === command && l.range.start.line === component.line);
    return lens !== undefined;
  }, 10_000, 100, `${command} code lens for ${component.name}`);

  await vscode.commands.executeCommand(lens!.command!.command, ...(lens!.command!.arguments ?? []));
}

const simulationViewTitle = 'Kind 2 Simulation View';

function simulationTabs(): vscode.Tab[] {
  return vscode.window.tabGroups.all
    .flatMap(group => group.tabs)
    .filter(tab => tab.input instanceof vscode.TabInputWebview && tab.label === simulationViewTitle);
}

export interface SimulationOutcome {
  // Kind 2's interpretation for the empty input trace, sent when the panel opens.
  initial: string;
  // Kind 2's interpretation after pressing Simulate with the default inputs, or undefined if
  // Simulate is disabled for this node (skipReason says why, e.g. nondeterministic variables).
  simulated?: string;
  steps?: number;
  skipReason?: string;
}

function outcomeOf(kind2: Kind2, before: Kind2['lastInterpretForTesting'], component: Component, step: string): string {
  const outcome = kind2.lastInterpretForTesting;
  if (outcome === before || outcome?.main !== component.name) {
    throw new Error(`kind2/interpret did not run for ${component.name} (${step})`);
  }
  if (outcome.error !== undefined) {
    throw new Error(`kind2/interpret failed for ${component.name} (${step}): ${outcome.error}`);
  }
  return outcome.result!;
}

// The simulator fills an empty input table with this many steps (numCols in simulation.component.ts).
const defaultSimulationSteps = 10;

interface InterpretationStream { name: string, class: string, instantValues: unknown[][] }

// Clicks the component's "Simulate" code lens and waits for Kind 2's initial (empty)
// interpretation to reach the simulator panel, then presses the panel's Simulate button and
// waits for that result too. Always closes the panel.
export async function simulateComponent(kind2: Kind2, file: LoadedFile, component: Component, timeout: number): Promise<SimulationOutcome> {
  try {
    let before = kind2.lastInterpretForTesting;
    // The command returns once the panel has loaded ("ready") and been sent the interpretation.
    await withTimeout(
      clickCodeLens(file, component, 'kind2/interpret'),
      timeout, `simulator for ${component.name} to load`
    );
    const initial = outcomeOf(kind2, before, component, 'initial load');
    const panel = getWebPanel();
    if (!panel || simulationTabs().length === 0) {
      throw new Error(`simulator panel did not open for ${component.name}`);
    }

    // The panel shows the streams of the first element (simulation.component.ts).
    const streams: InterpretationStream[] | undefined = JSON.parse(initial)[0]?.streams;
    if (!Array.isArray(streams) || streams.length === 0) {
      throw new Error(`initial interpretation has no streams: ${initial.slice(0, 200)}`);
    }
    // The panel disables Simulate for nodes with free constants (nonDeterministicVarsOf).
    const constants = streams.filter(s => s.class === 'constant').map(s => s.name);
    if (constants.length > 0) {
      return { initial, skipReason: `nondeterministic constants: ${constants.join(', ')}` };
    }
    const steps = streams[0].instantValues.length || defaultSimulationSteps;

    // The panel's Simulate goes through the same kind2/interpret command as the code lens.
    before = kind2.lastInterpretForTesting;
    await panel.sendMessage({ type: 'simulate' });
    await waitFor(() => kind2.lastInterpretForTesting !== before, timeout, 100,
      `simulation result for ${component.name}`);
    return { initial, simulated: outcomeOf(kind2, before, component, 'simulate'), steps };
  } finally {
    await vscode.window.tabGroups.close(simulationTabs());
    await waitFor(() => simulationTabs().length === 0, 5_000, 100, 'simulator panel to close');
  }
}

// Clicks the component's "Check Properties" code lens and waits for the check to finish.
export async function checkComponent(file: LoadedFile, component: Component, timeout: number): Promise<void> {
  // The kind2/check command only returns once the whole check is done, so don't await it here,
  // or a hung check would never reach the timeout below.
  let commandFailed = false;
  let commandError: unknown;
  const command = clickCodeLens(file, component, 'kind2/check').catch(error => {
    commandFailed = true;
    commandError = error;
  });
  // Every component starts out pending, so a check whose results never reached this
  // Component (e.g. the lens passed a copy of it) stays pending and times out here.
  try {
    await waitFor(() => {
      if (commandFailed) {
        throw commandError;
      }
      return !component.hasRunningAnalysis && !['running', 'pending'].includes(component.state[0]);
    }, timeout, 250, `check of ${component.name} to finish`);
  } catch (error) {
    if (!commandFailed) {
      // Stop Kind 2 so a hung check doesn't keep running into the next file's checks,
      // and wait for the cancellation to land before the next check starts.
      await vscode.commands.executeCommand('kind2/cancel', component);
      await withTimeout(command, 10_000, `cancelled check of ${component.name} to stop`).catch(() => {});
    }
    throw error;
  }
  await command;
}

export async function waitFor(
  condition: () => boolean | Promise<boolean>,
  timeout = 10_000,
  interval = 100,
  description = 'condition'
): Promise<void> {
  if (!Number.isFinite(timeout)) {
    throw new Error(`waitFor timeout must be a finite number, got ${timeout}`);
  }
  const start = Date.now();

  while (!(await condition())) {
    if (Date.now() - start >= timeout) {
      throw new Error(`Timed out after ${timeout}ms waiting for ${description}`);
    }

    await sleep(interval);
  }
}

export async function withTimeout<T>(promise: Promise<T>, timeout: number, description: string): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const expired = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`Timed out after ${timeout}ms waiting for ${description}`)), timeout);
  });
  try {
    return await Promise.race([promise, expired]);
  } finally {
    clearTimeout(timer);
  }
}

export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
