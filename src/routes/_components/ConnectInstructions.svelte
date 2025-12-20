<script>
  // Connect instructions component - shows how to physically connect the device

  import qdlPortsThree from '$lib/images/qdl-ports-three.svg'
  import qdlPortsFour from '$lib/images/qdl-ports-four.svg'

  let { deviceType, onNext } = $props();
</script>

<div class="wizard-screen flex flex-col items-center justify-center h-full gap-6 p-8">
  <div class="text-center">
    <h2 class="text-3xl font-bold mb-2">Connect your device</h2>
    <p class="text-xl text-gray-600">Follow these steps to prepare your device for flashing</p>
  </div>

  <div class="flex flex-col md:flex-row gap-8 items-center">
    <img
      src={isCommaFour ? qdlPortsFour : qdlPortsThree}
      alt={isCommaFour ? "comma four ports" : "comma three and 3X ports"}
      class="h-48"
    />

    <ol class="text-left space-y-3 text-lg">
      <li class="flex gap-3">
        <span class="shrink-0 w-7 h-7 rounded-full bg-[#51ff00] text-black flex items-center justify-center font-bold text-sm">A</span>
        <span>Unplug the device</span>
      </li>
      {#if !isCommaFour}
        <li class="flex gap-3">
          <span class="shrink-0 w-7 h-7 rounded-full bg-[#51ff00] text-black flex items-center justify-center font-bold text-sm">B</span>
          <span>Wait for the light on the back to fully turn off</span>
        </li>
      {/if}
      <li class="flex gap-3">
        <span class="shrink-0 w-7 h-7 rounded-full bg-[#51ff00] text-black flex items-center justify-center font-bold text-sm">{isCommaFour ? 'B' : 'C'}</span>
        <span>Connect <strong>port 1</strong> to your computer</span>
      </li>
      <li class="flex gap-3">
        <span class="shrink-0 w-7 h-7 rounded-full bg-[#51ff00] text-black flex items-center justify-center font-bold text-sm">{isCommaFour ? 'C' : 'D'}</span>
        <span>Connect <strong>port 2</strong> to your computer or a power brick</span>
      </li>
    </ol>
  </div>

  <p class="text-gray-500 text-xl">
    Your device&apos;s screen will remain blank. This is normal.
  </p>

  <button
    onClick={onNext}
    class="px-8 py-3 text-xl font-semibold rounded-full bg-[#51ff00] hover:bg-[#45e000] active:bg-[#3acc00] text-black transition-colors"
  >
    Next
  </button>
</div>