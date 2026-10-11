const express = require('express');
const router = express.Router();
const auth = require('../middleware/authenticate');
const adminOnly = require('../middleware/adminOnly');
const { fallbackData, isMySqlAvailable, pool } = require('../services/storageAdapter');

// 1. Get Academic Domains List
router.get('/domains', auth, async (req, res) => {
    try {
        const domains = fallbackData.academic_domains || [];
        res.json({ status: 'success', data: domains });
    } catch (err) {
        res.status(500).json({ status: 'failure', message: err.message });
    }
});

// 2. Search & Filter All Courses Across Domains & Institutions
router.get('/courses', auth, async (req, res) => {
    try {
        const { search, domain, academic_level, semester } = req.query;
        let list = [...fallbackData.courses];

        if (search) {
            const sLower = search.toLowerCase();
            list = list.filter(c => 
                c.course_name.toLowerCase().includes(sLower) ||
                (c.course_code && c.course_code.toLowerCase().includes(sLower)) ||
                (c.description && c.description.toLowerCase().includes(sLower))
            );
        }

        if (domain) {
            list = list.filter(c => c.domain && c.domain.toLowerCase() === domain.toLowerCase());
        }

        if (academic_level) {
            list = list.filter(c => c.academic_level && c.academic_level.toLowerCase() === academic_level.toLowerCase());
        }

        if (semester) {
            list = list.filter(c => c.semester === Number(semester));
        }

        // Enrich with counts of available materials, quizzes, and flashcards
        const enriched = list.map(c => {
            const matCount = fallbackData.materials.filter(m => m.course_id === c.id || (m.subject_name && m.subject_name.toLowerCase() === c.course_name.toLowerCase())).length;
            const quizCount = fallbackData.quizzes.filter(q => q.subject && q.subject.toLowerCase() === c.course_name.toLowerCase()).length;
            const fcCount = fallbackData.flashcard_decks.filter(f => f.subject && f.subject.toLowerCase() === c.course_name.toLowerCase()).length;
            return {
                ...c,
                materials_count: matCount,
                quizzes_count: quizCount,
                flashcards_count: fcCount
            };
        });

        res.json({ status: 'success', data: enriched });
    } catch (err) {
        res.status(500).json({ status: 'failure', message: err.message });
    }
});

// 3. Admin: Add New Course to Catalogue
router.post('/courses', auth, adminOnly, async (req, res) => {
    try {
        const { course_name, course_code, domain, department_name, semester = 1, academic_level = 'Undergraduate', description } = req.body;
        if (!course_name || !course_code) {
            return res.status(400).json({ status: 'failure', message: 'Course name and code are required' });
        }

        const newCourse = {
            id: fallbackData.nextId++,
            department_id: 1,
            course_name: course_name.trim(),
            course_code: course_code.trim(),
            domain: domain || 'Computer Science and Engineering',
            department_name: department_name || 'Engineering',
            semester: Number(semester) || 1,
            academic_year: `${Math.ceil((Number(semester) || 1) / 2)}th Year`,
            academic_level: academic_level || 'Undergraduate',
            description: description ? description.trim() : `Curriculum module in ${domain || 'Engineering'}.`,
            created_at: new Date().toISOString()
        };

        fallbackData.courses.push(newCourse);
        res.json({ status: 'success', message: 'Course added to catalogue', data: newCourse });
    } catch (err) {
        res.status(500).json({ status: 'failure', message: err.message });
    }
});

// 4. Preserved: Get all institutions
router.get('/institutions', auth, async (req, res) => {
    res.json({ status: 'success', data: fallbackData.institutions });
});

// 5. Preserved: Get departments for an institution
router.get('/institutions/:id/departments', auth, async (req, res) => {
    const instId = Number(req.params.id);
    const depts = fallbackData.departments.filter(d => d.institution_id === instId);
    res.json({ status: 'success', data: depts });
});

// 6. Preserved: Get courses by department and semester
router.get('/departments/:deptId/courses', auth, async (req, res) => {
    const deptId = Number(req.params.deptId);
    const semester = req.query.semester ? Number(req.query.semester) : null;
    let courses = fallbackData.courses.filter(c => c.department_id === deptId);
    if (semester) courses = courses.filter(c => c.semester === semester);
    res.json({ status: 'success', data: courses });
});

// 7. Get specific course details with connected materials, quizzes, and flashcards
router.get('/courses/:courseId', auth, async (req, res) => {
    const courseId = Number(req.params.courseId);
    const course = fallbackData.courses.find(c => c.id === courseId);
    if (!course) {
        return res.status(404).json({ status: 'failure', message: 'Course not found' });
    }

    const materials = fallbackData.materials.filter(m => m.course_id === courseId || (m.subject_name && m.subject_name.toLowerCase() === course.course_name.toLowerCase()));
    const quizzes = fallbackData.quizzes.filter(q => q.subject && q.subject.toLowerCase() === course.course_name.toLowerCase());
    const flashcards = fallbackData.flashcard_decks.filter(f => f.subject && f.subject.toLowerCase() === course.course_name.toLowerCase());

    res.json({
        status: 'success',
        data: {
            course,
            materials,
            quizzes,
            flashcards
        }
    });
});

module.exports = router;
