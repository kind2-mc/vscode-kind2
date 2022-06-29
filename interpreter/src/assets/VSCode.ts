export interface VSCode {
    postMessage(message: any): void;
    getState(): any;
    setState(state: any): void;
};

export declare const vscode: VSCode;
