const express = require('express');
const router = express.Router();
const db = require('../mockDb');
const auth = require('../middleware/authenticate');
const { sendPartnerRequestEmail, sendRequestAcceptedEmail } = require('../services/emailService');

router.post('/', auth, async (req, res) => {
    try {
        const { sender_id, receiver_id, intro_message } = req.body;
        if (!sender_id || !receiver_id) return res.status(400).json({ status: 'failure', message: 'Sender and receiver IDs required' });
        if (Number(sender_id) === Number(receiver_id)) return res.status(400).json({ status: 'failure', message: 'Cannot request yourself' });
        
        const exists = db.requests.find(r => 
            (Number(r.sender_id) === Number(sender_id) && Number(r.receiver_id) === Number(receiver_id)) ||
            (Number(r.sender_id) === Number(receiver_id) && Number(r.receiver_id) === Number(sender_id))
        );

        if (!exists) {
            const sender = db.profiles.find(p => Number(p.id) === Number(sender_id) || Number(p.user_id) === Number(sender_id));
            const receiver = db.profiles.find(p => Number(p.id) === Number(receiver_id) || Number(p.user_id) === Number(receiver_id));
            const newReq = {
                ROWID: db.nextId++,
                sender_id: Number(sender_id),
                receiver_id: Number(receiver_id),
                status: 'pending',
                sender_name: sender?.name || 'Classmate',
                receiver_name: receiver?.name || 'Classmate',
                intro_message: intro_message ? intro_message.trim() : null,
                createdAt: new Date().toISOString()
            };
            await db.saveRequest(newReq);

            // Send real-time email notification to the receiver
            try {
                if (receiver) {
                    const receiverUser = db.users.find(u => Number(u.id) === Number(receiver.user_id));
                    if (receiverUser && receiverUser.email) {
                        sendPartnerRequestEmail({
                            senderName: sender?.name || 'Your classmate',
                            senderEmail: req.session.email || '',
                            receiverName: receiver.name,
                            receiverEmail: receiverUser.email,
                            introMessage: newReq.intro_message || '',
                            acceptUrl: 'http://localhost:3000/dashboard.html'
                        }).catch(() => {});
                    }
                }
            } catch (emailErr) {
                console.error('[Email] Could not send request email:', emailErr.message);
            }

            return res.json({ status: 'success', data: newReq });
        }
        res.json({ status: 'success', data: exists, message: 'Request already exists' });
    } catch (err) {
        res.status(500).json({ status: 'failure', message: err.message });
    }
});

router.get('/:id', auth, (req, res) => {
    try {
        const studentId = Number(req.params.id);
        const incoming = db.requests.filter(r => Number(r.receiver_id) === studentId);
        const outgoing = db.requests.filter(r => Number(r.sender_id) === studentId);
        res.json({ status: 'success', data: { incoming, outgoing } });
    } catch (err) {
        res.status(500).json({ status: 'failure', message: err.message });
    }
});

router.put('/:id', auth, async (req, res) => {
    try {
        const { status } = req.body;
        const reqItem = db.requests.find(r => Number(r.ROWID) === Number(req.params.id) || r.ROWID == req.params.id);
        if (!reqItem) return res.status(404).json({ status: 'failure', message: 'Request not found' });
        reqItem.status = status;
        await db.saveRequest(reqItem);

        // If accepted, send email notification to the original requester
        if (status === 'accepted') {
            try {
                const senderProfile = db.profiles.find(p => Number(p.id) === Number(reqItem.sender_id));
                const senderUser = db.users.find(u => senderProfile && Number(u.id) === Number(senderProfile.user_id));
                const receiverProfile = db.profiles.find(p => Number(p.id) === Number(reqItem.receiver_id));
                if (senderUser && senderUser.email) {
                    sendRequestAcceptedEmail({
                        accepterName: receiverProfile?.name || 'Your classmate',
                        senderName: senderUser.name || senderUser.email,
                        senderEmail: senderUser.email,
                        dashboardUrl: 'http://localhost:3000/dashboard.html'
                    }).catch(() => {});
                }
            } catch (emailErr) {
                console.error('[Email] Could not send accepted email:', emailErr.message);
            }
        }

        res.json({ status: 'success', data: reqItem });
    } catch (err) {
        res.status(500).json({ status: 'failure', message: err.message });
    }
});

module.exports = router;
