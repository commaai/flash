export async function download(url: string) {
  const response = await fetch(url, { mode: "cors" });
  const reader = response.body!.getReader();
  const contentLength = +response.headers.get("Content-Length")!;
  console.debug("[blob] Downloading", url, contentLength);

  const chunks = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }

  const blob = new Blob(chunks);
  console.debug("[blob] Downloaded", url, blob.size);
  if (blob.size !== contentLength)
    console.warn("[blob] Download size mismatch", {
      url,
      expected: contentLength,
      actual: blob.size,
    });

  return blob;
}
