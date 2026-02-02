const express = require('express');
const router = express.Router();
const boardController = require('../controllers/boardController');
const authMiddleware = require('../middleware/auth');

router.delete('/:id', authMiddleware, boardController.deleteBoard);

router.post('/', authMiddleware, boardController.createBoard);
router.get('/', authMiddleware, boardController.getMyBoards);

module.exports = router;