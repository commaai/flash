/**
 * Represents a partition image defined in the AGNOS manifest.
 *
 * Image archives can be retrieved from {@link archiveUrl}.
 */

type ManifestImageJson = {
  name: string;
  size: number;
  sparse: boolean;
  has_ab: boolean;
  gpt?: { lun: number; start_sector: number; num_sectors: number };
  hash_raw: string;
  url: string;
};

export class ManifestImage {
  /**
   * Image name
   */
  name: string;

  /**
   * Partition name
   */
  partitionName: string;

  /**
   * Size of the unpacked and unsparsified image in bytes
   */
  size: number;

  /**
   * Whether the image is sparse
   */
  sparse: boolean;

  /**
   * Whether there are multiple slots for this partition
   */
  hasAB: boolean;

  /**
   * LUN and sector information for flashing this image
   */
  gpt: { lun: number; start_sector: number; num_sectors: number } | null;

  /**
   * Name of the image file
   */
  fileName: string;

  /**
   * Name of the image archive file
   */
  archiveFileName: string;

  /**
   * URL of the image archive
   */
  archiveUrl: string;

  /**
   * Whether the image is compressed and should be unpacked
   */
  compressed: boolean;

  constructor(json: ManifestImageJson) {
    this.name = json.name;
    this.partitionName = json.name.startsWith("userdata_")
      ? "userdata"
      : json.name;

    this.size = json.size;
    this.sparse = json.sparse;
    this.hasAB = json.has_ab;
    this.gpt = "gpt" in json && json.gpt ? json.gpt : null;

    this.fileName = `${this.name}-${json.hash_raw}.img`;
    this.archiveUrl = json.url;
    this.archiveFileName = this.archiveUrl.split("/").pop() || "";

    this.compressed = this.archiveFileName.endsWith(".xz");
  }
}

/**
 * Fetches and parses a manifest file from the given URL
 */
export function getManifest(url: string): Promise<ManifestImage[]> {
  return fetch(url)
    .then((response) => response.text())
    .then((text) =>
      JSON.parse(text).map(
        (image: ManifestImageJson) => new ManifestImage(image)
      )
    );
}
