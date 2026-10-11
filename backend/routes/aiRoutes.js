const express = require('express');
const router = express.Router();
const auth = require('../middleware/authenticate');
const { fallbackData } = require('../services/storageAdapter');
const { extractTextFromDocument } = require('../services/documentExtractor');
const {
    isAiConfigured,
    callGeminiApi,
    generateAcademicSummary,
    answerDocumentQuestion,
    generateStructuredNotes
} = require('../services/aiService');

// 1. Get AI Configuration Status
router.get('/status', auth, (req, res) => {
    res.json({
        status: 'success',
        data: {
            configured: isAiConfigured(),
            model: isAiConfigured() ? 'Gemini 1.5 Flash' : 'StudyMate Academic Engine (Local High-Yield Analyzer)',
            message: isAiConfigured()
                ? 'External AI provider connected'
                : 'Local academic inference active. To enable external cloud model, set GEMINI_API_KEY in .env.'
        }
    });
});

// Helper: retrieve document text from material or fallback sample
async function getMaterialText(materialId) {
    const material = fallbackData.materials.find(m => m.id === Number(materialId));
    if (!material) return { material: null, text: null };

    let text = null;
    if (material.file_path) {
        text = await extractTextFromDocument(material.file_path);
    }

    if (!text) {
        text = `${material.title}.\n${material.description}\nSubject: ${material.subject_name}.\nTopics covered: ${(material.tags || []).join(', ')}. Comprehensive examination concepts and theoretical definitions.`;
    }

    return { material, text };
}

// 2. Document Summarization (Short, Detailed, Exam-Oriented)
router.post('/summarize', auth, async (req, res) => {
    try {
        const { material_id, type = 'detailed' } = req.body;
        if (!material_id) {
            return res.status(400).json({ status: 'failure', message: 'Material ID is required' });
        }

        const { material, text } = await getMaterialText(material_id);
        if (!material) {
            return res.status(404).json({ status: 'failure', message: 'Document not found' });
        }

        let summary = null;
        if (isAiConfigured()) {
            const prompt = `You are a university academic study assistant. Provide a ${type} study summary for the following course document: "${material.title}". Focus on technical rigor, core concepts, formulas, and examination readiness.\n\nDocument text excerpt:\n${text.substring(0, 4000)}`;
            summary = await callGeminiApi(prompt);
        }

        if (!summary) {
            summary = generateAcademicSummary(text, material.title, type);
        }

        res.json({
            status: 'success',
            data: {
                material_id: material.id,
                title: material.title,
                summary_type: type,
                summary,
                ai_provider: isAiConfigured() ? 'Google Gemini' : 'StudyMate Local Academic Engine'
            }
        });
    } catch (err) {
        res.status(500).json({ status: 'failure', message: err.message });
    }
});

// 3. Document-Grounded Q&A
router.post('/qa', auth, async (req, res) => {
    try {
        const { material_id, question } = req.body;
        if (!material_id || !question) {
            return res.status(400).json({ status: 'failure', message: 'Material ID and question are required' });
        }

        const { material, text } = await getMaterialText(material_id);
        if (!material) {
            return res.status(404).json({ status: 'failure', message: 'Document not found' });
        }

        let answerObj = null;
        if (isAiConfigured()) {
            const prompt = `You are an academic tutor answering student questions strictly grounded in the course document: "${material.title}".
If the document content does not contain the answer, explicitly state that the document lacks sufficient information.
Student Question: ${question}

Document Content:
${text.substring(0, 4000)}`;
            const responseText = await callGeminiApi(prompt);
            if (responseText) {
                answerObj = {
                    answer: responseText,
                    grounded: true,
                    sourceReference: `${material.title} (AI Grounded)`
                };
            }
        }

        if (!answerObj) {
            answerObj = answerDocumentQuestion(text, question, material.title);
        }

        res.json({
            status: 'success',
            data: {
                material_id: material.id,
                question,
                ...answerObj
            }
        });
    } catch (err) {
        res.status(500).json({ status: 'failure', message: err.message });
    }
});

// 4. Generate Structured Study Notes
router.post('/notes', auth, async (req, res) => {
    try {
        const { material_id } = req.body;
        if (!material_id) {
            return res.status(400).json({ status: 'failure', message: 'Material ID is required' });
        }

        const { material, text } = await getMaterialText(material_id);
        if (!material) {
            return res.status(404).json({ status: 'failure', message: 'Document not found' });
        }

        let notes = null;
        if (isAiConfigured()) {
            const prompt = `Generate comprehensive, highly structured revision notes for university students from this document: "${material.title}". Include Headings, Core Definitions, Algorithmic/Theoretical Invariants, and Quick Exam Points.\n\nContent:\n${text.substring(0, 4000)}`;
            notes = await callGeminiApi(prompt);
        }

        if (!notes) {
            notes = generateStructuredNotes(text, material.title);
        }

        res.json({
            status: 'success',
            data: {
                material_id: material.id,
                title: material.title,
                notes
            }
        });
    } catch (err) {
        res.status(500).json({ status: 'failure', message: err.message });
    }
});

module.exports = router;
