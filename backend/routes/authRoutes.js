const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const db = require('../mockDb');
const auth = require('../middleware/authenticate');

router.post('/register', async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ status: 'failure', message: 'Email and password required' });
    
    if (db.users.find(u => u.email === email)) {
        return res.status(400).json({ status: 'failure', message: 'Email already registered' });
    }
    
    const hash = await bcrypt.hash(password, 10);
    const role = (email.includes('admin@') || db.users.length === 0) ? 'admin' : 'student';
    const newUser = { id: db.nextId++, email, password_hash: hash, role };
    db.users.push(newUser);
    
    req.session.userId = newUser.id;
    req.session.email = email;
    req.session.role = role;
    res.status(201).json({ status: 'success', data: { userId: newUser.id, role } });
});

router.post('/login', async (req, res) => {
    const { email, password } = req.body;
    const user = db.users.find(u => u.email === email);
    
    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
        return res.status(401).json({ status: 'failure', message: 'Invalid credentials' });
    }
    
    req.session.userId = user.id;
    req.session.email = user.email;
    req.session.role = user.role || 'student';
    res.json({ status: 'success', data: { userId: user.id, role: req.session.role } });
});

router.post('/logout', (req, res) => {
    req.session.destroy();
    res.clearCookie('studymate_session');
    res.json({ status: 'success' });
});

router.get('/me', auth, (req, res) => {
    const user = db.users.find(u => u.id === req.session.userId);
    const profile = db.profiles.find(p => p.user_id === req.session.userId);
    const role = req.session.role || user?.role || 'student';
    res.json({ status: 'success', data: { userId: req.session.userId, email: req.session.email, profileId: profile?.id, role } });
});

module.exports = router;
