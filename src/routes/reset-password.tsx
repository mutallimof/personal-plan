import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Logo } from "@/components/Logo";
import { passwordProblem } from "@/features/auth/reset";

export const Route = createFileRoute("/reset-password")({
  head: () => ({ meta: [{ title: "New password — Lifeplan" }] }),
  component: ResetPasswordPage,
});

type Phase = "checking" | "ready" | "invalid" | "done";

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [phase, setPhase] = useState<Phase>("checking");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // The link in the email signs the person in for this one purpose. The client reads it from the address on load.
  useEffect(() => {
    let alive = true;
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (alive && (event === "PASSWORD_RECOVERY" || (event === "SIGNED_IN" && session)))
        setPhase("ready");
    });
    const params = new URLSearchParams(
      window.location.search + "&" + window.location.hash.replace(/^#/, ""),
    );
    const linkError = params.get("error_description");
    // give the client a moment to exchange the link, then look for the session it made
    const timer = window.setTimeout(async () => {
      const { data: s } = await supabase.auth.getSession();
      if (!alive) return;
      if (linkError) setError(linkError.replace(/\+/g, " "));
      setPhase((p) => (p === "checking" ? (s.session && !linkError ? "ready" : "invalid") : p));
    }, 1200);
    return () => {
      alive = false;
      window.clearTimeout(timer);
      data.subscription.unsubscribe();
    };
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const problem = passwordProblem(password, confirm);
    if (problem) return setError(problem);
    setBusy(true);
    setError(null);
    const { error: err } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (err) return setError(err.message);
    setPhase("done");
    window.setTimeout(() => navigate({ to: "/gym" }), 1500);
  }

  return (
    <main className="flex min-h-dvh items-center justify-center px-5 py-10">
      <div className="w-full max-w-sm space-y-6">
        <Logo markClassName="h-10 w-10" />
        <h1 className="text-4xl leading-none">New password</h1>
        {phase === "checking" && (
          <div className="h-40 animate-pulse tile" aria-label="Checking the link" />
        )}
        {phase === "invalid" && (
          <div className="space-y-3">
            <p role="alert" className="tile p-4 text-sm">
              {error ?? "This reset link is not valid any more."} Ask for a new one.
            </p>
            <Button asChild size="lg" className="w-full">
              <Link to="/auth">Back to sign in</Link>
            </Button>
          </div>
        )}
        {phase === "done" && (
          <p role="status" className="tile p-4 text-sm">
            Password changed. Taking you to the app.
          </p>
        )}
        {phase === "ready" && (
          <form onSubmit={submit} className="space-y-3">
            <Input
              className="h-12"
              type="password"
              autoComplete="new-password"
              aria-label="New password"
              placeholder="New password"
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <Input
              className="h-12"
              type="password"
              autoComplete="new-password"
              aria-label="Repeat new password"
              placeholder="Repeat new password"
              minLength={6}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
            />
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
            <Button size="lg" className="w-full" disabled={busy}>
              Save password
            </Button>
          </form>
        )}
      </div>
    </main>
  );
}
