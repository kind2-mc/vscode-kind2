"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ExampleAdapter = void 0;
const vscode = require("vscode");
const vscode_1 = require("vscode");
/**
 * This class is intended as a starting point for implementing a "real" TestAdapter.
 * The file `README.md` contains further instructions.
 */
class ExampleAdapter {
    constructor(workspace, client, log) {
        this.workspace = workspace;
        this.client = client;
        this.log = log;
        this.disposables = [];
        this.testsEmitter = new vscode.EventEmitter();
        this.testStatesEmitter = new vscode.EventEmitter();
        this.autorunEmitter = new vscode.EventEmitter();
        this.retireEmitter = new vscode.EventEmitter();
        this.testSuite = {
            type: 'suite',
            id: 'root',
            label: 'Kind 2',
            children: []
        };
        this.client = client;
        this.log.info('Initializing Kind 2 adapter');
        this.isLoading = false;
        this.disposables.push(this.testsEmitter);
        this.disposables.push(this.testStatesEmitter);
        this.disposables.push(this.autorunEmitter);
    }
    get tests() { return this.testsEmitter.event; }
    get testStates() { return this.testStatesEmitter.event; }
    get autorun() { return this.autorunEmitter.event; }
    async load() {
        if (this.isLoading)
            return; // it is safe to ignore a call to `load()`, even if it comes directly from the Test Explorer
        this.isLoading = true;
        this.log.info('Loading HUnit tests');
        this.testsEmitter.fire({ type: 'started' });
        await this.loadFakeTests();
        this.testsEmitter.fire({ type: 'finished', suite: this.testSuite });
        this.retireEmitter.fire({ tests: [] });
        this.isLoading = false;
    }
    async loadFakeTests() {
        var _a;
        if (!(this.client === undefined || this.client.needsStart())) {
            this.client.traceOutputChannel.appendLine("Sending request 'kind2/getComponents'.");
            const components = await this.client.sendRequest("kind2/getComponents", (_a = vscode.window.activeTextEditor) === null || _a === void 0 ? void 0 : _a.document.uri.toString());
            this.buildTree(components);
        }
    }
    buildTree(components) {
        for (const component of components) {
            let isNew = true;
            for (const child of this.testSuite.children) {
                if (child.id === component.command.title) {
                    isNew = false;
                }
            }
            if (isNew) {
                this.testSuite.children.push({
                    type: "suite",
                    id: component.command.title,
                    label: component.command.title,
                    file: component.command.arguments[0].substr(7),
                    line: component.range.start.line,
                    children: []
                });
            }
        }
    }
    async run(tests) {
        this.log.info(`Running HUnit tests ${JSON.stringify(tests)}`);
        this.testStatesEmitter.fire({ type: 'started', tests });
        // in a "real" TestAdapter this would start a test run in a child process
        await this.runFakeTests(tests, this.testStatesEmitter);
        this.testStatesEmitter.fire({ type: 'finished' });
    }
    async runFakeTests(tests, testStatesEmitter) {
        vscode.workspace.saveAll();
        let set = new Set();
        for (const test of tests) {
            const component = this.findComponent(this.testSuite, test);
            if (component && !set.has(component)) {
                set.add(component);
                await this.runComponent(component, testStatesEmitter);
            }
        }
    }
    findComponent(root, id) {
        for (const child of root.children) {
            if (child.type === 'suite' && this.isDescendant(child, id)) {
                return child;
            }
        }
        return undefined;
    }
    isDescendant(node, id) {
        if (node.id === id) {
            return true;
        }
        if (node.type === 'suite') {
            for (const child of node.children) {
                if (this.isDescendant(child, id)) {
                    return true;
                }
            }
        }
        return false;
    }
    async runComponent(node, testStatesEmitter) {
        testStatesEmitter.fire({ type: 'suite', suite: node.id, state: 'running' });
        let result = await this.client.sendRequest("kind2/check2", [vscode_1.Uri.file(node.file).toString(), node.label]).then(result => {
            return result.map((s) => JSON.parse(s));
        });
        node.children = [];
        result[0];
        for (const property of result) {
            node.children.push({
                type: "test",
                id: property.name,
                label: property.name,
                file: property.file,
                line: property.line - 1
            });
        }
        this.load();
        // TODO: improve on this...
        for (const child of node.children) {
            testStatesEmitter.fire({ type: 'test', test: child.id, state: 'running' });
        }
        for (let i = 0; i < node.children.length; i++) {
            // TODO: improve on this...
            testStatesEmitter.fire({ type: 'test', test: node.children[i].id, state: `${result[i].answer.value === "valid" ? 'passed' : 'failed'}` });
        }
        /*         for (const child of node.children) {
                    // TODO: improve on this...
                    testStatesEmitter.fire(<TestEvent>{ type: 'test', test: node.id, state: `${result. ? 'passed' : 'failed'}` });
                } */
        testStatesEmitter.fire({ type: 'suite', suite: node.id, state: 'completed' });
    }
    /*  implement this method if your TestAdapter supports debugging tests
        async debug(tests: string[]): Promise<void> {
            // start a test run in a child process and attach the debugger to it...
        }
    */
    cancel() {
        // in a "real" TestAdapter this would kill the child process for the current test run (if there is any)
        throw new Error("Method not implemented.");
    }
    dispose() {
        this.cancel();
        for (const disposable of this.disposables) {
            disposable.dispose();
        }
        this.disposables = [];
    }
}
exports.ExampleAdapter = ExampleAdapter;
//# sourceMappingURL=adapter.js.map