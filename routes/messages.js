const express = require('express');
const router = express.Router();
const messageController = require('../controllers/messageController');
const auth = require('../middleware/auth');

// Toutes les routes nécessitent une authentification
router.use(auth);

router.get('/conversations', messageController.getConversations);
router.get('/:conversationId', messageController.getMessages);
router.post('/', messageController.sendMessage);
router.put('/:conversationId/read', messageController.markAsRead);

module.exports = router;

