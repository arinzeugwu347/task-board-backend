const mongoose = require('mongoose'); // make sure this is at the top of listController.js
const List = require('../models/List');
const Board = require('../models/Board');
const Card = require('../models/Card');

exports.createList = async (req, res) => {
    try {
        const { boardId, title, position } = req.body;

        if (!boardId || !title) {
            return res.status(400).json({ message: 'Board ID and title are required' });
        }
        // Add the isValidObjectId check — it prevents database errors when someone sends nonsense like /board/abc or /board/123
        if (!mongoose.isValidObjectId(boardId)) {
            return res.status(400).json({ message: 'Invalid boardId format (must be valid ObjectId)' });
        }



        // Verify the board exists and belongs to the user
        const board = await Board.findOne({ _id: boardId, owner: req.user._id });

        if (!board) {
            return res.status(404).json({ message: 'Board not found or not owned by you' });
        }

        const newList = new List({
            title,
            board: boardId,
            position: position || board.lists.length // Default to end
        });

        await newList.save();

        // Add list to board's lists array
        board.lists.push(newList._id);
        await board.save();

        res.status(201).json({
            message: 'List created successfully',
            list: newList
        });
    } catch (error) {
        console.error('Create list error', error);
        res.status(500).json({ message: 'Server error' });
    }
};

exports.getListsForBoard = async (req, res) => {
    try {
        // Safe extraction + validation
        const boardId = req.params?.boardId;

        if (!boardId) {
            return res.status(400).json({ message: 'boardId is required in URL' });
        }

        const board = await Board.findOne({
            _id: boardId,
            owner: req.user._id
        });

        if (!board) {
            res.status(404).json({ message: 'Board not found or not owner by you' })
        }

        const lists = await List.find({ board: boardId })
            .sort({ position: 1 });

        res.status(200).json({
            message: 'List fetched successfully',
            lists
        });
    } catch (error) {
        console.error('Get lists error', error)
        res.status(500).json({ message: 'Server error' });
    }
}


// PATCH /api/lists/:id - Update list
exports.updateList = async (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body; // allowed: title, position

        if (!mongoose.isValidObjectId(id)) {
            return res.status(400).json({ message: 'Invalid list ID' });
        }

        const list = await List.findById(id);

        if (!list) {
            return res.status(404).json({ message: 'List not found' });
        }

        // Check ownership via board
        const board = await Board.findOne({
            _id: list.board,
            owner: req.user._id
        });

        if (!board) {
            return res.status(403).json({ message: 'You do not own this board' });
        }

        // Only allow certain fields
        const allowedUpdates = ['title', 'position'];
        const validUpdates = {};

        allowedUpdates.forEach(field => {
            if (updates[field] !== undefined) {
                validUpdates[field] = updates[field];
            }
        });

        if (Object.keys(validUpdates).length === 0) {
            return res.status(400).json({ message: 'No valid fields to update' });
        }

        // Apply updates
        Object.assign(list, validUpdates);
        await list.save();

        res.status(200).json({
            message: 'List updated successfully',
            list
        });
    } catch (error) {
        console.error('Update list error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// DELETE /api/lists/:id - Delete list
exports.deleteList = async (req, res) => {
    try {
        const { id } = req.params;

        if (!mongoose.isValidObjectId(id)) {
            return res.status(400).json({ message: 'Invalid list ID' });
        }

        const list = await List.findById(id);
        if (!list) {
            return res.status(404).json({ message: 'List not found' });
        }

        // Check ownership
        const board = await Board.findOne({
            _id: list.board,
            owner: req.user._id
        });
        if (!board) {
            return res.status(403).json({ message: 'You do not own this board' });
        }

        // Remove list from board's lists array
        board.lists = board.lists.filter(listId => listId.toString() !== id);
        await board.save();

        // Delete all cards in this list (optional - clean up)
        await Card.deleteMany({ list: id });

        // Delete the list
        await List.findByIdAndDelete(id);

        // Recalculate positions of remaining lists in the board
        const remainingLists = await List.find({ board: list.board })
            .sort({ position: 1 });  // get them in current order

        const bulkRecalc = remainingLists.map((lst, newIndex) => ({
            updateOne: {
                filter: { _id: lst._id },
                update: { $set: { position: newIndex } }
            }
        }));

        if (bulkRecalc.length > 0) {
            await List.bulkWrite(bulkRecalc);
        }

        res.status(200).json({
            message: 'List and its cards deleted successfully'
        });
    } catch (error) {
        console.error('Delete list error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};


// PATCH /api/lists/reorder - Reorder multiple lists in a board
exports.reorderLists = async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const { boardId, orderedListIds } = req.body;

        if (!boardId || !Array.isArray(orderedListIds)) {
            return res.status(400).json({ message: 'boardId and orderedListIds array are required' });
        }

        if (!mongoose.isValidObjectId(boardId)) {
            return res.status(400).json({ message: 'Invalid boardId' });
        }

        // Verify board ownership
        const board = await Board.findOne({ _id: boardId, owner: req.user._id });

        if (!board) {
            return res.status(403).json({ message: 'You do not own this board' });
        }

        // Verify all IDs are valid and belong to this board
        const existingLists = await List.find({
            _id: { $in: orderedListIds },
            board: boardId
        }).session(session);

        if (existingLists.length !== orderedListIds.length) {
            throw new Error('Some list IDs are invalid or do not belong to this board');
        }

        // Update positions (0-based index in the array)
        const bulkOps = orderedListIds.map((listId, index) => ({
            updateOne: {
                filter: { _id: listId },
                update: { $set: { position: index } }
            }
        }));

        await List.bulkWrite(bulkOps, { session });

        // Update board.lists order (optional but recommended)
        board.lists = orderedListIds;
        await board.save({ session });

        // If everything succeeded → commit
        await session.commitTransaction();

        res.status(200).json({
            message: 'Lists reordered successfully',
            orderedListIds,
            positions: orderedListIds.map((_, i) => i)
        });

    } catch (error) {
        // Rollback on any error
        await session.abortTransaction();
        console.error('Reorder lists error:', error);

        // Send proper status based on error type
        if (error.message.includes('You do not own')) {
            return res.status(403).json({ message: error.message });
        }
        if (error.message.includes('Some list IDs')) {
            return res.status(400).json({ message: error.message });
        }

        res.status(500).json({ message: 'Server error during reorder' });
    } finally {
        session.endSession();
    }
};