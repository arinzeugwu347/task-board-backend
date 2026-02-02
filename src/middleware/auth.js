const jwt = require('jsonwebtoken');
const User = require('../models/User');

const authMiddleware = async (req, res, next) => {
    try {
        // 1. Get token from header (Authorization: Bearer <token>)
        const authHeader = req.header('Authorization');

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ message: 'No token, authorization denied' });
        }

        const token = authHeader.replace('Bearer ', '');

        // 2. Verify the token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // 3. Find the user by ID from token payload
        const user = await User.findById(decoded.id).select('+password');

        if (!user) {
            return res.status(401).json({ message: 'User not found - token invalid' });
        }

        // 4. Attach the user to the request object
        req.user = user;

        // 5. Continue to the next middleware/route
        next();

    } catch (error) {
        console.error('Auth middleware error:', error.message);

        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({ message: 'Token has expired' });
        }

        return res.status(401).json({ message: 'Token is not valid' });
    }
};

module.exports = authMiddleware;