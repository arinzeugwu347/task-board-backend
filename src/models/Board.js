const mongoose = require('mongoose');


const boardSchema = new mongoose.Schema({
    title: {
        type: String,
        required: [true, 'Board title is required'],
        trim: true,
        maxlength: [100, 'Title cannot be more than 100 characters']
    },
    description: {
        type: String,
        trim: true,
        maxlength: [500, 'Description cannot exceed 500 characters']
    },
    owner: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    backgroundColor: {
        type: String,
        default: '#0079bf' // default Trello-like blue
    },
    lists: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'List' // We'll create List model later
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

// IMPORTANT: Regular function (NOT arrow function) for pre hooks
boardSchema.pre('save', function () {
    this.updatedAt = Date.now();
});

// Also update updatedAt on findOneAndUpdate
boardSchema.pre('findOneAndUpdate', function () {
    this.set({ updatedAt: Date.now() });
});

// Optional: index for faster queries by owner
boardSchema.index({ owner: 1 });

module.exports = mongoose.model('Board', boardSchema);