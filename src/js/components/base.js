// Base component class for vanilla JS components
export class Component {
  constructor(container, options = {}) {
    this.container = container;
    this.options = options;
    this.state = {};
    this.listeners = new Map();
    this.mounted = false;
  }

  // Override this method to define the component's HTML
  render() {
    return '';
  }

  // Override this method to set up event listeners
  attachEventListeners() {
    // Subclasses should implement this
  }

  // Override this method to handle cleanup
  cleanup() {
    // Subclasses should implement this
  }

  // Set local component state
  setState(updates) {
    this.state = { ...this.state, ...updates };
    if (this.mounted) {
      this.update();
    }
  }

  // Update the component
  update() {
    this.container.innerHTML = this.render();
    this.attachEventListeners();
  }

  // Mount the component
  mount() {
    this.mounted = true;
    this.update();
  }

  // Unmount the component
  unmount() {
    this.mounted = false;
    this.cleanup();
    this.container.innerHTML = '';

    // Remove all event listeners
    this.listeners.forEach((listener, element) => {
      element.removeEventListener(listener.event, listener.handler);
    });
    this.listeners.clear();
  }

  // Helper method to add event listener with cleanup tracking
  addEventListener(element, event, handler) {
    element.addEventListener(event, handler);
    this.listeners.set(element, { event, handler });
  }

  // Helper method to safely query elements
  querySelector(selector) {
    return this.container.querySelector(selector);
  }

  querySelectorAll(selector) {
    return this.container.querySelectorAll(selector);
  }
}