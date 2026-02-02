const mongoose = require('mongoose');
const { create } = require('./Board');

const listSchema = new mongoose.Schema({
    title: {
        type: String,
        required: [true, 'list title is required'],
        trim: true,
        maxlength: [100]
    },
    board: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Board',
        required: true
    },
    position: {
        type: Number,
        default: 0 // For Drag and Drop Ordering later
    },
    cards: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Card' // We'll create Card Later
    }],
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});


//Update timestamp on save
listSchema.pre('save', function() {
    this.updatedAt = Date.now();
});

listSchema.pre('findOneAndUpdate', function() {
    this.set({
        updatedAt: Date.now()
    });
});


module.exports = mongoose.model('List', listSchema);