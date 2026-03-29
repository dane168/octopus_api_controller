/**
 * Get a short timezone abbreviation (e.g. "GMT", "BST", "CET") for the given IANA timezone.
 * Falls back to the browser's local timezone if none provided.
 */
export function getTimezoneAbbr(timezone?: string): string {
  const tz = timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;
  try {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: tz,
      timeZoneName: 'short',
    }).formatToParts(new Date());
    const tzPart = parts.find((p) => p.type === 'timeZoneName');
    return tzPart?.value || tz;
  } catch {
    return tz;
  }
}
