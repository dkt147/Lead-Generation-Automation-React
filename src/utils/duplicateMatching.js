const COMPANY_SUFFIXES = /\b(inc|llc|ltd|corp|corporation|pty ltd|co|company|group|limited|gmbh|sa|srl)\.?\b/gi;

export function normalizeDomain(url) {
  if (!url) return '';
  try {
    const parsed = new URL(url.startsWith('http') ? url : `https://${url}`);
    return parsed.hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return '';
  }
}

export function normalizeCompanyName(name) {
  if (!name) return '';
  return name
    .toLowerCase()
    .replace(COMPANY_SUFFIXES, '')
    .replace(/[^a-z0-9\s]/g, '')
    .trim()
    .replace(/\s+/g, ' ');
}

export function getDuplicateLabel(result) {
  if (!result || !result.isDuplicate) return null;
  const matchCount = result.matches?.length || 0;
  return `${matchCount} potential duplicate${matchCount > 1 ? 's' : ''} found`;
}

export function getExistingItemSummary(match) {
  if (!match) return {};
  const summary = { name: match.name, itemId: match.itemId };
  for (const col of match.columnValues || []) {
    if (col.text) {
      summary[col.id] = col.text;
    }
  }
  return summary;
}
