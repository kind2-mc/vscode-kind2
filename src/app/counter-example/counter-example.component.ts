import { Component, OnInit } from '@angular/core';
import { CounterExample } from 'ext-src/counterExample';

@Component({
  selector: 'app-counter-example',
  templateUrl: './counter-example.component.html',
  styleUrls: ['./counter-example.component.css']
})
export class CounterExampleComponent implements OnInit {

  components: CounterExample[];

  constructor() {
    this.components = [];
  }

  ngOnInit(): void {
    // Handle the message inside the webview
    window.addEventListener('message', event => {
      this.components = event.data; // The JSON data our extension sent
      console.log(this.components);
    });
  }
}
