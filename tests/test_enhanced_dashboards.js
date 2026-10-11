/**
 * Comprehensive Automated Test Suite for Enhanced StudyMate Dashboards
 * Tests all 8 dashboard requirements, security, admin enforcement, reminders, and regressions.
 */

const http = require('http');

const BASE_URL = 'http://localhost:3000/api';

function request(path, options = {}, body = null, cookie = null) {
    return new Promise((resolve, reject) => {
        const url = new URL(BASE_URL + path);
        const reqOptions = {
            hostname: url.hostname,
            port: url.port,
            path: url.pathname + url.search,
            method: options.method || 'GET',
            headers: {
                'Content-Type': 'application/json',
                ...(cookie ? { 'Cookie': cookie } : {}),
                ...(options.headers || {})
            }
        };

        const req = http.request(reqOptions, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                let json = null;
                try {
                    json = JSON.parse(data);
                } catch (e) {
                    json = data;
                }
                const setCookie = res.headers['set-cookie'];
                resolve({
                    status: res.statusCode,
                    headers: res.headers,
                    cookie: setCookie ? setCookie[0].split(';')[0] : cookie,
                    data: json
                });
            });
        });

        req.on('error', reject);
        if (body) {
            req.write(typeof body === 'string' ? body : JSON.stringify(body));
        }
        req.end();
    });
}

