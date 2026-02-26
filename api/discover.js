export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const provider = process.env.AI_PROVIDER || 'openai';
  const apiKey = process.env.AI_API_KEY;

  if (!apiKey) {
    return res.status(500).json({ error: 'AI_API_KEY not configured' });
  }

  const { companyType, region, count = 10, keywords = '', companySize = '' } = req.body || {};

  if (!companyType || !region) {
    return res.status(400).json({ error: 'companyType and region are required' });
  }

  const sizeClause = companySize ? ` of ${companySize} size` : '';
  const keywordsClause = keywords ? ` related to: ${keywords}` : '';

  const prompt = `You are a business research assistant. Find ${count} REAL companies that are ${companyType}${sizeClause} located in or serving ${region}${keywordsClause}.

IMPORTANT: Only provide REAL companies that actually exist. Do not make up fictional companies.

For each company, provide:
1. Company name (official registered name)
2. Website URL (must be real and accessible)
3. Brief description (1-2 sentences about what they do)
4. Specific industry/niche
5. Estimated company size (small/medium/large or employee count if known)

Return your response as a JSON array with this exact structure:
\`\`\`json
[
    {
        "name": "Company Name",
        "website": "https://www.example.com",
        "description": "Brief description of the company",
        "industry": "Specific industry",
        "estimated_size": "small/medium/large"
    }
]
\`\`\`

Return ONLY the JSON array, no additional text or explanation.`;

  try {
    let companies;

    // Both Groq and OpenAI use the OpenAI-compatible chat completions format
    const isGroq = provider === 'groq';
    const baseUrl = isGroq
      ? 'https://api.groq.com/openai/v1/chat/completions'
      : 'https://api.openai.com/v1/chat/completions';
    const model = isGroq ? 'llama-3.3-70b-versatile' : 'gpt-4o-mini';

    const response = await fetch(baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: 'system',
            content: 'You are a business research assistant that finds real companies. Always respond with valid JSON only.',
          },
          { role: 'user', content: prompt },
        ],
        temperature: 0.3,
        max_tokens: 4000,
      }),
    });

    if (!response.ok) {
      const errBody = await response.text();
      throw new Error(`${isGroq ? 'Groq' : 'OpenAI'} API error: ${response.status} - ${errBody}`);
    }

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content || '';
    companies = parseCompanyJSON(text);

    // Validate and clean URLs
    companies = companies.map((c) => ({
      name: c.name || 'Unknown',
      website: normalizeUrl(c.website || ''),
      description: c.description || '',
      industry: c.industry || '',
      estimated_size: c.estimated_size || 'unknown',
    }));

    return res.status(200).json({ companies });
  } catch (err) {
    console.error('Discovery error:', err);
    return res.status(500).json({ error: err.message || 'Discovery failed' });
  }
}

function parseCompanyJSON(text) {
  // Try extracting from markdown code block
  const jsonBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonBlockMatch) {
    return JSON.parse(jsonBlockMatch[1].trim());
  }
  // Try direct JSON array
  const arrayMatch = text.match(/\[[\s\S]*\]/);
  if (arrayMatch) {
    return JSON.parse(arrayMatch[0]);
  }
  throw new Error('Could not parse AI response as JSON');
}

function normalizeUrl(url) {
  if (!url) return '';
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    return 'https://' + url;
  }
  return url;
}
