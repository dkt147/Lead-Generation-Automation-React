/**
 * Contact Enrichment — paid Apollo cascade
 *
 * Cascade (stops as soon as a contact with email is found):
 *   1. Apollo people/search         — all plans, returns verified emails on paid ✓
 *   2. Apollo people/match         — enrichment by domain, uses credits
 *   3. Snov.io domain-search       — async fallback
 *   4. Hunter.io domain-search     — last resort
 *
 * Accepts { company } (single) OR { companies } (batch).
 *
 * Apollo docs: https://docs.apollo.io/reference/people-api-search
 *              https://docs.apollo.io/reference/people-enrichment
 * Snov.io docs: https://snov.io/api
 * Hunter docs:  https://hunter.io/api-documentation/v2
 */

const DECISION_MAKER_TITLES = [
  'ceo', 'chief executive', 'founder', 'co-founder', 'owner',
  'president', 'director', 'vp', 'vice president',
  'managing', 'manager', 'head', 'lead', 'partner',
];

const APOLLO_TITLES = [
  'CEO', 'Founder', 'Co-Founder', 'Owner', 'President',
  'Director', 'VP', 'Vice President', 'Managing Director',
  'Manager', 'Head', 'Partner',
];

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const apolloKey  = process.env.APOLLO_API_KEY;
  const hunterKey  = process.env.HUNTER_API_KEY;

  const single = req.body?.company;
  const list   = single ? [single] : (req.body?.companies || []);
  if (!list.length) return res.status(400).json({ error: 'company or companies required' });

  const results = [];

  for (const company of list) {
    const domain = extractDomain(company.website);

    let contact = null;
    let source  = null;
    const errors = [];

    // ── 0. Check Supabase cache first ────────────────────────────────────
    if (domain) {
      try {
        const cached = await lookupCache(domain);
        if (cached) {
          contact = cached;
          source  = 'cache';
        }
      } catch (e) { errors.push(`Cache: ${e.message}`); }
    }

    // ── 1. Apollo: domain search (paid — returns emails directly) ────────
    if (apolloKey && domain && !contact) {
      try {
        contact = await apolloSearch(domain, apolloKey);
        if (contact) source = 'apollo';
      } catch (e) { errors.push(`Apollo search: ${e.message}`); }
    }

    // ── 2. Apollo: company name search (works even without valid URL) ────
    if (apolloKey && !contact && company.name) {
      try {
        contact = await apolloMatch(domain, company.name, apolloKey);
        if (contact) source = 'apollo-match';
      } catch (e) { errors.push(`Apollo match: ${e.message}`); }
    }

    // ── 3. Hunter.io: domain search ──────────────────────────────────────
    if (hunterKey && domain && !contact) {
      try {
        contact = await hunterDomainSearch(domain, hunterKey);
        if (contact) source = 'hunter';
      } catch (e) { errors.push(`Hunter: ${e.message}`); }
    }

    // ── Save to cache if freshly enriched ────────────────────────────────
    if (contact && source !== 'cache') {
      saveToCache(domain, contact, source).catch(() => {});
    }

    results.push({
      ...company,
      contact,
      enrichmentSource: source,
      enrichmentError: contact ? null : (errors.join(' | ') || 'No contacts found'),
    });

    await sleep(300);
  }

  return single
    ? res.status(200).json(results[0])
    : res.status(200).json({ enriched: results });
}

// ── 1. Apollo: Search + Reveal (2-step) ──────────────────────────────────
// Step 1: api_search to find person IDs (has_email=true)
// Step 2: people/match with ID to reveal actual email

async function apolloSearch(domain, apiKey) {
  // Step 1: Search for people at this domain
  const res = await fetch('https://api.apollo.io/api/v1/mixed_people/api_search', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache',
      'X-Api-Key': apiKey,
    },
    body: JSON.stringify({
      q_organization_domains: domain,
      person_titles: APOLLO_TITLES,
      page: 1,
      per_page: 5,
    }),
  });

  if (res.status === 401 || res.status === 403) throw new Error(`Apollo auth error (${res.status})`);
  if (res.status === 429) throw new Error('Rate limit — slow down');
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`HTTP ${res.status}: ${body.slice(0, 200)}`);
  }

  const data   = await res.json();
  const people = data?.people || [];
  if (!people.length) return null;

  // Pick best decision-maker who has an email
  const withEmail = people.filter((p) => p.has_email);
  const pool      = withEmail.length ? withEmail : people;
  const best      = pickBest(pool, (p) => (p.title || '').toLowerCase());
  if (!best?.id || !best.has_email) return null;

  // Step 2: Reveal contact details via people/match
  return apolloReveal(best.id, apiKey);
}

// ── 2. Apollo: Fallback search by organization name ───────────────────────

