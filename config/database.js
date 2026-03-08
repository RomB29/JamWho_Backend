const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const isProduction = process.env.NODE_ENV === 'production';
    const mongoUrl = isProduction ? process.env.MONGODB_URL_PROD : process.env.MONGODB_URL_DEV;

    if (!mongoUrl) {
      throw new Error(
        isProduction ? 'MONGODB_URL_PROD est requis en production' : 'MONGODB_URL_DEV est requis'
      );
    }

    const conn = await mongoose.connect(mongoUrl, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log(`MongoDB Connecté: ${conn.connection.host} (${isProduction ? 'production' : 'développement'})`);
  } catch (error) {
    console.error(`Erreur de connexion MongoDB: ${error.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;

