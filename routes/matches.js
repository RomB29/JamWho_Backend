const express = require('express');
const router = express.Router();
const matchController = require('../controllers/matchController');
const auth = require('../middleware/auth');

// Toutes les routes nécessitent une authentification
router.use(auth);

router.get('/', matchController.getMatches);
router.get('/:id', matchController.getMatch);

module.exports = router;

