export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.MONDAY_API_KEY;
  const boardId = process.env.MONDAY_BOARD_ID;

  if (!apiKey || !boardId) {
    return res.status(500).json({ error: 'MONDAY_API_KEY and MONDAY_BOARD_ID must be configured' });
  }

  const { companies } = req.body || {};
  if (!companies || !Array.isArray(companies)) {
    return res.status(400).json({ error: 'companies array is required' });
  }

  try {
    // Fetch all items from the board
    const query = `query ($board_id: [ID!]!) {
      boards(ids: $board_id) {
        items_page(limit: 500) {
          items {
            id
            name
            column_values {
              id
              text
            }
          }
        }
      }
    }`;

    const response = await fetch('https://api.monday.com/v2', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: apiKey,
        'API-Version': '2024-01',
      },
      body: JSON.stringify({
        query,
        variables: { board_id: [boardId] },
      }),
    });

    const data = await response.json();

    if (data.errors) {
      throw new Error(data.errors.map((e) => e.message).join(', '));
    }

    const existingItems = data?.data?.boards?.[0]?.items_page?.items || [];

    // Check each company for duplicates
    const results = companies.map((company) => {
      const matches = findDuplicates(company, existingItems);
      return {
        company,
        isDuplicate: matches.length > 0,
        matches: matches.map((m) => ({
          itemId: m.id,
          name: m.name,
          columnValues: m.column_values,
        })),
      };
    });

    return res.status(200).json({ results });
  } catch (err) {
    console.error('Duplicate check error:', err);
    return res.status(500).json({ error: err.message });
  }
}

function findDuplicates(company, existingItems) {
  const matches = [];
  const companyDomain = normalizeDomain(company.website);
  const companyNameClean = normalizeCompanyName(company.name);
  const companyEmail = (company.contact?.email || '').toLowerCase().trim();

  for (const item of existingItems) {
    const itemName = normalizeCompanyName(item.name);
    let matched = false;

    // Check company name match
    if (companyNameClean && itemName && (companyNameClean.includes(itemName) || itemName.includes(companyNameClean))) {
      matched = true;
    }

    // Check column values for domain and email matches
    for (const col of item.column_values || []) {
      const text = (col.text || '').toLowerCase().trim();
      if (!text) continue;

      // Domain match
      if (companyDomain && text.includes(companyDomain)) {
        matched = true;
      }

      // Email match
      if (companyEmail && text === companyEmail) {
        matched = true;
      }
    }

    if (matched) {
      matches.push(item);
    }
  }

  return matches;
}

function normalizeDomain(url) {
  if (!url) return '';
  try {
    const parsed = new URL(url.startsWith('http') ? url : `https://${url}`);
    return parsed.hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return '';
  }
}

function normalizeCompanyName(name) {
  if (!name) return '';
  return name
    .toLowerCase()
    .replace(/\b(inc|llc|ltd|corp|corporation|pty ltd|co|company|group|limited|gmbh|sa|srl)\b\.?/g, '')
    .replace(/[^a-z0-9\s]/g, '')
    .trim()
    .replace(/\s+/g, ' ');
}
