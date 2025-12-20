// Stepper/breadcrumb component

<script>
  let { steps, currentStep, onStepClick } = $props();
</script>

<div class="absolute top-0 left-0 right-0 p-4 flex items-center justify-center gap-2">
  {#each steps as stepName, index (stepName)}
    {@const isCompleted = index < currentStep}
    {@const isCurrent = index === currentStep}
    {@const isClickable = index < currentStep}
    <div class="flex items-center">
      {#if index > 0}
        <div class={`w-8 h-0.5 mx-1 ${isCompleted ? 'bg-[#51ff00]' : 'bg-gray-300'}`}></div>
      {/if}
      <button
        onClick={() => isClickable && onStepClick(index)}
        disabled={!isClickable}
        class={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
          isCurrent
            ? 'bg-[#51ff00] text-black'
            : isCompleted
              ? 'bg-[#51ff00]/80 text-black hover:bg-[#51ff00] cursor-pointer'
              : 'bg-gray-200 text-gray-500 cursor-default'
        }`}
      >
        {#if isCompleted} 
          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        {/if}
        {stepName}
      </button>
    </div>
  {/each}
</div>