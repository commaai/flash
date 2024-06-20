import { useEffect, useRef, useState } from 'preact/hooks'

import { FastbootDevice, setDebugLevel } from 'android-fastboot'
import * as Comlink from 'comlink'

import config from '@/config'
import { download } from '@/utils/blob'
import { useImageWorker } from '@/utils/image'
import { createManifest } from '@/utils/manifest'
import { withProgress } from '@/utils/progress'

/**
 * @typedef {import('./manifest.js').Image} Image
 */

// Verbose logging for fastboot
setDebugLevel(2)

export const Step = {
  INITIALIZING: 0,
  READY: 1,
  CONNECTING: 2,
  DOWNLOADING: 3,
  UNPACKING: 4,
  FLASHING: 6,
  ERASING: 7,
  DONE: 8,
}

export const Error = {
  UNKNOWN: -1,
  NONE: 0,
  UNRECOGNIZED_DEVICE: 1,
  LOST_CONNECTION: 2,
  DOWNLOAD_FAILED: 3,
  UNPACK_FAILED: 4,
  CHECKSUM_MISMATCH: 5,
  FLASH_FAILED: 6,
  ERASE_FAILED: 7,
  REQUIREMENTS_NOT_MET: 8,
}

function isRecognizedDevice(deviceInfo) {
  // check some variables are as expected for a comma three
  const {
    kernel,
    "max-download-size": maxDownloadSize,
    "slot-count": slotCount,
  } = deviceInfo
  if (kernel !== "uefi" || maxDownloadSize !== "104857600" || slotCount !== "2") {
    console.error('[fastboot] Unrecognised device (kernel, maxDownloadSize or slotCount)', deviceInfo)
    return false
  }

  const partitions = []
  for (const key of Object.keys(deviceInfo)) {
    if (!key.startsWith("partition-type:")) continue
    let partition = key.substring("partition-type:".length)
    if (partition.endsWith("_a") || partition.endsWith("_b")) {
      partition = partition.substring(0, partition.length - 2)
    }
    if (partitions.includes(partition)) continue
    partitions.push(partition)
  }

  // check we have the expected partitions to make sure it's a comma three
  const expectedPartitions = [
    "ALIGN_TO_128K_1", "ALIGN_TO_128K_2", "ImageFv", "abl", "aop", "apdp", "bluetooth", "boot", "cache",
    "cdt", "cmnlib", "cmnlib64", "ddr", "devcfg", "devinfo", "dip", "dsp", "fdemeta", "frp", "fsc", "fsg",
    "hyp", "keymaster", "keystore", "limits", "logdump", "logfs", "mdtp", "mdtpsecapp", "misc", "modem",
    "modemst1", "modemst2", "msadp", "persist", "qupfw", "rawdump", "sec", "splash", "spunvm", "ssd",
    "sti", "storsec", "system", "systemrw", "toolsfv", "tz", "userdata", "vm-linux", "vm-system", "xbl",
    "xbl_config"
  ]
  if (!partitions.every(partition => expectedPartitions.includes(partition))) {
    console.error('[fastboot] Unrecognised device (partitions)', partitions)
    return false
  }

  // sanity check, also useful for logging
  if (!deviceInfo['serialno']) {
    console.error('[fastboot] Unrecognised device (missing serialno)', deviceInfo)
    return false
  }

  return true
}

