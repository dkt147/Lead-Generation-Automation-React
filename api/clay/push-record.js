/**
 * Clay Table Push Handler
 * Sends an enriched lead as a new record into a Clay table via its HTTP source.
 *
 * Setup in Clay:
 *   1. Open your Clay table → Add source → "HTTP API"
 *   2. Copy the source ID from the webhook URL shown (the part after /http-api/)
 *   3. Set CLAY_TABLE_ID=<that source ID> in .env
 *
 * Endpoint: POST https://api.clay.com/v3/sources/http-api/{CLAY_TABLE_ID}/records
 * Auth:     Authorization: Bearer CLAY_API_KEY
 * Docs:     https://university.clay.com/docs/http-api-integration-overview
 */

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const clayApiKey = process.env.CLAY_API_KEY;
  const clayTableId = process.env.CLAY_TABLE_ID;

  if (!clayApiKey) {
    return res.status(500).json({ error: 'CLAY_API_KEY not configured' });
  }
  if (!clayTableId) {
    return res.status(500).json({
      error: 'CLAY_TABLE_ID not configured. Add your Clay HTTP source ID to .env',
    });
  }

  const { lead } = req.body || {};
  if (!lead) {
    return res.status(400).json({ error: 'lead object is required' });
  }

  // Map our lead shape to flat Clay record fields
  const record = {
    company_name:        lead.name || '',
    company_website:     lead.website || '',
    company_industry:    lead.industry || '',
    company_size:        lead.estimated_size || '',
    company_description: lead.description || '',
    region:              lead.region || '',
    contact_name:        lead.contact?.name || '',
    contact_email:       lead.contact?.email || '',
    contact_position:    lead.contact?.position || '',
    contact_phone:       lead.contact?.phone || '',
    contact_linkedin:    lead.contact?.linkedin || '',
    enrichment_source:   lead.enrichmentSource || '',
    enriched_at:         new Date().toISOString(),
  };

  try {
    const response = await fetch(
      `https://api.clay.com/v3/sources/http-api/${clayTableId}/records`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${clayApiKey}`,
        },
        body: JSON.stringify(record),
      }
    );

    // Clay returns 200/201 on success
    if (response.status === 401) {
      return res.status(401).json({ error: 'Invalid Clay API key' });
    }
    if (response.status === 404) {
      return res.status(404).json({
        error: 'Clay table source not found — check your CLAY_TABLE_ID',
      });
    }
    if (!response.ok) {
      const body = await response.text();
      return res.status(502).json({ error: `Clay API error ${response.status}: ${body}` });
    }

    const data = await response.json().catch(() => ({}));
    return res.status(200).json({ success: true, clayRecordId: data?.id || null });
  } catch (err) {
    console.error('Clay push error:', err);
    return res.status(500).json({ error: err.message });
  }
}
