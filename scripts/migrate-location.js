/**
 * Script de migration pour convertir les anciens profils
 * avec location: { latitude, longitude } vers le format GeoJSON
 * 
 * Usage: node scripts/migrate-location.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Profile = require('../models/Profile');

const migrateLocations = async () => {
  try {
    // Connexion à MongoDB
    await mongoose.connect(process.env.MONGODB_URL_DEV, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('✅ Connecté à MongoDB');

    // Récupère tous les profils
    const profiles = await Profile.find({});
    console.log(`📊 ${profiles.length} profils trouvés`);

    let migrated = 0;
    let skipped = 0;
    let errors = 0;

    for (const profile of profiles) {
      try {
        // Vérifie si le profil a l'ancien format
        if (profile.location && 
            (profile.location.latitude !== undefined || 
             profile.location.longitude !== undefined)) {
          
          // Convertit en format GeoJSON
          if (profile.location.latitude !== null && 
              profile.location.longitude !== null) {
            profile.location = {
              type: 'Point',
              coordinates: [
                profile.location.longitude,
                profile.location.latitude
              ]
            };
          } else {
            // Si latitude ou longitude est null, on met coordinates à null
            profile.location = {
              type: 'Point',
              coordinates: null
            };
          }

          await profile.save();
          migrated++;
          console.log(`✅ Profil ${profile._id} migré`);
        } else {
          skipped++;
        }
      } catch (error) {
        console.error(`❌ Erreur pour le profil ${profile._id}:`, error.message);
        errors++;
      }
    }

    console.log('\n📈 Résumé de la migration:');
    console.log(`   ✅ Migrés: ${migrated}`);
    console.log(`   ⏭️  Ignorés: ${skipped}`);
    console.log(`   ❌ Erreurs: ${errors}`);

    // Supprime et recrée l'index pour s'assurer qu'il est correct
    try {
      await Profile.collection.dropIndex('location_2dsphere');
      console.log('🗑️  Ancien index supprimé');
    } catch (error) {
      // L'index n'existe peut-être pas, ce n'est pas grave
      console.log('ℹ️  Index non trouvé (normal si première migration)');
    }

    // Recrée l'index avec sparse: true
    await Profile.collection.createIndex({ location: '2dsphere' }, { sparse: true });
    console.log('✅ Index géospatial recréé');

    console.log('\n🎉 Migration terminée !');
    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur lors de la migration:', error);
    process.exit(1);
  }
};

migrateLocations();

