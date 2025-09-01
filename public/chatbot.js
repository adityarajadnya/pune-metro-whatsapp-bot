class PuneMetroChatbot {
    constructor() {
        this.chatMessages = document.getElementById('chat-messages');
        this.chatForm = document.getElementById('chat-form');
        this.messageInput = document.getElementById('message-input');
        this.sendBtn = document.getElementById('send-btn');
        this.voiceBtn = document.getElementById('voice-btn');
        
        this.isLoading = false;
        this.init();
    }

    init() {
        this.chatForm.addEventListener('submit', (e) => this.handleSubmit(e));
        this.messageInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.handleSubmit(e);
            }
        });
        
        this.voiceBtn.addEventListener('click', () => this.toggleVoiceInput());
        
        // Auto-focus input
        this.messageInput.focus();
    }

    async handleSubmit(e) {
        e.preventDefault();
        
        const message = this.messageInput.value.trim();
        if (!message || this.isLoading) return;

        // Add user message
        this.addMessage(message, 'user');
        this.messageInput.value = '';
        
        // Show loading
        this.setLoading(true);
        
        try {
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ message })
            });

            const data = await response.json();
            
            if (data.error) {
                throw new Error(data.error);
            }

            // Add bot response
            this.addMessage(data.response, 'bot');
            
        } catch (error) {
            console.error('Chat error:', error);
            this.addMessage('Sorry, I encountered an error. Please try again.', 'bot', true);
        } finally {
            this.setLoading(false);
        }
    }

    addMessage(content, sender, isError = false) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `flex ${sender === 'user' ? 'justify-end' : 'justify-start'}`;
        
        const messageBubble = document.createElement('div');
        messageBubble.className = `max-w-xs lg:max-w-md px-4 py-3 rounded-lg ${
            sender === 'user' 
                ? 'bg-purple-600 text-white' 
                : isError 
                    ? 'bg-red-100 text-red-800 border border-red-200'
                    : 'bg-white text-gray-800 border border-gray-200'
        }`;
        
        if (sender === 'bot') {
            const icon = document.createElement('div');
            icon.className = 'flex items-center space-x-2 mb-2';
            icon.innerHTML = `
                <div class="w-6 h-6 bg-purple-100 rounded-full flex items-center justify-center">
                    <i class="fas fa-robot text-purple-600 text-xs"></i>
                </div>
                <span class="text-sm font-medium text-gray-600">Pune Metro Assistant</span>
            `;
            messageBubble.appendChild(icon);
        }
        
        const textDiv = document.createElement('div');
        textDiv.className = 'whitespace-pre-wrap';
        textDiv.textContent = content;
        messageBubble.appendChild(textDiv);
        
        messageDiv.appendChild(messageBubble);
        this.chatMessages.appendChild(messageDiv);
        
        // Scroll to bottom
        this.scrollToBottom();
    }

    setLoading(loading) {
        this.isLoading = loading;
        this.sendBtn.disabled = loading;
        
        if (loading) {
            this.sendBtn.innerHTML = `
                <div class="flex items-center space-x-2">
                    <div class="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    <span>Thinking...</span>
                </div>
            `;
        } else {
            this.sendBtn.innerHTML = `
                <span>Send</span>
                <i class="fas fa-paper-plane"></i>
            `;
        }
    }

    scrollToBottom() {
        this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
    }

    toggleVoiceInput() {
        if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
            const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
            const recognition = new SpeechRecognition();
            
            recognition.lang = 'en-US';
            recognition.continuous = false;
            recognition.interimResults = false;
            
            recognition.onstart = () => {
                this.voiceBtn.innerHTML = '<i class="fas fa-stop"></i>';
                this.voiceBtn.classList.add('text-red-600');
            };
            
            recognition.onresult = (event) => {
                const transcript = event.results[0][0].transcript;
                this.messageInput.value = transcript;
            };
            
            recognition.onend = () => {
                this.voiceBtn.innerHTML = '<i class="fas fa-microphone"></i>';
                this.voiceBtn.classList.remove('text-red-600');
            };
            
            recognition.start();
        } else {
            alert('Speech recognition is not supported in your browser.');
        }
    }
}

// Initialize chatbot when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new PuneMetroChatbot();
});
