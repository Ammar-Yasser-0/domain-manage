import { useState, type FormEvent } from "react";
import {
  AlertCircle,
  Eye,
  EyeOff,
  Globe2,
  LoaderCircle,
  LockKeyhole,
  ShieldCheck,
} from "lucide-react";
import { ApiClientError } from "../lib/api";

interface LoginPageProps {
  configured: boolean;
  notice: string;
  onLogin: (password: string) => Promise<void>;
}

export function LoginPage({ configured, notice, onLogin }: LoginPageProps) {
  const [password, setPassword] = useState("");
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if ([...password].length < 12) {
      setError("Enter the password configured for this workspace.");
      return;
    }

    setSubmitting(true);

    try {
      await onLogin(password);
    } catch (caught) {
      setError(
        caught instanceof ApiClientError
          ? caught.message
          : "Sign-in is unavailable right now. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="login-shell">
      <div aria-hidden="true" className="login-orb login-orb--one" />
      <div aria-hidden="true" className="login-orb login-orb--two" />

      <section aria-labelledby="login-title" className="login-card">
        <div className="login-brand">
          <span className="login-brand-icon">
            <Globe2 size={29} strokeWidth={1.8} aria-hidden="true" />
          </span>
          <div>
            <strong>DomainFlow</strong>
            <span>Domain Renewal Manager</span>
          </div>
        </div>

        <div className="login-heading">
          <span className="login-lock-icon">
            <LockKeyhole size={19} aria-hidden="true" />
          </span>
          <p className="eyebrow">Private workspace</p>
          <h1 id="login-title">Welcome back</h1>
          <p>Enter your password to manage your domains.</p>
        </div>

        {notice && (
          <div className="login-notice" role="status">
            <AlertCircle size={17} aria-hidden="true" />
            <span>{notice}</span>
          </div>
        )}

        {!configured && (
          <div className="login-error" role="alert">
            <AlertCircle size={18} aria-hidden="true" />
            <span>
              Login is not configured. Set APP_PASSWORD_HASH and SESSION_SECRET in the server environment.
            </span>
          </div>
        )}

        <form className="login-form" onSubmit={(event) => void handleSubmit(event)}>
          <label className="login-label" htmlFor="domainflow-password">
            Password
          </label>
          <div className="login-password-field">
            <input
              autoComplete="current-password"
              autoFocus
              aria-describedby={error ? "login-error" : undefined}
              aria-invalid={Boolean(error)}
              disabled={!configured || submitting}
              id="domainflow-password"
              maxLength={1024}
              minLength={12}
              onChange={(event) => {
                setPassword(event.target.value);
                setError("");
              }}
              placeholder="Enter your workspace password"
              required
              type={passwordVisible ? "text" : "password"}
              value={password}
            />
            <button
              aria-label={passwordVisible ? "Hide password" : "Show password"}
              className="password-visibility"
              disabled={!configured || submitting}
              onClick={() => setPasswordVisible((visible) => !visible)}
              type="button"
            >
              {passwordVisible ? (
                <EyeOff size={18} aria-hidden="true" />
              ) : (
                <Eye size={18} aria-hidden="true" />
              )}
            </button>
          </div>

          {error && (
            <p className="login-error login-error--field" id="login-error" role="alert">
              <AlertCircle size={16} aria-hidden="true" />
              <span>{error}</span>
            </p>
          )}

          <button
            className="button button--primary login-submit"
            disabled={!configured || submitting || password.length === 0}
            type="submit"
          >
            {submitting ? (
              <>
                <LoaderCircle className="login-spinner" size={18} aria-hidden="true" />
                Signing in…
              </>
            ) : (
              <>
                <LockKeyhole size={17} aria-hidden="true" />
                Sign in
              </>
            )}
          </button>
        </form>

        <div className="login-security-note">
          <ShieldCheck size={16} aria-hidden="true" />
          <span>Protected access for your private workspace</span>
        </div>
      </section>
      <p className="login-footer">DomainFlow · Domain Renewal Manager</p>
    </main>
  );
}
