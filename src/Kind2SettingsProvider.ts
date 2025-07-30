import { TreeDataProvider, EventEmitter, Event, ThemeIcon, ThemeColor, workspace, TreeItem, TreeItemCollapsibleState, ProviderResult, ExtensionContext, window } from "vscode";

type CommandType = "toggle" | "number" | "selectorMultiple" | "selectorSingle";
type SelectorButton = { name: string, var: string }
type SettingLiteral = { name: string, varPath: string, varName: string, commandType: CommandType, selectorOptions?: SelectorButton[] };
type SettingLiteralCategory = { name: string };
type SettingTreeNode = { category: SettingLiteralCategory, children: SettingTreeNode[] } | { setting: SettingLiteral };

//This tree defines what the setting menu's structure at runtime will look like.
//To add a new setting, only add to this tree and make the subsequent changes needed: adding a var to the package.json with the appropriate type. (No new command needed)
let settingTree: SettingTreeNode = {
  category: { name: "Settings" }, children: [
    {
      category: { name: "Blame Assignment" }, children: [
        {
          category: { name: "MCS Properties" }, children: [
            { setting: { name: "MCS all", varPath: "kind2", varName: "mcs_all", commandType: "toggle" } },
            {
              setting: {
                name: "MCS categories", varPath: "kind2", varName: "mcs_categories", commandType: "selectorMultiple", selectorOptions: [
                  { name: "Node calls", var: "node_calls" },
                  { name: "Contracts", var: "contracts" },
                  { name: "Equations", var: "equations" },
                  { name: "Assertions", var: "assertions" },
                  { name: "Annotations", var: "annotations" }
                ]
              }
            }
          ]
        }
      ]
    },
    {

      category: { name: "Merit Assignment" }, children: [
        { setting: { name: "Inductive Validity Core (IVC) Generation", varPath: "kind2", varName: "ivc", commandType: "toggle" } },
        {
          category: { name: "IVC Properties" }, children: [
            {
              setting: {
                name: "IVC Categories", varPath: "kind2", varName: "ivc_categories", commandType: "selectorMultiple", selectorOptions: [
                  { name: "Node calls", var: "node_calls" },
                  { name: "Contracts", var: "contracts" },
                  { name: "Equations", var: "equations" },
                  { name: "Assertions", var: "assertions" },
                  { name: "Annotations", var: "annotations" }
                ]
              }
            },
            { setting: { name: "IVC All", varPath: "kind2", varName: "ivc_all", commandType: "toggle" } },
            { setting: { name: "Unsat core timeout", varPath: "kind2", varName: "ivc_uc_to", commandType: "number" } },
            {
              setting: {
                name: "Minimize Program", varPath: "kind2", varName: "minimize_program", commandType: "selectorSingle", selectorOptions: [
                  { name: "No", var: "no" },
                  { name: "Valid Lustre", var: "valid_lustre" },
                  { name: "Concise", var: "concise" },

                ]
              }
            },
            { setting: { name: "IVC Must Set", varPath: "kind2", varName: "ivc_must", commandType: "toggle" } }
          ]
        }
      ]
    },
    {
      category: { name: "Contracts" }, children: [
        { setting: { name: "Compositional", varPath: "kind2.contracts", varName: "compositional", commandType: "toggle"} },
        { setting: { name: "Modular",       varPath: "kind2",           varName: "modular",       commandType: "toggle"} }
      ]
    }
  ]
};

export class Kind2SettingsProvider implements TreeDataProvider<SettingTreeElement> {
  private _onDidChangeTreeData: EventEmitter<SettingTreeElement | undefined> = new EventEmitter<SettingTreeElement | undefined>();
  readonly onDidChangeTreeData: Event<SettingTreeElement | undefined> = this._onDidChangeTreeData.event;
  readonly _context: any;
  private static _instance: Kind2SettingsProvider;
  public static settingElementMap: Map<string, SettingNode> = new Map<string, SettingNode>();
  private _root: SettingCategory;
  constructor(context: ExtensionContext) {
    this._context = context;
    if (Kind2SettingsProvider._instance) {
      throw new Error("Kind2SettingsProvider is a singleton and has already been instantiated.");
    }
    Kind2SettingsProvider._instance = this;
    this._onDidChangeTreeData.fire(undefined);

    workspace.onDidChangeConfiguration(e => {
      // Find which setting was changed and fire only for that settingNode
      for (const [key, settingNode] of Kind2SettingsProvider.settingElementMap.entries()) {
        if (e.affectsConfiguration(key)) {
          this._onDidChangeTreeData.fire(settingNode);
          break;
        }
      }
    });
    this._root = SettingCategory.root;
  }

