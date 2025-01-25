import { Suspense, lazy } from 'react'

import comma from '../assets/comma.svg'
import qdlPorts from '../assets/qdl-ports.svg'
import zadigCreateNewDevice from '../assets/zadig_create_new_device.png'
import zadigForm from '../assets/zadig_form.png'

import { isLinux, isWindows } from '../utils/platform'

const Flash = lazy(() => import('./Flash'))

const VENDOR_ID = '05C6'
const PRODUCT_ID = '9008'
const DETACH_SCRIPT = 'for d in /sys/bus/usb/drivers/qcserial/*-*; do [ -e "$d" ] && echo -n "$(basename $d)" | sudo tee /sys/bus/usb/drivers/qcserial/unbind > /dev/null; done';

function CopyText({ children: text }) {
  return <div className="relative text-sm">
    <pre className="font-mono pt-12">{text}</pre>
    <button
      className="absolute top-2 right-2 bg-blue-600 hover:bg-blue-500 active:bg-blue-300 transition-colors text-white p-1 rounded-md"
      onClick={() => navigator.clipboard.writeText(text)}
    >
      Copy
    </button>
  </div>;
}

export default function App() {
  const version = import.meta.env.VITE_PUBLIC_GIT_SHA || 'dev'
  console.info(`flash.comma.ai version: ${version}`)
  return (
    <div className="flex flex-col lg:flex-row flex-wrap">
      <main className="p-12 md:p-16 lg:p-20 xl:p-24 w-screen max-w-none lg:max-w-prose lg:w-auto h-auto lg:h-screen lg:overflow-y-auto prose dark:prose-invert prose-green bg-white dark:bg-gray-900">
        <section>
          <img src={comma} alt="comma" width={128} height={128} className="dark:invert" />
          <h1>flash.comma.ai</h1>
          <p>
            This tool allows you to flash AGNOS onto your comma device. AGNOS is the Ubuntu-based operating system for
            your <a href="https://comma.ai/shop/comma-3x" target="_blank">comma 3/3X</a>.
          </p>
        </section>
        <hr />

        <section>
          <h2>Requirements</h2>
          <ul>
            <li>
              A web browser which supports <a href="https://caniuse.com/webusb" target="_blank">WebUSB</a>
              {" "}(such as Google Chrome, Microsoft Edge, Opera), running on Windows, macOS, Linux, or Android.
            </li>
            <li>
              A good quality USB-C cable to connect the device to your computer. <span title="SuperSpeed">USB 3</span>
              {" "}is recommended for faster flashing speed.
            </li>
          </ul>
          {isWindows && (<>
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
                  width={575}
                  height={254}
                />
              </li>
              <li>
                Fill in three fields. The first field is just a description and you can fill in anything. The next two
                fields are very important. Fill them in with <code>{VENDOR_ID}</code> and <code>{PRODUCT_ID}</code>
                respectively. Press &quot;Install Driver&quot; and give it a few minutes to install.
                <img
                  src={zadigForm}
                  alt="Zadig Form"
                  width={575}
                  height={254}
                />
              </li>
            </ol>
            <p>No additional software is required for macOS, Linux or Android.</p>
          </>)}
        </section>
        <hr />

        <section>
          <h2>Flashing</h2>
          <p>Follow these steps to put your device into QDL mode:</p>
          <ol>
            <li>Unplug the device and wait for the LED to switch off.</li>
            <li>Connect the device to your computer using the <strong>lower</strong> <span className="whitespace-nowrap">USB-C</span> port.</li>
          </ol>
          <img
            src={qdlPorts}
            alt="image showing comma three and two ports. the upper port is labeled with a cross. the lower port is labeled with a checkmark."
            width={450}
            height={300}
          />
          <p>Your device&apos;s screen will remain blank for the entire flashing process. This is normal.</p>
          {isLinux && (<>
            <strong>Note for Linux users</strong>
            <p>
              On Linux systems, devices in QDL mode are automatically bound to the kernel&apos;s qcserial driver, and
              need to be unbound before we can access the device. Copy the script below into your terminal and run it
              after plugging in your device.
            </p>
            <CopyText>{DETACH_SCRIPT}</CopyText>
          </>)}
          <p>
            Next, click the button to start flashing. From the prompt select the device which starts with
            &ldquo;QUSB_BULK&rdquo;.
          </p>
          <p>
            The process can take 30+ minutes depending on your internet connection and system performance. Do not
            unplug the device until all steps are complete.
          </p>
        </section>
        <hr />

        <section>
          <h2>Troubleshooting</h2>
          <h3>Lost connection</h3>
          <p>
            Try using high quality USB 3 cables. You should also try different USB ports on the front or back of your
            computer. If you&apos;re using a USB hub, try connecting directly to your computer instead.
          </p>
          <h3>My device&apos;s screen is blank</h3>
          <p>
            This is normal in QDL mode. You can verify that the &ldquo;QUSB_BULK&rdquo; device shows up when you press
            the Flash button to know that it is working correctly.
          </p>
          <h3>My device says &ldquo;fastboot mode&rdquo;</h3>
          <p>
            You may have followed outdated instructions for flashing. Please read the instructions above for putting
            your device into QDL mode.
          </p>
          <h3>After flashing, device says unable to mount data partition</h3>
          <p>This is expected after the filesystem is erased. Press confirm to finish resetting your device.</p>
          <h3>General Tips</h3>
          <ul>
            <li>Try another computer or OS</li>
            <li>Try different USB ports on your computer</li>
            <li>Try different USB-C cables, including the OBD-C cable that came with the device</li>
          </ul>
          <h3>Other questions</h3>
          <p>
            If you need help, join our <a href="https://discord.comma.ai" target="_blank">Discord server</a> and go to
            the <strong>#hw-three-3x</strong> channel.
          </p>
        </section>

        <div className="hidden lg:block">
          <hr />
          flash.comma.ai version: <code>{version}</code>
        </div>
      </main>

      <div className="lg:flex-1 h-[700px] lg:h-screen bg-gray-100 dark:bg-gray-800">
        <Suspense fallback={<p className="text-black dark:text-white">Loading...</p>}>
          <Flash />
        </Suspense>
      </div>

      <div className="w-screen max-w-none p-12 md:p-16 prose dark:prose-invert bg-white dark:bg-gray-900 lg:hidden">
        flash.comma.ai version: <code>{version}</code>
      </div>
    </div>
  )
}
