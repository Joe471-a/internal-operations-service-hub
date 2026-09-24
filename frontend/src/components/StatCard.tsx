import { LucideIcon } from 'lucide-react';
import { useCountUp } from '../lib/useCountUp';

interface StatCardProps {
  status: string;
  label: string;
  icon: LucideIcon;
  count: number;
  delay: number;
  onSelect: (status: string) => void;
}

export function StatCard({ status, label, icon: Icon, count, delay, onSelect }: StatCardProps) {
  const animatedCount = useCountUp(count);

  return (
    <button
      type="button"
      className={`stat-card stat-card-${status.toLowerCase()}`}
      style={{ animationDelay: `${delay}ms` }}
      onClick={() => onSelect(status)}
    >
      <span className="stat-icon">
        <Icon size={18} />
      </span>
      <span>
        <span className="stat-count">{animatedCount}</span>
        <span className="stat-label">{label}</span>
      </span>
    </button>
  );
}
