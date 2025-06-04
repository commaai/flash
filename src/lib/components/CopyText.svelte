<script>
  export let text;
  
  function copyToClipboard() {
    navigator.clipboard.writeText(text);
  }
</script>

<div class="relative text-sm">
  <pre class="font-mono pt-12 bg-gray-100 dark:bg-gray-800 p-4 rounded overflow-x-auto">{text}</pre>
  <button
    class="absolute top-2 right-2 bg-blue-600 hover:bg-blue-500 active:bg-blue-300 transition-colors text-white p-2 rounded-md text-sm font-medium"
    on:click={copyToClipboard}
  >
    Copy
  </button>
</div>