// Constants
const Step = {
    INITIALIZING: 0,
    READY: 1,
    CONNECTING: 2,
    DOWNLOADING: 3,
    UNPACKING: 4,
    FLASHING: 6,
    ERASING: 7,
    DONE: 8
};

const Error = {
    UNKNOWN: -1,
    NONE: 0,
    UNRECOGNIZED_DEVICE: 1,
    LOST_CONNECTION: 2,
    DOWNLOAD_FAILED: 3,
    UNPACK_FAILED: 4,
    CHECKSUM_MISMATCH: 5,
    FLASH_FAILED: 6,
    ERASE_FAILED: 7,
    REQUIREMENTS_NOT_MET: 8
};

// UI States configuration
const UI_STATES = {
    initializing: {
        icon: 'src/assets/cloud.svg',
        text: 'Initializing...',
        description: '',
        bgColor: '#9ca3af'
    },
    ready: {
        icon: 'src/assets/bolt.svg',
        text: 'Ready',
        description: 'Tap the button above to begin',
        bgColor: '#51ff00'
    },
    connecting: {
        icon: 'src/assets/cable.svg',
        text: 'Waiting for connection',
        description: 'Follow the instructions to connect your device',
        bgColor: '#eab308'
    },
    downloading: {
        icon: 'src/assets/cloud_download.svg',
        text: 'Downloading...',
        description: 'Do not unplug your device',
        bgColor: '#3b82f6'
    },
    flashing: {
        icon: 'src/assets/system_update_c3.svg',
        text: 'Flashing device...',
        description: 'Do not unplug your device until the process is complete.',
        bgColor: '#84cc16'
    },
    done: {
        icon: 'src/assets/done.svg',
        text: 'Done',
        description: 'Your device has been updated successfully.',
        bgColor: '#22c55e'
    }
};

const ERROR_STATES = {
    requirements_not_met: {
        icon: 'src/assets/exclamation.svg',
        text: 'Requirements not met',
        description: 'Your system does not meet the requirements to flash your device.',
        bgColor: '#ef4444'
    },
    unrecognized_device: {
        icon: 'src/assets/device_question_c3.svg',
        text: 'Unrecognized device',
        description: 'The device connected to your computer is not supported.',
        bgColor: '#eab308'
    },
    lost_connection: {
        icon: 'src/assets/cable.svg',
        text: 'Lost connection',
        description: 'The connection to your device was lost. Check your cables and try again.',
        bgColor: '#ef4444'
    },
    flash_failed: {
        icon: 'src/assets/device_exclamation_c3.svg',
        text: 'Flash failed',
        description: 'The system image could not be flashed to your device.',
        bgColor: '#ef4444'
    }
};

class FlashApp {
    constructor() {
        this.step = Step.INITIALIZING;
        this.error = Error.NONE;
        this.progress = -1;
        this.message = '';
        this.connected = false;
        this.serial = null;
        
        // Cache jQuery selectors
        this.$flash = $('#flash');
        this.$statusIcon = $('.status-icon');
        this.$progressContainer = $('.progress-container');
        this.$progressBar = $('.progress-bar');
        this.$statusText = $('.status-text');
        this.$statusDesc = $('.status-description');
        this.$retryButton = $('.retry-button');
        this.$deviceState = $('.device-state');
        
        this.bindEvents();
        this.initialize();
    }

    bindEvents() {
        this.$statusIcon.on('click', () => {
            if (this.step === Step.READY) {
                this.startConnection();
            }
        });

        this.$retryButton.on('click', () => {
            window.location.reload();
        });

        // Prevent leaving page during flash
        $(window).on('beforeunload', (e) => {
            if (Step.DOWNLOADING <= this.step && this.step <= Step.ERASING) {
                e.preventDefault();
                return 'Flash in progress. Are you sure you want to leave?';
            }
        });
    }

