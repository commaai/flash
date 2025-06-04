import { writable, derived } from 'svelte/store';
import { browser } from '$app/environment';

// Flash state stores
export const flashStep = writable(0);
export const flashError = writable(0);
export const flashProgress = writable(-1);
export const flashMessage = writable('');
export const deviceConnected = writable(false);
export const deviceSerial = writable('');

// Manager instances (lazy loaded)
export const flashManager = writable(null);
export const imageManager = writable(null);

// UI state
export const flashComponentLoaded = writable(false);

// Derived stores for computed values
export const isFlashReady = derived(
  [flashStep, flashError],
  ([$step, $error]) => $step === 1 && $error === 0
);

export const isFlashInProgress = derived(
  [flashStep],
  ([$step]) => $step > 1 && $step < 7
);

export const flashComplete = derived(
  [flashStep],
  ([$step]) => $step === 7
);

// Actions
export function resetFlashState() {
  flashStep.set(0);
  flashError.set(0);
  flashProgress.set(-1);
  flashMessage.set('');
  deviceConnected.set(false);
  deviceSerial.set('');
}

// Enhanced debugging version
export async function loadFlashManagers() {
  if (!browser) {
    console.log('Not in browser environment, skipping');
    return;
  }
  
  try {
    console.log('🚀 Starting to load flash managers...');
    
    // Test config import first
    console.log('📁 Testing config import...');
    const configModule = await import('$lib/utils/config.js');
    console.log('✅ Config loaded:', configModule);
    
    if (!configModule.default) {
      throw new Error('Config module has no default export');
    }
    const config = configModule.default;
    console.log('📋 Config data:', config);
    
    // Test manager import
    console.log('🔧 Testing manager import...');
    const managerModule = await import('$lib/flash/manager.js');
    console.log('✅ Manager module loaded:', managerModule);
    console.log('🏗️ Available exports:', Object.keys(managerModule));
    
    if (!managerModule.FlashManager) {
      throw new Error('FlashManager not found in manager module. Available exports: ' + Object.keys(managerModule).join(', '));
    }
    
    if (typeof managerModule.FlashManager !== 'function') {
      throw new Error('FlashManager is not a constructor function, it is: ' + typeof managerModule.FlashManager);
    }
    
    console.log('✅ FlashManager constructor found');
    console.log('📊 StepCode:', managerModule.StepCode);
    console.log('❌ ErrorCode:', managerModule.ErrorCode);
    
    // Test image import
    console.log('🖼️ Testing image import...');
    const imageModule = await import('$lib/flash/image.js');
    console.log('✅ Image module loaded:', imageModule);
    
    if (!imageModule.ImageManager) {
      throw new Error('ImageManager not found in image module. Available exports: ' + Object.keys(imageModule).join(', '));
    }
    
    if (typeof imageModule.ImageManager !== 'function') {
      throw new Error('ImageManager is not a constructor function, it is: ' + typeof imageModule.ImageManager);
    }
    
    console.log('✅ ImageManager constructor found');
    
    // Extract constructors
    const { FlashManager, StepCode, ErrorCode } = managerModule;
    const { ImageManager } = imageModule;
    
    // Test programmer binary fetch
    console.log('📡 Fetching programmer binary from:', config.loader.url);
    const programmerResponse = await fetch(config.loader.url);
    
    if (!programmerResponse.ok) {
      throw new Error(`Failed to fetch programmer: ${programmerResponse.status} ${programmerResponse.statusText}`);
    }
    
    const programmer = await programmerResponse.arrayBuffer();
    console.log('✅ Programmer loaded, size:', programmer.byteLength, 'bytes');

    // Create managers with enhanced logging
    console.log('🏭 Creating ImageManager...');
    const imgManager = new ImageManager();
    console.log('✅ ImageManager created');
    
    console.log('🏭 Creating FlashManager...');
    const flashMgr = new FlashManager(
      config.manifests.release,
      programmer,
      {
        onStepChange: (step) => {
          console.log('📈 Step changed:', step);
          flashStep.set(step);
        },
        onErrorChange: (error) => {
          console.log('❌ Error changed:', error);
          flashError.set(error);
        },
        onProgressChange: (progress) => {
          flashProgress.set(progress);
        },
        onMessageChange: (message) => {
          console.log('💬 Message:', message);
          flashMessage.set(message);
        },
        onConnectionChange: (connected) => {
          console.log('🔌 Connection changed:', connected);
          deviceConnected.set(connected);
        },
        onSerialChange: (serial) => {
          console.log('🔢 Serial changed:', serial);
          deviceSerial.set(serial);
        },
      }
    );
    console.log('✅ FlashManager created');

    console.log('⚙️ Initializing flash manager...');
    await flashMgr.initialize(imgManager);
    console.log('✅ Flash manager initialized');

    // Update stores
    flashManager.set(flashMgr);
    imageManager.set(imgManager);
    flashComponentLoaded.set(true);

    console.log('🎉 Flash managers loaded successfully!');
    return { flashMgr, imgManager, StepCode, ErrorCode };
    
  } catch (error) {
    console.error('💥 Failed to load flash managers:', error);
    console.error('📚 Error stack:', error.stack);
    
    // More specific error handling
    if (error.message.includes('not a constructor')) {
      console.error('🐛 This usually means the manager.js file is empty or missing exports');
    }
    
    flashError.set(-1);
    flashMessage.set(`Failed to load flash components: ${error.message}`);
    throw error;
  }
}