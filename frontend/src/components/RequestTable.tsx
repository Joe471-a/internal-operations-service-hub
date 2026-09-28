import { CheckCircle2, ChevronDown, ChevronUp, PlayCircle, UserCheck, X, XCircle } from 'lucide-react';
import { Fragment } from 'react';
import { ServiceRequest } from '../api/requests';
import { actorName, formatRequestKey, formatStatus, formatTime } from '../lib/format';
import { useMediaQuery } from '../lib/useMediaQuery';
import { AiCheckBadge } from './AiCheckBadge';
import { Avatar } from './Avatar';
import { DepartmentBadge } from './DepartmentBadge';
import { HistoryPanel } from './HistoryPanel';
import { StatusBadge } from './StatusBadge';

/** Final statuses - nobody can move a request on from these. */
const CLOSED_STATUSES = ['COMPLETED', 'DENIED'];

function isClosed(request: ServiceRequest): boolean {
  return CLOSED_STATUSES.includes(request.currentStatus);
}

interface RequestTableProps {
  requests: ServiceRequest[];
  loading: boolean;
  busy: boolean;
  searchQuery: string;
  statusFilter: string | null;
  onClearStatusFilter: () => void;
  expandedRequest: ServiceRequest | null;
  onToggleHistory: (requestId: number) => void;
  onTransition: (requestId: number, to: string) => void;
  actorId: string;
  /**
   * Staff and leads work a queue, so finished requests (Completed, Denied)
   * move to their own "Closed" section below it and the queue only holds
   * what still needs someone. An employee's list is just their own
   * requests, so it stays one list.
   */
  separateClosed: boolean;
}

