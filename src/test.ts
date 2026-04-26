import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';


describe('AppComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [AppComponent],
      providers: [
        {
          provide: AccountService,
          useValue: {
            account: of(null),
            logout: () => undefined,
          },
        },
      ],
    })
      .overrideComponent(AppComponent, { set: { template: '' } })
      .compileComponents();
  });

  it('should create', () => {
    const fixture = TestBed.createComponent(AppComponent);
    expect(fixture.componentInstance).toBeTruthy();
  });
});// This file is required by karma.conf.js and loads recursively all the .spec and framework files

import 'zone.js/testing';
import { getTestBed } from '@angular/core/testing';
import { BrowserDynamicTestingModule, platformBrowserDynamicTesting } from '@angular/platform-browser-dynamic/testing';
import { AppComponent } from '@app/app.component';
import { AccountService } from '@app/_services/account.service';

type WebpackContext = {
  <T>(id: string): T;
  keys(): string[];
};

getTestBed().initTestEnvironment(
  BrowserDynamicTestingModule,
  platformBrowserDynamicTesting(),
);

const context = (import.meta as any).webpackContext('./', {
  recursive: true,
  regExp: /\.spec\.ts$/,
}) as WebpackContext;

context.keys().forEach(context);
