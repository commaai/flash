import { useEffect, useRef, useState } from 'react'

import { concatUint8Array } from '@/QDL/utils'
import { qdlDevice } from '@/QDL/qdl'
import * as Comlink from 'comlink'

import config from '@/config'
import { download } from '@/utils/blob'
import { useImageWorker } from '@/utils/image'
import { createManifest } from '@/utils/manifest'
import { withProgress } from '@/utils/progress'

/**
 * @typedef {import('./manifest.js').Image} Image
 */

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

function isRecognizedDevice(slotCount, partitions) {

  if (slotCount !== 2) {
    console.error('[QDL] Unrecognised device (slotCount)')
    return false
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
    console.error('[QDL] Unrecognised device (partitions)', partitions)
    return false
  }
  return true
}


export function useQdl() {
  const [step, _setStep] = useState(Step.INITIALIZING)
  const [message, _setMessage] = useState('')
  const [progress, setProgress] = useState(0)
  const [error, _setError] = useState(Error.NONE)

  const [connected, setConnected] = useState(false)
  const [serial, setSerial] = useState(null)

  const [onContinue, setOnContinue] = useState(null)
  const [onRetry, setOnRetry] = useState(null)

  const imageWorker = useImageWorker()
  const qdl = useRef(new qdlDevice())

  /** @type {React.RefObject<Image[]>} */
  const manifest = useRef(null)

  function setStep(step) {
    _setStep(step)
  }

  function setMessage(message = '') {
    if (message) console.info('[QDL]', message)
    _setMessage(message)
  }

  function setError(error) {
    _setError(error)
  }
  useEffect(() => {
    setProgress(-1)
    setMessage()

    if (error) return
    if (!imageWorker.current) {
      console.debug('[QDL] Waiting for image worker')
      return
    }

    switch (step) {
      case Step.INITIALIZING: {
        // Check that the browser supports WebUSB
        if (typeof navigator.usb === 'undefined') {
          console.error('[QDL] WebUSB not supported')
          setError(Error.REQUIREMENTS_NOT_MET)
          break
        }

        // Check that the browser supports Web Workers
        if (typeof Worker === 'undefined') {
          console.error('[QDL] Web Workers not supported')
          setError(Error.REQUIREMENTS_NOT_MET)
          break
        }

        // Check that the browser supports Storage API
        if (typeof Storage === 'undefined') {
          console.error('[QDL] Storage API not supported')
          setError(Error.REQUIREMENTS_NOT_MET)
          break
        }

        imageWorker.current?.init()
          .then(() => download(config.manifests['release']))
          .then(blob => blob.text())
          .then(text => {
            manifest.current = createManifest(text)

            // sanity check
            if (manifest.current.length === 0) {
              throw 'Manifest is empty'
            }

            console.debug('[QDL] Loaded manifest', manifest.current)
            setStep(Step.READY)
          })
          .catch((err) => {
            console.error('[QDL] Initialization error', err)
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
        qdl.current.waitForConnect()
          .then(() => {
            console.info('[QDL] Connected')
            return qdl.current.getDevicePartitionsInfo()
              .then(([slotCount, partitions]) => {
                const recognized = isRecognizedDevice(slotCount, partitions)
                console.debug('[QDL] Device info', { recognized,  partitions})

                if (!recognized) {
                  setError(Error.UNRECOGNIZED_DEVICE)
                  return
                }

                setSerial(qdl.current.sahara.serial || 'unknown')
                setConnected(true)
                setStep(Step.DOWNLOADING)
              })
              .catch((err) => {
                console.error('[QDL] Error getting device information', err)
                setError(Error.UNKNOWN)
              })
          })
          .catch((err) => {
            console.error('[QDL] Connection lost', err)
            setError(Error.LOST_CONNECTION)
            setConnected(false)
          })
        qdl.current.connect()
          .catch((err) => {
            console.error('[QDL] Connection error', err)
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
            console.debug('[QDL] Downloaded all images')
            setStep(Step.UNPACKING)
          })
          .catch((err) => {
            console.error('[QDL] Download error', err)
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
            console.debug('[QDL] Unpacked all images')
            setStep(Step.FLASHING)
          })
          .catch((err) => {
            console.error('[QDL] Unpack error', err)
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
          const currentSlot = await qdl.current.getActiveSlot();
          if (!['a', 'b'].includes(currentSlot)) {
            throw `Unknown current slot ${currentSlot}`
          }
          const otherSlot = currentSlot === 'a' ? 'b' : 'a'

          // Erase current xbl partition so if users try to power up device
          // with corrupted primary gpt header, it would not update the backup
          await qdl.current.erase("xbl"+`_${currentSlot}`)

          for await (const [image, onProgress] of withProgress(manifest.current, setProgress)) {
            const fileHandle = await imageWorker.current.getImage(image)
            const blob = await fileHandle.getFile()

            setMessage(`Flashing ${image.name}`)
            const partitionName = image.name + `_${otherSlot}`
            await qdl.current.flashBlob(partitionName, blob, onProgress)
          }
          console.debug('[QDL] Flashed all partitions')

          setMessage(`Changing slot to ${otherSlot}`)
          await qdl.current.setActiveSlot(otherSlot)
        }

        flashDevice()
          .then(() => {
            console.debug('[QDL] Flash complete')
            setStep(Step.ERASING)
          })
          .catch((err) => {
            console.error('[QDL] Flashing error', err)
            setError(Error.FLASH_FAILED)
          })
        break
      }

      case Step.ERASING: {
        setProgress(0)

        async function resetUserdata() {
          let wData = new TextEncoder().encode("COMMA_RESET")
          wData = new Blob([concatUint8Array([wData, new Uint8Array(28 - wData.length).fill(0)])]) // make equal sparseHeaderSize
          await qdl.current.flashBlob("userdata", wData)
        }

        async function eraseDevice() {
          setMessage('Erasing userdata')
          await resetUserdata()
          setProgress(0.9)

          setMessage('Rebooting')
          await qdl.current.reset()
          setProgress(1)
          setConnected(false)
        }

        eraseDevice()
          .then(() => {
            console.debug('[QDL] Erase complete')
            setStep(Step.DONE)
          })
          .catch((err) => {
            console.error('[QDL] Erase error', err)
            setError(Error.ERASE_FAILED)
          })
        break
      }
    }
  }, [error, imageWorker, step])

  useEffect(() => {
    if (error !== Error.NONE) {
      console.debug('[QDL] error', error)
      setProgress(-1)
      setOnContinue(null)

      setOnRetry(() => () => {
        console.debug('[QDL] on retry')
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

