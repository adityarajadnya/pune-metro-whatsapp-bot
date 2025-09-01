const WhatsAppBot = require('../../whatsapp');

// Initialize WhatsApp bot
const whatsappBot = new WhatsAppBot();

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle OPTIONS request for CORS
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // Handle GET request for webhook verification
  if (req.method === 'GET') {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    console.log('Webhook verification attempt:', { mode, token, challenge });

    // Simple verification logic
    if (mode === 'subscribe' && token === 'pune_metro_verify_token_2025') {
      console.log('WhatsApp webhook verified successfully');
      res.status(200).send(challenge);
    } else {
      console.log('WhatsApp webhook verification failed');
      res.sendStatus(403);
    }
    return;
  }

  // Handle POST request for incoming messages
  if (req.method === 'POST') {
    try {
      console.log('Received webhook POST:', JSON.stringify(req.body, null, 2));
      
      // For now, just acknowledge the message
      // You can add WhatsApp processing logic here later
      
      res.sendStatus(200);
    } catch (error) {
      console.error('Webhook processing error:', error);
      res.sendStatus(500);
    }
    return;
  }

  // Handle other methods
  res.setHeader('Allow', ['GET', 'POST', 'OPTIONS']);
  res.status(405).end(`Method ${req.method} Not Allowed`);
}
