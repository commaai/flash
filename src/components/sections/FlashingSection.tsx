import { isLinux } from "../../utils/platform";
import { CopyText } from "../CopyText";

interface FlashingSectionProps {
  detachScript: string;
  qdlPorts: string;
}

export function FlashingSection({
  detachScript,
  qdlPorts,
}: FlashingSectionProps) {
  return (
    <section>
      <h2>Flashing</h2>
      <p>Follow these steps to put your device into QDL mode:</p>
      <ol>
        <li>Unplug the device and wait for the LED to switch off.</li>
        <li>
          First, connect the device to your computer using the{" "}
          <strong>lower</strong>{" "}
          <span className="whitespace-nowrap">USB-C</span> port{" "}
          <strong>(port 1)</strong>.
        </li>
        <li>
          Second, connect power to the <strong>upper</strong>{" "}
          <span className="whitespace-nowrap">OBD-C</span> port{" "}
          <strong>(port 2)</strong>.
        </li>
      </ol>
      <img
        src={qdlPorts}
        alt="image showing comma three and two ports. the lower port is labeled 1. the upper port is labeled 2."
        width={450}
        height={300}
      />
      <p>
        Your device&apos;s screen will remain blank for the entire flashing
        process. This is normal.
      </p>
      {isLinux && (
        <>
          <strong>Note for Linux users</strong>
          <p>
            On Linux systems, devices in QDL mode are automatically bound to the
            kernel&apos;s qcserial driver, and need to be unbound before we can
            access the device. Copy the script below into your terminal and run
            it after plugging in your device.
          </p>
          <CopyText>{detachScript}</CopyText>
        </>
      )}
      <p>
        Next, click the button to start flashing. From the prompt select the
        device which starts with &ldquo;QUSB_BULK&rdquo;.
      </p>
      <p>
        The process can take 30+ minutes depending on your internet connection
        and system performance. Do not unplug the device until all steps are
        complete.
      </p>
    </section>
  );
}
