import { useEffect } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { Link } from "react-router-dom";
import type { LibraryPhoto } from "../api/photoLibrary.api";
import { formatLongDate } from "../config/dates";

interface LightboxProps {
  photo: LibraryPhoto;
  onClose: () => void;
  onPrev?: () => void;
  onNext?: () => void;
}

// Read-only viewer. Captions are edited from the original day/quest, not here —
// this is intentional per the locked Photos-library decision.
export default function Lightbox({ photo, onClose, onPrev, onNext }: LightboxProps) {
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowLeft" && onPrev) onPrev();
      if (event.key === "ArrowRight" && onNext) onNext();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, onPrev, onNext]);

  return (
    <div
      className="page-in fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xl"
      onClick={onClose}
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        className="absolute right-5 top-5 flex h-9 w-9 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur-sm transition hover:bg-black/60"
      >
        <X size={18} />
      </button>

      {onPrev && (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onPrev();
          }}
          aria-label="Previous photo"
          className="absolute left-4 flex h-10 w-10 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur-sm transition hover:bg-black/60"
        >
          <ChevronLeft size={20} />
        </button>
      )}

      {onNext && (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onNext();
          }}
          aria-label="Next photo"
          className="absolute right-4 flex h-10 w-10 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur-sm transition hover:bg-black/60"
        >
          <ChevronRight size={20} />
        </button>
      )}

      <div className="mx-4 flex max-h-[85vh] max-w-[900px] flex-col items-center" onClick={(e) => e.stopPropagation()}>
        <img
          src={photo.url}
          alt={photo.caption ?? ""}
          className="max-h-[70vh] w-auto rounded-[14px] object-contain shadow-window"
        />
        <div className="mt-4 w-full text-center">
          {photo.caption && <p className="text-[15px] leading-relaxed text-white">{photo.caption}</p>}
          <p className="mt-1 text-[13px] text-white/60">
            {formatLongDate(photo.date)} ·{" "}
            <Link to={photo.sourceHref} className="underline underline-offset-2 hover:text-white">
              {photo.sourceLabel}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}