const fs = require('fs');
const Note = require('../models/Note');
const User = require('../models/User');
const cloudinary = require('../config/cloudinary');

// GET /api/notes - Get all notes with filtering
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

// GET /api/notes/:id
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

// POST /api/notes - Upload a new note
exports.createNote = async (req, res, next) => {
  const { title, university, category, price, description, tags } = req.body;

  try {
    if (!req.file) {
      res.status(400);
      throw new Error('Please upload a PDF document');
    }

    if (!title || !university || !category || !description) {
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

    // Upload to Cloudinary, fall back to local storage
    let cloudinaryUrl = '';
    let uploadedToCloudinary = false;
    try {
      const uploadResult = await cloudinary.uploader.upload(req.file.path, {
        resource_type: 'raw',
        folder: 'academic_notes'
      });
      cloudinaryUrl = uploadResult.secure_url;
      uploadedToCloudinary = true;
    } catch (uploadErr) {
      console.warn("Cloudinary upload failed, falling back to local storage:", uploadErr.message || uploadErr);
    }


    if (uploadedToCloudinary && req.file.path && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
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
      filePath: uploadedToCloudinary ? cloudinaryUrl : req.file.path,
      tags: tagsArray
    });

    await note.save();
    res.status(201).json(note);
  } catch (err) {
    if (req.file && req.file.path && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    next(err);
  }
};

// POST /api/notes/:id/reviews - Add or update user review
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

    const existingReviewIndex = note.reviews.findIndex(rev => 
      (rev.author && rev.author.toString() === req.user.id) || rev.authorName === user.name
    );

    if (existingReviewIndex > -1) {
      note.reviews[existingReviewIndex].rating = ratingVal;
      note.reviews[existingReviewIndex].text = text;
      note.reviews[existingReviewIndex].author = req.user.id;
      note.reviews[existingReviewIndex].createdAt = Date.now();
    } else {
      note.reviews.unshift({
        author: req.user.id,
        authorName: user.name,
        rating: ratingVal,
        text
      });
    }

    const totalRating = note.reviews.reduce((sum, rev) => sum + rev.rating, 0);
    note.rating = totalRating / note.reviews.length;

    await note.save();
    res.json(note);
  } catch (err) {
    next(err);
  }
};

// PUT /api/notes/:id/reviews/:reviewId - Edit review
exports.updateNoteReview = async (req, res, next) => {
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

    const review = note.reviews.id(req.params.reviewId);
    if (!review) {
      res.status(404);
      throw new Error('Review not found');
    }

    const user = await User.findById(req.user.id);

    if (review.author && review.author.toString() !== req.user.id && review.authorName !== (user ? user.name : '')) {
      res.status(403);
      throw new Error('Not authorized to edit this review');
    }

    review.rating = ratingVal;
    review.text = text;
    review.createdAt = Date.now();

    const totalRating = note.reviews.reduce((sum, rev) => sum + rev.rating, 0);
    note.rating = totalRating / note.reviews.length;

    await note.save();
    res.json(note);
  } catch (err) {
    next(err);
  }
};

// DELETE /api/notes/:id/reviews/:reviewId - Delete review
exports.deleteNoteReview = async (req, res, next) => {
  try {
    const note = await Note.findById(req.params.id);
    if (!note) {
      res.status(404);
      throw new Error('Note document not found');
    }

    const review = note.reviews.id(req.params.reviewId);
    if (!review) {
      res.status(404);
      throw new Error('Review not found');
    }

    const user = await User.findById(req.user.id);

    if (review.author && review.author.toString() !== req.user.id && review.authorName !== (user ? user.name : '')) {
      res.status(403);
      throw new Error('Not authorized to delete this review');
    }

    note.reviews.pull(req.params.reviewId);

    if (note.reviews.length > 0) {
      const totalRating = note.reviews.reduce((sum, rev) => sum + rev.rating, 0);
      note.rating = totalRating / note.reviews.length;
    } else {
      note.rating = 5.0;
    }

    await note.save();
    res.json(note);
  } catch (err) {
    next(err);
  }
};

