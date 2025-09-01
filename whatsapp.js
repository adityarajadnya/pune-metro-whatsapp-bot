const axios = require('axios');

class WhatsAppBot {
    constructor() {
        this.accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
        this.phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
        this.verifyToken = process.env.WHATSAPP_VERIFY_TOKEN;
        this.apiVersion = 'v18.0';
        this.baseUrl = `https://graph.facebook.com/${this.apiVersion}`;
        this.processedMessages = new Set(); // Track processed messages to prevent duplicates
    }

    // Verify webhook for WhatsApp
    verifyWebhook(mode, token, challenge) {
        if (mode === 'subscribe' && token === this.verifyToken) {
            return challenge;
        }
        return false;
    }

    // Send text message
    async sendTextMessage(to, text) {
        try {
            console.log('Sending WhatsApp message:', { to, text });
            console.log('Using credentials:', {
                phoneNumberId: this.phoneNumberId,
                accessToken: this.accessToken ? 'Set' : 'Missing',
                baseUrl: this.baseUrl
            });

            const response = await axios.post(
                `${this.baseUrl}/${this.phoneNumberId}/messages`,
                {
                    messaging_product: 'whatsapp',
                    to: to,
                    type: 'text',
                    text: { body: text }
                },
                {
                    headers: {
                        'Authorization': `Bearer ${this.accessToken}`,
                        'Content-Type': 'application/json'
                    }
                }
            );
            return response.data;
        } catch (error) {
            console.error('WhatsApp send error:', {
                message: error.message,
                status: error.response?.status,
                statusText: error.response?.statusText,
                data: error.response?.data,
                config: {
                    url: error.config?.url,
                    method: error.config?.method
                }
            });
            throw error;
        }
    }

    // Send interactive message with buttons
    async sendInteractiveMessage(to, text, buttons) {
        try {
            const response = await axios.post(
                `${this.baseUrl}/${this.phoneNumberId}/messages`,
                {
                    messaging_product: 'whatsapp',
                    to: to,
                    type: 'interactive',
                    interactive: {
                        type: 'button',
                        body: { text: text },
                        action: {
                            buttons: buttons.map((btn, index) => ({
                                type: 'reply',
                                reply: {
                                    id: `btn_${index}`,
                                    title: btn.title
                                }
                            }))
                        }
                    }
                },
                {
                    headers: {
                        'Authorization': `Bearer ${this.accessToken}`,
                        'Content-Type': 'application/json'
                    }
                }
            );
            return response.data;
        } catch (error) {
            console.error('WhatsApp interactive send error:', error.response?.data || error.message);
            throw error;
        }
    }

    // Send quick reply options
    async sendQuickReplies(to, text, options) {
        try {
            const response = await axios.post(
                `${this.baseUrl}/${this.phoneNumberId}/messages`,
                {
                    messaging_product: 'whatsapp',
                    to: to,
                    type: 'interactive',
                    interactive: {
                        type: 'button',
                        body: { text: text },
                        action: {
                            buttons: options.map((option, index) => ({
                                type: 'reply',
                                reply: {
                                    id: `qr_${index}`,
                                    title: option
                                }
                            }))
                        }
                    }
                },
                {
                    headers: {
                        'Authorization': `Bearer ${this.accessToken}`,
                        'Content-Type': 'application/json'
                    }
                }
            );
            return response.data;
        } catch (error) {
            console.error('WhatsApp quick reply error:', error.response?.data || error.message);
            throw error;
        }
    }

    // Process incoming message
    async processMessage(messageData) {
        console.log('Processing message:', JSON.stringify(messageData, null, 2));
        const { from, text, type } = messageData;
        
        // Create a unique message ID for deduplication
        const messageId = `${from}_${type}_${JSON.stringify(text)}_${Date.now()}`;
        
        // Check if we've already processed this message
        if (this.processedMessages.has(messageId)) {
            console.log('Duplicate message detected, skipping:', messageId);
            return null;
        }
        
        // Add to processed messages (keep only last 100 to prevent memory issues)
        this.processedMessages.add(messageId);
        if (this.processedMessages.size > 100) {
            const firstMessage = this.processedMessages.values().next().value;
            this.processedMessages.delete(firstMessage);
        }
        
        if (type === 'text' && text) {
            // Handle different text message structures
            const messageText = text.body || text.text || text;
            if (messageText) {
                console.log('Processing text message:', messageText);
                return await this.handleTextMessage(from, messageText);
            } else {
                console.log('No text content found in message');
            }
        } else if (type === 'interactive' && text?.interactive?.type === 'button_reply') {
            // Process button clicks
            return await this.handleButtonClick(from, text.interactive.button_reply.id);
        }
        
        console.log('Message type not handled:', type);
        return null;
    }

