"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runFakeTests = exports.buildTree = exports.loadFakeTests = void 0;
const lsp = require("./extension");
let testSuite = {
    type: 'suite',
    id: 'root',
    label: 'Kind2',
    children: []
};
async function loadFakeTests() {
    let client = lsp.getLanguageClient();
    if (!(client === undefined || client.needsStart())) {
        client.traceOutputChannel.appendLine("Sending request 'kind2/getComponents'.");
        return client.sendRequest("kind2/getComponents").then((components) => {
            buildTree(components);
            return testSuite;
        });
    }
    return Promise.resolve(undefined);
}
exports.loadFakeTests = loadFakeTests;
function buildTree(components) {
    for (const component of components) {
        let newComponent = true;
        for (const child of testSuite.children) {
            if (child.id === component.command.title) {
                newComponent = false;
            }
        }
        if (newComponent) {
            testSuite.children.push({
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
exports.buildTree = buildTree;
async function runFakeTests(tests, testStatesEmitter) {
    let set = new Set();
    for (const test of tests) {
        const component = findComponent(testSuite, test);
        if (component && !set.has(component)) {
            set.add(component);
            await runComponent(component, testStatesEmitter);
        }
    }
}
exports.runFakeTests = runFakeTests;
function findComponent(root, id) {
    for (const child of root.children) {
        if (child.type === 'suite' && isDescendant(child, id)) {
            return child;
        }
    }
    return undefined;
}
function isDescendant(node, id) {
    if (node.id === id) {
        return true;
    }
    if (node.type === 'suite') {
        for (const child of node.children) {
            if (isDescendant(child, id)) {
                return true;
            }
        }
    }
    return false;
}
async function runComponent(node, testStatesEmitter) {
    testStatesEmitter.fire({ type: 'suite', suite: node.id, state: 'running' });
    // TODO: improve on this...
    for (const child of node.children) {
        testStatesEmitter.fire({ type: 'test', test: child.id, state: 'running' });
    }
    let client = lsp.getLanguageClient();
    client.sendRequest("kind2/check2", [`file://${node.file}`, node.label]).then(result => {
        testStatesEmitter.fire({ type: 'suite', suite: node.id, state: 'completed' });
        for (const child of node.children) {
            // TODO: improve on this...
            testStatesEmitter.fire({ type: 'test', test: node.id, state: `${true ? 'passed' : 'failed'}` });
        }
    });
}
//# sourceMappingURL=properties.js.map