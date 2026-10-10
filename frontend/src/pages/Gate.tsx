import { ArrowRight, LoaderCircle } from "lucide-react";
import { useState } from "react";
import type { ChangeEvent, KeyboardEvent } from "react";
import { loginErrorMessage } from "../api/auth.api";
import { useAuth } from "../components/AuthProvider";

// Chrome/Safari/Android can mask 
const CAN_MASK_TEXTAREA =
  typeof CSS !== "undefined" && typeof CSS.supports === "function" && CSS.supports("-webkit-text-security", "disc");

export default function Gate() {
  const { unlock } = useAuth();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [shakeKey, setShakeKey] = useState(0);

  const canSubmit = password.length > 0 && !submitting;

  async function submit() {
    if (!canSubmit) return;

    setSubmitting(true);
    setError("");
    try {
      await unlock(password);
    } catch (err) {
      setError(loginErrorMessage(err));
      setShakeKey((key) => key + 1);
      setPassword("");
      setSubmitting(false);
    }
  }

  function handleChange(value: string) {
    setPassword(value);
    if (error) setError("");
  }

  const fieldClass =
    "h-14 w-full rounded-card bg-transparent pl-5 pr-14 text-[17px] text-text placeholder:text-tertiary focus:outline-none";

  return (
    <main className="flex min-h-full items-center justify-center bg-bg px-6 pb-[env(safe-area-inset-bottom)] pt-[env(safe-area-inset-top)]">
      <div className="fade-up w-full max-w-sm py-10 text-center">
        <img
          src="/logo.png"
          alt=""
          aria-hidden="true"
          draggable={false}
          className="mx-auto h-16 w-16 select-none rounded-[16px] object-contain ring-1 ring-border"
        />
        <h1 className="mt-6 font-serif text-[2.25rem] font-medium leading-tight tracking-tight sm:text-[2.75rem]">
          Harsh&apos;s Journal
        </h1>
        <p className="mt-3 text-[17px] text-secondary">A private archive of my life.</p>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
          className="mt-10"
        >
          <div
            key={shakeKey}
            className={
              "relative rounded-card border bg-surface transition-colors focus-within:border-secondary " +
              (error ? "shake border-alert/60" : "border-border")
            }
          >
            <label htmlFor="gate-secret" className="sr-only">
              Password
            </label>

            {CAN_MASK_TEXTAREA ? (
              <textarea
                id="gate-secret"
                rows={1}
                autoFocus
                placeholder="Password"
                value={password}
                disabled={submitting}
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="none"
                spellCheck={false}
                enterKeyHint="go"
                onChange={(event: ChangeEvent<HTMLTextAreaElement>) =>
                  handleChange(event.target.value.replace(/[\r\n]+/g, ""))
                }
                onKeyDown={(event: KeyboardEvent<HTMLTextAreaElement>) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    void submit();
                  }
                }}
                className={fieldClass + " block resize-none overflow-hidden py-4 leading-6 [-webkit-text-security:disc]"}
              />
            ) : (
              <input
                id="gate-secret"
                type="password"
                autoFocus
                placeholder="Password"
                value={password}
                disabled={submitting}
                autoComplete="off"
                onChange={(event) => handleChange(event.target.value)}
                className={fieldClass}
              />
            )}

            <button
              type="submit"
              disabled={!canSubmit}
              aria-label="Enter"
              className="absolute right-2 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-text text-bg transition-all duration-200 enabled:hover:opacity-85 disabled:bg-selected disabled:text-tertiary"
            >
              {submitting ? <LoaderCircle size={18} className="animate-spin" /> : <ArrowRight size={18} />}
            </button>
          </div>

          <p role="alert" className="mt-4 h-5 text-[15px] text-alert">
            {error}
          </p>
        </form>
      </div>
    </main>
  );
}