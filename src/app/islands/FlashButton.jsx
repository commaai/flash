import { Step } from '@/utils/fastboot'

export default function FlashButton({
  onContinue,
  handleContinue,
  icon,
  iconStyle,
  step,
  error,
  bgColor,
}) {
  return (
    <div
      className={`p-8 rounded-full ${bgColor}`}
      style={{ cursor: onContinue ? 'pointer' : 'default' }}
      onClick={handleContinue}
    >
      <img
        src={icon}
        alt="cable"
        width={128}
        height={128}
        className={`${iconStyle} ${
          !error && step !== Step.DONE ? 'animate-pulse' : ''
        }`}
      />
    </div>
  )
}
