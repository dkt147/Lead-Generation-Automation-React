import nodemailer from 'nodemailer';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const fromAddress = process.env.EMAIL_FROM_ADDRESS;
  const appPassword = process.env.EMAIL_APP_PASSWORD;
  const fromName = process.env.EMAIL_FROM_NAME || 'Lead Generation';

  if (!fromAddress || !appPassword) {
    return res.status(500).json({ error: 'Email credentials not configured (EMAIL_FROM_ADDRESS, EMAIL_APP_PASSWORD)' });
  }

  const { to, subject, body } = req.body || {};
  if (!to || !subject || !body) {
    return res.status(400).json({ error: 'to, subject, and body are required' });
  }

  try {
    const transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 587,
      secure: false,
      auth: {
        user: fromAddress,
        pass: appPassword,
      },
    });

    await transporter.sendMail({
      from: `"${fromName}" <${fromAddress}>`,
      to,
      subject,
      text: body,
    });

    return res.status(200).json({ success: true, recipient: to });
  } catch (err) {
    console.error('Email send error:', err);
    return res.status(500).json({ error: err.message, recipient: to });
  }
}
