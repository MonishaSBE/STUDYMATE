const express = require('express');
const router = express.Router();
const db = require('../mockDb');
const auth = require('../middleware/authenticate');

// Helper to check and evaluate goal status
function evaluateGoal(g) {
    const today = new Date().toISOString().split('T')[0];
    const isOverdue = !g.is_completed && g.target_date && g.target_date < today;
    
    let isReminderDue = false;
    if (!g.is_completed && g.reminder_datetime) {
        const now = new Date();
        const remTime = new Date(g.reminder_datetime);
        isReminderDue = now >= remTime && !g.reminder_sent;
    }

    return {
        ...g,
        is_overdue: Boolean(isOverdue),
        is_reminder_due: Boolean(isReminderDue)
    };
}

// GET /api/goals/:studentId — List goals + streak data
router.get('/:studentId', auth, (req, res) => {
    try {
        const studentId = Number(req.params.studentId);
        const goals = (db.goals || []).filter(g => Number(g.student_id) === studentId);
        const evaluated = goals.map(evaluateGoal);
        const streak = db.getStreak(studentId);
        res.json({ status: 'success', data: evaluated, streak });
    } catch (err) {
        res.status(500).json({ status: 'failure', message: err.message });
    }
});

// 2. POST /api/goals - Create new goal with optional description and reminder
router.post('/', auth, async (req, res) => {
    try {
        const { student_id, goal_text, description, target_date, reminder_datetime } = req.body;
        if (!goal_text || !goal_text.trim()) {
            return res.status(400).json({ status: 'failure', message: 'Goal title is required' });
        }

        const newGoal = {
            ROWID: db.nextId++,
            student_id: Number(student_id),
            goal_text: goal_text.trim(),
            description: description ? description.trim() : '',
            target_date: target_date || null,
            reminder_datetime: reminder_datetime || null,
            is_completed: false,
            completed_at: null,
            reminder_sent: false,
            created_at: new Date().toISOString()
        };

        await db.saveGoal(newGoal);
        res.json({ status: 'success', data: newGoal });
    } catch (err) {
        res.status(500).json({ status: 'failure', message: err.message });
    }
});

// 3. PUT /api/goals/:id - Update completion status or edit goal & reminders
router.put('/:id', auth, async (req, res) => {
    try {
        const goal = db.goals.find(g => g.ROWID == req.params.id);
        if (!goal) return res.status(404).json({ status: 'failure', message: 'Goal not found' });

        const { is_completed, goal_text, description, target_date, reminder_datetime, reminder_acknowledged } = req.body;

        if (is_completed !== undefined) {
            const wasCompleted = goal.is_completed;
            goal.is_completed = Boolean(is_completed);
            goal.completed_at = is_completed ? new Date().toISOString() : null;
            if (is_completed) {
                goal.reminder_sent = true;

                // --- Streak tracking ---
                if (!wasCompleted) {
                    const today = new Date().toISOString().split('T')[0];
                    const studentId = goal.student_id;
                    const streak = db.getStreak(studentId);
                    const lastDate = streak.lastCompletedDate;

                    if (lastDate === today) {
                        // Already completed a goal today, streak stays the same
                    } else {
                        const yesterday = new Date();
                        yesterday.setDate(yesterday.getDate() - 1);
                        const yesterdayStr = yesterday.toISOString().split('T')[0];

                        if (lastDate === yesterdayStr) {
                            // Consecutive day — increment streak
                            streak.current = (streak.current || 0) + 1;
                        } else {
                            // Streak broken — restart
                            streak.current = 1;
                        }
                        streak.longest = Math.max(streak.longest || 0, streak.current);
                        streak.lastCompletedDate = today;
                        db.saveStreak(studentId, streak);
                    }
                }
            } else {
                // Uncompleting a goal doesn't reduce streak
            }
        }

        if (goal_text) goal.goal_text = goal_text.trim();
        if (description !== undefined) goal.description = description ? description.trim() : '';
        if (target_date !== undefined) goal.target_date = target_date;
        if (reminder_datetime !== undefined) {
            goal.reminder_datetime = reminder_datetime;
            goal.reminder_sent = false;
        }

        if (reminder_acknowledged) {
            goal.reminder_sent = true;
        }

        await db.saveGoal(goal);
        res.json({ status: 'success', data: evaluateGoal(goal) });
    } catch (err) {
        res.status(500).json({ status: 'failure', message: err.message });
    }
});

// 4. DELETE /api/goals/:id - Delete goal
router.delete('/:id', auth, async (req, res) => {
    try {
        await db.deleteGoal(Number(req.params.id));
        res.json({ status: 'success', message: 'Goal deleted' });
    } catch (err) {
        res.status(500).json({ status: 'failure', message: err.message });
    }
});

module.exports = router;
