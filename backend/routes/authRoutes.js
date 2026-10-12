const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const db = require('../mockDb');
const auth = require('../middleware/authenticate');

// Google OAuth helper
function isGoogleOAuthConfigured() {
    return Boolean(
        process.env.GOOGLE_CLIENT_ID &&
        process.env.GOOGLE_CLIENT_SECRET &&
        process.env.GOOGLE_CLIENT_ID !== 'your_google_client_id_here'
    );
}

// Register endpoint
router.post('/register', async (req, res) => {
    try {
        const { email, password, name, department, academic_year, subjects, bio } = req.body;
        if (!email || !password) {
            return res.status(400).json({ status: 'failure', message: 'Email and password required' });
        }
        
        if (db.users.find(u => u.email.toLowerCase() === email.toLowerCase())) {
            return res.status(400).json({ status: 'failure', message: 'Email already registered. Please sign in.' });
        }
        
        const hash = await bcrypt.hash(password, 10);
        const role = (email.includes('admin@') || db.users.length === 0) ? 'admin' : 'student';
        const userId = db.nextId++;
        const userName = name && name.trim() ? name.trim() : email.split('@')[0].replace(/[._]/g, ' ').replace(/\b\w/g, l => l.toUpperCase());

        const newUser = {
            id: userId,
            name: userName,
            email: email.trim().toLowerCase(),
            password_hash: hash,
            role
        };
        await db.saveUser(newUser);

        // Automatically create a student profile for the new user
        const profileId = db.nextId++;
        const subjectsArr = Array.isArray(subjects) && subjects.length > 0
            ? subjects
            : (typeof subjects === 'string' && subjects.trim()
                ? subjects.split(',').map(s => s.trim()).filter(Boolean)
                : []);
        const newProfile = {
            id: profileId,
            user_id: userId,
            name: userName,
            department: department || 'Computer Science and Engineering',
            academic_year: academic_year || '1st Year',
            bio: bio || 'Excited to collaborate on coursework, assignments, and exam preparation.',
            available_time: 'Evenings & Weekends',
            subjects: subjectsArr
        };
        await db.saveProfile(newProfile);
        
        req.session.userId = newUser.id;
        req.session.email = newUser.email;
        req.session.role = role;
        req.session.profileId = profileId;

        res.status(201).json({
            status: 'success',
            data: {
                userId: newUser.id,
                profileId,
                name: userName,
                email: newUser.email,
                role
            }
        });
    } catch (err) {
        console.error('[Register Error]', err);
        res.status(500).json({ status: 'failure', message: 'Registration failed: ' + err.message });
    }
});

// Login endpoint
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({ status: 'failure', message: 'Email and password required' });
        }

        const user = db.users.find(u => u.email.toLowerCase() === email.trim().toLowerCase());
        
        if (!user || !(await bcrypt.compare(password, user.password_hash))) {
            return res.status(401).json({ status: 'failure', message: 'Invalid email or password' });
        }

        // Google OAuth users may not have a password_hash — handled separately
        if (user.google_id && !user.password_hash) {
            return res.status(401).json({ status: 'failure', message: 'This account uses Google Sign-In. Please use the "Sign in with Google" button.' });
        }
        
        // Find existing profile or create one if missing
        let profile = db.profiles.find(p => p.user_id === user.id);
        if (!profile) {
            profile = {
                id: db.nextId++,
                user_id: user.id,
                name: user.name || user.email.split('@')[0],
                department: 'Computer Science and Engineering',
                academic_year: '1st Year',
                bio: 'StudyMate Member',
                available_time: 'Evenings',
                subjects: []
            };
            await db.saveProfile(profile);
        }

        req.session.userId = user.id;
        req.session.email = user.email;
        req.session.role = user.role || 'student';
        req.session.profileId = profile.id;

        res.json({
            status: 'success',
            data: {
                userId: user.id,
                profileId: profile.id,
                name: profile.name || user.name,
                email: user.email,
                role: req.session.role
            }
        });
    } catch (err) {
        console.error('[Login Error]', err);
        res.status(500).json({ status: 'failure', message: 'Login failed: ' + err.message });
    }
});

// Logout endpoint
router.post('/logout', (req, res) => {
    req.session.destroy();
    res.clearCookie('studymate_session');
    res.json({ status: 'success' });
});

// Current user profile endpoint
router.get('/me', auth, (req, res) => {
    const user = db.users.find(u => u.id === req.session.userId);
    const profile = db.profiles.find(p => p.user_id === req.session.userId);
    const role = req.session.role || user?.role || 'student';
    res.json({
        status: 'success',
        data: {
            userId: req.session.userId,
            email: req.session.email,
            profileId: profile?.id,
            name: profile?.name || user?.name || req.session.email,
            department: profile?.department,
            role,
            isGoogleUser: Boolean(user?.google_id)
        }
    });
});

