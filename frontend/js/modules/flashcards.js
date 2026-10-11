/**
 * Feature Module 6: Interactive Flashcard System
 * 3D flip card viewer, deck creator, mastery tracking (Known/Revise), and document generation.
 */

window.FlashcardsModule = {
    activeDeck: null,
    currentCardIndex: 0,
    isFlipped: false,

    async init() {
        const createForm = document.getElementById('flashcardDeckForm');
        if (createForm) {
            createForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleCreateDeck(createForm);
            });
        }

        await this.loadDecks();
        await this.populateDocSelect();
    },

    async populateDocSelect() {
        const select = document.getElementById('fc_doc_select');
        if (!select) return;

        try {
            const materials = await api('/materials');
            select.innerHTML = '<option value="">-- Or Generate Flashcards from Document --</option>' +
                materials.map(m => `<option value="${m.id}">${escapeHtml(m.title)} (${escapeHtml(m.subject_name)})</option>`).join('');
        } catch (e) {}
    },

    async loadDecks() {
        const container = document.getElementById('flashcardsDeckList');
        if (!container) return;

        try {
            const decks = await api('/flashcards/decks');
            if (!decks.length) {
                container.innerHTML = '<div class="empty-state">No flashcard decks found. Create one or generate from a document!</div>';
                return;
            }

            container.innerHTML = decks.map(d => `
                <div class="card" style="margin-bottom:12px; display:flex; justify-content:space-between; align-items:center;">
                    <div>
                        <span class="eyebrow">${escapeHtml(d.subject)}</span>
                        <h3 style="font-size:16px; margin:2px 0 4px;">${escapeHtml(d.title)}</h3>
                        <p style="font-size:12px; color:var(--ink-soft);">${d.card_count} Cards · ${d.is_public ? 'Public' : 'Private'}</p>
                    </div>
                    <div style="display:flex; gap:8px;">
                        <button class="btn small teal" onclick="FlashcardsModule.studyDeck(${d.id})">Study Cards</button>
                        ${d.is_owner ? `<button class="btn small danger" onclick="FlashcardsModule.deleteDeck(${d.id})">Delete</button>` : ''}
                    </div>
                </div>
            `).join('');
        } catch (err) {
            container.innerHTML = '<div class="empty-state">Failed to load flashcard decks.</div>';
        }
    },

    async handleCreateDeck(form) {
        const docSelect = document.getElementById('fc_doc_select');
        if (docSelect && docSelect.value) {
            // Generate from doc
            try {
                await api('/flashcards/generate', {
                    method: 'POST',
                    body: JSON.stringify({ material_id: docSelect.value })
                });
                alert('Flashcard deck generated from document!');
                form.reset();
                this.loadDecks();
            } catch (err) {
                alert('Generation failed: ' + err.message);
            }
            return;
        }

        const title = document.getElementById('fc_title').value;
        const subject = document.getElementById('fc_subject').value;
        const description = document.getElementById('fc_desc').value;
        const is_public = document.getElementById('fc_public').checked;

        try {
            await api('/flashcards/decks', {
                method: 'POST',
                body: JSON.stringify({ title, subject, description, is_public })
            });
            form.reset();
            this.loadDecks();
        } catch (err) {
            alert('Failed to create deck: ' + err.message);
        }
    },

    async generateFromMaterial(materialId) {
        const fcTab = document.querySelector('.tab[data-tab="flashcards"]');
        if (fcTab) fcTab.click();

        try {
            const res = await api('/flashcards/generate', {
                method: 'POST',
                body: JSON.stringify({ material_id: materialId })
            });
            alert('Flashcard deck created from material!');
            this.loadDecks();
            this.studyDeck(res.id);
        } catch (err) {
            alert('Generation error: ' + err.message);
        }
    },

    async studyDeck(deckId) {
        const viewer = document.getElementById('flashcard_viewer_container');
        if (!viewer) return;

        try {
            const data = await api(`/flashcards/decks/${deckId}/cards`);
            this.activeDeck = data;
            this.currentCardIndex = 0;
            this.isFlipped = false;

            viewer.style.display = 'block';
            viewer.scrollIntoView({ behavior: 'smooth' });
            this.renderCard();
        } catch (err) {
            alert('Failed to load cards: ' + err.message);
        }
    },

    renderCard() {
        const viewer = document.getElementById('flashcard_viewer_container');
        if (!this.activeDeck || !this.activeDeck.cards.length) {
            viewer.innerHTML = `
                <div class="card">
                    <h3>No cards in this deck yet.</h3>
                    <button class="btn small" onclick="FlashcardsModule.promptAddCard()">+ Add Card</button>
                    <button class="btn small secondary" onclick="FlashcardsModule.closeViewer()">Close</button>
                </div>
            `;
            return;
        }

        const cards = this.activeDeck.cards;
        const card = cards[this.currentCardIndex];
        const progress = Math.round(((this.currentCardIndex + 1) / cards.length) * 100);

        viewer.innerHTML = `
            <div class="card flashcard-container-box">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
                    <span class="eyebrow">// ${escapeHtml(this.activeDeck.deck.title)}</span>
                    <span class="pill">Card ${this.currentCardIndex + 1} of ${cards.length} (${card.mastery_status})</span>
                </div>

                <div class="flashcard-scene" onclick="FlashcardsModule.flipCard()">
                    <div class="flashcard-card ${this.isFlipped ? 'is-flipped' : ''}">
                        <div class="flashcard-face flashcard-front">
                            <span class="card-hint">Front (Click to Flip)</span>
                            <div class="card-text">${escapeHtml(card.front_text)}</div>
                        </div>
                        <div class="flashcard-face flashcard-back">
                            <span class="card-hint">Back / Answer (Click to Flip)</span>
                            <div class="card-text">${escapeHtml(card.back_text)}</div>
                        </div>
                    </div>
                </div>

                <div class="flashcard-controls" style="margin-top:18px; display:flex; justify-content:space-between; align-items:center;">
                    <button class="btn small secondary" onclick="FlashcardsModule.prevCard()" ${this.currentCardIndex === 0 ? 'disabled' : ''}>← Previous</button>
                    <div style="display:flex; gap:8px;">
                        <button class="btn small" style="background:var(--pin-red); color:#fff;" onclick="FlashcardsModule.markMastery(${card.id}, 'learning')">Need Revision</button>
                        <button class="btn small teal" onclick="FlashcardsModule.markMastery(${card.id}, 'mastered')">✓ Known / Mastered</button>
                    </div>
                    <button class="btn small secondary" onclick="FlashcardsModule.nextCard()" ${this.currentCardIndex === cards.length - 1 ? 'disabled' : ''}>Next →</button>
                </div>

                <div style="margin-top:14px; display:flex; justify-content:space-between; align-items:center;">
                    <button class="btn small secondary" onclick="FlashcardsModule.promptAddCard()">+ Add Card</button>
                    <button class="btn small secondary" onclick="FlashcardsModule.closeViewer()">Close Viewer</button>
                </div>
            </div>
        `;
    },

    flipCard() {
        this.isFlipped = !this.isFlipped;
        const cardElem = document.querySelector('.flashcard-card');
        if (cardElem) cardElem.classList.toggle('is-flipped', this.isFlipped);
    },

    nextCard() {
        if (this.currentCardIndex < this.activeDeck.cards.length - 1) {
            this.currentCardIndex++;
            this.isFlipped = false;
            this.renderCard();
        }
    },

    prevCard() {
        if (this.currentCardIndex > 0) {
            this.currentCardIndex--;
            this.isFlipped = false;
            this.renderCard();
        }
    },

    async markMastery(cardId, status) {
        try {
            await api(`/flashcards/cards/${cardId}/progress`, {
                method: 'POST',
                body: JSON.stringify({ status })
            });
            this.activeDeck.cards[this.currentCardIndex].mastery_status = status;
            this.nextCard();
            if (window.LearningHubModule) window.LearningHubModule.loadMetrics();
        } catch (err) {
            alert('Failed to update progress: ' + err.message);
        }
    },

    async promptAddCard() {
        const front = prompt('Enter Front (Question or Concept):');
        if (!front) return;
        const back = prompt('Enter Back (Answer or Explanation):');
        if (!back) return;

        try {
            const newCard = await api(`/flashcards/decks/${this.activeDeck.deck.id}/cards`, {
                method: 'POST',
                body: JSON.stringify({ front_text: front, back_text: back })
            });
            this.activeDeck.cards.push(newCard);
            this.currentCardIndex = this.activeDeck.cards.length - 1;
            this.isFlipped = false;
            this.renderCard();
        } catch (err) {
            alert('Failed to add card: ' + err.message);
        }
    },

    async deleteDeck(deckId) {
        if (!confirm('Are you sure you want to delete this deck?')) return;
        try {
            await api(`/flashcards/decks/${deckId}`, { method: 'DELETE' });
            this.loadDecks();
            this.closeViewer();
        } catch (err) {
            alert('Delete failed: ' + err.message);
        }
    },

    closeViewer() {
        const viewer = document.getElementById('flashcard_viewer_container');
        if (viewer) viewer.style.display = 'none';
        this.activeDeck = null;
    }
};
