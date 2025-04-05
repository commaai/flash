import Bowser from "bowser";

const browser = Bowser.getParser(navigator.userAgent);
const osName = browser.getOSName().toLowerCase();

export const isWindows = osName.includes("windows");
export const isLinux = osName.includes("linux") || osName.includes("android");
