const config = {
  manifests: {
    release: 'https://raw.githubusercontent.com/commaai/openpilot/release3/system/hardware/tici/agnos.json',
    master: 'https://raw.githubusercontent.com/commaai/openpilot/master/system/hardware/tici/agnos.json',
  },
  loader: {
    url: 'https://raw.githubusercontent.com/commaai/flash/master/src/QDL/programmer.bin',
  },
}

export default config
