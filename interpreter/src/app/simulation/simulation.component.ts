import { Component, input, OnInit } from '@angular/core';
import { Interpretation, Stream, StreamValue } from 'src/assets/Interpretation';
import { VSCode } from 'src/assets/VSCode';

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
        try {
          let json_data: any = JSON.parse(event.data.json)[0];
          console.log("Received data:", this._uri, this._main, json_data);
          let nd_vars: Array<any> = this.nonDeterministicVarsOf(json_data);
          if(nd_vars && nd_vars.length > 0) {
            let nd_vars_names: Array<string> = nd_vars.map( (nd_var) => {return nd_var.name} ); 
            vscode.postMessage({command: "showErrorMessage", text : `Cannot simulate nondeterministic systems (Variables: ${nd_vars_names.join(", ")})`})
            return;
          }
          this._components = this.flatten(json_data);
        } catch (e) {
          vscode.postMessage({ command: "showErrorMessage", text: "Kind 2 Error" });
        }
      }
    });
    vscode.postMessage("ready");
  }

  public get components(): Interpretation[] {
    return this._components;
  }
  //This function only works if constants with a definition are taken out of the interpreter trace.
  private nonDeterministicVarsOf(json: any) {
    let streams : Array<any> = json.streams;
    let nd_streams : Array<any> = streams.filter((stream) => {
      let instant_values: Array<any> = stream.instantValues
      console.log(`Stream ${JSON.stringify(stream)} with instantValues ${instant_values} :: ${typeof instant_values}`); 
      return stream.instant_values == undefined && stream.class == "constant"; 
      }
    )
    return nd_streams;


  }
  public ngOnInit(): void {
  }

  private flatten(interp: Interpretation): Interpretation[] {
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
    if(Array.isArray(value)) {
      return "[" + value.map(v => this.valueToString(v)).join(",") + "]";
    }
    if(typeof value === "boolean") {
      return value ? "true" : "false";

    }
    return value.toString();
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
      case "bool":
        return val === "true";
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
              case "int":
              case "real":
              case "enum":
              case "array":
                stream.instantValues.push([i, this.defaultValueFor(stream.type, stream.typeInfo)]);
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

  public defaultValueFor(type: string, typeInfo: any): StreamValue {
    switch (type) {
      case "bool":
        return false;
      case "int":
        return 0;
      case "real":
        return 0.0;
      case "enum":
        return  typeInfo.values[0];
      case "array":
        return this.createNDimensionalArray(typeInfo.sizes, this.defaultValueFor(typeInfo.baseType, typeInfo.baseTypeInfo));
      default:
        console.error("Unknown type: " + type);
        return -1;
    }
  }

  private createNDimensionalArray(sizes: number[], defaultValue: any = 0): any {
 
  
  if (sizes.length === 1) {
    return Array.from({length: sizes[0]}, () => defaultValue);
  }
  
  const [currentSize, ...remainingSizes] = sizes;
  return Array.from({length: currentSize}, () => 
    this.createNDimensionalArray(remainingSizes, defaultValue)
  );
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
        }  else {
          object[stream.name] = this.valueToJSON(stream.instantValues[i][1]);
        }
      }
      json.push(object);
    }
    console.log("Simulating with JSON:", JSON.stringify(json));
    vscode.postMessage({ command: "kind2/interpret", args: [{ uri: this._uri, name: this._main }, JSON.stringify(json)] });
  }
  public valueToJSON(value: any): string | String | any[] | boolean | undefined {
    if (value === undefined) {
      return undefined;
    }
    if (value.num !== undefined && value.den !== undefined) {
      return value.num.toString() + "/" + value.den.toString();
    }
    if(Array.isArray(value)) {
      return value;
    }
    if(typeof value === "boolean") {
      return value;

    }
    return value.toString();
  }




  public showArrayEditor: boolean = false;
  public currentStream: Stream | null = null;
  public unsavedValues: string[] | string[][] = [];
  public arrayValues: StreamValue[] = [];

  public getColIndices(): number[] {
    if (this.currentStream?.typeInfo.sizes.length === 2) {
      return Array.from({ length: this.currentStream?.typeInfo.sizes[1] }, (_, i) => i);
    } else if (this.currentStream?.typeInfo.sizes.length === 1) {
      return [-1];
    } else {
      return [];
    }
  }

  public getRowIndices(): number[] {
      return Array.from({ length: this.currentStream?.typeInfo.sizes[0] }, (_, i) => i);
   
  }

  public getArrayValue(row: number, col?: number): string | boolean {
    let ret: string = "";
    if(col !== undefined && col !== -1) {
      ret = (this.unsavedValues as string[][])[row][col];
    } else {
      ret = (this.unsavedValues as string[])[row];
    }
    if (this.currentStream?.typeInfo.baseType === 'bool') {
      return ret === "true";
    }
    return ret;
  }
  public getValueFromEvent(event: Event): string {
    if(this.currentStream?.typeInfo.baseType === 'bool') {
      return (event.target as HTMLInputElement).checked ? "false" : "true";
    }
    return (event.target as HTMLInputElement).value;
  }
  public arrayValueChanged( event: Event, row: number, col?: number): void {
    if(this.currentStream?.type == undefined){
      console.error("Current stream type is undefined");
      return;
    }
    if(col !== -1 && col !== undefined) {
      (this.unsavedValues as string[][])[row][col] = this.getValueFromEvent(event);
    } else{
      this.unsavedValues[row] = this.getValueFromEvent(event);

    }
  }
  public openArrayEditor(stream: Stream, values: StreamValue[]): void {
    this.currentStream = stream;
    

    if(values[1] !== undefined){
      this.arrayValues = values[1] as StreamValue[];
    } else {
      this.arrayValues = this.createNDimensionalArray(this.currentStream.typeInfo.sizes, "");
    }
    let numDims = this.currentStream.typeInfo.sizes.length;
    if(numDims === 1) {
      for (let i = 0; i < this.arrayValues.length; i++) {
          this.unsavedValues[i] = this.arrayValues[i].toString(); 
      }
    } else if(numDims === 2) {
      this.unsavedValues = this.arrayValues.map(row => (row as StreamValue[]).map(value => value.toString()));
    } else {
      return;
    }

    this.showArrayEditor = true;
  }

  public closeArrayEditor(): void {
    this.showArrayEditor = false;
    this.currentStream = null;
    this.arrayValues = [];
    this.unsavedValues = [];
  }

  public saveArray(): void {
    const is2D = Array.isArray(this.unsavedValues[0]);
    if(is2D){
      for (let i = 0; i < (this.unsavedValues as string[][]).length; i++) {
        const row = (this.unsavedValues as string[][])[i];
        for (let j = 0; j < row.length; j++) {
          (this.arrayValues[i] as StreamValue[])[j] = this.getValueFromString(row[j], this.currentStream?.typeInfo.baseType);
        }
      }
    }else {
      this.unsavedValues.forEach((value, index) => {
        this.arrayValues[index] = this.getValueFromString(value as string, this.currentStream?.typeInfo.baseType);
        
      });
    }

    this.closeArrayEditor();
  }
  public showViewArrayButton(stream: Stream): boolean {
    if(stream.class === "output") {
        return stream.instantValues.some(value => value.length > 1);
    } 
    return true;
  }
}



declare const vscode: VSCode;
