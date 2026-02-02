const User = require('../models/User');
const PasswordReset = require('../models/PasswordReset');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cloudinary = require('cloudinary').v2;
const multer = require('multer');
const crypto = require('crypto');
const { Resend } = require('resend');

// Email service
const resend = new Resend(process.env.RESEND_API_KEY);

// Configure Cloudinary
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME || 'dj1g5has2',
    api_key: process.env.CLOUDINARY_API_KEY || '293994485159386',
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true
});

// Multer storage in memory
const storage = multer.memoryStorage();
exports.upload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});


// Register Controller
exports.register = async (req, res) => {
    try {
        const { name, email, password } = req.body;

        // 1. Basic validation (we can improve with express-validator later)
        if (!name || !email || !password) {
            return res.status(400).json({ message: 'name , email and password are required' });
        }
        // min password length check
        if (password.length < 6) {
            return res.status(400).json({ message: 'Password must be at least 6 characters long' });
        }

        // 2. Check if user already exists
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ message: 'User with this email already exists' });
        }

        // 3. Hash the password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // 4. Create new user
        const newUser = new User({
            name,
            email,
            password: hashedPassword
        });

        await newUser.save();

        // 5. Create JWT Token (we'll send it back so user is "logged in " immediately after registration)
        const payload = { id: newUser._id };
        const token = jwt.sign(payload, process.env.JWT_SECRET, {
            expiresIn: '7d' // Token valid for 7 days
        });

        // 6. Send response (without password) 
        res.status(201).json({
            message: 'User registered successfully',
            token,
            user: {
                id: newUser._id,
                name: newUser.name,
                email: newUser.email,
            }

        });
    } catch (error) {
        console.error('Register error:', error);
        res.status(500).json({ message: 'Server error during registration' });
    }
};


// Login Controller (Placeholder for now)
exports.login = async (req, res) => {
    try {
        const { email, password } = req.body;

        //1. Basic validation
        if (!email || !password) {
            return res.status(400).json({
                message: 'Email and password are required'
            });
        }

        //Check email format
        if (!/^\S+@\S+\.\S+$/.test(email)) {
            return res.status(400).json({ message: 'Please enter a valid email' });
        }

        //Check minimum password length
        if (password.length < 6) {
            return res.status(400).json({ message: 'Password must be at least 6 characters' });
        }

        //2.  Find user by email
        const user = await User.findOne({ email }).select('+password');
        // We used .select('+password') because we hid password by default in User model with toJSON method

        if (!user) {
            return res.status(400).json({
                message: 'Invalid credentials'
            });
        }

        //3. Compare provided password with stored hashed password
        // get hashed password from DB
        const isMatch = await bcrypt.compare(password, user.password);

        if (!isMatch) {
            return res.status(400).json({
                message: 'Invalid credentials'
            });
        }

        //4. Password is correct -> Create JWT Token
        const payload = { id: user._id };
        const token = jwt.sign(payload, process.env.JWT_SECRET, {
            expiresIn: '7d' // Token valid for 7 days
        });

        //5. Send response (without password)
        res.status(200).json({
            message: 'Login successful',
            token,
            user: {
                id: user._id,
                name: user.name,
                email: user.email
            }
        });

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ message: 'Server error during login' });
    }
};

// Protected route 
exports.getMe = async (req, res) => {
    try {
        // req.user is already set by middleware
        res.status(200).json({
            message: 'User profile fetched successfully',
            user: req.user
        });
    } catch (error) {
        console.error('Get me error', error);
        res.status(500).json({
            message: 'Server error'
        });
    }
};


// Change user password
exports.changePassword = async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        const user = await User.findById(req.user._id);

        if (!user) return res.status(404).json({ message: 'User not found' });

        const isMatch = await bcrypt.compare(currentPassword, user.password);
        if (!isMatch) return res.status(400).json({ message: 'Current password incorrect' });

        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(newPassword, salt);
        await user.save();

        res.json({ message: 'Password changed successfully' });
    } catch (err) {
        res.status(500).json({ message: 'Server error' });
    }
};



exports.changeProfilePicture = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'No file uploaded' });
        }

        // Upload to Cloudinary using stream
        const uploadToCloudinary = () => {
            return new Promise((resolve, reject) => {
                const uploadStream = cloudinary.uploader.upload_stream(
                    { folder: 'task-board-avatars' },
                    (error, result) => {
                        if (error) return reject(error);
                        resolve(result);
                    }
                );
                uploadStream.end(req.file.buffer);
            });
        };

        const result = await uploadToCloudinary();

        const user = await User.findByIdAndUpdate(
            req.user._id,
            { profilePicture: result.secure_url },
            { new: true }
        );

        res.json({
            message: 'Profile picture updated successfully',
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                profilePicture: user.profilePicture
            }
        });
    } catch (err) {
        console.error('Upload error:', err);
        res.status(500).json({ message: 'Server error during upload' });
    }
};

// Forgot Password
exports.forgotPassword = async (req, res) => {
    try {
        const { email } = req.body;
        const user = await User.findOne({ email });

        if (!user) {
            // Send 200 even if user doesn't exist for security (avoid enumeration)
            return res.status(200).json({ message: 'If an account exists with that email, a reset link has been sent.' });
        }

        // Delete any existing tokens for this user
        await PasswordReset.deleteMany({ userId: user._id });

        // Create new token
        const resetToken = crypto.randomBytes(32).toString('hex');
        await new PasswordReset({
            userId: user._id,
            token: resetToken
        }).save();

        // MOCK EMAIL: Log the URL to the console
        // const resetUrl = `http://localhost:5173/reset-password/${resetToken}`;
        // console.log('\n=========================================');
        // console.log('PASSWORD RESET LINK (MOCKED EMAIL):');
        // console.log(resetUrl);
        // console.log('=========================================\n');

        //Send Email
        const sendResetEmail = async (to, resetToken) => {
            const resetLink = `${process.env.FRONTEND_URL}/reset-password/${resetToken}`;

            await resend.emails.send({
                from: `Task Board <no-reply@${process.env.EMAIL_DOMAIN}>`,
                to,
                subject: 'Reset Your Password',
                html: `
                    <h2>Password Reset</h2>
                    <p>Click to reset:</p>
                    <a href="${resetLink}">Reset Password</a>
                    `,
            });
        };

        sendResetEmail(user.email, resetToken);

        res.status(200).json({ message: 'If an account exists with that email, a reset link has been sent.' });
    } catch (err) {
        console.error('Forgot password error:', err);
        res.status(500).json({ message: 'Server error' });
    }
};

// Reset Password
exports.resetPassword = async (req, res) => {
    try {
        const { token, newPassword } = req.body;

        const resetDoc = await PasswordReset.findOne({ token });
        if (!resetDoc) {
            return res.status(400).json({ message: 'Invalid or expired reset token' });
        }

        const user = await User.findById(resetDoc.userId);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Hash the new password (manual hashing as requested by user previously)
        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(newPassword, salt);
        await user.save();

        // Delete the token after use
        await PasswordReset.deleteOne({ _id: resetDoc._id });

        res.json({ message: 'Password has been reset successfully' });
    } catch (err) {
        console.error('Reset password error:', err);
        res.status(500).json({ message: 'Server error' });
    }
};