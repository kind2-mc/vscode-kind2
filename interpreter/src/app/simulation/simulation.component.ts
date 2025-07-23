import { Component, input, OnInit } from '@angular/core';
import { Interpretation, Stream, StreamValue } from 'src/assets/Interpretation';
import { VSCode } from 'src/assets/VSCode';
//ng build --output-path=../out/interpreter
@Component({
    selector: 'app-simulation',
    templateUrl: './simulation.component.html',
    styleUrls: ['./simulation.component.css'],
    standalone: false
})
export class SimulationComponent implements OnInit {

  private _uri: string;
  private _main: string;
  private _components: Interpretation[];

  public constructor() {
    this._uri = "";
    this._main = "";
    this._components = [];
    // Handle the message inside the webview
    window.addEventListener('message', event => {
      console.log(event);
      if (event.data.uri !== undefined && event.data.main !== undefined && event.data.json !== undefined) {
        this._uri = event.data.uri;
        this._main = event.data.main;
        console.log("Received data:", this._uri, this._main, event.data.json);
        this._components = this.flatten(JSON.parse(event.data.json)[0]);
      }
    });
    vscode.postMessage("ready");
  }

  public get components(): Interpretation[] {
    return this._components;
  }

  public ngOnInit(): void {
  }

  private flatten(interp: Interpretation): Interpretation[] {
    console.log(interp);
    let interps: Interpretation[] = [];
    let stack: Interpretation[] = [interp];
    while (stack.length !== 0) {
      let curr: Interpretation = stack.pop()!;
      interps.push(curr);
      if (curr.subnodes !== undefined) {
        for (let child of curr.subnodes.reverse()) {
          stack.push(child);
        }
      }
    }
    console.log(interps);
    return interps;
  }

  public numCols(): number {
    let nCols = this._components[0].streams[0].instantValues.length;
    if (nCols == 0) {
      nCols = 10;
      this.changeColumns(nCols);
    }
    return nCols;
  }

  public isDisabled(component: Interpretation, stream: Stream): boolean {
    return component !== this._components[0] || stream.class !== "input";
  }

  public valueToString(value: any): string | String | undefined {
    if (value === undefined) {
      return undefined;
    }
    if (value.num !== undefined && value.den !== undefined) {
      return value.num.toString() + "/" + value.den.toString();
    }
   
    return value.toString();
  }

  public inputArray(component: Interpretation, stream: Stream, value: (StreamValue)[]): void {
    console.log("Input array for " + stream.name);
  }

  public checkboxChanged(component: Interpretation, stream: Stream, value: (StreamValue)[], event: Event): void {
    if (this.isDisabled(component, stream)) {
      if (typeof value[1] === "boolean") {
        (event.target as HTMLInputElement).checked = value[1];
      }
    } else {
      value[1] = (event.target as HTMLInputElement).checked;
    }
  }
  public getValueFromString(val: string, type: string): StreamValue {
    switch (type) {
      case "int":
        return Number.parseInt(val);
        break;
      case "real":
        let i = val.indexOf("/");
        if (i === -1) {
          return Number.parseFloat(val);
        } else {
          return { num: Number.parseInt(val.substring(0, i)), den: Number.parseInt(val.substring(i + 1)) };
        }
        break;
      case "enum":
        return val;
        break;
      case "array":
        console.error("Array input not implemented yet");
        return Number.parseInt(val);
      default:
        console.error("Unknown type: " + type);
        return -1;
    }
  }
  public inputChanged(type: string, value: (StreamValue)[], event: Event): void {
    
     switch (type) {
      case "bool":
        value[1] = (event.target as HTMLInputElement).checked;
        break;
      case "int":
      case "real":
      case "enum":
      case "array":
        value[1] = this.getValueFromString((event.target as HTMLInputElement).value, type);
        break;
      default:
        console.error("Unknown type: " + type);
    }
  }

  public columnsChangedEvent(event: Event): void {
    this.changeColumns(Number.parseInt((event.target as HTMLInputElement).value));
  }