export function useFastboot() {
  const [step, setStep] = useState(Step.INITIALIZING)
  const [message, _setMessage] = useState('')
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState(Error.NONE)

  const [connected, setConnected] = useState(false)
  const [serial, setSerial] = useState(null)

  const [onContinue, setOnContinue] = useState(null)
  const [onRetry, setOnRetry] = useState(null)

  const imageWorker = useImageWorker()
  const fastboot = useRef(new FastbootDevice())

  /** @type {import('preact/hooks').MutableRef<Image[]>} */
  const manifest = useRef(null)

  function setMessage(message = '') {
    if (message) console.info('[fastboot]', message)
    _setMessage(message)
  }

  useEffect(() => {
    setProgress(-1)
    setMessage()

    if (error) return
    if (!imageWorker.current) {
      console.debug('[fastboot] Waiting for image worker')
      return
    }

    switch (step) {
      case Step.INITIALIZING: {
        // Check that the browser supports WebUSB
        if (typeof navigator.usb === 'undefined') {
          console.error('[fastboot] WebUSB not supported')
          setError(Error.REQUIREMENTS_NOT_MET)
          break
        }

        // Check that the browser supports Web Workers
        if (typeof Worker === 'undefined') {
          console.error('[fastboot] Web Workers not supported')
          setError(Error.REQUIREMENTS_NOT_MET)
          break
        }

        // Check that the browser supports Storage API
        if (typeof Storage === 'undefined') {
          console.error('[fastboot] Storage API not supported')
          setError(Error.REQUIREMENTS_NOT_MET)
          break
        }

        // TODO: change manifest once alt image is in release
        imageWorker.current?.init()
          .then(() => download(config.manifests['master']))
          .then(blob => blob.text())
          .then(text => {
            manifest.current = createManifest(text)

            // sanity check
            if (manifest.current.length === 0) {
              throw 'Manifest is empty'
            }

            console.debug('[fastboot] Loaded manifest', manifest.current)
            setStep(Step.READY)
          })
          .catch((err) => {
            console.error('[fastboot] Initialization error', err)
            setError(Error.UNKNOWN)
          })
        break
      }

      case Step.READY: {
        // wait for user interaction (we can't use WebUSB without user event)
        setOnContinue(() => () => {
          setOnContinue(null)
          setStep(Step.CONNECTING)
        })
        break
      }

      case Step.CONNECTING: {
        fastboot.current.waitForConnect()
          .then(() => {
            console.info('[fastboot] Connected', { fastboot: fastboot.current })
            return fastboot.current.getVariable('all')
              .then((all) => {
                const deviceInfo = all.split('\n').reduce((obj, line) => {
                  const parts = line.split(':')
                  const key = parts.slice(0, -1).join(':').trim()
                  obj[key] = parts.slice(-1)[0].trim()
                  return obj
                }, {})

                const recognized = isRecognizedDevice(deviceInfo)
                console.debug('[fastboot] Device info', { recognized, deviceInfo })

                if (!recognized) {
                  setError(Error.UNRECOGNIZED_DEVICE)
                  return
                }

                setSerial(deviceInfo['serialno'] || 'unknown')
                setConnected(true)
                setStep(Step.DOWNLOADING)
              })
              .catch((err) => {
                console.error('[fastboot] Error getting device information', err)
                setError(Error.UNKNOWN)
              })
          })
          .catch((err) => {
            console.error('[fastboot] Connection lost', err)
            setError(Error.LOST_CONNECTION)
            setConnected(false)
          })

        fastboot.current.connect()
          .catch((err) => {
            console.error('[fastboot] Connection error', err)
            setStep(Step.READY)
          })
        break
      }

      case Step.DOWNLOADING: {
        setProgress(0)

        async function downloadImages() {
          for await (const [image, onProgress] of withProgress(manifest.current, setProgress)) {
            setMessage(`Downloading ${image.name}`)
            await imageWorker.current.downloadImage(image, Comlink.proxy(onProgress))
          }
        }

        downloadImages()
          .then(() => {
            console.debug('[fastboot] Downloaded all images')
            setStep(Step.UNPACKING)
          })
          .catch((err) => {
            console.error('[fastboot] Download error', err)
            setError(Error.DOWNLOAD_FAILED)
          })
        break
      }

      case Step.UNPACKING: {
        setProgress(0)

        async function unpackImages() {
          for await (const [image, onProgress] of withProgress(manifest.current, setProgress)) {
            setMessage(`Unpacking ${image.name}`)
            await imageWorker.current.unpackImage(image, Comlink.proxy(onProgress))
          }
        }

        unpackImages()
          .then(() => {
            console.debug('[fastboot] Unpacked all images')
            setStep(Step.FLASHING)
          })
          .catch((err) => {
            console.error('[fastboot] Unpack error', err)
            if (err.startsWith('Checksum mismatch')) {
              setError(Error.CHECKSUM_MISMATCH)
            } else {
              setError(Error.UNPACK_FAILED)
            }
          })
        break
      }

      case Step.FLASHING: {
        setProgress(0)

        async function flashDevice() {
          const currentSlot = await fastboot.current.getVariable('current-slot')
          if (!['a', 'b'].includes(currentSlot)) {
            throw `Unknown current slot ${currentSlot}`
          }

          for await (const [image, onProgress] of withProgress(manifest.current, setProgress)) {
            const fileHandle = await imageWorker.current.getImage(image)
            const blob = await fileHandle.getFile()

            if (image.sparse) {
              setMessage(`Erasing ${image.name}`)
              await fastboot.current.runCommand(`erase:${image.name}`)
            }
            setMessage(`Flashing ${image.name}`)
            await fastboot.current.flashBlob(image.name, blob, onProgress, 'other')
          }
          console.debug('[fastboot] Flashed all partitions')

          const otherSlot = currentSlot === 'a' ? 'b' : 'a'
          setMessage(`Changing slot to ${otherSlot}`)
          await fastboot.current.runCommand(`set_active:${otherSlot}`)
        }

        flashDevice()
          .then(() => {
            console.debug('[fastboot] Flash complete')
            setStep(Step.ERASING)
          })
          .catch((err) => {
            console.error('[fastboot] Flashing error', err)
            setError(Error.FLASH_FAILED)
          })
        break
      }

      case Step.ERASING: {
        setProgress(0)

        async function eraseDevice() {
          setMessage('Erasing userdata')
          await fastboot.current.runCommand('erase:userdata')
          setProgress(0.9)

          setMessage('Rebooting')
          await fastboot.current.runCommand('continue')
          setProgress(1)
          setConnected(false)
        }

        eraseDevice()
          .then(() => {
            console.debug('[fastboot] Erase complete')
            setStep(Step.DONE)
          })
          .catch((err) => {
            console.error('[fastboot] Erase error', err)
            setError(Error.ERASE_FAILED)
          })
        break
      }
    }
  }, [error, imageWorker, step])

  useEffect(() => {
    if (error !== Error.NONE) {
      console.debug('[fastboot] error', error)
      setProgress(-1)
      setOnContinue(null)

      setOnRetry(() => () => {
        console.debug('[fastboot] on retry')
        window.location.reload()
      })
    }
  }, [error])

  return {
    step,
    message,
    progress,
    error,

    connected,
    serial,

    onContinue,
    onRetry,
  }
}
