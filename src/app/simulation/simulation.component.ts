import { Component, OnInit } from '@angular/core';

@Component({
  selector: 'app-simulation',
  templateUrl: './simulation.component.html',
  styleUrls: ['./simulation.component.css']
})
export class SimulationComponent implements OnInit {

  constructor() {
    this.columns = [];
  }

  columns: number[];

  readonly initialSize: number = 10;

  ngOnInit(): void {
    this.changeColumns(this.initialSize);
    window.addEventListener('message', () => {
      
    });
  }

  columnsChanged(event: Event): void {
    this.changeColumns(Number.parseInt((event.target as HTMLInputElement).value));
  }

  changeColumns(size: number): void {
    this.columns = [];
    for (var i = 0; i < size; i++) {
      this.columns.push(i);
    }
  }
}
