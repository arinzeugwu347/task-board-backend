const mongoose = require('mongoose');
const Card = require('../models/Card');
const List = require('../models/List');
const Board = require('../models/Board');

exports.createCard = async (req, res) => {
    try {
        const { listId, title, description, position, labels, dueDate } = req.body

        if (!mongoose.isValidObjectId(listId)) {
            return res.status(400).json({
                message: 'Invalid listId — must be a valid MongoDB ObjectId (24 hex characters)'
            });
        }

        if (!listId || !title) {
            return res.status(400).json({
                message: 'List ID and title are required'
            });
        }

        //Find the List
        const list = await List.findById(listId);

        if (!list) {
            return res.status(404).json({ message: 'List not found' });
        }

        // Check if the list's board belongs to the current user
        const board = await Board.findOne({ _id: list.board, owner: req.user._id });

        if (!board) {
            return res.status(403).json({ message: 'You do not own this board' })
        }

        const newCard = new Card({
            title,
            description,
            list: listId,
            position: position || list.cards.length, // default to end
            labels: labels,
            dueDate
        });

        await newCard.save();

        //Add card to list's card array
        list.cards.push(newCard._id);
        await list.save();

        res.status(201).json({
            message: 'Card created successfully',
            card: newCard
        });

    } catch (error) {
        console.error('Create Card Error', error);
        res.status(500).json({ message: 'Server Error' });
    }
};


exports.getCardsForList = async (req, res) => {
    try {
        const { listId } = req.params;

        if (!listId) {
            return res.status(400).json({ message: 'listId is required in URL' })
        }

        const list = await List.findById(listId);

        if (!list) {
            return res.status(403).json({ message: 'List not found' });
        }

        //check for board ownership
        const board = await Board.findOne({ _id: list.board, owner: req.user._id });

        if (!board) {
            return res.status(403).json({ message: 'You do not own this board' });
        }

        const cards = await Card.find({ list: listId })
            .sort({ position: 1 });

        res.status(200).json({
            message: 'Cards fetched successfully',
            cards
        });
    } catch (error) {
        console.error('Get Card Error', error);
        res.status(500).json({ message: 'Server error' });
    }

};

