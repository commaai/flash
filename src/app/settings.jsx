import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import config from '../config.js'
import settings from '../assets/settings.svg'

/**
 * @typedef {{
 *   open: boolean
 *   manifest: string
 *   disabled: boolean
 * }} Settings
 */

/**
 * @type {React.Context<[Settings, Dispatch<Partial<Settings>>]>}>}
 */
export const SettingsContext = createContext(null)

export function SettingsProvider({ children }) {
  const [settings, setSettings] = useState({
    manifest: 'release',
    open: false,
    disabled: true,
  })
  const updateSettings = useCallback((newSettings) => {
    setSettings((prevSettings) => ({ ...prevSettings, ...newSettings }))
  }, [setSettings])
  return <SettingsContext.Provider value={[settings, updateSettings]}>
    {children}
  </SettingsContext.Provider>
}

export function SettingsDialog() {
  const dialogRef = useRef(null)
  const [settings, updateSettings] = useContext(SettingsContext)

  useEffect(() => {
    if (dialogRef.current?.open && !settings.open) {
      dialogRef.current?.close()
    } else if (!dialogRef.current?.open && settings.open) {
      dialogRef.current?.showModal()
    }
  }, [settings])

  const onChangeManifest = useCallback((ev) => updateSettings({
    manifest: ev.target.value,
  }), [updateSettings])

  const onClose = useCallback(() => updateSettings({
    open: false,
  }), [updateSettings])

  return (
    <dialog
      ref={dialogRef}
      className="prose dark:prose-invert rounded-lg p-4 bg-gray-100 dark:bg-gray-800 backdrop:bg-black/50 min-w-[320px]"
    >
      <header>
        <h2 className="mt-0">Flash settings</h2>
      </header>
      <article className="grid">
        <label>
          Manifest:
          <select
            className="ms-2 p-1 rounded-lg text-black bg-white dark:bg-gray-600 dark:text-white"
            value={settings.manifest}
            onChange={onChangeManifest}
            disabled={settings.disabled}
          >
            {Object.keys(config.manifests).map((name) => <option key={name} value={name}>{name}</option>)}
          </select>
        </label>
      </article>
      <footer className="flex justify-end mt-4">
        <button className="rounded-lg px-3 py-2 hover:bg-black/20 active:bg-black/30" type="button" onClick={onClose}>
          Close
        </button>
      </footer>
    </dialog>
  )
}

export function SettingsButton() {
  const [, updateSettings] = useContext(SettingsContext)
  const openSettings = useCallback(() => updateSettings({
    open: true,
  }), [updateSettings])
  return (
    <div
      className="absolute top-4 right-4 p-2 rounded-full cursor-pointer hover:bg-black/20 active:bg-black/30 dark:invert z-10"
      onClick={openSettings}
    >
      <img src={settings} alt="open settings" width={32} height={32} />
    </div>
  )
}
