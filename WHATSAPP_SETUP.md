# WhatsApp Chatbot Setup Guide

## 🚀 **Complete Setup Process**

### **Step 1: Facebook Developer Account Setup**

1. **Create Facebook Developer Account**
   - Go to [developers.facebook.com](https://developers.facebook.com)
   - Sign up for a developer account
   - Verify your email and phone number

2. **Create WhatsApp Business App**
   - Click "Create App"
   - Select "Business" category
   - Choose "WhatsApp" product
   - Name your app: "Pune Metro Assistant"

### **Step 2: WhatsApp Business API Setup**

1. **Get Access Token**
   - In your app dashboard, go to "WhatsApp" → "Getting Started"
   - Copy your **Access Token** (starts with `EAA...`)

2. **Get Phone Number ID**
   - Go to "WhatsApp" → "Phone Numbers"
   - Add a phone number (you'll need a business phone number)
   - Copy the **Phone Number ID** (numeric value)

3. **Set Webhook URL**
   - Go to "WhatsApp" → "Configuration"
   - Set Webhook URL: `https://your-vercel-domain.vercel.app/webhook`
   - Set Verify Token: `pune_metro_verify_token_2025`
   - Subscribe to: `messages`, `message_deliveries`

### **Step 3: Vercel Deployment**

1. **Install Vercel CLI**
   ```bash
   npm install -g vercel
   ```

2. **Deploy to Vercel**
   ```bash
   vercel
   ```

3. **Set Environment Variables in Vercel**
   - Go to your Vercel dashboard
   - Navigate to your project → Settings → Environment Variables
   - Add these variables:
     ```
     OPENAI_API_KEY=your_openai_key
     WHATSAPP_ACCESS_TOKEN=your_whatsapp_token
     WHATSAPP_PHONE_NUMBER_ID=your_phone_number_id
     WHATSAPP_VERIFY_TOKEN=pune_metro_verify_token_2025
     ```

### **Step 4: Test Your WhatsApp Bot**

1. **Send Test Message**
   - Open WhatsApp
   - Send "Hi" to your business number
   - You should receive the welcome message

2. **Test Features**
   - Try: "What are the routes?"
   - Try: "How much is the fare?"
   - Try: "What are the timings?"

## 🔧 **Configuration Details**

### **Environment Variables**

```env
# OpenAI Configuration
OPENAI_API_KEY=your_openai_api_key_here

# WhatsApp Configuration
WHATSAPP_ACCESS_TOKEN=EAA...your_token_here
WHATSAPP_PHONE_NUMBER_ID=123456789
WHATSAPP_VERIFY_TOKEN=pune_metro_verify_token_2025

# Server Configuration
PORT=3000
NODE_ENV=production
```

### **Webhook Endpoints**

- **GET /webhook**: Verification endpoint for WhatsApp
- **POST /webhook**: Receives incoming messages
- **POST /api/whatsapp/chat**: AI-powered responses

## 📱 **WhatsApp Bot Features**

### **Interactive Buttons**
- 🚉 Routes & Stations
- 💰 Fares & Tickets
- ⏰ Schedules
- 🎉 Festival Info

### **Text Commands**
- "Hi" / "Hello" → Welcome message
- "routes" → Route information
- "fare" / "cost" → Fare details
- "schedule" / "time" → Timings
- "ganesh" / "festival" → Festival info

### **AI-Powered Responses**
- Complex queries handled by OpenAI
- Context-aware responses
- Real-time information updates

## 🚀 **Deployment Commands**

### **Local Development**
```bash
npm install
npm start
```

### **Vercel Deployment**
```bash
vercel --prod
```

### **Environment Setup**
```bash
# Copy environment variables
cp config.env .env.local

# Deploy with environment variables
vercel --env-file .env.local
```

## 🔍 **Troubleshooting**

### **Common Issues**

1. **Webhook Verification Failed**
   - Check verify token matches
   - Ensure webhook URL is accessible
   - Verify HTTPS is enabled

2. **Messages Not Received**
   - Check phone number is verified
   - Ensure webhook is subscribed to events
   - Verify access token is valid

3. **Vercel Deployment Issues**
   - Check environment variables are set
   - Verify `vercel.json` configuration
   - Check build logs for errors

### **Testing Commands**

```bash
# Test webhook locally
curl -X GET "http://localhost:3000/webhook?hub.mode=subscribe&hub.verify_token=pune_metro_verify_token_2025&hub.challenge=test"

# Test WhatsApp API
curl -X POST "https://graph.facebook.com/v18.0/your_phone_number_id/messages" \
  -H "Authorization: Bearer your_access_token" \
  -H "Content-Type: application/json" \
  -d '{"messaging_product":"whatsapp","to":"your_number","type":"text","text":{"body":"Test message"}}'
```

## 📊 **Monitoring & Analytics**

### **WhatsApp Business Dashboard**
- Message delivery status
- User engagement metrics
- Response times

### **Vercel Analytics**
- Request volume
- Response times
- Error rates

### **Custom Logging**
- Message processing logs
- AI response generation
- Error tracking

## 🔐 **Security Considerations**

1. **Access Token Security**
   - Never commit tokens to git
   - Use environment variables
   - Rotate tokens regularly

2. **Webhook Security**
   - Verify webhook signatures
   - Use HTTPS only
   - Implement rate limiting

3. **Data Privacy**
   - Don't store personal messages
   - Implement data retention policies
   - Follow WhatsApp privacy guidelines

## 📈 **Scaling Considerations**

### **High Volume**
- Implement message queuing
- Use Redis for caching
- Add load balancing

### **Geographic Distribution**
- Deploy to multiple regions
- Use CDN for static assets
- Implement regional routing

### **Cost Optimization**
- Monitor API usage
- Implement caching strategies
- Use appropriate instance sizes

## 🎯 **Next Steps**

1. **Launch Beta Testing**
   - Test with small group
   - Gather feedback
   - Iterate on responses

2. **Add Advanced Features**
   - Multi-language support
   - Voice messages
   - File sharing
   - Payment integration

3. **Analytics & Insights**
   - User behavior tracking
   - Popular queries analysis
   - Performance optimization

---

**Need Help?** Check the troubleshooting section or contact support!
