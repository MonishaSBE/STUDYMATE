const express = require('express');
const router = express.Router();
const auth = require('../middleware/authenticate');
const { fallbackData } = require('../services/storageAdapter');
const { extractTextFromDocument } = require('../services/documentExtractor');
const { generateConceptMapFromContent } = require('../services/aiService');

// 1. Get User's Concept Maps
router.get('/', auth, (req, res) => {
    const userId = req.session.userId;
    const maps = fallbackData.concept_maps
        .filter(m => m.user_id === userId)
        .map(m => ({
            id: m.id,
            title: m.title,
            subject: m.subject,
            node_count: (m.nodes || []).length,
            edge_count: (m.edges || []).length,
            created_at: m.created_at,
            updated_at: m.updated_at
        }));

    res.json({ status: 'success', data: maps });
});

// 2. Get Single Concept Map with Nodes & Edges
router.get('/:id', auth, (req, res) => {
    const id = Number(req.params.id);
    const map = fallbackData.concept_maps.find(m => m.id === id);

    if (!map) {
        return res.status(404).json({ status: 'failure', message: 'Concept map not found' });
    }

    res.json({ status: 'success', data: map });
});

// 3. Generate Concept Map from Document
router.post('/generate', auth, async (req, res) => {
    try {
        const { material_id } = req.body;
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

        const generated = generateConceptMapFromContent(docText, material.title, material.subject_name);
        const newMap = {
            id: fallbackData.nextId++,
            user_id: req.session.userId,
            material_id: material.id,
            title: generated.title,
            subject: generated.subject,
            nodes: generated.nodes,
            edges: generated.edges,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };

        fallbackData.concept_maps.unshift(newMap);

        res.json({
            status: 'success',
            message: 'Concept map generated from document',
            data: newMap
        });
    } catch (err) {
        res.status(500).json({ status: 'failure', message: err.message });
    }
});

// 4. Save or Update Concept Map
router.post('/', auth, (req, res) => {
    const { id, title, subject, nodes, edges } = req.body;
    if (!title) {
        return res.status(400).json({ status: 'failure', message: 'Title is required' });
    }

    if (id) {
        // Update
        const map = fallbackData.concept_maps.find(m => m.id === Number(id));
        if (!map) return res.status(404).json({ status: 'failure', message: 'Map not found' });
        if (map.user_id !== req.session.userId) return res.status(403).json({ status: 'failure', message: 'Unauthorized' });

        map.title = title.trim();
        map.subject = subject ? subject.trim() : map.subject;
        map.nodes = nodes || [];
        map.edges = edges || [];
        map.updated_at = new Date().toISOString();

        return res.json({ status: 'success', data: map });
    }

    // Create New
    const newMap = {
        id: fallbackData.nextId++,
        user_id: req.session.userId,
        material_id: null,
        title: title.trim(),
        subject: subject ? subject.trim() : 'General',
        nodes: nodes || [],
        edges: edges || [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
    };

    fallbackData.concept_maps.unshift(newMap);
    res.json({ status: 'success', data: newMap });
});

// 5. Delete Concept Map
router.delete('/:id', auth, (req, res) => {
    const id = Number(req.params.id);
    const idx = fallbackData.concept_maps.findIndex(m => m.id === id);

    if (idx === -1) {
        return res.status(404).json({ status: 'failure', message: 'Concept map not found' });
    }
    if (fallbackData.concept_maps[idx].user_id !== req.session.userId) {
        return res.status(403).json({ status: 'failure', message: 'Unauthorized' });
    }

    fallbackData.concept_maps.splice(idx, 1);
    res.json({ status: 'success', message: 'Concept map deleted' });
});

module.exports = router;
