const authMiddleware = require('./authenticate');
const db = require('../mockDb');

const adminOnly = (req, res, next) => {
    // 1. Must be authenticated
    if (!req.session || !req.session.userId) {
        return res.status(401).json({ status: 'failure', message: 'Authentication required' });
    }

    // 2. Validate role against trusted server-side record
    const user = db.users.find(u => u.id === req.session.userId);
    const role = req.session.role || user?.role;

    if (role !== 'admin') {
        return res.status(403).json({ 
            status: 'failure', 
            message: 'Forbidden: Administrator privileges required to access this resource' 
        });
    }

    next();
};

module.exports = adminOnly;
