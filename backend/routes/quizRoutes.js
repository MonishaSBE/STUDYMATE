const express = require('express');
const router = express.Router();
const auth = require('../middleware/authenticate');
const { fallbackData } = require('../services/storageAdapter');
const { extractTextFromDocument } = require('../services/documentExtractor');
const { generateQuestionsFromContent } = require('../services/aiService');

// 1. Get Quizzes List with Domain, Difficulty, and Search Filters
router.get('/', auth, (req, res) => {
    const { domain, difficulty, search } = req.query;
    let list = fallbackData.quizzes.map(q => ({
        id: q.id,
        title: q.title,
        subject: q.subject,
        domain: q.domain || 'Computer Science and Engineering',
        difficulty: q.difficulty,
        num_questions: (q.questions || []).length,
        created_at: q.created_at,
        is_owner: q.user_id === req.session.userId
    }));

    if (search) {
        const sLower = search.toLowerCase();
        list = list.filter(q => q.title.toLowerCase().includes(sLower) || q.subject.toLowerCase().includes(sLower));
    }

    if (domain) {
        list = list.filter(q => q.domain && q.domain.toLowerCase() === domain.toLowerCase());
    }

    if (difficulty) {
        list = list.filter(q => q.difficulty === difficulty);
    }

    res.json({ status: 'success', data: list });
});

// 2. Generate a Quiz from a Document
router.post('/generate', auth, async (req, res) => {
    try {
        const { material_id, title, difficulty = 'medium', num_questions = 4 } = req.body;
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

        const generatedQuestions = generateQuestionsFromContent(
            docText,
            material.title,
            Number(num_questions) || 4,
            difficulty
        );

        const newQuiz = {
            id: fallbackData.nextId++,
            user_id: req.session.userId,
            material_id: material.id,
            title: title || `${material.subject_name} Knowledge Assessment`,
            subject: material.subject_name,
            difficulty,
            created_at: new Date().toISOString(),
            questions: generatedQuestions
        };

        fallbackData.quizzes.unshift(newQuiz);

        res.json({
            status: 'success',
            message: 'Quiz generated successfully from document',
            data: {
                id: newQuiz.id,
                title: newQuiz.title,
                subject: newQuiz.subject,
                difficulty: newQuiz.difficulty,
                num_questions: newQuiz.questions.length
            }
        });
    } catch (err) {
        res.status(500).json({ status: 'failure', message: err.message });
    }
});

// 3. Start a Quiz Attempt (Returns questions WITHOUT leaking correct answers)
router.get('/:id/take', auth, (req, res) => {
    const id = Number(req.params.id);
    const quiz = fallbackData.quizzes.find(q => q.id === id);
    if (!quiz) {
        return res.status(404).json({ status: 'failure', message: 'Quiz not found' });
    }

    // Sanitize questions so correct_answer is never exposed to the client ahead of time
    const sanitizedQuestions = quiz.questions.map(q => ({
        id: q.id,
        question_text: q.question_text,
        question_type: q.question_type,
        options: q.options || []
    }));

    res.json({
        status: 'success',
        data: {
            id: quiz.id,
            title: quiz.title,
            subject: quiz.subject,
            difficulty: quiz.difficulty,
            questions: sanitizedQuestions
        }
    });
});

// 4. Submit Answers and Calculate Score on Backend
router.post('/:id/submit', auth, (req, res) => {
    const id = Number(req.params.id);
    const { answers } = req.body; // Map: { [questionId]: "userAnswer" }
    const quiz = fallbackData.quizzes.find(q => q.id === id);
    if (!quiz) {
        return res.status(404).json({ status: 'failure', message: 'Quiz not found' });
    }

    let score = 0;
    const review = [];

    quiz.questions.forEach(q => {
        const userAnswer = answers ? String(answers[q.id] || '').trim().toLowerCase() : '';
        const correctAnswer = String(q.correct_answer || '').trim().toLowerCase();
        const isCorrect = userAnswer === correctAnswer || (q.question_type === 'short_answer' && userAnswer.length > 5);

        if (isCorrect) score++;

        review.push({
            question_id: q.id,
            question_text: q.question_text,
            user_answer: answers ? answers[q.id] : null,
            correct_answer: q.correct_answer,
            is_correct: isCorrect,
            explanation: q.explanation
        });
    });

    const attempt = {
        id: fallbackData.nextId++,
        quiz_id: quiz.id,
        quiz_title: quiz.title,
        user_id: req.session.userId,
        score,
        total_questions: quiz.questions.length,
        percentage: Math.round((score / quiz.questions.length) * 100),
        attempted_at: new Date().toISOString()
    };

    fallbackData.quiz_attempts.unshift(attempt);

    res.json({
        status: 'success',
        data: {
            score,
            total_questions: quiz.questions.length,
            percentage: attempt.percentage,
            review
        }
    });
});

// 5. Get Quiz History for Current User
router.get('/user/history', auth, (req, res) => {
    const history = fallbackData.quiz_attempts.filter(a => a.user_id === req.session.userId);
    res.json({ status: 'success', data: history });
});

module.exports = router;
