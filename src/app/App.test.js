import { expect, test, beforeEach, afterEach } from 'vitest';
import { AppComponent } from '../js/components/app.js';

// Mock the environment variables
Object.defineProperty(import.meta, 'env', {
  value: {
    VITE_PUBLIC_GIT_SHA: 'test-version'
  }
});

// Setup DOM
beforeEach(() => {
  document.body.innerHTML = '<div id="test-container"></div>';
});

afterEach(() => {
  document.body.innerHTML = '';
});

test('renders without crashing', () => {
  const container = document.getElementById('test-container');
  const app = new AppComponent(container);
  app.mount();
  
  expect(container.textContent).toContain('flash.comma.ai');
});

test('displays version correctly', () => {
  const container = document.getElementById('test-container');
  const app = new AppComponent(container);
  app.mount();
  
  expect(container.textContent).toContain('test-version');
});

test('has flash container', () => {
  const container = document.getElementById('test-container');
  const app = new AppComponent(container);
  app.mount();
  
  const flashContainer = container.querySelector('#flash-container');
  expect(flashContainer).toBeTruthy();
});

test('unmounts cleanly', () => {
  const container = document.getElementById('test-container');
  const app = new AppComponent(container);
  app.mount();
  
  expect(container.innerHTML).toBeTruthy();
  
  app.unmount();
  expect(container.innerHTML).toBe('');
});