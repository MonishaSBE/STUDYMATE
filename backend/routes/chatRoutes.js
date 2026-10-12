const express = require('express');
const router = express.Router();
const db = require('../mockDb');
const auth = require('../middleware/authenticate');
const { fallbackData } = require('../services/storageAdapter');
const { handleChatAssistantPrompt } = require('../services/aiService');
const { sendPartnerRequestEmail, sendRequestAcceptedEmail } = require('../services/emailService');

/**
 * Direct Messaging & Chat Request Routes
 * Handles:
 * - Listing accepted study partners & active conversations
 * - Retrieving message history with pagination & authorization
 * - Sending messages between accepted study partners
 * - Incoming & Outgoing study partner requests with intro messages
 * - Accepting / Rejecting requests
 * - Integrated AI Study Assistant within Chat
 */

// Helper: Ensure conversations array exists
function getConversations() {
    if (!fallbackData.conversations) fallbackData.conversations = [];
    return fallbackData.conversations;
}

function getMessages() {
    if (!fallbackData.messages) fallbackData.messages = [];
    return fallbackData.messages;
}

// 1. GET /api/chat/conversations
// Returns all conversations for the authenticated student with last message and unread count
router.get('/conversations', auth, (req, res) => {
    const studentProfile = db.profiles.find(p => p.user_id === req.session.userId);
    if (!studentProfile) {
        return res.json({ status: 'success', data: [] });
    }
    const myStudentId = studentProfile.id;

    // Also auto-create direct conversations for any accepted chat_requests if not yet created
    const acceptedRequests = db.requests.filter(r => 
        r.status === 'accepted' && (r.sender_id === myStudentId || r.receiver_id === myStudentId)
    );

    const convs = getConversations();

    acceptedRequests.forEach(reqItem => {
        const otherId = reqItem.sender_id === myStudentId ? reqItem.receiver_id : reqItem.sender_id;
        const exists = convs.find(c => 
            c.type === 'direct' && c.participants.includes(myStudentId) && c.participants.includes(otherId)
        );
        if (!exists) {
            convs.push({
                id: fallbackData.nextId++,
                type: 'direct',
                participants: [myStudentId, otherId],
                title: null,
                created_at: reqItem.created_at || new Date().toISOString(),
                updated_at: reqItem.created_at || new Date().toISOString()
            });
        }
    });

    const myConvs = convs.filter(c => c.participants.includes(myStudentId));
    const allMessages = getMessages();

    const enriched = myConvs.map(c => {
        const otherId = c.participants.find(pId => pId !== myStudentId);
        const otherProfile = db.profiles.find(p => p.id === otherId);

        // Get messages for this conversation
        const convMessages = allMessages.filter(m => m.conversation_id === c.id);
        convMessages.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
        const lastMsg = convMessages.length ? convMessages[convMessages.length - 1] : null;

        // Unread count (messages sent by other with status !== 'read')
        const unreadCount = convMessages.filter(m => m.sender_id !== myStudentId && m.status !== 'read').length;

        return {
            id: c.id,
            type: c.type,
            partner: {
                student_id: otherId,
                name: otherProfile ? otherProfile.name : `Student #${otherId}`,
                department: otherProfile ? otherProfile.department : '',
                academic_year: otherProfile ? otherProfile.academic_year : '',
                available_time: otherProfile ? otherProfile.available_time : '',
                subjects: otherProfile ? otherProfile.subjects : []
            },
            last_message: lastMsg ? {
                content: lastMsg.content,
                sender_id: lastMsg.sender_id,
                sender_name: lastMsg.sender_name,
                created_at: lastMsg.created_at,
                status: lastMsg.status
            } : null,
            unread_count: unreadCount,
            updated_at: lastMsg ? lastMsg.created_at : c.updated_at
        };
    });

    // Sort conversations by most recent message
    enriched.sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));

    res.json({ status: 'success', data: enriched });
});

