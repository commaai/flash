import sys
import usb.core
import usb.util
import usb.backend.libusb0
import usb.backend.libusb1
from ctypes import c_void_p, c_int

class usb_class:
  def __init__(self, portconfig=None):
    self.portconfig = portconfig
    self.device = None
    if sys.platform.startswith('freebsd') or sys.platform.startswith('linux') or sys.platform.startswith('darwin'):
      self.backend = usb.backend.libusb1.get_backend(find_library=lambda x: "libusb-1.0.so")
    else:
      print("Only support Unix-based machine")
      sys.exit(1)
    if self.backend is not None:
      try:
        self.backend.lib.libusb_set_option.argtypes = [c_void_p, c_int]
        self.backend.lib.libusb_set_option(self.backend.ctx, 1)
      except:
        self.backend = None

  def detach_driver(self):
    devices = usb.core.find(find_all=True, backend=self.backend)
    for d in devices:
      for usbid in self.portconfig:
        if d.idProduct == usbid[1] and d.idVendor == usbid[0]:
          self.device = d
          break
      if self.device is not None:
        break

    if self.device is None:
      print("Couldn't detect the device. Is it connected ?")
      return False

    try:
      self.configuration = self.device.get_active_configuration()
    except usb.core.USBError as e:
      if e.strerror == "Configuration not set":
        self.device.set_configuration()
        self.configuration = self.device.get_active_configuration()
      if e.errno == 13:
        self.backend = usb.backend.libusb0.get_backend()
        self.device = usb.core.find(idVendor=self.vid, idProduct=self.pid, backend=self.backend)
    try:
      if self.device.is_kernel_driver_active(0):
        print("Detaching kernel driver...")
        self.device.detach_kernel_driver(0)
        print("Finish detaching kernel driver")
    except Exception as err:
      print("No kernel driver supported: " + str(err))
    return False

if __name__ == "__main__":
  cdc = usb_class([[0x05c6, 0x9008, -1]])
  cdc.detach_driver()
