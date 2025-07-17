/*
 * Copyright (c) 2021, Board of Trustees of the University of Iowa All rights reserved.
 *
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */

import * as net from 'net';
import * as path from 'path';
import * as vscode from 'vscode';
import { workspace } from 'vscode';
import {
  LanguageClient,
  LanguageClientOptions, ServerOptions,
  StreamInfo
} from 'vscode-languageclient';
import { Kind2 } from './Kind2';
import { Component, Property, TreeNode, Analysis, Container } from './treeNode';
import { WebPanel } from './webviewPanel';
import { Kind2SettingsProvider, SelectorNode, SettingNode} from './Kind2SettingsProvider';

let client: LanguageClient;
let kind2: Kind2;

export async function activate(context: vscode.ExtensionContext) {
  let registerCommand = (command: string, callback: (...args: any[]) => any): void => {
    context.subscriptions.push(vscode.commands.registerCommand(command, callback));
  };

  registerCommand('angular-webview.start', () => {
    WebPanel.createOrShow(context.extensionPath);
  });

  // The server is implemented in node
  let serverCmd = context.asAbsolutePath(
    path.join('kind2-language-server', 'bin', 'kind2-language-server')
  );

  // If the extension is launched in debug mode then the debug server options are used
  // Otherwise the run options are used
  let serverOptions: ServerOptions = {
    run: { command: serverCmd },
    debug: { command: serverCmd }
  };

  // Options to control the language client
  let clientOptions: LanguageClientOptions = {
    // Register the server for plain text documents
    documentSelector: [{ scheme: 'file', language: 'lustre' }],
    synchronize: {
      // Notify the server about file changes to '.clientrc files contained in the workspace
      fileEvents: vscode.workspace.createFileSystemWatcher('**/.clientrc')
    }
  };

  // Create the language client and start the client.
  client = new LanguageClient(
    'vscode-kind2',
    'Kind 2',
    serverOptions,
    // connectToTCPServer(),
    clientOptions
  );

  kind2 = new Kind2(context, client);

  vscode.window.onDidChangeActiveTextEditor(() => kind2.updateDecorations());

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
  registerCommand('kind2/toggleCompositional', () => {
      vscode.window.showInformationMessage('toggling compositional');
    workspace.getConfiguration("kind2.contracts").update("compositional", !workspace.getConfiguration("kind2.contracts").get("compositional") );
    kind2._treeDataChanged.fire(undefined);
    
  });

  registerCommand('kind2/modifySetting', (treeNode: SettingNode | SelectorNode) => {
     Kind2SettingsProvider.updateSetting(treeNode);
  });

   registerCommand('kind2/activateIVC', (element : Container) => {
     element.activateIVC();
    //  for(let ele of (element.parent as Container).children){
    //     kind2._treeDataChanged.fire(ele);
    //  }
    kind2._treeDataChanged.fire(element.parent);
    
     kind2.updateDecorations();
  });
  registerCommand('kind2/activateMCS', (element : Container) => {
     element.activateMCS();
    //  for(let ele of (element.parent as Container).children){
    //     kind2._treeDataChanged.fire(ele);
    //  }
    kind2._treeDataChanged.fire(element.parent);
    
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

  registerCommand('kind2/showSource', async (node: TreeNode) => await kind2.showSource(node));

  const treeView = vscode.window.createTreeView("properties", { treeDataProvider: kind2, canSelectMany: false, showCollapseAll: true });
  
  let settingsViewProvider: Kind2SettingsProvider = new Kind2SettingsProvider(context);
  const settingsView = vscode.window.createTreeView("kind2settings", { treeDataProvider: settingsViewProvider, canSelectMany: false, showCollapseAll: true });
  
  registerCommand('kind2/reveal', async (node: TreeNode) => await kind2.reveal(node, treeView));

  context.subscriptions.push(treeView);
  context.subscriptions.push(settingsView);
  const documentSelector: vscode.DocumentFilter = { language: "lustre" };
  context.subscriptions.push(vscode.languages.registerCodeLensProvider(documentSelector, kind2));

  // Start the client. This will also launch the server
  client.start();

  client.onReady().then(() => {
    client.onNotification("kind2/updateComponents", (uri: string) => kind2.updateComponents(uri));
    client.onRequest("kind2/getDefaultKind2Path", () => kind2.getDefaultKind2Path());
    client.onRequest("kind2/getDefaultZ3Path", () => kind2.getDefaultZ3Path());
  });
}

function connectToTCPServer(): ServerOptions {
  let serverExec: ServerOptions = () => {

    return new Promise((resolve) => {
      net.createServer(socket => {
        let res: StreamInfo = { writer: socket, reader: socket };
        resolve(res);
      }).listen(23555, "localhost");
    });
  };
  return serverExec;
}

export function deactivate(): Thenable<void> | undefined {
  WebPanel.currentPanel?.dispose();
  if (!client) {
    return undefined;
  }
  return client.stop();
}
