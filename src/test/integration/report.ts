// Opt-in results summary for checkAll runs: set KIND2_REPORT_DIR to an absolute directory and
// results.md (for reading) and results.json (for scripts/diffs) are written there. The files are
// rewritten after every .lus file, so a run that hangs or is killed keeps what finished.
// Kept free of `vscode` imports.
import * as fs from 'fs';
import * as path from 'path';

export type TestState = 'passed' | 'failed' | 'pending';

export interface NodeResult {
  name: string;
  state: string[];
  // Property state -> count, e.g. { passed: 3, failed: 1 }.
  properties: Record<string, number>;
  // Names of the properties whose state is unknown.
  unknownProperties: string[];
  checkMs: number;
  // Set when the check itself failed (e.g. timed out).
  error?: string;
}

export interface FileResult {
  file: string;
  load: 'ok' | 'parse error' | 'timeout' | 'error' | 'not run';
  loadError?: string;
  nodes: NodeResult[];
  tests: Record<string, { state: TestState, error?: string }>;
  ms?: number;
}

export interface ReportConfig {
  testDir: string;
  expectedFile: string;
  checkTimeoutMs: number;
  expected: Map<string, Map<string, string>>;
}

// Short column headers for the per-file tests; other titles are used as-is.
const shortTitles: Record<string, string> = {
  'no component or property errored': 'Errored',
  'gutter icons match check results': 'Gutter',
  'nodes match expected results': 'Expected',
  'simulator loads and simulates every node': 'Simulator',
};

export const FOLDER = '(folder)';

// Why a node's results don't match its expected result, or undefined if they do. Used by both
// the 'nodes match expected results' test and the report's Expected column, so they agree.
export function expectedMismatch(expected: string, state: string[], unknownProperties: string[]): string | undefined {
  if (state.length !== 1 || state[0] !== expected) {
    return `expected ${expected}, got ${state.join(',')}`;
  }
  // A node with passed and unknown properties still shows as passed (Component.state).
  if (expected === 'passed' && unknownProperties.length > 0) {
    return `expected passed, but these properties are unknown: ${unknownProperties.join(', ')}`;
  }
  return undefined;
}

export class Report {
  private readonly dir: string | undefined;
  private readonly started = new Date();
  private readonly files = new Map<string, FileResult>();
  private readonly testTitles: string[] = [];
  private complete = false;

  constructor(private readonly config: ReportConfig, dir = process.env.KIND2_REPORT_DIR) {
    this.dir = dir ? path.resolve(dir) : undefined;
    if (this.dir) {
      console.log(`Writing results summary to ${path.join(this.dir, 'results.md')}`);
    }
  }

  private entry(file: string): FileResult {
    let result = this.files.get(file);
    if (!result) {
      result = { file, load: 'not run', nodes: [], tests: {} };
      this.files.set(file, result);
    }
    return result;
  }

  loaded(file: string): void {
    this.entry(file).load = 'ok';
  }

  loadFailed(file: string, error: unknown): void {
    const message = errorMessage(error);
    const result = this.entry(file);
    result.load = message.includes('parse errors') ? 'parse error'
      : message.includes('Timed out') ? 'timeout' : 'error';
    result.loadError = message;
  }

  node(file: string, node: NodeResult): void {
    this.entry(file).nodes.push(node);
  }

  test(file: string, title: string, state: TestState, error?: unknown): void {
    if (!this.testTitles.includes(title) && file !== FOLDER) {
      this.testTitles.push(title);
    }
    this.entry(file).tests[title] = { state, error: error === undefined ? undefined : errorMessage(error) };
  }

  fileDone(file: string, ms: number): void {
    this.entry(file).ms = ms;
    this.write();
  }

  finish(): void {
    this.complete = true;
    this.write();
  }

