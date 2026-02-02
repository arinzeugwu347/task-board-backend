const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true,
        minlenghth: [2, 'Name must be at least 2 characters long']
    },
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true,
        //Very basic email format check (we'll improve later if needed)
        match: [/.+@.+\..+/, 'Please fill a valid email address']
    },
    password: {
        type: String,
        required: [true, 'Password is required'],
        minlenghth: [6, 'Password must be at least 6 characters long']
        // We'll hash passwords before saving -> Never store plain text passwords
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    profilePicture: {
        type: String,
        default: ''
    }
});

// Very important: remove password from resrponses automatically
userSchema.methods.toJSON = function () {
    const user = this.toObject();
    delete user.password;
    return user;
}

module.exports = mongoose.model('User', userSchema);
