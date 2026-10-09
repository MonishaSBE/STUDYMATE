const express = require('express');
const router = express.Router();
const db = require('../mockDb');
const auth = require('../middleware/authenticate');

router.get('/:id', auth, (req, res) => {
    const me = db.profiles.find(p => p.id == req.params.id);
    if (!me) return res.json({ status: 'success', data: [] });

    const others = db.profiles.filter(p => p.department === me.department && p.id != req.params.id);
    let matches = [];
    
    for (let other of others) {
        const shared = other.subjects.filter(s => me.subjects.includes(s));
        matches.push({
            student_id: other.id,
            name: other.name,
            department: other.department,
            year: other.academic_year,
            available_time: other.available_time,
            shared_subjects: shared,
            match_score: shared.length * 10
        });
    }
    
    matches.sort((a,b) => b.match_score - a.match_score);
    res.json({ status: 'success', data: matches });
});

module.exports = router;
