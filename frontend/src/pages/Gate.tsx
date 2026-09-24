import { ArrowRight, LoaderCircle } from "lucide-react";
import { useState } from "react";
import type { FormEvent } from "react";
import { loginErrorMessage } from "../api/auth.api";
import { useAuth } from "../components/AuthProvider";

export default function Gate() {
  const { unlock } = useAuth();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [shakeKey, setShakeKey] = useState(0);

  const canSubmit = password.length > 0 && !submitting;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
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

  return (
    <main className="flex min-h-screen items-center justify-center px-6 pb-[env(safe-area-inset-bottom)] pt-[env(safe-area-inset-top)]">
      <div className="fade-up w-full max-w-sm text-center">
        <h1 className="text-[40px] font-light leading-tight tracking-tight sm:text-5xl">
          Harsh&apos;s Journal
        </h1>
        <p className="mt-3 text-[17px] text-secondary">A private archive of my life.</p>

        <form onSubmit={handleSubmit} className="mt-12">
          <div
            key={shakeKey}
            className={
              "relative rounded-2xl border bg-surface shadow-card transition-colors focus-within:border-tertiary " +
              (error ? "shake border-alert/60" : "border-border")
            }
          >
            <label htmlFor="password" className="sr-only">
              Password
            </label>
            <input
              id="password"
              type="password"
              autoFocus
              autoComplete="current-password"
              placeholder="Password"
              value={password}
              disabled={submitting}
              onChange={(event) => {
                setPassword(event.target.value);
                if (error) setError("");
              }}
              className="h-14 w-full rounded-2xl bg-transparent pl-5 pr-14 text-[17px] text-text placeholder:text-tertiary focus:outline-none"
            />
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