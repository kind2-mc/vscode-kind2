/*
 * Copyright (c) 2021, Board of Trustees of the University of Iowa All rights reserved.
 *
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */

import { TextEditorDecorationType, ThemeColor, ThemeIcon, window } from "vscode";

export type TreeNode = File | Component | Property;

export interface File {
  readonly kind: "file";
  readonly parent: undefined;
}

export class File implements File {
  components: Component[];
  readonly line: number;
  constructor(readonly uri: string) {
    this.components = [];
    this.line = 1;
  }
}

export interface TreeNode2 {
  readonly name: string;
  readonly uri: string;
  readonly line: number;
  state: State;
  readonly parent: TreeNode | undefined;
}

export interface Component {
  readonly kind: "component";
}

export class Component implements Component {
  private _state: State;
  private _properties: Property[];
  set properties(properties: Property[]) { this._properties = properties; }
  get properties(): Property[] { return this._properties; }
  set state(state: State) {
    if (this._properties.length == 0) {
      this._state = state;
    }
    for (let child of this._properties) {
      child.state = state;
    }
  }
  get state(): State {
    if (this._properties.length == 0) {
      return this._state;
    }
    for (const child of this._properties) {
      if (child.state === "running") { return "running"; }
    }
    for (const child of this._properties) {
      if (child.state === "failed") { return "failed"; }
    }
    for (const child of this._properties) {
      if (child.state === "passed") { return "passed"; }
    }
    return "pending";
  }
  get uri(): string { return this.parent.uri; }
  constructor(readonly name: string, readonly line: number, readonly parent: File) {
    this._state = "pending";
    this._properties = [];
  }
}

export interface Property {
  readonly kind: "property";
}

export class Property implements Property {
  private _state: State;
  set state(state: State) { this._state = state; }
  get state(): State { return this._state; }
  constructor(readonly name: string, readonly line: number, readonly uri: string, readonly parent: Component) {
    this._state = "pending";
  }
}

export type State = "pending" | "running" | "passed" | "failed";

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

export function stateIcon(state: State) {
  switch (state) {
    case "pending":
      return new ThemeIcon("$(testing-unset-icon)", new ThemeColor("testing.iconUnset"));
    case "running":
      return new ThemeIcon("$(testing-queued-icon)", new ThemeColor("testing.iconQueued"));
    case "passed":
      return new ThemeIcon("$(testing-passed-icon)", new ThemeColor("testing.iconPassed"));
    case "failed":
      return new ThemeIcon("$(testing-failed-icon)", new ThemeColor("testing.iconFailed"));
  }
}
