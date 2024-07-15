import iconUrl from '../../public/icon.svg'

export default function HeadDefault() {
  return (
    <>
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <meta name="description" content="Update your comma device to the latest software" />
      <link rel="icon" type="image/svg+xml" href={iconUrl} />
      <script defer data-domain="flash.comma.ai" src="https://plausible.io/js/script.outbound-links.js"></script>
    </>
  );
}
