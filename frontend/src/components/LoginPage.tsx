import { AlertCircle, ArrowRight, Eye, EyeOff, Loader2, Lock, Radar, ShieldCheck, User, Workflow, Zap } from 'lucide-react';
import { FormEvent, KeyboardEvent, useState } from 'react';
import { login } from '../api/requests';
import { Session } from '../lib/session';
import { Theme } from '../lib/theme';
import { ThemeToggle } from './ThemeToggle';

interface LoginPageProps {
  onLogin: (session: Session) => void;
  theme: Theme;
  onToggleTheme: () => void;
}

const HIGHLIGHTS = [
  { icon: Workflow, text: 'One queue for IT, HR and Finance requests' },
  { icon: Zap, text: 'Automatic AI triage on every submission' },
  { icon: ShieldCheck, text: 'Role-based access with a full audit trail' },
];

export function LoginPage({ onLogin, theme, onToggleTheme }: LoginPageProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const result = await login(username.trim(), password);
      onLogin({
        token: result.token,
        actorId: result.actorId,
        displayName: result.displayName,
        role: result.role,
        department: result.department,
      });
    } catch (problem) {
      setError((problem as Error).message);
      setBusy(false);
    }
  }

  function handlePasswordKey(event: KeyboardEvent<HTMLInputElement>) {
    setCapsLock(event.getModifierState('CapsLock'));
  }

  return (
    <div className="login-page">
      <div className="login-theme-toggle">
        <ThemeToggle theme={theme} onToggle={onToggleTheme} />
      </div>

      <div className="login-shell">
        <aside className="login-hero" aria-hidden="true">
          <div className="login-hero-brand">
            <span className="login-logo">
              <Radar size={22} />
            </span>
            <span>Internal Hub</span>
          </div>

          <div className="login-hero-copy">
            <h2>Every internal request, in one place.</h2>
            <p>Submit, route and resolve work across departments without chasing anyone down.</p>
          </div>

          <ul className="login-highlights">
            {HIGHLIGHTS.map(({ icon: Icon, text }) => (
              <li key={text}>
                <span className="login-highlight-icon">
                  <Icon size={16} />
                </span>
                {text}
              </li>
            ))}
          </ul>
        </aside>

        <main className="login-panel">
          <div className="login-panel-inner">
            <div className="login-mobile-brand">
              <span className="login-logo">
                <Radar size={20} />
              </span>
              <span>Internal Hub</span>
            </div>

            <h1 className="login-title">Welcome back</h1>
            <p className="login-subtitle">Sign in with your hub account to continue.</p>

            <form className="login-form" onSubmit={handleSubmit}>
              <div className="login-group">
                <label htmlFor="login-username">Username</label>
                <div className="login-field">
                  <User size={17} />
                  <input
                    id="login-username"
                    value={username}
                    onChange={(event) => setUsername(event.target.value)}
                    placeholder="Username"
                    autoFocus
                    autoComplete="username"
                    autoCapitalize="none"
                    spellCheck={false}
                    required
                  />
                </div>
              </div>

              <div className="login-group">
                <label htmlFor="login-password">Password</label>
                <div className="login-field">
                  <Lock size={17} />
                  <input
                    id="login-password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    onKeyDown={handlePasswordKey}
                    onKeyUp={handlePasswordKey}
                    onBlur={() => setCapsLock(false)}
                    placeholder="Enter your password"
                    autoComplete="current-password"
                    required
                  />
                  <button
                    type="button"
                    className="login-reveal"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    aria-pressed={showPassword}
                    onClick={() => setShowPassword((current) => !current)}
                  >
                    {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                  </button>
                </div>
                {capsLock && <p className="login-hint">Caps Lock is on</p>}
              </div>

              {error && (
                <p className="login-error" role="alert">
                  <AlertCircle size={16} />
                  <span>{error}</span>
                </p>
              )}

              <button type="submit" className="login-submit" disabled={busy || !username.trim() || !password}>
                {busy ? (
                  <>
                    <Loader2 size={17} className="login-spinner" />
                    Signing in…
                  </>
                ) : (
                  <>
                    Sign in
                    <ArrowRight size={17} />
                  </>
                )}
              </button>
            </form>

            <p className="login-footnote">
              Accounts are created by your hub administrator. Need access? Ask them to add you.
            </p>
          </div>
        </main>
      </div>
    </div>
  );
}
