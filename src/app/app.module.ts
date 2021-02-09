import { BrowserModule } from '@angular/platform-browser';
import { NgModule } from '@angular/core';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { SimulationComponent } from './simulation/simulation.component';
import { CounterExampleComponent } from './counter-example/counter-example.component';

@NgModule({
  declarations: [
    AppComponent,
    SimulationComponent,
    CounterExampleComponent
  ],
  imports: [
    BrowserModule,
    AppRoutingModule
  ],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule { }
