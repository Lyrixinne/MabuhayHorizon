// Database messages written for people are shown as they are.
// Anything that looks technical is replaced by a plain sentence.
const TECHNICAL =
  /violates|row-level security|row level security|permission denied|relation "|column "|constraint|PGRST|JWT|syntax|duplicate key|null value|function public\.|schema|stack|undefined|TypeError|ReferenceError|Network request failed|fetch failed|ECONN|timeout|socket|postgres|supabase|non-2xx/i;

const AUTH_MESSAGES: Record<string, string> = {
  "invalid login credentials": "Invalid email or password.",
  "email not confirmed": "Please confirm your email first, then sign in.",
  "user already registered": "An account with this email already exists.",
};

export function friendlyError(error: unknown, fallback: string): string {
  if (!error) return fallback;
  const message =
    typeof (error as { message?: unknown }).message === "string"
      ? ((error as { message: string }).message)
      : "";
  const lower = message.toLowerCase();
  for (const key of Object.keys(AUTH_MESSAGES)) {
    if (lower.includes(key)) return AUTH_MESSAGES[key];
  }
  if (lower.includes("network request failed") || lower.includes("failed to fetch")) {
    return "No connection. Check your internet and try again.";
  }
  if (message && message.length <= 200 && !TECHNICAL.test(message)) return message;
  return fallback;
}
