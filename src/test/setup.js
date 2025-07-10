import '@testing-library/jest-dom'

// Setup for vanilla JS tests
global.ResizeObserver = class ResizeObserver {
  constructor(cb) {
    this.cb = cb;
  }
  observe() {}
  unobserve() {}
  disconnect() {}
};

// Mock File System Access API for tests
global.navigator = global.navigator || {};
global.navigator.storage = {
  getDirectory: () => Promise.resolve({
    remove: () => Promise.resolve(),
    getFileHandle: () => Promise.resolve({
      createWritable: () => Promise.resolve({
        write: () => Promise.resolve(),
        close: () => Promise.resolve()
      }),
      getFile: () => Promise.resolve(new Blob())
    })
  }),
  estimate: () => Promise.resolve({ quota: 10 * 1024 * 1024 * 1024 })
};
