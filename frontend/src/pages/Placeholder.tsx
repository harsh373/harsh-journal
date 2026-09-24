interface PlaceholderProps {
  title: string;
}

// Temporary page for sections that are built in later features.
export default function Placeholder({ title }: PlaceholderProps) {
  return (
    <div className="mx-auto max-w-3xl px-6 py-10 lg:px-12 lg:py-16">
      <h1 className="text-4xl font-light tracking-tight lg:text-5xl">{title}</h1>
      <p className="mt-6 text-[15px] text-tertiary">This section is built in a later feature.</p>
    </div>
  );
}