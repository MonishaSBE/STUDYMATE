const express = require('express');
const router = express.Router();
const db = require('../mockDb');
const auth = require('../middleware/authenticate');

router.post('/', auth, (req, res) => {
    const { name, department, year, bio, available_time, subjects } = req.body;
    let profile = db.profiles.find(p => p.user_id === req.session.userId);
    
    if (profile) {
        profile.name = name;
        profile.department = department;
        profile.academic_year = year;
        profile.bio = bio;
        profile.available_time = available_time;
        profile.subjects = subjects || [];
    } else {
        profile = {
            id: db.nextId++,
            user_id: req.session.userId,
            name, department, academic_year: year, bio, available_time, subjects: subjects || []
        };
        db.profiles.push(profile);
    }
    res.json({ status: 'success', data: { student_id: profile.id } });
});

router.get('/:id', auth, (req, res) => {
    const profile = db.profiles.find(p => p.id == req.params.id);
    if (!profile) return res.status(404).json({ status: 'failure', message: 'Not found' });
    res.json({ status: 'success', data: profile });
});

module.exports = router;
