const express = require('express');
const router = express.Router();
const matchController = require('../controllers/matchController');
const auth = require('../middleware/auth');

// Toutes les routes nécessitent une authentification
router.use(auth);

// Route spécifique doit être définie AVANT la route paramétrée
router.get('/get-matches', matchController.getMatches);
router.post('/remove-match', matchController.removeMatch);
router.get('/:id', matchController.getMatch);
router.get('/', matchController.getMatches);
// router.get('/get-match/:id', matchController.getMatch);
// router.post('/create-match', matchController.createMatch);
// router.put('/update-match/:id', matchController.updateMatch);
// router.delete('/delete-match/:id', matchController.deleteMatch);

module.exports = router;