    // Handle text messages
    async handleTextMessage(from, text) {
        if (!text) {
            console.log('No text provided to handleTextMessage');
            return null;
        }
        
        const lowerText = text.toLowerCase();
        
        // Welcome message for first interaction
        if (lowerText.includes('hi') || lowerText.includes('hello') || lowerText.includes('start')) {
            return await this.sendWelcomeMessage(from);
        }
        
        // For specific queries, use AI
        if (lowerText.includes(' to ') && (lowerText.includes('fare') || lowerText.includes('cost') || lowerText.includes('price'))) {
            return await this.sendAIResponse(from, text);
        }
        
        // For station-specific queries, use AI
        if (lowerText.includes('which stations') || lowerText.includes('stations on') || 
            lowerText.includes('list all') || lowerText.includes('all stations') || 
            lowerText.includes('complete') || lowerText.includes('detailed') ||
            lowerText.includes('how many') || lowerText.includes('what stations') ||
            lowerText.length > 20) {
            return await this.sendAIResponse(from, text);
        }
        
        // Quick responses for simple queries
        if (lowerText.includes('route') || lowerText.includes('line')) {
            return await this.sendRouteInfo(from);
        }
        
        // Only use simple station response for very basic queries
        if (lowerText.includes('station') && lowerText.length < 15) {
            return await this.sendRouteInfo(from);
        }
        
        // Only use simple fare response for general fare queries
        if ((lowerText.includes('fare') || lowerText.includes('cost') || lowerText.includes('price') || lowerText.includes('ticket')) 
            && !lowerText.includes(' to ')) {
            return await this.sendFareInfo(from);
        }
        
        if (lowerText.includes('time') || lowerText.includes('schedule') || lowerText.includes('hour')) {
            return await this.sendScheduleInfo(from);
        }
        
        if (lowerText.includes('ganesh') || lowerText.includes('festival') || lowerText.includes('ganeshotsav')) {
            return await this.sendFestivalInfo(from);
        }
        
        // Default: use AI for complex queries
        return await this.sendAIResponse(from, text);
    }

    // Handle button clicks
    async handleButtonClick(from, buttonId) {
        switch (buttonId) {
            case 'qr_0':
                return await this.sendRouteInfo(from);
            case 'qr_1':
                return await this.sendFareInfo(from);
            case 'qr_2':
                return await this.sendScheduleInfo(from);
            default:
                return await this.sendOptions(from);
        }
    }

    // Send AI-powered response
    async sendAIResponse(to, message) {
        try {
            console.log('Sending AI request for message:', message);
            const baseUrl = process.env.RAILWAY_PUBLIC_DOMAIN ? 
                `https://${process.env.RAILWAY_PUBLIC_DOMAIN}` : 
                'https://web-production-a3061.up.railway.app';
            
            const response = await axios.post(`${baseUrl}/api/whatsapp/chat`, {
                message: message,
                from: to
            }, {
                timeout: 10000 // 10 second timeout
            });
            
            console.log('AI response received:', response.data);
            
            if (response.data && response.data.response) {
                return await this.sendTextMessage(to, response.data.response);
            } else {
                console.log('No response data, falling back to simple response');
                return await this.sendSimpleResponse(to, message);
            }
        } catch (error) {
            console.error('AI response error:', error.message);
            console.log('Falling back to simple response for:', message);
            return await this.sendSimpleResponse(to, message);
        }
    }

    // Fallback simple response when AI fails
    async sendSimpleResponse(to, message) {
        const lowerText = message.toLowerCase();
        
        // Try to provide a basic response based on keywords
        if (lowerText.includes(' to ') && lowerText.includes('fare')) {
            return await this.sendTextMessage(to, `💰 *Fare Information*\n\nFor specific route fares like "${message}", please use the fare calculator or contact Pune Metro customer service.\n\n*General Fare Range:* ₹10 - ₹35\n\n*Quick Options:*\n• Short distance: ₹10-15\n• Medium distance: ₹20-25\n• Long distance: ₹30-35\n\nNeed more details? Use the buttons below!`);
        }
        
        if (lowerText.includes('route') || lowerText.includes('station')) {
            return await this.sendRouteInfo(to);
        }
        
        if (lowerText.includes('fare') || lowerText.includes('cost') || lowerText.includes('price')) {
            return await this.sendFareInfo(to);
        }
        
        if (lowerText.includes('time') || lowerText.includes('schedule')) {
            return await this.sendScheduleInfo(to);
        }
        
        // Default fallback
        return await this.sendTextMessage(to, "I understand you're asking about: " + message + "\n\nFor detailed information, please use the buttons below or try rephrasing your question.");
    }

