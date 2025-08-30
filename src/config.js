const config = {
  manifests: {
    release_tizi: 'https://raw.githubusercontent.com/commaai/openpilot/927548621be1be0c2c9063868b93d1f5020904de/system/hardware/tici/all-partitions.json',
    release_tici: 'https://raw.githubusercontent.com/commaai/openpilot/927548621be1be0c2c9063868b93d1f5020904de/system/hardware/tici/all-partitions.json',
    master: 'https://raw.githubusercontent.com/commaai/openpilot/master/system/hardware/tici/all-partitions.json',
  },
  loader: {
    url: 'https://raw.githubusercontent.com/commaai/flash/master/src/QDL/programmer.bin',
  },
}

export default config
