# Pune Metro Chatbot

A modern, AI-powered chatbot for Pune Metro with an intuitive admin interface for knowledge management.

## Features

### 🤖 Chatbot Interface
- **Clean ChatGPT-like design** with Pune Metro branding
- **Voice input support** for hands-free interaction
- **Real-time responses** powered by OpenAI GPT-3.5
- **Comprehensive knowledge base** covering:
  - Route information and station details
  - Fare charts and ticketing options
  - Service hours and timetables
  - Accessibility features and policies
  - Student discounts and passes

### 🛠️ Admin Interface
- **Natural Language Management**: Describe changes in plain English
- **FAQ Management**: Add, edit, and delete frequently asked questions
- **Knowledge Base Editor**: Direct JSON editing with syntax validation
- **Station Synonyms**: Manage alternative names for stations
- **Real-time Updates**: Changes reflect immediately in the chatbot

## Quick Start

### Prerequisites
- Node.js (v14 or higher)
- npm or yarn
- OpenAI API key

### Installation

1. **Clone or download the project files**

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment variables**
   ```bash
   # Edit config.env file
   OPENAI_API_KEY=your_openai_api_key_here
   PORT=3000
   NODE_ENV=development
   ```

4. **Start the server**
   ```bash
   npm start
   ```

5. **Access the application**
   - Chatbot: http://localhost:3000
   - Admin Panel: http://localhost:3000/admin

## Usage

### Chatbot Interface
1. Visit the main page to access the chatbot
2. Type your question about Pune Metro services
3. Use voice input by clicking the microphone icon
4. Get instant, accurate responses based on the knowledge base

### Admin Interface
1. Navigate to `/admin` to access the management panel
2. Use the **Natural Language Management** section to:
   - Add new FAQs: "Add a new FAQ: 'What are the peak hours?' Answer: 'Peak hours are 8-10 AM and 6-8 PM'"
   - Update information: "Update fare from PCMC to Swargate to ₹35"
   - Add synonyms: "Add station synonym: 'Civil Court' can also be called 'CVC'"
   - Delete content: "Delete FAQ about old timetable"

3. Use the **Tabbed Interface** for:
   - **FAQ Management**: Visual editor for questions and answers
   - **Knowledge Base**: Direct JSON editing
   - **Station Synonyms**: Manage station name variations

## Knowledge Base Structure

The system uses three main data sources:

### `faq_qa.jsonl`
```json
{"q": "Question text", "a": "Answer text", "tags": ["tag1", "tag2"], "evidence": ["source1", "source2"]}
```

### `pune_metro_knowledge.json`
Comprehensive knowledge base with:
- Network information (lines, stations, interchanges)
- Fares and ticketing
- Service hours
- Accessibility features
- Contact information

### `station_synonyms.json`
```json
{
  "Station Name": ["Synonym1", "Synonym2", "Abbreviation"]
}
```

## API Endpoints

### Chatbot
- `POST /api/chat` - Process user messages

### Admin
- `GET /api/admin/data` - Retrieve current knowledge base
- `POST /api/admin/update` - Update knowledge base
- `POST /api/admin/process-nl` - Natural language processing

## Customization

### Styling
- Modify `public/styles.css` for chatbot appearance
- Modify `public/admin.css` for admin interface styling
- Uses Tailwind CSS for responsive design

### Knowledge Base
- Edit JSON files directly or use the admin interface
- Natural language processing supports complex requests
- All changes are immediately reflected in the chatbot

### Branding
- Purple color scheme matches Pune Metro branding
- Custom icons and visual elements
- Responsive design for mobile and desktop

## Development

### Project Structure
```
PuneMetro/
├── server.js              # Main Express server
├── package.json           # Dependencies and scripts
├── config.env             # Environment variables
├── public/                # Frontend files
│   ├── index.html         # Chatbot interface
│   ├── admin.html         # Admin interface
│   ├── chatbot.js         # Chatbot functionality
│   ├── admin.js           # Admin functionality
│   ├── styles.css         # Chatbot styles
│   └── admin.css          # Admin styles
├── faq_qa.jsonl           # FAQ data
├── pune_metro_knowledge.json  # Main knowledge base
└── station_synonyms.json  # Station synonyms
```

### Adding New Features
1. **New API endpoints**: Add to `server.js`
2. **Frontend changes**: Modify HTML/JS files in `public/`
3. **Styling updates**: Edit CSS files
4. **Knowledge updates**: Use admin interface or edit JSON files

## Troubleshooting

### Common Issues
1. **OpenAI API errors**: Check your API key in `config.env`
2. **Port conflicts**: Change PORT in `config.env`
3. **JSON syntax errors**: Use admin interface for safe editing
4. **Voice input not working**: Check browser permissions

### Debug Mode
```bash
NODE_ENV=development npm start
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

MIT License - see LICENSE file for details

## Support

For issues or questions:
- Check the troubleshooting section
- Review the knowledge base structure
- Test with the admin interface

---

Built with ❤️ for Pune Metro commuters
