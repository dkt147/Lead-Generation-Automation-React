export function truncate(str, maxLen = 80) {
  if (!str) return '';
  return str.length > maxLen ? str.slice(0, maxLen) + '...' : str;
}

export function formatConfidence(score) {
  if (score == null) return 'N/A';
  return `${Math.round(score)}%`;
}

export function formatDate(date) {
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function capitalize(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}

export function extractFirstName(fullName) {
  if (!fullName) return 'there';
  return fullName.split(' ')[0];
}

export const DEFAULT_EMAIL_TEMPLATE = {
  subject: 'Quick Introduction - {{sender_name}} + {{company_name}}',
  body: `Hi {{contact_name}},

I came across {{company_name}} while researching {{company_type}} companies in {{region}} and wanted to reach out.

I'd love to learn more about your work and explore if there might be any opportunities for collaboration.

Would you be open to a brief conversation?

Best regards,
{{sender_name}}`,
};
