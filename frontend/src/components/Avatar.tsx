import { initials } from '../lib/format';

interface AvatarProps {
  name: string;
  size?: number;
}

/** A colored circle with initials, standing in for a profile photo - Jira/ServiceNow-style assignee avatar. */
export function Avatar({ name, size = 24 }: AvatarProps) {
  return (
    <span
      className="avatar"
      style={{ width: size, height: size, fontSize: size * 0.4 }}
      title={name}
      aria-hidden="true"
    >
      {initials(name)}
    </span>
  );
}
