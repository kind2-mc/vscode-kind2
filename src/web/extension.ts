/*
 * Copyright (c) 2021, Board of Trustees of the University of Iowa All rights reserved.
 *
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */

// import * as path from 'path';
import * as vscode from 'vscode';
import { workspace } from 'vscode';
import {
  BaseLanguageClient
} from 'vscode-languageclient';
import { Kind2 } from '../Kind2';
import { Component, Property, TreeNode, Analysis, Container } from '../treeNode';
import { WebPanel } from '../webviewPanel';
import { Kind2SettingsProvider, SelectorNode, SettingNode} from '../Kind2SettingsProvider';
import {
  createKind2LanguageClient
} from './languageClient';

let client: BaseLanguageClient;
let kind2: Kind2;

function getDefaultLspUrl(extensionUri: vscode.Uri): string {
  const wsScheme = extensionUri.scheme === 'https' ? 'wss' : 'ws';
  const hostWithOptionalPort = extensionUri.authority;
  const hostOnly = hostWithOptionalPort.split(':')[0];

  if (hostOnly.length > 0) {
    return `${wsScheme}://${hostOnly}/app/lsp`;
  }

  return 'ws://localhost:3001/lsp';
}

export async function activate(context: vscode.ExtensionContext) {
  let registerCommand = (command: string, callback: (...args: any[]) => any): void => {
    context.subscriptions.push(vscode.commands.registerCommand(command, callback));
  };

  const webConfiguration = workspace.getConfiguration('kind2.web');
  const configuredGatewayUrl =
    webConfiguration.get<string>('lsp_url')?.trim() ?? '';
  const gatewayUrl = configuredGatewayUrl.length > 0
    ? configuredGatewayUrl
    : getDefaultLspUrl(context.extensionUri);

  try {
    client = await createKind2LanguageClient(gatewayUrl);
    vscode.window.showInformationMessage('Kind2 Language Client connected successfully.');
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : String(error);

    void vscode.window.showWarningMessage(
      `Kind2 web prototype running without LSP: ${message}. Attempted: ${gatewayUrl}.`
    );
  }


  registerCommand('angular-webview.start', () => {
    WebPanel.createOrShow(context.extensionUri);
  });

  kind2 = new Kind2(context, client);

  vscode.window.onDidChangeActiveTextEditor(() => kind2.updateDecorations());

  // Could potentially remove these commands, keeping because it takes away functionality that would have been previously present
  // The settings menu now manages the environment settings with one command "kind2/modifySetting"
  registerCommand('kind2/enableModular', () => {
    workspace.getConfiguration("kind2").update("modular", true);
  });
  registerCommand('kind2/disableModular', () => {
    workspace.getConfiguration("kind2").update("modular", false);
  });
  registerCommand('kind2/enableCompositional', () => {
    workspace.getConfiguration("kind2.contracts").update("compositional", true);
  });
  registerCommand('kind2/disableCompositional', () => {
    workspace.getConfiguration("kind2.contracts").update("compositional", false);
  });
  // end commands to potentially remove

  registerCommand('kind2/modifySetting', (treeNode: SettingNode | SelectorNode) => {
     Kind2SettingsProvider.updateSetting(treeNode);
  });

  registerCommand('kind2/activateIVC', (element : Container) => {
    element.activateIVC();
    kind2.changeTreeData(element.parent);
    kind2.updateDecorations();
  });
  registerCommand('kind2/activateMCS', (element : Container) => {
    element.activateMCS();
    kind2.changeTreeData(element.parent);
    kind2.updateDecorations();
  });

  registerCommand('kind2/check', async (node: Component, options) => {
    kind2.reveal(node, treeView);
    await kind2.check(node);
  });

  registerCommand('kind2/minimalCutSet', async (node: Component, options) => {
    kind2.reveal(node, treeView);
    await kind2.minimalCutSet(node);
  });

  registerCommand('kind2/realizability', async (node: Component, options) => {
    kind2.reveal(node, treeView);
    await kind2.realizability(node);
  });

  registerCommand('kind2/cancel', async (node: Component) => {
    kind2.cancel(node);
  });

  registerCommand('kind2/raw', async (component: Component) => await kind2.raw(component));

  registerCommand('kind2/counterExample', async (property: Property) => {
    await kind2.counterExample(property);
  });

  registerCommand('kind2/deadlock', async (analysis: Analysis) => {
    await kind2.deadlock(analysis);
  });

  registerCommand('kind2/interpret', async (component: { uri: string, name: string }, json: string) => {
    await kind2.interpret(component.uri, component.name, json);
  });

  registerCommand('kind2/showSource', async (node: TreeNode | Container) => await kind2.showSource(node));

  const treeView = vscode.window.createTreeView("properties", { treeDataProvider: kind2, canSelectMany: false, showCollapseAll: true });

  let settingsViewProvider: Kind2SettingsProvider = new Kind2SettingsProvider(context);
  const settingsView = vscode.window.createTreeView("kind2settings", { treeDataProvider: settingsViewProvider, canSelectMany: false, showCollapseAll: true });

  // registerCommand('kind2/reveal', async (node: TreeNode) => await kind2.reveal(node, treeView));


  context.subscriptions.push(settingsView);
  const documentSelector: vscode.DocumentFilter = { language: "lustre" };
  context.subscriptions.push(vscode.languages.registerCodeLensProvider(documentSelector, kind2));

  if (!client) {
    vscode.window.showWarningMessage(
      `Kind2 web prototype running without LSP: ${"Language client not initialized"}`
    );
    return;
  }
  // In vscode-languageclient v8+, start() resolves when initialization is ready.
  await client.start();
  client.onNotification("kind2/checkResultUpdate", (uri: string, name:string, values: string[]) => kind2.handleCheck(uri, name, values));
  client.onNotification("kind2/checkComplete", (uri: string, name:string, values: string[]) => kind2.checkComplete(uri, name));

  client.onNotification("kind2/minimalCutSetResultUpdate", (uri: string, name:string, values: string[]) => kind2.handleMinimalCutSet(uri, name, values));
  client.onNotification("kind2/minimalCutSetComplete", (uri: string, name:string, values: string[]) => kind2.minimalCutSetComplete(uri, name));

  client.onNotification("kind2/realizabilityResultUpdate", (uri: string, name:string, values: string[]) => kind2.handleRealizability(uri, name, values));
  client.onNotification("kind2/realizabilityComplete", (uri: string, name:string, values: string[]) => kind2.realizabilityComplete(uri, name));

  client.onNotification("kind2/updateComponents", (uri: string) => kind2.updateComponents(uri));
  client.onRequest("kind2/getDefaultKind2Path", () => kind2.getDefaultKind2Path());
  client.onRequest("kind2/getDefaultZ3Path", () => kind2.getDefaultZ3Path());
}

export function deactivate(): Thenable<void> | undefined {
    WebPanel.currentPanel?.dispose();
    if (!client) {
        return undefined;
    }
    return client.stop();
}