  write(): void {
    if (!this.dir) {
      return;
    }
    fs.mkdirSync(this.dir, { recursive: true });
    const files = [...this.files.values()];
    fs.writeFileSync(path.join(this.dir, 'results.json'), JSON.stringify({
      started: this.started.toISOString(),
      complete: this.complete,
      testDir: this.config.testDir,
      expectedFile: this.config.expectedFile,
      checkTimeoutMs: this.config.checkTimeoutMs,
      files,
    }, null, 2));
    fs.writeFileSync(path.join(this.dir, 'results.md'), this.markdown(files));
  }

  private markdown(files: FileResult[]): string {
    const lines: string[] = [];
    const allTests = files.flatMap(f => Object.values(f.tests));
    const count = (state: TestState) => allTests.filter(t => t.state === state).length;
    const seconds = ((Date.now() - this.started.getTime()) / 1000).toFixed(0);
    const lusFiles = files.filter(f => f.file !== FOLDER);

    lines.push('# Kind 2 check results', '');
    if (!this.complete) {
      lines.push('> **Run incomplete** — the run was still going (or was killed) when this was written.', '');
    }
    lines.push(
      `- Started: ${this.started.toISOString()} (${seconds}s)`,
      `- Test folder: \`${this.config.testDir}\``,
      `- Expected results: \`${this.config.expectedFile}\``,
      `- Check timeout: ${this.config.checkTimeoutMs} ms per node`,
      `- Files: ${lusFiles.length} (${lusFiles.filter(f => f.load !== 'ok').length} failed to load)`,
      `- Tests: ${count('passed')} passed, ${count('failed')} failed, ${count('pending')} pending`,
      '',
    );

    const mark = (test: { state: TestState } | undefined) =>
      test === undefined ? '' : test.state === 'passed' ? '✔' : test.state === 'failed' ? '✘' : '–';
    lines.push('## Files', '');
    lines.push(row(['File', 'Load', 'Nodes', ...this.testTitles.map(t => shortTitles[t] ?? t), 'Time']));
    lines.push(row(['---', '---', '---:', ...this.testTitles.map(() => ':---:'), '---:']));
    for (const f of lusFiles) {
      lines.push(row([f.file, f.load, String(f.nodes.length),
        ...this.testTitles.map(t => mark(f.tests[t])), f.ms === undefined ? '' : `${(f.ms / 1000).toFixed(1)}s`]));
    }

    lines.push('', '## Nodes', '');
    lines.push(row(['File', 'Node', 'State', 'Properties', 'Expected', 'Check time']));
    lines.push(row(['---', '---', '---', '---', '---', '---:']));
    for (const f of lusFiles) {
      for (const n of f.nodes) {
        const props = Object.entries(n.properties).map(([s, c]) => `${s} ${c}`).join(', ');
        const want = this.config.expected.get(f.file)?.get(n.name);
        const mismatch = want === undefined ? undefined : expectedMismatch(want, n.state, n.unknownProperties);
        const expectedCell = want === undefined ? '' : mismatch === undefined ? `✔ ${want}` : `✘ ${mismatch}`;
        lines.push(row([f.file, n.name, n.error ? `error: ${n.error}` : n.state.join(','), props, expectedCell,
          `${(n.checkMs / 1000).toFixed(1)}s`]));
      }
    }

    const failures = files.flatMap(f => [
      ...(f.loadError ? [{ where: `${f.file} — load`, message: f.loadError }] : []),
      ...Object.entries(f.tests).filter(([, t]) => t.state === 'failed')
        .map(([title, t]) => ({ where: `${f.file} — ${title}`, message: t.error ?? '' })),
    ]);
    lines.push('', '## Failures', '');
    if (failures.length === 0) {
      lines.push('None.');
    }
    for (const failure of failures) {
      lines.push(`### ${failure.where}`, '', '```', failure.message, '```', '');
    }
    return lines.join('\n') + '\n';
  }
}

function errorMessage(error: unknown): string {
  // Mocha has already appended the actual/expected diff to assertion messages by this point.
  return error instanceof Error ? error.message : String(error);
}

function row(cells: string[]): string {
  return `| ${cells.map(c => c.replace(/\|/g, '\\|').replace(/\r?\n/g, ' ')).join(' | ')} |`;
}
