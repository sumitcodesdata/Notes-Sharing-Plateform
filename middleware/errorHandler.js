const errorHandler = (err, req, res, next) => {
  console.error(err.stack || err.message);

  // Mongoose / Mongo unique constraint (duplicate key error)
  if (err.code === 11000) {
    return res.status(400).json({ message: 'Email is already registered' });
  }

  // Multer errors (e.g. invalid file, too large)
  if (err.name === 'MulterError') {
    return res.status(400).json({ message: `Upload error: ${err.message}` });
  }

  // Check for custom validation filter errors thrown from multer filter
  if (err.message && err.message.includes('PDF documents')) {
    return res.status(400).json({ message: err.message });
  }

  // Cast errors (e.g. invalid ObjectId format in MongoDB)
  if (err.name === 'CastError' || err.kind === 'ObjectId') {
    return res.status(404).json({ message: 'Resource not found' });
  }

  // Validation errors
  if (err.name === 'ValidationError') {
    const messages = Object.values(err.errors).map(e => e.message);
    return res.status(400).json({ message: messages.join(', ') });
  }

  const statusCode = res.statusCode === 200 ? 500 : res.statusCode;
  res.status(statusCode).json({
    message: err.message || 'Internal Server Error'
  });
};

module.exports = errorHandler;
