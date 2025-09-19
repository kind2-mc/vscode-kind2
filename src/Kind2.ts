/*
 * Copyright (c) 2021, Board of Trustees of the University of Iowa All rights reserved.
 *
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */

import * as path from "path";
import { CancellationToken, CancellationTokenSource, CodeLens, CodeLensProvider, DecorationOptions, Event, EventEmitter, ExtensionContext, Position, ProviderResult, Range, ShellExecution, Task, tasks, TaskScope, TextDocument, TextEditorDecorationType, TreeDataProvider, TreeItem, TreeItemCollapsibleState, TreeView, Uri, window, MarkdownString } from "vscode";
import { LanguageClient } from "vscode-languageclient";
import { Analysis, Component, File, Property, State, statePath, TreeNode, stateColor, Container } from "./treeNode";
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
      [ "pending",                window.createTextEditorDecorationType({ gutterIconPath: this._context.asAbsolutePath(statePath("pending")),                backgroundColor: stateColor("pending") }) ],
      [ "running",                window.createTextEditorDecorationType({ gutterIconPath: this._context.asAbsolutePath(statePath("running")),                backgroundColor: stateColor("running") }) ],
      [ "passed",                 window.createTextEditorDecorationType({ gutterIconPath: this._context.asAbsolutePath(statePath("passed")),                 backgroundColor: stateColor("passed") }) ],
      [ "reachable",              window.createTextEditorDecorationType({ gutterIconPath: this._context.asAbsolutePath(statePath("reachable")),              backgroundColor: stateColor("reachable") }) ],
      [ "conflicting",            window.createTextEditorDecorationType({ gutterIconPath: this._context.asAbsolutePath(statePath("conflicting")),            backgroundColor: stateColor("conflicting") }) ],
      [ "failed",                 window.createTextEditorDecorationType({ gutterIconPath: this._context.asAbsolutePath(statePath("failed")),                 backgroundColor: stateColor("failed") }) ],
      [ "unreachable",            window.createTextEditorDecorationType({ gutterIconPath: this._context.asAbsolutePath(statePath("unreachable")),            backgroundColor: stateColor("unreachable") }) ],
      [ "stopped",                window.createTextEditorDecorationType({ gutterIconPath: this._context.asAbsolutePath(statePath("stopped")),                backgroundColor: stateColor("stopped") }) ],
      [ "unknown",                window.createTextEditorDecorationType({ gutterIconPath: this._context.asAbsolutePath(statePath("unknown")),                backgroundColor: stateColor("unknown") }) ],
      [ "errored",                window.createTextEditorDecorationType({ gutterIconPath: this._context.asAbsolutePath(statePath("errored")),                backgroundColor: stateColor("errored") }) ],
      [ "realizable",             window.createTextEditorDecorationType({ gutterIconPath: this._context.asAbsolutePath(statePath("realizable")),             backgroundColor: stateColor("realizable") }) ],
      [ "unrealizable",           window.createTextEditorDecorationType({ gutterIconPath: this._context.asAbsolutePath(statePath("unrealizable")),           backgroundColor: stateColor("unrealizable") }) ],
      [ "contract realizable",    window.createTextEditorDecorationType({ gutterIconPath: this._context.asAbsolutePath(statePath("contract realizable")),    backgroundColor: stateColor("contract realizable") }) ],
      [ "contract unrealizable",  window.createTextEditorDecorationType({ gutterIconPath: this._context.asAbsolutePath(statePath("contract unrealizable")),  backgroundColor: stateColor("contract unrealizable") }) ],
      [ "type realizable",        window.createTextEditorDecorationType({ gutterIconPath: this._context.asAbsolutePath(statePath("type realizable")),        backgroundColor: stateColor("type realizable") }) ],
      [ "type unrealizable",      window.createTextEditorDecorationType({ gutterIconPath: this._context.asAbsolutePath(statePath("type unrealizable")),      backgroundColor: stateColor("type unrealizable") }) ],
      [ "inputs realizable",      window.createTextEditorDecorationType({ gutterIconPath: this._context.asAbsolutePath(statePath("inputs realizable")),      backgroundColor: stateColor("inputs realizable") }) ],
      [ "inputs unrealizable",    window.createTextEditorDecorationType({ gutterIconPath: this._context.asAbsolutePath(statePath("inputs unrealizable")),    backgroundColor: stateColor("inputs unrealizable") }) ],
      [ "ivc",               window.createTextEditorDecorationType({                                                                                    backgroundColor: stateColor("ivc") }) ],
      [ "mcs property",           window.createTextEditorDecorationType({                                                                                    backgroundColor: stateColor("mcs property") }) ],
      [ "mcs cut",                window.createTextEditorDecorationType({                                                                                    backgroundColor: stateColor("mcs cut") }) ],
    ]);
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
          codeLenses.push(new CodeLens(range, { title: "Simulate", command: "kind2/interpret", arguments: [component, "[]"] }));
          codeLenses.push(new CodeLens(range, { title: "Raw Output", command: "kind2/raw", arguments: [component] }));
          codeLenses.push(new CodeLens(range, { title: "Show in Explorer", command: "kind2/reveal", arguments: [component] }));
        } else if (component.imported) {
          codeLenses.push(new CodeLens(range, { title: "Check Realizability", command: "kind2/realizability", arguments: [component] }));
          codeLenses.push(new CodeLens(range, { title: "Simulate", command: "kind2/interpret", arguments: [component, "[]"] }));
          codeLenses.push(new CodeLens(range, { title: "Show in Explorer", command: "kind2/reveal", arguments: [component] }));
        } else if (component.typeDecl) {
          codeLenses. push(new CodeLens(range, { title: "Check Realizability", command: "kind2/realizability", arguments: [component] }));
          codeLenses.push(new CodeLens(range, { title: "Show in Explorer", command: "kind2/reveal", arguments: [component] }));
        } else {
          codeLenses.push(new CodeLens(range, { title: "Check Properties", command: "kind2/check", arguments: [component] }));
          codeLenses.push(new CodeLens(range, { title: "Check Minimal Cut Set", command: "kind2/minimalCutSet", arguments: [component] }));
          codeLenses.push(new CodeLens(range, { title: "Check Realizability", command: "kind2/realizability", arguments: [component] }));
          codeLenses.push(new CodeLens(range, { title: "Simulate", command: "kind2/interpret", arguments: [component, "[]"] }));
          codeLenses.push(new CodeLens(range, { title: "Raw Output", command: "kind2/raw", arguments: [component] }));
          codeLenses.push(new CodeLens(range, { title: "Show in Explorer", command: "kind2/reveal", arguments: [component] }));
        }
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
      if (element.containsUnrealizable()) { // At least one unrealizable result causes component's icon to be an X
        item.iconPath = Uri.file(path.join(this._context.extensionPath, statePath("unrealizable")));
      }
      else {
        item.iconPath = Uri.file(path.join(this._context.extensionPath, statePath(element.state[0])));
      }
    }
    else if (element instanceof Analysis) {
      if (element.realizability === undefined) {
        let label = "Abstract: " + (element.abstract.length == 0 ? "none" : "[" + element.abstract.toString() + "]");
        label += " - Concrete: " + (element.concrete.length == 0 ? "none" : "[" + element.concrete.toString() + "]");
        let hasContents: boolean = element.properties.length !== 0 || element.hasIVC() || element.hasMCS();
        item = new TreeItem(label,  hasContents ? TreeItemCollapsibleState.Expanded : TreeItemCollapsibleState.None);
        item.contextValue = "analysis";
      } 
      else if( element.realizabilitySource === "contract") {
          if (element.realizability === "realizable") {
            item = new TreeItem(element.realizabilitySource, TreeItemCollapsibleState.None);
            item.iconPath = Uri.file(path.join(this._context.extensionPath, statePath("passed")));
          }
          else if (element.realizability === "unrealizable") {
            item = new TreeItem(element.realizabilitySource + ": conflicting set", TreeItemCollapsibleState.Collapsed);
            item.iconPath = Uri.file(path.join(this._context.extensionPath, statePath("failed")));
          }
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
    else if(element instanceof Property) {
      item = new TreeItem(element.name, TreeItemCollapsibleState.None);
      if (element.state == "failed" || element.state == "reachable") {
        item.contextValue = "hasTrace";
      }
      item.iconPath = Uri.file(path.join(this._context.extensionPath, statePath(element.state)));
    } else if(element instanceof Container){
      item = new TreeItem(element.name, TreeItemCollapsibleState.Collapsed);
      if (element.tag === "ivc_button"){
        item.command = {
          title: "Activate IVC " + element.value,
          command: "kind2/activateIVC",
          arguments: [element]
        }
        item.collapsibleState = TreeItemCollapsibleState.None;
        item.iconPath = element.icon;
      } else if (element.tag === "mcs_button"){
        item.command = {
          title: "Activate MCS " + element.value,
          command: "kind2/activateMCS",
          arguments: [element]
        }
        item.collapsibleState = TreeItemCollapsibleState.None;
        item.iconPath = element.icon;
      }
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
      let children: TreeNode[] = [new Container(element, element.properties, "Properties", "properties")];
      if(element.hasIVC()){
        let ivcContainer = new Container(element, [], "Merit Assignment", "ivc_container")
        let ivcChildren = element.ivcs.map((value, index) => new Container(ivcContainer, [], "IVC " + (index + 1), "ivc_button", index,  element.parent.line, element.parent.uri));
        if(element.must != undefined) ivcChildren.unshift(new Container(ivcContainer, [], "Must Set", "ivc_button", -1));
        ivcContainer.children = ivcChildren;
        children.push(ivcContainer);
      } 
      if(element.hasMCS()){
        let mcsContainer = new Container(element, [], "Blame Assignment", "mcs_container")
        let mcsChildren = element.mcss.map((value, index) => new Container(mcsContainer, [], "MCS " + (index + 1), "mcs_button", index,  element.parent.line, element.parent.uri));
        mcsContainer.children = mcsChildren;
        children.push(mcsContainer);
      }
      return children;
      
}
    if (element instanceof Container){
      return element.children;
    }
  
  }

  public getParent(element: TreeNode): ProviderResult<TreeNode> {
    return element.parent;
  }

  public updateDecorations(): void {
    let decorations = new Map<string, Map<State, DecorationOptions[]>>();
    for (const file of this._files) {
      decorations.set(file.uri, new Map<State, DecorationOptions[]>([["pending", []], ["running", []], ["passed", []], ["reachable", []],  ["failed", []], 
                                                                     ["unreachable", []], ["stopped", []], ["unknown", []], ["errored", []], ["realizable", []], 
                                                                     ["inputs realizable", []], ["contract realizable", []], ["type realizable", []], 
                                                                     ["unrealizable", []], ["inputs unrealizable", []], ["contract unrealizable", []], 
                                                                     ["type unrealizable", []], ["conflicting", []], ["ivc", []], ["mcs cut", []], ["mcs property", []]]));
    }
    for (const file of this._files) {
      for (const component of file.components) {
        for (const state of component.state) {
          if (state.startsWith("contract")) {
            decorations.get(component.uri)?.get(state)?.push({ range: new Range(new Position(component.contractLine, 0), (new Position(component.contractLine, 999))), hoverMessage: `${state}`  });
          }
          else if (state.startsWith("inputs")) {
            if (component.containsUnrealizable() && component.line === component.contractLine) { 
              decorations.get(component.uri)?.get("unrealizable")?.push({ range: new Range(new Position(component.line, 0), (new Position(component.line, 999))), hoverMessage: `${state}` });
            } else {
              decorations.get(component.uri)?.get(state)?.push({ range: new Range(new Position(component.line, 0), (new Position(component.line, 999))), hoverMessage: `${state}` });
            }
          }
          else {
            decorations.get(component.uri)?.get(state)?.push({ range: new Range(new Position(component.line, 0), (new Position(component.line, 999))), hoverMessage: `${state}` });
          }
        }
        let conflictingSet: Map<String, DecorationOptions> = new Map<string, DecorationOptions>();
        
        for (const property of component.properties) {
          if (decorations.has(property.uri) && (property.line != component.line) && (property.line != component.contractLine)) {
            let decorationOptions: DecorationOptions = { range: new Range(new Position(property.line, 0), (new Position(property.line, 100))), hoverMessage: `${property.state}` };
            if( property.state === "conflicting") {
              conflictingSet.set(property.name, decorationOptions);
            }
            decorations.get(property.uri)?.get(property.state)?.push(decorationOptions);
          }
        }
        for(const ivcProperty of component.ivcProperties) {
          if (decorations.has(ivcProperty.uri) && (ivcProperty.line != component.line) && (ivcProperty.line != component.contractLine)) {
            let decorationOptions: DecorationOptions = { range: new Range(new Position(ivcProperty.line, ivcProperty.startCol), (new Position(ivcProperty.line, 100))), hoverMessage: `${ivcProperty.state}` };
            decorations.get(ivcProperty.uri)?.get(ivcProperty.state)?.push(decorationOptions);          }
        }
        for(const mcsProperty of component.mcsProperties) {
          if (decorations.has(mcsProperty.uri) && (mcsProperty.line != component.line) && (mcsProperty.line != component.contractLine)) {
            let msg: string = mcsProperty.state === "mcs property" ? "Cut property: " + mcsProperty.name : mcsProperty.name;
            let decorationOptions: DecorationOptions = { range: new Range(new Position(mcsProperty.line, mcsProperty.startCol), (new Position(mcsProperty.line, 100))), hoverMessage: `${msg}` };
            decorations.get(mcsProperty.uri)?.get(mcsProperty.state)?.push(decorationOptions);          }
        }
        const keys = Array.from(conflictingSet.keys()).map(k => `*${k}*`);
        for(const [propertyName,propertyDecorationOptions] of conflictingSet.entries()) {
          let hover = `Conflicting set:\n[${keys.join(",&nbsp;&nbsp;")}]`;
          propertyDecorationOptions.hoverMessage = new MarkdownString(hover);
        }
      }
    }
    for (const uri of decorations.keys()) {
      let editor = window.visibleTextEditors.find(editor => editor.document.uri.toString() === uri);
      for (const state of <State[]>["pending", "running", "passed", "reachable", "failed", "unreachable", "stopped", "unknown", "errored", "realizable", "unrealizable", "inputs realizable", "contract realizable", 
                                    "inputs unrealizable", "contract unrealizable", "type realizable", "type unrealizable", "conflicting","ivc", 
                                  "mcs cut", "mcs property"]) {
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
        var hasRefType = false;
        if (component.containsRefinementType !== undefined) {
          hasRefType = component.containsRefinementType === "true";
        }
        file.components.push(new Component(component.name, component.startLine - 1, contractStart, file, component.imported, component.kind, hasRefType));
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

  public async showSource(node: TreeNode | Container): Promise<void> {
    if (node instanceof Analysis) {
      return;
    }
    let range = new Range(node.line, 0, node.line, 0);
    await window.showTextDocument(Uri.parse(node.uri, true), { selection: range });
  }

  public async minimalCutSet(mainComponent: Component): Promise<void> {
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
    await this._client.sendRequest("kind2/minimalCutSet", [mainComponent.uri, mainComponent.name], tokenSource.token).then((values: string[]) => {
      let results: any[] = values.map(s => JSON.parse(s));
      let result: any = results[0];
        let component = mainComponent;
        component.analyses = [];
        
          let analysis: Analysis = new Analysis(["abstract"], ["concrete"], component);
          //now handle IVC if present
          if (result.mcsAnalysis) {
            for(let mcs of result.mcsAnalysis){
              let mcsProperties: Property[]  = [];
              //TODO need kind2 output for the line number of the property that is invalidated by the cut
              let cutProperty = new Property(mcs.property, component.line + 1, component.uri, analysis, 0);
              cutProperty.state = "mcs property";
              mcsProperties.push(cutProperty);
              for (const mcsNode of mcs.nodes) {
                for(const mcsElement of mcsNode.elements) {
                  let mcsProperty = new Property(mcsElement.name, mcsElement.line - 1, component.uri, analysis, mcsElement.column - 1);
                  mcsProperty.state = "mcs cut";
                  mcsProperties.push(mcsProperty);
                }
              }
              analysis.addMCS(mcsProperties);
            }
          } else {
            console.log("Error: MCS analysis not found in response");
          }
          
          component.analyses.push(analysis);
        
        if (component.analyses.length == 0) {
          component.state = ["passed"];
        }
        modifiedComponents.push(component);
      
      if (results.length == 0) {
        mainComponent.state = ["unknown"];
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
            // Filter out candidate properties
            if (propertyResult.isCandidate === "true") {
              continue
            }
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
            analysis.realizability = undefined;
            analysis.properties.push(property);
          }
          //now handle IVC if present
          if (analysisResult.ivcAnalysis) {
            for(let ivc of analysisResult.ivcAnalysis){
              let ivcProperties: Property[]  = [];
              for (const ivcNode of ivc.nodes) {
                for(const ivcElement of ivcNode.elements) {
                  let ivcProperty = new Property(ivcElement.name, ivcElement.line - 1, component.uri, analysis, ivcElement.column - 1);
                  ivcProperty.state = "ivc";
                  ivcProperties.push(ivcProperty);
                }
              }
              analysis.addIVC(ivcProperties)
            }
          }
          
          component.analyses.push(analysis);

          if (analysisResult.ivcMust) {
              let ivcMust = analysisResult.ivcMust;
              let mustProperties: Property[]  = [];
              for (const ivcNode of ivcMust.nodes) {
                for(const ivcElement of ivcNode.elements) {
                  let ivcProperty = new Property(ivcElement.name, ivcElement.line - 1, component.uri, analysis, ivcElement.column - 1);
                  ivcProperty.state = "ivc";
                  mustProperties.push(ivcProperty);
                }
              }
              analysis.must = mustProperties;
          }
        }
        
        if (component.analyses.length == 0) {
          component.state = "passed";
        }
        modifiedComponents.push(component);
      }
      if (results.length == 0) {
        mainComponent.state = ["unknown"];
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
    await this._client.sendRequest("kind2/realizability", [mainComponent.uri, mainComponent.name, mainComponent.typeDecl], tokenSource.token).then((values: string[]) => {
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
            //begin finding conflicting set
            let conflictingSet: Property[] = [];
            analysisResult.conflictingSet[0]?.elements?.forEach(element => {
              let property = new Property(element.name, element.line - 1, component.uri, analysis)
              conflictingSet.push(property);
            });
        
            conflictingSet.forEach(property => property.state = "conflicting");
            analysis.properties.push(...conflictingSet);
            if (conflictingSet.length == 0) {
              analysis.realizability = "realizable";
            } else {
              analysis.realizability = "unrealizable";
            }
          }
          else if (analysisResult.context === "environment") {
            analysis.realizabilitySource = "inputs"
          }
          else if (analysisResult.context === "type") {
            analysis.realizabilitySource = "type"
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
    else if (analysis.realizabilitySource === "type") {
      context = "type"
    }
    await this._client.sendRequest("kind2/deadlock", [analysis.parent.uri, name, context]).then((dl: string) => {
      WebPanel.createOrShow(this._context.extensionPath);
      WebPanel.currentPanel?.sendMessage({ uri: analysis.parent.uri, main: analysis.parent.name, json: dl });
    }).catch(reason => {
      window.showErrorMessage(reason.message);
    });
  }
}
