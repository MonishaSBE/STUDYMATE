const express = require('express');
const router = express.Router();
const db = require('../mockDb');
const auth = require('../middleware/authenticate');

router.post('/', auth, async (req, res) => {
    try {
        const { group_name, description, max_members, created_by } = req.body;
        if (!group_name) return res.status(400).json({ status: 'failure', message: 'Group name required' });
        
        const newGroup = {
            ROWID: db.nextId++,
            group_name,
            description: description || '',
            max_members: Number(max_members) || 6,
            created_by: created_by || req.session.userId,
            members: [created_by || req.session.userId]
        };
        await db.saveGroup(newGroup);
        res.json({ status: 'success', data: { id: newGroup.ROWID, group: newGroup } });
    } catch (err) {
        res.status(500).json({ status: 'failure', message: err.message });
    }
});

router.get('/', auth, (req, res) => {
    res.json({ status: 'success', data: db.groups });
});

router.post('/:id/join', auth, async (req, res) => {
    try {
        const { student_id } = req.body;
        const group = db.groups.find(g => g.ROWID == req.params.id);
        
        if (!group) return res.status(404).json({ status: 'failure', message: 'Group not found' });
        if (group.members.length >= group.max_members) return res.status(400).json({ status: 'failure', message: 'Group is full' });
        if (!group.members.includes(student_id)) {
            group.members.push(student_id);
            await db.saveGroup(group);
        }
        
        res.json({ status: 'success', data: group });
    } catch (err) {
        res.status(500).json({ status: 'failure', message: err.message });
    }
});

module.exports = router;
