const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const authMiddleware = require('../middleware/auth');


// Public Routes No Auth needed
// POST /api/auth/register
router.post('/register', authController.register);
// POST /api/auth/Login
router.post('/login', authController.login);

// Change user password
router.patch('/change-password', authMiddleware, authController.changePassword);

// Forgot & Reset Password (Public)
router.post('/forgot-password', authController.forgotPassword);
router.post('/reset-password', authController.resetPassword);


// Protected route (needs valid JWT)
router.get('/me', authMiddleware, authController.getMe);

// Upload profile picture
router.post('/upload-profile-picture', authMiddleware, authController.upload.single('image'), authController.changeProfilePicture);

module.exports = router;