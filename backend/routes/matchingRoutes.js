const express = require('express');
const router = express.Router();
const db = require('../mockDb');
const auth = require('../middleware/authenticate');
const { calculateCompatibility } = require('../services/recommendationService');

/**
 * Enhanced Study Partner Matching & Recommendation Route
 * GET /api/match/:id
 * Query parameters supported:
 *  - tab: 'for_you' | 'department' | 'subjects' | 'year' | 'new'
 *  - search: string (matches name, department, subjects, bio)
 *  - department: string
 *  - year: string
 *  - subject: string
 *  - sort: 'best_match' | 'most_subjects' | 'recent'
 */
router.get('/:id', auth, (req, res) => {
    const studentId = Number(req.params.id);
    const me = db.profiles.find(p => p.id === studentId);
    
    // If student has not set up profile, return empty list with clear indicator
    if (!me) {
        return res.json({ status: 'success', data: [], message: 'Profile not found. Please complete your profile first.' });
    }

    const { tab, search, department, year, subject, sort } = req.query;

    // Filter out the current authenticated user and invalid profiles
    let candidates = db.profiles.filter(p => p.id !== studentId && p.name);

    // Compute connection status for each candidate relative to current user
    const candidatesWithScore = candidates.map(other => {
        const comp = calculateCompatibility(me, other);

        // Find existing chat request between me and other
        const outgoingReq = db.requests.find(r => r.sender_id === studentId && r.receiver_id === other.id);
        const incomingReq = db.requests.find(r => r.sender_id === other.id && r.receiver_id === studentId);

        let connectionStatus = 'none'; // 'none' | 'pending_sent' | 'pending_received' | 'accepted' | 'rejected'
        let requestId = null;

        if (outgoingReq) {
            requestId = outgoingReq.ROWID;
            if (outgoingReq.status === 'accepted') connectionStatus = 'accepted';
            else if (outgoingReq.status === 'rejected') connectionStatus = 'rejected';
            else connectionStatus = 'pending_sent';
        } else if (incomingReq) {
            requestId = incomingReq.ROWID;
            if (incomingReq.status === 'accepted') connectionStatus = 'accepted';
            else if (incomingReq.status === 'rejected') connectionStatus = 'rejected';
            else connectionStatus = 'pending_received';
        }

        return {
            student_id: other.id,
            user_id: other.user_id,
            name: other.name,
            department: other.department,
            year: other.academic_year,
            available_time: other.available_time,
            bio: other.bio,
            subjects: other.subjects || [],
            shared_subjects: comp.shared_subjects,
            match_score: comp.compatibility_score, // backward-compatibility alias
            compatibility_score: comp.compatibility_score,
            recommendation_reason: comp.recommendation_reason,
            reasons: comp.reasons,
            connection_status: connectionStatus,
            request_id: requestId
        };
    });

    let results = candidatesWithScore;

    // Apply Discovery Tabs Filter
    if (tab === 'department') {
        results = results.filter(c => c.department && me.department && c.department.toLowerCase() === me.department.toLowerCase());
    } else if (tab === 'subjects') {
        results = results.filter(c => c.shared_subjects.length > 0);
    } else if (tab === 'year') {
        results = results.filter(c => c.year && me.academic_year && c.year.toLowerCase() === me.academic_year.toLowerCase());
    } else if (tab === 'new') {
        // Reverse order of IDs to prioritize recently added profiles
        results = [...results].sort((a, b) => b.student_id - a.student_id);
    }

    // Apply Search Query Filter
    if (search && search.trim()) {
        const s = search.trim().toLowerCase();
        results = results.filter(c => 
            (c.name && c.name.toLowerCase().includes(s)) ||
            (c.department && c.department.toLowerCase().includes(s)) ||
            (c.year && c.year.toLowerCase().includes(s)) ||
            (c.bio && c.bio.toLowerCase().includes(s)) ||
            (c.subjects && c.subjects.some(subj => subj.toLowerCase().includes(s)))
        );
    }

    // Specific Dropdown Filters
    if (department && department.trim()) {
        results = results.filter(c => c.department && c.department.toLowerCase() === department.trim().toLowerCase());
    }
    if (year && year.trim()) {
        results = results.filter(c => c.year && c.year.toLowerCase() === year.trim().toLowerCase());
    }
    if (subject && subject.trim()) {
        const sTerm = subject.trim().toLowerCase();
        results = results.filter(c => c.subjects && c.subjects.some(subj => subj.toLowerCase().includes(sTerm)));
    }

    // Sorting
    if (sort === 'most_subjects') {
        results.sort((a, b) => b.shared_subjects.length - a.shared_subjects.length || b.compatibility_score - a.compatibility_score);
    } else if (sort === 'recent') {
        results.sort((a, b) => b.student_id - a.student_id);
    } else {
        // Default: 'best_match'
        results.sort((a, b) => b.compatibility_score - a.compatibility_score);
    }

    res.json({
        status: 'success',
        data: results,
        meta: {
            total: results.length,
            current_tab: tab || 'for_you'
        }
    });
});

module.exports = router;
