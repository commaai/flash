import '@fontsource-variable/inter';
import '@fontsource-variable/jetbrains-mono';

import './index.css';

import { AppComponent } from './js/components/app.js';

// Initialize the app
document.addEventListener('DOMContentLoaded', () => {
  const root = document.getElementById('root');
  if (root) {
    const app = new AppComponent(root);
    app.mount();

    // for debugging only
    window.app = app;
  } else {
    console.error('Root element not found');
  }
});