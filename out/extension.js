"use strict";
/* --------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */
Object.defineProperty(exports, "__esModule", { value: true });
exports.deactivate = exports.activate = void 0;
const fs = require("fs");
const net = require("net");
const path = require("path");
const vscode = require("vscode");
const vscode_languageclient_1 = require("vscode-languageclient");
const adapterSetup_1 = require("./adapterSetup");
let client;
let disposables = [];
async function activate(context) {
    let Kind2WebviewContent = fs.readFileSync(context.asAbsolutePath(path.join('src', 'interpreter', 'interpreter.html'))).toString();
    context.subscriptions.push(vscode.commands.registerCommand('catCoding.start', () => {
        // Create and show panel
        const panel = vscode.window.createWebviewPanel('catCoding', 'Cat Coding', vscode.ViewColumn.One, {});
        // And set its HTML content
        panel.webview.html = Kind2WebviewContent;
    }));
    // The server is implemented in node
    let serverCmd = context.asAbsolutePath(path.join('kind2-lsp', 'bin', 'kind2-lsp'));
    // The debug options for the server
    // --inspect=6009: runs the server in Node's Inspector mode so VS Code can attach to the server for debugging
    // If the extension is launched in debug mode then the debug server options are used
    // Otherwise the run options are used
    let serverOptions = {
        run: { command: serverCmd },
        debug: { command: serverCmd }
    };
    let x = ["--color", "false"];
    // Options to control the language client
    let clientOptions = {
        // Register the server for plain text documents
        documentSelector: [{ scheme: 'file', language: 'lustre' }],
        synchronize: {
            // Notify the server about file changes to '.clientrc files contained in the workspace
            fileEvents: vscode.workspace.createFileSystemWatcher('**/.clientrc')
        },
    };
    // Create the language client and start the client.
    client = new vscode_languageclient_1.LanguageClient('vscode-kind2', 'Kind 2', 
    //serverOptions,
    connectToTCPServer(), clientOptions);
    disposables.push(vscode.commands.registerCommand('kind2/check', (uri, name) => {
        client.traceOutputChannel.appendLine("Sending notification 'kind2/check'.");
        client.sendNotification("kind2/check", [uri, name]);
    }));
    //context.subscriptions.push(disposable);
    // Setup the test adapter for components
    adapterSetup_1.setupAdapter(context, client);
    // Start the client. This will also launch the server
    client.start();
}
exports.activate = activate;
function getWebViewPanel() {
    //let webViewPanel: vscode.WebviewPanel = vscode.window.createWebviewPanel(, "Kind 2",);
    return undefined;
}
function connectToTCPServer() {
    let serverExec = function () {
        return new Promise((resolve) => {
            net.createServer(socket => {
                let res = { reader: socket, writer: socket };
                resolve(res);
            }).listen(23555, "localhost");
        });
    };
    return serverExec;
}
function deactivate() {
    if (disposables) {
        disposables.forEach(item => item.dispose());
    }
    disposables = [];
    if (!client) {
        return undefined;
    }
    return client.stop();
}
exports.deactivate = deactivate;
//# sourceMappingURL=extension.js.map