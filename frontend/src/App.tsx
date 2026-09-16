import { FormEvent, useEffect, useState } from 'react';
import {
  ActorId,
  Department,
  ServiceRequest,
  createRequest,
  fetchAll,
  fetchById,
  transitionRequest,
} from './api/requests';

/**
 * Teaching-only actor picker. In a real hub you would be signed in and this
 * list would not exist - the screen would never get to choose who it is.
 *
 * Action buttons below are offered by *status*, not by whether this actor
 * could plausibly use them - the hub itself (actors.ts) is what actually
 * decides who is allowed to act, the same way shoplite always shows "Mark
 * as Delivered" and lets the backend refuse a customer. That is what makes
 * a refusal something you can click and see, not just something true in
 * theory. The "History" button follows the same idea: it is always there,
 * and an employee viewing a request that is not theirs finds that out from
 * a real refusal, not from a hidden button.
 */
const ACTORS: { id: ActorId; label: string }[] = [
  { id: 'emp-001', label: 'Dana Karam — Employee' },
  { id: 'it-staff-001', label: 'Yara Fakhoury — IT Staff' },
  { id: 'it-lead-001', label: 'Karim Rahal — IT Lead' },
  { id: 'hr-lead-001', label: 'Sami Nassar — HR Lead' },
  { id: 'finance-staff-001', label: 'Tarek Sleiman — Finance Staff' },
  { id: 'finance-lead-001', label: 'Layla Haddad — Finance Lead' },
];

const DEPARTMENTS: Department[] = ['IT', 'HR', 'FINANCE'];

function formatStatus(value: string): string {
  const words = value.replace(/_/g, ' ').toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

function formatTime(value: string): string {
  return new Date(value).toLocaleString();
}

/** The name the hub knows this actor id by, or the raw id if it's unknown. */
function actorName(actorId: string): string {
  return ACTORS.find((actor) => actor.id === actorId)?.label ?? actorId;
}

export default function App() {
  const [actorId, setActorId] = useState<ActorId>('emp-001');
  const [requests, setRequests] = useState<ServiceRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [department, setDepartment] = useState<Department>('IT');

  const [historyView, setHistoryView] = useState<ServiceRequest | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      setRequests(await fetchAll());
    } catch (problem) {
      setError((problem as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await createRequest(title, description, department, actorId);
      setTitle('');
      setDescription('');
      await load();
    } catch (problem) {
      setError((problem as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function handleTransition(requestId: string, to: string) {
    setBusy(true);
    setError(null);
    try {
      await transitionRequest(requestId, to, actorId);
      await load();
    } catch (problem) {
      // A refusal must not wipe the list the user is looking at.
      setError((problem as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function handleViewHistory(requestId: string) {
    setBusy(true);
    setError(null);
    try {
      setHistoryView(await fetchById(requestId, actorId));
    } catch (problem) {
      setError((problem as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="page">
      <header className="page-header">
        <h1>Internal Operations Service Hub</h1>
        <p className="tagline">Submit a request, or handle a department's queue.</p>
      </header>

      <div className="actor-picker">
        <label htmlFor="actor">Acting as</label>
        <select id="actor" value={actorId} onChange={(event) => setActorId(event.target.value as ActorId)}>
          {ACTORS.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      {error && <p className="error">{error}</p>}

      <section className="panel">
        <h2>Submit a Request</h2>
        <form className="submit-form" onSubmit={handleSubmit}>
          <label htmlFor="title">Title</label>
          <input
            id="title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Laptop won't turn on"
            required
          />

          <label htmlFor="description">Description</label>
          <textarea
            id="description"
            rows={3}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="What do you need help with?"
            required
          />

          <label htmlFor="department">Department</label>
          <select id="department" value={department} onChange={(event) => setDepartment(event.target.value as Department)}>
            {DEPARTMENTS.map((dept) => (
              <option key={dept} value={dept}>
                {dept}
              </option>
            ))}
          </select>

          <button type="submit" disabled={busy}>
            {busy ? 'Submitting...' : 'Submit Request'}
          </button>
        </form>
      </section>

      {historyView && (
        <section className="panel history-panel">
          <div className="history-panel-header">
            <h2>
              History — {historyView.id}: {historyView.title}
            </h2>
            <button onClick={() => setHistoryView(null)}>Close</button>
          </div>
          <p className="hint">
            {historyView.department} · submitted by {actorName(historyView.submittedBy)}
          </p>
          <ul className="history-timeline">
            {historyView.history.map((event, index) => (
              <li key={`${event.status}-${event.occurredAt}-${index}`}>
                <span className={`status status-${event.status.toLowerCase()}`}>{formatStatus(event.status)}</span>
                <span className="history-time">{formatTime(event.occurredAt)}</span>
                <span className="history-actor">by {actorName(event.actorId)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="panel">
        <h2>All Requests</h2>

        {loading ? (
          <p className="hint">Loading...</p>
        ) : requests.length === 0 ? (
          <p className="hint">No requests yet.</p>
        ) : (
          <table className="requests-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Title</th>
                <th>Dept</th>
                <th>Submitted By</th>
                <th>Status</th>
                <th>Last Updated</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {requests.map((request) => (
                <tr key={request.id}>
                  <td>{request.id}</td>
                  <td>{request.title}</td>
                  <td>{request.department}</td>
                  <td>{actorName(request.submittedBy)}</td>
                  <td>
                    <span className={`status status-${request.currentStatus.toLowerCase()}`}>
                      {formatStatus(request.currentStatus)}
                    </span>
                  </td>
                  <td>{formatTime(request.lastUpdated)}</td>
                  <td className="actions">
                    <button
                      aria-label={`History ${request.id}`}
                      className="history-button"
                      disabled={busy}
                      onClick={() => handleViewHistory(request.id)}
                    >
                      History
                    </button>
                    {request.currentStatus === 'SUBMITTED' && (
                      <>
                        <button
                          aria-label={`Assign ${request.id}`}
                          disabled={busy}
                          onClick={() => handleTransition(request.id, 'ASSIGNED')}
                        >
                          Assign
                        </button>
                        <button
                          aria-label={`Deny ${request.id}`}
                          className="deny"
                          disabled={busy}
                          onClick={() => handleTransition(request.id, 'DENIED')}
                        >
                          Deny
                        </button>
                      </>
                    )}
                    {request.currentStatus === 'ASSIGNED' && (
                      <button
                        aria-label={`Start ${request.id}`}
                        disabled={busy}
                        onClick={() => handleTransition(request.id, 'IN_PROGRESS')}
                      >
                        Start
                      </button>
                    )}
                    {request.currentStatus === 'IN_PROGRESS' && (
                      <button
                        aria-label={`Complete ${request.id}`}
                        disabled={busy}
                        onClick={() => handleTransition(request.id, 'COMPLETED')}
                      >
                        Complete
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </main>
  );
}
