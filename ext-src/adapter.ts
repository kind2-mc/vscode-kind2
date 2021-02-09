import * as vscode from 'vscode';
import { LanguageClient } from 'vscode-languageclient';
import { TestAdapter, TestLoadStartedEvent, TestLoadFinishedEvent, TestRunStartedEvent, TestRunFinishedEvent, TestSuiteEvent, TestEvent, TestSuiteInfo, TestInfo, RetireEvent } from 'vscode-test-adapter-api';
import { Log } from 'vscode-test-adapter-util';
import { CounterExample } from './counterExample';
import { WebPanel } from './webviewPanel';

/**
 * This class is intended as a starting point for implementing a "real" TestAdapter.
 * The file `README.md` contains further instructions.
 */
export class ExampleAdapter implements TestAdapter {

    private testSuite: TestSuiteInfo;

    private disposables: { dispose(): void }[] = [];

    private isLoading: boolean;

    private readonly testsEmitter = new vscode.EventEmitter<TestLoadStartedEvent | TestLoadFinishedEvent>();
    private readonly testStatesEmitter = new vscode.EventEmitter<TestRunStartedEvent | TestRunFinishedEvent | TestSuiteEvent | TestEvent>();
    private readonly autorunEmitter = new vscode.EventEmitter<void>();
    private readonly retireEmitter = new vscode.EventEmitter<RetireEvent>();

    get tests(): vscode.Event<TestLoadStartedEvent | TestLoadFinishedEvent> { return this.testsEmitter.event; }
    get testStates(): vscode.Event<TestRunStartedEvent | TestRunFinishedEvent | TestSuiteEvent | TestEvent> { return this.testStatesEmitter.event; }
    get autorun(): vscode.Event<void> | undefined { return this.autorunEmitter.event; }

    constructor(
        public readonly workspace: vscode.WorkspaceFolder,
        private readonly client: LanguageClient,
        private readonly log: Log
    ) {
        this.testSuite = {
            type: 'suite',
            id: 'root',
            label: 'Kind 2', // the label of the root node should be the name of the testing framework
            children: []
        };

        this.client = client;

        this.log.info('Initializing Kind 2 adapter');

        this.isLoading = false;

        this.disposables.push(this.testsEmitter);
        this.disposables.push(this.testStatesEmitter);
        this.disposables.push(this.autorunEmitter);

    }

    async load(): Promise<void> {


        if (this.isLoading) return; // it is safe to ignore a call to `load()`, even if it comes directly from the Test Explorer

        this.isLoading = true;

        this.log.info('Loading HUnit tests');

        this.testsEmitter.fire(<TestLoadStartedEvent>{ type: 'started' });

        await this.loadFakeTests();

        this.testsEmitter.fire(<TestLoadFinishedEvent>{ type: 'finished', suite: this.testSuite });

        this.retireEmitter.fire({ tests: [] });

        this.isLoading = false;
    }

    async loadFakeTests(): Promise<void> {
        if (!(this.client === undefined || this.client.needsStart())) {
            this.client.traceOutputChannel.appendLine("Sending request 'kind2/getComponents'.")
            const components: [vscode.CodeLens] = await this.client.sendRequest("kind2/getComponents");
            this.buildTree(components);
        }
    }

    buildTree(components: [vscode.CodeLens]): void {
        for (const component of components) {
            let isNew: boolean = true;
            for (const child of this.testSuite.children) {
                if (child.id === component.command!.title) {
                    isNew = false;
                }
            }
            if (isNew) {
                this.testSuite.children.push({
                    type: "suite",
                    id: component.command!.title,
                    label: component.command!.title,
                    file: component.command!.arguments![0].substr(7),
                    line: component.range.start.line,
                    children: []
                });
            }
        }
    }

    async run(tests: string[]): Promise<void> {

        this.log.info(`Running HUnit tests ${JSON.stringify(tests)}`);

        this.testStatesEmitter.fire(<TestRunStartedEvent>{ type: 'started', tests });

        // in a "real" TestAdapter this would start a test run in a child process
        await this.runFakeTests(tests, this.testStatesEmitter);

        this.testStatesEmitter.fire(<TestRunFinishedEvent>{ type: 'finished' });

    }

    async runFakeTests(
        tests: string[],
        testStatesEmitter: vscode.EventEmitter<TestRunStartedEvent | TestRunFinishedEvent | TestSuiteEvent | TestEvent>
    ): Promise<void> {
        vscode.workspace.saveAll();
        let set: Set<TestSuiteInfo> = new Set<TestSuiteInfo>();
        for (const test of tests) {
            const component = this.findComponent(this.testSuite, test);
            if (component && !set.has(component)) {
                set.add(component);
                await this.runComponent(component, testStatesEmitter);
            }
        }
    }

    findComponent(root: TestSuiteInfo, id: string): TestSuiteInfo | undefined {
        for (const child of root.children) {
            if (child.type === 'suite' && this.isDescendant(child, id)) {
                return child;
            }
        }

        return undefined;
    }

    isDescendant(node: TestSuiteInfo | TestInfo, id: string): boolean {
        if (node.id === id) {
            return true;
        }

        if (node.type === 'suite') {
            for (const child of node.children) {
                if (this.isDescendant(child, id)) { return true; }
            }
        }

        return false;
    }

    async runComponent(
        node: TestSuiteInfo,
        testStatesEmitter: vscode.EventEmitter<TestRunStartedEvent | TestRunFinishedEvent | TestSuiteEvent | TestEvent>
    ): Promise<void> {

        testStatesEmitter.fire(<TestSuiteEvent>{ type: 'suite', suite: node.id, state: 'running' });

        let result: any[] = await this.client.sendRequest("kind2/check2", [`file://${node.file}`, node.label]).then(result => {
            return (result as string[]).map((s: string) => JSON.parse(s));
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
            testStatesEmitter.fire(<TestEvent>{ type: 'test', test: child.id, state: 'running' });
        }

        for (let i = 0; i < node.children.length; i++) {
            // TODO: improve on this...
            testStatesEmitter.fire(<TestEvent>{ type: 'test', test: node.children[i].id, state: `${result[i].answer.value === "valid" ? 'passed' : 'failed'}` });
        }

        /*         for (const child of node.children) {
                    // TODO: improve on this...
                    testStatesEmitter.fire(<TestEvent>{ type: 'test', test: node.id, state: `${result. ? 'passed' : 'failed'}` });
                } */

        testStatesEmitter.fire(<TestSuiteEvent>{ type: 'suite', suite: node.id, state: 'completed' });
    }

    /*  implement this method if your TestAdapter supports debugging tests
        async debug(tests: string[]): Promise<void> {
            // start a test run in a child process and attach the debugger to it...
        }
    */

    cancel(): void {
        // in a "real" TestAdapter this would kill the child process for the current test run (if there is any)
        throw new Error("Method not implemented.");
    }

    dispose(): void {
        this.cancel();
        for (const disposable of this.disposables) {
            disposable.dispose();
        }
        this.disposables = [];
    }
}
