import fetch from 'node-fetch';

const webhookUrl = process.env.DISCORD_WEBHOOK_URL;

export default async (message) => {
  if (webhookUrl) {
    const body = JSON.stringify({ content: message });
    const headers = { 'Content-Type': 'application/json' };
    const response = await fetch(webhookUrl, { method: 'POST', body, headers });
    console.log('STATUS', response.status);
    console.log('BODY', await response.text());
  }
};