// GET /api/notes/:id/download
exports.downloadNote = async (req, res, next) => {
  try {
    const note = await Note.findById(req.params.id);
    if (!note) {
      res.status(404);
      throw new Error('Note document not found');
    }

    note.downloads += 1;
    await note.save();

    const safeTitle = note.title.replace(/[^a-zA-Z0-9]/g, '_');

    // Handle Cloudinary files
    if (note.filePath.startsWith('http://') || note.filePath.startsWith('https://')) {
      if (note.filePath.includes('cloudinary.com')) {
        const match = note.filePath.match(/\/([a-z]+)\/upload\/(?:v\d+\/)?(.+)$/);
        if (match) {
          const resourceType = match[1];
          let publicId = match[2];

          if (resourceType === 'image') {
            publicId = publicId.replace(/\.[^/.]+$/, '');
          }

          const downloadUrl = cloudinary.utils.download_zip_url({
            public_ids: [publicId],
            resource_type: resourceType,
            target_filename: safeTitle
          });

          return res.redirect(downloadUrl);
        }
      }
      return res.redirect(note.filePath);
    }

    if (!fs.existsSync(note.filePath)) {
      res.status(404);
      throw new Error('Physical PDF file not found on server');
    }

    res.download(note.filePath, safeTitle + '.pdf');
  } catch (err) {
    next(err);
  }
};

// POST /api/notes/:id/bookmark - Toggle bookmark
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

// PUT /api/notes/:id - Update note
exports.updateNote = async (req, res, next) => {
  const { title, university, category, price, description, tags } = req.body;

  try {
    const note = await Note.findById(req.params.id);
    if (!note) {
      res.status(404);
      throw new Error('Note document not found');
    }


    if (note.author.toString() !== req.user.id) {
      res.status(403);
      throw new Error('Not authorized to update this note');
    }

    if (req.file) {
      let cloudinaryUrl = '';
      let uploadedToCloudinary = false;
      try {
        const uploadResult = await cloudinary.uploader.upload(req.file.path, {
          resource_type: 'raw',
          folder: 'academic_notes'
        });
        cloudinaryUrl = uploadResult.secure_url;
        uploadedToCloudinary = true;
      } catch (uploadErr) {
        console.warn("Cloudinary upload failed during update, falling back to local storage:", uploadErr.message || uploadErr);
      }


      if (note.filePath && !note.filePath.startsWith('http://') && !note.filePath.startsWith('https://')) {
        if (fs.existsSync(note.filePath)) {
          fs.unlinkSync(note.filePath);
        }
      }


      if (uploadedToCloudinary && req.file.path && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }

      note.filePath = uploadedToCloudinary ? cloudinaryUrl : req.file.path;
    }


    if (title) note.title = title;
    if (university) note.university = university;
    if (category) note.category = category.toLowerCase();
    if (description) note.description = description;
    if (price !== undefined) {
      const priceVal = parseFloat(price) || 0;
      note.price = priceVal;
      note.isFree = priceVal === 0;
    }
    if (tags !== undefined) {
      note.tags = tags ? tags.split(',').map(tag => tag.trim()).filter(Boolean) : [];
    }

    await note.save();
    res.json(note);
  } catch (err) {
    if (req.file && req.file.path && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    next(err);
  }
};

// DELETE /api/notes/:id
exports.deleteNote = async (req, res, next) => {
  try {
    const note = await Note.findById(req.params.id);
    if (!note) {
      res.status(404);
      throw new Error('Note document not found');
    }


    if (note.author.toString() !== req.user.id) {
      res.status(403);
      throw new Error('Not authorized to delete this note');
    }


    if (note.filePath && !note.filePath.startsWith('http://') && !note.filePath.startsWith('https://')) {
      if (fs.existsSync(note.filePath)) {
        fs.unlinkSync(note.filePath);
      }
    }


    await Note.findByIdAndDelete(req.params.id);

    res.json({ message: 'Note deleted successfully' });
  } catch (err) {
    next(err);
  }
};
