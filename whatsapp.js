const axios = require('axios');

class WhatsAppBot {
    constructor() {
        this.accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
        this.phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
        this.verifyToken = process.env.WHATSAPP_VERIFY_TOKEN;
        this.apiVersion = 'v18.0';
        this.baseUrl = `https://graph.facebook.com/${this.apiVersion}`;
        this.processedMessages = new Set(); // Track processed messages to prevent duplicates
        this.userSessions = new Map(); // Track user sessions to show welcome only once per day
        this.recentMessages = new Map(); // Track recent messages with timestamps
        this.conversationContext = new Map(); // Track conversation context for each user
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
        
        // Create a unique message ID for deduplication using content hash
        const crypto = require('crypto');
        const contentHash = crypto.createHash('md5').update(JSON.stringify({from, type, text})).digest('hex');
        const messageId = `${from}_${type}_${contentHash}`;
        
        // Check if we've already processed this message
        if (this.processedMessages.has(messageId)) {
            console.log('Duplicate message detected, skipping:', messageId);
            return null;
        }
        
        // Check for recent duplicate messages (within 5 seconds)
        const now = Date.now();
        const recentKey = `${from}_${type}_${contentHash}`;
        if (this.recentMessages.has(recentKey)) {
            const lastTime = this.recentMessages.get(recentKey);
            if (now - lastTime < 5000) { // 5 seconds
                console.log('Recent duplicate message detected, skipping:', recentKey);
                return null;
            }
        }
        
        // Add to processed messages (keep only last 100 to prevent memory issues)
        this.processedMessages.add(messageId);
        this.recentMessages.set(recentKey, now);
        console.log('Processing new message:', messageId);
        // Clean up old processed messages
        if (this.processedMessages.size > 100) {
            const firstMessage = this.processedMessages.values().next().value;
            this.processedMessages.delete(firstMessage);
        }
        
        // Clean up old recent messages (older than 30 seconds)
        for (const [key, timestamp] of this.recentMessages.entries()) {
            if (now - timestamp > 30000) {
                this.recentMessages.delete(key);
            }
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

    // Check if message is a genuine greeting (not a query with greeting words)
    isGenuineGreeting(lowerText) {
        // Only show welcome for very short, simple greetings
        const simpleGreetings = [
            'hi', 'hello', 'hey', 'start', 'begin', 'help', 'menu', 'options'
        ];
        
        // Check if it's just a simple greeting (1-2 words)
        const words = lowerText.trim().split(/\s+/);
        
        // If it's just 1-2 words and contains a greeting
        if (words.length <= 2) {
            return simpleGreetings.some(greeting => lowerText.includes(greeting));
        }
        
        // If it's longer, only show welcome if it's clearly a greeting without any metro-related keywords
        const metroKeywords = [
            'metro', 'route', 'station', 'fare', 'ticket', 'line', 'time', 'schedule',
            'pune', 'pcmc', 'swargate', 'vanaz', 'ramwadi', 'civil court'
        ];
        
        const hasMetroKeywords = metroKeywords.some(keyword => lowerText.includes(keyword));
        
        // Only show welcome if it's a greeting AND doesn't contain metro keywords
        if (hasMetroKeywords) {
            return false;
        }
        
        // Check if it starts with a greeting
        return simpleGreetings.some(greeting => lowerText.startsWith(greeting));
    }

    // Check if we should show welcome message (only once per day per user)
    shouldShowWelcome(from) {
        const today = new Date().toDateString();
        const lastWelcomeDate = this.userSessions.get(from);
        
        // Show welcome if it's a new day or first time user
        if (!lastWelcomeDate || lastWelcomeDate !== today) {
            this.userSessions.set(from, today);
            
            // Clean up old sessions (keep only last 30 days worth)
            if (this.userSessions.size > 1000) {
                const entries = Array.from(this.userSessions.entries());
                const cutoffDate = new Date();
                cutoffDate.setDate(cutoffDate.getDate() - 30);
                const cutoffString = cutoffDate.toDateString();
                
                for (const [userId, date] of entries) {
                    if (date < cutoffString) {
                        this.userSessions.delete(userId);
                    }
                }
            }
            
            return true;
        }
        
        return false;
    }

    // Update conversation context for a user
    updateConversationContext(from, message, responseType) {
        if (!this.conversationContext.has(from)) {
            this.conversationContext.set(from, []);
        }
        
        const context = this.conversationContext.get(from);
        context.push({
            message: message,
            responseType: responseType,
            timestamp: Date.now()
        });
        
        // Keep only last 5 interactions to maintain context
        if (context.length > 5) {
            context.shift();
        }
        
        // Clean up old contexts (older than 1 hour)
        const oneHourAgo = Date.now() - (60 * 60 * 1000);
        for (const [userId, userContext] of this.conversationContext.entries()) {
            const recentContext = userContext.filter(item => item.timestamp > oneHourAgo);
            if (recentContext.length === 0) {
                this.conversationContext.delete(userId);
            } else {
                this.conversationContext.set(userId, recentContext);
            }
        }
    }

    // Get conversation context for a user
    getConversationContext(from) {
        const context = this.conversationContext.get(from) || [];
        return context.slice(-3); // Return last 3 interactions
    }

    // Handle text messages
    async handleTextMessage(from, text) {
        if (!text) {
            console.log('No text provided to handleTextMessage');
            return null;
        }
        
        const lowerText = text.toLowerCase();
        
        // Welcome message only for genuine greetings or first-time interactions
        if (this.isGenuineGreeting(lowerText) && this.shouldShowWelcome(from)) {
            this.updateConversationContext(from, text, 'welcome');
            return await this.sendWelcomeMessage(from);
        }
        
        // For specific queries, use AI
        if (lowerText.includes(' to ') && (lowerText.includes('fare') || lowerText.includes('cost') || lowerText.includes('price'))) {
            this.updateConversationContext(from, text, 'fare_query');
            return await this.sendAIResponse(from, text);
        }
        
        // For station-specific queries, use AI
        if (lowerText.includes('which stations') || lowerText.includes('stations on') || 
            lowerText.includes('list all') || lowerText.includes('all stations') || 
            lowerText.includes('complete') || lowerText.includes('detailed') ||
            lowerText.includes('how many') || lowerText.includes('what stations') ||
            lowerText.length > 20) {
            this.updateConversationContext(from, text, 'station_query');
            return await this.sendAIResponse(from, text);
        }
        
        // Quick responses for simple queries
        if (lowerText.includes('route') || lowerText.includes('line')) {
            this.updateConversationContext(from, text, 'route_info');
            return await this.sendRouteInfo(from);
        }
        
        // Only use simple station response for very basic queries
        if (lowerText.includes('station') && lowerText.length < 15) {
            this.updateConversationContext(from, text, 'station_info');
            return await this.sendRouteInfo(from);
        }
        
        // Only use simple fare response for general fare queries
        if ((lowerText.includes('fare') || lowerText.includes('cost') || lowerText.includes('price') || lowerText.includes('ticket')) 
            && !lowerText.includes(' to ')) {
            this.updateConversationContext(from, text, 'fare_info');
            return await this.sendFareInfo(from);
        }
        
        if (lowerText.includes('time') || lowerText.includes('schedule') || lowerText.includes('hour')) {
            this.updateConversationContext(from, text, 'schedule_info');
            return await this.sendScheduleInfo(from);
        }
        
        if (lowerText.includes('ganesh') || lowerText.includes('festival') || lowerText.includes('ganeshotsav')) {
            this.updateConversationContext(from, text, 'festival_info');
            return await this.sendFestivalInfo(from);
        }
        
        // Default: use AI for complex queries
        this.updateConversationContext(from, text, 'ai_response');
        return await this.sendAIResponse(from, text);
    }

    // Handle button clicks
    async handleButtonClick(from, buttonId) {
        const context = this.getConversationContext(from);
        console.log('Button click context:', context);
        
        switch (buttonId) {
            case 'qr_0':
                this.updateConversationContext(from, 'Routes & Stations button', 'button_route');
                return await this.sendContextualRouteInfo(from, context);
            case 'qr_1':
                this.updateConversationContext(from, 'Fares & Tickets button', 'button_fare');
                return await this.sendContextualFareInfo(from, context);
            case 'qr_2':
                this.updateConversationContext(from, 'Schedules button', 'button_schedule');
                return await this.sendContextualScheduleInfo(from, context);
            default:
                return await this.sendOptions(from);
        }
    }

    // Send contextual route info based on conversation history
    async sendContextualRouteInfo(from, context) {
        const recentQuery = context.find(item => 
            item.responseType === 'station_query' || 
            item.responseType === 'fare_query' ||
            item.message.toLowerCase().includes('station') ||
            item.message.toLowerCase().includes('route')
        );
        
        if (recentQuery) {
            // If user was asking about specific stations, provide targeted info
            const message = `Based on your recent query about "${recentQuery.message}", here's the route information:\n\n`;
            const routeInfo = await this.getRouteInfoText();
            return await this.sendTextMessage(from, message + routeInfo);
        } else {
            // Default route info
            return await this.sendRouteInfo(from);
        }
    }

    // Send contextual fare info based on conversation history
    async sendContextualFareInfo(from, context) {
        const recentQuery = context.find(item => 
            item.responseType === 'fare_query' ||
            item.message.toLowerCase().includes('fare') ||
            item.message.toLowerCase().includes('cost') ||
            item.message.toLowerCase().includes('price')
        );
        
        if (recentQuery) {
            // If user was asking about specific fares, provide targeted info
            const message = `Based on your recent query about "${recentQuery.message}", here's the fare information:\n\n`;
            const fareInfo = await this.getFareInfoText();
            return await this.sendTextMessage(from, message + fareInfo);
        } else {
            // Default fare info
            return await this.sendFareInfo(from);
        }
    }

    // Send contextual schedule info based on conversation history
    async sendContextualScheduleInfo(from, context) {
        const recentQuery = context.find(item => 
            item.responseType === 'schedule_info' ||
            item.message.toLowerCase().includes('time') ||
            item.message.toLowerCase().includes('schedule') ||
            item.message.toLowerCase().includes('hour')
        );
        
        if (recentQuery) {
            // If user was asking about specific schedules, provide targeted info
            const message = `Based on your recent query about "${recentQuery.message}", here's the schedule information:\n\n`;
            const scheduleInfo = await this.getScheduleInfoText();
            return await this.sendTextMessage(from, message + scheduleInfo);
        } else {
            // Default schedule info
            return await this.sendScheduleInfo(from);
        }
    }

    // Get route info text (helper function)
    async getRouteInfoText() {
        return `🚇 **Pune Metro Routes:**

**Purple Line (PCMC-Swargate):**
1. PCMC → 2. Sant Tukaram Nagar → 3. Bhosari → 4. Kasarwadi → 5. Phugewadi → 6. Dapodi → 7. Bopodi → 8. Khadki → 9. Shivaji Nagar → 10. Civil Court (District Court) → 11. Pune Railway Station → 12. Budhwar Peth → 13. Mandai → 14. Swargate

**Aqua Line (Vanaz-Ramwadi):**
1. Vanaz → 2. Anand Nagar → 3. Ideal Colony → 4. Nal Stop → 5. Garware College → 6. Deccan Gymkhana → 7. Chhatrapati Sambhaji Udyan → 8. PMC → 9. Civil Court (District Court) → 10. Mangalwar Peth → 11. Pune Railway Station → 12. Budhwar Peth → 13. Mandai → 14. Swargate → 15. Ramwadi

**Interchange:** Civil Court (District Court) connects both lines

Need specific station details or fare information? Just ask! 😊`;
    }

    // Get fare info text (helper function)
    async getFareInfoText() {
        return `💰 **Pune Metro Fare Structure:**

**Fare Range:** ₹10 - ₹35

**Distance-based Fares:**
• Short distance (1-3 stations): ₹10-15
• Medium distance (4-7 stations): ₹20-25
• Long distance (8+ stations): ₹30-35

**Popular Routes:**
• PCMC to Swargate: ₹35
• Vanaz to Ramwadi: ₹35
• Civil Court to any station: ₹10-25

**Ticket Types:**
• Single Journey Ticket
• Return Ticket
• Smart Card (with discounts)

Need fare for specific stations? Just ask! 😊`;
    }

    // Get schedule info text (helper function)
    async getScheduleInfoText() {
        return `⏰ **Pune Metro Operating Hours:**

**Regular Days:**
• First Train: 06:00 AM
• Last Train: 11:00 PM
• Frequency: Every 5-10 minutes

**Peak Hours (7-10 AM, 6-9 PM):**
• Frequency: Every 5 minutes

**Off-Peak Hours:**
• Frequency: Every 8-10 minutes

**Special Events:**
• Ganeshotsav: Extended hours (06:00 AM - 12:00 AM)
• Festivals: Check announcements

**Station Operating Hours:**
• All stations open: 05:45 AM - 11:15 PM

**Next Train Timing:**
• Peak hours: Every 5 minutes
• Off-peak: Every 8-10 minutes
• First train: 06:00 AM, Last train: 11:00 PM

Need specific timing for your route? Just ask! 😊`;
    }

    // Calculate fare between two stations
    calculateFare(fromStation, toStation) {
        const purpleLine = ['PCMC', 'Sant Tukaram Nagar', 'Bhosari', 'Kasarwadi', 'Phugewadi', 'Dapodi', 'Bopodi', 'Khadki', 'Shivaji Nagar', 'Civil Court (District Court)', 'Pune Railway Station', 'Budhwar Peth', 'Mandai', 'Swargate'];
        const aquaLine = ['Vanaz', 'Anand Nagar', 'Ideal Colony', 'Nal Stop', 'Garware College', 'Deccan Gymkhana', 'Chhatrapati Sambhaji Udyan', 'PMC', 'Civil Court (District Court)', 'Mangalwar Peth', 'Pune Railway Station', 'Budhwar Peth', 'Mandai', 'Swargate', 'Ramwadi'];
        
        const fromIndexPurple = purpleLine.findIndex(station => station.toLowerCase().includes(fromStation.toLowerCase()));
        const toIndexPurple = purpleLine.findIndex(station => station.toLowerCase().includes(toStation.toLowerCase()));
        const fromIndexAqua = aquaLine.findIndex(station => station.toLowerCase().includes(fromStation.toLowerCase()));
        const toIndexAqua = aquaLine.findIndex(station => station.toLowerCase().includes(toStation.toLowerCase()));
        
        // Same line calculation
        if (fromIndexPurple !== -1 && toIndexPurple !== -1) {
            const stations = Math.abs(toIndexPurple - fromIndexPurple);
            return this.getFareByStations(stations, false);
        }
        
        if (fromIndexAqua !== -1 && toIndexAqua !== -1) {
            const stations = Math.abs(toIndexAqua - fromIndexAqua);
            return this.getFareByStations(stations, false);
        }
        
        // Transfer calculation (different lines)
        if ((fromIndexPurple !== -1 && toIndexAqua !== -1) || (fromIndexAqua !== -1 && toIndexPurple !== -1)) {
            const stations1 = fromIndexPurple !== -1 ? Math.abs(purpleLine.indexOf('Civil Court (District Court)') - fromIndexPurple) : Math.abs(aquaLine.indexOf('Civil Court (District Court)') - fromIndexAqua);
            const stations2 = toIndexPurple !== -1 ? Math.abs(purpleLine.indexOf('Civil Court (District Court)') - toIndexPurple) : Math.abs(aquaLine.indexOf('Civil Court (District Court)') - toIndexAqua);
            const totalStations = stations1 + stations2;
            return this.getFareByStations(totalStations, true);
        }
        
        return null; // Station not found
    }

    // Get fare based on number of stations
    getFareByStations(stations, isTransfer) {
        let baseFare;
        if (stations <= 3) baseFare = 15;
        else if (stations <= 7) baseFare = 25;
        else baseFare = 35;
        
        return isTransfer ? baseFare + 5 : baseFare;
    }

    // Calculate travel duration
    calculateDuration(fromStation, toStation) {
        const purpleLine = ['PCMC', 'Sant Tukaram Nagar', 'Bhosari', 'Kasarwadi', 'Phugewadi', 'Dapodi', 'Bopodi', 'Khadki', 'Shivaji Nagar', 'Civil Court (District Court)', 'Pune Railway Station', 'Budhwar Peth', 'Mandai', 'Swargate'];
        const aquaLine = ['Vanaz', 'Anand Nagar', 'Ideal Colony', 'Nal Stop', 'Garware College', 'Deccan Gymkhana', 'Chhatrapati Sambhaji Udyan', 'PMC', 'Civil Court (District Court)', 'Mangalwar Peth', 'Pune Railway Station', 'Budhwar Peth', 'Mandai', 'Swargate', 'Ramwadi'];
        
        const fromIndexPurple = purpleLine.findIndex(station => station.toLowerCase().includes(fromStation.toLowerCase()));
        const toIndexPurple = purpleLine.findIndex(station => station.toLowerCase().includes(toStation.toLowerCase()));
        const fromIndexAqua = aquaLine.findIndex(station => station.toLowerCase().includes(fromStation.toLowerCase()));
        const toIndexAqua = aquaLine.findIndex(station => station.toLowerCase().includes(toStation.toLowerCase()));
        
        // Same line calculation
        if (fromIndexPurple !== -1 && toIndexPurple !== -1) {
            const stations = Math.abs(toIndexPurple - fromIndexPurple);
            return stations * 2.5; // 2.5 minutes per station
        }
        
        if (fromIndexAqua !== -1 && toIndexAqua !== -1) {
            const stations = Math.abs(toIndexAqua - fromIndexAqua);
            return stations * 2.5;
        }
        
        // Transfer calculation
        if ((fromIndexPurple !== -1 && toIndexAqua !== -1) || (fromIndexAqua !== -1 && toIndexPurple !== -1)) {
            const stations1 = fromIndexPurple !== -1 ? Math.abs(purpleLine.indexOf('Civil Court (District Court)') - fromIndexPurple) : Math.abs(aquaLine.indexOf('Civil Court (District Court)') - fromIndexAqua);
            const stations2 = toIndexPurple !== -1 ? Math.abs(purpleLine.indexOf('Civil Court (District Court)') - toIndexPurple) : Math.abs(aquaLine.indexOf('Civil Court (District Court)') - toIndexAqua);
            const totalStations = stations1 + stations2;
            return (totalStations * 2.5) + 7; // Add 7 minutes for interchange
        }
        
        return null;
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
