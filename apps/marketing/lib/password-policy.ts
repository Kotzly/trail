/**
 * Trail password policy (mirrors `supabase/config.toml` —
 * `lower_upper_letters_digits_symbols` + min 8). Surface the same
 * hints client-side so users get instant feedback; Supabase remains
 * authoritative on submit.
 */

export const PASSWORD_MIN_LENGTH = 8;

export type PolicyHint = {
  label: string;
  ok: boolean;
};

export type PolicyResult = {
  valid: boolean;
  hints: PolicyHint[];
};

const SYMBOL_RE = /[!@#$%^&*()_\-+=[\]{};:'",.<>?/\\|`~]/;

export function evaluatePasswordPolicy(password: string): PolicyResult {
  const hints: PolicyHint[] = [
    {
      label: `At least ${PASSWORD_MIN_LENGTH} characters`,
      ok: password.length >= PASSWORD_MIN_LENGTH,
    },
    { label: "Lowercase letter", ok: /[a-z]/.test(password) },
    { label: "Uppercase letter", ok: /[A-Z]/.test(password) },
    { label: "Number", ok: /[0-9]/.test(password) },
    { label: "Symbol", ok: SYMBOL_RE.test(password) },
  ];
  return { valid: hints.every((h) => h.ok), hints };
}
