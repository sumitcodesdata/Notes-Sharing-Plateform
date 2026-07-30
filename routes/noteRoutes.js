const express = require('express');
const router = express.Router();
const noteController = require('../controllers/noteController');
const auth = require('../middleware/auth');
const upload = require('../config/multer');

// Notes endpoints
router.route('/')
  .get(noteController.getNotes)
  .post(auth, upload.single('pdf'), noteController.createNote);

router.route('/:id')
  .get(noteController.getNoteById);

router.post('/:id/reviews', auth, noteController.createNoteReview);
router.get('/:id/download', noteController.downloadNote);
router.post('/:id/bookmark', auth, noteController.toggleBookmark);

module.exports = router;
