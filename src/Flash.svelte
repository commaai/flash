<script>
  import { flashDevice } from './lib/usb.js';

  let device = null;
  let firmware = null;
  let progress = 0;

  async function connect() {
    try {
      device = await navigator.usb.requestDevice({ filters: [] });
      await device.open();
      alert("Device connected!");
    } catch (e) {
      alert("Connection failed: " + e.message);
    }
  }

  function pickFirmware(event) {
    firmware = event.target.files[0];
  }

  async function flash() {
    if (!device) {
      alert("Connect a device first.");
      return;
    }

    if (!firmware) {
      alert("Select firmware first.");
      return;
    }

    progress = 1;

    try {
      await flashDevice(device, firmware, (p) => progress = p);
      alert("Flash complete!");
    } catch (err) {
      alert("Flash failed: " + err.message);
    }
  }
</script>

<style>
  .container {
    max-width: 500px;
    margin: 50px auto;
    padding: 20px;
    text-align: center;
    background: #111;
    color: #fff;
    border-radius: 10px;
    border: 1px solid #333;
  }
  button {
    padding: 10px 20px;
    margin: 10px;
    background: #444;
    border: none;
    color: white;
    cursor: pointer;
    border-radius: 5px;
  }
  button:hover {
    background: #666;
  }
  .progress {
    height: 10px;
    background: #333;
    border-radius: 5px;
    margin-top: 15px;
    overflow: hidden;
  }
  .progress-fill {
    height: 100%;
    background: #00ff84;
    transition: width 0.3s ease;
  }
</style>

<div class="container">
  <h2>Flash Device</h2>

  <button on:click={connect}>Connect Device</button>

  <div>
    <input type="file" on:change={pickFirmware} />
  </div>

  <button on:click={flash}>Flash</button>

  <div class="progress">
    <div class="progress-fill" style="width: {progress}%"></div>
  </div>

  <p>Progress: {progress}%</p>
</div>
