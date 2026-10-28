"use client";
import { useState } from "react";
import { useSearchParams } from "next/navigation";
export function Login({ configured }: { configured: boolean }) {
  const params = useSearchParams();
  const [message, setMessage] = useState(
    params.has("error")
      ? "This sign-in link is invalid or expired. Request a new one."
      : "",
  );
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="panel stack"
      onSubmit={async (event) => {
        event.preventDefault();
        setBusy(true);
        setMessage("");
        const email = String(new FormData(event.currentTarget).get("email"));
        try {
          const response = await fetch("/api/auth/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email }),
          });
          const data = await response.json();
          setMessage(data.error ?? data.message);
        } catch {
          setMessage("The request could not reach the server. Try again.");
        } finally {
          setBusy(false);
        }
      }}
    >
      <label>
        Email address
        <input
          type="email"
          name="email"
          autoComplete="email"
          required
          maxLength={254}
          placeholder="you@example.com"
        />
      </label>
      <button disabled={busy || !configured}>
        {busy ? "Sending link…" : "Email me a sign-in link"}
      </button>
      {!configured && (
        <p role="status">
          Private archive setup is pending. You can explore the synthetic demo
          now.
        </p>
      )}
      <p role="status" aria-live="polite">
        {message}
      </p>
    </form>
  );
}
