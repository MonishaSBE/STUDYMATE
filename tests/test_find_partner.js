const http = require('http');
const app = require('../backend/app');

let server;
let port = 4001;
let sessionCookie = '';

function request(method, path, body = null, headers = {}) {
    return new Promise((resolve, reject) => {
        const reqHeaders = {
            'Content-Type': 'application/json',
            ...headers
        };
        if (sessionCookie && headers['Cookie'] === undefined) {
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

async function runFindPartnerTests() {
    console.log('========================================================');
    console.log('STUDYMATE SMART FIND PARTNER DISCOVERY TEST SUITE');
    console.log('========================================================\n');

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
        await new Promise(resolve => {
            server = app.listen(port, resolve);
        });

        // 1. Authenticate user
        const regRes = await request('POST', '/api/auth/register', {
            email: `discovery_user_${Date.now()}@studymate.edu`,
            password: 'StrongPassword456!'
        });
        assert(regRes.status === 200 && regRes.data.status === 'success', 'User authentication established');

        // 2. Setup user profile
        const profRes = await request('POST', '/api/profile', {
            name: 'Ananya Sharma',
            department: 'Computer Science',
            year: '3rd Year',
            bio: 'Preparing for ML & Data Structures examinations.',
            available_time: 'Evenings',
            subjects: ['Data Structures', 'Machine Learning']
        });
        const myStudentId = profRes.data.data.student_id;
        assert(myStudentId > 0, 'User profile registered with subjects and availability');

        // 3. For You Recommendations & Scoring
        console.log('\n--- Test: For You Recommendations & Compatibility Scoring ---');
        const matchRes = await request('GET', `/api/match/${myStudentId}`);
        assert(matchRes.status === 200 && Array.isArray(matchRes.data.data), 'GET /api/match/:id returns recommendation list');
        
        const recommendations = matchRes.data.data;
        assert(recommendations.length > 0, 'Recommendations contain real eligible students from database');
        
        // Assert exclusion of self
        const selfIncluded = recommendations.some(c => c.student_id === myStudentId);
        assert(!selfIncluded, 'Currently authenticated student is strictly excluded from recommendations');

        // Verify compatibility score and reason on top match
        const topMatch = recommendations[0];
        assert(typeof topMatch.compatibility_score === 'number' && topMatch.compatibility_score >= 0 && topMatch.compatibility_score <= 100,
            `Compatibility score normalized between 0-100 (Score: ${topMatch.compatibility_score}%)`);
        assert(typeof topMatch.recommendation_reason === 'string' && topMatch.recommendation_reason.length > 5,
            `Recommendation reason generated (${topMatch.recommendation_reason})`);
        assert(Array.isArray(topMatch.shared_subjects), 'Shared subjects array returned');

        // 4. Discovery Tabs Filtering
        console.log('\n--- Test: Discovery Navigation Tabs ---');
        const deptTabRes = await request('GET', `/api/match/${myStudentId}?tab=department`);
        assert(deptTabRes.status === 200 && deptTabRes.data.data.every(c => c.department.toLowerCase().includes('computer science')),
            'Same Department tab returns only eligible students from Computer Science');

        const subjectsTabRes = await request('GET', `/api/match/${myStudentId}?tab=subjects`);
        assert(subjectsTabRes.status === 200 && subjectsTabRes.data.data.every(c => c.shared_subjects.length > 0),
            'Shared Subjects tab prioritizes students with overlapping subjects');

        const yearTabRes = await request('GET', `/api/match/${myStudentId}?tab=year`);
        assert(yearTabRes.status === 200 && yearTabRes.data.data.every(c => c.year.toLowerCase().includes('3rd year')),
            'Same Year tab filters students studying in the same academic year');

        // 5. Search Functionality
        console.log('\n--- Test: Search Functionality ---');
        const searchRes = await request('GET', `/api/match/${myStudentId}?search=Algorithms`);
        assert(searchRes.status === 200 && searchRes.data.data.some(c => c.subjects.includes('Algorithms')),
            'Search query successfully matches student subjects');

        // 6. Connect Button and Request Status
        console.log('\n--- Test: Connect Button & Chat Request Status ---');
        const candidateToConnect = recommendations[0];
        assert(candidateToConnect.connection_status === 'none', 'Initial connection status is "none"');

        // Send request
        const sendReqRes = await request('POST', '/api/requests', {
            sender_id: myStudentId,
            receiver_id: candidateToConnect.student_id
        });
        assert(sendReqRes.status === 200, 'Connect button creates real chat request in database');

        // Verify status updated to pending_sent
        const refreshedMatches = await request('GET', `/api/match/${myStudentId}`);
        const connectedCandidate = refreshedMatches.data.data.find(c => c.student_id === candidateToConnect.student_id);
        assert(connectedCandidate && connectedCandidate.connection_status === 'pending_sent',
            'Connection status updates to "pending_sent" (Request Sent)');

        // 7. Security: Unauthenticated requests
        console.log('\n--- Test: Security & Privacy ---');
        const unauthRes = await request('GET', `/api/match/${myStudentId}`, null, { 'Cookie': '' });
        assert(unauthRes.status === 401, 'Unauthenticated requests to match endpoint are rejected with 401 Unauthorized');

        console.log('\n========================================================');
        console.log(`SMART FIND PARTNER TEST RESULTS: ${passedCount} PASSED, ${failedCount} FAILED`);
        console.log('========================================================');

    } catch (err) {
        console.error('Test execution error:', err);
    } finally {
        if (server) server.close();
        process.exit(failedCount === 0 ? 0 : 1);
    }
}

runFindPartnerTests();
