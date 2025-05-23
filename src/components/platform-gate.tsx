import { platform as currentPlatform } from "../utils/platform";

type PlatformGateProps = {
  platform: string;
  children: preact.ComponentChildren;
};

const PlatformGate = ({ platform: targetPlatform, children }: PlatformGateProps) => {
  if ((currentPlatform as string).toLowerCase() === targetPlatform.toLowerCase()) {
    return <>{children}</>;
  }
  return null;
};

export default PlatformGate;