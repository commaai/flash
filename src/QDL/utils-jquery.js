// Global QDL utilities object
window.QDLUtils = (function() {
    function concatUint8Array(arrays) {
        const totalLength = arrays.reduce((acc, value) => acc + value.length, 0);
        const result = new Uint8Array(totalLength);
        let offset = 0;
        for (const array of arrays) {
            result.set(array, offset);
            offset += array.length;
        }
        return result;
    }

    function containsBytes(needle, haystack) {
        const needleBytes = new TextEncoder().encode(needle);
        for (let i = 0; i <= haystack.length - needleBytes.length; i++) {
            let found = true;
            for (let j = 0; j < needleBytes.length; j++) {
                if (haystack[i + j] !== needleBytes[j]) {
                    found = false;
                    break;
                }
            }
            if (found) return true;
        }
        return false;
    }

    async function runWithTimeout(promise, timeout) {
        let timeoutId;
        const timeoutPromise = new Promise((_, reject) => {
            timeoutId = setTimeout(() => {
                reject(new Error(`Operation timed out after ${timeout}ms`));
            }, timeout);
        });

        try {
            const result = await Promise.race([promise, timeoutPromise]);
            clearTimeout(timeoutId);
            return result;
        } catch (error) {
            clearTimeout(timeoutId);
            throw error;
        }
    }

    // Public API
    return {
        concatUint8Array: concatUint8Array,
        containsBytes: containsBytes,
        runWithTimeout: runWithTimeout
    };
})();
