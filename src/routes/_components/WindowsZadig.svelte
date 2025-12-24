<script>
  import zadigCreateNewDevice from '$lib/images/zadig_create_new_device.png'
  import zadigForm from '$lib/images/zadig_form.png'

  // Windows Zadig driver setup component
  const PRODUCT_ID = '9008'
  const vendorId = deviceType === DeviceType.COMMA_4 ? '3801' : '05C6'

  let { deviceType, onNext } = $props()

</script>

<div class="wizard-screen flex flex-col items-center justify-center h-full gap-6 p-8 overflow-y-auto">
  <div class="text-center">
    <h2 class="text-3xl font-bold mb-2">Install USB Driver</h2>
    <p class="text-xl text-gray-600">Windows requires a driver to communicate with your device</p>
  </div>

  <div class="max-w-2xl space-y-6 text-lg">
    <div class="flex gap-4">
      <span class="shrink-0 w-8 h-8 rounded-full bg-[#51ff00] text-black flex items-center justify-center font-bold text-base">1</span>
      <div >
        <p>Download and run <a href="https://zadig.akeo.ie/" target="_blank" rel="noopener noreferrer" class="text-blue-500 hover:underline font-semibold">Zadig</a></p>
      </div>
    </div>

    <div class="flex gap-4">
      <span class="shrink-0 w-8 h-8 rounded-full bg-[#51ff00] text-black flex items-center justify-center font-bold text-base">2</span>
      <div >
        <p class="mb-2">Under <code class="bg-gray-200 px-1 rounded">Device</code> in the menu bar, select <code class="bg-gray-200 px-1 rounded">Create New Device</code></p>
        <img src={zadigCreateNewDevice} alt="Zadig Create New Device" class="rounded-lg border border-gray-300" width={460} />
      </div>
    </div>

    <div class="flex gap-4">
      <span class="shrink-0 w-8 h-8 rounded-full bg-[#51ff00] text-black flex items-center justify-center font-bold text-base">3</span>
      <div >
        <p class="mb-2">Fill in the form:</p>
        <ul class="list-none space-y-1 ml-2 mb-2">
          <li><span class="text-gray-500 mr-2">a.</span>Name: <code class="bg-gray-200 px-1 rounded">{deviceType === DeviceType.COMMA_4 ? 'comma four' : 'comma 3/3X'}</code></li>
          <li><span class="text-gray-500 mr-2">b.</span>USB ID: <code class="bg-gray-200 px-1 rounded">{vendorId}</code> and <code class="bg-gray-200 px-1 rounded">{PRODUCT_ID}</code></li>
        </ul>
        <img src={zadigForm} alt="Zadig Form" class="rounded-lg border border-gray-300" width={460} />
      </div>
    </div>

    <div class="flex gap-4">
      <span class="shrink-0 w-8 h-8 rounded-full bg-[#51ff00] text-black flex items-center justify-center font-bold text-base">4</span>
      <div >
        <p>Click <code class="bg-gray-200 px-1 rounded">Install Driver</code></p>
      </div>
    </div>
  </div>

  <button
    onclick={onNext}
    class="px-8 py-3 text-xl font-semibold rounded-full bg-[#51ff00] hover:bg-[#45e000] active:bg-[#3acc00] text-black transition-colors"
  >
    Done
  </button>
</div>