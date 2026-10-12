const express = require('express');
const router = express.Router();
const auth = require('../middleware/authenticate');
const adminOnly = require('../middleware/adminOnly');
const db = require('../mockDb');
const { fallbackData } = require('../services/storageAdapter');

// Ensure storage container exists
if (!fallbackData.support_queries) {
    fallbackData.support_queries = [];
}

// -------------------------------------------------------------
// STUDENT ENDPOINTS: STRICT PRIVACY (OWNER-ONLY VISIBILITY)
// -------------------------------------------------------------

// 1. GET /api/community/queries - List ONLY current student's queries
router.get('/queries', auth, (req, res) => {
    try {
        const userId = req.session.userId;
        // Strictly filter to owner
        const myQueries = fallbackData.support_queries
            .filter(q => q.user_id === userId)
            .map(q => ({
                id: q.id,
                title: q.title,
                description: q.description,
                category: q.category,
                status: q.status,
                created_at: q.created_at,
                updated_at: q.updated_at,
                response_count: (q.responses || []).length,
                has_admin_response: (q.responses || []).some(r => r.sender_role === 'admin')
            }));

        // Sort newest first
        myQueries.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        res.json({ status: 'success', data: myQueries });
    } catch (err) {
        res.status(500).json({ status: 'failure', message: err.message });
    }
});

// 2. GET /api/community/queries/:id - Retrieve single query (Student owner only; internal notes stripped)
router.get('/queries/:id', auth, (req, res) => {
    try {
        const id = Number(req.params.id);
        const userId = req.session.userId;
        const q = fallbackData.support_queries.find(item => item.id === id);

        if (!q) {
            return res.status(404).json({ status: 'failure', message: 'Query not found' });
        }

        // STRICT SECURITY: Non-admin users can ONLY read their own query
        const user = db.users.find(u => u.id === userId);
        const isAdmin = (req.session.role === 'admin') || (user?.role === 'admin');

        if (!isAdmin && q.user_id !== userId) {
            return res.status(403).json({ 
                status: 'failure', 
                message: 'Access denied: You do not have permission to access another student’s private query' 
            });
        }

        // Strip internal_notes if viewer is not admin
        const sanitized = {
            id: q.id,
            user_id: q.user_id,
            student_name: q.student_name,
            student_email: isAdmin ? q.student_email : undefined,
            title: q.title,
            description: q.description,
            category: q.category,
            status: q.status,
            attachment_name: q.attachment_name,
            created_at: q.created_at,
            updated_at: q.updated_at,
            responses: q.responses || [],
            internal_notes: isAdmin ? (q.internal_notes || []) : undefined
        };

        res.json({ status: 'success', data: sanitized });
    } catch (err) {
        res.status(500).json({ status: 'failure', message: err.message });
    }
});

// 3. POST /api/community/queries - Submit a new private student query
router.post('/queries', auth, (req, res) => {
    try {
        const { title, description, category = 'academic_doubt' } = req.body;
        if (!title || !description) {
            return res.status(400).json({ status: 'failure', message: 'Title and detailed description are required' });
        }

        const studentProfile = db.profiles.find(p => p.user_id === req.session.userId);
        const studentName = studentProfile?.name || req.session.email.split('@')[0];

        const newQuery = {
            id: fallbackData.nextId++,
            user_id: req.session.userId,
            student_name: studentName,
            student_email: req.session.email,
            title: title.trim(),
            description: description.trim(),
            category,
            status: 'open',
            attachment_name: null,
            attachment_path: null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            responses: [],
            internal_notes: []
        };

        fallbackData.support_queries.unshift(newQuery);
        res.status(201).json({ status: 'success', message: 'Query submitted successfully', data: newQuery });
    } catch (err) {
        res.status(500).json({ status: 'failure', message: err.message });
    }
});

// 4. POST /api/community/queries/:id/follow-up - Student or Admin message on query thread
router.post('/queries/:id/messages', auth, (req, res) => {
    try {
        const id = Number(req.params.id);
        const { message } = req.body;
        if (!message || !message.trim()) {
            return res.status(400).json({ status: 'failure', message: 'Message content is required' });
        }

        const q = fallbackData.support_queries.find(item => item.id === id);
        if (!q) return res.status(404).json({ status: 'failure', message: 'Query not found' });

        const user = db.users.find(u => u.id === req.session.userId);
        const isAdmin = (req.session.role === 'admin') || (user?.role === 'admin');

        // Security check
        if (!isAdmin && q.user_id !== req.session.userId) {
            return res.status(403).json({ status: 'failure', message: 'Unauthorized: Cannot post to another student\'s query' });
        }

        const studentProfile = db.profiles.find(p => p.user_id === req.session.userId);
        const senderName = isAdmin ? 'Academic Administrator' : (studentProfile?.name || req.session.email.split('@')[0]);

        const newMsg = {
            id: fallbackData.nextId++,
            sender_id: req.session.userId,
            sender_name: senderName,
            sender_role: isAdmin ? 'admin' : 'student',
            message: message.trim(),
            created_at: new Date().toISOString()
        };

        if (!q.responses) q.responses = [];
        q.responses.push(newMsg);
        q.updated_at = new Date().toISOString();

        if (isAdmin) {
            q.status = 'answered';
        } else if (q.status === 'answered') {
            q.status = 'in_progress';
        }

        res.json({ status: 'success', message: 'Message posted', data: newMsg });
    } catch (err) {
        res.status(500).json({ status: 'failure', message: err.message });
    }
});

