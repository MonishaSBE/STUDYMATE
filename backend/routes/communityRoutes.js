const express = require('express');
const router = express.Router();
const auth = require('../middleware/authenticate');
const { fallbackData } = require('../services/storageAdapter');

// 1. Get Questions with Search & Filter
router.get('/questions', auth, (req, res) => {
    const { search, subject } = req.query;
    let questions = [...fallbackData.community_questions];

    if (search) {
        const sLower = search.toLowerCase();
        questions = questions.filter(q =>
            q.title.toLowerCase().includes(sLower) ||
            q.content.toLowerCase().includes(sLower) ||
            (q.tags && q.tags.toLowerCase().includes(sLower))
        );
    }

    if (subject) {
        questions = questions.filter(q => q.subject.toLowerCase().includes(subject.toLowerCase()));
    }

    // Sort by recent
    questions.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    const enriched = questions.map(q => ({
        id: q.id,
        user_id: q.user_id,
        author_name: q.author_name,
        subject: q.subject,
        title: q.title,
        content: q.content,
        tags: q.tags,
        is_resolved: q.is_resolved,
        views_count: q.views_count,
        answer_count: (q.answers || []).length,
        created_at: q.created_at,
        is_author: q.user_id === req.session.userId
    }));

    res.json({ status: 'success', data: enriched });
});

// 2. Get Single Question with Answers
router.get('/questions/:id', auth, (req, res) => {
    const id = Number(req.params.id);
    const q = fallbackData.community_questions.find(item => item.id === id);

    if (!q) {
        return res.status(404).json({ status: 'failure', message: 'Question not found' });
    }

    q.views_count = (q.views_count || 0) + 1;

    // Enrich answers with vote status for current user
    const answers = (q.answers || []).map(a => {
        const voteKey = `${req.session.userId}_${a.id}`;
        return {
            ...a,
            user_vote: fallbackData.community_votes[voteKey] || null,
            is_author: a.user_id === req.session.userId
        };
    });

    res.json({
        status: 'success',
        data: {
            ...q,
            is_author: q.user_id === req.session.userId,
            answers
        }
    });
});

// 3. Post a New Question
router.post('/questions', auth, (req, res) => {
    const { title, content, subject, tags } = req.body;
    if (!title || !content || !subject) {
        return res.status(400).json({ status: 'failure', message: 'Title, content and subject are required' });
    }

    const newQuestion = {
        id: fallbackData.nextId++,
        user_id: req.session.userId,
        author_name: req.session.email ? req.session.email.split('@')[0] : 'Student',
        subject: subject.trim(),
        title: title.trim(),
        content: content.trim(),
        tags: tags ? tags.trim() : '',
        is_resolved: false,
        views_count: 1,
        created_at: new Date().toISOString(),
        answers: []
    };

    fallbackData.community_questions.unshift(newQuestion);
    res.json({ status: 'success', data: newQuestion });
});

// 4. Submit an Answer to a Question
router.post('/questions/:id/answers', auth, (req, res) => {
    const qId = Number(req.params.id);
    const { content } = req.body;
    const q = fallbackData.community_questions.find(item => item.id === qId);

    if (!q) {
        return res.status(404).json({ status: 'failure', message: 'Question not found' });
    }
    if (!content || !content.trim()) {
        return res.status(400).json({ status: 'failure', message: 'Answer content is required' });
    }

    const newAnswer = {
        id: fallbackData.nextId++,
        question_id: qId,
        user_id: req.session.userId,
        author_name: req.session.email ? req.session.email.split('@')[0] : 'Student',
        content: content.trim(),
        is_accepted: false,
        upvotes: 0,
        created_at: new Date().toISOString()
    };

    q.answers.push(newAnswer);
    res.json({ status: 'success', data: newAnswer });
});

// 5. Upvote / Downvote an Answer (prevents duplicate voting)
router.post('/answers/:id/vote', auth, (req, res) => {
    const answerId = Number(req.params.id);
    const userId = req.session.userId;
    const { vote_type } = req.body; // 'up' or 'down'

    // Find answer
    let foundAnswer = null;
    for (const q of fallbackData.community_questions) {
        const a = (q.answers || []).find(ans => ans.id === answerId);
        if (a) {
            foundAnswer = a;
            break;
        }
    }

    if (!foundAnswer) {
        return res.status(404).json({ status: 'failure', message: 'Answer not found' });
    }

    const voteKey = `${userId}_${answerId}`;
    const previousVote = fallbackData.community_votes[voteKey];

    if (previousVote === vote_type) {
        // Toggle remove vote
        delete fallbackData.community_votes[voteKey];
        if (vote_type === 'up') foundAnswer.upvotes = Math.max(0, foundAnswer.upvotes - 1);
        return res.json({ status: 'success', vote: null, upvotes: foundAnswer.upvotes });
    }

    // Apply new vote
    if (vote_type === 'up') {
        foundAnswer.upvotes += (previousVote === 'down' ? 2 : 1);
    } else if (vote_type === 'down' && previousVote === 'up') {
        foundAnswer.upvotes = Math.max(0, foundAnswer.upvotes - 1);
    }

    fallbackData.community_votes[voteKey] = vote_type;
    res.json({ status: 'success', vote: vote_type, upvotes: foundAnswer.upvotes });
});

// 6. Mark Answer as Accepted (Question author only)
router.post('/questions/:qId/answers/:aId/accept', auth, (req, res) => {
    const qId = Number(req.params.qId);
    const aId = Number(req.params.aId);
    const q = fallbackData.community_questions.find(item => item.id === qId);

    if (!q) {
        return res.status(404).json({ status: 'failure', message: 'Question not found' });
    }
    if (q.user_id !== req.session.userId) {
        return res.status(403).json({ status: 'failure', message: 'Only question author can accept an answer' });
    }

    q.answers.forEach(a => {
        a.is_accepted = (a.id === aId);
    });
    q.is_resolved = true;

    res.json({ status: 'success', message: 'Answer marked as accepted' });
});

module.exports = router;
