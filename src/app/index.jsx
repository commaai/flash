import { Suspense, lazy } from 'react'

const Flash = lazy(() => import('./Flash'))

export default function App() {
  const version = import.meta.env.VITE_PUBLIC_GIT_SHA || 'dev'
  console.info(`flash.comma.ai version: ${version}`)
  return (
    <div className="h-screen w-screen bg-gray-100 dark:bg-gray-800">
      <Suspense fallback={<p className="text-black dark:text-white p-8">Loading...</p>}>
        <Flash />
      </Suspense>
      <div className="absolute bottom-4 left-4 text-sm text-gray-500 dark:text-gray-400">
        <a href={`https://github.com/commaai/flash/tree/${version}`} target="_blank" className="hover:underline">
          {version}
        </a>
      </div>
    </div>
  )
}
