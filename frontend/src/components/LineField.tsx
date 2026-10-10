import type { ChangeEvent, ComponentProps, KeyboardEvent } from "react";
import AutoGrowTextarea from "./AutoGrowTextarea";

type LineFieldProps = ComponentProps<typeof AutoGrowTextarea>;

// A one-line field built on a textarea. Google's autofill row (passwords, cards,
// addresses) attaches to <input> boxes, but not to textareas.
export default function LineField({ onChange, onKeyDown, ...props }: LineFieldProps) {
  return (
    <AutoGrowTextarea
      enterKeyHint="done"
      {...props}
      onKeyDown={(event: KeyboardEvent<HTMLTextAreaElement>) => {
        if (event.key === "Enter") event.preventDefault();
        onKeyDown?.(event);
      }}
      onChange={(event: ChangeEvent<HTMLTextAreaElement>) => {
        // Some phone keyboards insert a line break anyway: collapse it to a space.
        if (/[\r\n]/.test(event.target.value)) {
          event.target.value = event.target.value.replace(/[\r\n]+/g, " ");
        }
        onChange?.(event);
      }}
    />
  );
}