class PuneMetroAdmin {
    constructor() {
        this.currentData = {
            faq: [],
            knowledge: {},
            synonyms: {}
        };
        
        this.init();
    }

    async init() {
        await this.loadData();
        this.setupEventListeners();
        this.renderData();
    }

    async loadData() {
        try {
            const response = await fetch('/api/admin/data');
            this.currentData = await response.json();
        } catch (error) {
            console.error('Error loading data:', error);
            this.showNotification('Error loading data', 'error');
        }
    }

    setupEventListeners() {
        // Tab navigation
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.switchTab(e.target.dataset.tab));
        });

        // Natural language processing
        document.getElementById('process-nl-btn').addEventListener('click', () => this.processNaturalLanguage());
        document.getElementById('clear-nl-btn').addEventListener('click', () => this.clearNaturalLanguage());

        // FAQ management
        document.getElementById('add-faq-btn').addEventListener('click', () => this.openFaqModal());
        document.getElementById('faq-form').addEventListener('submit', (e) => this.handleFaqSubmit(e));

        // Knowledge base management
        document.getElementById('save-knowledge-btn').addEventListener('click', () => this.saveKnowledgeBase());

        // Synonyms management
        document.getElementById('add-synonym-btn').addEventListener('click', () => this.openSynonymModal());
        document.getElementById('synonym-form').addEventListener('submit', (e) => this.handleSynonymSubmit(e));
    }

    switchTab(tabName) {
        // Update tab buttons
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.remove('active', 'border-purple-500', 'text-purple-600');
            btn.classList.add('border-transparent', 'text-gray-500');
        });
        
        document.querySelector(`[data-tab="${tabName}"]`).classList.add('active', 'border-purple-500', 'text-purple-600');
        document.querySelector(`[data-tab="${tabName}"]`).classList.remove('border-transparent', 'text-gray-500');

        // Update tab content
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.add('hidden');
            content.classList.remove('active');
        });
        
        document.getElementById(`${tabName}-tab`).classList.remove('hidden');
        document.getElementById(`${tabName}-tab`).classList.add('active');

        // Load specific data for tab
        if (tabName === 'knowledge') {
            document.getElementById('knowledge-editor').value = JSON.stringify(this.currentData.knowledge, null, 2);
        }
    }

    async processNaturalLanguage() {
        const input = document.getElementById('nl-input').value.trim();
        if (!input) {
            this.showNotification('Please enter a request', 'warning');
            return;
        }

        const processBtn = document.getElementById('process-nl-btn');
        const originalText = processBtn.innerHTML;
        processBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';
        processBtn.disabled = true;

        try {
            const response = await fetch('/api/admin/process-nl', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ 
                    request: input,
                    currentData: this.currentData
                })
            });

            const result = await response.json();
            
            if (result.error) {
                throw new Error(result.error);
            }

            // Show AI analysis
            document.getElementById('nl-analysis').innerHTML = result.analysis;
            document.getElementById('nl-result').classList.remove('hidden');

            // Apply changes if confirmed
            if (result.changes) {
                const confirmed = confirm('Do you want to apply these changes?');
                if (confirmed) {
                    await this.applyChanges(result.changes);
                    this.showNotification('Changes applied successfully', 'success');
                }
            }

        } catch (error) {
            console.error('NL processing error:', error);
            this.showNotification('Error processing request', 'error');
        } finally {
            processBtn.innerHTML = originalText;
            processBtn.disabled = false;
        }
    }

    clearNaturalLanguage() {
        document.getElementById('nl-input').value = '';
        document.getElementById('nl-result').classList.add('hidden');
    }

    renderData() {
        this.renderFaqList();
        this.renderSynonymsList();
    }

    renderFaqList() {
        const container = document.getElementById('faq-list');
        container.innerHTML = '';

        this.currentData.faq.forEach((faq, index) => {
            const faqDiv = document.createElement('div');
            faqDiv.className = 'bg-gray-50 rounded-lg p-4 border border-gray-200';
            faqDiv.innerHTML = `
                <div class="flex justify-between items-start mb-3">
                    <h4 class="font-medium text-gray-800">${faq.q}</h4>
                    <div class="flex space-x-2">
                        <button onclick="admin.editFaq(${index})" class="text-blue-600 hover:text-blue-800">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button onclick="admin.deleteFaq(${index})" class="text-red-600 hover:text-red-800">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
                <p class="text-gray-600 mb-2">${faq.a}</p>
                <div class="flex flex-wrap gap-2 text-xs">
                    ${faq.tags ? faq.tags.map(tag => `<span class="bg-purple-100 text-purple-800 px-2 py-1 rounded">${tag}</span>`).join('') : ''}
                </div>
            `;
            container.appendChild(faqDiv);
        });
    }

    renderSynonymsList() {
        const container = document.getElementById('synonyms-list');
        container.innerHTML = '';

        Object.entries(this.currentData.synonyms).forEach(([station, synonyms], index) => {
            const synonymDiv = document.createElement('div');
            synonymDiv.className = 'bg-gray-50 rounded-lg p-4 border border-gray-200';
            synonymDiv.innerHTML = `
                <div class="flex justify-between items-start mb-3">
                    <h4 class="font-medium text-gray-800">${station}</h4>
                    <div class="flex space-x-2">
                        <button onclick="admin.editSynonym('${station}')" class="text-blue-600 hover:text-blue-800">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button onclick="admin.deleteSynonym('${station}')" class="text-red-600 hover:text-red-800">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
                <div class="flex flex-wrap gap-2">
                    ${synonyms.map(synonym => `<span class="bg-blue-100 text-blue-800 px-2 py-1 rounded text-sm">${synonym}</span>`).join('')}
                </div>
            `;
            container.appendChild(synonymDiv);
        });
    }

    openFaqModal(faq = null) {
        const modal = document.getElementById('faq-modal');
        const title = document.getElementById('faq-modal-title');
        const form = document.getElementById('faq-form');

        if (faq) {
            title.textContent = 'Edit FAQ';
            document.getElementById('faq-question').value = faq.q;
            document.getElementById('faq-answer').value = faq.a;
            document.getElementById('faq-tags').value = faq.tags ? faq.tags.join(', ') : '';
            document.getElementById('faq-evidence').value = faq.evidence ? faq.evidence.join(', ') : '';
            form.dataset.editIndex = this.currentData.faq.indexOf(faq);
        } else {
            title.textContent = 'Add FAQ';
            form.reset();
            delete form.dataset.editIndex;
        }

        modal.classList.remove('hidden');
        modal.classList.add('flex');
    }

    async handleFaqSubmit(e) {
        e.preventDefault();
        
        const form = e.target;
        const faqData = {
            q: document.getElementById('faq-question').value,
            a: document.getElementById('faq-answer').value,
            tags: document.getElementById('faq-tags').value.split(',').map(tag => tag.trim()).filter(tag => tag),
            evidence: document.getElementById('faq-evidence').value.split(',').map(ev => ev.trim()).filter(ev => ev)
        };

        try {
            const action = form.dataset.editIndex !== undefined ? 'update' : 'add';
            if (action === 'update') {
                this.currentData.faq[parseInt(form.dataset.editIndex)] = faqData;
            } else {
                this.currentData.faq.push(faqData);
            }

            await this.updateData('faq', this.currentData.faq, action, faqData);
            this.closeModal('faq-modal');
            this.renderFaqList();
            this.showNotification(`FAQ ${action === 'add' ? 'added' : 'updated'} successfully`, 'success');
        } catch (error) {
            console.error('FAQ submit error:', error);
            this.showNotification('Error saving FAQ', 'error');
        }
    }

    openSynonymModal(station = null) {
        const modal = document.getElementById('synonym-modal');
        const title = document.getElementById('synonym-modal-title');
        const form = document.getElementById('synonym-form');

        if (station) {
            title.textContent = 'Edit Station Synonym';
            document.getElementById('synonym-station').value = station;
            document.getElementById('synonym-list').value = this.currentData.synonyms[station].join(', ');
            form.dataset.editStation = station;
        } else {
            title.textContent = 'Add Station Synonym';
            form.reset();
            delete form.dataset.editStation;
        }

        modal.classList.remove('hidden');
        modal.classList.add('flex');
    }

    async handleSynonymSubmit(e) {
        e.preventDefault();
        
        const form = e.target;
        const station = document.getElementById('synonym-station').value;
        const synonyms = document.getElementById('synonym-list').value.split(',').map(s => s.trim()).filter(s => s);

        try {
            const action = form.dataset.editStation ? 'update' : 'add';
            if (action === 'update') {
                delete this.currentData.synonyms[form.dataset.editStation];
            }
            this.currentData.synonyms[station] = synonyms;

            await this.updateData('synonyms', this.currentData.synonyms, action, { station, synonyms });
            this.closeModal('synonym-modal');
            this.renderSynonymsList();
            this.showNotification(`Station synonym ${action === 'add' ? 'added' : 'updated'} successfully`, 'success');
        } catch (error) {
            console.error('Synonym submit error:', error);
            this.showNotification('Error saving synonym', 'error');
        }
    }

    async saveKnowledgeBase() {
        try {
            const knowledgeText = document.getElementById('knowledge-editor').value;
            const knowledgeData = JSON.parse(knowledgeText);
            
            this.currentData.knowledge = knowledgeData;
            await this.updateData('knowledge', knowledgeData, 'update', knowledgeData);
            this.showNotification('Knowledge base saved successfully', 'success');
        } catch (error) {
            console.error('Knowledge save error:', error);
            this.showNotification('Error saving knowledge base - check JSON syntax', 'error');
        }
    }

    async updateData(type, data, action, item) {
        const response = await fetch('/api/admin/update', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ type, data, action, item })
        });

        if (!response.ok) {
            throw new Error('Update failed');
        }
    }

    async deleteFaq(index) {
        if (confirm('Are you sure you want to delete this FAQ?')) {
            const faq = this.currentData.faq[index];
            this.currentData.faq.splice(index, 1);
            await this.updateData('faq', this.currentData.faq, 'delete', faq);
            this.renderFaqList();
            this.showNotification('FAQ deleted successfully', 'success');
        }
    }

    async deleteSynonym(station) {
        if (confirm('Are you sure you want to delete this station synonym?')) {
            const synonyms = this.currentData.synonyms[station];
            delete this.currentData.synonyms[station];
            await this.updateData('synonyms', this.currentData.synonyms, 'delete', { station, synonyms });
            this.renderSynonymsList();
            this.showNotification('Station synonym deleted successfully', 'success');
        }
    }

    editFaq(index) {
        this.openFaqModal(this.currentData.faq[index]);
    }

    editSynonym(station) {
        this.openSynonymModal(station);
    }

    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `fixed top-4 right-4 z-50 p-4 rounded-lg shadow-lg ${
            type === 'success' ? 'bg-green-500 text-white' :
            type === 'error' ? 'bg-red-500 text-white' :
            type === 'warning' ? 'bg-yellow-500 text-white' :
            'bg-blue-500 text-white'
        }`;
        notification.textContent = message;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.remove();
        }, 3000);
    }
}

// Global functions for modal handling
function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    modal.classList.add('hidden');
    modal.classList.remove('flex');
}

// Initialize admin interface
let admin;
document.addEventListener('DOMContentLoaded', () => {
    admin = new PuneMetroAdmin();
});
