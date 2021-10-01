/*
 * Copyright (c) 2021, Board of Trustees of the University of Iowa All rights reserved.
 *
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */

import * as os from "os";
import * as path from "path";
import { CancellationToken, CodeLens, CodeLensProvider, DecorationOptions, Event, EventEmitter, ExtensionContext, MarkdownString, Position, ProviderResult, Range, ShellExecution, Task, tasks, TaskScope, TextDocument, TextEditorDecorationType, ThemeColor, ThemeIcon, TreeDataProvider, TreeItem, TreeItemCollapsibleState, TreeView, Uri, window, workspace } from "vscode";
import { LanguageClient } from "vscode-languageclient";
import { Component, File, Property, State, stateIcon, statePath, TreeNode } from "./treeNode";
import { WebPanel } from "./webviewPanel";

type SmtSolver = "Z3" | "CVC" | "Yices" | "Yices2" | "Boolector" | "MathSAT";

export class Kind2 implements TreeDataProvider<TreeNode>, CodeLensProvider {
  private _files: File[];
  private readonly _treeDataChanged: EventEmitter<TreeNode | null | undefined>;
  private readonly _codeLensesChanged: EventEmitter<void>;
  private readonly _decorationTypeMap: Map<State, TextEditorDecorationType>;

  constructor(private _context: ExtensionContext, private _client: LanguageClient) {
    this._files = [];
    this._treeDataChanged = new EventEmitter<TreeNode | undefined | null>();
    this._codeLensesChanged = new EventEmitter<void>();
    this.onDidChangeTreeData = this._treeDataChanged.event;
    this.onDidChangeCodeLenses = this._codeLensesChanged.event;
    this._decorationTypeMap = new Map<State, TextEditorDecorationType>([
      ["pending", window.createTextEditorDecorationType({ gutterIconPath: this._context.asAbsolutePath(statePath("pending")) })],
      ["running", window.createTextEditorDecorationType({ gutterIconPath: this._context.asAbsolutePath(statePath("running")) })],
      ["passed", window.createTextEditorDecorationType({ gutterIconPath: this._context.asAbsolutePath(statePath("passed")) })],
      ["failed", window.createTextEditorDecorationType({ gutterIconPath: this._context.asAbsolutePath(statePath("failed")) })]]);
  }

  onDidChangeCodeLenses?: Event<void> | undefined;

