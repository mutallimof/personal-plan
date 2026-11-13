import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Logo } from "@/components/Logo";
import { resetRedirectUrl } from "@/features/auth/reset";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — Lifeplan" },
      { name: "description", content: "Sign in to Lifeplan to see your plan." },
      { property: "og:title", content: "Sign in — Lifeplan" },
      { property: "og:description", content: "Sign in to Lifeplan to see your plan." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"in" | "up" | "reset">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/gym" });
    });
    const { data } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session) navigate({ to: "/gym" });
    });
    return () => data.subscription.unsubscribe();
  }, [navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    if (mode === "reset") {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: resetRedirectUrl(window.location.origin),
      });
      if (error) toast.error(error.message);
      else setSent(true);
    } else if (mode === "in") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) toast.error(error.message);
    } else {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: window.location.origin },
      });
      if (error) toast.error(error.message);
      else if (!data.session) setSent(true);
    }
    setBusy(false);
  }

  async function google() {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin + "/onboarding" },
    });
    if (error) toast.error(error.message);
  }

  return (
    <main className="flex min-h-dvh items-center justify-center px-5 py-10">
      <div className="w-full max-w-sm space-y-6">
        <Logo markClassName="h-10 w-10" />
        <h1 className="text-4xl leading-none">
          {mode === "in" ? "Welcome back" : mode === "up" ? "Create account" : "Reset password"}
        </h1>
        {sent ? (
          <p role="status" className="tile p-4 text-sm">
            {mode === "reset"
              ? "If that email has an account, a reset link is on its way. Check your inbox."
              : "Check your email to confirm your account."}
          </p>
        ) : (
          <form onSubmit={submit} className="space-y-3">
            <Input
              className="h-12"
              type="email"
              autoComplete="email"
              aria-label="Email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            {mode !== "reset" && (
              <Input
                className="h-12"
                type="password"
                autoComplete={mode === "in" ? "current-password" : "new-password"}
                aria-label="Password"
                placeholder="Password"
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            )}
            {mode === "in" && (
              <button
                type="button"
                className="min-h-11 text-sm font-medium text-primary-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                onClick={() => setMode("reset")}
              >
                Forgot password?
              </button>
            )}
            <Button size="lg" className="w-full" disabled={busy}>
              {mode === "in" ? "Sign in" : mode === "up" ? "Sign up" : "Send reset link"}
            </Button>
          </form>
        )}
        {mode !== "reset" && (
          <button
            type="button"
            onClick={google}
            // colours from Google's sign-in button guidelines, light and dark
            className="press flex h-13 w-full items-center justify-center gap-[10px] rounded-full border border-[#747775] bg-[#FFFFFF] px-3 text-sm font-medium text-[#1F1F1F] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:border-[#8E918F] dark:bg-[#131314] dark:text-[#E3E3E3]"
          >
            <svg
              aria-hidden="true"
              width="18"
              height="18"
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
            >
              <path
                fill="#4285F4"
                d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z"
              />
              <path
                fill="#34A853"
                d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09C3.26 21.3 7.31 24 12 24z"
              />
              <path
                fill="#FBBC05"
                d="M5.27 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.98-3.09z"
              />
              <path
                fill="#EA4335"
                d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.98 3.09c.95-2.85 3.6-4.96 6.73-4.96z"
              />
            </svg>
            Continue with Google
          </button>
        )}
        <button
          type="button"
          className="min-h-11 w-full rounded-full text-sm font-medium text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onClick={() => {
            setSent(false);
            setMode(mode === "in" ? "up" : "in");
          }}
        >
          {mode === "in"
            ? "No account? Sign up"
            : mode === "up"
              ? "Have an account? Sign in"
              : "Back to sign in"}
        </button>
      </div>
    </main>
  );
}
