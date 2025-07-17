import { Component, OnInit } from '@angular/core';
import { Interpretation, Stream } from 'src/assets/Interpretation';
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

  public checkboxChanged(component: Interpretation, stream: Stream, value: (boolean | number | string | { num: number, den: number })[], event: Event): void {
    if (this.isDisabled(component, stream)) {
      if (typeof value[1] === "boolean") {
        (event.target as HTMLInputElement).checked = value[1];
      }
    } else {
      value[1] = (event.target as HTMLInputElement).checked;
    }
  }

  public inputChanged(type: string, value: (boolean | number | string | { num: number, den: number })[], event: Event): void {
    switch (type) {
      case "bool":
        value[1] = (event.target as HTMLInputElement).checked;
        break;
      case "int":
        value[1] = Number.parseInt((event.target as HTMLInputElement).value);
        break;
      case "real":
        let str = (event.target as HTMLInputElement).value;
        let i = str.indexOf("/");
        if (i === -1) {
          value[1] = Number.parseFloat((event.target as HTMLInputElement).value);
        } else {
          value[1] = { num: Number.parseInt(str.substring(0, i)), den: Number.parseInt(str.substring(i + 1)) };
        }
        break;
      case "enum":
        value[1] = (event.target as HTMLInputElement).value;
        break;
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
               
                console.log("Enum type not supported in simulation yet, default:", stream.typeInfo.values[0]);
                stream.instantValues.push([i, stream.typeInfo.values[0]]);
                break;
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
        } else {
          object[stream.name] = this.valueToString(stream.instantValues[i][1]);
        }
      }
      json.push(object);
    }
    vscode.postMessage({ command: "kind2/interpret", args: [{ uri: this._uri, name: this._main }, JSON.stringify(json)] });
  }
}

declare const vscode: VSCode;