// PATCH /api/cards/:id
exports.updateCard = async (req, res) => {

    try {
        const { id } = req.params;
        const updates = req.body; // fields to update: title, description, position, labels, dueDate, etc.

        if (!mongoose.isValidObjectId(id)) {
            return res.status(400).json({ message: 'Invalid card ID format' });
        }

        //find the card
        const card = await Card.findById(id);

        if (!card) {
            return res.status(404).json({ message: 'Card not found' });
        }

        // Find the list → board → check ownership
        const list = await List.findById(card.list);

        if (!list) {
            return res.status(404).json({ message: 'List not found' });
        }

        const board = await Board.findOne({ _id: list.board, owner: req.user._id });


        // Compare as strings to avoid ObjectId type issues
        if (!board) {
            return res.status(403).json({ message: 'You do not own this board' });
        }

        //Apply updates (only allowed fields)
        const allowedUpdates = ['title', 'description', 'position', 'labels', 'dueDate'];
        const actualUpadates = {};

        for (const key of allowedUpdates) {
            if (updates[key] !== undefined) {
                actualUpadates[key] = updates[key];
            }
        }

        // if no valid fields were sent
        if (Object.keys(actualUpadates).length === 0) {
            return res.status(400).json({ message: 'No valid fields to update' })
        }

        //update the Card
        Object.assign(card, actualUpadates);
        await card.save();

        res.status(200).json({
            message: 'Card updated successfully',
            card
        });
    } catch (error) {
        console.error('Update card error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};


// DELETE /api/cards/:id
exports.deleteCard = async (req, res) => {
    try {
        const { id } = req.params;

        if (!mongoose.isValidObjectId(id)) {
            return res.status(400).json({ message: 'Invalid card ID format' });
        }

        const card = await Card.findById(id);

        if (!card) {
            return res.status(404).json({ message: 'Card not found' });
        }

        // Check ownership via list → board
        const list = await List.findById(card.list);

        if (!list) {
            return res.status(404).json({ message: 'List not found' });
        }

        const board = await Board.findOne({ _id: list.board, owner: req.user._id });

        if (!board) {
            return res.status(403).json({ message: 'You do not own this board' });
        }

        // Remove card from list's cards array
        list.cards = list.cards.filter(cardId => cardId.toString() !== id);
        await list.save();

        //delete card
        await Card.findByIdAndDelete(id);

        // Recalculate positions of remaining cards in the list
        const remainingCards = await Card.find({ list: list._id })
            .sort({ position: 1 });

        const bulkRecalc = remainingCards.map((card, newIndex) => ({
            updateOne: {
                filter: { _id: card._id },
                update: { $set: { position: newIndex } }
            }
        }));

        if (bulkRecalc.length > 0) {
            await Card.bulkWrite(bulkRecalc);
        }

        res.status(200).json({
            message: 'Card deleted successfully'
        });

    } catch (error) {
        console.error('Delete card error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};


// PATCH /api/cards/reorder - Reorder multiple cards in a list
exports.reorderCards = async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const { listId, orderedCardIds } = req.body;

        if (!listId || !Array.isArray(orderedCardIds)) {
            return res.status(400).json({ message: 'listId and orderedCardIds array are required' });
        }

        if (!mongoose.isValidObjectId(listId)) {
            return res.status(400).json({ message: 'Invalid listId' });
        }

        // Find list
        const list = await List.findById(listId);

        if (!list) {
            return res.status(404).json({ message: 'List not found' });
        }

        // Check board ownership
        const board = await Board.findOne({ _id: list.board, owner: req.user._id }).session(session);

        if (!board) {
            throw new Error('You do not own this board');
        }

        // Verify all cards belong to this list
        const existingCards = await Card.find({
            _id: { $in: orderedCardIds },
            list: listId
        }).session(session);

        if (existingCards.length !== orderedCardIds.length) {
            throw new Error('Some Card IDs are invalid or do not belong to this board');
        }

        // Update positions
        const bulkOps = orderedCardIds.map((cardId, index) => ({
            updateOne: {
                filter: { _id: cardId },
                update: { $set: { position: index } }
            }
        }));

        await Card.bulkWrite(bulkOps, { session });

        // Update list.cards order (optional but keeps consistency)
        list.cards = orderedCardIds;
        await list.save({ session });

        // If everything succeeded → commit
        await session.commitTransaction();

        res.status(200).json({
            message: 'Cards reordered successfully',
            orderedCardIds,
            position: orderedCardIds.map((_, i) => i) // [0, 1, 2, ...]
        });

    } catch (error) {
        // Rollback on any error
        await session.abortTransaction();
        console.error('Reorder cards error:', error);

        // Send proper status based on error type
        if (error.message.includes('You do not own')) {
            return res.status(403).json({ message: error.message });
        }
        if (error.message.includes('Some Card IDs')) {
            return res.status(400).json({ message: error.message });
        }

        res.status(500).json({ message: 'Server error during reorder' });
    } finally {
        session.endSession();
    }
};

// POST /api/cards/:cardId/comments
exports.addComment = async (req, res) => {
    try {
        const { cardId } = req.params; // ← change from id to cardId
        const { text } = req.body;

        if (!mongoose.isValidObjectId(cardId)) return res.status(400).json({ message: 'Invalid card ID' });

        const card = await Card.findById(cardId);
        if (!card) return res.status(404).json({ message: 'Card not found' });

        // Find the list → board → check ownership
        const list = await List.findById(card.list);

        if (!list) {
            return res.status(404).json({ message: 'List not found' });
        }

        const board = await Board.findOne({ _id: list.board, owner: req.user._id });


        // Compare as strings to avoid ObjectId type issues
        if (!board) {
            return res.status(403).json({ message: 'You do not own this board' });
        }

        if (!text.trim()) return res.status(400).json({ message: 'Comment text required' });

        card.comments.push({ text: text.trim(), user: req.user._id });
        await card.save();

        // Populate user for response (optional, for username)
        await card.populate('comments.user', 'username');

        res.json({ message: 'Comment added', card });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

exports.deleteComment = async (req, res) => {
    try {
        const { cardId, commentId } = req.params;

        if (!mongoose.isValidObjectId(cardId) || !mongoose.isValidObjectId(commentId)) {
            return res.status(400).json({ message: 'Invalid card or comment ID' });
        }

        const card = await Card.findById(cardId);
        if (!card) {
            return res.status(404).json({ message: 'Card not found' });
        }

        // Check board ownership via list
        const list = await List.findById(card.list);
        if (!list) {
            return res.status(404).json({ message: 'List not found' });
        }

        const board = await Board.findOne({ _id: list.board, owner: req.user._id });
        if (!board) {
            return res.status(403).json({ message: 'You do not own this board' });
        }

        // Remove comment by ID
        const initialLength = card.comments.length;
        card.comments = card.comments.filter(c => c._id.toString() !== commentId);

        if (card.comments.length === initialLength) {
            return res.status(404).json({ message: 'Comment not found' });
        }

        await card.save();

        res.status(200).json({ message: 'Comment deleted successfully', card });
    } catch (err) {
        console.error('Delete comment error:', err);
        res.status(500).json({ message: 'Server error' });
    }
};

// PATCH /api/cards/reorder
exports.reorderCards = async (req, res) => {
    try {
        const { listId, cardIds } = req.body;

        if (!mongoose.isValidObjectId(listId) || !Array.isArray(cardIds)) {
            return res.status(400).json({ message: 'Invalid list ID or card IDs' });
        }

        // Validate all card IDs
        if (!cardIds.every(id => mongoose.isValidObjectId(id))) {
            return res.status(400).json({ message: 'Invalid card ID in list' });
        }

        // 1. Verify list exists and user has access
        const list = await List.findById(listId);
        if (!list) {
            return res.status(404).json({ message: 'List not found' });
        }

        const board = await Board.findOne({ _id: list.board, owner: req.user._id });
        if (!board) {
            return res.status(403).json({ message: 'You do not own this board' });
        }

        // 2. Update each card's position and list reference
        const updates = cardIds.map((id, index) => {
            return Card.findByIdAndUpdate(id, { position: index, list: listId });
        });

        await Promise.all(updates);

        res.status(200).json({ message: 'Cards reordered successfully' });
    } catch (err) {
        console.error('Reorder cards error:', err);
        res.status(500).json({ message: 'Failed to reorder cards' });
    }
};

// GET /api/cards/my-tasks
exports.getMyTasks = async (req, res) => {
    try {
        // Find all boards owned by the user
        const boards = await Board.find({ owner: req.user._id }).select('_id');
        const boardIds = boards.map(b => b._id);

        // Find all lists in these boards
        const lists = await List.find({ board: { $in: boardIds } }).select('_id');
        const listIds = lists.map(l => l._id);

        // Find all cards in these lists
        // Populate list and board details for context if needed
        const cards = await Card.find({ list: { $in: listIds } })
            .populate({
                path: 'list',
                select: 'title board',
                populate: {
                    path: 'board',
                    select: 'title'
                }
            })
            .sort({ dueDate: 1, createdAt: -1 }); // Sort by due date, then newest

        res.status(200).json({ cards });
    } catch (err) {
        console.error('Get my tasks error:', err);
        res.status(500).json({ message: 'Failed to fetch your tasks' });
    }
};
