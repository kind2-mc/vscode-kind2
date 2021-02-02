"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.setupAdapter = void 0;
const vscode = require("vscode");
const vscode_test_adapter_api_1 = require("vscode-test-adapter-api");
const vscode_test_adapter_util_1 = require("vscode-test-adapter-util");
const adapter_1 = require("./adapter");
async function setupAdapter(context, client) {
    const workspaceFolder = (vscode.workspace.workspaceFolders || [])[0];
    // create a simple logger that can be configured with the configuration variables
    // `Kind2Explorer.logpanel` and `Kind2Explorer.logfile`
    const log = new vscode_test_adapter_util_1.Log('Kind2Explorer', workspaceFolder, 'Kind 2 Explorer Log');
    context.subscriptions.push(log);
    // get the Test Explorer extension
    const testExplorerExtension = vscode.extensions.getExtension(vscode_test_adapter_api_1.testExplorerExtensionId);
    if (log.enabled)
        log.info(`Test Explorer ${testExplorerExtension ? '' : 'not '}found`);
    if (testExplorerExtension) {
        const testHub = testExplorerExtension.exports;
        // this will register an Kind2Explorer for each WorkspaceFolder
        context.subscriptions.push(new vscode_test_adapter_util_1.TestAdapterRegistrar(testHub, (workspaceFolder) => new adapter_1.ExampleAdapter(workspaceFolder, client, log), log));
    }
}
exports.setupAdapter = setupAdapter;
//# sourceMappingURL=adapterSetup.js.map