const express = require('express');
const router = express.Router();
const auth = require('../middleware/authenticate');
const { fallbackData } = require('../services/storageAdapter');
const { extractTextFromDocument } = require('../services/documentExtractor');
const { generateFlashcardsFromContent } = require('../services/aiService');

// 1. Get Flashcard Decks with Domain and Subject Filters
router.get('/decks', auth, (req, res) => {
    const userId = req.session.userId;
    const { domain, search, subject } = req.query;

    let decks = fallbackData.flashcard_decks
        .filter(d => d.user_id === userId || d.is_public)
        .map(d => ({
            id: d.id,
            title: d.title,
            subject: d.subject,
            domain: d.domain || 'Computer Science and Engineering',
            description: d.description,
            is_public: d.is_public,
            card_count: (d.cards || []).length,
            is_owner: d.user_id === userId,
            created_at: d.created_at
        }));

    if (search) {
        const sLower = search.toLowerCase();
        decks = decks.filter(d => d.title.toLowerCase().includes(sLower) || d.subject.toLowerCase().includes(sLower));
    }

    if (domain) {
        decks = decks.filter(d => d.domain && d.domain.toLowerCase() === domain.toLowerCase());
    }

    if (subject) {
        decks = decks.filter(d => d.subject && d.subject.toLowerCase().includes(subject.toLowerCase()));
    }

    res.json({ status: 'success', data: decks });
});

// 2. Create Deck Manually
router.post('/decks', auth, (req, res) => {
    const { title, subject, description, is_public } = req.body;
    if (!title || !subject) {
        return res.status(400).json({ status: 'failure', message: 'Title and subject are required' });
    }

    const newDeck = {
        id: fallbackData.nextId++,
        user_id: req.session.userId,
        material_id: null,
        title: title.trim(),
        subject: subject.trim(),
        description: description ? description.trim() : '',
        is_public: Boolean(is_public),
        created_at: new Date().toISOString(),
        cards: []
    };

    fallbackData.flashcard_decks.unshift(newDeck);
    res.json({ status: 'success', data: newDeck });
});

// 3. Generate Deck from Document
router.post('/generate', auth, async (req, res) => {
    try {
        const { material_id, deck_title } = req.body;
        if (!material_id) {
            return res.status(400).json({ status: 'failure', message: 'Material ID is required' });
        }

        const material = fallbackData.materials.find(m => m.id === Number(material_id));
        if (!material) {
            return res.status(404).json({ status: 'failure', message: 'Material not found' });
        }

        let docText = `${material.title}. ${material.description}. Subject: ${material.subject_name}`;
        if (material.file_path) {
            const extText = await extractTextFromDocument(material.file_path);
            if (extText) docText = extText;
        }

        const generatedCards = generateFlashcardsFromContent(docText, material.title);
        const deckId = fallbackData.nextId++;

        const newDeck = {
            id: deckId,
            user_id: req.session.userId,
            material_id: material.id,
            title: deck_title || `${material.title} Flashcards`,
            subject: material.subject_name,
            description: `Auto-generated flashcards from ${material.title}`,
            is_public: false,
            created_at: new Date().toISOString(),
            cards: generatedCards.map((c, idx) => ({
                id: fallbackData.nextId++,
                deck_id: deckId,
                front_text: c.front_text,
                back_text: c.back_text
            }))
        };

        fallbackData.flashcard_decks.unshift(newDeck);

        res.json({
            status: 'success',
            message: 'Flashcards generated from document',
            data: newDeck
        });
    } catch (err) {
        res.status(500).json({ status: 'failure', message: err.message });
    }
});

// 4. Get Cards for a Deck with Student's Mastery Progress
router.get('/decks/:id/cards', auth, (req, res) => {
    const deckId = Number(req.params.id);
    const userId = req.session.userId;
    const deck = fallbackData.flashcard_decks.find(d => d.id === deckId);
    if (!deck) {
        return res.status(404).json({ status: 'failure', message: 'Deck not found' });
    }

    const cards = (deck.cards || []).map(c => {
        const progressKey = `${userId}_${c.id}`;
        const mastery = fallbackData.flashcard_progress[progressKey] || 'unseen';
        return {
            ...c,
            mastery_status: mastery
        };
    });

    res.json({
        status: 'success',
        data: {
            deck: {
                id: deck.id,
                title: deck.title,
                subject: deck.subject,
                description: deck.description,
                is_owner: deck.user_id === userId
            },
            cards
        }
    });
});

// 5. Add Card to Deck
router.post('/decks/:id/cards', auth, (req, res) => {
    const deckId = Number(req.params.id);
    const { front_text, back_text } = req.body;
    const deck = fallbackData.flashcard_decks.find(d => d.id === deckId);

    if (!deck) {
        return res.status(404).json({ status: 'failure', message: 'Deck not found' });
    }
    if (deck.user_id !== req.session.userId) {
        return res.status(403).json({ status: 'failure', message: 'Unauthorized to modify this deck' });
    }
    if (!front_text || !back_text) {
        return res.status(400).json({ status: 'failure', message: 'Both front and back text are required' });
    }

    const newCard = {
        id: fallbackData.nextId++,
        deck_id: deckId,
        front_text: front_text.trim(),
        back_text: back_text.trim()
    };

    deck.cards.push(newCard);
    res.json({ status: 'success', data: newCard });
});

// 6. Record Mastery Status (Known / Revise / Unseen)
router.post('/cards/:cardId/progress', auth, (req, res) => {
    const cardId = Number(req.params.cardId);
    const userId = req.session.userId;
    const { status } = req.body; // 'mastered', 'learning', 'unseen'

    if (!['mastered', 'learning', 'unseen'].includes(status)) {
        return res.status(400).json({ status: 'failure', message: 'Invalid mastery status' });
    }

    const progressKey = `${userId}_${cardId}`;
    fallbackData.flashcard_progress[progressKey] = status;

    res.json({ status: 'success', mastery_status: status });
});

// 7. Delete Deck
router.delete('/decks/:id', auth, (req, res) => {
    const deckId = Number(req.params.id);
    const idx = fallbackData.flashcard_decks.findIndex(d => d.id === deckId);

    if (idx === -1) {
        return res.status(404).json({ status: 'failure', message: 'Deck not found' });
    }
    if (fallbackData.flashcard_decks[idx].user_id !== req.session.userId) {
        return res.status(403).json({ status: 'failure', message: 'Unauthorized to delete this deck' });
    }

    fallbackData.flashcard_decks.splice(idx, 1);
    res.json({ status: 'success', message: 'Deck deleted' });
});

module.exports = router;