// 2. GET /api/chat/conversations/:id/messages
// Retrieves chronological message history with participant authorization
router.get('/conversations/:id/messages', auth, (req, res) => {
    const convId = Number(req.params.id);
    const studentProfile = db.profiles.find(p => p.user_id === req.session.userId);
    if (!studentProfile) return res.status(401).json({ status: 'failure', message: 'Unauthorized' });
    
    const myStudentId = studentProfile.id;
    const conv = getConversations().find(c => c.id === convId);

    if (!conv) {
        return res.status(404).json({ status: 'failure', message: 'Conversation not found' });
    }

    // Authorization: User must be a participant
    if (!conv.participants.includes(myStudentId)) {
        return res.status(403).json({ status: 'failure', message: 'Unauthorized: Not a participant in this conversation' });
    }

    const allMessages = getMessages();
    const convMessages = allMessages.filter(m => m.conversation_id === convId);
    convMessages.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

    // Mark incoming messages as read
    convMessages.forEach(m => {
        if (m.sender_id !== myStudentId && m.status !== 'read') {
            m.status = 'read';
        }
    });

    const otherId = conv.participants.find(pId => pId !== myStudentId);
    const otherProfile = db.profiles.find(p => p.id === otherId);

    res.json({
        status: 'success',
        data: {
            conversation_id: convId,
            partner: {
                student_id: otherId,
                name: otherProfile ? otherProfile.name : `Student #${otherId}`,
                department: otherProfile ? otherProfile.department : '',
                academic_year: otherProfile ? otherProfile.academic_year : '',
                available_time: otherProfile ? otherProfile.available_time : ''
            },
            messages: convMessages
        }
    });
});

// 3. POST /api/chat/conversations/:id/messages
// Sends a new message in an authorized conversation
router.post('/conversations/:id/messages', auth, (req, res) => {
    const convId = Number(req.params.id);
    const { content, message_type = 'text' } = req.body;

    if (!content || !content.trim()) {
        return res.status(400).json({ status: 'failure', message: 'Message content is required' });
    }

    const studentProfile = db.profiles.find(p => p.user_id === req.session.userId);
    if (!studentProfile) return res.status(401).json({ status: 'failure', message: 'Unauthorized' });

    const myStudentId = studentProfile.id;
    const conv = getConversations().find(c => c.id === convId);

    if (!conv) {
        return res.status(404).json({ status: 'failure', message: 'Conversation not found' });
    }

    // Security Authorization: Determine sender strictly from session, ensure membership
    if (!conv.participants.includes(myStudentId)) {
        return res.status(403).json({ status: 'failure', message: 'Unauthorized: Cannot send messages to conversations you do not belong to' });
    }

    const newMessage = {
        id: fallbackData.nextId++,
        conversation_id: convId,
        sender_id: myStudentId,
        sender_name: studentProfile.name || req.session.email.split('@')[0],
        content: content.trim(),
        message_type,
        status: 'sent',
        created_at: new Date().toISOString()
    };

    getMessages().push(newMessage);
    conv.updated_at = newMessage.created_at;

    res.json({ status: 'success', data: newMessage });
});

// 4. GET /api/chat/requests/incoming
// Lists incoming study partner requests for authenticated student
router.get('/requests/incoming', auth, (req, res) => {
    const studentProfile = db.profiles.find(p => p.user_id === req.session.userId);
    if (!studentProfile) return res.json({ status: 'success', data: [] });

    const incoming = db.requests
        .filter(r => r.receiver_id === studentProfile.id)
        .map(r => {
            const sender = db.profiles.find(p => p.id === r.sender_id);
            return {
                id: r.ROWID,
                sender_id: r.sender_id,
                sender_name: sender ? sender.name : (r.sender_name || 'Student #' + r.sender_id),
                department: sender ? sender.department : '',
                academic_year: sender ? sender.academic_year : '',
                subjects: sender ? sender.subjects : [],
                intro_message: r.intro_message || 'Hey! Would you like to study together and prepare for examinations?',
                status: r.status,
                created_at: r.created_at || new Date().toISOString()
            };
        });

    res.json({ status: 'success', data: incoming });
});

