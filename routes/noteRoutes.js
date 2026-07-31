const express = require('express');
const router = express.Router();
const noteController = require('../controllers/noteController');
const auth = require('../middleware/auth');
const upload = require('../config/multer');

router.route('/')
  .get(noteController.getNotes)
  .post(auth, upload.single('pdf'), noteController.createNote);

router.route('/:id')
  .get(noteController.getNoteById)
  .put(auth, upload.single('pdf'), noteController.updateNote)
  .delete(auth, noteController.deleteNote);

router.post('/:id/reviews', auth, noteController.createNoteReview);
router.put('/:id/reviews/:reviewId', auth, noteController.updateNoteReview);
router.delete('/:id/reviews/:reviewId', auth, noteController.deleteNoteReview);
router.get('/:id/download', noteController.downloadNote);
router.post('/:id/bookmark', auth, noteController.toggleBookmark);

module.exports = router;
