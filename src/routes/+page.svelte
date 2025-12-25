<script>
  import Flash from './Flash.svelte'
  import CommaIcon from "$lib/icons/CommaIcon"
  import GitHubIcon from "$lib/icons/GitHubIcon"
  import DiscordIcon from "$lib/icons/DiscordIcon"

  const version = import.meta.env.VITE_PUBLIC_GIT_SHA || 'dev'
  console.info(`flash.comma.ai version: ${version}`)
</script>

<div class="h-screen w-screen bg-gray-100">
  <Flash />
  <div class="absolute top-4 right-4 flex items-center gap-6">
    <a href="https://comma.ai" target="_blank" rel="noopener noreferrer" title="comma.ai" class="text-gray-400 hover:text-[#51ff00] transition-colors">
      <CommaIcon class="w-12 h-12" />
    </a>
    <a href="https://discord.comma.ai" target="_blank" rel="noopener noreferrer" title="Discord" class="text-gray-400 hover:text-[#51ff00] transition-colors">
      <DiscordIcon class="w-12 h-12" />
    </a>
    <a href="https://github.com/commaai/flash" target="_blank" rel="noopener noreferrer" title="GitHub" class="text-gray-400 hover:text-[#51ff00] transition-colors">
      <GitHubIcon class="w-12 h-12" />
    </a>
  </div>
  <div class="absolute bottom-4 left-4 text-sm text-gray-500">
    <a href={`https://github.com/commaai/flash/tree/${version}`} target="_blank" class="hover:underline">
      {version}
    </a>
  </div>
</div>
