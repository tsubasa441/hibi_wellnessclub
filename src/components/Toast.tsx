type Props = {
  message: string;
};

export default function Toast({ message }: Props) {
  return (
    <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-full bg-ink-700 text-white font-dm text-sm shadow-lg animate-fade-up w-max max-w-[calc(100vw-2rem)] text-center">
      {message}
    </div>
  );
}
