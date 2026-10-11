const express = require('express');
const router = express.Router();
const auth = require('../middleware/authenticate');
const { fallbackData, isMySqlAvailable, pool } = require('../services/storageAdapter');

// 1. Get all institutions
router.get('/institutions', auth, async (req, res) => {
    try {
        if (isMySqlAvailable()) {
            const [rows] = await pool.query('SELECT * FROM institutions ORDER BY name ASC');
            if (rows.length > 0) return res.json({ status: 'success', data: rows });
        }
        res.json({ status: 'success', data: fallbackData.institutions });
    } catch (err) {
        res.json({ status: 'success', data: fallbackData.institutions });
    }
});

// 2. Get departments for an institution
router.get('/institutions/:id/departments', auth, async (req, res) => {
    const instId = Number(req.params.id);
    try {
        if (isMySqlAvailable()) {
            const [rows] = await pool.query('SELECT * FROM departments WHERE institution_id = ? ORDER BY name ASC', [instId]);
            if (rows.length > 0) return res.json({ status: 'success', data: rows });
        }
        const depts = fallbackData.departments.filter(d => d.institution_id === instId);
        res.json({ status: 'success', data: depts });
    } catch (err) {
        const depts = fallbackData.departments.filter(d => d.institution_id === instId);
        res.json({ status: 'success', data: depts });
    }
});

// 3. Get courses/subjects by department and optional semester
router.get('/departments/:deptId/courses', auth, async (req, res) => {
    const deptId = Number(req.params.deptId);
    const semester = req.query.semester ? Number(req.query.semester) : null;

    try {
        if (isMySqlAvailable()) {
            let sql = 'SELECT * FROM courses WHERE department_id = ?';
            const params = [deptId];
            if (semester) {
                sql += ' AND semester = ?';
                params.push(semester);
            }
            sql += ' ORDER BY semester ASC, course_name ASC';
            const [rows] = await pool.query(sql, params);
            if (rows.length > 0) return res.json({ status: 'success', data: rows });
        }

        let courses = fallbackData.courses.filter(c => c.department_id === deptId);
        if (semester) {
            courses = courses.filter(c => c.semester === semester);
        }
        res.json({ status: 'success', data: courses });
    } catch (err) {
        let courses = fallbackData.courses.filter(c => c.department_id === deptId);
        if (semester) courses = courses.filter(c => c.semester === semester);
        res.json({ status: 'success', data: courses });
    }
});

// 4. Get specific course/subject details with associated study materials
router.get('/courses/:courseId', auth, async (req, res) => {
    const courseId = Number(req.params.courseId);
    const course = fallbackData.courses.find(c => c.id === courseId);
    if (!course) {
        return res.status(404).json({ status: 'failure', message: 'Course not found' });
    }

    const materials = fallbackData.materials.filter(m => m.course_id === courseId);
    res.json({
        status: 'success',
        data: {
            course,
            materials
        }
    });
});

module.exports = router;