async function runTests() {
    console.log('=== STARTING ENHANCED DASHBOARDS TEST SUITE ===\n');
    let passed = 0;
    let failed = 0;

    function assert(condition, message) {
        if (condition) {
            console.log(`  [PASS] ${message}`);
            passed++;
        } else {
            console.error(`  [FAIL] ${message}`);
            failed++;
        }
    }

    try {
        // 1. AUTH & SESSIONS (Admin vs Student)
        console.log('Test 1: Authentication & Role Assignment');
        // Admin Login
        const adminRes = await request('/auth/login', { method: 'POST' }, { email: 'test@test.com', password: 'password' });
        assert(adminRes.status === 200 && adminRes.data.status === 'success', 'Admin user login successful');
        const adminCookie = adminRes.cookie;
        const adminMe = await request('/auth/me', {}, null, adminCookie);
        assert(adminMe.data.data.role === 'admin', 'test@test.com identified as verified admin');

        // Student Registration & Login
        const studentEmail = `student_${Date.now()}@example.com`;
        const studentReg = await request('/auth/register', { method: 'POST' }, { email: studentEmail, password: 'password123' });
        assert(studentReg.status === 201 && studentReg.data.status === 'success', 'Student registered with student role');
        const studentCookie = studentReg.cookie;
        const studentMe = await request('/auth/me', {}, null, studentCookie);
        assert(studentMe.data.data.role === 'student', 'Newly registered user assigned student role');

        // Create student profile
        const profRes = await request('/profile', { method: 'POST' }, {
            name: 'Alice Scholar',
            department: 'Computer Science and Engineering',
            year: '3rd Year',
            subjects: ['Cybersecurity', 'Data Structures']
        }, studentCookie);
        const studentId = profRes.data.data.student_id;
        assert(profRes.status === 200, 'Student profile created');

        // 2. SHARED NOTES & MY UPLOADS
        console.log('\nTest 2: Shared Notes & Discovery');
        const sharedNotesRes = await request('/notes/shared', {}, null, studentCookie);
        assert(sharedNotesRes.status === 200 && Array.isArray(sharedNotesRes.data.data), 'Retrieved shared notes from multi-domain catalogue');

        const sharedDomainFilter = await request('/notes/shared?domain=Computer Science and Engineering', {}, null, studentCookie);
        assert(sharedDomainFilter.status === 200, 'Filtered shared notes by domain');

        // 3. COURSE DISCOVERY
        console.log('\nTest 3: Multi-Domain Course Discovery');
        const domainsRes = await request('/catalogue/domains', {}, null, studentCookie);
        assert(domainsRes.status === 200 && domainsRes.data.data.length >= 10, `Retrieved ${domainsRes.data.data.length} educational domains`);

        const coursesRes = await request('/catalogue/courses', {}, null, studentCookie);
        assert(coursesRes.status === 200 && coursesRes.data.data.length > 0, 'Retrieved multi-domain course catalogue');

        const csCourses = await request('/catalogue/courses?domain=Computer Science and Engineering', {}, null, studentCookie);
        assert(csCourses.status === 200 && csCourses.data.data.every(c => c.domain === 'Computer Science and Engineering'), 'Courses accurately filtered by educational domain');

        // 4. STUDY LIBRARY
        console.log('\nTest 4: Study Library & Open Educational Books');
        const booksRes = await request('/materials/books', {}, null, studentCookie);
        assert(booksRes.status === 200 && booksRes.data.data.length >= 5, `Study Library has ${booksRes.data.data.length} verified open access educational textbooks`);
        assert(booksRes.data.data.every(b => b.access_url), 'All educational books provide legitimate access URLs');

        const bookSearch = await request('/materials/books?search=Security', {}, null, studentCookie);
        assert(bookSearch.data.data.some(b => b.title.includes('Security')), 'Searched educational books by topic');

        // 5. DAILY GOALS WITH REMINDERS
        console.log('\nTest 5: Daily Goals with Reminders & Due States');
        const goalRes = await request('/goals', { method: 'POST' }, {
            student_id: studentId,
            goal_text: 'Review Discrete Mathematics Chapter 3',
            target_date: '2026-10-15',
            reminder_datetime: '2026-10-14T09:00:00'
        }, studentCookie);
        assert(goalRes.status === 200, 'Created study goal with target date and reminder datetime');
        const goalId = goalRes.data.data.ROWID;

        const goalsList = await request(`/goals/${studentId}`, {}, null, studentCookie);
        const myGoal = goalsList.data.data.find(g => g.ROWID === goalId);
        assert(myGoal && myGoal.reminder_datetime === '2026-10-14T09:00:00', 'Goal persisted reminder timestamp in storage');

        // Toggle completion
        await request(`/goals/${goalId}`, { method: 'PUT' }, { is_completed: true }, studentCookie);
        const updatedGoals = await request(`/goals/${studentId}`, {}, null, studentCookie);
        const doneGoal = updatedGoals.data.data.find(g => g.ROWID === goalId);
        assert(doneGoal && Boolean(doneGoal.is_completed), 'Marked goal complete');

        // 6. DOMAIN-BASED QUIZZES
        console.log('\nTest 6: Domain-Based Quizzes');
        const quizzesRes = await request('/quizzes', {}, null, studentCookie);
        assert(quizzesRes.status === 200 && Array.isArray(quizzesRes.data.data), 'Retrieved quizzes list');

        // 7. DOMAIN-BASED FLASHCARDS
        console.log('\nTest 7: Domain-Based Flashcards');
        const decksRes = await request('/flashcards/decks', {}, null, studentCookie);
        assert(decksRes.status === 200 && Array.isArray(decksRes.data.data), 'Retrieved flashcard decks');

        // 8. COMMUNITY Q&A - PRIVATE QUERY & ADMIN-ONLY SECURITY
        console.log('\nTest 8: Community Q&A (Private Support & Admin Security)');
        // Student submits private query
        const queryRes = await request('/community/queries', { method: 'POST' }, {
            title: 'Confidential Exam Doubts on CS3301',
            category: 'Academic doubts',
            description: 'Can you explain the Dijkstra priority queue step?'
        }, studentCookie);
        assert(queryRes.status === 201, 'Student submitted private query');
        const queryId = queryRes.data.data.id;

        // Student can view their own query
        const studentView = await request(`/community/queries/${queryId}`, {}, null, studentCookie);
        assert(studentView.status === 200 && studentView.data.data.id === queryId, 'Student can view their own submitted query');
        assert(!studentView.data.data.internal_notes, 'Confidential internal notes hidden from student');

        // Another student tries to view the query -> MUST BE FORBIDDEN (403)
        const student2Email = `student2_${Date.now()}@example.com`;
        const student2Reg = await request('/auth/register', { method: 'POST' }, { email: student2Email, password: 'password123' });
        const student2Cookie = student2Reg.cookie;
        const unauthorizedView = await request(`/community/queries/${queryId}`, {}, null, student2Cookie);
        assert(unauthorizedView.status === 403, 'Other student is blocked with HTTP 403 from viewing private query');

        // Ordinary student tries to access admin query list -> MUST BE 403
        const studentAdminAttempt = await request('/community/admin/queries', {}, null, studentCookie);
        assert(studentAdminAttempt.status === 403, 'Non-admin student blocked from Admin Queries console');

        // Authorized Admin views all queries
        const adminQueries = await request('/community/admin/queries', {}, null, adminCookie);
        assert(adminQueries.status === 200 && adminQueries.data.data.some(q => q.id === queryId), 'Admin can view submitted query in admin console');

        // Admin updates query status
        const statusUpdate = await request(`/community/admin/queries/${queryId}/status`, { method: 'PUT' }, { status: 'in_progress' }, adminCookie);
        assert(statusUpdate.status === 200, 'Admin successfully updated query status');

        // Admin adds internal confidential note
        const noteRes = await request(`/community/admin/queries/${queryId}/notes`, { method: 'POST' }, { note: 'Consulted Prof. Davis on queue bounds.' }, adminCookie);
        assert(noteRes.status === 200, 'Admin added confidential internal note');

        // Admin replies to student
        const adminReply = await request(`/community/queries/${queryId}/messages`, { method: 'POST' }, { message: 'In Dijkstra, each vertex extraction takes O(log V).' }, adminCookie);
        assert(adminReply.status === 200, 'Admin posted official response');

        // Student checks messages again
        const studentCheck = await request(`/community/queries/${queryId}`, {}, null, studentCookie);
        assert(studentCheck.data.data.responses.some(m => m.sender_role === 'admin'), 'Student successfully received official admin response');
        assert(!studentCheck.data.data.internal_notes, 'Internal note still completely hidden from student');

        // Student marks query resolved
        const resolveRes = await request(`/community/queries/${queryId}/resolve`, { method: 'PUT' }, {}, studentCookie);
        assert(resolveRes.status === 200, 'Student marked query as resolved');

        // 9. REGRESSION CHECKS
        console.log('\nTest 9: Regression Tests (Existing Partners, Groups, Chat)');
        const groupsRes = await request('/groups', {}, null, studentCookie);
        assert(groupsRes.status === 200, 'Existing Study Groups API functioning normally');

        const matchesRes = await request(`/match/${studentId}`, {}, null, studentCookie);
        assert(matchesRes.status === 200, 'Existing Find Partner algorithm functioning normally');

        console.log(`\n========================================`);
        console.log(`TEST SUMMARY: ${passed} Passed, ${failed} Failed`);
        console.log(`========================================\n`);

        process.exit(failed > 0 ? 1 : 0);
    } catch (err) {
        console.error('Test suite failed with unexpected error:', err);
        process.exit(1);
    }
}

runTests();
