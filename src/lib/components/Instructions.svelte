<script>
  import { isLinux } from '$lib/utils/platform.js';
  import CopyText from './CopyText.svelte';
  import qdlPortsImg from '../../assets/qdl-ports.svg';
  
  const DETACH_SCRIPT = 'for d in /sys/bus/usb/drivers/qcserial/*-*; do [ -e "$d" ] && echo -n "$(basename $d)" | sudo tee /sys/bus/usb/drivers/qcserial/unbind > /dev/null; done';
</script>

<section>
  <h2>Flashing</h2>
  <p>Follow these steps to put your device into QDL mode:</p>
  <ol>
    <li>Unplug the device and wait for the LED to switch off.</li>
    <li>First, connect the device to your computer using the <strong>lower</strong> <span class="whitespace-nowrap">USB-C</span> port <strong>(port 1)</strong>.</li>
    <li>Second, connect power to the <strong>upper</strong> <span class="whitespace-nowrap">OBD-C</span> port <strong>(port 2)</strong>.</li>
  </ol>
  
  <img 
    src={qdlPortsImg} 
    alt="comma three device with two ports - the lower port is labeled 1, the upper port is labeled 2" 
    width="450" 
    height="300" 
  />
  
  <p>Your device's screen will remain blank for the entire flashing process. This is normal.</p>
  
  {#if isLinux}
    <strong>Note for Linux users</strong>
    <p>
      On Linux systems, devices in QDL mode are automatically bound to the kernel's qcserial driver, and
      need to be unbound before we can access the device. Copy the script below into your terminal and run it
      after plugging in your device.
    </p>
    <CopyText text={DETACH_SCRIPT} />
  {/if}
  
  <p>
    Next, click the button to start flashing. From the prompt select the device which starts with
    "QUSB_BULK".
  </p>
  <p>
    The process can take 30+ minutes depending on your internet connection and system performance. Do not
    unplug the device until all steps are complete.
  </p>
</section>