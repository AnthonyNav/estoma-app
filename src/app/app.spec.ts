import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { App } from './app';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideRouter([])],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('does not render a legacy header while the initial navigation is unresolved', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('header')).toBeNull();
    expect(element.querySelector('router-outlet')).not.toBeNull();
  });
  it('renders only the current wash header once a wash route is resolved', () => {
    const fixture = TestBed.createComponent(App);
    fixture.componentInstance.isWash.set(true);
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelectorAll('header').length).toBe(1);
    expect(element.querySelector('.wash-header__title')?.textContent).toContain(
      'Lavado ultrasónico',
    );
    expect(element.querySelector('.app-header')).toBeNull();
  });
});
