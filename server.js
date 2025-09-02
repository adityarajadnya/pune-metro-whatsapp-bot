const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs-extra');
const OpenAI = require('openai');
const bodyParser = require('body-parser');
const WhatsAppBot = require('./whatsapp');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize OpenAI
let openai;
if (process.env.OPENAI_API_KEY) {
  openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });
  console.log('OpenAI initialized successfully');
} else {
  console.error('OPENAI_API_KEY environment variable is missing!');
  console.log('Available environment variables:', Object.keys(process.env).filter(key => key.includes('OPENAI') || key.includes('WHATSAPP')));
}

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
    console.log('Loading knowledge base...');
    knowledgeBase = await fs.readJson('./pune_metro_knowledge.json');
    console.log('Knowledge base loaded successfully');
    
    const faqContent = await fs.readFile('./faq_qa.jsonl', 'utf8');
    faqData = faqContent.trim().split('\n').map(line => JSON.parse(line));
    console.log('FAQ data loaded successfully');
    
    stationSynonyms = await fs.readJson('./station_synonyms.json');
    console.log('Station synonyms loaded successfully');
  } catch (error) {
    console.error('Error loading knowledge base:', error);
    // Initialize with empty data if files don't exist
    knowledgeBase = {};
    faqData = [];
    stationSynonyms = {};
  }
}

