export interface TreeNode {
  readonly name: string;
  readonly uri: string;
  readonly line: number;
  state: State;
  readonly parent: TreeNode | undefined;
}

export class ComponentNode implements TreeNode {
  private _state: State;
  private _children: TreeNode[];
  get name(): string { return this._name; }
  get uri(): string { return this._uri; }
  get line(): number { return this._line; }
  get parent(): TreeNode | undefined { return this._parent; }
  get children(): TreeNode[] { return this._children; }
  set state(state: State) {
    if (this._children.length == 0) {
      this._state = state;
    }
    for (let child of this._children) {
      child.state = state;
    }
  }
  get state(): State {
    if (this._children.length == 0) {
      return this._state;
    }
    for (const child of this._children) {
      if (child.state === "running") { return "running"; }
    }
    for (const child of this._children) {
      if (child.state === "failed") { return "failed"; }
    }
    for (const child of this._children) {
      if (child.state === "passed") { return "passed"; }
    }
    return "pending";
  }
  constructor(private _name: string, private _uri: string, private _line: number, private _parent: TreeNode | undefined = undefined) {
    this._state = "pending";
    this._children = [];
  }
}

export class PropertyNode implements TreeNode {
  private _state: State;
  get name(): string { return this._name; }
  get uri(): string { return this._uri; }
  get line(): number { return this._line; }
  set state(state: State) { this._state = state; }
  get state(): State { return this._state; }
  get parent(): TreeNode { return this._parent; }
  constructor(private _name: string, private _uri: string, private _line: number, private _parent: TreeNode) {
    this._state = "pending";
  }
}

type State = "pending" | "running" | "passed" | "failed"

export function statePath(state: State) {
  switch (state) {
    case "pending":
      return "icons/pending.svg";
    case "running":
      return "icons/running.svg";
    case "passed":
      return "icons/passed.svg";
    case "failed":
      return "icons/failed.svg";
  }
}
