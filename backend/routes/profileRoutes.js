const express = require('express');
const router = express.Router();
const db = require('../mockDb');
const auth = require('../middleware/authenticate');

router.post('/', auth, async (req, res) => {
    try {
        const { name, department, year, bio, available_time, subjects, active_days } = req.body;
        let profile = db.profiles.find(p => p.user_id === req.session.userId);
        
        if (profile) {
            profile.name = name || profile.name;
            profile.department = department || profile.department;
            profile.academic_year = year || profile.academic_year;
            profile.bio = bio || profile.bio;
            profile.available_time = available_time || profile.available_time;
            profile.subjects = Array.isArray(subjects) ? subjects : profile.subjects;
            if (active_days) profile.active_days = Array.isArray(active_days) ? active_days : profile.active_days;
            await db.saveProfile(profile);
        } else {
            profile = {
                id: db.nextId++,
                user_id: req.session.userId,
                name: name || req.session.email.split('@')[0],
                department: department || 'General',
                academic_year: year || '1st Year',
                bio: bio || '',
                available_time: available_time || 'Flexible',
                subjects: Array.isArray(subjects) ? subjects : [],
                active_days: Array.isArray(active_days) ? active_days : ['Mon', 'Wed', 'Fri', 'Sat']
            };
            await db.saveProfile(profile);
        }

        // Also update name on user record
        const user = db.users.find(u => u.id === req.session.userId);
        if (user && name) {
            user.name = name;
            await db.saveUser(user);
        }

        res.json({ status: 'success', data: { student_id: profile.id, profile } });
    } catch (err) {
        res.status(500).json({ status: 'failure', message: err.message });
    }
});

router.get('/:id', auth, (req, res) => {
    const profile = db.profiles.find(p => p.id == req.params.id);
    if (!profile) return res.status(404).json({ status: 'failure', message: 'Profile not found' });
    res.json({ status: 'success', data: profile });
});

module.exports = router;
