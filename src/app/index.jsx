import { Suspense, lazy } from 'react'

import comma from '../assets/comma.svg'
import fastbootPorts from '../assets/fastboot-ports.svg'
import zadigCreateNewDevice from '../assets/zadig_create_new_device.png'
import zadigForm from '../assets/zadig_form.png'

const Flash = lazy(() => import('./Flash'))

export default function App() {
  const version = import.meta.env.VITE_PUBLIC_GIT_SHA || 'dev'
  console.info(`flash.comma.ai version: ${version}`);
  return (
    <div className="flex flex-col lg:flex-row flex-wrap">
      <main className="p-12 md:p-16 lg:p-20 xl:p-24 w-screen max-w-none lg:max-w-prose lg:w-auto h-auto lg:h-screen lg:overflow-y-auto prose dark:prose-invert prose-green bg-white dark:bg-gray-900">
        <section>
          <img src={comma} alt="comma" width={128} height={128} className="dark:invert" />
          <h1>flash.comma.ai</h1>

          <p>This tool allows you to flash AGNOS onto your comma device.</p>
          <p>
            AGNOS is the Ubuntu-based operating system for your{" "}
            <a href="https://comma.ai/shop/comma-3x" target="_blank">comma 3/3X</a>.
          </p>
        </section>
        <hr />

        <section>
          <h2>Requirements</h2>
          <ul>
            <li>
              A web browser which supports WebUSB (such as Google Chrome, Microsoft Edge, Opera), running on Windows, macOS, Linux, or Android.
            </li>
            <li>
              A USB-C cable to power your device outside the car.
            </li>
            <li>
              Another USB-C cable to connect the device to your computer.
            </li>
          </ul>
          <h3>USB Driver</h3>
          <p>
            You need additional driver software for Windows before you connect
            your device.
          </p>
          <ol>
            <li>
              Download and install <a href="https://zadig.akeo.ie/">Zadig</a>.
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
              Fill in three fields. The first field is just a description and
              you can fill in anything.  The next two fields are very important.
              Fill them in with <code>05C6</code> and <code>9008</code> respectively.
              Press &quot;Install Driver&quot; and give it a few minutes to install.
              <img
                src={zadigForm}
                alt="Zadig Form"
                width={575}
                height={254}
              />
            </li>
          </ol>
          <p>
            No additional software is required for macOS or Linux.
          </p>
        </section>
        <hr />

        <section>
          <h2>QDL Mode</h2>
          <p>Follow these steps to put your device into QDL mode:</p>
          <ol>
            <li>Power off the device and wait for the LEDs to switch off.</li>
            <li>Connect the device to your computer using the USB-C port <strong>(port 2)</strong>.</li>
            <li>Connect power to the OBD-C port <strong>(port 1)</strong>.</li>
            <li>The device then should be visible as an option when choosing the device to flash</li>
          </ol>
          <img
            src={fastbootPorts}
            alt="image showing comma three and two ports. the upper port is labeled 1. the lower port is labeled 2."
            width={450}
            height={300}
          />
        </section>
        <hr />

        <section>
          <h2>Flashing</h2>
          <p>
            After your device is in QDL mode, you can click the button to start flashing. A prompt may appear to
            select a device; choose the device starts with <code>QUSB_BULK</code>.
          </p>
          <p>
            The process can take 30+ minutes depending on your internet connection and system performance. Do not
            unplug the device until all steps are complete.
          </p>
        </section>
        <hr />

        <section>
          <h2>Troubleshooting</h2>
          <h3>Too slow</h3>
          <p>
            It is recommended that you use a USB 3.0 cable when flashing since it will speed up the flashing time by a lot.
          </p>
          <h3>Cannot enter QDL</h3>
          <p>
            Try using a different USB cable or USB port. Sometimes USB 2.0 ports work better than USB 3.0 (blue) ports.
            If you&apos;re using a USB hub, try connecting the device directly to your computer, or alternatively use a
            USB hub between your computer and the device.
          </p>
          <h3>My device&apos;s screen is blank</h3>
          <p>
            The device screen will be blank in QDL mode, but you can verify that it is in QDL if the device shows up
            when you press the Flash icon.
          </p>
          <h3>After flashing, device says unable to mount data partition</h3>
          <p>
            This is expected after the filesystem is erased. Press confirm to finish resetting your device.
          </p>
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
        flash.comma.ai version: <code>{version.substring(0, 7)}</code>
      </div>
    </div>
  )
}
