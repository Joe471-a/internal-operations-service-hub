import { ClipboardList, Plus, Radar } from 'lucide-react';
import { RequestView } from '../api/requests';
import { Role, VISIBILITY_TABS_BY_ROLE } from '../lib/constants';

interface SidebarProps {
  role: Role;
  view: RequestView;
  onViewChange: (view: RequestView) => void;
  onNewRequest: () => void;
}

export function Sidebar({ role, view, onViewChange, onNewRequest }: SidebarProps) {
  const tabs = VISIBILITY_TABS_BY_ROLE[role];
  // An employee has no filter tabs (their queue is already just their own) - give them one fixed row instead.
  const items = tabs.length > 0 ? tabs : [{ view: 'all' as RequestView, label: 'My Requests' }];

  return (
    <aside className="sidebar">
      <div className="brand">
        <Radar size={22} />
        <span>Internal Hub</span>
      </div>

      <button type="button" className="sidebar-create" onClick={onNewRequest}>
        <Plus size={16} />
        <span>New Request</span>
      </button>

      <div className="sidebar-section-label">Requests</div>
      <nav className="sidebar-nav">
        {items.map((item) => (
          <button
            key={item.view}
            type="button"
            className={item.view === view ? 'active' : ''}
            onClick={() => onViewChange(item.view)}
          >
            <ClipboardList size={16} />
            <span>{item.label}</span>
          </button>
        ))}
      </nav>

      <p className="sidebar-footer">Internal Operations Service Hub · v0.4</p>
    </aside>
  );
}
