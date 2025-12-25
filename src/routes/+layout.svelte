<script>
  import "./layout.css";
  import "@fontsource-variable/inter";
  import "@fontsource-variable/jetbrains-mono";
  import { setContext } from 'svelte';


  // Capture console logs for debug reports
  const consoleLogs = []
  const MAX_LOGS = 100
  const originalConsole = { log: console.log, warn: console.warn, error: console.error, info: console.info, debug: console.debug };
  ['log', 'warn', 'error', 'info', 'debug'].forEach(level => {
    console[level] = (...args) => {
      consoleLogs.push({ level, time: new Date().toISOString(), message: args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ') })
      if (consoleLogs.length > MAX_LOGS) consoleLogs.shift()
      originalConsole[level]?.(...args)
    }
  })

  setContext('captured-logs', consoleLogs);

  import comma from '$lib/images/comma.svg'
  import bolt from '$lib/images/bolt.svg'
  import cable from '$lib/images/cable.svg'
  import deviceExclamation from '$lib/images/device_exclamation_c3.svg'
  import deviceQuestion from '$lib/images/device_question_c3.svg'
  import done from '$lib/images/done.svg'
  import exclamation from '$lib/images/exclamation.svg'
  import systemUpdate from '$lib/images/system_update_c3.svg'
  import qdlPortsThree from '$lib/images/qdl-ports-three.svg'
  import qdlPortsFour from '$lib/images/qdl-ports-four.svg'
  import zadigCreateNewDevice from '$lib/images/zadig_create_new_device.png'
  import zadigForm from '$lib/images/zadig_form.png'
  import comma3XProduct from '$lib/images/comma3X.webp'
  import comma4Product from '$lib/images/four_screen_on.webp'

  // All images that need to be preloaded
  const preloadImages = [
    comma, bolt, cable, deviceExclamation, deviceQuestion, done, exclamation,
    systemUpdate, qdlPortsThree, qdlPortsFour, zadigCreateNewDevice, zadigForm,
    comma3XProduct, comma4Product
  ]

  let { children } = $props();
  let fontsLoaded = $state(false);

  // Explicitly load fonts before rendering to prevent FOUT
  async function loadFonts() {
    try {
      await Promise.all([
        document.fonts.load('16px "Inter Variable"'),
        document.fonts.load('16px "JetBrains Mono Variable"'),
      ]);
      fontsLoaded = true;
    } catch (error) {
      console.warn('Font preload failed:', error);
      fontsLoaded = true;
    }
  }

  $effect.pre(() => {
    loadFonts();
  })
</script>

<svelte:head>
  <link />
  {#each preloadImages as src}
    <link rel="preload" as="image" href={src}/>
  {/each}
</svelte:head>

{#if fontsLoaded}
  {@render children()}
{/if}