  provideCodeLenses(document: TextDocument, _token: CancellationToken): ProviderResult<CodeLens[]> {
    let codeLenses: CodeLens[] = [];
    let file = this._files.find(file => file.uri === document.uri.toString());
    if (file) {
      for (const component of file.components) {
        let range = new Range(component.line, 0, component.line, 0);
        codeLenses.push(new CodeLens(range, { title: "Check", command: "kind2/check", arguments: [component] }));
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
      item = new TreeItem(element.uri, element.components.length === 0 ? TreeItemCollapsibleState.None : TreeItemCollapsibleState.Expanded);
    }
    else if (element instanceof Component) {
      item = new TreeItem(element.name, element.properties.length === 0 ? TreeItemCollapsibleState.None : TreeItemCollapsibleState.Expanded);
      item.contextValue = "component";
      item.iconPath = Uri.file(path.join(this._context.extensionPath, statePath(element.state)));
      // item.iconPath = stateIcon(element.state);
    }
    else {
      item = new TreeItem(element.name, TreeItemCollapsibleState.None);
      if (element.state == "failed") {
        item.contextValue = "failed";
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
      return element.properties;
    }
  }

  public getParent(element: TreeNode): ProviderResult<TreeNode> {
    return element.parent;
  }

  public updateDecorations(): void {
    let decorations = new Map<string, Map<State, DecorationOptions[]>>();
    for (const file of this._files) {
      decorations.set(file.uri, new Map<State, DecorationOptions[]>([["pending", []], ["running", []], ["passed", []], ["failed", []]]));
    }
    for (const file of this._files) {
      for (const component of file.components) {
        decorations.get(component.uri)?.get(component.state)?.push({ range: new Range(new Position(component.line, 0), (new Position(component.line, 0))) });
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
      for (const state of <State[]>["pending", "running", "passed", "failed"]) {
        editor?.setDecorations(this._decorationTypeMap.get(state)!, decorations.get(uri)?.get(state)!);
      }
    }
  }

  private getPlatform(): string {
    let platform: string;
    switch (os.platform()) {
      case "linux":
        return "linux";
      case "darwin":
        return "macos";
      default:
        throw `Kind 2 extension does not support ${platform} platform.`;
    }
  }

  public getKind2Path(): string {
    let kind2Path = workspace.getConfiguration("kind2").get<string>("kind2Path")!;
    if (kind2Path == "") {
      return this._context.asAbsolutePath(path.join(this.getPlatform(), "kind2"));
    }
    else {
      return kind2Path;
    }
  }

  private getSmtSolver(): SmtSolver {
    return workspace.getConfiguration("kind2").get<SmtSolver>("smtSolver")!;
  }

  public getSmtSolverOption(): string {
    switch (this.getSmtSolver()) {
      case "Z3":
        return "--z3_bin";
      case "CVC":
        return "--cvc4_bin";
      case "Yices":
        return "--yices_bin";
      case "Yices2":
        return "--yices2_bin";
      case "Boolector":
        return "--boolector_bin";
      case "MathSAT":
        return "--Mathsat_bin";
    }
  }

  public getSmtSolverPath(): string {
    let smtSolverPath = workspace.getConfiguration("kind2").get<string>("smtSolverPath")!;
    if (smtSolverPath == "") {
      let smtSolver = this.getSmtSolver();
      if (smtSolver == "Z3") {
        return this._context.asAbsolutePath(path.join(this.getPlatform(), "z3"));
      }
      else {
        window.showErrorMessage(`Kind 2 extension is only bundled with the Z3 solver. Please provide the path to ${smtSolver}`);
        throw `Path to ${smtSolver} unkown.`
      }
    }
    else {
      return smtSolverPath;
    }
  }

  public async updateComponents(uri: string): Promise<void> {
    if (window.visibleTextEditors.find(editor => editor.document.uri.toString() === uri) === undefined) {
      this._files = this._files.filter(file => file.uri !== uri);
    } else {
      let file = this._files.find(file => file.uri === uri);
      const components: any[] = await this._client.sendRequest("kind2/getComponents", uri).then(values => {
        return (values as string[]).map(value => JSON.parse(value));
      });
      if (components.length > 0) {
        if (file) {
          file.components = [];
        } else {
          file = new File(uri);
          this._files.push(file);
        }
        for (const component of components) {
          file.components.push(new Component(component.name, component.startLine - 1, file));
        }
      }
    }
    this._treeDataChanged.fire(undefined);
    this._codeLensesChanged.fire();
    this.updateDecorations();
  }

  public async showSource(node: TreeNode): Promise<void> {
    let range = new Range(node.line, 0, node.line, 0);
    await window.showTextDocument(Uri.parse(node.uri, true), { selection: range });
  }

  public async check(component: Component): Promise<void> {
    component.properties = [];
    component.state = "running";
    this.updateDecorations();
    this._treeDataChanged.fire(component);
    this._codeLensesChanged.fire();
    let results: any[] = await this._client.sendRequest("kind2/check", [component.uri, component.name]).then(value => {
      return (value as string[]).map((s: string) => JSON.parse(s));
    });
    for (const result of results) {
      let property = new Property(result.name, result.line - 1, result.file, component);
      property.state = result.answer.value === "valid" ? "passed" : "failed";
      component.properties.push(property);
    }
    if (results.length == 0) {
      component.state = "passed";
    }
    this._treeDataChanged.fire(component);
    this._codeLensesChanged.fire();
    this.updateDecorations();
  }

  public async interpret(uri: string, main: string, json: string): Promise<void> {
    let interp: String = await this._client.sendRequest("kind2/interpret", [uri, main, json]);
    WebPanel.createOrShow(this._context.extensionPath);
    WebPanel.currentPanel?.sendMessage({ uri: uri, main: main, json: interp });
  }

  public async raw(component: Component): Promise<void> {
    await tasks.executeTask(new Task({ type: "kind2" }, TaskScope.Workspace, component.name, "Kind 2", new ShellExecution(this.getKind2Path(), ["--old_frontend", "false", this.getSmtSolverOption(), this.getSmtSolverPath(), "--lus_main", component.name, component.uri.substr(7)])));
  }

  public async reveal(node: TreeNode, treeView: TreeView<TreeNode>): Promise<void> {
    await treeView.reveal(node);
  }

  public async counterExample(property: Property): Promise<void> {
    let ce: String = await this._client.sendRequest("kind2/counterExample", [property.parent.uri, property.parent.name, property.name]);
    WebPanel.createOrShow(this._context.extensionPath);
    WebPanel.currentPanel?.sendMessage({ uri: property.parent.uri, main: property.parent.name, json: ce });
  }
}
