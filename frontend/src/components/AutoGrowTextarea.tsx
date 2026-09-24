import { useLayoutEffect, useRef } from "react";
import type { TextareaHTMLAttributes } from "react";

type AutoGrowTextareaProps = Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "value"> & {
  value: string;
};

// A textarea with no scrollbar that grows as you type, like writing in Notes.
export default function AutoGrowTextarea({ value, className = "", ...props }: AutoGrowTextareaProps) {
  const ref = useRef<HTMLTextAreaElement>(null);

  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    element.style.height = "auto";
    element.style.height = `${element.scrollHeight}px`;
  }, [value]);

  return (
    <textarea
      ref={ref}
      rows={1}
      value={value}
      className={"block w-full resize-none overflow-hidden bg-transparent focus:outline-none " + className}
      {...props}
    />
  );
}