// 5. GET /api/chat/requests/outgoing
// Lists outgoing requests sent by authenticated student
router.get('/requests/outgoing', auth, (req, res) => {
    const studentProfile = db.profiles.find(p => p.user_id === req.session.userId);
    if (!studentProfile) return res.json({ status: 'success', data: [] });

    const outgoing = db.requests
        .filter(r => r.sender_id === studentProfile.id)
        .map(r => {
            const receiver = db.profiles.find(p => p.id === r.receiver_id);
            return {
                id: r.ROWID,
                receiver_id: r.receiver_id,
                receiver_name: receiver ? receiver.name : (r.receiver_name || 'Student #' + r.receiver_id),
                department: receiver ? receiver.department : '',
                academic_year: receiver ? receiver.academic_year : '',
                intro_message: r.intro_message || '',
                status: r.status,
                created_at: r.created_at || new Date().toISOString()
            };
        });

    res.json({ status: 'success', data: outgoing });
});

// 6. POST /api/chat/requests/:id/accept
// Accept study partner request, verifying intended recipient
router.post('/requests/:id/accept', auth, async (req, res) => {
    const reqId = Number(req.params.id);
    let studentProfile = db.profiles.find(p => Number(p.user_id) === Number(req.session.userId));
    if (!studentProfile) return res.status(401).json({ status: 'failure', message: 'Unauthorized' });

    const reqItem = db.requests.find(r => Number(r.ROWID) === reqId || r.ROWID == req.params.id);
    if (!reqItem) return res.status(404).json({ status: 'failure', message: 'Request not found' });

    // Authorization verification
    if (Number(reqItem.receiver_id) !== Number(studentProfile.id) && Number(reqItem.receiver_id) !== Number(studentProfile.user_id)) {
        return res.status(403).json({ status: 'failure', message: 'Unauthorized: Only intended recipient can accept this request' });
    }

    reqItem.status = 'accepted';
    await db.saveRequest(reqItem);

    // Send acceptance email to the original sender
    try {
        const senderUser = db.users.find(u => u.id === db.profiles.find(p => p.id === reqItem.sender_id)?.user_id);
        const accepterProfile = db.profiles.find(p => p.id === studentProfile.id);
        if (senderUser && senderUser.email) {
            sendRequestAcceptedEmail({
                accepterName: accepterProfile?.name || studentProfile.name || 'Your classmate',
                senderName: senderUser.name || senderUser.email,
                senderEmail: senderUser.email,
                dashboardUrl: process.env.GOOGLE_CALLBACK_URL
                    ? process.env.GOOGLE_CALLBACK_URL.replace('/api/auth/google/callback', '/dashboard.html')
                    : 'http://localhost:3000/dashboard.html'
            }).catch(() => {});
        }
    } catch (emailErr) {
        console.error('[Email] Could not send acceptance email:', emailErr.message);
    }

    // Ensure conversation is created
    const convs = getConversations();
    let conv = convs.find(c => 
        c.type === 'direct' && c.participants.includes(reqItem.sender_id) && c.participants.includes(reqItem.receiver_id)
    );

    if (!conv) {
        conv = {
            id: fallbackData.nextId++,
            type: 'direct',
            participants: [reqItem.sender_id, reqItem.receiver_id],
            title: null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };
        convs.push(conv);

        // If intro_message existed on request, seed as first message
        if (reqItem.intro_message) {
            getMessages().push({
                id: fallbackData.nextId++,
                conversation_id: conv.id,
                sender_id: reqItem.sender_id,
                sender_name: reqItem.sender_name || 'Student',
                content: reqItem.intro_message,
                message_type: 'text',
                status: 'delivered',
                created_at: new Date().toISOString()
            });
        }
    }

    res.json({ status: 'success', message: 'Request accepted! Conversation is now active.', conversation_id: conv.id });
});

// 7. POST /api/chat/requests/:id/reject
// Reject study partner request
router.post('/requests/:id/reject', auth, async (req, res) => {
    const reqId = Number(req.params.id);
    let studentProfile = db.profiles.find(p => Number(p.user_id) === Number(req.session.userId));
    if (!studentProfile) return res.status(401).json({ status: 'failure', message: 'Unauthorized' });

    const reqItem = db.requests.find(r => Number(r.ROWID) === reqId || r.ROWID == req.params.id);
    if (!reqItem) return res.status(404).json({ status: 'failure', message: 'Request not found' });

    // Authorization verification
    if (Number(reqItem.receiver_id) !== Number(studentProfile.id) && Number(reqItem.receiver_id) !== Number(studentProfile.user_id)) {
        return res.status(403).json({ status: 'failure', message: 'Unauthorized: Only intended recipient can reject this request' });
    }

    reqItem.status = 'rejected';
    await db.saveRequest(reqItem);
    res.json({ status: 'success', message: 'Request declined.' });
});

