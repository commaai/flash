export const VENDOR_ID = "05C6";
export const PRODUCT_ID = "9008";
export const DETACH_SCRIPT =
  'for d in /sys/bus/usb/drivers/qcserial/*-*; do [ -e "$d" ] && echo -n "$(basename $d)" | sudo tee /sys/bus/usb/drivers/qcserial/unbind > /dev/null; done';
