import { formatStatus } from '../lib/format';

interface StatusBadgeProps {
  status: string;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  return <span className={`status status-${status.toLowerCase()}`}>{formatStatus(status)}</span>;
}
