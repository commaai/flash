<script>
  import { isWindows } from '$lib/utils/platform.js';
  
  // Import assets from src/assets using the alias
  import zadigCreateNewDevice from '../../assets/zadig_create_new_device.png';
  import zadigForm from '../../assets/zadig_form.png';  
  
  const VENDOR_ID = '05C6';
  const PRODUCT_ID = '9008';
</script>

<section>
  <h2>Requirements</h2>
  <ul>
    <li>
      A web browser which supports <a href="https://caniuse.com/webusb" target="_blank">WebUSB</a>
      (such as Google Chrome, Microsoft Edge, Opera), running on Windows, macOS, Linux, or Android.
    </li>
    <li>
      A good quality USB-C cable to connect the device to your computer. <span title="SuperSpeed">USB 3</span>
      is recommended for faster flashing speed.
    </li>
    <li>
      Another USB-C cable and a charger, to power the device outside your car.
    </li>
  </ul>
  
  {#if isWindows}
    <h3>USB Driver</h3>
    <p>You need additional driver software for Windows before you connect your device.</p>
    <ol>
      <li>
        Download and run <a href="https://zadig.akeo.ie/" target="_blank">Zadig</a>.
      </li>
      <li>
        Under <code>Device</code> in the menu bar, select <code>Create New Device</code>.
        <img
          src={zadigCreateNewDevice}
          alt="Zadig Create New Device"
          width="575"
          height="254"
        />
      </li>
      <li>
        Fill in three fields. The first field is just a description and you can fill in anything. The next two
        fields are very important. Fill them in with <code>{VENDOR_ID}</code> and <code>{PRODUCT_ID}</code>
        respectively. Press "Install Driver" and give it a few minutes to install.
        <img
          src={zadigForm}
          alt="Zadig Form"
          width="575"
          height="254"
        />
      </li>
    </ol>
    <p>No additional software is required for macOS, Linux or Android.</p>
  {/if}
</section>