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

  const { lead, columnMapping } = req.body || {};
  if (!lead) {
    return res.status(400).json({ error: 'lead object is required' });
  }

  try {
    const columnValues = buildColumnValues(lead, columnMapping || {});
    console.log('Column values being sent:', JSON.stringify(columnValues, null, 2));

    const query = `mutation ($board_id: ID!, $item_name: String!, $column_values: JSON!) {
      create_item(board_id: $board_id, item_name: $item_name, column_values: $column_values) {
        id
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
        variables: {
          board_id: boardId,
          item_name: lead.name || 'New Lead',
          column_values: JSON.stringify(columnValues),
        },
      }),
    });

    const data = await response.json();

    if (data.errors) {
      throw new Error(data.errors.map((e) => e.message).join(', '));
    }

    const itemId = data?.data?.create_item?.id;
    return res.status(200).json({ success: true, itemId });
  } catch (err) {
    console.error('Create lead error:', err);
    return res.status(500).json({ error: err.message });
  }
}

// Format a value based on the Monday.com column type
function formatValue(type, value) {
  switch (type) {
    case 'link':
      return { url: value, text: value };
    case 'email':
      return { email: value, text: value };
    case 'long_text':
    case 'long-text':
      return { text: value };
    case 'status':
    case 'color':
      return { label: value };
    case 'date':
      return { date: value };
    case 'checkbox':
    case 'boolean':
      return { checked: value ? 'true' : 'false' };
    case 'text':
    default:
      // Plain text columns just take a string
      return value;
  }
}

function buildColumnValues(lead, mapping) {
  const values = {};
  const today = new Date().toISOString().split('T')[0];

  // mapping now has shape: { fieldName: { id, type } }
  const m = mapping;

  if (m.website?.id && lead.website) {
    values[m.website.id] = formatValue(m.website.type, lead.website);
  }
  if (m.contact_name?.id && lead.contact?.name) {
    values[m.contact_name.id] = formatValue(m.contact_name.type, lead.contact.name);
  }
  if (m.contact_email?.id && lead.contact?.email) {
    values[m.contact_email.id] = formatValue(m.contact_email.type, lead.contact.email);
  }
  if (m.contact_position?.id && lead.contact?.position) {
    values[m.contact_position.id] = formatValue(m.contact_position.type, lead.contact.position);
  }
  if (m.description?.id && lead.description) {
    values[m.description.id] = formatValue(m.description.type, lead.description);
  }
  if (m.industry?.id && lead.industry) {
    values[m.industry.id] = formatValue(m.industry.type, lead.industry);
  }
  if (m.region?.id && lead.region) {
    values[m.region.id] = formatValue(m.region.type, lead.region);
  }
  if (m.status?.id) {
    values[m.status.id] = formatValue(m.status.type, 'Working on it');
  }
  if (m.date_added?.id) {
    values[m.date_added.id] = formatValue(m.date_added.type, today);
  }
  if (m.lead_source?.id) {
    values[m.lead_source.id] = formatValue(m.lead_source.type, 'AI Discovery');
  }
  if (m.email_sent?.id) {
    values[m.email_sent.id] = formatValue(m.email_sent.type, false);
  }

  return values;
}
