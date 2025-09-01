const axios = require('axios');

class WhatsAppBot {
    constructor() {
        this.accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
        this.phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
        this.verifyToken = process.env.WHATSAPP_VERIFY_TOKEN;
        this.apiVersion = 'v18.0';
        this.baseUrl = `https://graph.facebook.com/${this.apiVersion}`;
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
            console.error('WhatsApp send error:', error.response?.data || error.message);
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
        const { from, text, type } = messageData;
        
        if (type === 'text' && text) {
            // Process text message
            return await this.handleTextMessage(from, text.body);
        } else if (type === 'interactive' && text.interactive?.type === 'button_reply') {
            // Process button clicks
            return await this.handleButtonClick(from, text.interactive.button_reply.id);
        }
        
        return null;
    }

    // Handle text messages
    async handleTextMessage(from, text) {
        const lowerText = text.toLowerCase();
        
        // Welcome message for first interaction
        if (lowerText.includes('hi') || lowerText.includes('hello') || lowerText.includes('start')) {
            return await this.sendWelcomeMessage(from);
        }
        
        // Route information
        if (lowerText.includes('route') || lowerText.includes('line') || lowerText.includes('station')) {
            return await this.sendRouteInfo(from);
        }
        
        // Fare information
        if (lowerText.includes('fare') || lowerText.includes('cost') || lowerText.includes('price') || lowerText.includes('ticket')) {
            return await this.sendFareInfo(from);
        }
        
        // Schedule information
        if (lowerText.includes('time') || lowerText.includes('schedule') || lowerText.includes('hour')) {
            return await this.sendScheduleInfo(from);
        }
        
        // Festival information
        if (lowerText.includes('ganesh') || lowerText.includes('festival') || lowerText.includes('ganeshotsav')) {
            return await this.sendFestivalInfo(from);
        }
        
        // Default: send options
        return await this.sendOptions(from);
    }

    // Handle button clicks
    async handleButtonClick(from, buttonId) {
        switch (buttonId) {
            case 'btn_0':
                return await this.sendRouteInfo(from);
            case 'btn_1':
                return await this.sendFareInfo(from);
            case 'btn_2':
                return await this.sendScheduleInfo(from);
            case 'btn_3':
                return await this.sendFestivalInfo(from);
            default:
                return await this.sendOptions(from);
        }
    }

    // Send welcome message
    async sendWelcomeMessage(to) {
        const welcomeText = `🚇 *Welcome to Pune Metro Assistant!*

I'm here to help you with all things Pune Metro. What would you like to know?

• Routes and stations
• Fares and tickets
• Schedules and timings
• Festival special services

Just type your question or use the buttons below!`;
        
        return await this.sendQuickReplies(to, welcomeText, [
            '🚉 Routes & Stations',
            '💰 Fares & Tickets', 
            '⏰ Schedules',
            '🎉 Festival Info'
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
