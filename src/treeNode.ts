/*
 * Copyright (c) 2021, Board of Trustees of the University of Iowa All rights reserved.
 *
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */

import { ThemeColor, ThemeIcon } from "vscode";

export type TreeNode = File | Component | Analysis | Property | Container;

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


export class Container{
  // Potentially an oversight with how the TreeNode type works:
  // It is assumed every TreeNode has a line in the file it's associated with,
  // but this type breaks that assumption. The purpose of the line field is so
  // you can use the "show source" button in the TreeView. Same for uri.
  // It is impossible for the extension in its current state to ever access
  // these variables, but it supresses the type checker errors
  line: number;
  uri: string;

  children: TreeNode[];
  constructor(readonly parent: TreeNode, children: TreeNode[], readonly name: string, readonly tag: string, readonly value?: number){
    this.children = children;
  }
  private get parentAnalysis(): Analysis{
     
    return this.parent.parent as Analysis
  }
  get icon(){
    if(this.parentAnalysis.activeIVC == this.value || this.parentAnalysis.activeMCS == this.value){
      return new ThemeIcon("pass-filled");
    }
    else return undefined
  }
  public activateIVC() {
   if(this.tag != "ivc_button"){
      throw new Error("Function parentAnalysis was called in error: this Container does not have tag 'ivc_button'.");
    }
    
    this.parentAnalysis.setActiveIVC(this.value);
    
  }

  public activateMCS() {
   if(this.tag != "mcs_button"){
      throw new Error("Function parentAnalysis was called in error: this Container does not have tag 'mcs_button'.");
    }
    
    this.parentAnalysis.setActiveMCS(this.value);
    
  }
}

export class Component {
  private _state: State[];
  private _analyses: Analysis[];
  private _imported: boolean;
  private _typeDecl: boolean;
  private _hasRefType: boolean;
  set analyses(analyses: Analysis[]) { this._analyses = analyses; }
  get analyses(): Analysis[] { return this._analyses; }
  set imported(imported: boolean) { this._imported = imported; }
  get imported(): boolean { return this._imported; }
  set typeDecl(typeDecl: boolean) { this._typeDecl = typeDecl; }
  get typeDecl(): boolean { return this._typeDecl; }
  set hasRefType(hasRefType: boolean) { this._hasRefType = hasRefType; }
  get hasRefType(): boolean { return this._hasRefType; }
  set state(state: State[]) {
    if (this._analyses.length == 0) {
      this._state = state;
    }
  }

  get ivcProperties(): Property[] {
    let ivcProperties: Property[] = [];
    for (const analysis of this._analyses) {
      for (const property of analysis.ivcPropertiesDisplay) {
        //if (property.state === "ivc must" || property.state === "ivc may") {
          ivcProperties.push(property);
        //}
      }
    }
    return ivcProperties;
  }
  get mcsProperties(): Property[] {
    let mcsProperties: Property[] = [];
    for (const analysis of this._analyses) {
      for (const property of analysis.mcsPropertiesDisplay) {
        //if (property.state === "ivc must" || property.state === "ivc may") {
          mcsProperties.push(property);
        //}
      }
    }
    return mcsProperties;
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
        if (property.state === "conflicting") { failedProperties.set(property.name, property); }
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
      // "Trivial" type declaration realizability checks give a question mark
      if (analysis.realizability === "realizable" && !this.hasRefType && analysis.realizabilitySource === "type") {
        return ["unknown"]
      }
      if (analysis.realizability === "realizable" && analysis.realizabilitySource === "contract") { 
        ret.push("contract realizable"); 
      }
      if (analysis.realizability === "realizable" && analysis.realizabilitySource === "inputs") { 
        ret.push("inputs realizable"); 
      }
      if (analysis.realizability === "realizable" && analysis.realizabilitySource === "type") { 
        ret.push("type realizable"); 
      }
      if (analysis.realizability === "unrealizable" && analysis.realizabilitySource === "contract") { 
        ret.push("contract unrealizable"); 
      }
      if (analysis.realizability === "unrealizable" && analysis.realizabilitySource === "inputs") { 
        ret.push("inputs unrealizable"); 
      }
      if (analysis.realizability === "unrealizable" && analysis.realizabilitySource === "type") { 
        ret.push("type unrealizable"); 
      }
    }
    if (ret.length !== 0) {
      return ret;
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
  constructor(readonly name: string, readonly line: number, readonly contractLine: number, readonly parent: File, readonly importedComp: string, readonly compKind: string, readonly hasRefinementType: boolean) {
    this._state = ["pending"];
    this._analyses = [];
    this._imported = importedComp === "true";
    this._typeDecl = compKind === "typeDecl";
    this._hasRefType = hasRefinementType;
  }
}

export type RealizabilitySource = "inputs" | "contract" | "imported node" | "type"

// TODO Probably should make a hierarchy of Analysis with subclasses:
//  MCSAnalysis and IVCAnalysis. Potentially merge MCS and IVC functionality since they are mostly the same
export class Analysis {
  
  
  private _activeMCS: number;
  private _mcss: Property[][];
  
