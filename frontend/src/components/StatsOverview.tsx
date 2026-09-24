import { ServiceRequest } from '../api/requests';
import { STATUSES } from '../lib/constants';
import { StatCard } from './StatCard';

interface StatsOverviewProps {
  requests: ServiceRequest[];
  onSelectStatus: (status: string) => void;
}

/**
 * A count-per-status row, computed from whatever the actor can already see -
 * no extra request. Each card is a shortcut into the table filtered to that
 * exact status, and counts animate in/update instead of snapping.
 */
export function StatsOverview({ requests, onSelectStatus }: StatsOverviewProps) {
  return (
    <div className="stats-overview">
      {STATUSES.map(({ status, label, icon }, index) => (
        <StatCard
          key={status}
          status={status}
          label={label}
          icon={icon}
          count={requests.filter((request) => request.currentStatus === status).length}
          delay={index * 60}
          onSelect={onSelectStatus}
        />
      ))}
    </div>
  );
}
