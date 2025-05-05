import React from 'react'

export default function App() {
  const version = import.meta.env.VITE_PUBLIC_GIT_SHA || 'dev'
  console.info(`flash.comma.ai version: ${version}`)

  return (
    <div className="w-full h-screen flex flex-col">
      <div className="flex-1 w-full h-full">
        <iframe
          src="https://flash-4fy.pages.dev/"
          title="flash.comma.ai"
          className="w-full h-full border-0"
          allow="usb"
          sandbox="allow-same-origin allow-scripts allow-forms allow-downloads allow-modals allow-popups allow-presentation"
        />
      </div>
      <div className="p-4 text-center bg-white dark:bg-gray-900 text-black dark:text-white">
        flash.comma.ai version: <code>{version}</code>
      </div>
    </div>
  )
}
