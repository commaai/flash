export default function Title({ status, message, error, progress }) {
  let title = status

  if (message && !error) {
    title = message + '...'
    if (progress >= 0) {
      title += ` (${(progress * 100).toFixed(0)}%)`
    }
  }

  return title
}
