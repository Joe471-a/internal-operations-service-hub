import { FormEvent, useEffect, useState } from 'react';
import {
  changePassword as changePasswordRequest,
  createRequest,
  Department,
  fetchById,
  fetchVisible,
  RequestView,
  ServiceRequest,
  transitionRequest,
} from './api/requests';
import { LoginPage } from './components/LoginPage';
import { RequestTable } from './components/RequestTable';
import { Sidebar } from './components/Sidebar';
import { StatsOverview } from './components/StatsOverview';
import { SubmitPage } from './components/SubmitPage';
import { Toast } from './components/Toast';
import { TopBar } from './components/TopBar';
import { getViewLabel, VIEWS_WITH_STATS } from './lib/constants';
import { clearSession, getSession, setSession as persistSession, Session } from './lib/session';
import { applyTheme, getInitialTheme, Theme } from './lib/theme';

type Page = 'home' | 'submit';

export default function App() {
  const [session, setSessionState] = useState<Session | null>(getSession);
  const [page, setPage] = useState<Page>('home');
  const [theme, setTheme] = useState<Theme>(getInitialTheme);
  const [view, setView] = useState<RequestView>('all');
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [requests, setRequests] = useState<ServiceRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [department, setDepartment] = useState<Department>('IT');

  const [historyView, setHistoryView] = useState<ServiceRequest | null>(null);

  /** A 401 already cleared storage (see api/requests.ts's readResponse) - this notices and bounces back to the login page. */
  function syncSessionFromStorage() {
    if (!getSession()) setSessionState(null);
  }

  async function load(forView: RequestView) {
    setLoading(true);
    setError(null);
    try {
      setRequests(await fetchVisible(forView));
    } catch (problem) {
      syncSessionFromStorage();
      setError((problem as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!session) return;
    load(view);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, view]);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  useEffect(() => {
    if (!successMessage) return;
    const timer = setTimeout(() => setSuccessMessage(null), 2600);
    return () => clearTimeout(timer);
  }, [successMessage]);

  function handleLogin(newSession: Session) {
    persistSession(newSession);
    setSessionState(newSession);
    setPage('home');
    setView('all');
    setStatusFilter(null);
    setSearchQuery('');
    setHistoryView(null);
  }

  function handleLogout() {
    clearSession();
    setSessionState(null);
    setRequests([]);
    setPage('home');
  }

  async function handleChangePassword(currentPassword: string, newPassword: string) {
    await changePasswordRequest(currentPassword, newPassword);
  }

  function handleViewChange(nextView: RequestView) {
    setPage('home');
    setView(nextView);
    setStatusFilter(null);
    setSearchQuery('');
  }

  /** A stat card filters the table to that exact status within the view already open - stat cards only exist on views that fetch every status, so the count on the card matches what the table then shows. */
  function handleSelectStatus(status: string) {
    setStatusFilter(status);
    setSearchQuery('');
  }

  function openSubmitPage() {
    setPage('submit');
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const created = await createRequest(title, description, department);
      setTitle('');
      setDescription('');
      setPage('home');
      setSuccessMessage(`Request ${created.id} submitted`);
      await load(view);
    } catch (problem) {
      syncSessionFromStorage();
      setError((problem as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function handleTransition(requestId: string, to: string) {
    setBusy(true);
    setError(null);
    try {
      await transitionRequest(requestId, to);
      await load(view);
    } catch (problem) {
      // A refusal must not wipe the list the user is looking at.
      syncSessionFromStorage();
      setError((problem as Error).message);
    } finally {
      setBusy(false);
    }
  }

  /** Collapses if this row is already expanded, otherwise fetches its history and expands it. */
  async function handleToggleHistory(requestId: string) {
    if (historyView?.id === requestId) {
      setHistoryView(null);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      setHistoryView(await fetchById(requestId));
    } catch (problem) {
      syncSessionFromStorage();
      setError((problem as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (!session) {
    return (
      <LoginPage
        onLogin={handleLogin}
        theme={theme}
        onToggleTheme={() => setTheme((current) => (current === 'dark' ? 'light' : 'dark'))}
      />
    );
  }

  return (
    <div className="app-shell">
      <Sidebar role={session.role} view={view} onViewChange={handleViewChange} onNewRequest={openSubmitPage} />

      <div className="main">
        <TopBar
          breadcrumb={page === 'home' ? getViewLabel(session.role, view) : 'Submit a Request'}
          session={session}
          onLogout={handleLogout}
          onChangePassword={handleChangePassword}
          searchQuery={page === 'home' ? searchQuery : undefined}
          onSearchChange={page === 'home' ? setSearchQuery : undefined}
          theme={theme}
          onToggleTheme={() => setTheme((current) => (current === 'dark' ? 'light' : 'dark'))}
        />

        <div className="content">
          {error && <p className="error">{error}</p>}

          {page === 'home' ? (
            <>
              {VIEWS_WITH_STATS.includes(view) && (
                <StatsOverview requests={requests} onSelectStatus={handleSelectStatus} />
              )}

              <RequestTable
                requests={requests}
                loading={loading}
                busy={busy}
                searchQuery={searchQuery}
                statusFilter={statusFilter}
                onClearStatusFilter={() => setStatusFilter(null)}
                expandedRequest={historyView}
                onToggleHistory={handleToggleHistory}
                onTransition={handleTransition}
                actorId={session.actorId}
              />
            </>
          ) : (
            <SubmitPage
              title={title}
              description={description}
              department={department}
              busy={busy}
              onTitleChange={setTitle}
              onDescriptionChange={setDescription}
              onDepartmentChange={setDepartment}
              onSubmit={handleSubmit}
              onCancel={() => setPage('home')}
            />
          )}
        </div>
      </div>

      {successMessage && <Toast message={successMessage} />}
    </div>
  );
}