  // Could be moved directly to SettingNode, will keep it here in case we want to add an overarching funtionality to changing a setting
  static updateSetting(settingNode: SettingNode | SelectorNode) {
    settingNode.execute(undefined);
  }

  getTreeItem(element: SettingTreeElement): TreeItem {
    let item: TreeItem;
    if (element instanceof SettingCategory) {
      item = new TreeItem(element.name, TreeItemCollapsibleState.Collapsed);
      item.iconPath = element.icon;
    } else if (element instanceof SettingNode) {
      const isSelector: boolean = element.commandType === "selectorMultiple" || element.commandType === "selectorSingle";
      item = new TreeItem(element.getName(), isSelector ? TreeItemCollapsibleState.Collapsed : TreeItemCollapsibleState.None);
      item.iconPath = element.icon === undefined ? undefined :
        (element.icon instanceof ThemeIcon ? element.icon : this._context.asAbsolutePath(element.icon))
      if (!isSelector) {
        item.command = {
          command: "kind2/modifySetting",
          title: element.name,
          arguments: [element]
        };
      }


    }
    else if (element instanceof SelectorNode) {
      item = new TreeItem(element.name, TreeItemCollapsibleState.None);
      item.iconPath = element.icon === undefined ? undefined :
        (element.icon instanceof ThemeIcon ? element.icon : this._context.asAbsolutePath(element.icon));
      item.command = {
        command: "kind2/modifySetting",
        title: element.name,
        arguments: [element]
      };
    }
    return item;
  }

  getChildren(element?: SettingTreeElement): ProviderResult<SettingTreeElement[]> {
    if (element == undefined) {
      return this._root.children;
    }
    return element.children;

  }

  getParent(element: SettingTreeElement): ProviderResult<SettingTreeElement | undefined> {
    return element.parent;
  }



}




export interface SettingTreeElement {
  children: SettingTreeElement[];
  readonly name: string
  parent: SettingCategory | SettingNode | undefined;
  icon: string | ThemeIcon | undefined;
}

export class SelectorNode implements SettingTreeElement {

  children: SettingTreeElement[] = [];
  readonly name: string;
  readonly varName: string;
  parent: SettingNode | undefined;

  constructor(name: string, varName: string, parent: SettingNode) {
    this.name = name;
    this.varName = varName;
    this.parent = parent;
  }


  public get icon(): string | ThemeIcon {
    if (this.parent.commandType === "selectorMultiple" && this.parent.getWorkspaceSettingValue<string[]>().includes(this.varName) ||
      this.parent.commandType === "selectorSingle" && this.parent.getWorkspaceSettingValue<string>() === this.varName) {
      return new ThemeIcon("pass-filled", new ThemeColor("settings.toggle"));
    } else {
      return new ThemeIcon("circle-large-outline", new ThemeColor("settings.toggle"));
    }
  }

  public execute(arg: string | number | boolean) {
    this.parent.execute(this.varName);
  }
}
export class SettingNode implements SettingTreeElement {
  readonly name: string;
  readonly varName: string;
  readonly commandType: CommandType;
  readonly varPath: string;
  children: SettingTreeElement[] = [];
  parent: SettingCategory | undefined;

  constructor(name: string, commandRoot: string, commandType: CommandType, parent: SettingCategory, varPath: string) {
    this.name = name;
    this.varName = commandRoot;
    this.varPath = varPath
    this.commandType = commandType;
    this.parent = parent;
  }
  public getName(): string {
    if (this.commandType === "number") {
      const value = this.getWorkspaceSettingValue<number>();
      return this.name + ": " + (value);
    }
    return this.name;
  }
  public registerSelectorOptions(selectorOptions: SelectorButton[]) {
    if (this.commandType !== "selectorMultiple" && this.commandType !== "selectorSingle") {
      throw new Error("Cannot register selector options for a non-selector setting");
    }
    for (const option of selectorOptions) {
      this.children.push(new SelectorNode(option.name, option.var, this));
    }
  }
  public getWorkspaceSettingValue<T extends string | number | boolean | string[]>(): T | undefined {
    let val = workspace.getConfiguration(this.varPath).get(this.varName);
    return workspace.getConfiguration(this.varPath).get<T>(this.varName);
  }
  public getVarPath(): string {
    return this.varPath + "." + this.varName;
  }

