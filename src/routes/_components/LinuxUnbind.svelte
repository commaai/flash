<script>
  // Linux unbind component
  let { onNext } = $props()

  const DETACH_SCRIPT = 'for d in /sys/bus/usb/drivers/qcserial/*-*; do [ -e "$d" ] && echo -n "$(basename $d)" | sudo tee /sys/bus/usb/drivers/qcserial/unbind > /dev/null; done'

  let copied = $state(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(DETACH_SCRIPT)
    copied = true
    setTimeout(() => copied = false, 2000)
  }
</script>

<div class="wizard-screen flex flex-col items-center justify-center h-full gap-6 p-8">
  <div class="text-center">
    <h2 class="text-3xl font-bold mb-2">Unbind from qcserial</h2>
    <p class="text-xl text-gray-600 max-w-lg">
      On Linux, devices in QDL mode are bound to the kernel&apos;s qcserial driver.
      Run this command in a terminal to unbind it:
    </p>
  </div>

  <div class="relative w-full max-w-2xl">
    <pre class="bg-gray-900 text-gray-100 p-4 rounded-lg text-sm overflow-x-auto font-mono">
      {DETACH_SCRIPT}
    </pre>
    <button
      onClick={handleCopy}
      class="absolute top-2 right-2 px-3 py-1 bg-blue-600 hover:bg-blue-500 active:bg-blue-400 text-white text-sm rounded transition-colors"
    >
      {copied ? 'Copied!' : 'Copy'}
    </button>
  </div>

  <button
    onClick={onNext}
    class="px-8 py-3 text-xl font-semibold rounded-full bg-[#51ff00] hover:bg-[#45e000] active:bg-[#3acc00] text-black transition-colors"
  >
    Done
  </button>
</div>