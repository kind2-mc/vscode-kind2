import * as assert from 'assert';
import * as path from 'path';
import * as vscode from 'vscode';

suite('Kind 2 Integration Tests', function () {
  this.timeout(15_000);

  test('AbsSpecAndBodyIVC shows passed decorations after check', async function () {
    const extension = vscode.extensions.getExtension(
      'kind2-mc.vscode-kind2'
    );

    assert.ok(extension, 'Kind 2 extension was not found');

    await extension.activate();

    const filePath = path.resolve(
      __dirname,
      '../../../src/test/lustre-examples/abs.lus'
    );

    const document = await vscode.workspace.openTextDocument(filePath);

    await vscode.languages.setTextDocumentLanguage(
      document,
      'lustre'
    );

    await vscode.window.showTextDocument(document);

    assert.strictEqual(
      document.languageId,
      'lustre',
      'abs.lus was not recognized as Lustre'
    );

    let checkLens: vscode.CodeLens | undefined;

    await waitFor(async () => {
      const lenses =
        await vscode.commands.executeCommand<vscode.CodeLens[]>(
          'vscode.executeCodeLensProvider',
          document.uri
        ) ?? [];

      checkLens = lenses.find(
        lens =>
          lens.command?.command === 'kind2/check' &&
          lens.range.start.line === 0
      );

      return checkLens !== undefined;
    });

    assert.ok(
      checkLens?.command,
      'Could not find Check Properties CodeLens for AbsSpecAndBodyIVC'
    );

    await vscode.commands.executeCommand(
      checkLens.command.command,
      ...(checkLens.command.arguments ?? [])
    );

    const extensionExports = extension.exports as {
      getKind2ForTesting: () => {
        getPropertyStates: (
          uri: string,
          componentName: string
        ) => {
          line: number;
          state: string;
          name: string;
        }[];
      };
    };

    const kind2 = extensionExports.getKind2ForTesting();

    await waitFor(() => {
      const properties = kind2.getPropertyStates(
        document.uri.toString(),
        'AbsSpecAndBodyIVC'
      );

      return (
        properties.length >= 3 &&
        properties
          .filter(property =>
            [2, 3, 4].includes(property.line)
          )
          .every(property => property.state === 'passed')
      );
    });

    const properties = kind2.getPropertyStates(
      document.uri.toString(),
      'AbsSpecAndBodyIVC'
    );

    const guaranteeProperties = properties
      .filter(property => [2, 3, 4].includes(property.line))
      .sort((a, b) => a.line - b.line);

    assert.strictEqual(
      guaranteeProperties.length,
      3,
      'Expected three guarantees on lines 3-5'
    );

    assert.deepStrictEqual(
      guaranteeProperties.map(property => property.line),
      [2, 3, 4],
      'Expected guarantees on VS Code lines 2-4'
    );

    assert.deepStrictEqual(
      guaranteeProperties.map(property => property.state),
      ['passed', 'passed', 'passed'],
      'Expected all three guarantees to pass'
    );
  });
});

async function waitFor(
  condition: () => boolean | Promise<boolean>,
  timeout = 10_000,
  interval = 100
): Promise<void> {
  const start = Date.now();

  while (!(await condition())) {
    if (Date.now() - start >= timeout) {
      throw new Error(
        `Timed out after ${timeout}ms waiting for condition`
      );
    }

    await sleep(interval);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}