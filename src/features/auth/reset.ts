/** Where the reset email sends the person: the same address the app is open on, so localhost and the live site both work. */
export function resetRedirectUrl(origin: string): string {
  return `${origin.replace(/\/+$/, "")}/reset-password`;
}

/** The first problem with a new password, or null when it can be used. */
export function passwordProblem(password: string, confirm: string): string | null {
  if (password.length < 6) return "Use at least 6 characters.";
  if (password !== confirm) return "The two passwords do not match.";
  return null;
}
