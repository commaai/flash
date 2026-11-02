export async function getImageDirectory() {
  const root = await navigator.storage.getDirectory()
  return root.getDirectoryHandle('verified-images', { create: true })
}
