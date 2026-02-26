const BASE = '/api';

async function request(path, options = {}) {
  const url = `${BASE}${path}`;
  const config = {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  };

  const response = await fetch(url, config);
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || `Request failed: ${response.status}`);
  }

  return data;
}

export async function discoverCompanies(params) {
  return request('/discover', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

export async function enrichContacts(companies) {
  return request('/enrich', {
    method: 'POST',
    body: JSON.stringify({ companies }),
  });
}

export async function enrichSingle(company) {
  return request('/enrich', {
    method: 'POST',
    body: JSON.stringify({ company }),
  });
}

export async function pushLeadToDashboard(lead) {
  return request('/dashboard/push-lead', {
    method: 'POST',
    body: JSON.stringify({ lead }),
  });
}

export async function previewEmail(lead, template, senderName) {
  return request('/email/preview', {
    method: 'POST',
    body: JSON.stringify({ lead, template, senderName }),
  });
}

export async function sendEmail(to, subject, body) {
  return request('/email/send', {
    method: 'POST',
    body: JSON.stringify({ to, subject, body }),
  });
}

export async function pushLeadToClay(lead) {
  return request('/clay/push-record', {
    method: 'POST',
    body: JSON.stringify({ lead }),
  });
}

export async function healthCheck() {
  return request('/health');
}
