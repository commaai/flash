<script>
  let { text } = $props();
</script>

<div class="relative text-sm">
  <pre class="font-mono pt-12">{text}</pre>
  <button
    class="absolute top-2 right-2 bg-blue-600 hover:bg-blue-500 active:bg-blue-300 transition-colors text-white p-1 rounded-md"
    onclick={() => navigator.clipboard.writeText(text)}
  >
    Copy
  </button>
</div>
