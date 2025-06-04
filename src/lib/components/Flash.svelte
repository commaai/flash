<script>
  import { onMount } from 'svelte';
  import { 
    flashStep, 
    flashError, 
    flashProgress, 
    flashMessage, 
    deviceConnected, 
    deviceSerial,
    flashManager,
    isFlashReady,
    isFlashInProgress,
    flashComplete,
    loadFlashManagers,
    resetFlashState
  } from '$lib/stores/flash.js';
  
  let StepCode = {};
  let ErrorCode = {};
  let loading = true;
  let initialized = false;
  
  // Step names for UI
  const stepNames = {
    0: 'Initializing',
    1: 'Ready',
    2: 'Connecting',
    3: 'Repairing partition tables',
    4: 'Erasing device',
    5: 'Flashing system',
    6: 'Finalizing',
    7: 'Complete'
  };
  
  // Error messages for UI
  const errorMessages = {
    [-1]: 'Unknown error occurred',
    [0]: '',
    [1]: 'Browser requirements not met',
    [2]: 'Not enough storage space',
    [3]: 'Unrecognized device',
    [4]: 'Lost connection to device',
    [5]: 'Failed to repair partition tables',
    [6]: 'Failed to erase device',
    [7]: 'Failed to flash system',
    [8]: 'Failed to finalize'
  };
  
  // Initialize flash managers on component mount
  onMount(async () => {
    try {
      const managers = await loadFlashManagers();
      StepCode = managers.StepCode;
      ErrorCode = managers.ErrorCode;
      initialized = true;
    } catch (error) {
      console.error('Failed to initialize flash managers:', error);
    } finally {
      loading = false;
    }
  });
  
  async function startFlash() {
    if (!$flashManager || !$isFlashReady) return;
    
    try {
      await $flashManager.start();
    } catch (error) {
      console.error('Flash failed:', error);
    }
  }
  
  function restart() {
    resetFlashState();
    if ($flashManager) {
      $flashManager.initialize($flashManager.imageManager);
    }
  }
  
  // Reactive statements for computed values
  $: currentStepName = stepNames[$flashStep] || 'Unknown';
  $: currentErrorMessage = errorMessages[$flashError] || 'Unknown error';
  $: progressPercentage = $flashProgress >= 0 ? Math.round($flashProgress * 100) : 0;
  $: showProgress = $flashProgress >= 0 && $isFlashInProgress;
</script>

<div class="h-full flex flex-col">
  {#if loading}
    <div class="flex-1 flex items-center justify-center">
      <div class="text-center">
        <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p class="text-gray-600 dark:text-gray-400">Loading flash components...</p>
      </div>
    </div>
  {:else if !initialized}
    <div class="flex-1 flex items-center justify-center">
      <div class="text-center text-red-600">
        <p class="text-lg font-medium mb-2">Failed to Initialize</p>
        <p class="text-sm">Could not load flash components</p>
      </div>
    </div>
  {:else}
    <!-- Flash Interface -->
    <div class="flex-1 flex flex-col p-6">
      
      <!-- Status Header -->
      <div class="mb-6">
        <h2 class="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          Device Flash Tool
        </h2>
        
        {#if $deviceConnected && $deviceSerial}
          <div class="bg-green-100 dark:bg-green-900 border border-green-400 text-green-700 dark:text-green-300 px-4 py-2 rounded">
            Device connected: {$deviceSerial}
          </div>
        {/if}
      </div>
      
      <!-- Current Step -->
      <div class="mb-6">
        <div class="flex items-center justify-between mb-2">
          <span class="text-lg font-medium text-gray-900 dark:text-white">
            {currentStepName}
          </span>
          {#if $flashStep > 0}
            <span class="text-sm text-gray-500">
              Step {$flashStep} of 7
            </span>
          {/if}
        </div>
        
        <!-- Progress Bar -->
        {#if showProgress}
          <div class="w-full bg-gray-200 rounded-full h-2.5 dark:bg-gray-700">
            <div 
              class="bg-blue-600 h-2.5 rounded-full transition-all duration-300" 
              style="width: {progressPercentage}%"
            ></div>
          </div>
          <div class="text-right text-sm text-gray-500 mt-1">
            {progressPercentage}%
          </div>
        {/if}
      </div>
      
      <!-- Flash Message -->
      {#if $flashMessage}
        <div class="mb-6 p-4 bg-blue-50 dark:bg-blue-900 border border-blue-200 dark:border-blue-700 rounded">
          <p class="text-blue-800 dark:text-blue-200">{$flashMessage}</p>
        </div>
      {/if}
      
      <!-- Error Display -->
      {#if $flashError !== 0}
        <div class="mb-6 p-4 bg-red-50 dark:bg-red-900 border border-red-200 dark:border-red-700 rounded">
          <p class="text-red-800 dark:text-red-200 font-medium">Error</p>
          <p class="text-red-700 dark:text-red-300">{currentErrorMessage}</p>
        </div>
      {/if}
      
      <!-- Action Buttons -->
      <div class="mt-auto space-y-3">
        {#if $flashComplete}
          <button 
            on:click={restart}
            class="w-full bg-green-600 hover:bg-green-700 text-white font-medium py-3 px-4 rounded-lg transition-colors"
          >
            Flash Another Device
          </button>
        {:else if $flashError !== 0}
          <button 
            on:click={restart}
            class="w-full bg-gray-600 hover:bg-gray-700 text-white font-medium py-3 px-4 rounded-lg transition-colors"
          >
            Try Again
          </button>
        {:else if $isFlashReady}
          <button 
            on:click={startFlash}
            class="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-lg transition-colors"
          >
            Start Flash Process
          </button>
        {:else if $isFlashInProgress}
          <button 
            disabled
            class="w-full bg-gray-400 text-white font-medium py-3 px-4 rounded-lg cursor-not-allowed"
          >
            Flashing in Progress...
          </button>
        {:else}
          <button 
            disabled
            class="w-full bg-gray-400 text-white font-medium py-3 px-4 rounded-lg cursor-not-allowed"
          >
            Initializing...
          </button>
        {/if}
        
        <!-- Progress indicator for long operations -->
        {#if $isFlashInProgress}
          <div class="text-center text-sm text-gray-500">
            <p>Do not unplug your device during this process</p>
            <p>This can take 30+ minutes depending on your connection</p>
          </div>
        {/if}
      </div>
    </div>
  {/if}
</div>