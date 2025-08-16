<!-- src/routes/+page.svelte -->
<script>
  import { onMount } from 'svelte';
  
  let currentStep = 'intro'; // 'intro', 'driver', 'flashing'
  let isConnected = false;
  let device = null;
  
  // WebUSB functionality
  async function startFlashing() {
    if (!navigator.usb) {
      alert('WebUSB is not supported in this browser. Please use Chrome, Edge, or Opera.');
      return;
    }
    
    try {
      // Request USB device access
      device = await navigator.usb.requestDevice({
        filters: [
          { vendorId: 0x05c6, productId: 0x9008 }, // Qualcomm download mode
          // Add other relevant vendor/product IDs for comma devices
        ]
      });
      
      currentStep = 'driver';
    } catch (error) {
      console.error('Failed to connect device:', error);
      alert('Failed to connect to device. Please ensure your device is connected and in download mode.');
    }
  }
  
  function showDriverInstructions() {
    currentStep = 'driver';
  }
  
  onMount(() => {
    // Check if WebUSB is supported
    if (!navigator.usb) {
      console.warn('WebUSB not supported');
    }
  });
</script>

<svelte:head>
  <title>flash.comma.ai</title>
  <meta name="description" content="Flash AGNOS onto your comma device" />
</svelte:head>

<div class="container">
  <div class="grid">
    
    <!-- Left Column - Instructions -->
    <div>
      
      <!-- Header -->
      <div class="section">
        <div class="logo">,</div>
        <h1 class="title">flash.comma.ai</h1>
        <p class="description">
          This tool allows you to flash AGNOS onto your comma device. 
          AGNOS is the Ubuntu-based operating system for your 
          <a href="#">comma 3/3X</a>.
        </p>
      </div>

      <!-- Requirements Section -->
      {#if currentStep === 'intro'}
        <div class="section section-divider">
          <h2 class="subtitle">Requirements</h2>
          
          <ul class="requirements-list space-y-sm">
            <li class="requirements-item">
              <div class="requirements-bullet"></div>
              <div>
                A web browser which supports 
                <a href="#">WebUSB</a> 
                (such as Google Chrome, Microsoft Edge, Opera), running on 
                Windows, macOS, Linux, or Android.
              </div>
            </li>
            
            <li class="requirements-item">
              <div class="requirements-bullet"></div>
              <div>
                A good quality USB-C cable to connect the device to your computer. 
                USB 3 is recommended for faster flashing speed.
              </div>
            </li>
          </ul>
        </div>
      {/if}

      <!-- USB Driver Instructions -->
      {#if currentStep === 'driver'}
        <div class="section">
          <h2 class="subtitle">USB Driver</h2>
          
          <p class="mb-6" style="color: var(--text-secondary);">
            You need additional driver software for Windows before you connect your device.
          </p>
          
          <ol class="steps-list">
            <li class="step-item">
              <span class="step-number">1.</span>
              <div class="step-content">
                Download and run <a href="#">Zadig</a>.
              </div>
            </li>
            
            <li class="step-item">
              <span class="step-number">2.</span>
              <div class="step-content">
                <div class="mb-2">
                  Under <code>Device</code> in the menu bar, select 
                  <code>Create New Device</code>.
                </div>
              </div>
            </li>
          </ol>
          
          <!-- Zadig Screenshot Placeholder -->
          <div class="screenshot">
            <div class="screenshot-placeholder">
              Zadig Interface Screenshot
            </div>
          </div>
          
          <ol class="steps-list" style="counter-reset: step-counter 2;">
            <li class="step-item">
              <span class="step-number">3.</span>
              <div class="step-content">
                <div class="mb-4">
                  Fill in three fields. The first field is just a description and you can 
                  fill in anything. The next two fields are very important. Fill them in with 
                  <code>05C6</code> and <code>9008</code> respectively. 
                  Press "Install Driver" and give it a few minutes to install.
                </div>
              </div>
            </li>
          </ol>
          
          <!-- Second Zadig Screenshot Placeholder -->
          <div class="screenshot">
            <div class="screenshot-placeholder screenshot-small">
              Zadig Driver Installation Screenshot
            </div>
          </div>
          
          <button 
            on:click={() => currentStep = 'flashing'}
            class="btn btn-secondary mt-6"
          >
            Continue to Flashing
          </button>
        </div>
      {/if}
    </div>

    <!-- Right Column - Flash Interface -->
    <div class="flash-interface">
      {#if currentStep === 'intro'}
        <div class="space-y">
          <div class="flash-icon">
            <svg fill="currentColor" viewBox="0 0 24 24">
              <path d="M7 2v11h3v9l7-12h-4l4-8z"/>
            </svg>
          </div>
          
          <h2 class="flash-title">Tap to start</h2>
          
          <button 
            on:click={startFlashing}
            class="btn btn-primary"
          >
            Start Flashing Process
          </button>
          
          {#if navigator.platform && navigator.platform.includes('Win')}
            <button 
              on:click={showDriverInstructions}
              class="btn-link"
            >
              Windows? Install drivers first
            </button>
          {/if}
        </div>
      {:else if currentStep === 'flashing'}
        <div class="space-y">
          <div class="flash-icon pulsing">
            <svg fill="currentColor" viewBox="0 0 24 24">
              <path d="M7 2v11h3v9l7-12h-4l4-8z"/>
            </svg>
          </div>
          
          <h2 class="flash-title">Ready to Flash</h2>
          <p class="flash-subtitle">Connect your comma device in download mode</p>
          
          <div class="space-y-sm">
            <button 
              on:click={startFlashing}
              class="btn btn-primary"
            >
              Connect Device
            </button>
            
            <button 
              on:click={() => currentStep = 'intro'}
              class="btn-link"
            >
              Back to Start
            </button>
          </div>
        </div>
      {/if}
    </div>
  </div>
</div>