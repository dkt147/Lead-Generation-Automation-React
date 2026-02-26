export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { lead, template, senderName } = req.body || {};
  if (!lead || !template) {
    return res.status(400).json({ error: 'lead and template are required' });
  }

  try {
    const contactFirstName = (lead.contact?.name || 'there').split(' ')[0];
    const sender = senderName || process.env.EMAIL_FROM_NAME || 'Your Name';

    const subject = replacePlaceholders(template.subject || '', lead, contactFirstName, sender);
    const body = replacePlaceholders(template.body || '', lead, contactFirstName, sender);

    return res.status(200).json({ subject, body, to: lead.contact?.email || '' });
  } catch (err) {
    console.error('Preview error:', err);
    return res.status(500).json({ error: err.message });
  }
}

function replacePlaceholders(text, lead, contactFirstName, senderName) {
  return text
    .replace(/\{\{contact_name\}\}/g, contactFirstName)
    .replace(/\{\{company_name\}\}/g, lead.name || '')
    .replace(/\{\{company_type\}\}/g, lead.searchType || '')
    .replace(/\{\{region\}\}/g, lead.region || '')
    .replace(/\{\{sender_name\}\}/g, senderName)
    .replace(/\{\{contact_position\}\}/g, lead.contact?.position || '')
    .replace(/\{\{company_description\}\}/g, lead.description || '')
    .replace(/\{\{industry\}\}/g, lead.industry || '');
}
