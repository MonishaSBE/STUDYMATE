const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const db = require('../mockDb');
const auth = require('../middleware/authenticate');
const { fallbackData } = require('../services/storageAdapter');
const { UPLOADS_DIR, MAX_FILE_SIZE_BYTES, sanitizeFilename, isValidFileType } = require('../config/storage');

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, UPLOADS_DIR),
    filename: (req, file, cb) => cb(null, sanitizeFilename(file.originalname))
});

const upload = multer({
    storage,
    limits: { fileSize: MAX_FILE_SIZE_BYTES },
    fileFilter: (req, file, cb) => {
        if (isValidFileType(file.originalname, file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Unsupported file format. Permitted: PDF, TXT, DOCX, PPTX, PNG, JPG'));
        }
    }
});

// Helper: Get all authorized notes for current user
function getAllAuthorizedNotes(userId, studentId) {
    // 1. Group notes where user is member
    const userGroups = db.groups.filter(g => (g.members || []).includes(studentId)).map(g => g.ROWID);
    
    // Notes stored in db.notes
    const legacyNotes = (db.notes || []).map(n => {
        const grp = db.groups.find(g => g.ROWID == n.group_id);
        const isGroupMember = n.group_id ? userGroups.includes(Number(n.group_id)) : true;
        return {
            id: n.ROWID,
            title: n.title,
            description: n.description || 'Shared study note',
            group_id: n.group_id || null,
            group_name: grp ? grp.group_name : 'Public / Open Note',
            subject: n.subject || (grp ? grp.subject : 'General Academic'),
            domain: n.domain || 'Computer Science and Engineering',
            academic_year: n.academic_year || '2nd Year',
            resource_type: n.resource_type || 'lecture_notes',
            file_url: n.file_url || null,
            file_path: n.file_path || null,
            file_size: n.file_size || 1024,
            uploaded_by: n.uploaded_by,
            uploader_name: n.uploader_name || 'Classmate',
            visibility: n.visibility || (n.group_id ? 'group_only' : 'public'),
            is_authorized: isGroupMember,
            created_at: n.created_at || new Date().toISOString()
        };
    });

    // Materials stored in fallbackData.materials (contributed materials)
    const libraryMaterials = (fallbackData.materials || []).map(m => ({
        id: `mat_${m.id}`,
        material_ref_id: m.id,
        title: m.title,
        description: m.description,
        group_id: null,
        group_name: 'Academic Library Collection',
        subject: m.subject_name,
        domain: m.domain || 'Computer Science and Engineering',
        academic_year: m.academic_year || 'Undergraduate',
        resource_type: m.resource_type || 'lecture_notes',
        file_url: null,
        file_path: m.file_path,
        file_name: m.file_name,
        file_size: m.file_size || 2048,
        uploaded_by: m.uploaded_by,
        uploader_name: m.uploader_name,
        visibility: 'public',
        is_authorized: true,
        created_at: m.created_at
    }));

    const combined = [...legacyNotes, ...libraryMaterials];
    return combined.filter(n => n.is_authorized);
}

// 1. GET /api/notes/shared - Search, filter, and retrieve all authorized shared notes
router.get('/shared', auth, (req, res) => {
    try {
        const studentProfile = db.profiles.find(p => p.user_id === req.session.userId);
        const studentId = studentProfile ? studentProfile.id : null;
        const { search, domain, subject, resource_type, sort = 'newest' } = req.query;

        let notes = getAllAuthorizedNotes(req.session.userId, studentId);

        if (search) {
            const sLower = search.toLowerCase();
            notes = notes.filter(n => 
                n.title.toLowerCase().includes(sLower) ||
                (n.description && n.description.toLowerCase().includes(sLower)) ||
                (n.subject && n.subject.toLowerCase().includes(sLower)) ||
                (n.uploader_name && n.uploader_name.toLowerCase().includes(sLower))
            );
        }

        if (domain) {
            notes = notes.filter(n => n.domain && n.domain.toLowerCase() === domain.toLowerCase());
        }

        if (subject) {
            notes = notes.filter(n => n.subject && n.subject.toLowerCase().includes(subject.toLowerCase()));
        }

        if (resource_type) {
            notes = notes.filter(n => n.resource_type === resource_type);
        }

        if (sort === 'newest') {
            notes.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        }

        res.json({ status: 'success', data: notes });
    } catch (err) {
        res.status(500).json({ status: 'failure', message: err.message });
    }
});

// 2. GET /api/notes/my-uploads - Notes uploaded by the authenticated student
router.get('/my-uploads', auth, (req, res) => {
    try {
        const studentProfile = db.profiles.find(p => p.user_id === req.session.userId);
        const studentId = studentProfile ? studentProfile.id : null;
        
        const myNotes = (db.notes || []).filter(n => n.uploaded_by === studentId || n.user_id === req.session.userId);
        const myMaterials = (fallbackData.materials || []).filter(m => m.uploaded_by === req.session.userId || m.uploaded_by === studentId);

        const list = [
            ...myNotes.map(n => ({
                id: n.ROWID,
                source: 'shared_note',
                title: n.title,
                description: n.description,
                subject: n.subject,
                domain: n.domain,
                created_at: n.created_at || new Date().toISOString()
            })),
            ...myMaterials.map(m => ({
                id: m.id,
                source: 'material',
                title: m.title,
                description: m.description,
                subject: m.subject_name,
                domain: m.domain,
                created_at: m.created_at
            }))
        ];

        res.json({ status: 'success', data: list });
    } catch (err) {
        res.status(500).json({ status: 'failure', message: err.message });
    }
});

// 3. POST /api/notes - Create/upload note (supports URL or file upload, backward compatible with group notes)
router.post('/', auth, upload.single('document'), (req, res) => {
    try {
        const studentProfile = db.profiles.find(p => p.user_id === req.session.userId);
        const studentId = studentProfile ? studentProfile.id : req.session.userId;
        const { group_id, title, description, domain, subject, academic_year, resource_type, file_url, visibility } = req.body;

        if (!title || !title.trim()) {
            return res.status(400).json({ status: 'failure', message: 'Note title is required' });
        }

        const file = req.file;

        const newNote = {
            ROWID: db.nextId++,
            user_id: req.session.userId,
            group_id: group_id ? Number(group_id) : null,
            uploaded_by: studentId,
            uploader_name: studentProfile?.name || req.session.email.split('@')[0],
            title: title.trim(),
            description: description ? description.trim() : '',
            domain: domain || 'Computer Science and Engineering',
            subject: subject ? subject.trim() : 'General',
            academic_year: academic_year || '2nd Year',
            resource_type: resource_type || 'lecture_notes',
            file_url: file_url || null,
            file_path: file ? file.path : null,
            file_name: file ? file.filename : null,
            file_size: file ? file.size : 0,
            visibility: visibility || (group_id ? 'group_only' : 'public'),
            created_at: new Date().toISOString()
        };

        db.notes.push(newNote);

        // Also make eligible notes visible in Study Library if public
        if (!newNote.group_id && newNote.visibility === 'public') {
            fallbackData.materials.unshift({
                id: fallbackData.nextId++,
                title: newNote.title,
                description: newNote.description,
                subject_name: newNote.subject,
                domain: newNote.domain,
                resource_type: newNote.resource_type,
                file_path: newNote.file_path,
                file_name: newNote.file_name || 'StudyNote.txt',
                file_size: newNote.file_size,
                uploaded_by: req.session.userId,
                uploader_name: newNote.uploader_name,
                views_count: 1,
                downloads_count: 0,
                is_moderated: true,
                created_at: newNote.created_at
            });
        }

        res.json({ status: 'success', message: 'Note shared successfully', data: newNote });
    } catch (err) {
        res.status(500).json({ status: 'failure', message: err.message });
    }
});

// 4. GET /api/notes/download/:id - Access-controlled note download
router.get('/download/:id', auth, (req, res) => {
    try {
        const studentProfile = db.profiles.find(p => p.user_id === req.session.userId);
        const studentId = studentProfile ? studentProfile.id : null;
        const id = req.params.id;

        // Check if material ref
        if (String(id).startsWith('mat_')) {
            const matId = Number(id.replace('mat_', ''));
            const mat = fallbackData.materials.find(m => m.id === matId);
            if (!mat) return res.status(404).json({ status: 'failure', message: 'Resource not found' });
            if (mat.file_path && fs.existsSync(mat.file_path)) {
                return res.download(mat.file_path, mat.file_name || 'StudyMate_Document.pdf');
            }
            res.setHeader('Content-Disposition', `attachment; filename="${mat.file_name || 'StudyMate_Document.txt'}"`);
            return res.send(`Title: ${mat.title}\nSubject: ${mat.subject_name}\nDescription: ${mat.description}`);
        }

        const note = db.notes.find(n => n.ROWID == id);
        if (!note) return res.status(404).json({ status: 'failure', message: 'Note not found' });

        // Enforce group membership if group-restricted
        if (note.group_id) {
            const grp = db.groups.find(g => g.ROWID == note.group_id);
            if (grp && !(grp.members || []).includes(studentId)) {
                return res.status(403).json({ status: 'failure', message: 'Unauthorized: You are not a member of this study group' });
            }
        }

        if (note.file_path && fs.existsSync(note.file_path)) {
            return res.download(note.file_path, note.file_name || `${note.title}.pdf`);
        }

        if (note.file_url) {
            return res.redirect(note.file_url);
        }

        res.setHeader('Content-Disposition', `attachment; filename="${note.title.replace(/\s+/g, '_')}.txt"`);
        res.send(`StudyMate Shared Note\n\nTitle: ${note.title}\nSubject: ${note.subject}\nDescription: ${note.description}\nUploader: ${note.uploader_name}`);
    } catch (err) {
        res.status(500).json({ status: 'failure', message: err.message });
    }
});

// 5. GET /api/notes/:groupId - Preserved legacy group notes endpoint
router.get('/:groupId', auth, (req, res) => {
    const notes = db.notes.filter(n => n.group_id == req.params.groupId);
    res.json({ status: 'success', data: notes });
});

// 6. DELETE /api/notes/:id - Delete own note
router.delete('/:id', auth, (req, res) => {
    const studentProfile = db.profiles.find(p => p.user_id === req.session.userId);
    const studentId = studentProfile ? studentProfile.id : null;
    const id = Number(req.params.id);

    const idx = db.notes.findIndex(n => n.ROWID === id);
    if (idx === -1) return res.status(404).json({ status: 'failure', message: 'Note not found' });

    const note = db.notes[idx];
    if (note.uploaded_by !== studentId && note.user_id !== req.session.userId) {
        return res.status(403).json({ status: 'failure', message: 'Unauthorized: Cannot delete another student\'s note' });
    }

    const [deleted] = db.notes.splice(idx, 1);
    if (deleted.file_path && fs.existsSync(deleted.file_path)) {
        try { fs.unlinkSync(deleted.file_path); } catch (e) {}
    }

    res.json({ status: 'success', message: 'Note deleted' });
});

module.exports = router;