// --- Google OAuth 2.0 Routes ---

// GET /api/auth/google — Redirect to Google's OAuth consent screen
router.get('/google', (req, res) => {
    if (!isGoogleOAuthConfigured()) {
        return res.status(503).json({
            status: 'failure',
            message: 'Google OAuth is not configured. Please add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to your .env file.'
        });
    }
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const callbackUrl = encodeURIComponent(process.env.GOOGLE_CALLBACK_URL || 'http://localhost:3000/api/auth/google/callback');
    const scope = encodeURIComponent('openid email profile');
    const googleOAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${callbackUrl}&response_type=code&scope=${scope}&access_type=offline&prompt=select_account`;
    res.redirect(googleOAuthUrl);
});

// GET /api/auth/google/callback — Handle Google OAuth callback
router.get('/google/callback', async (req, res) => {
    const { code, error } = req.query;

    if (error || !code) {
        return res.redirect('/?error=google_auth_failed');
    }

    if (!isGoogleOAuthConfigured()) {
        return res.redirect('/?error=oauth_not_configured');
    }

    try {
        // Exchange code for tokens
        const https = require('https');
        const querystring = require('querystring');

        const tokenParams = querystring.stringify({
            code,
            client_id: process.env.GOOGLE_CLIENT_ID,
            client_secret: process.env.GOOGLE_CLIENT_SECRET,
            redirect_uri: process.env.GOOGLE_CALLBACK_URL || 'http://localhost:3000/api/auth/google/callback',
            grant_type: 'authorization_code'
        });

        const tokenResponse = await new Promise((resolve, reject) => {
            const req = https.request({
                hostname: 'oauth2.googleapis.com',
                path: '/token',
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Content-Length': Buffer.byteLength(tokenParams)
                }
            }, (r) => {
                let data = '';
                r.on('data', chunk => data += chunk);
                r.on('end', () => {
                    try { resolve(JSON.parse(data)); }
                    catch(e) { reject(new Error('Failed to parse token response')); }
                });
            });
            req.on('error', reject);
            req.write(tokenParams);
            req.end();
        });

        if (!tokenResponse.access_token) {
            throw new Error('No access token received from Google');
        }

        // Get user info from Google
        const userInfo = await new Promise((resolve, reject) => {
            const req = https.request({
                hostname: 'www.googleapis.com',
                path: '/oauth2/v2/userinfo',
                method: 'GET',
                headers: { 'Authorization': `Bearer ${tokenResponse.access_token}` }
            }, (r) => {
                let data = '';
                r.on('data', chunk => data += chunk);
                r.on('end', () => {
                    try { resolve(JSON.parse(data)); }
                    catch(e) { reject(new Error('Failed to parse user info')); }
                });
            });
            req.on('error', reject);
            req.end();
        });

        if (!userInfo.email) {
            throw new Error('Could not retrieve email from Google account');
        }

        const googleEmail = userInfo.email.toLowerCase();
        const googleName = userInfo.name || googleEmail.split('@')[0];
        const googleId = userInfo.id;

        // Find or create the user
        let user = db.users.find(u => u.email.toLowerCase() === googleEmail || u.google_id === googleId);

        if (!user) {
            // New Google user — register them
            const userId = db.nextId++;
            const role = db.users.length === 0 ? 'admin' : 'student';
            user = {
                id: userId,
                name: googleName,
                email: googleEmail,
                google_id: googleId,
                password_hash: null,
                role
            };
            await db.saveUser(user);

            // Create profile
            const profileId = db.nextId++;
            const newProfile = {
                id: profileId,
                user_id: userId,
                name: googleName,
                department: 'Computer Science and Engineering',
                academic_year: '1st Year',
                bio: 'StudyMate Member (signed in with Google)',
                available_time: 'Flexible',
                subjects: []
            };
            await db.saveProfile(newProfile);
        } else if (!user.google_id) {
            // Existing email-password user — link Google account
            user.google_id = googleId;
            await db.saveUser(user);
        }

        const profile = db.profiles.find(p => p.user_id === user.id);

        req.session.userId = user.id;
        req.session.email = user.email;
        req.session.role = user.role || 'student';
        req.session.profileId = profile?.id;

        res.redirect('/dashboard.html');

    } catch (err) {
        console.error('[Google OAuth Error]', err.message);
        res.redirect(`/?error=${encodeURIComponent(err.message)}`);
    }
});

// GET /api/auth/google/status — Check if Google OAuth is configured
router.get('/google/status', (req, res) => {
    res.json({
        status: 'success',
        data: {
            configured: isGoogleOAuthConfigured(),
            message: isGoogleOAuthConfigured()
                ? 'Google OAuth is ready'
                : 'Google OAuth not configured. Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to .env'
        }
    });
});

module.exports = router;
