#!/bin/bash
set -e

config="1.0"
device=$(lsusb | egrep 05c6:9008)
if [ -z "$device" ]; then
    echo "Error: No device found"
    exit 1
fi
bus=$(echo "$device" | awk '{print $2}' | sed 's/Bus //;s/^0*//')
port=$(lsusb -t | grep Driver=qcserial | awk -F'Port ' '{print $2}' | cut -d ':' -f 1)

device="$bus-$port:$config"
echo -n $device | sudo tee /sys/bus/usb/drivers/qcserial/unbind  > /dev/null
echo "Successfully detach kernel driver"
