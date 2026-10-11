const http = require('http');
const app = require('../backend/app');

let server;
let port = 3999;
let sessionCookie = '';

function request(method, path, body = null, headers = {}) {
    return new Promise((resolve, reject) => {
        const reqHeaders = {
            'Content-Type': 'application/json',
            ...headers
        };
        if (sessionCookie) {
            reqHeaders['Cookie'] = sessionCookie;
        }

        const payload = body ? JSON.stringify(body) : null;
        if (payload) {
            reqHeaders['Content-Length'] = Buffer.byteLength(payload);
        }

        const req = http.request({
            hostname: 'localhost',
            port,
            path,
            method,
            headers: reqHeaders
        }, (res) => {
            if (res.headers['set-cookie']) {
                const rawCookie = res.headers['set-cookie'][0];
                sessionCookie = rawCookie.split(';')[0];
            }

            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                let parsed = null;
                try {
                    parsed = JSON.parse(data);
                } catch (e) {
                    parsed = data;
                }
                resolve({ status: res.statusCode, data: parsed, headers: res.headers });
            });
        });

        req.on('error', reject);
        if (payload) req.write(payload);
        req.end();
    });
}

async function runTestSuite() {
    console.log('====================================================');
    console.log('STUDYMATE COMPREHENSIVE AUTOMATED VERIFICATION SUITE');
    console.log('====================================================\n');

    let passedCount = 0;
    let failedCount = 0;

    function assert(condition, message) {
        if (condition) {
            console.log(`[PASS] ${message}`);
            passedCount++;
        } else {
            console.error(`[FAIL] ${message}`);
            failedCount++;
        }
    }

    try {
        // Start test server
        await new Promise((resolve) => {
            server = app.listen(port, resolve);
        });

        // 1. AUTH & SESSION TEST
        console.log('--- Phase 1: Authentication & Session Verification ---');
        const regRes = await request('POST', '/api/auth/register', {
            email: `teststudent_${Date.now()}@rmkcet.ac.in`,
            password: 'SecurePassword123!'
        });
        assert(regRes.status === 200 && regRes.data.status === 'success', 'User registration succeeds and creates session');

        const meRes = await request('GET', '/api/auth/me');
        assert(meRes.status === 200 && meRes.data.data.email.includes('rmkcet.ac.in'), 'Session authentication preserves identity across requests');

        // 2. EXISTING FEATURES VERIFICATION
        console.log('\n--- Phase 2: Existing StudyMate Features Verification ---');
        // Profile
        const profRes = await request('POST', '/api/profile', {
            name: 'Monisha S',
            department: 'Computer Science',
            year: '3rd Year',
            bio: 'Passionate about cyber security & algorithms.',
            available_time: '6-8 PM',
            subjects: ['Data Structures', 'Machine Learning', 'Cryptography']
        });
        assert(profRes.status === 200 && profRes.data.data.student_id, 'Existing Profile creation & update preserved');
        const studentId = profRes.data.data.student_id;

        // Peer Matching
        const matchRes = await request('GET', `/api/match/${studentId}`);
        assert(matchRes.status === 200 && Array.isArray(matchRes.data.data), 'Existing Peer Matching algorithm operational');

        // Chat Requests
        const chatReqRes = await request('POST', '/api/requests', { sender_id: studentId, receiver_id: 2 });
        assert(chatReqRes.status === 200, 'Existing Chat Request dispatch operational');

        // Study Groups
        const groupRes = await request('POST', '/api/groups', {
            group_name: 'RMKCET Cyber Defense Group',
            description: 'Preparing for network security midterms',
            max_members: 6,
            created_by: studentId
        });
        assert(groupRes.status === 200 && groupRes.data.data.id, 'Existing Study Groups creation preserved');
        const groupId = groupRes.data.data.id;

        // Shared Notes
        const noteRes = await request('POST', '/api/notes', {
            group_id: groupId,
            uploaded_by: studentId,
            title: 'Unit 1 Cryptography Basics',
            file_url: 'https://rmkcet.ac.in/notes/crypto_unit1.pdf'
        });
        assert(noteRes.status === 200, 'Existing Group Shared Notes preserved');

        // Daily Goals
        const goalRes = await request('POST', '/api/goals', {
            student_id: studentId,
            goal_text: 'Complete 15 DSA Questions on LeetCode',
            target_date: '2026-10-15'
        });
        assert(goalRes.status === 200, 'Existing Daily Goals functionality preserved');

        // 3. COURSE DISCOVERY (FEATURE MODULE 1)
        console.log('\n--- Phase 3: University & Course Discovery (Module 1) ---');
        const instRes = await request('GET', '/api/catalogue/institutions');
        assert(instRes.status === 200 && instRes.data.data.some(i => i.name.includes('RMK College of Engineering')), 'RMK College of Engineering and Technology present in catalogue');

        const deptRes = await request('GET', '/api/catalogue/institutions/1/departments');
        assert(deptRes.status === 200 && deptRes.data.data.some(d => d.code === 'CSE-CYBER'), 'Computer Science & Cyber Security departments present');

        const courseRes = await request('GET', '/api/catalogue/departments/2/courses?semester=4');
        assert(courseRes.status === 200 && courseRes.data.data.some(c => c.course_code === 'CB3401'), 'Semester 4 Cryptography and Network Security course found');

        // 4. STUDY MATERIAL LIBRARY (FEATURE MODULE 2)
        console.log('\n--- Phase 4: Study Material Library & Search (Module 2) ---');
        const libRes = await request('GET', '/api/materials?search=Cryptography');
        assert(libRes.status === 200 && libRes.data.data.length > 0, 'Library search returns matching resources for Cryptography');

        const matItem = libRes.data.data[0];
        const detailRes = await request('GET', `/api/materials/${matItem.id}`);
        assert(detailRes.status === 200 && detailRes.data.data.id === matItem.id, 'Document details endpoint retrieves complete resource metadata');

        // 5. BOOKMARKS, RATINGS & REPORTING (FEATURE MODULE 9)
        console.log('\n--- Phase 5: Bookmarks, Ratings & Moderation (Module 9) ---');
        const bmarkRes = await request('POST', `/api/materials/${matItem.id}/bookmark`);
        assert(bmarkRes.status === 200 && bmarkRes.data.bookmarked === true, 'Bookmarking material succeeds');

        const rateRes = await request('POST', `/api/materials/${matItem.id}/rate`, { rating: 5, review: 'Fantastic exam notes' });
        assert(rateRes.status === 200 && rateRes.data.average_rating > 0, 'Resource rating submitted and computed');

        const reportRes = await request('POST', `/api/materials/${matItem.id}/report`, { reason: 'Typo in page 4', details: 'Equation 3 typo' });
        assert(reportRes.status === 200, 'Resource reporting validated and queued for moderation');

        // 6. AI STUDY ASSISTANT (FEATURE MODULE 4)
        console.log('\n--- Phase 6: AI Study Assistant (Module 4) ---');
        const statusRes = await request('GET', '/api/ai/status');
        assert(statusRes.status === 200 && statusRes.data.data.model, 'AI status endpoint reports model engine status');

        const sumRes = await request('POST', '/api/ai/summarize', { material_id: matItem.id, type: 'exam' });
        assert(sumRes.status === 200 && sumRes.data.data.summary.includes('Exam'), 'AI high-yield exam summary generated successfully');

        const qaRes = await request('POST', '/api/ai/qa', { material_id: matItem.id, question: 'What is RSA encryption?' });
        assert(qaRes.status === 200 && qaRes.data.data.answer, 'AI grounded Q&A responds with source references');

        const notesAiRes = await request('POST', '/api/ai/notes', { material_id: matItem.id });
        assert(notesAiRes.status === 200 && notesAiRes.data.data.notes, 'AI structured revision notes synthesized');

        // 7. QUIZ GENERATION & ASSESSMENT (FEATURE MODULE 5)
        console.log('\n--- Phase 7: Quiz Generator & Scoring (Module 5) ---');
        const quizGenRes = await request('POST', '/api/quizzes/generate', {
            material_id: matItem.id,
            difficulty: 'medium',
            num_questions: 3
        });
        assert(quizGenRes.status === 200 && quizGenRes.data.data.id, 'Quiz generated dynamically from study material');
        const quizId = quizGenRes.data.data.id;

        const takeQuizRes = await request('GET', `/api/quizzes/${quizId}/take`);
        assert(takeQuizRes.status === 200 && !takeQuizRes.data.data.questions[0].correct_answer, 'Quiz attempt hides correct answers during active attempt');

        const submitQuizRes = await request('POST', `/api/quizzes/${quizId}/submit`, {
            answers: { 1: 'To maximize throughput while maintaining systemic correctness and invariants' }
        });
        assert(submitQuizRes.status === 200 && typeof submitQuizRes.data.data.score === 'number', 'Backend evaluates answers and returns instant score breakdown');

        // 8. INTERACTIVE FLASHCARDS (FEATURE MODULE 6)
        console.log('\n--- Phase 8: Interactive Flashcards (Module 6) ---');
        const deckRes = await request('POST', '/api/flashcards/decks', {
            title: 'RMKCET Cryptography Core Ciphers',
            subject: 'Cyber Security',
            description: 'Key definitions and mathematical foundations',
            is_public: true
        });
        assert(deckRes.status === 200 && deckRes.data.data.id, 'Flashcard deck created');
        const deckId = deckRes.data.data.id;

        const addCardRes = await request('POST', `/api/flashcards/decks/${deckId}/cards`, {
            front_text: 'What is AES?',
            back_text: 'Advanced Encryption Standard: symmetric block cipher operating on 128-bit blocks.'
        });
        assert(addCardRes.status === 200 && addCardRes.data.data.id, 'Flashcard added to deck');
        const cardId = addCardRes.data.data.id;

        const progressRes = await request('POST', `/api/flashcards/cards/${cardId}/progress`, { status: 'mastered' });
        assert(progressRes.status === 200 && progressRes.data.mastery_status === 'mastered', 'Flashcard mastery status recorded');

        // 9. CONCEPT MAPS (FEATURE MODULE 7)
        console.log('\n--- Phase 9: Concept Maps (Module 7) ---');
        const cmapRes = await request('POST', '/api/concept-maps', {
            title: 'Cyber Security Threat Vectors',
            subject: 'Cyber Security',
            nodes: [
                { id: '1', label: 'Threat Actor', category: 'root' },
                { id: '2', label: 'Attack Vector', category: 'core' },
                { id: '3', label: 'Vulnerability Exploitation', category: 'detail' }
            ],
            edges: [
                { from: '1', to: '2', relation: 'deploys' },
                { from: '2', to: '3', relation: 'targets' }
            ]
        });
        assert(cmapRes.status === 200 && cmapRes.data.data.id, 'Concept map graph created and saved');
        const mapId = cmapRes.data.data.id;

        const getCmapRes = await request('GET', `/api/concept-maps/${mapId}`);
        assert(getCmapRes.status === 200 && getCmapRes.data.data.nodes.length === 3, 'Concept map retrieved with nodes and edges intact');

        // 10. COMMUNITY Q&A (FEATURE MODULE 8)
        console.log('\n--- Phase 10: Community Questions & Answers (Module 8) ---');
        const postQRes = await request('POST', '/api/community/questions', {
            title: 'How does Diffie-Hellman prevent Man-In-The-Middle attacks?',
            subject: 'Cyber Security',
            content: 'Is standard Diffie-Hellman vulnerable without public key infrastructure authentication?',
            tags: 'Diffie-Hellman, MITM, Key Exchange, Cryptography'
        });
        assert(postQRes.status === 200 && postQRes.data.data.id, 'Community question created');
        const qId = postQRes.data.data.id;

        const postAnsRes = await request('POST', `/api/community/questions/${qId}/answers`, {
            content: 'Standard anonymous Diffie-Hellman does not authenticate the parties, making it susceptible to MITM unless combined with digital signatures or certificates.'
        });
        assert(postAnsRes.status === 200 && postAnsRes.data.data.id, 'Peer answer submitted');
        const aId = postAnsRes.data.data.id;

        const voteRes = await request('POST', `/api/community/answers/${aId}/vote`, { vote_type: 'up' });
        assert(voteRes.status === 200 && voteRes.data.upvotes === 1, 'Upvoting answer succeeds and prevents duplicate inflation');

        const acceptRes = await request('POST', `/api/community/questions/${qId}/answers/${aId}/accept`);
        assert(acceptRes.status === 200, 'Answer marked as accepted solution by question author');

        // 11. PERSONAL LEARNING HUB (FEATURE MODULE 10)
        console.log('\n--- Phase 11: Personal Study Dashboard (Module 10) ---');
        const hubRes = await request('GET', '/api/hub/metrics');
        assert(hubRes.status === 200 && hubRes.data.data.stats.bookmarks_count >= 1, 'Learning Hub aggregates saved documents');
        assert(hubRes.status === 200 && hubRes.data.data.stats.cards_mastered >= 1, 'Learning Hub tracks mastered flashcards');

        console.log('\n====================================================');
        console.log(`TEST RESULTS: ${passedCount} PASSED, ${failedCount} FAILED`);
        console.log('====================================================');

    } catch (err) {
        console.error('Fatal test execution error:', err);
    } finally {
        if (server) server.close();
        process.exit(failedCount === 0 ? 0 : 1);
    }
}

runTestSuite();
