'use client'
import dynamic from 'next/dynamic'
import Image from 'next/image'

import comma from '@/assets/comma.svg'
import fastbootPorts from '@/assets/fastboot-ports.svg'

const Flash = dynamic(() => import('./Flash'), {
  loading: () => <p className="text-black dark:text-white">Loading...</p>,
  ssr: false,
})

export default function Home() {
  const version = process.env.NEXT_PUBLIC_GIT_SHA || 'dev'
  console.info(`flash.comma.ai version: ${version}`);
  return (
    <div className="flex flex-col lg:flex-row flex-wrap">
      <main className="p-12 md:p-16 lg:p-20 xl:p-24 w-screen max-w-none lg:max-w-prose lg:w-auto h-auto lg:h-screen lg:overflow-y-auto prose dark:prose-invert prose-green bg-white dark:bg-gray-900">
        <section>
          <Image src={comma} alt="comma" width={128} height={128} className="dark:invert" />
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
              A web browser which supports WebUSB (such as Google Chrome, Microsoft Edge, Opera).
              Note that Chrome or similar browsers on Android devices with 6GB+ of RAM and an
              extended screen timeout setting may work as well.
            </li>
            <li>A USB-C cable to power your device outside the car.</li>
            <ul>
              <li>You can use a 5V or 12V power adapter.</li>
            </ul>
            <li>Another USB-C cable to connect the device to your computer.</li>
          </ul>
          <h3>USB Driver</h3>
          <p>
            You need additional software for Windows to connect your device. <a href="https://developer.android.com/studio/run/win-usb" target="_blank">
            Download Google USB Driver</a>.
          </p>
          <p>
            No additional software is required for macOS or Linux.
          </p>
        </section>
        <hr />

        <section>
          <h2>Fastboot</h2>
          <p>Follow these steps to put your device into fastboot mode:</p>
          <ol>
            <li>Power off the device and wait for the LEDs to switch off.</li>
            <li>Connect power to the OBD-C port <strong>(port 1)</strong>.</li>
            <li>Then, quickly connect the device to your computer using the USB-C port <strong>(port 2)</strong>.</li>
            <li>After a few seconds, the device should indicate it&apos;s in fastboot mode and show its serial number.</li>
          </ol>
          <Image
            src={fastbootPorts}
            alt="image showing comma three and two ports. the upper port is labeled 1. the lower port is labeled 2."
            width={450}
            height={300}
          />
          <p>
            If your device shows the comma spinner with a loading bar, then it&apos;s not in fastboot mode.
            Unplug all cables, wait for the device to switch off, and try again.
          </p>
        </section>
        <hr />

        <section>
          <h2>Flashing</h2>
          <p>
            After your device is in fastboot mode, you can click the button to start flashing. A prompt may appear to
            select a device; choose the device labeled &quot;Android&quot;.
          </p>
          <p>
            The process may take 10-15 minutes depending on your internet connection and system performance. Do not
            unplug the device until all steps are complete.
          </p>
        </section>
        <hr />

        <section>
          <h2>Troubleshooting</h2>
          <h3>Cannot enter fastboot or device says &quot;Press any key to continue&quot;</h3>
          <p>
            Try using a different USB cable or USB port. Sometimes USB 2.0 ports work better than USB 3.0 (blue) ports.
            If you&apos;re using a USB hub, try connecting the device directly to your computer, or alternatively use a
            USB hub between your computer and the device.
          </p>
          <p>
            You may also want to try to use a different type of workstation type to flash with. In order from easiest to most troublesome:
            <ul>
              <li>Mac</li>
              <li>Android with 6GB+ of RAM</li>
              <li>Windows</li>
              <li>Linux (You may need to search on how to allow WebUSB)</li>
            </ul>
          </p>
          <h3>My device&apos;s screen is blank</h3>
          <p>
            The device can still be in fastboot mode and reflashed normally if the screen isn&apos;t displaying
            anything. A blank screen is usually caused by installing older software that doesn&apos;t support newer
            displays. If a reflash doesn&apos;t fix the blank screen, then the device&apos;s display may be damaged.
          </p>
          <h3>After flashing, device says unable to mount data partition</h3>
          <p>
            This is expected after the filesystem is erased. You can safely press confirm to reset your device.
          </p>
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

      <div
        id="flash-container"
        className="lg:flex-1 h-[700px] lg:h-screen bg-gray-100 dark:bg-gray-800"
      >
        <Flash />
      </div>

      <div className="w-screen max-w-none p-12 md:p-16 prose dark:prose-invert bg-white dark:bg-gray-900 lg:hidden">
        flash.comma.ai version: <code>{version.substring(0, 7)}</code>
      </div>
    </div>
  )
}