  private changeColumns(nCols: number): void {
    if (nCols < this._components[0].streams[0].instantValues.length) {
      for (let component of this._components) {
        for (let stream of component.streams) {
          stream.instantValues.splice(nCols);
        }
      }
    }
    else {
      for (let stream of this._components[0].streams) {
        for (let i = stream.instantValues.length; i < nCols; ++i) {
          if (stream.class === "input") {
            switch (stream.type) {
              case "bool":
                stream.instantValues.push([i, false]);
                break;
              case "int":
                stream.instantValues.push([i, 0]);
                break;
              case "real":
                stream.instantValues.push([i, 0.0]);
                break;
              case "enum":
                stream.instantValues.push([i, stream.typeInfo.values[0]]);
                break;
              case "array":
                stream.instantValues.push([i, new Array(stream.typeInfo.sizes[0]).fill(0)]);
            }
          } else {
            stream.instantValues.push([i]);
          }
        }
      }
      for (let component of this._components.slice(1)) {
        for (let stream of component.streams) {
          for (let i = stream.instantValues.length; i < nCols; ++i) {
            stream.instantValues.push([i]);
          }
        }
      }
    }
  }

  public simulate(): void {
    let json: any[] = new Array();
    let mainComponent: Interpretation = this._components[0];
    let inputStreams: Stream[] = mainComponent.streams.filter(stream => stream.class === "input");
    let time: number = this._components[0].streams[0].instantValues.length;
    for (let i = 0; i < time; ++i) {
      let object: any = {};
      for (let stream of inputStreams!) {
        if (stream.name.includes(".")) {
          const path = stream.name.split(".");
          let subObj = object;
          for (let j = 0; j < path.length - 1; j++) {
            const name = path[j];
            if (subObj[name] === undefined) {
              subObj[name] = {};
            }
            subObj = subObj[name];
          }
          subObj[path[path.length - 1]] = stream.instantValues[i][1];
        } else if (typeof stream.instantValues[i][1] === "boolean") {
          object[stream.name] = stream.instantValues[i][1];
        } else if (Array.isArray(stream.instantValues[i][1])) {
          object[stream.name] = stream.instantValues[i][1];
        } else {
          object[stream.name] = this.valueToString(stream.instantValues[i][1]);
        }
      }
      json.push(object);
    }
    console.log("Simulating with JSON:", JSON.stringify(json));
    vscode.postMessage({ command: "kind2/interpret", args: [{ uri: this._uri, name: this._main }, JSON.stringify(json)] });
  }




  public showArrayEditor: boolean = false;
  public currentStream: Stream | null = null;
  public unsavedValues: string[] = [];
  public arrayValues: StreamValue[] = [];

  public arrayValueChanged(index: number, event: Event): void {
    if(this.currentStream?.type == undefined){
      console.error("Current stream type is undefined");
      return;
    }
    this.unsavedValues[index] = (event.target as HTMLInputElement).value;
    console.log("Array is now:", this.unsavedValues, "(index changed at " + index + ")");
  }
  public openArrayEditor(stream: Stream, values: StreamValue[]): void {
    this.currentStream = stream;
    

    if(values[1] !== undefined){
      this.arrayValues = values[1] as StreamValue[];
     
    } else {
      this.arrayValues = new Array(this.currentStream.typeInfo.sizes[0]);
      this.arrayValues.fill("");
    }
     for (let i = 0; i < this.arrayValues.length; i++) {
        this.unsavedValues[i] = this.arrayValues[i].toString(); 
      }

    console.log("Opening array editor for:", stream.name, "with values:", this.unsavedValues);
    this.showArrayEditor = true;
  }

  public closeArrayEditor(): void {
    this.showArrayEditor = false;
    this.currentStream = null;
    this.arrayValues = [];
    this.unsavedValues = [];
    // this.arrayValues = [];
  }

  public saveArray(): void {
    this.unsavedValues.forEach((value, index) => {
      this.arrayValues[index] = this.getValueFromString(value, this.currentStream?.typeInfo.baseType);
    });

    this.closeArrayEditor();
  }
}

declare const vscode: VSCode;
