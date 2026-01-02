const errorHandler = (err, req, res, next) => {
  console.error('Erreur:', err);

  // Erreur de validation Mongoose
  if (err.name === 'ValidationError') {
    const errors = Object.values(err.errors).map(e => e.message);
    return res.status(400).json({ message: 'Erreur de validation', errors });
  }

  // Erreur de duplication (unique constraint)
  if (err.code === 11000) {
    const field = Object.keys(err.keyPattern)[0];
    return res.status(400).json({ 
      message: `${field} déjà utilisé.`,
      field 
    });
  }

  // Erreur de cast (ObjectId invalide)
  if (err.name === 'CastError') {
    return res.status(400).json({ message: 'ID invalide.' });
  }

  // Erreur par défaut
  res.status(err.status || 500).json({
    message: err.message || 'Erreur serveur',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
};

module.exports = errorHandler;

