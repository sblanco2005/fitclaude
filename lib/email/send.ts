const INBOX_ID = process.env.AGENTMAIL_INBOX_ID || 'fitclaude@agentmail.to';
const API_KEY = process.env.AGENTMAIL_API_KEY || '';

export async function sendEmail({ to, subject, html }: { to: string; subject: string; html: string }) {
  const res = await fetch(`https://api.agentmail.to/v0/inboxes/${encodeURIComponent(INBOX_ID)}/messages/send`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ to, subject, html }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`AgentMail send failed (${res.status}): ${err}`);
  }

  return res.json();
}
