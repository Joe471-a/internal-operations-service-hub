import { Department } from '../api/requests';

interface DepartmentBadgeProps {
  department: Department;
}

export function DepartmentBadge({ department }: DepartmentBadgeProps) {
  return <span className={`dept dept-${department.toLowerCase()}`}>{department}</span>;
}
