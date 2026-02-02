const mongoose = require('mongoose');

const cardSchema = new mongoose.Schema({
    title: {
        type: String,
        required: [true, 'Card title is required'],
        trim: true,
        maxlength: [200]
    },
    description: {
        type: String,
        trim: true,
        maxlength: [2000]
    },
    list: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'List',
        required: true
    },
    position: {
        type: Number,
        default: 0   // for drag & drop ordering within list
    },
    labels: [{ type: String }],
    comments: [
        {
            text: { type: String, required: true },
            user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
            createdAt: { type: Date, default: Date.now },
        },
    ],
    dueDate: {
        type: Date
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

// Update timestamp on save
cardSchema.pre('save', function () {
    this.updatedAt = Date.now();
});

cardSchema.pre('findOneAndUpdate', function () {
    this.set({ updatedAt: Date.now() });
});

module.exports = mongoose.model('Card', cardSchema);