    // Send welcome message
    async sendWelcomeMessage(to) {
        const welcomeText = `🚇 *Welcome to Pune Metro Assistant!*

I'm here to help you with all things Pune Metro. What would you like to know?

• Routes and stations
• Fares and tickets
• Schedules and timings

Just type your question or use the buttons below!`;
        
        return await this.sendQuickReplies(to, welcomeText, [
            '🚉 Routes & Stations',
            '💰 Fares & Tickets', 
            '⏰ Schedules'
        ]);
    }

    // Send route information
    async sendRouteInfo(to) {
        const routeText = `🚉 *Pune Metro Routes*

*Purple Line* (PCMC ↔ Swargate)
• 14 stations total
• Interchange at Civil Court

*Aqua Line* (Vanaz ↔ Ramwadi)  
• 15 stations total
• Interchange at Civil Court

*Key Stations:*
• PCMC (Terminal)
• Civil Court (Interchange)
• Pune Railway Station
• Swargate (Terminal)
• Vanaz (Terminal)
• Ramwadi (Terminal)

*Complete Station Lists:*

*Purple Line Stations:*
1. PCMC
2. Sant Tukaram Nagar
3. Bhosari
4. Kasarwadi
5. Phugewadi
6. Dapodi
7. Bopodi
8. Khadki
9. Shivaji Nagar
10. Civil Court (District Court)
11. Pune Railway Station
12. Budhwar Peth
13. Mandai
14. Swargate

*Aqua Line Stations:*
1. Vanaz
2. Anand Nagar
3. Ideal Colony
4. Nal Stop
5. Garware College
6. Deccan Gymkhana
7. Chhatrapati Sambhaji Udyan
8. PMC
9. Civil Court (District Court)
10. Mangalwar Peth
11. Pune Railway Station
12. Ruby Hall Clinic
13. Bund Garden
14. Yerawada
15. Ramwadi

Need specific station info? Just ask!`;
        
        return await this.sendTextMessage(to, routeText);
    }

    // Send fare information
    async sendFareInfo(to) {
        const fareText = `💰 *Pune Metro Fares*

*Fare Range:* ₹10 - ₹35

*Examples:*
• Short distance: ₹10-15
  (PCMC to Sant Tukaram Nagar: ₹10)
• Medium distance: ₹20-25
  (Vanaz to PMC: ₹20)
• Long distance: ₹30-35
  (PCMC to Swargate: ₹30)

*Special Passes:*
• Daily Pass: ₹100 (unlimited rides)
• Student Pass: 30% discount
• NCMC Card: 10-30% discount

Need specific fare? Tell me your route!`;
        
        return await this.sendTextMessage(to, fareText);
    }

    // Send schedule information
    async sendScheduleInfo(to) {
        const scheduleText = `⏰ *Pune Metro Schedule*

*Regular Hours:*
• 6:00 AM - 11:00 PM
• Both Purple & Aqua lines
• Daily service

*Special Events:*
• Extended hours during festivals
• Continuous service on special occasions

*Current Status:*
Services running normally on regular schedule.

Need festival timings? Ask about Ganeshotsav!`;
        
        return await this.sendTextMessage(to, scheduleText);
    }

    // Send festival information
    async sendFestivalInfo(to) {
        const festivalText = `🎉 *Ganeshotsav 2025 Special Schedule*

*Aug 27-31:* Regular hours (6 AM-11 PM)
*Sep 1-5:* Extended hours (6 AM-2 AM)
*Sep 6-7:* Continuous 41-hour service
*Sep 8:* Normal schedule resumes

*Special Features:*
• Extended midnight service
• Continuous operations for Anant Chaturdashi
• Enhanced frequency during peak hours

Plan your festival travel with confidence! 🚇`;
        
        return await this.sendTextMessage(to, festivalText);
    }

    // Send options menu
    async sendOptions(to) {
        const optionsText = `🤔 *How can I help you?*

Choose from these options or type your question:`;
        
        return await this.sendQuickReplies(to, optionsText, [
            '🚉 Routes & Stations',
            '💰 Fares & Tickets',
            '⏰ Schedules', 
            '🎉 Festival Info'
        ]);
    }
}

module.exports = WhatsAppBot;
