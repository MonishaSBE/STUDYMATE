const express = require('express');
const router = express.Router();
const db = require('../mockDb');
const auth = require('../middleware/authenticate');

router.post('/', auth, (req, res) => {
    const { sender_id, receiver_id } = req.body;
    if (sender_id === receiver_id) return res.status(400).json({ status: 'failure', message: 'Cannot request yourself' });
    
    const exists = db.requests.find(r => r.sender_id == sender_id && r.receiver_id == receiver_id);
    if (!exists) {
        const sender = db.profiles.find(p => p.id == sender_id);
        const receiver = db.profiles.find(p => p.id == receiver_id);
        db.requests.push({
            ROWID: db.nextId++,
            sender_id, receiver_id, status: 'pending',
            sender_name: sender?.name,
            receiver_name: receiver?.name
        });
    }
    res.json({ status: 'success' });
});

router.get('/:id', auth, (req, res) => {
    const studentId = req.params.id;
    const incoming = db.requests.filter(r => r.receiver_id == studentId);
    const outgoing = db.requests.filter(r => r.sender_id == studentId);
    res.json({ status: 'success', data: { incoming, outgoing } });
});

router.put('/:id', auth, (req, res) => {
    const { status } = req.body;
    const reqItem = db.requests.find(r => r.ROWID == req.params.id);
    if (reqItem) reqItem.status = status;
    res.json({ status: 'success' });
});

module.exports = router;
