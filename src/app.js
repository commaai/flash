import { isWindows, isLinux } from './utils/platform'

export function appComponent() {
  return {
    version: import.meta.env.VITE_PUBLIC_GIT_SHA || 'dev',
    isWindows,
    isLinux,
    vendorId: '05C6',
    productId: '9008',
    detachScript: 'for d in /sys/bus/usb/drivers/qcserial/*-*; do [ -e "$d" ] && echo -n "$(basename $d)" | sudo tee /sys/bus/usb/drivers/qcserial/unbind > /dev/null; done',

    init() {
      console.info(`flash.comma.ai version: ${this.version}`)
    }
  }
}

// Copy Text component
export function copyTextComponent() {
  return {
    text: '',
    
    init() {
      this.text = this.$el.textContent.trim()
    },

    copy() {
      navigator.clipboard.writeText(this.text)
    }
  }
}