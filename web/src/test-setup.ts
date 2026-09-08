import '@analogjs/vitest-angular/setup-zone';

import { beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import {
  BrowserDynamicTestingModule,
  platformBrowserDynamicTesting,
} from '@angular/platform-browser-dynamic/testing';

TestBed.initTestEnvironment(BrowserDynamicTestingModule, platformBrowserDynamicTesting());

/**
 * jsdom gives each spec *file* one storage area, not one per test, so anything a
 * test leaves in it is still there for the next test in the same file. That
 * turns the declared order of the tests into part of their setup.
 *
 * `core/utils/state-persistence` writes UI state (page number, filters, draft
 * step) to sessionStorage, and the admin components read it back in ngOnInit.
 * `payment-transactions` was failing on roughly one shuffled run in eight: the
 * previous-page test persisted page 2, and the next-page test then started from
 * 2 and landed on 3 instead of the expected 2. Clearing here rather than in each
 * spec keeps every test starting from a cold browser, which is what they all
 * assume anyway.
 */
beforeEach(() => {
  sessionStorage.clear();
  localStorage.clear();
});
