import { useLayoutEffect, useRef, useCallback } from "react";
import type { TextareaHTMLAttributes, FocusEvent } from "react";

type AutoGrowTextareaProps = Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "value"> & {
  value: string;
};

// Walk up from the textarea to find the element that's actually scrolling.
// Falls back to `window` if nothing in between scrolls (plain document flow).
function getScrollParent(node: HTMLElement | null): HTMLElement | Window {
  let el = node?.parentElement ?? null;
  while (el) {
    const style = getComputedStyle(el);
    const canScrollY = style.overflowY === "auto" || style.overflowY === "scroll";
    if (canScrollY && el.scrollHeight > el.clientHeight) return el;
    el = el.parentElement;
  }
  return window;
}

// A textarea with no scrollbar that grows as you type, like writing in Notes.
export default function AutoGrowTextarea({
  value,
  className = "",
  onFocus,
  ...props
}: AutoGrowTextareaProps) {
  const ref = useRef<HTMLTextAreaElement>(null);

  // If the caret has drifted below what's actually visible (keyboard open,
  // textarea grew, or you're inside a scrolling sidebar panel), nudge
  // whichever container actually scrolls until the caret is back in view.
  const keepCaretVisible = useCallback(() => {
    const el = ref.current;
    if (!el || document.activeElement !== el) return;

    // visualViewport reflects the space actually left after the on-screen
    // keyboard opens; window.innerHeight does not reliably update on Android.
    const viewportHeight = window.visualViewport?.height ?? window.innerHeight;
    const rect = el.getBoundingClientRect();
    const overflow = rect.bottom - viewportHeight;
    if (overflow <= 0) return;

    const amount = overflow + 16; // small buffer so the caret line isn't glued to the edge
    const scrollParent = getScrollParent(el);

    if (scrollParent === window) {
      window.scrollBy({ top: amount, behavior: "auto" });
    } else {
      (scrollParent as HTMLElement).scrollBy({ top: amount, behavior: "auto" });
    }
  }, []);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Preserve scroll position of whichever container scrolls, so the
    // collapse-then-grow height trick below doesn't cause a visible jump.
    const scrollParent = getScrollParent(el);
    const prevScroll = scrollParent === window ? window.scrollY : (scrollParent as HTMLElement).scrollTop;

    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;

    if (scrollParent === window) {
      window.scrollTo(0, prevScroll);
    } else {
      (scrollParent as HTMLElement).scrollTop = prevScroll;
    }

    requestAnimationFrame(keepCaretVisible);
  }, [value, keepCaretVisible]);

  // Re-check whenever the keyboard itself opens/closes/resizes,
  // not just when you type.
  useLayoutEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    vv.addEventListener("resize", keepCaretVisible);
    return () => vv.removeEventListener("resize", keepCaretVisible);
  }, [keepCaretVisible]);

  return (
    <textarea
      ref={ref}
      rows={1}
      name="journal-summary"
      autoComplete="off"
      autoCorrect="on"
      autoCapitalize="sentences"
      inputMode="text"
      value={value}
      onFocus={(e: FocusEvent<HTMLTextAreaElement>) => {
        onFocus?.(e);
        keepCaretVisible();
      }}
      className={"block w-full resize-none overflow-hidden bg-transparent focus:outline-none " + className}
      {...props}
    />
  );
}