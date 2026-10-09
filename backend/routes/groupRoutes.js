const express = require('express');
const router = express.Router();
const db = require('../mockDb');
const auth = require('../middleware/authenticate');

router.post('/', auth, (req, res) => {
    const { group_name, description, max_members, created_by } = req.body;
    const newGroup = {
        ROWID: db.nextId++,
        group_name, description, max_members, created_by,
        members: [created_by]
    };
    db.groups.push(newGroup);
    res.json({ status: 'success', data: { id: newGroup.ROWID } });
});

router.get('/', auth, (req, res) => {
    res.json({ status: 'success', data: db.groups });
});

router.post('/:id/join', auth, (req, res) => {
    const { student_id } = req.body;
    const group = db.groups.find(g => g.ROWID == req.params.id);
    
    if (!group) return res.status(404).json({ status: 'failure', message: 'Group not found' });
    if (group.members.length >= group.max_members) return res.status(400).json({ status: 'failure', message: 'Group is full' });
    if (!group.members.includes(student_id)) group.members.push(student_id);
    
    res.json({ status: 'success' });
});

module.exports = router;
