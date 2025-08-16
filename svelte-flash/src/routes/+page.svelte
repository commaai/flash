<!-- src/routes/+page.svelte -->
<script>
  import { onMount } from 'svelte';
  import Flash from '../lib/Flash.svelte';
  
  import comma from '../lib/assets/comma.svg';
  import qdlPorts from '../lib/assets/qdl-ports.svg';
  import zadigCreateNewDevice from '../lib/assets/zadig_create_new_device.png';
  import zadigForm from '../lib/assets/zadig_form.png';

  const VENDOR_ID = '05C6';
  const PRODUCT_ID = '9008';
  const DETACH_SCRIPT = 'for d in /sys/bus/usb/drivers/qcserial/*-*; do [ -e "$d" ] && echo -n "$(basename $d)" | sudo tee /sys/bus/usb/drivers/qcserial/unbind > /dev/null; done';

  // Platform detection
  let isWindows = false;
  let isLinux = false;
  let version = 'dev';

  // Resizable layout state
  let leftWidth = 50; // Percentage
  let isResizing = false;
  let containerRef;

  onMount(() => {
    isWindows = navigator.platform.toLowerCase().includes('win');
    isLinux = navigator.platform.toLowerCase().includes('linux');
    version = import.meta.env.VITE_PUBLIC_GIT_SHA || 'dev';
    console.info(`flash.comma.ai version: ${version}`);
  });

  function copyText(text) {
    navigator.clipboard.writeText(text);
  }

  function handleMouseDown(e) {
    isResizing = true;
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    e.preventDefault();
  }

  function handleMouseMove(e) {
    if (!isResizing || !containerRef) return;
    
    const rect = containerRef.getBoundingClientRect();
    const newLeftWidth = ((e.clientX - rect.left) / rect.width) * 100;
    
    // Constrain between 20% and 80%
    leftWidth = Math.max(20, Math.min(80, newLeftWidth));
  }

  function handleMouseUp() {
    isResizing = false;
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
  }
</script>

<svelte:head>
  <title>flash.comma.ai</title>
  <meta name="description" content="Flash AGNOS onto your comma device" />
</svelte:head>