async function apolloMatch(domain, organizationName, apiKey) {
  const res = await fetch('https://api.apollo.io/api/v1/mixed_people/api_search', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache',
      'X-Api-Key': apiKey,
    },
    body: JSON.stringify({
      q_organization_name: organizationName,
      person_titles: APOLLO_TITLES,
      page: 1,
      per_page: 5,
    }),
  });

  if (res.status === 401 || res.status === 403) throw new Error(`Apollo auth error (${res.status})`);
  if (res.status === 429) throw new Error('Rate limit');
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`HTTP ${res.status}: ${body.slice(0, 200)}`);
  }

  const data   = await res.json();
  const people = data?.people || [];
  const best   = people.find((p) => p.has_email);
  if (!best?.id) return null;

  return apolloReveal(best.id, apiKey);
}

// ── Apollo: Reveal email by person ID ────────────────────────────────────

async function apolloReveal(personId, apiKey) {
  const res = await fetch('https://api.apollo.io/api/v1/people/match', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Api-Key': apiKey,
    },
    body: JSON.stringify({ id: personId }),
  });

  if (!res.ok) return null;
  const data = await res.json();
  const p = data?.person;
  if (!p?.email) return null;

  return {
    name:       [p.first_name, p.last_name].filter(Boolean).join(' ') || 'Contact',
    email:      p.email,
    position:   p.title || 'Decision Maker',
    confidence: 95,
    phone:      p.phone_numbers?.[0]?.sanitized_number || p.phone_numbers?.[0]?.raw_number || '',
    linkedin:   p.linkedin_url || '',
  };
}

// ── 3. Hunter.io: Domain Search ────────────────────────────────────────────

async function hunterDomainSearch(domain, apiKey) {
  const res = await fetch(
    `https://api.hunter.io/v2/domain-search?domain=${encodeURIComponent(domain)}&api_key=${apiKey}&limit=10`
  );
  if (res.status === 401) throw new Error('Invalid key');
  if (res.status === 403) throw new Error('Credits exhausted');
  if (res.status === 429) throw new Error('Rate limit');
  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  const data   = await res.json();
  const emails = data?.data?.emails || [];
  if (!emails.length) return null;

  const best = pickBest(emails, (e) => (e.position || '').toLowerCase());
  return {
    name:       [best.first_name, best.last_name].filter(Boolean).join(' ') || 'Contact',
    email:      best.value,
    position:   best.position || 'Decision Maker',
    confidence: best.confidence || 0,
    phone:      best.phone_number || '',
    linkedin:   best.linkedin || '',
  };
}

// ── Shared helpers ─────────────────────────────────────────────────────────

function pickBest(items, getTitleFn) {
  let best = items[0], bestScore = Infinity;
  for (const item of items) {
    const t = getTitleFn(item);
    let rank = DECISION_MAKER_TITLES.length + 1;
    for (let i = 0; i < DECISION_MAKER_TITLES.length; i++) {
      if (t.includes(DECISION_MAKER_TITLES[i])) { rank = i; break; }
    }
    const score = rank + ((item.email || item.value) ? 0 : 500);
    if (score < bestScore) { bestScore = score; best = item; }
  }
  return best;
}

function extractDomain(url) {
  if (!url) return null;
  // Strip trailing (city) like "air-charter-australia.com(Armadale)"
  let clean = url.trim().replace(/\(.*?\)\s*$/, '').trim();
  if (!clean) return null;
  try {
    const p = new URL(clean.startsWith('http') ? clean : `https://${clean}`);
    return p.hostname.replace(/^www\./, '');
  } catch { return null; }
}

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

// ── Supabase cache helpers ────────────────────────────────────────────────

async function lookupCache(domain) {
  if (!SUPABASE_URL || !SUPABASE_KEY) return null;

  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/enriched_leads?domain=eq.${encodeURIComponent(domain)}&select=*&limit=1`,
    { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } },
  );
  if (!res.ok) return null;

  const rows = await res.json();
  if (!rows.length) return null;

  const r = rows[0];
  return {
    name:       r.contact_name,
    email:      r.contact_email,
    position:   r.contact_position,
    confidence: r.confidence,
    phone:      r.contact_phone || '',
    linkedin:   r.contact_linkedin || '',
  };
}

async function saveToCache(domain, contact, source) {
  if (!SUPABASE_URL || !SUPABASE_KEY) return;

  await fetch(`${SUPABASE_URL}/rest/v1/enriched_leads`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates',
    },
    body: JSON.stringify({
      domain,
      contact_name:     contact.name,
      contact_email:    contact.email,
      contact_position: contact.position,
      confidence:       contact.confidence,
      contact_phone:    contact.phone || '',
      contact_linkedin: contact.linkedin || '',
      source,
      updated_at:       new Date().toISOString(),
    }),
  });
}
