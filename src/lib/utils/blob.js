export async function download(url) {
  const response = await fetch(url, { mode: 'cors' })
  const reader = response.body.getReader()
  const contentLength = +response.headers.get('Content-Length')
  console.debug('[blob] Downloading', url, contentLength)

  const chunks = []
 // let processed = 0
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    chunks.push(value)
    //processed += value.length
  }

  const blob = new Blob(chunks)
  console.debug('[blob] Downloaded', url, blob.size)
  if (blob.size !== contentLength) console.warn('[blob] Download size mismatch', {
    url,
    expected: contentLength,
    actual: blob.size,
  })

  return blob
}
