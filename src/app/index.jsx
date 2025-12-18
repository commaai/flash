import Flash from './Flash'

function DiscordIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
    </svg>
  )
}

function GitHubIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0 1 12 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z" />
    </svg>
  )
}

function CommaIcon({ className }) {
  return (
    <svg className={className} viewBox="6 7 34 34" fill="currentColor">
      <path fillRule="evenodd" clipRule="evenodd" d="M16.6964 40C16.6964 39.2596 16.6385 38.6393 16.7236 38.0415C16.7599 37.7865 17.0575 37.5135 17.3001 37.3595C18.4832 36.6087 19.7684 36.0092 20.8699 35.1481C24.4378 32.3587 26.5526 28.6866 26.6682 23.9166C26.7009 22.5622 26.203 22.2238 25.0654 22.7514C21.7817 24.2746 18.2505 23.3815 16.3659 20.5509C14.3107 17.4636 14.6001 13.3531 17.0626 10.6562C20.2079 7.21156 25.3833 7.10849 28.9522 10.3982C31.09 12.3688 32.1058 14.9132 32.3591 17.8074C33.2084 27.5032 28.3453 35.495 19.4941 39.0057C18.6181 39.353 17.7198 39.6382 16.6964 40Z" />
    </svg>
  )
}

export default function App() {
  const version = import.meta.env.VITE_PUBLIC_GIT_SHA || 'dev'
  console.info(`flash.comma.ai version: ${version}`)
  return (
    <div className="h-screen w-screen bg-gray-100">
      <Flash />
      <div className="absolute top-4 right-4 flex items-center gap-6">
        <a href="https://comma.ai" target="_blank" rel="noopener noreferrer" title="comma.ai" className="text-gray-400 hover:text-[#51ff00] transition-colors">
          <CommaIcon className="w-12 h-12" />
        </a>
        <a href="https://discord.comma.ai" target="_blank" rel="noopener noreferrer" title="Discord" className="text-gray-400 hover:text-[#51ff00] transition-colors">
          <DiscordIcon className="w-12 h-12" />
        </a>
        <a href="https://github.com/commaai/flash" target="_blank" rel="noopener noreferrer" title="GitHub" className="text-gray-400 hover:text-[#51ff00] transition-colors">
          <GitHubIcon className="w-12 h-12" />
        </a>
      </div>
      <div className="absolute bottom-4 left-4 text-sm text-gray-500">
        <a href={`https://github.com/commaai/flash/tree/${version}`} target="_blank" className="hover:underline">
          {version}
        </a>
      </div>
    </div>
  )
}
