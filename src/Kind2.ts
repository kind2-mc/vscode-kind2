import * as path from 'path';
import { CancellationToken, CodeLens, CodeLensProvider, Event, EventEmitter, ExtensionContext, ProviderResult, Range, TextDocument, TreeDataProvider, TreeItem, TreeItemCollapsibleState, TreeView, Uri, window } from "vscode";
import { LanguageClient } from 'vscode-languageclient';
import { ComponentNode, PropertyNode, statePath, TreeNode } from "./treeNode";
import { WebPanel } from './webviewPanel';

export class Kind2 implements TreeDataProvider<TreeNode>, CodeLensProvider {
  private _components: Map<string, TreeNode[]>;
  private readonly _treeDataChanged: EventEmitter<TreeNode | undefined | null>;
  private readonly _codeLensesChanged: EventEmitter<void>;

  constructor(private _context: ExtensionContext, private _client: LanguageClient) {
    this._components = new Map<string, TreeNode[]>();
    this._treeDataChanged = new EventEmitter<TreeNode | undefined | null>();
    this._codeLensesChanged = new EventEmitter<void>();
    this.onDidChangeTreeData = this._treeDataChanged.event;
    this.onDidChangeCodeLenses = this._codeLensesChanged.event;
  }

  onDidChangeCodeLenses?: Event<void> | undefined;

  provideCodeLenses(document: TextDocument, _token: CancellationToken): ProviderResult<CodeLens[]> {
    let codeLenses: CodeLens[] = [];
    let nodes = this._components.get(document.uri.toString());
    if (nodes) {
      let stack: TreeNode[] = [...nodes];
      while (stack.length > 0) {
        let curr = stack.pop()!;
        let range = new Range(curr.line, 0, curr.line, 0);
        if (curr instanceof ComponentNode) {
          codeLenses.push(new CodeLens(range, { title: "Check", command: "kind2/check", arguments: [curr] }));
          codeLenses.push(new CodeLens(range, { title: "Simulate", command: "kind2/interpret", arguments: [curr, "[]"] }));
          codeLenses.push(new CodeLens(range, { title: "Raw Output", command: "kind2/raw", arguments: [curr] }));
          codeLenses.push(new CodeLens(range, { title: "Show in Explorer", command: "kind2/reveal", arguments: [curr] }));
          stack = stack.concat(curr.children);
        }
        else {
          if (curr.state === 'failed') {
            codeLenses.push(new CodeLens(range, { title: "Show Counter Example", command: "kind2/counterExample", arguments: [curr] }));
          }
          codeLenses.push(new CodeLens(range, { title: "Show in Explorer", command: "kind2/reveal", arguments: [curr] }));
        }
      }
    }
    return codeLenses;
  }

  public readonly onDidChangeTreeData: Event<TreeNode | undefined | null>;

  public getTreeItem(element: TreeNode): TreeItem | Thenable<TreeItem> {
    let item: TreeItem;
    if (element instanceof ComponentNode) {
      item = new TreeItem(element.name, element.children.length === 0 ? TreeItemCollapsibleState.None : TreeItemCollapsibleState.Expanded);
      item.contextValue = "component";
    }
    else {
      item = new TreeItem(element.name, TreeItemCollapsibleState.None);
    }
    item.iconPath = Uri.file(path.join(this._context.extensionPath, statePath(element.state)));
    return item;
  }

  public getChildren(element?: TreeNode): ProviderResult<TreeNode[]> {
    if (element == undefined) {
      let components: TreeNode[] = [];
      let it = this._components.values();
      let res = it.next();
      while (!res.done) {
        components = components.concat(res.value);
        res = it.next();
      }
      return components;
    }
    if (element instanceof ComponentNode) {
      return element.children;
    }
  }

  public getParent(element: TreeNode): ProviderResult<TreeNode> {
    return element.parent;
  }

  public async updateComponents(uri: string): Promise<void> {
    this._client.traceOutputChannel.appendLine("Sending request 'kind2/getComponents'.");
    const components: any[] = await this._client.sendRequest("kind2/getComponents", uri).then(values => {
      return (values as string[]).map(value => JSON.parse(value));
    });
    this._components.set(uri, []);
    for (const component of components) {
      this._components.get(uri)!.push(new ComponentNode(component.name, "file://" + component.file, component.startLine - 1));
    }
    this._treeDataChanged.fire();
    this._codeLensesChanged.fire();
  }

  public async showSource(node: TreeNode): Promise<void> {
    let range = new Range(node.line, 0, node.line, 0);
    const editor = await window.showTextDocument(Uri.parse(node.uri, true), { selection: range });
    editor.revealRange(range);
  }

  public async check(node: TreeNode): Promise<void> {
    if (node instanceof ComponentNode) {
      node.children.splice(0);
      node.state = "running";
      this._treeDataChanged.fire();
      this._codeLensesChanged.fire();
      this._client.traceOutputChannel.appendLine("Sending notification 'kind2/check'.");
      let results: any[] = await this._client.sendRequest("kind2/check", [node.uri, node.name]).then(value => {
        return (value as string[]).map((s: string) => JSON.parse(s));
      });

      for (const result of results) {
        let property = new PropertyNode(result.name, "file://" + result.file, result.line - 1, node);
        property.state = result.answer.value === "valid" ? "passed" : "failed";
        node.children.push(property);
      }
      if (results.length == 0) {
        node.state = "passed"
      }
      this._treeDataChanged.fire();
      this._codeLensesChanged.fire();
    }
  }

  public async interpret(uri: string, main: string, json: string): Promise<void> {
    let interp: String = await this._client.sendRequest("kind2/interpret", [uri, main, json]);
    WebPanel.createOrShow(this._context.extensionPath);
    WebPanel.currentPanel?.sendMessage({ uri: uri, main: main, json: interp });
  }

  public async raw(node: TreeNode): Promise<void> {
    let kind2Terminal = window.terminals.find(terminal => terminal.name === "Kind 2");
    if (kind2Terminal === undefined) {
      kind2Terminal = window.createTerminal("Kind 2");
    }
    kind2Terminal.show();
    kind2Terminal.sendText("kind2 --lus_main " + node.name + " " + node.uri.substr(7));
  }

  public async reveal(node: TreeNode, treeView: TreeView<TreeNode>): Promise<void> {
    treeView.reveal(node);
  }

  public async counterExample(property: TreeNode): Promise<void> {
    let ce: String = await this._client.sendRequest("kind2/counterExample", [property.uri, property.name]);
    WebPanel.createOrShow(this._context.extensionPath);
    WebPanel.currentPanel?.sendMessage({ uri: property.uri, main: property.parent?.name, json: ce });
  }

  private findNode(uri: string, name: string): TreeNode | undefined {
    let stack: TreeNode[] = [...this._components.get(uri)!];

    while (stack.length > 0) {
      let curr = stack.pop();
      if (curr?.name === name) {
        return curr;
      }
      if (curr instanceof ComponentNode) {
        stack = stack.concat(curr.children);
      }
    }

    return undefined
  }
}