export function RequestTable({
  requests,
  loading,
  busy,
  searchQuery,
  statusFilter,
  onClearStatusFilter,
  expandedRequest,
  onToggleHistory,
  onTransition,
  actorId,
  separateClosed,
}: RequestTableProps) {
  const query = searchQuery.trim().toLowerCase();
  const visibleRequests = requests.filter((request) => {
    if (statusFilter && request.currentStatus !== statusFilter) return false;
    // The key as shown (REQ-1006) matches "req-1006", "1006" or "100".
    const key = formatRequestKey(request.id).toLowerCase();
    if (query && !request.title.toLowerCase().includes(query) && !key.includes(query)) {
      return false;
    }
    return true;
  });
  // A status card picks one exact status, so its list is a single list of
  // that status - the open/closed split is only for the full, unfiltered view.
  const splitClosed = separateClosed && !statusFilter;
  const openRequests = splitClosed ? visibleRequests.filter((request) => !isClosed(request)) : visibleRequests;
  const closedRequests = splitClosed ? visibleRequests.filter(isClosed) : [];

  // On narrower windows the least essential columns are dropped from the table
  // (their info is still in the History panel), so everything else - History
  // button included - fits without a sideways scroll. The breakpoints match
  // the column widths in App.css.
  const showDept = useMediaQuery('(min-width: 1181px)');
  const showUpdated = useMediaQuery('(min-width: 1321px)');
  const showAi = useMediaQuery('(min-width: 1501px)');

  function renderTable(rows: ServiceRequest[]) {
    // Only rows someone else submitted, still open, can have buttons - if
    // none of these rows can, the whole column would just be empty.
    const showActionsColumn = rows.some((request) => request.submittedBy !== actorId && !isClosed(request));
    // Key, Title, Submitted By, Status and History are always there.
    const columnCount = 5 + [showActionsColumn, showDept, showUpdated, showAi].filter(Boolean).length;

    return (
      <div className="table-wrapper">
        <table className="requests-table">
          <colgroup>
            <col className="col-key" />
            <col />
            {showDept && <col className="col-dept" />}
            <col className="col-submitter" />
            {showAi && <col className="col-ai" />}
            <col className="col-status" />
            {showUpdated && <col className="col-updated" />}
            {showActionsColumn && <col className="col-actions" />}
            <col className="col-history" />
          </colgroup>
          <thead>
            <tr>
              <th>Key</th>
              <th>Title</th>
              {showDept && <th>Dept</th>}
              <th>Submitted By</th>
              {showAi && <th>AI Check</th>}
              <th>Status</th>
              {showUpdated && <th>Last Updated</th>}
              {showActionsColumn && <th>Actions</th>}
              <th className="expand-col" />
            </tr>
          </thead>
          <tbody>
            {rows.map((request) => {
              const isExpanded = expandedRequest?.id === request.id;
              const submitter = actorName(request.submittedBy);
              const key = formatRequestKey(request.id);
              return (
                <Fragment key={request.id}>
                  <tr className={isExpanded ? 'is-expanded' : ''}>
                    <td className={`id-cell id-cell-${request.department.toLowerCase()}`}>{key}</td>
                    <td className="cell-truncate">{request.title}</td>
                    {showDept && (
                      <td>
                        <DepartmentBadge department={request.department} />
                      </td>
                    )}
                    <td className="cell-truncate">
                      <span className="submitter-cell">
                        <Avatar name={submitter} size={22} />
                        <span>{submitter}</span>
                      </span>
                    </td>
                    {showAi && (
                      <td>
                        <AiCheckBadge verified={request.aiVerified} />
                      </td>
                    )}
                    <td>
                      <StatusBadge status={request.currentStatus} />
                    </td>
                    {showUpdated && <td className="cell-updated">{formatTime(request.lastUpdated)}</td>}
                    {showActionsColumn && (
                      <td className="actions">
                        {request.submittedBy !== actorId && (
                          <>
                            {request.currentStatus === 'SUBMITTED' && (
                              <>
                                <button
                                  aria-label={`Assign ${key}`}
                                  disabled={busy}
                                  onClick={() => onTransition(request.id, 'ASSIGNED')}
                                >
                                  <UserCheck size={14} />
                                  Assign
                                </button>
                                <button
                                  aria-label={`Deny ${key}`}
                                  className="deny"
                                  disabled={busy}
                                  onClick={() => onTransition(request.id, 'DENIED')}
                                >
                                  <XCircle size={14} />
                                  Deny
                                </button>
                              </>
                            )}
                            {request.currentStatus === 'ASSIGNED' && (
                              <button
                                aria-label={`Start ${key}`}
                                disabled={busy}
                                onClick={() => onTransition(request.id, 'IN_PROGRESS')}
                              >
                                <PlayCircle size={14} />
                                Start
                              </button>
                            )}
                            {request.currentStatus === 'IN_PROGRESS' && (
                              <button
                                aria-label={`Complete ${key}`}
                                disabled={busy}
                                onClick={() => onTransition(request.id, 'COMPLETED')}
                              >
                                <CheckCircle2 size={14} />
                                Complete
                              </button>
                            )}
                          </>
                        )}
                      </td>
                    )}
                    <td className="expand-col">
                      <button
                        type="button"
                        className={`expand-toggle${isExpanded ? ' active' : ''}`}
                        aria-label={`${isExpanded ? 'Hide' : 'Show'} history for ${key}`}
                        aria-expanded={isExpanded}
                        disabled={busy}
                        onClick={() => onToggleHistory(request.id)}
                      >
                        {isExpanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                        History
                      </button>
                    </td>
                  </tr>
                  {isExpanded && expandedRequest && (
                    <tr className="history-row">
                      <td colSpan={columnCount}>
                        <div className="history-card">
                          <HistoryPanel request={expandedRequest} />
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  }

  const countLabel = (count: number, noun: string) => `${count} ${noun}${count === 1 ? '' : 's'}`;

  return (
    <>
      <section className="panel">
        <div className="panel-heading">
          <span className="result-count">
            {splitClosed ? countLabel(openRequests.length, 'open request') : countLabel(openRequests.length, 'request')}
          </span>
          {statusFilter && (
            <button type="button" className="status-filter-chip" onClick={onClearStatusFilter}>
              Status: {formatStatus(statusFilter)}
              <X size={13} />
            </button>
          )}
        </div>

        {loading ? (
          <p className="hint">Loading...</p>
        ) : requests.length === 0 ? (
          <p className="hint">No requests yet.</p>
        ) : visibleRequests.length === 0 ? (
          <p className="hint">No requests match this filter.</p>
        ) : openRequests.length === 0 ? (
          <p className="hint">Nothing open - every request here is closed.</p>
        ) : (
          renderTable(openRequests)
        )}
      </section>

      {!loading && closedRequests.length > 0 && (
        <section className="panel panel-closed" aria-label="Closed requests">
          <div className="panel-heading">
            <span className="result-count">Closed · {countLabel(closedRequests.length, 'request')} (Completed or Denied)</span>
          </div>
          {renderTable(closedRequests)}
        </section>
      )}
    </>
  );
}
