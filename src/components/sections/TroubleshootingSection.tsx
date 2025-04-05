export function TroubleshootingSection() {
  return (
    <section>
      <h2>Troubleshooting</h2>
      <h3>Lost connection</h3>
      <p>
        Try using high quality USB 3 cables. You should also try different USB
        ports on the front or back of your computer. If you&apos;re using a USB
        hub, try connecting directly to your computer instead.
      </p>
      <h3>My device&apos;s screen is blank</h3>
      <p>
        This is normal in QDL mode. You can verify that the
        &ldquo;QUSB_BULK&rdquo; device shows up when you press the Flash button
        to know that it is working correctly.
      </p>
      <h3>My device says &ldquo;fastboot mode&rdquo;</h3>
      <p>
        You may have followed outdated instructions for flashing. Please read
        the instructions above for putting your device into QDL mode.
      </p>
      <h3>General Tips</h3>
      <ul>
        <li>Try another computer or OS</li>
        <li>Try different USB ports on your computer</li>
        <li>
          Try different USB-C cables; low quality cables are often the source of
          problems. Note that the included OBD-C cable will not work.
        </li>
      </ul>
      <h3>Other questions</h3>
      <p>
        If you need help, join our{" "}
        <a href="https://discord.comma.ai" target="_blank">
          Discord server
        </a>{" "}
        and go to the <strong>#hw-three-3x</strong> channel.
      </p>
    </section>
  );
}
