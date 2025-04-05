import comma from "./assets/comma.svg";
import qdlPorts from "./assets/qdl-ports.svg";
import zadigCreateNewDevice from "./assets/zadig_create_new_device.png";
import zadigForm from "./assets/zadig_form.png";

import { IntroSection } from "./components/sections/IntroSection";
import { RequirementsSection } from "./components/sections/Requirements";
import { FlashingSection } from "./components/sections/FlashingSection";
import { TroubleshootingSection } from "./components/sections/TroubleshootingSection";
import { DETACH_SCRIPT, PRODUCT_ID, VENDOR_ID } from "./utils/constants";
import Flash from "./components/Flash";

export default function App() {
  const version = import.meta.env.VITE_PUBLIC_GIT_SHA || "dev";
  console.info(`flash.comma.ai version: ${version}`);

  return (
    <div className="flex flex-col lg:flex-row flex-wrap">
      <main className="p-12 md:p-16 lg:p-20 xl:p-24 w-screen max-w-none lg:max-w-prose lg:w-auto h-auto lg:h-screen lg:overflow-y-auto prose dark:prose-invert prose-green bg-white dark:bg-gray-900">
        <IntroSection commaLogo={comma} />
        <hr />

        <RequirementsSection
          vendorId={VENDOR_ID}
          productId={PRODUCT_ID}
          detachScript={DETACH_SCRIPT}
          zadigCreateNewDevice={zadigCreateNewDevice}
          zadigForm={zadigForm}
        />
        <hr />

        <FlashingSection detachScript={DETACH_SCRIPT} qdlPorts={qdlPorts} />
        <hr />

        <TroubleshootingSection />

        <div className="hidden lg:block">
          <hr />
          flash.comma.ai version: <code>{version}</code>
        </div>
      </main>

      <div className="lg:flex-1 h-[700px] lg:h-screen bg-gray-100 dark:bg-gray-800">
        <Flash />
      </div>

      <div className="w-screen max-w-none p-12 md:p-16 prose dark:prose-invert bg-white dark:bg-gray-900 lg:hidden">
        flash.comma.ai version: <code>{version}</code>
      </div>
    </div>
  );
}
