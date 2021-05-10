"use strict";
/* --------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */
Object.defineProperty(exports, "__esModule", { value: true });
exports.deactivate = exports.activate = void 0;
const net = require("net");
const path = require("path");
const vscode = require("vscode");
const vscode_languageclient_1 = require("vscode-languageclient");
const Kind2_1 = require("./Kind2");
const webviewPanel_1 = require("./webviewPanel");
let client;
let kind2;
async function activate(context) {
    let registerCommand = (command, callback) => {
        context.subscriptions.push(vscode.commands.registerCommand(command, callback));
    };
    registerCommand('angular-webview.start', () => {
        webviewPanel_1.WebPanel.createOrShow(context.extensionPath);
    });
    // The server is implemented in node
    let serverCmd = context.asAbsolutePath(path.join('kind2-lsp', 'bin', 'kind2-lsp'));
    // If the extension is launched in debug mode then the debug server options are used
    // Otherwise the run options are used
    let serverOptions = {
        run: { command: serverCmd },
        debug: { command: serverCmd }
    };
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
    kind2 = new Kind2_1.Kind2(context, client);
    registerCommand('kind2/check', async (node) => await kind2.check(node));
    registerCommand('kind2/raw', (component) => kind2.raw(component));
    registerCommand('kind2/counterExample', async (property) => {
        await kind2.counterExample(property);
    });
    registerCommand('kind2/interpret', async (component, json) => {
        if (component instanceof Array) {
            await kind2.interpret(component[0], component[1], json);
        }
        else {
            await kind2.interpret(component.uri, component.name, json);
        }
    });
    registerCommand('kind2/showSource', (node) => kind2.showSource(node));
    const treeView = vscode.window.createTreeView("properties", { treeDataProvider: kind2, canSelectMany: false, showCollapseAll: true });
    registerCommand('kind2/reveal', (node) => kind2.reveal(node, treeView));
    context.subscriptions.push(treeView);
    const documentSelector = { language: "lustre" };
    context.subscriptions.push(vscode.languages.registerCodeLensProvider(documentSelector, kind2));
    // Setup the test adapter for components
    // setupAdapter(context, client);
    // Start the client. This will also launch the server
    client.start();
    await client.onReady().then(async () => client.onNotification("kind2/updateComponents", (uri) => kind2.updateComponents(uri)));
}
exports.activate = activate;
function connectToTCPServer() {
    let serverExec = () => {
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
    var _a;
    (_a = webviewPanel_1.WebPanel.currentPanel) === null || _a === void 0 ? void 0 : _a.dispose();
    if (!client) {
        return undefined;
    }
    return client.stop();
}
exports.deactivate = deactivate;
//# sourceMappingURL=extension.js.map