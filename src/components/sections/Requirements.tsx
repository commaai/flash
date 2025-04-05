import { isWindows } from "../../utils/platform";

interface RequirementsSectionProps {
  vendorId: string;
  productId: string;
  detachScript: string;
  zadigCreateNewDevice: string;
  zadigForm: string;
}

export function RequirementsSection({
  vendorId,
  productId,
  zadigCreateNewDevice,
  zadigForm,
}: RequirementsSectionProps) {
  return (
    <section>
      <h2>Requirements</h2>
      <ul>
        <li>
          A web browser which supports{" "}
          <a href="https://caniuse.com/webusb" target="_blank">
            WebUSB
          </a>{" "}
          (such as Google Chrome, Microsoft Edge, Opera), running on Windows,
          macOS, Linux, or Android.
        </li>
        <li>
          A good quality USB-C cable to connect the device to your computer.{" "}
          <span title="SuperSpeed">USB 3</span> is recommended for faster
          flashing speed.
        </li>
        <li>
          Another USB-C cable and a charger, to power the device outside your
          car.
        </li>
      </ul>
      {isWindows && (
        <>
          <h3>USB Driver</h3>
          <p>
            You need additional driver software for Windows before you connect
            your device.
          </p>
          <ol>
            <li>
              Download and run{" "}
              <a href="https://zadig.akeo.ie/" target="_blank">
                Zadig
              </a>
              .
            </li>
            <li>
              Under <code>Device</code> in the menu bar, select{" "}
              <code>Create New Device</code>.
              <img
                src={zadigCreateNewDevice}
                alt="Zadig Create New Device"
                width={575}
                height={254}
              />
            </li>
            <li>
              Fill in three fields. The first field is just a description and
              you can fill in anything. The next two fields are very important.
              Fill them in with <code>{vendorId}</code> and{" "}
              <code>{productId}</code>
              respectively. Press &quot;Install Driver&quot; and give it a few
              minutes to install.
              <img src={zadigForm} alt="Zadig Form" width={575} height={254} />
            </li>
          </ol>
          <p>No additional software is required for macOS, Linux or Android.</p>
        </>
      )}
    </section>
  );
}
