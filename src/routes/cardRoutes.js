const express = require('express');
const router = express.Router();
const cardController = require('../controllers/cardController');
const authMiddleware = require('../middleware/auth');

// Specific routes first
router.get('/my-tasks', authMiddleware, cardController.getMyTasks);
router.patch('/reorder', authMiddleware, cardController.reorderCards);

// Dynamic :id routes after 
router.patch('/:id', authMiddleware, cardController.updateCard);
router.delete('/:id', authMiddleware, cardController.deleteCard);
router.post('/:cardId/comments', authMiddleware, cardController.addComment);
router.delete('/:cardId/comments/:commentId', authMiddleware, cardController.deleteComment);

// Other Routes 
router.post('/', authMiddleware, cardController.createCard);
router.get('/list/:listId', authMiddleware, cardController.getCardsForList);



module.exports = router