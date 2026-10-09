const express = require('express');
const router = express.Router();
const db = require('../mockDb');
const auth = require('../middleware/authenticate');

router.post('/', auth, (req, res) => {
    const { student_id, goal_text, target_date } = req.body;
    db.goals.push({
        ROWID: db.nextId++,
        student_id, goal_text, target_date, is_completed: false
    });
    res.json({ status: 'success' });
});

router.get('/:studentId', auth, (req, res) => {
    const goals = db.goals.filter(g => g.student_id == req.params.studentId);
    res.json({ status: 'success', data: goals });
});

router.put('/:id', auth, (req, res) => {
    const { is_completed } = req.body;
    const goal = db.goals.find(g => g.ROWID == req.params.id);
    if (goal) goal.is_completed = is_completed;
    res.json({ status: 'success' });
});

module.exports = router;
