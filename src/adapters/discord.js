import fetch from 'node-fetch';

const alertId = process.env.DISCORD_ALERT_ID;
const webhookUrl = process.env.DISCORD_WEBHOOK_URL;

export default async (message, shouldAlert = false) => {
  let msg = message;

  if (shouldAlert && alertId) {
    msg = `<@${alertId}> ALERT!! - ${msg}`;
  }

  if (webhookUrl) {
    const body = JSON.stringify({ content: msg });
    const headers = { 'Content-Type': 'application/json' };
    const response = await fetch(webhookUrl, { method: 'POST', body, headers });
    console.log('STATUS', response.status);
    console.log('BODY', await response.text());
  }
};
