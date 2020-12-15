/* --------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import * as path from 'path';
import { window, workspace, ExtensionContext, commands, Disposable } from 'vscode';

import {
  InitializeRequest,
  LanguageClient,
  LanguageClientOptions,
  ServerOptions
} from 'vscode-languageclient';

let client: LanguageClient;
let disposables: Disposable[] = [];

export function activate(context: ExtensionContext) {
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
      fileEvents: workspace.createFileSystemWatcher('**/.clientrc')
    },
    //initializationOptions: x
  };

  // Create the language client and start the client.
  client = new LanguageClient(
    'vscode-kind2',
    'Kind 2',
    serverOptions,
    clientOptions
  );

  disposables.push(commands.registerCommand('kind2/check', (uri: String, name: String) => {
    client.traceOutputChannel.appendLine("Sending notification 'kind2/check'.")
    client.sendNotification("kind2/check", [uri, name]);
  }));

  //context.subscriptions.push(disposable);

  // Start the client. This will also launch the server
  client.start();
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
