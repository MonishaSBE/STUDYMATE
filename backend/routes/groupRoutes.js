const express = require('express');
const router = express.Router();
const db = require('../mockDb');
const auth = require('../middleware/authenticate');
const { fallbackData } = require('../services/storageAdapter');

// Helper: Ensure conversations array exists
function getConversations() {
    if (!fallbackData.conversations) fallbackData.conversations = [];
    return fallbackData.conversations;
}

// 1. Create a study group & automatically provision a group chat room
router.post('/', auth, async (req, res) => {
    try {
        const { group_name, description, max_members, created_by } = req.body;
        if (!group_name) return res.status(400).json({ status: 'failure', message: 'Group name required' });
        
        const studentProfile = db.profiles.find(p => p.user_id === req.session.userId);
        const creatorId = studentProfile ? studentProfile.id : (created_by || req.session.userId);

        const newGroup = {
            ROWID: db.nextId++,
            group_name,
            description: description || '',
            max_members: Number(max_members) || 6,
            created_by: creatorId,
            members: [creatorId]
        };
        await db.saveGroup(newGroup);

        // Auto-create associated group conversation in chat engine
        const convs = getConversations();
        const convId = fallbackData.nextId++;
        const newConv = {
            id: convId,
            type: 'group',
            group_id: newGroup.ROWID,
            title: newGroup.group_name,
            description: newGroup.description,
            participants: [creatorId],
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };
        convs.push(newConv);

        res.json({ status: 'success', data: { id: newGroup.ROWID, group: newGroup, conversation_id: convId } });
    } catch (err) {
        res.status(500).json({ status: 'failure', message: err.message });
    }
});

// 2. List all study groups with current user's membership flag
router.get('/', auth, (req, res) => {
    const studentProfile = db.profiles.find(p => p.user_id === req.session.userId);
    const myId = studentProfile ? studentProfile.id : null;

    const enriched = (db.groups || []).map(g => {
        const isMember = myId ? (g.members || []).includes(myId) : false;
        return {
            ...g,
            is_member: isMember,
            member_count: (g.members || []).length
        };
    });

    res.json({ status: 'success', data: enriched });
});

// 3. Join a study group & auto-enroll in group chat room
router.post('/:id/join', auth, async (req, res) => {
    try {
        const groupId = req.params.id;
        const studentProfile = db.profiles.find(p => p.user_id === req.session.userId);
        const studentId = studentProfile ? studentProfile.id : (Number(req.body.student_id) || req.session.userId);

        const group = db.groups.find(g => g.ROWID == groupId || g.id == groupId);
        if (!group) return res.status(404).json({ status: 'failure', message: 'Study group not found' });
        
        if (!group.members) group.members = [];
        
        if (!group.members.includes(studentId)) {
            if (group.members.length >= (group.max_members || 6)) {
                return res.status(400).json({ status: 'failure', message: 'Study group is full' });
            }
            group.members.push(studentId);
            await db.saveGroup(group);
        }

        // Sync membership into group chat room
        const convs = getConversations();
        let conv = convs.find(c => c.type === 'group' && String(c.group_id) === String(group.ROWID));
        if (!conv) {
            conv = {
                id: fallbackData.nextId++,
                type: 'group',
                group_id: group.ROWID,
                title: group.group_name,
                description: group.description,
                participants: [...group.members],
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            };
            convs.push(conv);
        } else {
            if (!conv.participants.includes(studentId)) {
                conv.participants.push(studentId);
            }
            conv.updated_at = new Date().toISOString();
        }

        res.json({ status: 'success', data: group, conversation_id: conv.id });
    } catch (err) {
        res.status(500).json({ status: 'failure', message: err.message });
    }
});

// 4. Leave study group
router.post('/:id/leave', auth, async (req, res) => {
    try {
        const groupId = req.params.id;
        const studentProfile = db.profiles.find(p => p.user_id === req.session.userId);
        const studentId = studentProfile ? studentProfile.id : req.session.userId;

        const group = db.groups.find(g => g.ROWID == groupId || g.id == groupId);
        if (!group) return res.status(404).json({ status: 'failure', message: 'Study group not found' });

        if (group.members) {
            group.members = group.members.filter(m => m !== studentId);
            await db.saveGroup(group);
        }

        const convs = getConversations();
        const conv = convs.find(c => c.type === 'group' && String(c.group_id) === String(group.ROWID));
        if (conv) {
            conv.participants = conv.participants.filter(p => p !== studentId);
        }

        res.json({ status: 'success', message: 'Left study group', data: group });
    } catch (err) {
        res.status(500).json({ status: 'failure', message: err.message });
    }
});

module.exports = router;
