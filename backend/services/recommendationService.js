/**
 * Recommendation Service
 * Implements configurable multi-factor academic compatibility scoring,
 * reason generator, and discovery filtering for StudyMate.
 */

const DEFAULT_WEIGHTS = {
    shared_subjects: 0.50, // 50%
    department: 0.20,      // 20%
    academic_year: 0.15,   // 15%
    availability: 0.15     // 15%
};

/**
 * Calculates academic compatibility between two student profiles.
 * Normalizes score to 0 - 100 range and generates plain-language reasons.
 */
function calculateCompatibility(me, other, weights = DEFAULT_WEIGHTS) {
    let score = 0;
    const reasons = [];

    // 1. Shared Subjects (0 - 50 points default)
    const mySubjects = Array.isArray(me.subjects) ? me.subjects.map(s => s.trim().toLowerCase()) : [];
    const otherSubjects = Array.isArray(other.subjects) ? other.subjects.map(s => s.trim().toLowerCase()) : [];
    
    // Find shared subjects preserving other's casing
    const sharedSubjects = (other.subjects || []).filter(s => 
        mySubjects.includes(s.trim().toLowerCase())
    );

    if (mySubjects.length > 0 && sharedSubjects.length > 0) {
        // Proportion of my subjects that other also takes (capped at 1.0)
        const subjectRatio = Math.min(1.0, sharedSubjects.length / Math.max(1, Math.min(mySubjects.length, 4)));
        const subjectPoints = Math.round(subjectRatio * (weights.shared_subjects * 100));
        score += subjectPoints;

        if (sharedSubjects.length === 1) {
            reasons.push(`You both study ${sharedSubjects[0]}`);
        } else {
            reasons.push(`You share ${sharedSubjects.length} subjects (${sharedSubjects.slice(0, 2).join(', ')}${sharedSubjects.length > 2 ? ' +' + (sharedSubjects.length - 2) + ' more' : ''})`);
        }
    }

    // 2. Department Match (0 - 20 points default)
    if (me.department && other.department) {
        const myDept = me.department.trim().toLowerCase();
        const otherDept = other.department.trim().toLowerCase();
        if (myDept === otherDept || myDept.includes(otherDept) || otherDept.includes(myDept)) {
            const deptPoints = Math.round(weights.department * 100);
            score += deptPoints;
            reasons.push(`Same department (${other.department})`);
        }
    }

    // 3. Academic Year Match (0 - 15 points default)
    if (me.academic_year && other.academic_year) {
        const myYear = me.academic_year.trim().toLowerCase();
        const otherYear = other.academic_year.trim().toLowerCase();
        if (myYear === otherYear) {
            const yearPoints = Math.round(weights.academic_year * 100);
            score += yearPoints;
            reasons.push(`Same academic year (${other.academic_year})`);
        }
    }

    // 4. Study Availability Match (0 - 15 points default)
    if (me.available_time && other.available_time) {
        const myTime = me.available_time.trim().toLowerCase();
        const otherTime = other.available_time.trim().toLowerCase();
        
        // Exact match or keyword overlap (e.g., evenings, weekends, morning)
        const timeKeywords = ['evening', 'evenings', 'weekend', 'weekends', 'morning', 'mornings', 'afternoon', 'afternoons', 'weekday', 'weekdays'];
        const matchedKeywords = timeKeywords.filter(k => myTime.includes(k) && otherTime.includes(k));

        if (myTime === otherTime || matchedKeywords.length > 0) {
            const timePoints = Math.round(weights.availability * 100);
            score += timePoints;
            reasons.push(`Matching study availability (${other.available_time})`);
        }
    }

    // Normalize score to maximum 100, minimum base 10 if in same college community
    const finalScore = Math.min(100, Math.max(reasons.length > 0 ? 15 : 5, score));

    const primaryReason = reasons.length > 0 
        ? reasons.join(' · ') 
        : 'Suggested classmate based on campus course community';

    return {
        compatibility_score: finalScore,
        shared_subjects: sharedSubjects,
        reasons,
        recommendation_reason: primaryReason
    };
}

module.exports = {
    calculateCompatibility,
    DEFAULT_WEIGHTS
};
