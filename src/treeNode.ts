/*
 * Copyright (c) 2021, Board of Trustees of the University of Iowa All rights reserved.
 *
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */

import { ThemeColor, ThemeIcon } from "vscode";

export type TreeNode = File | Component | Analysis | Property;

export class File implements File {
  components: Component[];
  readonly parent: undefined;
  readonly line: number;

  constructor(readonly uri: string, public name: string) {
    this.components = [];
    this.line = 1;
    this.parent = undefined;
  }
}

export type RealizabilityResult = "realizable" | "unrealizable"
export type RealizabilitySource = "inputs" | "contract" | "imported node"

export class Component {
  private _state: State[];
  private _analyses: Analysis[];
  private _imported: boolean;
  set analyses(analyses: Analysis[]) { this._analyses = analyses; }
  get analyses(): Analysis[] { return this._analyses; }
  set imported(imported: boolean) { this._imported = imported; }
  get imported(): boolean { return this._imported; }
  set state(state: State[]) {
    if (this._analyses.length == 0) {
      this._state = state;
    }
  }
  get properties(): Property[] {
    let passedProperties = new Map<string, Property>();
    let reachableProperties = new Map<string, Property>();
    let failedProperties = new Map<string, Property>();
    let unreachableProperties = new Map<string, Property>();
    let unknownProperties = new Map<string, Property>();
    let erroredProperties = new Map<string, Property>();
    for (const analysis of this._analyses) {
      for (const property of analysis.properties) {
        if (property.state === "passed") { passedProperties.set(property.name, property); }
        if (property.state === "reachable") { reachableProperties.set(property.name, property); }
        if (property.state === "failed") { failedProperties.set(property.name, property); }
        if (property.state === "unreachable") { unreachableProperties.set(property.name, property); }
        if (property.state === "unknown") { failedProperties.set(property.name, property); }
        if (property.state === "errored") { erroredProperties.set(property.name, property); }
      }
    }
    let properties: Property[] = [];
    for (const entry of passedProperties) {
      failedProperties.delete(entry[0]);
      unknownProperties.delete(entry[0]);
      reachableProperties.delete(entry[0]);
      unreachableProperties.delete(entry[0]);
      properties.push(entry[1]);
    }
    for (const entry of failedProperties) {
      properties.push(entry[1]);
    }
    for (const entry of unknownProperties) {
      properties.push(entry[1]);
    }
    for (const entry of erroredProperties) {
      properties.push(entry[1]);
    }
    return properties;
  }
  get state(): State[] {
    if (this._analyses.length == 0) {
      return this._state;
    }
    let passedProperties = new Set<string>();
    let failedProperties = new Set<string>();
    let unknownProperties = new Set<string>();
    let erroredProperties = new Set<string>();
    var ret = [];
    for (const analysis of this._analyses) {
      for (const property of analysis.properties) {
        if (property.state === "passed" || property.state === "reachable") { passedProperties.add(property.name); }
        if (property.state === "failed" || property.state === "unreachable") { failedProperties.add(property.name); }
        if (property.state === "unknown") { unknownProperties.add(property.name); }
        if (property.state === "errored") { erroredProperties.add(property.name); }
      }
      if (analysis.realizability === "realizable" && analysis.realizabilitySource === "contract") { 
        ret.push("contract realizable"); 
      }
      if (analysis.realizability === "realizable" && analysis.realizabilitySource === "inputs") { 
        ret.push("inputs realizable"); 
      }
      if (analysis.realizability === "unrealizable" && analysis.realizabilitySource === "contract") { 
        ret.push("contract unrealizable"); 
      }
      if (analysis.realizability === "unrealizable" && analysis.realizabilitySource === "inputs") { 
        ret.push("inputs unrealizable"); 
      }
    }
    if (ret.length !== 0) {
      return ret
    }
    for (const name of passedProperties) {
      failedProperties.delete(name);
      unknownProperties.delete(name);
    }
    if (erroredProperties.size !== 0) {
      return ["errored"];
    }
    if (failedProperties.size !== 0) {
      return ["failed"];
    }
    if (passedProperties.size !== 0) {
      return ["passed"]
    }
    return ["unknown"];
  }
  containsUnrealizable() {
    return this.state.some(str => str.includes("unrealizable"))
  }
  get uri(): string { return this.parent.uri; }
  constructor(readonly name: string, readonly line: number, readonly contractLine: number, readonly parent: File, readonly imported_comp: string) {
    this._state = ["pending"];
    this._analyses = [];
    this._imported = imported_comp === "true";
  }
}

export class Analysis {
  private _properties: Property[];
  private _realizability: RealizabilityResult;
  private _realizabilitySource: RealizabilitySource;
  set properties(properties: Property[]) { this._properties = properties; }
  get properties(): Property[] { return this._properties; }
  set realizability(realizability: RealizabilityResult) { this._realizability = realizability }
  get realizability(): RealizabilityResult { return this._realizability; }
  set realizabilitySource(realizabilitySource: RealizabilitySource) { this._realizabilitySource = realizabilitySource }
  get realizabilitySource(): RealizabilitySource { return this._realizabilitySource; }
  
  constructor(readonly abstract: String[], readonly concrete: String[], readonly parent: Component) {
    this._properties = [];
  }
}

export class Property {
  private _state: State;
  set state(state: State) { this._state = state; }
  get state(): State { return this._state; }
  constructor(readonly name: string, readonly line: number, readonly uri: string, readonly parent: Analysis) {
    this._state = "pending";
  }
}

export type State = 
  "pending" | "running" | "passed" | "reachable" | "failed" | "unreachable" 
| "unknown" | "stopped" | "errored" | "realizable" | "unrealizable" | "inputs realizable"
| "inputs unrealizable" | "contract realizable" | "contract unrealizable";

export function statePath(state: State) {
  switch (state) {
    case "pending":
      return "icons/pending.svg";
    case "running":
      return "icons/running.svg";
    case "passed":
    case "reachable":
    case "contract realizable":
    case "inputs realizable": 
    case "realizable":
      return "icons/passed.svg";
    case "failed":
    case "unreachable":
    case "unrealizable":
    case "inputs unrealizable":
    case "contract unrealizable":
      return "icons/failed.svg";
    case "unknown":
      return "icons/unknown.svg";
    case "stopped":
      return "icons/stopped.svg";
    case "errored":
      return "icons/errored.svg";
  }
}

export function stateIcon(state: State) {
  switch (state) {
    case "pending":
      return new ThemeIcon("$(testing-unset-icon)", new ThemeColor("testing.iconUnset"));
    case "running":
      return new ThemeIcon("$(history)", new ThemeColor("testing.iconQueued"));
    case "passed":
    case "reachable":
    case "contract realizable":
    case "inputs realizable": 
    case "realizable":
      return new ThemeIcon("$(testing-passed-icon)", new ThemeColor("testing.iconPassed"));
    case "failed":
    case "unreachable":
    case "unrealizable":
    case "inputs unrealizable":
    case "contract unrealizable":
      return new ThemeIcon("$(testing-failed-icon)", new ThemeColor("testing.iconFailed"));
    case "unknown":
      return new ThemeIcon("$(question)", new ThemeColor("testing.iconQueued"));
    case "errored":
      return new ThemeIcon("$(testing-error-icon)", new ThemeColor("testing.iconErrored"));
  }
}
