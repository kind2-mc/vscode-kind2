/*
 * Copyright (c) 2021, Board of Trustees of the University of Iowa All rights reserved.
 *
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */

import * as os from "os";
import * as path from "path";
import { CancellationToken, CancellationTokenSource, CodeLens, CodeLensProvider, DecorationOptions, Event, EventEmitter, ExtensionContext, Position, ProviderResult, Range, ShellExecution, Task, tasks, TaskScope, TextDocument, TextEditorDecorationType, TreeDataProvider, TreeItem, TreeItemCollapsibleState, TreeView, Uri, window } from "vscode";
import { LanguageClient } from "vscode-languageclient";
import { Analysis, Component, File, Property, State, statePath, TreeNode } from "./treeNode";
import { WebPanel } from "./webviewPanel";

export class Kind2 implements TreeDataProvider<TreeNode>, CodeLensProvider {
  private _fileMap: Map<String, Set<String>>;
  private _files: File[];
  private _runningChecks: Map<Component, CancellationTokenSource>;
  private readonly _treeDataChanged: EventEmitter<TreeNode | null | undefined>;
  private readonly _codeLensesChanged: EventEmitter<void>;
  private readonly _decorationTypeMap: Map<State, TextEditorDecorationType>;

  constructor(private _context: ExtensionContext, private _client: LanguageClient) {
    this._fileMap = new Map<String, Set<String>>();
    this._files = [];
    this._runningChecks = new Map<Component, CancellationTokenSource>();
    this._treeDataChanged = new EventEmitter<TreeNode | undefined | null>();
    this._codeLensesChanged = new EventEmitter<void>();
    this.onDidChangeTreeData = this._treeDataChanged.event;
    this.onDidChangeCodeLenses = this._codeLensesChanged.event;
    this._decorationTypeMap = new Map<State, TextEditorDecorationType>([
      ["pending", window.createTextEditorDecorationType({ gutterIconPath: this._context.asAbsolutePath(statePath("pending")) })],
      ["running", window.createTextEditorDecorationType({ gutterIconPath: this._context.asAbsolutePath(statePath("running")) })],
      ["passed", window.createTextEditorDecorationType({ gutterIconPath: this._context.asAbsolutePath(statePath("passed")) })],
      ["reachable", window.createTextEditorDecorationType({ gutterIconPath: this._context.asAbsolutePath(statePath("reachable")) })],
      ["failed", window.createTextEditorDecorationType({ gutterIconPath: this._context.asAbsolutePath(statePath("failed")) })],
      ["unreachable", window.createTextEditorDecorationType({ gutterIconPath: this._context.asAbsolutePath(statePath("unreachable")) })],
      ["stopped", window.createTextEditorDecorationType({ gutterIconPath: this._context.asAbsolutePath(statePath("stopped")) })],
      ["unknown", window.createTextEditorDecorationType({ gutterIconPath: this._context.asAbsolutePath(statePath("unknown")) })],
      ["errored", window.createTextEditorDecorationType({ gutterIconPath: this._context.asAbsolutePath(statePath("errored")) })],
      ["realizable", window.createTextEditorDecorationType({ gutterIconPath: this._context.asAbsolutePath(statePath("realizable")) })],
      ["unrealizable", window.createTextEditorDecorationType({ gutterIconPath: this._context.asAbsolutePath(statePath("unrealizable")) })],
      ["contract realizable", window.createTextEditorDecorationType({ gutterIconPath: this._context.asAbsolutePath(statePath("contract realizable")) })],
      ["contract unrealizable", window.createTextEditorDecorationType({ gutterIconPath: this._context.asAbsolutePath(statePath("contract unrealizable")) })],
      ["inputs realizable", window.createTextEditorDecorationType({ gutterIconPath: this._context.asAbsolutePath(statePath("inputs realizable")) })],
      ["inputs unrealizable", window.createTextEditorDecorationType({ gutterIconPath: this._context.asAbsolutePath(statePath("inputs unrealizable")) })],
    ])
  }

  onDidChangeCodeLenses?: Event<void> | undefined;