// Chatbot endpoint
app.post('/api/chat', async (req, res) => {
  try {
    const { message } = req.body;
    
    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    if (!openai) {
      return res.status(500).json({ error: 'OpenAI service not available. Please check API key configuration.' });
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
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    });
    res.status(500).json({ 
      error: 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? error.message : 'Please try again'
    });
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
    console.log('Webhook received:', new Date().toISOString());
    const body = req.body;
    
    if (body.object === 'whatsapp_business_account') {
      if (body.entry && body.entry.length > 0) {
        const entry = body.entry[0];
        
        if (entry.changes && entry.changes.length > 0) {
          const change = entry.changes[0];
          
          if (change.value && change.value.messages && change.value.messages.length > 0) {
            const message = change.value.messages[0];
            console.log('Full message from WhatsApp:', JSON.stringify(message, null, 2));
            
            // Process the message
            const messageData = {
              from: message.from,
              text: message.text,
              type: message.type,
              interactive: message.interactive,
              button_reply: message.button_reply
            };
            
            console.log('Processed message data:', JSON.stringify(messageData, null, 2));
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

    if (!openai) {
      return res.status(500).json({ error: 'OpenAI service not available. Please check API key configuration.' });
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

STATION NUMBERING REFERENCE:
Purple Line Stations (in order):
1. PCMC, 2. Sant Tukaram Nagar, 3. Bhosari, 4. Kasarwadi, 5. Phugewadi, 6. Dapodi, 7. Bopodi, 8. Khadki, 9. Shivaji Nagar, 10. Civil Court (District Court), 11. Pune Railway Station, 12. Budhwar Peth, 13. Mandai, 14. Swargate

Aqua Line Stations (in order):
1. Vanaz, 2. Anand Nagar, 3. Ideal Colony, 4. Nal Stop, 5. Garware College, 6. Deccan Gymkhana, 7. Chhatrapati Sambhaji Udyan, 8. PMC, 9. Civil Court (District Court), 10. Mangalwar Peth, 11. Pune Railway Station, 12. Budhwar Peth, 13. Mandai, 14. Swargate, 15. Ramwadi

When users ask about "station 4" or "4th station", they mean the 4th station in the sequence (Kasarwadi for Purple Line, Nal Stop for Aqua Line).

FARE CALCULATION SYSTEM:
- Count stations between origin and destination (excluding origin, including destination)
- 1-3 stations: ₹10-15
- 4-7 stations: ₹20-25  
- 8+ stations: ₹30-35
- Transfer routes (different lines): Add ₹5-10 for interchange at Civil Court
- Examples: PCMC to Swargate (13 stations) = ₹35, Dapodi to Shivaji Nagar (3 stations) = ₹15

DURATION CALCULATION:
- Average time per station: 2-3 minutes
- Interchange time at Civil Court: 5-10 minutes
- Direct routes: Stations × 2.5 minutes
- Transfer routes: (Stations × 2.5) + 7 minutes (interchange time)
- Examples: PCMC to Swargate (13 stations) = 32-39 minutes, Dapodi to Shivaji Nagar (3 stations) = 6-9 minutes

NEXT TRAIN TIMING:
- Peak hours (7-10 AM, 6-9 PM): Every 5 minutes
- Off-peak hours: Every 8-10 minutes
- First train: 06:00 AM, Last train: 11:00 PM
- Current time context: Provide realistic next train timing based on typical schedule

Please provide a helpful, accurate response based on the Pune Metro knowledge base. 
If the information is not available in the knowledge base, say so politely.
Keep responses concise and informative for WhatsApp format.
`;

    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: "You are a helpful Pune Metro assistant with access to comprehensive route information, fares, stations, and policies. You have detailed knowledge of both Purple Line (PCMC-Swargate) and Aqua Line (Vanaz-Ramwadi) including all stations and the interchange at Civil Court. Always provide specific, accurate information from the knowledge base when available. Format responses for WhatsApp with emojis and clear structure.\n\nIMPORTANT: When users refer to station numbers (like '4th station', 'station 4', 'between station 4 and 10'), interpret this as:\n1. If they just saw a numbered list of stations, they likely mean the position in that list (1st, 2nd, 3rd, etc.)\n2. If they mention 'station 4' or '4th station', they mean the 4th station in the sequence (Kasarwadi for Purple Line)\n3. Always clarify which stations you're referring to by name to avoid confusion\n4. For fare queries between numbered stations, show both the station names and the fare amount.\n\nFARE CALCULATION RULES:\n- Calculate fare based on number of stations between origin and destination\n- 1-3 stations: ₹10-15, 4-7 stations: ₹20-25, 8+ stations: ₹30-35\n- For transfer routes (different lines), add ₹5-10 for interchange\n- Always show the exact fare amount and calculation method\n\nDURATION CALCULATION:\n- Average time per station: 2-3 minutes\n- Interchange time at Civil Court: 5-10 minutes\n- Calculate total travel time including interchange if applicable\n- Show both direct route time and transfer route time if different lines\n\nNEXT TRAIN TIMING:\n- Peak hours (7-10 AM, 6-9 PM): Every 5 minutes\n- Off-peak hours: Every 8-10 minutes\n- First train: 06:00 AM, Last train: 11:00 PM\n- Provide next train timing based on current time and station direction"
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
    
    // Don't send response here - let the calling function handle it
    // await whatsappBot.sendTextMessage(from, response);
    
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

// Test endpoint
app.get('/api/test', (req, res) => {
  res.json({
    status: 'OK',
    openai: !!openai,
    knowledgeBase: Object.keys(knowledgeBase).length,
    faqCount: faqData.length,
    synonymsCount: Object.keys(stationSynonyms).length,
    env: {
      OPENAI_API_KEY: !!process.env.OPENAI_API_KEY,
      NODE_ENV: process.env.NODE_ENV
    }
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Initialize and start server
loadKnowledgeBase().then(() => {
  console.log('Starting server...');
  
  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`Pune Metro Chatbot running on port ${PORT}`);
    console.log(`WhatsApp webhook: /webhook`);
    console.log('Environment variables loaded:', {
      OPENAI_API_KEY: process.env.OPENAI_API_KEY ? 'Set' : 'Missing',
      WHATSAPP_ACCESS_TOKEN: process.env.WHATSAPP_ACCESS_TOKEN ? 'Set' : 'Missing',
      WHATSAPP_PHONE_NUMBER_ID: process.env.WHATSAPP_PHONE_NUMBER_ID ? 'Set' : 'Missing',
      WHATSAPP_VERIFY_TOKEN: process.env.WHATSAPP_VERIFY_TOKEN ? 'Set' : 'Missing'
    });
  });

  // Handle server errors
  server.on('error', (error) => {
    console.error('Server error:', error);
    if (error.code === 'EADDRINUSE') {
      console.error(`Port ${PORT} is already in use`);
    }
  });

  // Handle graceful shutdown
  process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down gracefully');
    server.close(() => {
      console.log('Server closed');
      process.exit(0);
    });
  });

  process.on('SIGINT', () => {
    console.log('SIGINT received, shutting down gracefully');
    server.close(() => {
      console.log('Server closed');
      process.exit(0);
    });
  });

}).catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
