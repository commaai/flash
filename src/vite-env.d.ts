/// <reference types="vite/client" />

declare module "@fontsource-variable/inter";
declare module "@fontsource-variable/jetbrains-mono";
declare module "*.css";
declare module "@commaai/qdl";
declare module "@commaai/qdl/usblib";
declare module "xz-decompress";

declare module "*.svg" {
  const content: string;
  export default content;
}

declare module "*.png" {
  const content: string;
  export default content;
}

interface ImportMetaEnv {
  readonly MANIFEST_BRANCH?: string;
}
