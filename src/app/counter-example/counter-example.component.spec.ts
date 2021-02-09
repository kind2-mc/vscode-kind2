import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CounterExampleComponent } from './counter-example.component';

describe('CounterExampleComponent', () => {
  let component: CounterExampleComponent;
  let fixture: ComponentFixture<CounterExampleComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ CounterExampleComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(CounterExampleComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
