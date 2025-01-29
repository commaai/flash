import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import config from '../config.js'

/**
 * @typedef {{
 *   manifest: string
 * }} Settings
 */

/**
 * @type {React.Context<[Settings, Dispatch<Partial<Settings>>]>}>}
 */
export const SettingsContext = createContext(null)

export function SettingsProvider({ children }) {
  const [settings, setSettings] = useState({
    manifest: 'release',
  })
  const updateSettings = useCallback((update) => {
    setSettings(Object.assign({}, settings, update))
  }, [settings])
  return <SettingsContext.Provider value={[settings, updateSettings]}>
    {children}
  </SettingsContext.Provider>
}

export function SettingsDialog({ open, onClose }) {
  const dialogRef = useRef(null)
  const [settings, updateSettings] = useContext(SettingsContext)

  useEffect(() => {
    if (dialogRef.current?.open && !open) {
      dialogRef.current?.close()
    } else if (!dialogRef.current?.open && open) {
      dialogRef.current?.showModal()
    }
  }, [open])

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
            className="ms-2 p-1 rounded-lg text-black"
            value={settings.manifest}
            onChange={(ev) => updateSettings({ manifest: ev.target.value })}
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