// 5. PUT /api/community/queries/:id/resolve - Mark query as resolved (Owner or Admin)
router.put('/queries/:id/resolve', auth, (req, res) => {
    try {
        const id = Number(req.params.id);
        const q = fallbackData.support_queries.find(item => item.id === id);
        if (!q) return res.status(404).json({ status: 'failure', message: 'Query not found' });

        const user = db.users.find(u => u.id === req.session.userId);
        const isAdmin = (req.session.role === 'admin') || (user?.role === 'admin');

        if (!isAdmin && q.user_id !== req.session.userId) {
            return res.status(403).json({ status: 'failure', message: 'Unauthorized' });
        }

        q.status = 'resolved';
        q.updated_at = new Date().toISOString();
        res.json({ status: 'success', message: 'Query marked as resolved' });
    } catch (err) {
        res.status(500).json({ status: 'failure', message: err.message });
    }
});

// -------------------------------------------------------------
// ADMIN-ONLY ENDPOINTS: RESTRICTED TO VERIFIED ADMINS
// -------------------------------------------------------------

// 6. GET /api/community/admin/queries - View all submitted student queries
router.get('/admin/queries', auth, adminOnly, (req, res) => {
    try {
        const { category, status, search } = req.query;
        let list = [...fallbackData.support_queries];

        if (category) {
            list = list.filter(q => q.category === category);
        }

        if (status) {
            list = list.filter(q => q.status === status);
        }

        if (search) {
            const sLower = search.toLowerCase();
            list = list.filter(q => 
                q.title.toLowerCase().includes(sLower) ||
                q.description.toLowerCase().includes(sLower) ||
                q.student_name.toLowerCase().includes(sLower) ||
                q.student_email.toLowerCase().includes(sLower)
            );
        }

        list.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        res.json({ status: 'success', data: list });
    } catch (err) {
        res.status(500).json({ status: 'failure', message: err.message });
    }
});

// 7. PUT /api/community/admin/queries/:id/status - Update query status
router.put('/admin/queries/:id/status', auth, adminOnly, (req, res) => {
    try {
        const id = Number(req.params.id);
        const { status } = req.body;
        const validStatuses = ['open', 'in_progress', 'waiting_for_student', 'answered', 'resolved', 'closed'];

        if (!validStatuses.includes(status)) {
            return res.status(400).json({ status: 'failure', message: 'Invalid status' });
        }

        const q = fallbackData.support_queries.find(item => item.id === id);
        if (!q) return res.status(404).json({ status: 'failure', message: 'Query not found' });

        q.status = status;
        q.updated_at = new Date().toISOString();
        res.json({ status: 'success', message: `Query status updated to ${status}`, data: q });
    } catch (err) {
        res.status(500).json({ status: 'failure', message: err.message });
    }
});

// 8. POST /api/community/admin/queries/:id/notes - Add internal administrative note (never exposed to student)
router.post('/admin/queries/:id/notes', auth, adminOnly, (req, res) => {
    try {
        const id = Number(req.params.id);
        const { note } = req.body;
        if (!note || !note.trim()) {
            return res.status(400).json({ status: 'failure', message: 'Note text is required' });
        }

        const q = fallbackData.support_queries.find(item => item.id === id);
        if (!q) return res.status(404).json({ status: 'failure', message: 'Query not found' });

        const adminUser = db.users.find(u => u.id === req.session.userId);
        const newNote = {
            id: fallbackData.nextId++,
            admin_id: req.session.userId,
            admin_name: adminUser?.email.split('@')[0] || 'Administrator',
            note: note.trim(),
            created_at: new Date().toISOString()
        };

        if (!q.internal_notes) q.internal_notes = [];
        q.internal_notes.push(newNote);

        res.json({ status: 'success', message: 'Internal note saved', data: newNote });
    } catch (err) {
        res.status(500).json({ status: 'failure', message: err.message });
    }
});

// 9. Preserved legacy compatibility route for GET /questions
router.get('/questions', auth, (req, res) => {
    res.json({ status: 'success', data: fallbackData.support_queries.filter(q => q.user_id === req.session.userId) });
});

module.exports = router;