  private _activeIvc: number;
  private _ivcs: Property[][];
  private _must: Property[];
  
  private _properties: Property[];
  private _realizability: RealizabilityResult;
  private _realizabilitySource: RealizabilitySource;
  set properties(properties: Property[]) { this._properties = properties; }
  get properties(): Property[] { return this._properties; }


  get ivcPropertiesDisplay(): Property[] { 
    if(this._activeIvc === undefined) return [];
    if(this._activeIvc === -1) return this._must;
    return this._ivcs[this._activeIvc]; 
  }
  get must(){ return this._must}
  set must(must: Property[]){this._must = must}
  public addIVC(ivc: Property[]){
    if(this._ivcs.length == 0) this._activeIvc = 0;
    this._ivcs.push(ivc);
  }
  public setActiveIVC(selection: number){
    if(selection >= this._ivcs.length || selection < -1){
      throw new Error(`Selection index ${selection} is out of bounds for IVCs of length ${this._ivcs.length}`);
    }
    this._activeIvc = selection;
  }
  get activeIVC(){
    return this._activeIvc;
  }
  public hasIVC(){
    return this._ivcs.length != 0
  }
  get ivcs() {return this._ivcs}


  get mcss() {return this._mcss}
  public addMCS(mcs: Property[]){
    mcs.forEach((property, index) => {
    });
    if(this._mcss.length == 0) this._activeMCS = 0;
    this._mcss.push(mcs);
  }

  public hasMCS(){
    return this._mcss.length != 0
  }
  get activeMCS(){
    return this._activeMCS;
  }

  get mcsPropertiesDisplay(): Property[] {
    if(this._activeMCS === undefined) return [];
    return this._mcss[this._activeMCS]; 
  }
  public setActiveMCS(selection: number){
    if(selection >= this._mcss.length || selection < 0){
      throw new Error(`Selection index ${selection} is out of bounds for MCSs of length ${this._mcss.length}`);
    }
    this._activeMCS = selection;
  }
  
  set realizability(realizability: RealizabilityResult) { this._realizability = realizability; }
  get realizability(): RealizabilityResult { return this._realizability; }
  set realizabilitySource(realizabilitySource: RealizabilitySource) { this._realizabilitySource = realizabilitySource; }
  get realizabilitySource(): RealizabilitySource { return this._realizabilitySource; }
  
  constructor(readonly abstract: String[], readonly concrete: String[], readonly parent: Component) {
    this._properties = [];
    this._ivcs = [];
    this._mcss = [];
  }
}

export class Property {
  private _state: State;
  set state(state: State) { this._state = state; }
  get state(): State { return this._state; }
  constructor(
    readonly name: string,
    readonly line: number,
    readonly uri: string,
    readonly parent: Analysis,
    readonly startCol?: number
  ) {
    this._state = "pending";
  }
}

export type State = 
  "pending" | "running" | "passed" | "reachable" | "failed" | "unreachable" 
| "unknown" | "stopped" | "errored" | "realizable" | "unrealizable" | "inputs realizable"
| "inputs unrealizable" | "contract realizable" | "contract unrealizable"
| "type realizable" | "type unrealizable" | "conflicting" | "ivc must" | "ivc may" | "mcs property" | "mcs cut";

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
    case "type realizable":
    case "realizable":
      return "icons/passed.svg";
    case "failed":
    case "unreachable":
    case "unrealizable":
    case "inputs unrealizable":
    case "contract unrealizable":
    case "type unrealizable":
    case "conflicting":  
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
    case "type realizable":
    case "realizable":
      return new ThemeIcon("$(testing-passed-icon)", new ThemeColor("testing.iconPassed"));
    case "failed":
    case "unreachable":
    case "unrealizable":
    case "inputs unrealizable":
    case "contract unrealizable":
    case "type unrealizable":
    case "conflicting":
      return new ThemeIcon("$(testing-failed-icon)", new ThemeColor("testing.iconFailed"));
    case "unknown":
      return new ThemeIcon("$(question)", new ThemeColor("testing.iconQueued"));
    case "errored":
      return new ThemeIcon("$(testing-error-icon)", new ThemeColor("testing.iconErrored"));
  }
}

//for editor highlighting in future ivc/mcs features
export function stateColor(state: State): ThemeColor {
  switch (state) {
    case "pending":
    case "running":
    case "failed":
    case "unreachable":
    case "stopped":
    case "unrealizable":
    case "contract unrealizable":
    case "type unrealizable":
    case "conflicting":
    case "passed":
    case "reachable":
    case "realizable":
    case "contract realizable":
    case "type realizable":
    case "inputs realizable":
    case "unknown":
    case "errored":
    case "inputs unrealizable":
      return undefined; // Invisible highlight, can hover to see text
    case "ivc must":
    case "ivc may":
      return new ThemeColor("editorOverviewRuler.addedForeground");
    case "mcs property":
      return new ThemeColor("editorOverviewRuler.deletedForeground");
    case "mcs cut":
      return new ThemeColor("editorOverviewRuler.warningForeground");
  }
  throw new Error(`Unknown state: ${state}`); 
}
