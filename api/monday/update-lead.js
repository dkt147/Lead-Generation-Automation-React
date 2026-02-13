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

  const { itemId, columnValues } = req.body || {};
  if (!itemId || !columnValues) {
    return res.status(400).json({ error: 'itemId and columnValues are required' });
  }

  try {
    const query = `mutation ($board_id: ID!, $item_id: ID!, $column_values: JSON!) {
      change_multiple_column_values(board_id: $board_id, item_id: $item_id, column_values: $column_values) {
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
          item_id: itemId,
          column_values: JSON.stringify(columnValues),
        },
      }),
    });

    const data = await response.json();

    if (data.errors) {
      throw new Error(data.errors.map((e) => e.message).join(', '));
    }

    return res.status(200).json({ success: true, itemId: data?.data?.change_multiple_column_values?.id });
  } catch (err) {
    console.error('Update lead error:', err);
    return res.status(500).json({ error: err.message });
  }
}
