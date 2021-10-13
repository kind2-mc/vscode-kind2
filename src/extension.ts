/*
 * Copyright (c) 2021, Board of Trustees of the University of Iowa All rights reserved.
 *
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */

import * as net from 'net';
import * as path from 'path';
import * as vscode from 'vscode';
import {
  LanguageClient,
  LanguageClientOptions, ServerOptions,
  StreamInfo
} from 'vscode-languageclient';
import { Kind2 } from './Kind2';
import { Component as Component, Property, TreeNode } from './treeNode';
import { WebPanel } from './webviewPanel';

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

  registerCommand('kind2/check', async (node: Component) => {
    kind2.reveal(node, treeView);
    await kind2.check(node);
  });

  registerCommand('kind2/raw', async (component: Component) => await kind2.raw(component));

  registerCommand('kind2/counterExample', async (property: Property) => {
    await kind2.counterExample(property);
  });

  registerCommand('kind2/interpret', async (component: { uri: string, name: string }, json: string) => {
    await kind2.interpret(component.uri, component.name, json);
  });

  registerCommand('kind2/showSource', async (node: TreeNode) => await kind2.showSource(node));

  const treeView = vscode.window.createTreeView("properties", { treeDataProvider: kind2, canSelectMany: false, showCollapseAll: true });

  registerCommand('kind2/reveal', async (node: TreeNode) => await kind2.reveal(node, treeView));

  context.subscriptions.push(treeView);
  const documentSelector: vscode.DocumentFilter = { language: "lustre" };
  context.subscriptions.push(vscode.languages.registerCodeLensProvider(documentSelector, kind2));

  // Start the client. This will also launch the server
  client.start();

  client.onReady().then(() => {
    client.onNotification("kind2/updateComponents", (uri: string) => kind2.updateComponents(uri));
    client.onRequest("kind2/getKind2Path", () => kind2.getKind2Path());
    client.onRequest("kind2/getSmtSolver", () => kind2.getSmtSolver());
    client.onRequest("kind2/getSmtSolverPath", () => kind2.getSmtSolverPath());
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
