// Global manifest utility object
window.ManifestUtils = (function() {
    /**
     * Represents a partition image defined in the AGNOS manifest.
     * Image archives can be retrieved from archiveUrl.
     */
    class Image {
        constructor(json) {
            this.name = json.name;
            this.sparse = json.sparse;

            // before AGNOS 11 - flash alt skip-chunks image
            // after AGNOS 11  - flash main non-sparse image
            if (this.name === 'system' && this.sparse && json.alt) {
                this.checksum = json.alt.hash;
                this.fileName = `${this.name}-skip-chunks-${json.hash_raw}.img`;
                this.archiveUrl = json.alt.url;
                this.size = json.alt.size;
            } else {
                this.checksum = json.hash;
                this.fileName = `${this.name}-${json.hash_raw}.img`;
                this.archiveUrl = json.url;
                this.size = json.size;
            }

            this.archiveFileName = this.archiveUrl.split('/').pop();
        }
    }

    /**
     * Creates a manifest from JSON text
     * @param {string} text - The JSON text to parse
     * @returns {Image[]} Array of Image objects
     */
    function createManifest(text) {
        const expectedPartitions = ['aop', 'devcfg', 'xbl', 'xbl_config', 'abl', 'boot', 'system'];
        const partitions = JSON.parse(text).map((image) => new Image(image));

        // Sort into consistent order
        partitions.sort((a, b) => expectedPartitions.indexOf(a.name) - expectedPartitions.indexOf(b.name));

        // Check that all partitions are present
        const missingPartitions = expectedPartitions.filter((name) => !partitions.some((image) => image.name === name));
        if (missingPartitions.length > 0) {
            throw new Error(`Manifest is missing partitions: ${missingPartitions.join(', ')}`);
        }

        return partitions;
    }

    /**
     * Fetches and creates a manifest from a URL
     * @param {string} url - The URL to fetch the manifest from
     * @returns {Promise<Image[]>} Promise resolving to array of Image objects
     */
    function getManifest(url) {
        return fetch(url)
            .then((response) => response.text())
            .then(createManifest);
    }

    // Public API
    return {
        Image: Image,
        createManifest: createManifest,
        getManifest: getManifest
    };
})();
