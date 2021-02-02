import { Component, OnInit } from '@angular/core';

@Component({
  selector: 'app-simulation',
  templateUrl: './simulation.component.html',
  styleUrls: ['./simulation.component.css']
})
export class SimulationComponent implements OnInit {

  constructor() { }

  columns: number[] = [];

  initialSize: number = 10;

  ngOnInit(): void {
    this.changeColumns(this.initialSize);
  }

  changeColumns(size: number): void {
    this.columns = [];
    for (var i = 0; i < size; i++) {
      this.columns.push(i);
    }
  }
}
