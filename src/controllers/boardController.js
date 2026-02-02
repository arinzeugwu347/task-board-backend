const mongoose = require('mongoose');
const Board = require('../models/Board');

exports.createBoard = async (req, res) => {
    try{
        const { title, description, backgroundColor } = req.body;

        if(!title) {
            return res.status(400).json({ message: 'Board title is require' });
        }

        const newBoard = new Board({
            title,
            description,
            backgroundColor,
            owner: req.user._id // from middleware!
        });

        await newBoard.save();

        res.status(201).json({
            message: 'Board created successfully',
            board: newBoard
        });
    } catch (error) {
        console.error('Create board error:', error);
        res.status(500).json({message: 'Server error' });
    }
};

exports.getMyBoards = async (req, res) => {
    try{
        const boards = await Board.find({ owner: req.user._id })
        .sort({ updatedAt: -1 }); // newest first

        res.status(200).json({
            message: 'Board fetch successfully',
            boards
        });
    } catch (error) {
        console.error('Get boards error: ', error);
        res.status(500).json({ message: 'Server error' });
    }
};

exports.deleteBoard = async (req, res) => {
    try {
        const { id } = req.params;

        if (!mongoose.isValidObjectId(id)) {
            return res.status(400).json({ message: 'Invalid Board ID' });
        }

        const boards = await Board.findById(id);
        if (!boards) {
            return res.status(404).json({ message: 'Board not found' });
        }

        // Check ownership
        const board = await Board.findOne({
            _id: boards,
            owner: req.user._id
        });
        if (!board) {
            return res.status(403).json({ message: 'You do not own this board' });
        }

        // Delete the list
        await Board.findByIdAndDelete(id);

        res.status(200).json({
            message: 'Board deleted successfully'
        });

    } catch (error) {
        console.error('Delete Board error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};