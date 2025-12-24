<script>
  // WebUSB connection screen - shows while waiting for user to select device
  import cable from '$lib/images/cable.svg'
  let { onConnect } = $props()
</script>

<div class="wizard-screen flex flex-col items-center justify-center h-full gap-6 p-8">
  <div class="p-8 rounded-full bg-yellow-500">
    <img src={cable} alt="connect" width={128} height={128} class="invert" />
  </div>
  <div class="text-center">
    <h2 class="text-3xl font-bold mb-2">Select your device</h2>
    <p class="text-xl text-gray-600 max-w-lg">
      Click the button below to open the device selector, then choose <code class="px-2 py-0.5 bg-[#51ff00] rounded font-mono text-black font-semibold">QUSB_BULK_CID</code> from the list.
    </p>
  </div>
  <button
    onclick={onConnect}
    class="px-8 py-3 text-xl font-semibold rounded-full bg-[#51ff00] hover:bg-[#45e000] active:bg-[#3acc00] text-black transition-colors"
  >
    Connect
  </button>
</div>