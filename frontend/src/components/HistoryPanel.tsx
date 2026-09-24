import { ServiceRequest } from '../api/requests';
import { actorName, formatTime } from '../lib/format';
import { AiCheckBadge } from './AiCheckBadge';
import { DepartmentBadge } from './DepartmentBadge';
import { StatusBadge } from './StatusBadge';

interface HistoryPanelProps {
  request: ServiceRequest;
}

export function HistoryPanel({ request }: HistoryPanelProps) {
  return (
    <>
      <p className="hint">
        <DepartmentBadge department={request.department} /> · submitted by {actorName(request.submittedBy)} ·{' '}
        <AiCheckBadge verified={request.aiVerified} uncheckedLabel="Not AI-checked" />
      </p>
      <p className="history-description">{request.description}</p>
      <ul className="history-timeline">
        {request.history.map((event, index) => (
          <li key={`${event.status}-${event.occurredAt}-${index}`}>
            <StatusBadge status={event.status} />
            <span className="history-time">{formatTime(event.occurredAt)}</span>
            <span className="history-actor">by {actorName(event.actorId)}</span>
          </li>
        ))}
      </ul>
    </>
  );
}
