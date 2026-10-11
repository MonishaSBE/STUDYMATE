const http = require('http');
const app = require('../backend/app');

let server;
let port = 4002;
let sessionCookie1 = '';
let sessionCookie2 = '';

function request(method, path, body = null, cookie = '') {
    return new Promise((resolve, reject) => {
        const reqHeaders = {
            'Content-Type': 'application/json'
        };
        if (cookie) {
            reqHeaders['Cookie'] = cookie;
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
            let resCookie = '';
            if (res.headers['set-cookie']) {
                const rawCookie = res.headers['set-cookie'][0];
                resCookie = rawCookie.split(';')[0];
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
                resolve({ status: res.statusCode, data: parsed, cookie: resCookie, headers: res.headers });
            });
        });

        req.on('error', reject);
        if (payload) req.write(payload);
        req.end();
    });
}

async function runRealtimeChatTests() {
    console.log('========================================================');
    console.log('STUDYMATE REAL-TIME CHAT & REQUEST DASHBOARD TEST SUITE');
    console.log('========================================================\n');

    let passed = 0;
    let failed = 0;

    function assert(name, condition) {
        if (condition) {
            console.log(`[PASS] ${name}`);
            passed++;
        } else {
            console.error(`[FAIL] ${name}`);
            failed++;
        }
    }

    try {
        await new Promise((resolve) => {
            server = app.listen(port, () => {
                console.log(`Test server running on port ${port}\n`);
                resolve();
            });
        });

        // 1. Unauthenticated Security Boundary
        console.log('--- 1. Security & Authentication Boundaries ---');
        const unauthConvs = await request('GET', '/api/chat/conversations');
        assert('Reject unauthenticated access to /api/chat/conversations with 401', unauthConvs.status === 401);

        const unauthReqs = await request('GET', '/api/chat/requests/incoming');
        assert('Reject unauthenticated access to /api/chat/requests/incoming with 401', unauthReqs.status === 401);

        // 2. Authenticate User 1
        console.log('\n--- 2. User 1 Session & Profile Setup ---');
        const email1 = `student_chat_1_${Date.now()}@studymate.edu`;
        const reg1 = await request('POST', '/api/auth/register', { email: email1, password: 'Password123!' });
        sessionCookie1 = reg1.cookie;
        assert('User 1 registers successfully', reg1.status === 200);

        const prof1 = await request('POST', '/api/profile', {
            name: 'Alice Walker',
            department: 'Computer Science',
            year: 'Year 3',
            bio: 'Data Structures and Algorithms enthusiast.',
            available_time: 'Weekday Evenings',
            subjects: ['Data Structures', 'Database Systems', 'Algorithms']
        }, sessionCookie1);
        const student1Id = prof1.data?.data?.student_id;
        assert('User 1 creates student profile', prof1.status === 200 && student1Id);

        // 3. Authenticate User 2
        console.log('\n--- 3. User 2 Session & Profile Setup ---');
        const email2 = `student_chat_2_${Date.now()}@studymate.edu`;
        const reg2 = await request('POST', '/api/auth/register', { email: email2, password: 'Password123!' });
        sessionCookie2 = reg2.cookie;
        assert('User 2 registers successfully', reg2.status === 200);

        const prof2 = await request('POST', '/api/profile', {
            name: 'Bob Martin',
            department: 'Computer Science',
            year: 'Year 3',
            bio: 'Preparing for technical interviews and exam problem sets.',
            available_time: 'Weekday Evenings',
            subjects: ['Data Structures', 'Computer Networks']
        }, sessionCookie2);
        const student2Id = prof2.data?.data?.student_id;
        assert('User 2 creates student profile', prof2.status === 200 && student2Id);

        // 4. Study Partner Request Lifecycle
        console.log('\n--- 4. Study Partner Request Flow ---');
        // Prevent sending request to self
        const selfReq = await request('POST', '/api/chat/requests', {
            receiver_id: student1Id,
            intro_message: 'Hi self'
        }, sessionCookie1);
        assert('Prevent sending study partner request to oneself', selfReq.status === 400);

        // User 1 sends request to User 2 with introductory message
        const sendReq = await request('POST', '/api/chat/requests', {
            receiver_id: student2Id,
            intro_message: 'Hi Bob! We share Data Structures. Would you like to study together and prepare for midterms?'
        }, sessionCookie1);
        assert('User 1 sends request with custom intro message to User 2', sendReq.status === 200 && sendReq.data.status === 'success');
        const reqRowId = sendReq.data?.data?.ROWID;

        // Prevent duplicate request
        const dupReq = await request('POST', '/api/chat/requests', {
            receiver_id: student2Id,
            intro_message: 'Duplicate request'
        }, sessionCookie1);
        assert('Prevent duplicate pending study partner requests', dupReq.status === 400);

        // User 2 checks incoming requests
        const user2Incoming = await request('GET', '/api/chat/requests/incoming', null, sessionCookie2);
        assert('User 2 sees incoming request from User 1', 
            user2Incoming.status === 200 && 
            user2Incoming.data.data.some(r => r.sender_id === student1Id && r.intro_message.includes('midterms'))
        );

        // User 1 checks outgoing requests
        const user1Outgoing = await request('GET', '/api/chat/requests/outgoing', null, sessionCookie1);
        assert('User 1 sees outgoing request in Sent Requests tab', 
            user1Outgoing.status === 200 && 
            user1Outgoing.data.data.some(r => r.receiver_id === student2Id && r.status === 'pending')
        );

        // Security: User 1 cannot accept request meant for User 2
        const unauthAccept = await request('POST', `/api/chat/requests/${reqRowId}/accept`, null, sessionCookie1);
        assert('Unauthorized acceptance rejected (only intended receiver can accept)', unauthAccept.status === 403);

        // User 2 accepts request from User 1
        const acceptRes = await request('POST', `/api/chat/requests/${reqRowId}/accept`, null, sessionCookie2);
        assert('User 2 accepts study partner request and unlocks conversation', acceptRes.status === 200 && acceptRes.data.conversation_id);
        const conversationId = acceptRes.data.conversation_id;

        // 5. Persistent Messaging Between Study Partners
        console.log('\n--- 5. Messaging & Conversation Flow ---');
        // Both users should now see the conversation in /api/chat/conversations
        const convList1 = await request('GET', '/api/chat/conversations', null, sessionCookie1);
        assert('User 1 has active conversation with User 2', 
            convList1.status === 200 && convList1.data.data.some(c => c.id === conversationId && c.partner.name === 'Bob Martin')
        );

        const convList2 = await request('GET', '/api/chat/conversations', null, sessionCookie2);
        assert('User 2 has active conversation with User 1', 
            convList2.status === 200 && convList2.data.data.some(c => c.id === conversationId && c.partner.name === 'Alice Walker')
        );

        // User 1 sends message to conversation
        const msg1 = await request('POST', `/api/chat/conversations/${conversationId}/messages`, {
            content: 'Hey Bob, let us review Binary Search Trees today!'
        }, sessionCookie1);
        assert('User 1 sends academic text message', msg1.status === 200 && msg1.data.data.content.includes('Binary Search Trees'));

        // User 2 reads message history
        const history2 = await request('GET', `/api/chat/conversations/${conversationId}/messages`, null, sessionCookie2);
        assert('User 2 retrieves chronological message history with User 1 message', 
            history2.status === 200 && 
            history2.data.data.messages.some(m => m.content.includes('Binary Search Trees') && m.sender_id === student1Id)
        );

        // User 2 sends reply
        const msg2 = await request('POST', `/api/chat/conversations/${conversationId}/messages`, {
            content: 'Sounds great! I also have sample quiz questions we can test.'
        }, sessionCookie2);
        assert('User 2 sends reply message', msg2.status === 200);

        // Security: Unrelated third party cannot view or send message to this conversation
        console.log('\n--- 6. Conversation Membership Authorization ---');
        const reg3 = await request('POST', '/api/auth/register', { email: `student_chat_3_${Date.now()}@studymate.edu`, password: 'Password123!' });
        const cookie3 = reg3.cookie;
        const prof3 = await request('POST', '/api/profile', {
            name: 'Charlie Brown', department: 'Electrical', year: 'Year 2', bio: '', available_time: '', subjects: []
        }, cookie3);

        const spyAttempt = await request('GET', `/api/chat/conversations/${conversationId}/messages`, null, cookie3);
        assert('Reject unauthorized student from reading private conversation (403 Forbidden)', spyAttempt.status === 403);

        const injectAttempt = await request('POST', `/api/chat/conversations/${conversationId}/messages`, {
            content: 'Intrusion message'
        }, cookie3);
        assert('Reject unauthorized student from posting to private conversation (403 Forbidden)', injectAttempt.status === 403);

        // 7. Integrated AI Study Assistant
        console.log('\n--- 7. Integrated AI Study Assistant ---');
        const aiConceptQuery = await request('POST', '/api/chat/ai', {
            prompt: 'Explain time complexity of quicksort average vs worst case',
            mode: 'study_help',
            subject: 'Data Structures'
        }, sessionCookie1);
        assert('AI assistant generates structured academic explanation', 
            aiConceptQuery.status === 200 && aiConceptQuery.data.data.response.length > 50
        );

        const aiDraftInvite = await request('POST', '/api/chat/ai', {
            prompt: 'Propose an online meeting this Thursday at 6 PM for midterms',
            mode: 'draft_schedule',
            subject: 'Algorithms'
        }, sessionCookie1);
        assert('AI assistant generates polite meeting schedule draft', 
            aiDraftInvite.status === 200 && aiDraftInvite.data.data.response.includes('study session')
        );

        // 8. Regression Verification of Existing System
        console.log('\n--- 8. Regression Checks of Existing Modules ---');
        const findPartners = await request('GET', '/api/match/for-you', null, sessionCookie1);
        assert('Find Partner recommendation engine remains operational', findPartners.status === 200);

        const studyGroups = await request('GET', '/api/groups', null, sessionCookie1);
        assert('Study Groups module remains intact', studyGroups.status === 200);

        const studyGoals = await request('GET', `/api/goals/${student1Id}`, null, sessionCookie1);
        assert('Daily study goals module remains intact', studyGoals.status === 200);

    } catch (e) {
        console.error('Unhandled test exception:', e);
        failed++;
    } finally {
        if (server) {
            server.close();
            console.log('\nTest server shut down.');
        }

        console.log('========================================================');
        console.log(`TOTAL PASSED: ${passed}`);
        console.log(`TOTAL FAILED: ${failed}`);
        console.log('========================================================\n');
        process.exit(failed > 0 ? 1 : 0);
    }
}

runRealtimeChatTests();
