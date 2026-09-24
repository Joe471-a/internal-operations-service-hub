import { CheckCircle2, Clock3, Inbox, UserCheck, XCircle } from 'lucide-react';
import { Department, RequestView } from '../api/requests';

export type Role = 'employee' | 'staff' | 'lead';

/** Every lifecycle status, in order - shared by the stat cards and the topbar's mini summary. */
export const STATUSES = [
  { status: 'SUBMITTED', label: 'Submitted', icon: Inbox },
  { status: 'ASSIGNED', label: 'Assigned', icon: UserCheck },
  { status: 'IN_PROGRESS', label: 'In Progress', icon: Clock3 },
  { status: 'COMPLETED', label: 'Completed', icon: CheckCircle2 },
  { status: 'DENIED', label: 'Denied', icon: XCircle },
];

export const DEPARTMENTS: Department[] = ['IT', 'HR', 'FINANCE'];

/**
 * Display-only - not an identity or auth source (that's the session from
 * login, backed by the `User` table). A request's history shows who else
 * touched it (submitter, assigner, ...), and those other people's ids
 * still need a human-readable name to show, so this is just a label
 * lookup, kept in sync with the same six seeded users by hand.
 */
export const DISPLAY_NAME_BY_ID: Record<string, string> = {
  'emp-001': 'Dana Karam (Employee)',
  'it-staff-001': 'Yara Fakhoury (IT Staff)',
  'it-lead-001': 'Karim Rahal (IT Lead)',
  'hr-lead-001': 'Sami Nassar (HR Lead)',
  'finance-staff-001': 'Tarek Sleiman (Finance Staff)',
  'finance-lead-001': 'Layla Haddad (Finance Lead)',
};

/**
 * The filter tabs each role gets above "All Requests" - an employee's list
 * is already just their own, so they get none; staff can narrow to what
 * they can handle; a lead can also narrow to what's awaiting assign/deny.
 */
export const VISIBILITY_TABS_BY_ROLE: Record<Role, { view: RequestView; label: string }[]> = {
  employee: [],
  staff: [
    { view: 'mine', label: 'My Requests' },
    { view: 'all', label: 'All' },
    { view: 'handle', label: 'To Handle' },
  ],
  lead: [
    { view: 'mine', label: 'My Requests' },
    { view: 'all', label: 'All' },
    { view: 'handle', label: 'To Handle' },
    { view: 'assign', label: 'Awaiting Assign/Deny' },
  ],
};

/**
 * Views whose list is already one specific slice of statuses (To Handle is
 * only Assigned/In Progress, Awaiting Assign/Deny is only Submitted), so a
 * count-per-status dashboard on top of them would just be zeros and one
 * big number - it only earns its place on the broad views.
 */
export const VIEWS_WITH_STATS: RequestView[] = ['all', 'mine'];

/** The label for the topbar breadcrumb - mirrors the sidebar's active nav item. */
export function getViewLabel(role: Role, view: RequestView): string {
  const tabs = VISIBILITY_TABS_BY_ROLE[role];
  if (tabs.length === 0) return 'My Requests';
  return tabs.find((tab) => tab.view === view)?.label ?? 'All';
}

/** One example per department, shown as the form's placeholder text - swaps as the department changes. */
export const EXAMPLE_BY_DEPARTMENT: Record<Department, { title: string; description: string }> = {
  IT: {
    title: "Laptop won't turn on",
    description: 'My laptop does not power on at all, and I have a client meeting this afternoon.',
  },
  HR: {
    title: 'Question about parental leave policy',
    description: "I want to understand how many weeks of paid leave I'm entitled to after my child is born.",
  },
  FINANCE: {
    title: 'Expense report rejected',
    description: "My conference travel expense report was rejected and I don't understand which receipts were the problem.",
  },
};
