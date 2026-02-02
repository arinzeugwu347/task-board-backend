const express = require('express');
const router = express.Router();
const listController = require('../controllers/listController');
const authMiddleware = require('../middleware/auth');

// Reorder first (specific path)
router.patch('/reorder', authMiddleware, listController.reorderLists);

// Then dynamic :id routes
router.patch('/:id', authMiddleware, listController.updateList);
router.delete('/:id', authMiddleware, listController.deleteList);

// Other routes...
router.post('/', authMiddleware, listController.createList);
router.get('/board/:boardId', authMiddleware, listController.getListsForBoard);

module.exports = router;