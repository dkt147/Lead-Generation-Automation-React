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

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const apolloKey  = process.env.APOLLO_API_KEY;
  const snovId     = process.env.SNOV_CLIENT_ID;
  const snovSecret = process.env.SNOV_CLIENT_SECRET;
  const hunterKey  = process.env.HUNTER_API_KEY;

  const single = req.body?.company;
  const list   = single ? [single] : (req.body?.companies || []);
  if (!list.length) return res.status(400).json({ error: 'company or companies required' });

  // Fetch Snov token once per request batch
  let snovToken = null;
  if (snovId && snovSecret) {
    try { snovToken = await getSnovToken(snovId, snovSecret); } catch (_) {}
  }

  const results = [];

  for (const company of list) {
    const domain = extractDomain(company.website);
    if (!domain) {
      results.push({ ...company, contact: null, enrichmentSource: null, enrichmentError: 'Invalid URL' });
      continue;
    }

    let contact = null;
    let source  = null;
    const errors = [];

    // ── 1. Apollo: mixed_people/search (paid — returns emails directly) ──
    // Best result: full contact (name + title + email + phone + linkedin) in one call
    if (apolloKey && !contact) {
      try {
        contact = await apolloSearch(domain, apolloKey);
        if (contact) source = 'apollo';
      } catch (e) { errors.push(`Apollo search: ${e.message}`); }
    }

    // ── 2. Apollo: people/match (enrichment — uses credits) ──────────────
    // Fallback when search returns nobody; needs organization_name to match
    if (apolloKey && !contact) {
      try {
        contact = await apolloMatch(domain, company.name, apolloKey);
        if (contact) source = 'apollo-match';
      } catch (e) { errors.push(`Apollo match: ${e.message}`); }
    }

    // ── 3. Snov.io: domain search (async with polling) ───────────────────
    if (snovToken && !contact) {
      try {
        contact = await snovDomainSearch(domain, snovToken);
        if (contact) source = 'snov';
      } catch (e) { errors.push(`Snov: ${e.message}`); }
    }

    // ── 4. Hunter.io: domain search ──────────────────────────────────────
    if (hunterKey && !contact) {
      try {
        contact = await hunterDomainSearch(domain, hunterKey);
        if (contact) source = 'hunter';
      } catch (e) { errors.push(`Hunter: ${e.message}`); }
    }

    results.push({
      ...company,
      contact,
      enrichmentSource: source,
      enrichmentError: contact ? null : (errors.join(' | ') || 'No contacts found'),
    });

    await sleep(300); // brief delay to stay within Apollo rate limits
  }

  return single
    ? res.status(200).json(results[0])
    : res.status(200).json({ enriched: results });
}

// ── 1. Apollo: People Search ───────────────────────────────────────────────
// POST https://api.apollo.io/api/v1/mixed_people/search
// Paid plan — returns verified emails, phone, linkedin in one shot

async function apolloSearch(domain, apiKey) {
  const res = await fetch('https://api.apollo.io/api/v1/mixed_people/search', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache',
      'X-Api-Key': apiKey,
    },
    body: JSON.stringify({
      q_organization_domains: domain,
      page: 1,
      per_page: 10,
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
  const withEmail = people.filter((p) => p.email);
  const pool      = withEmail.length ? withEmail : people;
  const best      = pickBest(pool, (p) => (p.title || '').toLowerCase());
  if (!best?.email) return null;

  return {
    name:       [best.first_name, best.last_name].filter(Boolean).join(' ') || 'Contact',
    email:      best.email,
    position:   best.title || 'Decision Maker',
    confidence: 95,
    phone:      best.phone_numbers?.[0]?.sanitized_number || best.phone_numbers?.[0]?.raw_number || '',
    linkedin:   best.linkedin_url || '',
  };
}

// ── 2. Apollo: Fallback search by organization name ───────────────────────
// Same endpoint but searches by org name instead of domain

async function apolloMatch(domain, organizationName, apiKey) {
  const res = await fetch('https://api.apollo.io/api/v1/mixed_people/search', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache',
      'X-Api-Key': apiKey,
    },
    body: JSON.stringify({
      q_organization_name: organizationName,
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
  const best   = people.find((p) => p.email);
  if (!best?.email) return null;

  return {
    name:       [best.first_name, best.last_name].filter(Boolean).join(' ') || 'Contact',
    email:      best.email,
    position:   best.title || 'Decision Maker',
    confidence: 90,
    phone:      best.phone_numbers?.[0]?.sanitized_number || '',
    linkedin:   best.linkedin_url || '',
  };
}

// ── 3. Snov.io: OAuth token ────────────────────────────────────────────────

async function getSnovToken(clientId, clientSecret) {
  const res = await fetch('https://api.snov.io/v1/oauth/access_token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ grant_type: 'client_credentials', client_id: clientId, client_secret: clientSecret }),
  });
  if (!res.ok) throw new Error(`Snov auth ${res.status}`);
  const data = await res.json();
  if (!data.access_token) throw new Error('No token');
  return data.access_token;
}

// ── 3. Snov.io: Domain Search (async + poll) ──────────────────────────────

async function snovDomainSearch(domain, token) {
  const startRes = await fetch('https://api.snov.io/v2/domain-search/start', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ domain }),
  });

  if (startRes.status === 401) throw new Error('Invalid token');
  if (startRes.status === 429) throw new Error('Rate limit');
  if (!startRes.ok) throw new Error(`Snov start ${startRes.status}`);

  const startData = await startRes.json();
  const taskHash  = startData?.meta?.task_hash || startData?.task_hash;
  if (!taskHash) throw new Error('No task_hash');

  for (let i = 0; i < 5; i++) {
    await sleep(600);
    const r = await fetch(`https://api.snov.io/v2/domain-search/result/${taskHash}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!r.ok) continue;
    const result = await r.json();
    const emails = result?.data?.emails || result?.emails || [];
    if (!emails.length) continue;

    const best = pickBest(emails, (e) => (e.position || e.title || '').toLowerCase());
    if (!best) continue;

    return {
      name:       [best.first_name, best.last_name].filter(Boolean).join(' ') || 'Contact',
      email:      best.email,
      position:   best.position || best.title || 'Decision Maker',
      confidence: best.confidence || 75,
      phone:      best.phone || '',
      linkedin:   best.source_page || '',
    };
  }
  return null;
}

// ── 4. Hunter.io: Domain Search ────────────────────────────────────────────

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
  try {
    const p = new URL(url.startsWith('http') ? url : `https://${url}`);
    return p.hostname.replace(/^www\./, '');
  } catch { return null; }
}

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }
