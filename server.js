const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs-extra');
const OpenAI = require('openai');
const bodyParser = require('body-parser');
const WhatsAppBot = require('./whatsapp');
require('dotenv').config({ path: './config.env' });

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Initialize WhatsApp bot
const whatsappBot = new WhatsAppBot();

// Middleware
app.use(cors());
app.use(express.json());
app.use(bodyParser.json());
app.use(express.static('public'));

// Load knowledge base
let knowledgeBase = {};
let faqData = [];
let stationSynonyms = {};

async function loadKnowledgeBase() {
  try {
    knowledgeBase = await fs.readJson('./pune_metro_knowledge.json');
    const faqContent = await fs.readFile('./faq_qa.jsonl', 'utf8');
    faqData = faqContent.trim().split('\n').map(line => JSON.parse(line));
    stationSynonyms = await fs.readJson('./station_synonyms.json');
  } catch (error) {
    console.error('Error loading knowledge base:', error);
  }
}

// Chatbot endpoint
app.post('/api/chat', async (req, res) => {
  try {
    const { message } = req.body;
    
    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    // Create context from knowledge base
    const context = `
Pune Metro Knowledge Base:
${JSON.stringify(knowledgeBase, null, 2)}

FAQ Data:
${JSON.stringify(faqData, null, 2)}

Station Synonyms:
${JSON.stringify(stationSynonyms, null, 2)}

User Question: ${message}

IMPORTANT: The knowledge base contains comprehensive route information including:
- Purple Line: PCMC to Swargate (14 stations)
- Aqua Line: Vanaz to Ramwadi (15 stations)  
- Interchange at Civil Court (District Court)
- Complete station lists for both lines

Please provide a helpful, accurate response based on the Pune Metro knowledge base. 
If the information is not available in the knowledge base, say so politely.
Keep responses concise and informative.
`;

    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: "You are a helpful Pune Metro assistant with access to comprehensive route information, fares, stations, and policies. You have detailed knowledge of both Purple Line (PCMC-Swargate) and Aqua Line (Vanaz-Ramwadi) including all stations and the interchange at Civil Court. Always provide specific, accurate information from the knowledge base when available."
        },
        {
          role: "user",
          content: context
        }
      ],
      max_tokens: 500,
      temperature: 0.7,
    });

    const response = completion.choices[0].message.content;
    res.json({ response });
  } catch (error) {
    console.error('Chat error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Admin endpoints
app.get('/api/admin/data', async (req, res) => {
  try {
    res.json({
      knowledge: knowledgeBase,
      faq: faqData,
      synonyms: stationSynonyms
    });
  } catch (error) {
    res.status(500).json({ error: 'Error loading data' });
  }
});

// Natural language processing endpoint
app.post('/api/admin/process-nl', async (req, res) => {
  try {
    const { request, currentData } = req.body;
    
    if (!request) {
      return res.status(400).json({ error: 'Request is required' });
    }

    const context = `
Current Knowledge Base:
${JSON.stringify(currentData, null, 2)}

User Request: ${request}

Analyze this request and determine what changes need to be made to the knowledge base. 
Return a JSON response with:
1. "analysis": A human-readable explanation of what the request means
2. "changes": An object with the specific changes to make (if any)

For FAQ operations:
- "add": { "type": "faq", "action": "add", "data": { "q": "question", "a": "answer", "tags": ["tag1"], "evidence": ["source1"] } }
- "update": { "type": "faq", "action": "update", "data": { "q": "question", "a": "answer", "tags": ["tag1"], "evidence": ["source1"] } }
- "delete": { "type": "faq", "action": "delete", "data": { "q": "question" } }

For synonym operations:
- "add": { "type": "synonyms", "action": "add", "data": { "station": "station_name", "synonyms": ["synonym1"] } }
- "update": { "type": "synonyms", "action": "update", "data": { "station": "station_name", "synonyms": ["synonym1"] } }
- "delete": { "type": "synonyms", "action": "delete", "data": { "station": "station_name" } }

For knowledge base operations:
- "update": { "type": "knowledge", "action": "update", "data": { "section": "section_name", "changes": {...} } }

If no changes are needed, return null for "changes".
`;

    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: "You are an AI assistant that helps manage the Pune Metro knowledge base. You understand natural language requests and can translate them into specific data operations."
        },
        {
          role: "user",
          content: context
        }
      ],
      max_tokens: 1000,
      temperature: 0.3,
    });

    const response = completion.choices[0].message.content;
    
    try {
      const parsedResponse = JSON.parse(response);
      res.json(parsedResponse);
    } catch (parseError) {
      res.json({
        analysis: response,
        changes: null
      });
    }
  } catch (error) {
    console.error('NL processing error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/admin/update', async (req, res) => {
  try {
    const { type, data, action } = req.body;
    
    switch (type) {
      case 'faq':
        if (action === 'add') {
          faqData.push(data);
        } else if (action === 'update') {
          const index = faqData.findIndex(item => item.q === data.q);
          if (index !== -1) faqData[index] = data;
        } else if (action === 'delete') {
          faqData = faqData.filter(item => item.q !== data.q);
        }
        await fs.writeFile('./faq_qa.jsonl', faqData.map(item => JSON.stringify(item)).join('\n'));
        break;
        
      case 'knowledge':
        knowledgeBase = data;
        await fs.writeJson('./pune_metro_knowledge.json', data, { spaces: 2 });
        break;
        
      case 'synonyms':
        stationSynonyms = data;
        await fs.writeJson('./station_synonyms.json', data, { spaces: 2 });
        break;
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('Update error:', error);
    res.status(500).json({ error: 'Error updating data' });
  }
});

// WhatsApp Webhook endpoints
app.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  const verification = whatsappBot.verifyWebhook(mode, token, challenge);
  
  if (verification) {
    console.log('WhatsApp webhook verified');
    res.status(200).send(verification);
  } else {
    console.log('WhatsApp webhook verification failed');
    res.sendStatus(403);
  }
});

app.post('/webhook', async (req, res) => {
  try {
    const body = req.body;
    
    if (body.object === 'whatsapp_business_account') {
      if (body.entry && body.entry.length > 0) {
        const entry = body.entry[0];
        
        if (entry.changes && entry.changes.length > 0) {
          const change = entry.changes[0];
          
          if (change.value && change.value.messages && change.value.messages.length > 0) {
            const message = change.value.messages[0];
            
            // Process the message
            const messageData = {
              from: message.from,
              text: message.text,
              type: message.type
            };
            
            await whatsappBot.processMessage(messageData);
          }
        }
      }
    }
    
    res.sendStatus(200);
  } catch (error) {
    console.error('Webhook processing error:', error);
    res.sendStatus(500);
  }
});

// WhatsApp AI Chat endpoint (for complex queries)
app.post('/api/whatsapp/chat', async (req, res) => {
  try {
    const { message, from } = req.body;
    
    if (!message || !from) {
      return res.status(400).json({ error: 'Message and from are required' });
    }

    // Create context from knowledge base
    const context = `
Pune Metro Knowledge Base:
${JSON.stringify(knowledgeBase, null, 2)}

FAQ Data:
${JSON.stringify(faqData, null, 2)}

Station Synonyms:
${JSON.stringify(stationSynonyms, null, 2)}

User Question: ${message}

IMPORTANT: The knowledge base contains comprehensive route information including:
- Purple Line: PCMC to Swargate (14 stations)
- Aqua Line: Vanaz to Ramwadi (15 stations)  
- Interchange at Civil Court (District Court)
- Complete station lists for both lines

Please provide a helpful, accurate response based on the Pune Metro knowledge base. 
If the information is not available in the knowledge base, say so politely.
Keep responses concise and informative for WhatsApp format.
`;

    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: "You are a helpful Pune Metro assistant with access to comprehensive route information, fares, stations, and policies. You have detailed knowledge of both Purple Line (PCMC-Swargate) and Aqua Line (Vanaz-Ramwadi) including all stations and the interchange at Civil Court. Always provide specific, accurate information from the knowledge base when available. Format responses for WhatsApp with emojis and clear structure."
        },
        {
          role: "user",
          content: context
        }
      ],
      max_tokens: 500,
      temperature: 0.7,
    });

    const response = completion.choices[0].message.content;
    
    // Send response via WhatsApp
    await whatsappBot.sendTextMessage(from, response);
    
    res.json({ success: true, response });
  } catch (error) {
    console.error('WhatsApp AI chat error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// Initialize and start server
loadKnowledgeBase().then(() => {
  app.listen(PORT, () => {
    console.log(`Pune Metro Chatbot running on http://localhost:${PORT}`);
    console.log(`WhatsApp webhook: http://localhost:${PORT}/webhook`);
  });
});
