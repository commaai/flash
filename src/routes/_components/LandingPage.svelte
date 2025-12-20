// Landing page component
<script>
  import comma from "$/lib/images/comma.svg"
  let { onStart } = $props();
</script>

<div class="wizard-screen flex flex-col items-center justify-center h-full gap-8 p-8">
  <img src={comma} alt="comma" width={80} height={80} />
  <div class="text-center">
    <h1 class="text-4xl font-bold mb-4">flash.comma.ai</h1>
    <p class="text-xl text-gray-600 max-w-md">
      Restore your comma device to a fresh factory state
    </p>
  </div>
  <button
    onClick={onStart}
    class="px-12 py-4 text-2xl font-semibold rounded-full bg-[#51ff00] hover:bg-[#45e000] active:bg-[#3acc00] text-black transition-colors"
  >
    Start
  </button>
</div>