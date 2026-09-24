import { DISPLAY_NAME_BY_ID } from './constants';

export function formatStatus(value: string): string {
  const words = value.replace(/_/g, ' ').toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

export function formatTime(value: string): string {
  return new Date(value).toLocaleString();
}

/** The name the hub knows this actor id by, or the raw id if it's unknown. */
export function actorName(actorId: string): string {
  return DISPLAY_NAME_BY_ID[actorId] ?? actorId;
}

/** Up to two initials from a "Name (Role)" or "Name — Role" label, for an avatar chip. */
export function initials(label: string): string {
  const namePart = label.split(/—|\(/)[0].trim();
  return namePart
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? '')
    .join('');
}
