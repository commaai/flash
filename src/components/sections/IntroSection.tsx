interface IntroSectionProps {
  commaLogo: string;
}

export function IntroSection({ commaLogo }: IntroSectionProps) {
  return (
    <section>
      <img
        src={commaLogo}
        alt="comma"
        width={128}
        height={128}
        className="dark:invert"
      />
      <h1>flash.comma.ai</h1>
      <p>
        This tool allows you to flash AGNOS onto your comma device. AGNOS is the
        Ubuntu-based operating system for your{" "}
        <a href="https://comma.ai/shop/comma-3x" target="_blank">
          comma 3/3X
        </a>
        .
      </p>
    </section>
  );
}