  // This should probably be mapped instead of programatically determined
  public get icon(): string | ThemeIcon {
    if (this.commandType === "toggle") {
      let value: boolean = this.getWorkspaceSettingValue<boolean>();
      if (value === true) {
        switch (this.name) {
          case "Compositional":
            return "icons/disable-compositional-dark.svg";
          case "Modular":
            return "icons/disable-modular-dark.svg";
          default:
            return new ThemeIcon("pass-filled", new ThemeColor("settings.toggle"));

        }
      } else if (value === false) {
        switch (this.name) {

          case "Compositional":
            return "icons/enable-compositional-dark.svg";
          case "Modular":
            return "icons/enable-modular-dark.svg";
          default:
            return new ThemeIcon("circle-large-outline", new ThemeColor("settings.toggle"));
        }
      } else {
        // If the setting is undefined, return a question icon (for a missing setting)
        return new ThemeIcon("question", new ThemeColor("settings.toggle"));
      }
    } else {
      return undefined;
    }
  }
  async inputArg(): Promise<string | number | boolean> {
    switch (this.commandType) {
      case "toggle":
        return undefined; // No input needed for toggle
      case "number":
        // Show an input box to get a number from the user
        const input = await window.showInputBox({
          prompt: `Enter a value for ${this.name}`,
          placeHolder: "Enter a number",
          validateInput: (value: string) =>
            isNaN(Number(value)) || Number(value) < 0 ? "Please enter a valid number" : undefined,
        });
        return input !== undefined ? Number(input) : undefined;
      default:
        throw new Error(`Unknown command type: ${this.commandType}`);
    }
  }



  execute(arg: string | number | boolean) {
    switch (this.commandType) {
      case "toggle":
        const currentValue = this.getWorkspaceSettingValue<boolean>();
        workspace.getConfiguration(this.varPath).update(this.varName, !currentValue);
        return;
      case "selectorMultiple":

        const varName = arg as string;
        let currentValues = this.getWorkspaceSettingValue<string[]>();
        if (currentValues.includes(varName)) {
          currentValues = currentValues.filter(value => value !== varName);
        }
        else {
          currentValues.push(varName);
        }
        workspace.getConfiguration(this.varPath).update(this.varName, currentValues);
        return;
      case "selectorSingle":
        workspace.getConfiguration(this.varPath).update(this.varName, arg as string);
        return;
      case "number":
        this.inputArg().then((input) => {
          if (input !== undefined) {
            workspace.getConfiguration(this.varPath).update(this.varName, input);
          }
        });
        return;
      default:
        throw new Error(`Unknown command type: ${this.commandType}`);
    }

  }

}

export class SettingCategory implements SettingTreeElement {

  private static _root: SettingCategory;
  children: SettingTreeElement[];
  private _parent: SettingCategory | undefined;
  private constructor(readonly name: string, parent: SettingCategory | undefined) {
    this.children = [];
    this._parent = parent;
    if (parent) {
      this.parent.children.push(this);
    }
  }
  public get icon(): ThemeIcon {
    return undefined;
  }
  private set parent(parent: SettingCategory | undefined) { this._parent = parent; }
  get parent(): SettingCategory | undefined { return this._parent; }


  static get root(): SettingCategory {
    if (!SettingCategory._root) {
      // Initialize the root with the setting tree
      const initializeTree = (node: SettingTreeNode, parent: SettingCategory) => {
        if ("category" in node) {
          const category = new SettingCategory(node.category.name, parent);
          category.parent = parent;
          for (const child of node.children) {
            initializeTree(child, category);
          }
          return category;
        } else if ("setting" in node) {
          let setting: SettingNode = new SettingNode(node.setting.name, node.setting.varName, node.setting.commandType, parent, node.setting.varPath);
          if (node.setting.selectorOptions) {
            setting.registerSelectorOptions(node.setting.selectorOptions);
          }
          Kind2SettingsProvider.settingElementMap.set(setting.getVarPath(), setting);
          parent.children.push(setting);
          return null;
        }
      };
      SettingCategory._root = initializeTree(settingTree, SettingCategory._root);
      return SettingCategory._root;
    }
    else {
      return SettingCategory._root;
    }
  }
}
