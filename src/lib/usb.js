export async function flashDevice(device, firmwareFile, updateProgress) {
  console.log("Starting flash pipeline...");

  try {
    await device.open();
  } catch (err) {
    console.error("Could not open device:", err);
    throw new Error("Failed to open device.");
  }

  try {
    if (device.configuration === null) {
      await device.selectConfiguration(1);
    }
  } catch (err) {
    console.warn("selectConfiguration failed (ignored):", err);
  }

  try {
    await device.claimInterface(0);
  } catch (err) {
    console.warn("Could not claim interface:", err);
  }

  const buffer = await firmwareFile.arrayBuffer();
  const chunkSize = 4096;
  let offset = 0;

  while (offset < buffer.byteLength) {

    await new Promise((res) => setTimeout(res, 5));

    offset += chunkSize;
    const progress = Math.min(
      100,
      Math.floor((offset / buffer.byteLength) * 100)
    );
    updateProgress(progress);
  }

  console.log("Flash pipeline finished.");
  return true;
}
