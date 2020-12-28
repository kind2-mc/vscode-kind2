import * as vscode from 'vscode';
import { TestSuiteInfo, TestInfo, TestRunStartedEvent, TestRunFinishedEvent, TestSuiteEvent, TestEvent } from 'vscode-test-adapter-api';
import * as lsp from './extension';

let testSuite: TestSuiteInfo = {
    type: 'suite',
    id: 'root',
    label: 'Kind2', // the label of the root node should be the name of the testing framework
    children: []
};

export async function loadFakeTests(): Promise<TestSuiteInfo> {
    testSuite.children = [];

    let client = lsp.getLanguageClient();
    if (!(client === undefined || client.needsStart())) {
        client.traceOutputChannel.appendLine("Sending request 'kind2/getComponents'.")
        return client.sendRequest("kind2/getComponents").then((components: [vscode.CodeLens]) => {
            buildTree(components);
            return testSuite;
        });
    }

    return Promise.resolve<TestSuiteInfo>(undefined);
}

export function buildTree(components: [vscode.CodeLens]): void {
    for (const component of components) {
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

export async function runFakeTests(
    tests: string[],
    testStatesEmitter: vscode.EventEmitter<TestRunStartedEvent | TestRunFinishedEvent | TestSuiteEvent | TestEvent>
): Promise<void> {
    let set: Set<TestSuiteInfo> = new Set<TestSuiteInfo>();
    for (const test of tests) {
        const component = findComponent(testSuite, test);
        if (component && !set.has(component)) {
            set.add(component);
            await runComponent(component, testStatesEmitter);
        }
    }
}

function findComponent(root: TestSuiteInfo, id: string): TestSuiteInfo | undefined {
    for (const child of root.children) {
        if (child.type === 'suite' && isDescendant(child, id)) {
            return child;
        }
    }

    return undefined;
}

function isDescendant(node: TestSuiteInfo | TestInfo, id: string): boolean {
    if (node.id === id) {
        return true;
    }

    if (node.type === 'suite') {
        for (const child of node.children) {
            if (isDescendant(child, id)) { return true; }
        }
    }

    return false;
}

async function runComponent(
    node: TestSuiteInfo,
    testStatesEmitter: vscode.EventEmitter<TestRunStartedEvent | TestRunFinishedEvent | TestSuiteEvent | TestEvent>
): Promise<void> {

    testStatesEmitter.fire(<TestSuiteEvent>{ type: 'suite', suite: node.id, state: 'running' });

    // TODO: improve on this...
    for (const child of node.children) {
        testStatesEmitter.fire(<TestEvent>{ type: 'test', test: child.id, state: 'running' });
    }

    let client = lsp.getLanguageClient();
    client.sendRequest("kind2/check2", [`file://${node.file}`, node.label]).then(result => {
        testStatesEmitter.fire(<TestSuiteEvent>{ type: 'suite', suite: node.id, state: 'completed' });

        for (const child of node.children) {
            // TODO: improve on this...
            testStatesEmitter.fire(<TestEvent>{ type: 'test', test: node.id, state: `${true ? 'passed' : 'failed'}` });
        }
    });
}
