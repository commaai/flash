export class StateManager {
  constructor(initialState = {}) {
    this.state = initialState;
    this.listeners = new Set();
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  setState(updates) {
    const prevState = this.state;
    this.state = { ...this.state, ...updates };
    this.listeners.forEach(listener => listener(this.state, prevState));
  }

  getState() {
    return this.state;
  }
}

// Global state manager
export const appState = new StateManager({
  // App state
  version: 'dev',

  // Flash state
  step: null,
  message: '',
  progress: -1,
  error: null,
  connected: false,
  serial: null,

  // UI state
  isFlashComponentLoaded: false
});