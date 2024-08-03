function LinearProgress({ value, barColor }) {
  if (value === -1 || value > 100) value = 100
  return (
    <div className="relative w-full h-2 bg-gray-200 rounded-full overflow-hidden">
      <div
        className={`absolute top-0 bottom-0 left-0 w-full transition-all ${barColor}`}
        style={{ transform: `translateX(${value - 100}%)` }}
      />
    </div>
  )
}

export default function Progress({ progress, bgColor }) {
  return (
    <div
      className="w-full max-w-3xl px-8 transition-opacity duration-300"
      style={{ opacity: progress === -1 ? 0 : 1 }}
    >
      <LinearProgress value={progress * 100} barColor={bgColor} />
    </div>
  )
}
