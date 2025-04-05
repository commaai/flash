interface CopyTextProps {
  children: string;
}

export function CopyText({ children: text }: CopyTextProps) {
  return (
    <div className="relative text-sm">
      <pre className="font-mono pt-12">{text}</pre>
      <button
        className="absolute top-2 right-2 bg-blue-600 hover:bg-blue-500 active:bg-blue-300 transition-colors text-white p-1 rounded-md"
        onClick={() => navigator.clipboard.writeText(text)}
      >
        Copy
      </button>
    </div>
  );
}
