// Import fonts
import '@fontsource-variable/inter';
import '@fontsource-variable/jetbrains-mono';

// Import CSS
import './index.css';

// Import components
import { AppComponent } from './js/components/app.js';

// Initialize the app
document.addEventListener('DOMContentLoaded', () => {
  const root = document.getElementById('root');
  if (root) {
    const app = new AppComponent(root);
    app.mount();

    // Store app instance globally for debugging
    window.app = app;
  } else {
    console.error('Root element not found');
  }
});