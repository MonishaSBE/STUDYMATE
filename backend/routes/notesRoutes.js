const express = require('express');
const router = express.Router();
const db = require('../mockDb');
const auth = require('../middleware/authenticate');

router.post('/', auth, (req, res) => {
    const { group_id, uploaded_by, title, file_url } = req.body;
    const uploader = db.profiles.find(p => p.id == uploaded_by);
    
    db.notes.push({
        ROWID: db.nextId++,
        group_id, uploaded_by, title, file_url,
        uploader_name: uploader?.name
    });
    res.json({ status: 'success' });
});

router.get('/:groupId', auth, (req, res) => {
    const notes = db.notes.filter(n => n.group_id == req.params.groupId);
    res.json({ status: 'success', data: notes });
});

module.exports = router;
