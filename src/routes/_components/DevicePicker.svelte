<script>
  // Device picker component
  import comma3XProduct from '$lib/images/comma3X.webp'
  import comma4Product from '$lib/images/four_screen_on.webp'

  import { DeviceType } from "$lib/utils/manager"
  
  let { onSelect } = $props()

  let selected = $state(null)

</script>

<div class="wizard-screen flex flex-col items-center justify-center h-full gap-8 p-8">
  <div class="text-center">
    <h2 class="text-3xl font-bold mb-2">Which device are you flashing?</h2>
    <p class="text-xl text-gray-600">Select your comma device</p>
  </div>

  <div class="flex flex-col sm:flex-row gap-6">
    <button
      onclick={() => selected = DeviceType.COMMA_3}
      class={`flex flex-col items-center gap-4 px-8 py-6 rounded-xl border-2 transition-colors ${
        selected === DeviceType.COMMA_3
          ? 'border-[#51ff00] bg-[#51ff00]/10'
          : 'border-gray-300 hover:border-gray-400'
      }`}
    >
      <img src={comma3XProduct} alt="comma three or comma 3X" class="h-32 object-contain" />
      <span class="text-xl font-semibold">comma three<br/>comma 3X</span>
    </button>

    <button
      onclick={() => selected = DeviceType.COMMA_4}
      class={`flex flex-col items-center gap-4 px-8 py-6 rounded-xl border-2 transition-colors ${
        selected === DeviceType.COMMA_4
          ? 'border-[#51ff00] bg-[#51ff00]/10'
          : 'border-gray-300 hover:border-gray-400'
      }`}
    >
      <img src={comma4Product} alt="comma four" class="h-32 object-contain" />
      <span class="text-xl font-semibold">comma four</span>
    </button>
  </div>

  <button
    onclick={() => selected && onSelect(selected)}
    disabled={!selected}
    class={`px-8 py-3 text-xl font-semibold rounded-full transition-colors ${
      selected
        ? 'bg-[#51ff00] hover:bg-[#45e000] active:bg-[#3acc00] text-black'
        : 'bg-gray-300 text-gray-500 cursor-not-allowed'
    }`}
  >
    Next
  </button>
</div>