const authMiddleware = (req, res, next) => {
    if (!req.session || !req.session.userId) {
        return res.status(401).json({ status: 'failure', message: 'Unauthorized' });
    }
    next();
};
module.exports = authMiddleware;
