const fs = require('fs');
const Note = require('../models/Note');
const User = require('../models/User');

// @desc    Get all study notes with filtering
// @route   GET /api/notes
// @access  Public
exports.getNotes = async (req, res, next) => {
  const { search, category, university, price } = req.query;

  try {
    let query = {};

    if (category) {
      query.category = category.toLowerCase();
    }

    if (university) {
      query.university = { $regex: new RegExp(university, 'i') };
    }

    if (price) {
      if (price === 'free') {
        query.price = 0;
      } else if (price === 'paid') {
        query.price = { $gt: 0 };
      }
    }

    if (search) {
      query.$or = [
        { title: { $regex: new RegExp(search, 'i') } },
        { description: { $regex: new RegExp(search, 'i') } },
        { university: { $regex: new RegExp(search, 'i') } }
      ];
    }

    const notes = await Note.find(query).sort({ createdAt: -1 });
    res.json(notes);
  } catch (err) {
    next(err);
  }
};

// @desc    Get a single study note by ID
// @route   GET /api/notes/:id
// @access  Public
exports.getNoteById = async (req, res, next) => {
  try {
    const note = await Note.findById(req.params.id);
    if (!note) {
      res.status(404);
      throw new Error('Note document not found');
    }
    res.json(note);
  } catch (err) {
    next(err);
  }
};

// @desc    Upload a new study note (PDF)
// @route   POST /api/notes
// @access  Private
exports.createNote = async (req, res, next) => {
  const { title, university, category, price, description, tags } = req.body;

  try {
    if (!req.file) {
      res.status(400);
      throw new Error('Please upload a PDF document');
    }

    if (!title || !university || !category || !description) {
      // Clean up uploaded file if validation fails
      if (req.file.path && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      res.status(400);
      throw new Error('Please fill in all required fields');
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      if (req.file.path && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      res.status(404);
      throw new Error('User not found');
    }

    const priceVal = parseFloat(price) || 0;
    const isFree = priceVal === 0;
    const tagsArray = tags ? tags.split(',').map(tag => tag.trim()).filter(Boolean) : [];

    const note = new Note({
      title,
      description,
      category: category.toLowerCase(),
      university,
      author: req.user.id,
      authorName: user.name,
      price: priceVal,
      isFree,
      filePath: req.file.path,
      tags: tagsArray
    });

    await note.save();
    res.status(201).json(note);
  } catch (err) {
    // Ensure uploaded file is deleted in case of DB or server errors
    if (req.file && req.file.path && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    next(err);
  }
};

// @desc    Add review rating & comment to a study note
// @route   POST /api/notes/:id/reviews
// @access  Private
exports.createNoteReview = async (req, res, next) => {
  const { rating, text } = req.body;

  try {
    if (!rating || !text) {
      res.status(400);
      throw new Error('Rating and review comment text are required');
    }

    const ratingVal = parseInt(rating);
    if (ratingVal < 1 || ratingVal > 5) {
      res.status(400);
      throw new Error('Rating must be between 1 and 5 stars');
    }

    const note = await Note.findById(req.params.id);
    if (!note) {
      res.status(404);
      throw new Error('Note document not found');
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      res.status(404);
      throw new Error('User not found');
    }

    const newReview = {
      authorName: user.name,
      rating: ratingVal,
      text
    };

    note.reviews.unshift(newReview);

    const totalRating = note.reviews.reduce((sum, rev) => sum + rev.rating, 0);
    note.rating = totalRating / note.reviews.length;

    await note.save();
    res.json(note);
  } catch (err) {
    next(err);
  }
};

// @desc    Download the physical note PDF file
// @route   GET /api/notes/:id/download
// @access  Public
exports.downloadNote = async (req, res, next) => {
  try {
    const note = await Note.findById(req.params.id);
    if (!note) {
      res.status(404);
      throw new Error('Note document not found');
    }

    if (!fs.existsSync(note.filePath)) {
      res.status(404);
      throw new Error('Physical PDF file not found on server');
    }

    note.downloads += 1;
    await note.save();

    const safeTitle = note.title.replace(/[^a-zA-Z0-9]/g, '_') + '.pdf';
    res.download(note.filePath, safeTitle);
  } catch (err) {
    next(err);
  }
};

// @desc    Toggle bookmark status of a study note
// @route   POST /api/notes/:id/bookmark
// @access  Private
exports.toggleBookmark = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      res.status(404);
      throw new Error('User not found');
    }

    const note = await Note.findById(req.params.id);
    if (!note) {
      res.status(404);
      throw new Error('Note not found');
    }

    const bookmarkIndex = user.savedNotes.indexOf(note.id);
    let saved = false;

    if (bookmarkIndex > -1) {
      user.savedNotes.splice(bookmarkIndex, 1);
    } else {
      user.savedNotes.push(note.id);
      saved = true;
    }

    await user.save();
    res.json({ saved });
  } catch (err) {
    next(err);
  }
};
