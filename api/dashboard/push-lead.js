export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.LEADS_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'LEADS_API_KEY must be configured' });
  }

  const { lead } = req.body || {};
  if (!lead) {
    return res.status(400).json({ error: 'lead object is required' });
  }

  try {
    const payload = {
      name: lead.contact?.name || lead.name || 'Unknown',
      email: lead.contact?.email || '',
      company: lead.name || '',
      phone: lead.contact?.phone || '',
      message: [
        lead.description || '',
        lead.industry ? `Industry: ${lead.industry}` : '',
        lead.region ? `Region: ${lead.region}` : '',
        lead.website ? `Website: ${lead.website}` : '',
        lead.contact?.position ? `Position: ${lead.contact.position}` : '',
      ]
        .filter(Boolean)
        .join(' | '),
    };

    const response = await fetch(
      'https://qmtrtrvcwkhzdmgswext.supabase.co/functions/v1/ingest-external-lead',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || `Dashboard API returned ${response.status}`);
    }

    return res.status(200).json({ success: true, leadId: data.lead_id });
  } catch (err) {
    console.error('Push lead error:', err);
    return res.status(500).json({ error: err.message });
  }
}