  provideCodeLenses(document: TextDocument, _token: CancellationToken): ProviderResult<CodeLens[]> {
    let codeLenses: CodeLens[] = [];
    let file = this._files.find(file => file.uri === document.uri.toString());
    if (file) {
      for (const component of file.components) {
        let range = new Range(component.line, 0, component.line, 0);

        if (component.state.length > 0 && component.state[0] === "running") {
          codeLenses.push(new CodeLens(range, { title: "Cancel", command: "kind2/cancel", arguments: [component] }));
        } else {
          codeLenses.push(new CodeLens(range, { title: "Check Properties", command: "kind2/check", arguments: [component] }));
          codeLenses.push(new CodeLens(range, { title: "Check Realizability", command: "kind2/realizability", arguments: [component] }))
        }
        codeLenses.push(new CodeLens(range, { title: "Simulate", command: "kind2/interpret", arguments: [component, "[]"] }));
        codeLenses.push(new CodeLens(range, { title: "Raw Output", command: "kind2/raw", arguments: [component] }));
        codeLenses.push(new CodeLens(range, { title: "Show in Explorer", command: "kind2/reveal", arguments: [component] }));
      }
    }
    return codeLenses;
  }

  public readonly onDidChangeTreeData: Event<TreeNode | null | undefined>;

  public getTreeItem(element: TreeNode): TreeItem | Thenable<TreeItem> {
    let item: TreeItem;
    if (element instanceof File) {
      item = new TreeItem(element.name, element.components.length === 0 ? TreeItemCollapsibleState.None : TreeItemCollapsibleState.Expanded);
    }
    else if (element instanceof Component) {
      item = new TreeItem(element.name, element.analyses.length === 0 ? TreeItemCollapsibleState.None : TreeItemCollapsibleState.Expanded);
      item.contextValue = element.state.length > 0 && element.state[0] === "running" ? "running" : "component";
      item.iconPath = Uri.file(path.join(this._context.extensionPath, statePath(element.state[0])));
      // item.iconPath = stateIcon(element.state);
    }
    else if (element instanceof Analysis) {
      if (element.realizability === "none") {
        let label = "Abstract: " + (element.abstract.length == 0 ? "none" : "[" + element.abstract.toString() + "]");
        label += " - Concrete: " + (element.concrete.length == 0 ? "none" : "[" + element.concrete.toString() + "]");
        item = new TreeItem(label, element.properties.length === 0 ? TreeItemCollapsibleState.None : TreeItemCollapsibleState.Expanded);
        item.contextValue = "analysis";
      } 
      else if (element.realizability === "realizable") {
        item = new TreeItem(element.realizabilitySource, TreeItemCollapsibleState.None);
        item.iconPath = Uri.file(path.join(this._context.extensionPath, statePath("passed")));
      }
      else {
        item = new TreeItem(element.realizabilitySource, TreeItemCollapsibleState.None);
        item.iconPath = Uri.file(path.join(this._context.extensionPath, statePath("failed")));
        item.contextValue = "hasDeadlock";
      }
    }
    else {
      item = new TreeItem(element.name, TreeItemCollapsibleState.None);
      if (element.state == "failed" || element.state == "reachable") {
        item.contextValue = "hasTrace";
      }
      item.iconPath = Uri.file(path.join(this._context.extensionPath, statePath(element.state)));
      // item.iconPath = stateIcon(element.state);
    }
    return item;
  }

  public getChildren(element?: TreeNode): ProviderResult<TreeNode[]> {
    if (element == undefined) {
      return this._files;
    }
    if (element instanceof File) {
      return element.components;
    }
    if (element instanceof Component) {
      return element.analyses;
    }
    if (element instanceof Analysis) {
      return element.properties;
    }
  }

  public getParent(element: TreeNode): ProviderResult<TreeNode> {
    return element.parent;
  }

