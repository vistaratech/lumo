/**
 * Lumo Push Notification Broadcast Tool
 *
 * Usage:
 *   node scripts/send-broadcast.js "Title" "Message body" "ExponentPushToken[xxxx]"
 *
 * Example:
 *   node scripts/send-broadcast.js "Lumo Smart Alert" "Remember to turn off your AC and water heater!" "ExponentPushToken[your_token]"
 */

const https = require('https');

const args = process.argv.slice(2);
const title = args[0] || 'Lumo Home Alert';
const body = args[1] || 'Your smart home is running smoothly. ✨';
const targetTokens = args[2] ? args[2].split(',').map((t) => t.trim()) : [];

if (targetTokens.length === 0) {
  console.log(`
======================================================
  Lumo Push Notification Broadcast Tool
======================================================
Usage:
  node scripts/send-broadcast.js "<TITLE>" "<BODY>" "<TOKEN1,TOKEN2,...>"

Example:
  node scripts/send-broadcast.js "Lumo Reminder" "Check your lights tonight!" "ExponentPushToken[xxxx]"

To find a customer's token, check the app's Settings -> Smart Notifications screen.
======================================================
`);
  process.exit(1);
}

const messages = targetTokens.map((token) => ({
  to: token,
  sound: 'default',
  title,
  body,
  data: { timestamp: Date.now() },
}));

const postData = JSON.stringify(messages);

const options = {
  hostname: 'exp.host',
  port: 443,
  path: '/--/api/v2/push/send',
  method: 'POST',
  headers: {
    Accept: 'application/json',
    'Accept-encoding': 'gzip, deflate',
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(postData),
  },
};

console.log(`🚀 Sending broadcast to ${messages.length} device(s)...`);

const req = https.request(options, (res) => {
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  res.on('end', () => {
    try {
      const response = JSON.parse(data);
      console.log('✅ Response from Expo Push Service:');
      console.log(JSON.stringify(response, null, 2));
    } catch {
      console.log('Response:', data);
    }
  });
});

req.on('error', (e) => {
  console.error('❌ Error sending notification:', e.message);
});

req.write(postData);
req.end();
