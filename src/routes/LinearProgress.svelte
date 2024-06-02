<script>
  let { value, barColor } = $props();
</script>

<div class="relative w-full h-2 bg-gray-200 rounded-full overflow-hidden">
  <div
    class="absolute top-0 bottom-0 left-0 w-full transition-all {barColor}"
    style="transform: translateX({value - 100}%)">
</div>
</div>