  public updateDecorations(): void {
    let decorations = new Map<string, Map<State, DecorationOptions[]>>();
    for (const file of this._files) {
      decorations.set(file.uri, new Map<State, DecorationOptions[]>([["pending", []], ["running", []], ["passed", []], ["reachable", []],  ["failed", []], ["unreachable", []], ["stopped", []], ["unknown", []], ["errored", []], ["realizable", []], ["inputs realizable", []], ["contract realizable", []], ["unrealizable", []], ["inputs unrealizable", []], ["contract unrealizable", []],]));
    }
    for (const file of this._files) {
      for (const component of file.components) {
        for (const state of component.state) {
          if (state.startsWith("contract")) {
            decorations.get(component.uri)?.get(state)?.push({ range: new Range(new Position(component.contractLine, 0), (new Position(component.contractLine, 0))) });
          }
          else {
            decorations.get(component.uri)?.get(state)?.push({ range: new Range(new Position(component.line, 0), (new Position(component.line, 0))) });
          }
        }
        for (const property of component.properties) {
          if (decorations.has(property.uri)) {
            let decorationOptions: DecorationOptions = { range: new Range(new Position(property.line, 0), (new Position(property.line, 100))) };
            decorations.get(property.uri)?.get(property.state)?.push(decorationOptions);
          }
        }
      }
    }
    for (const uri of decorations.keys()) {
      let editor = window.visibleTextEditors.find(editor => editor.document.uri.toString() === uri);
      for (const state of <State[]>["pending", "running", "passed", "reachable", "failed", "unreachable", "stopped", "unknown", "errored", "realizable", "unrealizable", "inputs realizable", "contract realizable", "inputs unrealizable", "contract unrealizable"]) {
        editor?.setDecorations(this._decorationTypeMap.get(state)!, decorations.get(uri)?.get(state)!);
      }
    }
  }

  public getDefaultKind2Path(): string {
    return this._context.asAbsolutePath("kind2");
  }

  public getDefaultZ3Path(): string {
    return this._context.asAbsolutePath("z3");
  }

  private updateFileNames(): void {
    for (let file of this._files) {
      let path = Uri.parse(file.uri).path.split("/");
      let name = path[path.length - 1];
      for (let other of this._files) {
        if (other !== file && other.name.endsWith(name)) {
          let otherPath = Uri.parse(other.uri).path.split("/");
          let i = path.length - 1, j = otherPath.length - 1;
          while (i > 0 && j > 0 && path[i] === otherPath[j]) {
            --i;
            --j;
          }
          // A path may be a postfix of another.
          if (i == 0) { --j; }
          else if (j == 0) { --i; }
          name = path.slice(i).join("/");
          let otherNewName = otherPath.slice(j).join("/");
          if (other.name.length < otherNewName.length) {
            other.name = otherNewName;
          }
        }
      }
      file.name = name;
    }
  }

  public async updateComponents(uri: string): Promise<void> {
    // First, cancel all running checks.
    for (const check of this._runningChecks.values()) {
      check.cancel();
    }
    this._runningChecks = new Map<Component, CancellationTokenSource>();
    // Then, remove all components of files depending on this one.
    // for (const file of this._files) {
    //   if (this._fileMap.has(file.uri) && this._fileMap.get(file.uri).has(uri)) {
    //     file.components = [];
    //   }
    // }
    // This is now a main file.
    this._fileMap.set(uri, new Set<String>());
    const components: any[] = await this._client.sendRequest("kind2/getComponents", uri).then(values => {
      return (values as string[]).map(value => JSON.parse(value));
    });
    // Remove this file, if we need to replace its components.
    let mainFile = this._files.find(f => f.uri === uri);
    let newFiles: File[] = [];
    if (components.length !== 0 && mainFile) {
      this._files = this._files.filter(f => f.uri !== uri);
      mainFile.components = []
      newFiles.push(mainFile);
    }
    for (let component of components) {
      this._fileMap.get(uri).add(component.file);
      // Only add components if this is the first time we see their files.
      if (this._files.find(f => f.uri === component.file) === undefined) {
        let file = newFiles.find(f => f.uri === component.file);
        if (!file) {
          // Check if any other file ends with the same name.
          let path = Uri.parse(component.file).path.split("/");
          let name = path[path.length - 1];
          file = new File(component.file, name);
          newFiles.push(file);
        }
        var contractStart = component.contractStartLine - 1;
        if (component.contractStartLine === undefined) {
          contractStart = component.startLine - 1;
        }
        file.components.push(new Component(component.name, component.startLine - 1, contractStart, file));
      }
    }
    this._files = this._files.concat(newFiles);
    // Finally, remove files that no main file depends on.
    let values = new Set<String>();
    for (const value of this._fileMap.values()) {
      for (const uri of value) {
        values.add(uri);
      }
    }
    let toRemove = new Set<File>();
    for (const file of this._files) {
      if (!values.has(file.uri)) {
        toRemove.add(file);
      }
    }
    this._files = this._files.filter(f => !toRemove.has(f));
    // Finally, update file names.
    this.updateFileNames();
    this._treeDataChanged.fire(undefined);
    this._codeLensesChanged.fire();
    this.updateDecorations();
  }

