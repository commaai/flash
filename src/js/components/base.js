export class Component {
  constructor(container, options = {}) {
    this.container = container;
    this.options = options;
    this.state = {};
    this.listeners = new Map();
    this.mounted = false;
  }

  render() {
    return '';
  }

  attachEventListeners() { }

  cleanup() { }

  setState(updates) {
    this.state = { ...this.state, ...updates };
    if (this.mounted) {
      this.update();
    }
  }

  update() {
    this.container.innerHTML = this.render();
    this.attachEventListeners();
  }

  mount() {
    this.mounted = true;
    this.update();
  }

  unmount() {
    this.mounted = false;
    this.cleanup();
    this.container.innerHTML = '';

    this.listeners.forEach((listener, element) => {
      element.removeEventListener(listener.event, listener.handler);
    });
    this.listeners.clear();
  }

  addEventListener(element, event, handler) {
    element.addEventListener(event, handler);
    this.listeners.set(element, { event, handler });
  }

  querySelector(selector) {
    return this.container.querySelector(selector);
  }

  querySelectorAll(selector) {
    return this.container.querySelectorAll(selector);
  }
}