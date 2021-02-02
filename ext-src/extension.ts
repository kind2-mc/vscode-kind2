/* --------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import * as fs from 'fs';
import * as net from 'net';
import * as path from 'path';
import * as vscode from 'vscode';
import {
  LanguageClient,
  LanguageClientOptions,
  ServerOptions,
  StreamInfo
} from 'vscode-languageclient';
import { setupAdapter } from './adapterSetup';

let client: LanguageClient;
let disposables: vscode.Disposable[] = [];

export async function activate(context: vscode.ExtensionContext) {
  let Kind2WebviewContent = fs.readFileSync(context.asAbsolutePath(path.join('src', 'interpreter', 'interpreter.html'))).toString();

  context.subscriptions.push(
    vscode.commands.registerCommand('catCoding.start', () => {
      // Create and show panel
      const panel = vscode.window.createWebviewPanel(
        'catCoding',
        'Cat Coding',
        vscode.ViewColumn.One,
        {}
      );

      // And set its HTML content
      panel.webview.html = Kind2WebviewContent;
    })
  );

  // The server is implemented in node
  let serverCmd = context.asAbsolutePath(
    path.join('kind2-lsp', 'bin', 'kind2-lsp')
  );
  // The debug options for the server
  // --inspect=6009: runs the server in Node's Inspector mode so VS Code can attach to the server for debugging

  // If the extension is launched in debug mode then the debug server options are used
  // Otherwise the run options are used
  let serverOptions: ServerOptions = {
    run: { command: serverCmd },
    debug: { command: serverCmd }
  };

  let x = ["--color", "false"];

  // Options to control the language client
  let clientOptions: LanguageClientOptions = {
    // Register the server for plain text documents
    documentSelector: [{ scheme: 'file', language: 'lustre' }],
    synchronize: {
      // Notify the server about file changes to '.clientrc files contained in the workspace
      fileEvents: vscode.workspace.createFileSystemWatcher('**/.clientrc')
    },
    //initializationOptions: x
  };

  // Create the language client and start the client.
  client = new LanguageClient(
    'vscode-kind2',
    'Kind 2',
    //serverOptions,
    connectToTCPServer(),
    clientOptions
  );

  disposables.push(vscode.commands.registerCommand('kind2/check', (uri: String, name: String) => {
    client.traceOutputChannel.appendLine("Sending notification 'kind2/check'.")
    client.sendNotification("kind2/check", [uri, name]);
  }));

  //context.subscriptions.push(disposable);

  // Setup the test adapter for components
  setupAdapter(context, client);

  // Start the client. This will also launch the server
  client.start();
}

function getWebViewPanel(): vscode.WebviewPanel {
  //let webViewPanel: vscode.WebviewPanel = vscode.window.createWebviewPanel(, "Kind 2",);

  return undefined;
}

function connectToTCPServer(): ServerOptions {
  let serverExec: ServerOptions = function () {

    return new Promise((resolve) => {
      net.createServer(socket => {
        let res: StreamInfo = { reader: <NodeJS.ReadableStream>socket, writer: socket };
        resolve(res);
      }).listen(23555, "localhost");

    });
  };
  return serverExec;
}

export function deactivate(): Thenable<void> | undefined {
  if (disposables) {
    disposables.forEach(item => item.dispose());
  }
  disposables = [];
  if (!client) {
    return undefined;
  }
  return client.stop();
}
