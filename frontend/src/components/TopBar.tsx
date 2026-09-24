import { Search } from 'lucide-react';
import { Session } from '../lib/session';
import { Theme } from '../lib/theme';
import { SessionMenu } from './SessionMenu';
import { ThemeToggle } from './ThemeToggle';

interface TopBarProps {
  breadcrumb: string;
  session: Session;
  onLogout: () => void;
  onChangePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
  theme: Theme;
  onToggleTheme: () => void;
}

export function TopBar({
  breadcrumb,
  session,
  onLogout,
  onChangePassword,
  searchQuery,
  onSearchChange,
  theme,
  onToggleTheme,
}: TopBarProps) {
  return (
    <header className="topbar">
      <p className="breadcrumb">
        Requests <span>/</span> {breadcrumb}
      </p>

      {onSearchChange && (
        <div className="topbar-search">
          <Search size={15} />
          <input
            type="search"
            placeholder="Search requests..."
            value={searchQuery}
            onChange={(event) => onSearchChange(event.target.value)}
          />
        </div>
      )}

      <div className="topbar-actions">
        <ThemeToggle theme={theme} onToggle={onToggleTheme} />
        <SessionMenu session={session} onLogout={onLogout} onChangePassword={onChangePassword} />
      </div>
    </header>
  );
}
