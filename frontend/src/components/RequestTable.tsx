import { CheckCircle2, ChevronDown, ChevronUp, PlayCircle, UserCheck, X, XCircle } from 'lucide-react';
import { Fragment } from 'react';
import { ServiceRequest } from '../api/requests';
import { actorName, formatStatus, formatTime } from '../lib/format';
import { useMediaQuery } from '../lib/useMediaQuery';
import { AiCheckBadge } from './AiCheckBadge';
import { Avatar } from './Avatar';
import { DepartmentBadge } from './DepartmentBadge';
import { HistoryPanel } from './HistoryPanel';
import { StatusBadge } from './StatusBadge';

interface RequestTableProps {
  requests: ServiceRequest[];
  loading: boolean;
  busy: boolean;
  searchQuery: string;
  statusFilter: string | null;
  onClearStatusFilter: () => void;
  expandedRequest: ServiceRequest | null;
  onToggleHistory: (requestId: string) => void;
  onTransition: (requestId: string, to: string) => void;
  actorId: string;
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
}: RequestTableProps) {
  const query = searchQuery.trim().toLowerCase();
  const visibleRequests = requests.filter((request) => {
    if (statusFilter && request.currentStatus !== statusFilter) return false;
    if (query && !request.title.toLowerCase().includes(query) && !request.id.toLowerCase().includes(query)) {
      return false;
    }
    return true;
  });
  // Every row here is one of the actor's own requests (e.g. "My Requests") -
  // there is nothing to act on, so the whole column would just be empty.
  const showActionsColumn = visibleRequests.some((request) => request.submittedBy !== actorId);
  // On narrower windows the least essential columns are dropped from the table
  // (their info is still in the History panel), so everything else - History
  // button included - fits without a sideways scroll. The breakpoints match
  // the column widths in App.css.
  const showDept = useMediaQuery('(min-width: 1181px)');
  const showUpdated = useMediaQuery('(min-width: 1321px)');
  const showAi = useMediaQuery('(min-width: 1501px)');
  // Key, Title, Submitted By, Status and History are always there.
  const columnCount = 5 + [showActionsColumn, showDept, showUpdated, showAi].filter(Boolean).length;

  return (
    <section className="panel">
      <div className="panel-heading">
        <span className="result-count">
          {visibleRequests.length} {visibleRequests.length === 1 ? 'request' : 'requests'}
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
      ) : (
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
              {visibleRequests.map((request) => {
                const isExpanded = expandedRequest?.id === request.id;
                const submitter = actorName(request.submittedBy);
                return (
                  <Fragment key={request.id}>
                    <tr className={isExpanded ? 'is-expanded' : ''}>
                      <td className={`id-cell id-cell-${request.department.toLowerCase()}`}>{request.id}</td>
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
                                    aria-label={`Assign ${request.id}`}
                                    disabled={busy}
                                    onClick={() => onTransition(request.id, 'ASSIGNED')}
                                  >
                                    <UserCheck size={14} />
                                    Assign
                                  </button>
                                  <button
                                    aria-label={`Deny ${request.id}`}
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
                                  aria-label={`Start ${request.id}`}
                                  disabled={busy}
                                  onClick={() => onTransition(request.id, 'IN_PROGRESS')}
                                >
                                  <PlayCircle size={14} />
                                  Start
                                </button>
                              )}
                              {request.currentStatus === 'IN_PROGRESS' && (
                                <button
                                  aria-label={`Complete ${request.id}`}
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
                          aria-label={`${isExpanded ? 'Hide' : 'Show'} history for ${request.id}`}
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
      )}
    </section>
  );
}
