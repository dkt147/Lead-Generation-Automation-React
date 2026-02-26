export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.MONDAY_API_KEY;
  const boardId = process.env.MONDAY_BOARD_ID;

  if (!apiKey || !boardId) {
    return res.status(500).json({ error: 'MONDAY_API_KEY and MONDAY_BOARD_ID must be configured' });
  }

  try {
    const query = `query ($board_id: [ID!]!) {
      boards(ids: $board_id) {
        columns {
          id
          title
          type
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

    const columns = data?.data?.boards?.[0]?.columns || [];
    return res.status(200).json({ columns });
  } catch (err) {
    console.error('Monday columns error:', err);
    return res.status(500).json({ error: err.message });
  }
}
