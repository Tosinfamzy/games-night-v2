/**
 * Build a spec-compliant .ics (iCalendar) event — for attaching a calendar
 * invite to transactional email so a guest can add the games night in one tap.
 * Mirrors the frontend's lib/calendar.ts.
 */
export interface IcsEvent {
  title: string;
  /** Event start. */
  start: Date;
  location?: string | null;
  description?: string | null;
  /** A link to open on the day (folded into the description + URL property). */
  url?: string | null;
  /** Stable id for the UID so re-adds don't duplicate the calendar entry. */
  uid?: string;
}

/** Default games-night length when no end time is known. */
const DEFAULT_DURATION_MS = 3 * 60 * 60 * 1000;

/** Format a Date as an iCal UTC timestamp: YYYYMMDDTHHMMSSZ. */
function toIcsUtc(date: Date): string {
  return date
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}/, '');
}

/** Escape a value for an .ics text field (backslashes, commas, semicolons, newlines). */
function escapeIcs(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

export function buildEventIcs(event: IcsEvent): string {
  const start = event.start;
  const end = new Date(start.getTime() + DEFAULT_DURATION_MS);
  const uid = `${event.uid ?? toIcsUtc(start)}@thegamesnight.com`;

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//The Games Night//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${toIcsUtc(start)}`,
    `DTSTART:${toIcsUtc(start)}`,
    `DTEND:${toIcsUtc(end)}`,
    `SUMMARY:${escapeIcs(event.title)}`,
  ];
  if (event.location) lines.push(`LOCATION:${escapeIcs(event.location)}`);
  const description = [event.description, event.url && `Join: ${event.url}`]
    .filter(Boolean)
    .join('\n\n');
  if (description) lines.push(`DESCRIPTION:${escapeIcs(description)}`);
  if (event.url) lines.push(`URL:${event.url}`);
  lines.push('END:VEVENT', 'END:VCALENDAR');
  // iCal requires CRLF line endings.
  return lines.join('\r\n');
}
