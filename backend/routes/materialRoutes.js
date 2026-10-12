const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const db = require('../mockDb');
const auth = require('../middleware/authenticate');
const { Material } = require('../models');
const { isMongoConnected } = require('../config/mongodb');
const { fallbackData, isMySqlAvailable, pool } = require('../services/storageAdapter');
const { UPLOADS_DIR, MAX_FILE_SIZE_BYTES, sanitizeFilename, isValidFileType } = require('../config/storage');

// Configure Multer for secure file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, UPLOADS_DIR);
    },
    filename: (req, file, cb) => {
        cb(null, sanitizeFilename(file.originalname));
    }
});

const upload = multer({
    storage,
    limits: { fileSize: MAX_FILE_SIZE_BYTES },
    fileFilter: (req, file, cb) => {
        if (isValidFileType(file.originalname, file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Unsupported file type. Allowed: PDF, TXT, DOCX, PPTX, PNG, JPG'));
        }
    }
});

// 0. Search & Filter Educational Library Books & Reference Materials
router.get('/books', auth, async (req, res) => {
    try {
        const { search, domain, category } = req.query;
        let books = fallbackData.library_books || [];

        if (search) {
            const sLower = search.toLowerCase();
            books = books.filter(b => 
                b.title.toLowerCase().includes(sLower) ||
                b.author.toLowerCase().includes(sLower) ||
                (b.description && b.description.toLowerCase().includes(sLower)) ||
                (b.category && b.category.toLowerCase().includes(sLower)) ||
                (b.subject && b.subject.toLowerCase().includes(sLower))
            );
        }

        if (domain) {
            books = books.filter(b => b.domain && b.domain.toLowerCase() === domain.toLowerCase());
        }

        if (category) {
            books = books.filter(b => b.category && b.category.toLowerCase() === category.toLowerCase());
        }

        const enriched = books.map(b => ({
            ...b,
            is_bookmarked: (fallbackData.bookmarks || []).some(bk => bk.user_id === req.session.userId && bk.book_id === b.id)
        }));

        res.json({ status: 'success', data: enriched });
    } catch (err) {
        res.status(500).json({ status: 'failure', message: err.message });
    }
});

// 1. Search & Filter Study Materials & Library Books
router.get('/', auth, async (req, res) => {
    try {
        if (isMongoConnected()) {
            try {
                const dbMaterials = await Material.find({}).lean();
                if (dbMaterials && dbMaterials.length > 0) {
                    dbMaterials.forEach(dm => {
                        if (!fallbackData.materials.some(m => m.id === dm.id)) {
                            fallbackData.materials.unshift(dm);
                        }
                    });
                }
            } catch (err) {
                console.error('[MongoDB] Error loading materials:', err.message);
            }
        }

        const { search, course_id, subject, resource_type, domain, category, sort } = req.query;
        let materials = [...fallbackData.materials];

        if (search) {
            const sLower = search.toLowerCase();
            materials = materials.filter(m =>
                m.title.toLowerCase().includes(sLower) ||
                (m.description && m.description.toLowerCase().includes(sLower)) ||
                (m.subject_name && m.subject_name.toLowerCase().includes(sLower)) ||
                (m.author && m.author.toLowerCase().includes(sLower)) ||
                (m.publisher && m.publisher.toLowerCase().includes(sLower)) ||
                (m.domain && m.domain.toLowerCase().includes(sLower)) ||
                (m.tags && m.tags.some(t => t.toLowerCase().includes(sLower)))
            );
        }

        if (domain) {
            materials = materials.filter(m => m.domain && m.domain.toLowerCase() === domain.toLowerCase());
        }

        if (category) {
            materials = materials.filter(m => m.category && m.category.toLowerCase() === category.toLowerCase());
        }

        if (course_id) {
            materials = materials.filter(m => m.course_id === Number(course_id));
        }

        if (subject) {
            materials = materials.filter(m => m.subject_name && m.subject_name.toLowerCase().includes(subject.toLowerCase()));
        }

        if (resource_type) {
            materials = materials.filter(m => m.resource_type === resource_type);
        }

        // Sorting
        if (sort === 'newest') {
            materials.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        } else if (sort === 'views') {
            materials.sort((a, b) => b.views_count - a.views_count);
        } else if (sort === 'rating') {
            materials.sort((a, b) => {
                const avgA = getAvgRating(a.id);
                const avgB = getAvgRating(b.id);
                return avgB - avgA;
            });
        }

        // Attach ratings and bookmark status for the current user
        const enriched = materials.map(m => ({
            ...m,
            average_rating: getAvgRating(m.id),
            total_ratings: fallbackData.ratings.filter(r => r.material_id === m.id).length,
            is_bookmarked: fallbackData.bookmarks.some(b => b.user_id === req.session.userId && b.material_id === m.id)
        }));

        res.json({ status: 'success', data: enriched });
    } catch (err) {
        res.status(500).json({ status: 'failure', message: err.message });
    }
});

function getAvgRating(materialId) {
    const ratings = fallbackData.ratings.filter(r => r.material_id === materialId);
    if (!ratings.length) return 0;
    const sum = ratings.reduce((acc, r) => acc + r.rating, 0);
    return Number((sum / ratings.length).toFixed(1));
}

// 2. Get Single Material Details & Increment View Count
router.get('/:id', auth, async (req, res) => {
    const id = Number(req.params.id);
    const material = fallbackData.materials.find(m => m.id === id);
    if (!material) {
        return res.status(404).json({ status: 'failure', message: 'Material not found' });
    }

    material.views_count = (material.views_count || 0) + 1;
    const ratings = fallbackData.ratings.filter(r => r.material_id === id);
    const isBookmarked = fallbackData.bookmarks.some(b => b.user_id === req.session.userId && b.material_id === id);

    res.json({
        status: 'success',
        data: {
            ...material,
            average_rating: getAvgRating(id),
            ratings,
            is_bookmarked: isBookmarked
        }
    });
});

// 3. Document Upload (Feature Module 3)
router.post('/upload', auth, upload.single('document'), async (req, res) => {
    try {
        const {
            title,
            description,
            course_id,
            subject_name,
            resource_type,
            examination_type,
            tags
        } = req.body;

        if (!title || !subject_name) {
            return res.status(400).json({ status: 'failure', message: 'Title and Subject Name are required' });
        }

        const parsedTags = tags ? tags.split(',').map(t => t.trim()).filter(Boolean) : [];
        const file = req.file;

        const newMaterial = {
            id: fallbackData.nextId++,
            title: title.trim(),
            description: description ? description.trim() : '',
            course_id: course_id ? Number(course_id) : null,
            institution_id: 1, // Default RMKCET
            subject_name: subject_name.trim(),
            resource_type: resource_type || 'lecture_notes',
            examination_type: examination_type || 'University Semester Exam',
            file_path: file ? file.path : null,
            file_name: file ? file.filename : 'Notes_Text_Document.txt',
            file_size: file ? file.size : 1024,
            mime_type: file ? file.mimetype : 'text/plain',
            uploaded_by: req.session.userId,
            uploader_name: req.session.email || 'Student',
            views_count: 1,
            downloads_count: 0,
            is_moderated: true,
            tags: parsedTags,
            created_at: new Date().toISOString()
        };

        fallbackData.materials.unshift(newMaterial);

        if (isMongoConnected()) {
            try {
                await Material.findOneAndUpdate({ id: newMaterial.id }, newMaterial, { upsert: true, new: true });
            } catch (mongoErr) {
                console.error('[MongoDB] Error saving Material to Atlas:', mongoErr.message);
            }
        }

        res.json({
            status: 'success',
            message: 'Document uploaded successfully',
            data: newMaterial
        });
    } catch (err) {
        res.status(500).json({ status: 'failure', message: err.message });
    }
});

// 4. Secure File Download
router.get('/:id/download', auth, (req, res) => {
    try {
        let rawId = req.params.id;
        let numId = Number(String(rawId).replace('mat_', ''));
        const material = fallbackData.materials.find(m => m.id == numId || m.id == rawId);
        const note = db.notes ? db.notes.find(n => n.ROWID == rawId || n.ROWID == numId || n.id == rawId || n.id == numId) : null;
        const item = material || note;

        if (!item) {
            res.setHeader('Content-Type', 'text/plain; charset=utf-8');
            return res.status(404).send('StudyMate Error: The requested material was not found.');
        }

        if (material) {
            material.downloads_count = (material.downloads_count || 0) + 1;
        }

        const filePath = item.file_path;
        if (filePath && fs.existsSync(filePath)) {
            const fileName = item.file_name || `${(item.title || 'Material').replace(/[^a-zA-Z0-9_\-\.]/g, '_')}${path.extname(filePath) || '.pdf'}`;
            return res.download(filePath, fileName);
        }

        if (item.file_url && item.file_url !== '#') {
            return res.redirect(item.file_url);
        }

        // If simulated or text-only document, serve formatted readable document (.txt) with proper headers
        const safeTitle = (item.title || 'StudyMate_Document').replace(/[^a-zA-Z0-9_\-]/g, '_');
        res.setHeader('Content-Disposition', `attachment; filename="${safeTitle}.txt"`);
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        return res.send(`=========================================\nStudyMate Academic Resource\n=========================================\n\nTitle: ${item.title}\nSubject: ${item.subject_name || item.subject || 'General'}\nDomain: ${item.domain || 'Academic'}\nUploaded by: ${item.uploader_name || 'Student'}\nDate: ${new Date(item.created_at || Date.now()).toLocaleDateString()}\n\nContent & Summary:\n${item.description || 'No additional content provided.'}\n`);
    } catch (err) {
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.status(500).send('Error downloading file: ' + err.message);
    }
});

// 5. Toggle Bookmark (Feature Module 9)
router.post('/:id/bookmark', auth, (req, res) => {
    const materialId = Number(req.params.id);
    const userId = req.session.userId;
    const existingIndex = fallbackData.bookmarks.findIndex(b => b.user_id === userId && b.material_id === materialId);

    if (existingIndex >= 0) {
        fallbackData.bookmarks.splice(existingIndex, 1);
        res.json({ status: 'success', bookmarked: false, message: 'Bookmark removed' });
    } else {
        fallbackData.bookmarks.push({
            id: fallbackData.nextId++,
            user_id: userId,
            material_id: materialId,
            created_at: new Date().toISOString()
        });
        res.json({ status: 'success', bookmarked: true, message: 'Bookmark saved' });
    }
});

// 6. Rate Material (Feature Module 9)
router.post('/:id/rate', auth, (req, res) => {
    const materialId = Number(req.params.id);
    const userId = req.session.userId;
    const { rating, review } = req.body;

    const numRating = Number(rating);
    if (!numRating || numRating < 1 || numRating > 5) {
        return res.status(400).json({ status: 'failure', message: 'Rating must be between 1 and 5' });
    }

    const existing = fallbackData.ratings.find(r => r.user_id === userId && r.material_id === materialId);
    if (existing) {
        existing.rating = numRating;
        existing.review = review || '';
    } else {
        fallbackData.ratings.push({
            id: fallbackData.nextId++,
            user_id: userId,
            material_id: materialId,
            rating: numRating,
            review: review || '',
            created_at: new Date().toISOString()
        });
    }

    res.json({ status: 'success', average_rating: getAvgRating(materialId) });
});

// 7. Report Material (Feature Module 9)
router.post('/:id/report', auth, (req, res) => {
    const materialId = Number(req.params.id);
    const userId = req.session.userId;
    const { reason, details } = req.body;

    if (!reason) {
        return res.status(400).json({ status: 'failure', message: 'Reason is required' });
    }

    fallbackData.reports.push({
        id: fallbackData.nextId++,
        user_id: userId,
        material_id: materialId,
        reason,
        details: details || '',
        status: 'pending',
        created_at: new Date().toISOString()
    });

    res.json({ status: 'success', message: 'Report submitted for moderation' });
});

// 8. Delete Own Material
router.delete('/:id', auth, (req, res) => {
    const id = Number(req.params.id);
    const idx = fallbackData.materials.findIndex(m => m.id === id);

    if (idx === -1) {
        return res.status(404).json({ status: 'failure', message: 'Material not found' });
    }

    if (fallbackData.materials[idx].uploaded_by !== req.session.userId) {
        return res.status(403).json({ status: 'failure', message: 'Unauthorized to delete this material' });
    }

    const [deleted] = fallbackData.materials.splice(idx, 1);
    if (deleted.file_path && fs.existsSync(deleted.file_path)) {
        try { fs.unlinkSync(deleted.file_path); } catch (e) { }
    }

    res.json({ status: 'success', message: 'Material deleted' });
});

// 9. Edit Own Material Metadata
router.put('/:id', auth, (req, res) => {
    const id = Number(req.params.id);
    const material = fallbackData.materials.find(m => m.id === id);

    if (!material) {
        return res.status(404).json({ status: 'failure', message: 'Material not found' });
    }

    if (material.uploaded_by !== req.session.userId) {
        return res.status(403).json({ status: 'failure', message: 'Unauthorized: Cannot edit another student\'s material' });
    }

    const { title, description, domain, subject_name, resource_type, tags } = req.body;
    if (title) material.title = title.trim();
    if (description !== undefined) material.description = description.trim();
    if (domain) material.domain = domain;
    if (subject_name) material.subject_name = subject_name.trim();
    if (resource_type) material.resource_type = resource_type;
    if (tags) material.tags = Array.isArray(tags) ? tags : tags.split(',').map(t => t.trim()).filter(Boolean);

    res.json({ status: 'success', message: 'Material updated successfully', data: material });
});

module.exports = router;