<div class="resizable-container" bind:this={containerRef}>
  <!-- Main content -->
  <main 
    class="main-panel prose dark:prose-invert prose-green bg-white dark:bg-gray-900"
    style="width: {leftWidth}%"
  >
    <!-- Header Section -->
    <section>
      <img src={comma} alt="comma" width="128" height="128" class="dark:invert" />
      <h1>flash.comma.ai</h1>
      <p>
        This tool allows you to flash AGNOS onto your comma device. AGNOS is the Ubuntu-based operating system for
        your <a href="https://comma.ai/shop/comma-3x" target="_blank" rel="noopener">comma 3/3X</a>.
      </p>
    </section>
    
    <hr />

    <!-- Requirements Section -->
    <section>
      <h2>Requirements</h2>
      <ul>
        <li>
          A web browser which supports <a href="https://caniuse.com/webusb" target="_blank" rel="noopener">WebUSB</a>
          (such as Google Chrome, Microsoft Edge, Opera), running on Windows, macOS, Linux, or Android.
        </li>
        <li>
          A good quality USB-C cable to connect the device to your computer. <span title="SuperSpeed">USB 3</span>
          is recommended for faster flashing speed.
        </li>
        <li>
          Another USB-C cable and a charger, to power the device outside your car.
        </li>
      </ul>
      
      {#if isWindows}
        <h3>USB Driver</h3>
        <p>You need additional driver software for Windows before you connect your device.</p>
        <ol>
          <li>
            Download and run <a href="https://zadig.akeo.ie/" target="_blank" rel="noopener">Zadig</a>.
          </li>
          <li>
            Under <code>Device</code> in the menu bar, select <code>Create New Device</code>.
            <img src={zadigCreateNewDevice} alt="Zadig Create New Device" width="575" height="254" />
          </li>
          <li>
            Fill in three fields. The first field is just a description and you can fill in anything. The next two
            fields are very important. Fill them in with <code>{VENDOR_ID}</code> and <code>{PRODUCT_ID}</code>
            respectively. Press "Install Driver" and give it a few minutes to install.
            <img src={zadigForm} alt="Zadig Form" width="575" height="254" />
          </li>
        </ol>
        <p>No additional software is required for macOS, Linux or Android.</p>
      {/if}
    </section>
    
    <hr />

    <!-- Flashing Section -->
    <section>
      <h2>Flashing</h2>
      <p>Follow these steps to put your device into QDL mode:</p>
      <ol>
        <li>Unplug the device and wait for the LED to switch off.</li>
        <li>First, connect the device to your computer using the <strong>lower</strong> <span class="whitespace-nowrap">USB-C</span> port <strong>(port 1)</strong>.</li>
        <li>Second, connect power to the <strong>upper</strong> <span class="whitespace-nowrap">OBD-C</span> port <strong>(port 2)</strong>.</li>
      </ol>
      
      <img src={qdlPorts} alt="image showing comma three and two ports. the lower port is labeled 1. the upper port is labeled 2." width="450" height="300" />
      
      <p>Your device's screen will remain blank for the entire flashing process. This is normal.</p>
      
      {#if isLinux}
        <strong>Note for Linux users</strong>
        <p>
          On Linux systems, devices in QDL mode are automatically bound to the kernel's qcserial driver, and
          need to be unbound before we can access the device. Copy the script below into your terminal and run it
          after plugging in your device.
        </p>
        <div class="relative text-sm">
          <pre class="font-mono pt-12">{DETACH_SCRIPT}</pre>
          <button
            class="absolute top-2 right-2 bg-blue-600 hover:bg-blue-500 active:bg-blue-300 transition-colors text-white p-1 rounded-md"
            on:click={() => copyText(DETACH_SCRIPT)}
          >
            Copy
          </button>
        </div>
      {/if}
      
      <p>
        Next, click the button to start flashing. From the prompt select the device which starts with
        "QUSB_BULK".
      </p>
      <p>
        The process can take 30+ minutes depending on your internet connection and system performance. Do not
        unplug the device until all steps are complete.
      </p>
    </section>
    
    <hr />

    <!-- Troubleshooting Section -->
    <section>
      <h2>Troubleshooting</h2>
      <h3>Lost connection</h3>
      <p>
        Try using high quality USB 3 cables. You should also try different USB ports on the front or back of your
        computer. If you're using a USB hub, try connecting directly to your computer instead.
      </p>
      <h3>My device's screen is blank</h3>
      <p>
        This is normal in QDL mode. You can verify that the "QUSB_BULK" device shows up when you press
        the Flash button to know that it is working correctly.
      </p>
      <h3>My device says "fastboot mode"</h3>
      <p>
        You may have followed outdated instructions for flashing. Please read the instructions above for putting
        your device into QDL mode.
      </p>
      <h3>General Tips</h3>
      <ul>
        <li>Try another computer or OS</li>
        <li>Try different USB ports on your computer</li>
        <li>Try different USB-C cables; low quality cables are often the source of problems. Note that the included OBD-C cable will not work.</li>
      </ul>
      <h3>Other questions</h3>
      <p>
        If you need help, join our <a href="https://discord.comma.ai" target="_blank" rel="noopener">Discord server</a> and go to
        the <strong>#hw-three-3x</strong> channel.
      </p>
    </section>

    <div class="version-info">
      <hr />
      flash.comma.ai version: <a href={`https://github.com/commaai/flash/tree/${version}`} target="_blank" rel="noopener"><code>{version}</code></a>
    </div>
  </main>

  <!-- Resizable divider -->
  <div 
    class="resize-handle"
    class:resizing={isResizing}
    on:mousedown={handleMouseDown}
    role="separator"
    aria-label="Resize panels"
    title="Drag to resize panels"
  >
    <div class="resize-handle-line"></div>
  </div>

  <!-- Flash Component -->
  <div 
    class="flash-panel bg-gray-100 dark:bg-gray-800"
    style="width: {100 - leftWidth}%"
  >
    <Flash />
  </div>
</div>

<style>
  .resizable-container {
    display: flex;
    height: 100vh;
    width: 100vw;
    overflow: hidden;
  }

  .main-panel {
    overflow-y: auto;
    padding: 3rem;
    min-width: 300px;
    position: relative;
  }

  .flash-panel {
    overflow: hidden;
    min-width: 300px;
    position: relative;
  }

  .resize-handle {
    width: 8px;
    background: linear-gradient(to right, 
      transparent 0%, 
      var(--border-color, #4b5563) 25%, 
      var(--border-color, #4b5563) 75%, 
      transparent 100%);
    cursor: col-resize;
    position: relative;
    transition: background 0.2s ease;
    flex-shrink: 0;
  }

  .resize-handle:hover,
  .resize-handle.resizing {
    background: linear-gradient(to right, 
      transparent 0%, 
      var(--accent-green, #51ff00) 25%, 
      var(--accent-green, #51ff00) 75%, 
      transparent 100%);
  }

  .resize-handle-line {
    position: absolute;
    top: 50%;
    left: 50%;
    width: 2px;
    height: 40px;
    background: currentColor;
    transform: translate(-50%, -50%);
    opacity: 0.5;
  }

  .resize-handle:hover .resize-handle-line,
  .resize-handle.resizing .resize-handle-line {
    opacity: 1;
    background: var(--accent-green, #51ff00);
  }

  .version-info {
    margin-top: 2rem;
  }

  /* Mobile responsiveness */
  @media (max-width: 768px) {
    .resizable-container {
      flex-direction: column;
      height: auto;
    }

    .main-panel {
      width: 100% !important;
      padding: 2rem;
    }

    .flash-panel {
      width: 100% !important;
      height: 500px;
    }

    .resize-handle {
      display: none;
    }
  }

  /* Ensure images don't overflow */
  .main-panel :global(img) {
    max-width: 100%;
    height: auto;
    display: block;
    margin: 1rem 0;
  }
</style>