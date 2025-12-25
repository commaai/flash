<script>
  // Debug info component for error reporting
  import { ErrorCode, StepCode, DeviceType } from "$lib/utils/manager";
  import { isLinux } from "$lib/utils/platform"
  import { getContext } from 'svelte';
  
  let { error, step, selectedDevice, serial, message, onclose } = $props();

  const consoleLogs = getContext('captured-logs')

  let copied  = $state(false);

  const getDebugReport = () => {
    const deviceName = selectedDevice === DeviceType.COMMA_4 ? 'comma four' : selectedDevice === DeviceType.COMMA_3 ? 'comma 3/3X' : 'unknown'
    const errorName = Object.keys(ErrorCode).find(k => ErrorCode[k] === error) || 'UNKNOWN'
    const stepName = Object.keys(StepCode).find(k => StepCode[k] === step) || 'UNKNOWN'
    // Get detailed OS info
    const ua = navigator.userAgent
    let os = 'Unknown'
    if (ua.includes('Windows NT 10.0')) os = 'Windows 10/11'
    else if (ua.includes('Windows NT 6.3')) os = 'Windows 8.1'
    else if (ua.includes('Windows NT 6.2')) os = 'Windows 8'
    else if (ua.includes('Windows NT 6.1')) os = 'Windows 7'
    else if (ua.includes('Mac OS X')) {
      const match = ua.match(/Mac OS X (\d+[._]\d+[._]?\d*)/)
      os = match ? `macOS ${match[1].replace(/_/g, '.')}` : 'macOS'
    } else if (ua.includes('Linux')) {
      os = 'Linux'
      if (ua.includes('Ubuntu')) os += ' (Ubuntu)'
      else if (ua.includes('Fedora')) os += ' (Fedora)'
      else if (ua.includes('Debian')) os += ' (Debian)'
    } else if (ua.includes('CrOS')) os = 'ChromeOS'

    // Detect sandboxed browsers
    const sandboxHints = []
    if (ua.includes('snap')) sandboxHints.push('Snap')
    if (ua.includes('Flatpak')) sandboxHints.push('Flatpak')
    if (navigator.userAgentData?.brands?.some(b => b.brand.includes('snap'))) sandboxHints.push('Snap')
    // Snap Chrome often has restricted /dev access which breaks WebUSB
    if (isLinux && !navigator.usb) sandboxHints.push('WebUSB unavailable - possibly sandboxed')
    const sandbox = sandboxHints.length ? sandboxHints.join(', ') : 'None detected'

    return `## Bug Report - flash.comma.ai

**Device:** ${deviceName}
**Serial:** ${serial || 'N/A'}
**Error:** ${errorName}
**Step:** ${stepName}
**Last Message:** ${message || 'N/A'}

**OS:** ${os}
**Sandbox:** ${sandbox}
**Browser:** ${navigator.userAgent}
**URL:** ${window.location.href}
**Time:** ${new Date().toISOString()}

<details>
<summary>Console Logs</summary>

\`\`\`
${consoleLogs.slice(-30).map(l => `[${l.time}] [${l.level}] ${l.message}`).join('\n')}
\`\`\`

</details>
`
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(getDebugReport())
    copied = true;
    setTimeout(() => copied = false, 2000)
  }

</script>

<div class="mt-6 w-full max-w-xl mx-4 p-4 bg-gray-100 rounded-lg text-left text-sm overflow-hidden">
  <div class="flex justify-between items-start mb-3 gap-2">
    <p class="text-gray-600 text-sm">
      Copy this debug info and paste it in{' '}
      <a href="https://discord.comma.ai" target="_blank" rel="noopener noreferrer" class="text-blue-500 hover:underline">Discord</a>
      {' '}or{' '}
      <a href="https://github.com/commaai/flash/issues/new" target="_blank" rel="noopener noreferrer" class="text-blue-500 hover:underline">GitHub Issues</a>.
    </p>
    {#if onclose}
      <button
        onclick={onclose}
        class="text-gray-400 hover:text-gray-600 shrink-0"
        title="Hide debug info"
      >
        <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    {/if}
  </div>
  <pre class="bg-gray-900 text-gray-100 p-3 rounded text-xs overflow-x-auto max-h-32 sm:max-h-48 font-mono debug-scrollbar whitespace-pre-wrap break-all">{getDebugReport()}</pre>
  <button
    onclick={handleCopy}
    class="mt-3 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm rounded transition-colors"
  >
    {copied ? 'Copied!' : 'Copy Debug Info'}
  </button>
</div>