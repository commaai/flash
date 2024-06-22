import { Suspense, lazy } from 'preact/compat'

const Flash = lazy(() => import('./Flash'))

export default function LazyFlash() {
    return (
        <div className="lg:flex-1 h-[700px] lg:h-screen bg-gray-100 dark:bg-gray-800">
            <Suspense fallback={<p className="text-black dark:text-white">Loading...</p>}>
                <Flash />
            </Suspense>
      </div>
    )
}