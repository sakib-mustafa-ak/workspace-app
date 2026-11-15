"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useAuth } from "@/contexts/auth-context";
import { UserPlus, Eye, EyeOff, Loader2 } from "lucide-react";
import { AuthPageShell } from "@/components/auth-page-shell";

function getPasswordStrength(password: string): {
  score: number;
  label: string;
  barColor: string;
  textColor: string;
} {
  let score = 0;
  if (password.length >= 12) score++;
  if (password.length >= 16) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;
  const labels = ["", "Weak", "Fair", "Good", "Strong", "Strong"];
  const barColors = [
    "",
    "bg-red-500",
    "bg-orange-500",
    "bg-yellow-500",
    "bg-emerald-500",
    "bg-emerald-500",
  ];
  const textColors = [
    "",
    "text-red-400",
    "text-orange-400",
    "text-yellow-400",
    "text-emerald-400",
    "text-emerald-400",
  ];
  return {
    score,
    label: labels[score] ?? "",
    barColor: barColors[score] ?? "",
    textColor: textColors[score] ?? "",
  };
}

export default function RegisterPage() {
  const { register } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{
    email?: string;
    password?: string;
    terms?: string;
  }>({});
  const [submitting, setSubmitting] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  const strength = getPasswordStrength(password);

  function validate(): boolean {
    const errors: { email?: string; password?: string; terms?: string } = {};
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.email = "Invalid email address";
    }
    if (password.length < 12) {
      errors.password = "Password must be at least 12 characters";
    } else if (
      !/[a-z]/.test(password) ||
      !/[A-Z]/.test(password) ||
      !/[0-9]/.test(password) ||
      !/[^A-Za-z0-9]/.test(password)
    ) {
      errors.password =
        "Password must include uppercase, lowercase, a number, and a symbol";
    }
    if (!acceptedTerms) {
      errors.terms = "You must accept the Terms of Service and Privacy Policy";
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (!validate()) return;
    setSubmitting(true);
    try {
      await register(email, password, name);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthPageShell>
      <div className="animate-fadeUp" style={{ animationDelay: "0.2s" }}>
        <div className="rounded-2xl border border-surface-800/50 bg-surface-900 p-6 sm:p-8 shadow-sm shadow-black/10">
          <div className="mb-8 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-primary-600/20 to-primary-600/10 shadow-sm shadow-primary-600/10">
              <UserPlus size={20} className="text-primary-400" />
            </div>
            <h1 className="text-xl font-bold">Create account</h1>
            <p className="mt-1 text-sm text-surface-400">
              Get started with your workspace
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-2.5 text-sm text-red-400">
                {error}
              </div>
            )}

            <div>
              <label
                htmlFor="register-name"
                className="mb-1.5 block text-sm font-medium text-surface-300"
              >
                Name
              </label>
              <input
                id="register-name"
                autoComplete="name"
                type="text"
                required
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-lg border border-surface-700 bg-surface-950/50 px-3.5 py-2.5 text-sm outline-none transition-colors placeholder:text-surface-500 focus:border-primary-500 focus:ring-1 focus:ring-primary-500/50"
                placeholder="Your name"
              />
            </div>

            <div>
              <label
                htmlFor="register-email"
                className="mb-1.5 block text-sm font-medium text-surface-300"
              >
                Email
              </label>
              <input
                id="register-email"
                autoComplete="email"
                type="email"
                required
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (fieldErrors.email)
                    setFieldErrors((prev) => ({ ...prev, email: "" }));
                }}
                className="w-full rounded-lg border border-surface-700 bg-surface-950/50 px-3.5 py-2.5 text-sm outline-none transition-colors placeholder:text-surface-500 focus:border-primary-500 focus:ring-1 focus:ring-primary-500/50"
                placeholder="you@example.com"
              />
              {fieldErrors.email && (
                <p className="mt-1 text-xs text-red-400">{fieldErrors.email}</p>
              )}
            </div>

            <div>
              <label
                htmlFor="register-password"
                className="mb-1.5 block text-sm font-medium text-surface-300"
              >
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (fieldErrors.password)
                      setFieldErrors((prev) => ({ ...prev, password: "" }));
                  }}
                  className="w-full rounded-lg border border-surface-700 bg-surface-950/50 px-3.5 py-2.5 pr-10 text-sm outline-none transition-colors placeholder:text-surface-500 focus:border-primary-500 focus:ring-1 focus:ring-primary-500/50"
                  placeholder="••••••••"
                  id="register-password"
                  autoComplete="new-password"
                  minLength={12}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((visible) => !visible)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  aria-pressed={showPassword}
                  aria-controls="register-password"
                  className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-lg text-surface-500 transition-colors hover:text-surface-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary-400"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {password && (
                <div className="mt-1.5">
                  <div className="flex gap-0.5">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <div
                        key={i}
                        className={`h-1 flex-1 rounded-full transition-colors ${
                          i <= strength.score
                            ? strength.barColor
                            : "bg-surface-700"
                        }`}
                      />
                    ))}
                  </div>
                  <p className={`mt-0.5 text-xs ${strength.textColor}`}>
                    {strength.label}
                  </p>
                </div>
              )}
              {fieldErrors.password && (
                <p className="mt-1 text-xs text-red-400">
                  {fieldErrors.password}
                </p>
              )}
            </div>

            <div>
              <label className="flex items-start gap-3">
                <input
                  type="checkbox"
                  checked={acceptedTerms}
                  onChange={(e) => {
                    setAcceptedTerms(e.target.checked);
                    if (fieldErrors.terms)
                      setFieldErrors((prev) => ({ ...prev, terms: "" }));
                  }}
                  className="mt-0.5 h-4 w-4 rounded border-surface-700 bg-surface-950 text-primary-600 focus:ring-primary-500/50"
                />
                <span className="text-sm text-surface-400">
                  I agree to the{" "}
                  <Link
                    href="/legal/terms"
                    className="font-medium text-primary-400 hover:text-primary-300"
                  >
                    Terms of Service
                  </Link>{" "}
                  and{" "}
                  <Link
                    href="/legal/privacy"
                    className="font-medium text-primary-400 hover:text-primary-300"
                  >
                    Privacy Policy
                  </Link>
                  .
                </span>
              </label>
              {fieldErrors.terms && (
                <p className="mt-1 text-xs text-red-400">{fieldErrors.terms}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-medium text-white transition-all hover:bg-primary-500 action-interaction disabled:opacity-50 disabled:shadow-none"
            >
              {submitting ? (
                <span className="flex items-center gap-2">
                  <Loader2 size={14} className="animate-spin" />
                  Creating account
                </span>
              ) : (
                "Create account"
              )}
            </button>
          </form>
        </div>
        <p className="mt-6 text-center text-sm text-surface-500">
          Already have an account?{" "}
          <Link
            href="/auth/login"
            className="font-medium text-primary-400 transition-colors hover:text-primary-300"
          >
            Sign in
          </Link>
        </p>
      </div>
    </AuthPageShell>
  );
}
