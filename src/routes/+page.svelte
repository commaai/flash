<script>
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';
  import { isLinux, isWindows } from '$lib/utils/platform.js';
  import CopyText from '$lib/components/CopyText.svelte';
  
  // Lazy load Flash component
  let FlashComponent;
  let showFlashInterface = false;
  
  const version = import.meta.env.VITE_PUBLIC_GIT_SHA || 'dev';
  
  // Asset paths - using /src/assets/
  const commaLogo = '/src/assets/comma.svg';
  const qdlPortsImg = '/src/assets/qdl-ports.svg';
  const zadigCreateNewDevice = '/src/assets/zadig_create_new_device.png';
  const zadigForm = '/src/assets/zadig_form.png';
  
  // Constants
  const VENDOR_ID = '05C6';
  const PRODUCT_ID = '9008';
  const DETACH_SCRIPT = 'for d in /sys/bus/usb/drivers/qcserial/*-*; do [ -e "$d" ] && echo -n "$(basename $d)" | sudo tee /sys/bus/usb/drivers/qcserial/unbind > /dev/null; done';
  
  async function loadFlashComponent() {
    if (!FlashComponent) {
      try {
        const module = await import('$lib/components/Flash.svelte');
        FlashComponent = module.default;
        showFlashInterface = true;
      } catch (error) {
        console.error('Failed to load Flash component:', error);
      }
    } else {
      showFlashInterface = true;
    }
  }
  
  // Log version on client side
  onMount(() => {
    if (browser) {
      console.info(`flash.comma.ai version: ${version}`);
    }
  });
</script>

<svelte:head>
  <title>flash.comma.ai</title>
  <meta name="description" content="Update your comma device to the latest software" />
</svelte:head>

<div class="flex flex-col lg:flex-row flex-wrap">
  <!-- Instructions Panel -->
  <main class="p-12 md:p-16 lg:p-20 xl:p-24 w-screen max-w-none lg:max-w-prose lg:w-auto h-auto lg:h-screen lg:overflow-y-auto prose dark:prose-invert prose-green bg-white dark:bg-gray-900">
    
    <!-- Header Section -->
    <section>
      <img src={commaLogo} alt="comma" width="128" height="128" class="dark:invert" />
      <h1>flash.comma.ai</h1>
      <p>
        This tool allows you to flash AGNOS onto your comma device. AGNOS is the Ubuntu-based operating system for
        your <a href="https://comma.ai/shop/comma-3x" target="_blank">comma 3/3X</a>.
      </p>
    </section>
    
    <hr />
    
    <!-- Requirements Section -->
    <section>
      <h2>Requirements</h2>
      <ul>
        <li>
          A web browser which supports <a href="https://caniuse.com/webusb" target="_blank">WebUSB</a>
          {" "}(such as Google Chrome, Microsoft Edge, Opera), running on Windows, macOS, Linux, or Android.
        </li>
        <li>
          A good quality USB-C cable to connect the device to your computer. <span title="SuperSpeed">USB 3</span>
          {" "}is recommended for faster flashing speed.
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
            Download and run <a href="https://zadig.akeo.ie/" target="_blank">Zadig</a>.
          </li>
          <li>
            Under <code>Device</code> in the menu bar, select <code>Create New Device</code>.
            <img src={zadigCreateNewDevice} alt="Zadig Create New Device" width="575" height="254" />
          </li>
          <li>
            Fill in three fields. The first field is just a description and you can fill in anything. The next two
            fields are very important. Fill them in with <code>{VENDOR_ID}</code> and <code>{PRODUCT_ID}</code>
            respectively. Press &quot;Install Driver&quot; and give it a few minutes to install.
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
      
      <img 
        src={qdlPortsImg} 
        alt="comma three device with two ports - the lower port is labeled 1, the upper port is labeled 2" 
        width="450" 
        height="300" 
      />
      
      <p>Your device&apos;s screen will remain blank for the entire flashing process. This is normal.</p>
      
      {#if isLinux}
        <strong>Note for Linux users</strong>
        <p>
          On Linux systems, devices in QDL mode are automatically bound to the kernel&apos;s qcserial driver, and
          need to be unbound before we can access the device. Copy the script below into your terminal and run it
          after plugging in your device.
        </p>
        <CopyText text={DETACH_SCRIPT} />
      {/if}
      
      <p>
        Next, click the button to start flashing. From the prompt select the device which starts with
        &ldquo;QUSB_BULK&rdquo;.
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
        computer. If you&apos;re using a USB hub, try connecting directly to your computer instead.
      </p>
      
      <h3>My device&apos;s screen is blank</h3>
      <p>
        This is normal in QDL mode. You can verify that the &ldquo;QUSB_BULK&rdquo; device shows up when you press
        the Flash button to know that it is working correctly.
      </p>
      
      <h3>My device says &ldquo;fastboot mode&rdquo;</h3>
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
        If you need help, join our <a href="https://discord.comma.ai" target="_blank">Discord server</a> and go to
        the <strong>#hw-three-3x</strong> channel.
      </p>
    </section>

    <!-- Version info for desktop -->
    <div class="hidden lg:block">
      <hr />
      flash.comma.ai version: <code>{version}</code>
    </div>
  </main>

  <!-- Flash Interface Panel -->
  <div class="lg:flex-1 h-[700px] lg:h-screen bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
    {#if showFlashInterface && FlashComponent}
      <svelte:component this={FlashComponent} />
    {:else}
      <div class="flex flex-col items-center justify-center space-y-6">
        <!-- Large Green Pulsing Button -->
        <button 
          on:click={loadFlashComponent}
          class="relative w-48 h-48 bg-green-500 hover:bg-green-400 rounded-full flex items-center justify-center transition-colors group animate-pulse"
        >
          <!-- Lightning Bolt Icon -->
          <svg 
            class="w-20 h-20 text-gray-800" 
            fill="currentColor" 
            viewBox="0 0 24 24"
          >
            <path d="M13 0L0 12h7v12l13-12h-7V0z"/>
          </svg>
          
          <!-- Pulse Ring Animation -->
          <div class="absolute inset-0 rounded-full bg-green-500 animate-ping opacity-20"></div>
        </button>
        
        <!-- Text Below -->
        <p class="text-xl text-gray-700 dark:text-gray-300 font-medium">
          Tap to start
        </p>
      </div>
    {/if}
  </div>

  <!-- Version info for mobile -->
  <div class="w-screen max-w-none p-12 md:p-16 prose dark:prose-invert bg-white dark:bg-gray-900 lg:hidden">
    flash.comma.ai version: <code>{version}</code>
  </div>
</div>