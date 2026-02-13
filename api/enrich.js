const DECISION_MAKER_TITLES = [
  'ceo', 'chief executive', 'founder', 'co-founder', 'owner',
  'president', 'director', 'vp', 'vice president',
  'managing', 'manager', 'head', 'lead', 'partner',
];

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const hunterKey = process.env.HUNTER_API_KEY;
  if (!hunterKey) {
    return res.status(500).json({ error: 'HUNTER_API_KEY not configured' });
  }

  const { companies } = req.body || {};
  if (!companies || !Array.isArray(companies) || companies.length === 0) {
    return res.status(400).json({ error: 'companies array is required' });
  }

  const enriched = [];

  for (const company of companies) {
    try {
      const domain = extractDomain(company.website);
      if (!domain) {
        enriched.push({ ...company, contact: null, enrichmentError: 'Invalid website URL' });
        continue;
      }

      // Hunter.io domain search
      const url = `https://api.hunter.io/v2/domain-search?domain=${encodeURIComponent(domain)}&api_key=${hunterKey}&limit=10`;
      const response = await fetch(url);

      if (!response.ok) {
        const errText = await response.text();
        enriched.push({ ...company, contact: null, enrichmentError: `Hunter.io error: ${response.status}` });
        continue;
      }

      const data = await response.json();
      const emails = data?.data?.emails || [];

      if (emails.length === 0) {
        enriched.push({ ...company, contact: null, enrichmentError: 'No contacts found' });
        continue;
      }

      // Pick best decision-maker
      const bestContact = pickBestContact(emails);
      enriched.push({
        ...company,
        contact: {
          name: [bestContact.first_name, bestContact.last_name].filter(Boolean).join(' ') || 'Contact',
          email: bestContact.value,
          position: bestContact.position || 'Unknown',
          confidence: bestContact.confidence || 0,
          phone: bestContact.phone_number || '',
          linkedin: bestContact.linkedin || '',
        },
      });

      // Rate limiting: 500ms between calls
      await sleep(500);
    } catch (err) {
      enriched.push({ ...company, contact: null, enrichmentError: err.message });
    }
  }

  return res.status(200).json({ enriched });
}

function extractDomain(url) {
  if (!url) return null;
  try {
    const parsed = new URL(url.startsWith('http') ? url : `https://${url}`);
    return parsed.hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
}

function pickBestContact(emails) {
  let bestScore = Infinity;
  let bestContact = emails[0];

  for (const email of emails) {
    const position = (email.position || '').toLowerCase();
    let titleScore = DECISION_MAKER_TITLES.length + 1; // default: no match

    for (let i = 0; i < DECISION_MAKER_TITLES.length; i++) {
      if (position.includes(DECISION_MAKER_TITLES[i])) {
        titleScore = i;
        break;
      }
    }

    // Lower score = better (title rank matters most, then confidence)
    const score = titleScore * 1000 - (email.confidence || 0);
    if (score < bestScore) {
      bestScore = score;
      bestContact = email;
    }
  }

  return bestContact;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
