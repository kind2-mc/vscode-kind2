import * as vscode from 'vscode';
import { LanguageClient } from 'vscode-languageclient';
import { TestHub, testExplorerExtensionId } from 'vscode-test-adapter-api';
import { Log, TestAdapterRegistrar } from 'vscode-test-adapter-util';
import { ExampleAdapter } from './adapter';

export async function setupAdapter(context: vscode.ExtensionContext, client: LanguageClient) {
  const workspaceFolder = (vscode.workspace.workspaceFolders || [])[0];

  // create a simple logger that can be configured with the configuration variables
  // `Kind2Explorer.logpanel` and `Kind2Explorer.logfile`
  const log = new Log('Kind2Explorer', workspaceFolder, 'Kind 2 Explorer Log');
  context.subscriptions.push(log);

  // get the Test Explorer extension
  const testExplorerExtension = vscode.extensions.getExtension<TestHub>(testExplorerExtensionId);
  if (log.enabled) log.info(`Test Explorer ${testExplorerExtension ? '' : 'not '}found`);

  if (testExplorerExtension) {

    const testHub = testExplorerExtension.exports;

    // this will register an Kind2Explorer for each WorkspaceFolder
    context.subscriptions.push(new TestAdapterRegistrar(
      testHub,
      (workspaceFolder: vscode.WorkspaceFolder) => new ExampleAdapter(workspaceFolder, client, log),
      log
    ));
  }
}
