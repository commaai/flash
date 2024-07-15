class MockWorker {
  constructor(stringUrl) {
    this.url = stringUrl;
    this.onmessage = () => {};
  }

  postMessage(msg) {
    this.onmessage({ data: msg });
  }

  addEventListener() {}
  removeEventListener() {}
  terminate() {}
}

export default MockWorker;