    async initialize() {
        try {
            // Check browser requirements
            if (typeof navigator.usb === 'undefined') {
                throw new Error('WebUSB not supported');
            }

            // Check configuration
            if (!window.AppConfig || !window.AppConfig.manifests) {
                throw new Error('Configuration not loaded');
            }

            // Initialize QDL device
            if (typeof window.qdlDevice !== 'undefined') {
                this.qdl = new window.qdlDevice();
            } else {
                throw new Error('QDL support not available');
            }

            // Load manifest
            const manifestUrl = window.AppConfig.manifests.release;
            try {
                console.debug('[QDL] Downloading manifest from', manifestUrl);
                const manifestBlob = await window.BlobUtils.download(manifestUrl);
                const manifestText = await manifestBlob.text();
                console.debug('[QDL] Manifest content:', manifestText);
                
                try {
                    this.manifest = window.ManifestUtils.createManifest(manifestText);
                    if (!Array.isArray(this.manifest) || this.manifest.length === 0) {
                        throw new Error('Invalid manifest format');
                    }
                    console.debug('[QDL] Parsed manifest:', this.manifest);
                    this.updateUI('ready');
                } catch (parseErr) {
                    console.error('[QDL] Manifest parse error:', parseErr);
                    throw new Error(`Failed to parse manifest: ${parseErr.message}`);
                }
            } catch (manifestErr) {
                console.error('[QDL] Manifest download/parse error:', manifestErr);
                throw new Error(`Failed to load manifest: ${manifestErr.message}`);
            }
        } catch (err) {
            console.error('[QDL] Initialization error:', err);
            this.handleError('requirements_not_met');
        }
    }

    async startConnection() {
        this.updateUI('connecting');
        try {
            await this.qdl.connect();
            const [slotCount, partitions] = await this.qdl.getDevicePartitionsInfo();
            
            if (!this.isRecognizedDevice(slotCount, partitions)) {
                this.handleError('unrecognized_device');
                return;
            }

            this.serial = this.qdl.sahara.serial || 'unknown';
            this.connected = true;
            this.updateDeviceState();
            
            await this.startFlashing();
        } catch (err) {
            console.error('[QDL] Connection error:', err);
            this.handleError('lost_connection');
        }
    }

    async startFlashing() {
        this.updateUI('downloading');
        try {
            // Download and flash process
            for (const image of this.manifest) {
                this.$statusText.text(`Downloading ${image.name}...`);
                const blob = await window.BlobUtils.download(image.archiveUrl);
                
                this.updateUI('flashing');
                this.$statusText.text(`Flashing ${image.name}...`);
                await this.qdl.flashBlob(image.name, blob, (progress) => {
                    this.updateProgress(progress);
                });
            }
            
            this.updateUI('done');
        } catch (err) {
            console.error('[QDL] Flash error:', err);
            this.handleError('flash_failed');
        }
    }

    updateUI(state) {
        const uiState = UI_STATES[state];
        if (!uiState) return;

        this.$statusIcon
            .find('img')
            .attr('src', uiState.icon)
            .toggleClass('animate-pulse', state !== 'done' && !this.error);
        
        this.$statusIcon.css('background-color', uiState.bgColor);
        this.$statusText.text(uiState.text);
        this.$statusDesc.text(uiState.description);
    }

    updateProgress(value) {
        if (value === -1) {
            this.$progressContainer.css('opacity', 0);
        } else {
            this.$progressContainer.css('opacity', 1);
            this.$progressBar.css('transform', `translateX(${(value * 100 - 100)}%)`);
        }
    }

    updateDeviceState() {
        if (this.connected) {
            this.$deviceState.show().find('.serial-number').text(this.serial);
        } else {
            this.$deviceState.hide();
        }
    }

    handleError(type) {
        const errorState = ERROR_STATES[type];
        if (!errorState) return;

        this.$statusIcon
            .find('img')
            .attr('src', errorState.icon)
            .removeClass('animate-pulse');
        
        this.$statusIcon.css('background-color', errorState.bgColor);
        this.$statusText.text(errorState.text);
        this.$statusDesc.text(errorState.description);
        this.$retryButton.show();
    }

    isRecognizedDevice(slotCount, partitions) {
        if (slotCount !== 2) {
            console.error('[QDL] Unrecognised device (slotCount)');
            return false;
        }

        const expectedPartitions = [
            "ALIGN_TO_128K_1", "ALIGN_TO_128K_2", "ImageFv", "abl", "aop", "apdp", "bluetooth",
            "boot", "cache", "cdt", "cmnlib", "cmnlib64", "ddr", "devcfg", "devinfo", "dip",
            "dsp", "fdemeta", "frp", "fsc", "fsg", "hyp", "keymaster", "keystore", "limits",
            "logdump", "logfs", "mdtp", "mdtpsecapp", "misc", "modem", "modemst1", "modemst2",
            "msadp", "persist", "qupfw", "rawdump", "sec", "splash", "spunvm", "ssd", "sti",
            "storsec", "system", "systemrw", "toolsfv", "tz", "userdata", "vm-linux",
            "vm-system", "xbl", "xbl_config"
        ];

        return partitions.every(partition => expectedPartitions.includes(partition));
    }
}

// Initialize when document is ready
$(document).ready(() => {
    new FlashApp();
});