// 8. POST /api/chat/requests
// Send study partner request with custom intro message
router.post('/requests', auth, async (req, res) => {
    const { receiver_id, intro_message } = req.body;
    let studentProfile = db.profiles.find(p => Number(p.user_id) === Number(req.session.userId));
    if (!studentProfile) {
        studentProfile = {
            id: db.nextId++,
            user_id: req.session.userId,
            name: req.session.name || (req.session.email ? req.session.email.split('@')[0] : 'Student'),
            department: 'General',
            academic_year: '1st Year',
            bio: 'Student on StudyMate',
            available_time: 'Flexible',
            subjects: []
        };
        db.profiles.push(studentProfile);
        db.persist();
    }

    const sender_id = Number(studentProfile.id);
    const targetReceiverId = Number(receiver_id);

    if (sender_id === targetReceiverId) {
        return res.status(400).json({ status: 'failure', message: 'Cannot connect with yourself' });
    }

    const receiver = db.profiles.find(p => Number(p.id) === targetReceiverId || Number(p.user_id) === targetReceiverId);
    if (!receiver) {
        return res.status(404).json({ status: 'failure', message: 'Receiver student profile not found' });
    }

    // Check existing request
    const existing = db.requests.find(r => 
        (Number(r.sender_id) === sender_id && Number(r.receiver_id) === targetReceiverId) ||
        (Number(r.sender_id) === targetReceiverId && Number(r.receiver_id) === sender_id)
    );

    if (existing) {
        if (existing.status === 'pending') {
            return res.status(400).json({ status: 'failure', message: 'A study partner request is already pending between you' });
        }
        if (existing.status === 'accepted') {
            return res.status(400).json({ status: 'failure', message: 'You are already connected as study partners' });
        }
        // If rejected previously, allow re-request
        existing.status = 'pending';
        existing.sender_id = sender_id;
        existing.receiver_id = targetReceiverId;
        existing.intro_message = intro_message || null;
        await db.saveRequest(existing);
        return res.json({ status: 'success', message: 'Study partner request sent' });
    }

    const newRequest = {
        ROWID: db.nextId++,
        sender_id,
        receiver_id: targetReceiverId,
        status: 'pending',
        sender_name: studentProfile.name,
        receiver_name: receiver.name,
        intro_message: intro_message ? intro_message.trim() : null,
        created_at: new Date().toISOString()
    };
    await db.saveRequest(newRequest);

    // Send email to the receiver
    try {
        const receiverUser = db.users.find(u => u.id === receiver.user_id);
        if (receiverUser && receiverUser.email) {
            sendPartnerRequestEmail({
                senderName: studentProfile.name || 'Your classmate',
                senderEmail: req.session.email || '',
                receiverName: receiver.name,
                receiverEmail: receiverUser.email,
                introMessage: newRequest.intro_message || '',
                acceptUrl: 'http://localhost:3000/dashboard.html'
            }).catch(() => {});
        }
    } catch (emailErr) {
        console.error('[Email] Could not send request email:', emailErr.message);
    }

    res.json({ status: 'success', message: 'Study partner request sent', data: newRequest });
});

// 9. POST /api/chat/ai
// Integrated AI Study Assistant within Chat
// Supports study questions, introductory message drafting, scheduling drafts, and study planning
router.post('/ai', auth, async (req, res) => {
    try {
        const { prompt, mode = 'study_help', subject = 'Computer Science' } = req.body;
        if (!prompt || !prompt.trim()) {
            return res.status(400).json({ status: 'failure', message: 'Prompt message is required' });
        }

        const result = await handleChatAssistantPrompt(prompt.trim(), mode, subject);

        res.json({
            status: 'success',
            data: {
                prompt,
                mode,
                response: result.response,
                provider: result.provider
            }
        });
    } catch (err) {
        res.status(500).json({ status: 'failure', message: err.message });
    }
});

module.exports = router;
