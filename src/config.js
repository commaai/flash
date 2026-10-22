const config = {
  manifests: {
    release_mici: 'https://raw.githubusercontent.com/commaai/openpilot/release-mici/system/hardware/tici/all-partitions.json',
    release_tizi: 'https://raw.githubusercontent.com/commaai/openpilot/release-tizi/openpilot/common/hardware/comma/all-partitions.json',
    release_tici: 'https://raw.githubusercontent.com/commaai/openpilot/release-tici/system/hardware/tici/all-partitions.json',
  },
  loader: {
    url: 'https://raw.githubusercontent.com/commaai/flash/master/src/QDL/programmer.bin',
  },
}

export default config