  public async showSource(node: TreeNode): Promise<void> {
    if (node instanceof Analysis) {
      return;
    }
    let range = new Range(node.line, 0, node.line, 0);
    await window.showTextDocument(Uri.parse(node.uri, true), { selection: range });
  }

  public async check(mainComponent: Component): Promise<void> {
    mainComponent.analyses = [];
    mainComponent.state = ["running"];
    let files: File[] = [];
    for (const uri of this._fileMap.get(mainComponent.uri)) {
      let file = this._files.find(f => f.uri === uri);
      files.push(file);
    }
    let modifiedComponents: Component[] = [];
    modifiedComponents.push(mainComponent);
    for (const component of modifiedComponents) {
      this._treeDataChanged.fire(component);
    }
    this._codeLensesChanged.fire();
    this.updateDecorations();
    let tokenSource = new CancellationTokenSource();
    this._runningChecks.set(mainComponent, tokenSource);
    await this._client.sendRequest("kind2/check", [mainComponent.uri, mainComponent.name], tokenSource.token).then((values: string[]) => {
      let results: any[] = values.map(s => JSON.parse(s));
      for (const nodeResult of results) {
        let component = undefined;
        let i = 0;
        while (component === undefined) {
          component = files[i].components.find(c => c.name === nodeResult.name);
          ++i;
        }
        component.analyses = [];
        for (const analysisResult of nodeResult.analyses) {
          let analysis: Analysis = new Analysis(analysisResult.abstract, analysisResult.concrete, component);
          for (const propertyResult of analysisResult.properties) {
            let property = new Property(propertyResult.name, propertyResult.line - 1, propertyResult.file, analysis);
            switch (propertyResult.answer.value) {
              case "valid":   
                property.state = "passed";
                break;
              case "reachable":
                property.state = "reachable";
                break;
              case "falsifiable":
                property.state = "failed";
                break;
              case "unreachable":
                property.state = "unreachable";
                break;
              default:
                property.state = "unknown";
            }
            analysis.realizability = "none";
            analysis.properties.push(property);
          }
          component.analyses.push(analysis);
        }
        if (component.analyses.length == 0) {
          component.state = "passed";
        }
        modifiedComponents.push(component);
      }
      if (results.length == 0) {
        mainComponent.state = ["passed"];
      }
    }).catch(reason => {
      if (reason.message.includes("cancelled")) {
        mainComponent.state = ["stopped"];
      } else {
        window.showErrorMessage(reason.message);
        mainComponent.state = ["errored"];
      }
    });
    if (mainComponent.state.length > 0 && mainComponent.state[0] === "running") {
      mainComponent.state = ["passed"];
    }
    for (const component of modifiedComponents) {
      this._treeDataChanged.fire(component);
    }
    this._codeLensesChanged.fire();
    this.updateDecorations();
    this._runningChecks.delete(mainComponent);
  }

