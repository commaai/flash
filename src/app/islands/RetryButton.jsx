export default function RetryButton({ error, handleRetry }) {
  return (
    error && (
      <button
        className="px-4 py-2 rounded-md bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 transition-colors"
        onClick={handleRetry}
      >
        Retry
      </button>
    )
  )
}
