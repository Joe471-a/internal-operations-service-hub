import { ChevronDown, KeyRound, LogOut } from 'lucide-react';
import { FormEvent, useEffect, useRef, useState } from 'react';
import { Session } from '../lib/session';
import { Avatar } from './Avatar';

interface SessionMenuProps {
  session: Session;
  onLogout: () => void;
  onChangePassword: (currentPassword: string, newPassword: string) => Promise<void>;
}

/**
 * Replaces the old "Acting as" dropdown - there is no switching identity
 * anymore, only the identity a real login proved. This is where that
 * identity is shown, and where the two things you can still do about your
 * own account (change your password, log out) live.
 */
export function SessionMenu({ session, onLogout, onChangePassword }: SessionMenuProps) {
  const [open, setOpen] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [justChanged, setJustChanged] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
        setChangingPassword(false);
        setError(null);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await onChangePassword(currentPassword, newPassword);
      setCurrentPassword('');
      setNewPassword('');
      setChangingPassword(false);
      setJustChanged(true);
      setTimeout(() => setJustChanged(false), 2500);
    } catch (problem) {
      setError((problem as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="session-menu" ref={containerRef}>
      <button type="button" className="session-chip" onClick={() => setOpen((value) => !value)}>
        <Avatar name={session.displayName} size={30} />
        <span className="session-chip-name">{session.displayName}</span>
        <ChevronDown size={14} className={`session-chip-chevron${open ? ' open' : ''}`} />
      </button>

      {open && (
        <div className="session-panel">
          {!changingPassword ? (
            <>
              <button
                type="button"
                className="session-panel-item"
                onClick={() => {
                  setChangingPassword(true);
                  setJustChanged(false);
                }}
              >
                <KeyRound size={14} />
                Change password
              </button>
              <button type="button" className="session-panel-item danger" onClick={onLogout}>
                <LogOut size={14} />
                Log out
              </button>
              {justChanged && <p className="session-panel-success">Password changed.</p>}
            </>
          ) : (
            <form className="session-password-form" onSubmit={handleSubmit}>
              <label htmlFor="current-password">Current password</label>
              <input
                id="current-password"
                type="password"
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
                required
              />
              <label htmlFor="new-password">New password</label>
              <input
                id="new-password"
                type="password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                minLength={6}
                required
              />
              {error && <p className="session-panel-error">{error}</p>}
              <div className="session-password-actions">
                <button
                  type="button"
                  className="session-password-cancel"
                  onClick={() => {
                    setChangingPassword(false);
                    setError(null);
                  }}
                >
                  Cancel
                </button>
                <button type="submit" disabled={busy}>
                  {busy ? 'Saving...' : 'Save'}
                </button>
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