  public async realizability(mainComponent: Component): Promise<void> {
    mainComponent.analyses = [];
    mainComponent.state = ["running"];
    let files: File[] = [];
    for (const uri of this._fileMap.get(mainComponent.uri)) {
      let file = this._files.find(f => f.uri === uri);
      files.push(file);
    }
    let modifiedComponents: Component[] = [];
    modifiedComponents.push(mainComponent);
    for (const component of modifiedComponents) {
      this._treeDataChanged.fire(component);
    }
    this._codeLensesChanged.fire();
    this.updateDecorations();
    let tokenSource = new CancellationTokenSource();
    this._runningChecks.set(mainComponent, tokenSource);
    await this._client.sendRequest("kind2/realizability", [mainComponent.uri, mainComponent.name], tokenSource.token).then((values: string[]) => {
      let results: any[] = values.map(s => JSON.parse(s));
      for (const nodeResult of results) {
        let component = undefined;
        let i = 0;
        while (component === undefined) {
          component = files[i].components.find(c => c.name === nodeResult.name);
          ++i;
        }
        for (const analysisResult of nodeResult.analyses) {
          let analysis: Analysis = new Analysis([], [], component);
            analysis.realizability = analysisResult.realizabilityResult.toLowerCase();
            if (analysisResult.context === "contract") {
              analysis.realizabilitySource = "contract"
            }
            else if (analysisResult.context === "environment") {
              analysis.realizabilitySource = "inputs"
            }
            else {
              analysis.realizabilitySource = "imported node"
            }
            component.analyses.push(analysis);
        }
        if (component.analyses.length == 0) { 
          component.state = "passed";
        }
        modifiedComponents.push(component);
      }
      if (results.length == 0) {
        mainComponent.state = ["passed"];
      }
    }).catch(reason => {
      if (reason.message.includes("cancelled")) {
        mainComponent.state = ["stopped"];
      } else {
        window.showErrorMessage(reason.message);
        mainComponent.state = ["errored"];
      }
    });
    if (mainComponent.state.length > 0 && mainComponent.state[0] === "running") {
      mainComponent.state = ["passed"];
    }
    for (const component of modifiedComponents) {
      this._treeDataChanged.fire(component);
    }
    this._codeLensesChanged.fire();
    this.updateDecorations();
    this._runningChecks.delete(mainComponent);
  }

  public cancel(component: Component) {
    this._runningChecks.get(component).cancel();
  }

  public async interpret(uri: string, main: string, json: string): Promise<void> {
    await this._client.sendRequest("kind2/interpret", [uri, main, json]).then(async (interp: string) => {
      WebPanel.createOrShow(this._context.extensionPath);
      await WebPanel.currentPanel?.sendMessage({ uri: uri, main: main, json: interp });
    }).catch(reason => {
      window.showErrorMessage(reason.message);
    });
  }

  public async raw(component: Component): Promise<void> {
    await this._client.sendRequest("kind2/getKind2Cmd", [component.uri, component.name]).then(async (cmd: string[]) => {
      cmd = cmd.map(o => o.replace("%20", " "));
      await tasks.executeTask(new Task({ type: "kind2" }, TaskScope.Workspace, component.name, "Kind 2", new ShellExecution(cmd[0], cmd.slice(1))));
    }).catch(reason => {
      window.showErrorMessage(reason.message);
    });
  }

  public async reveal(node: TreeNode, treeView: TreeView<TreeNode>): Promise<void> {
    await treeView.reveal(node);
  }

  public async counterExample(property: Property): Promise<void> {
    await this._client.sendRequest("kind2/counterExample", [property.parent.parent.uri, property.parent.parent.name,
    property.parent.abstract, property.parent.concrete, property.name]).then((ce: string) => {
      WebPanel.createOrShow(this._context.extensionPath);
      WebPanel.currentPanel?.sendMessage({ uri: property.parent.parent.uri, main: property.parent.parent.name, json: ce });
    }).catch(reason => {
      window.showErrorMessage(reason.message);
    });
  }

  
  public async deadlock(analysis: Analysis): Promise<void> {
    var name = analysis.parent.name
    var context = "";
    if (analysis.realizabilitySource === "inputs") {
      context = "environment"
    }
    else if (analysis.realizabilitySource === "contract") {
      context = "contract"
    }
    await this._client.sendRequest("kind2/deadlock", [analysis.parent.uri, name, context]).then((dl: string) => {
      WebPanel.createOrShow(this._context.extensionPath);
      WebPanel.currentPanel?.sendMessage({ uri: analysis.parent.uri, main: analysis.parent.name, json: dl });
    }).catch(reason => {
      window.showErrorMessage(reason.message);
    });
  }
}
