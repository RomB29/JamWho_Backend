/**
 * Script de migration pour ajouter l'âge et le sexe aux profils existants
 * qui n'ont pas ces champs (créés avant l'ajout de cette fonctionnalité)
 * 
 * Usage: node scripts/migrate-age-sexe.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Profile = require('../models/Profile');

const migrateAgeAndSexe = async () => {
  try {
    // Connexion à MongoDB
    await mongoose.connect(process.env.MONGODB_URL_DEV, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('✅ Connecté à MongoDB\n');

    // Récupère tous les profils
    const profiles = await Profile.find({});
    console.log(`📊 ${profiles.length} profils trouvés\n`);

    let migrated = 0;
    let skipped = 0;
    let errors = 0;

    for (const profile of profiles) {
      try {
        let needsUpdate = false;

        // Vérifie si l'âge est manquant ou invalide
        if (!profile.age || profile.age < 18 || profile.age > 100) {
          profile.age = 18; // Valeur par défaut
          needsUpdate = true;
          console.log(`  ⚠️  Profil ${profile._id}: âge manquant ou invalide, défini à 18 ans`);
        }

        // Vérifie si le sexe est manquant ou invalide
        if (!profile.sexe || !['homme', 'femme', 'autre'].includes(profile.sexe)) {
          profile.sexe = 'autre'; // Valeur par défaut
          needsUpdate = true;
          console.log(`  ⚠️  Profil ${profile._id}: sexe manquant ou invalide, défini à "autre"`);
        }

        if (needsUpdate) {
          await profile.save();
          migrated++;
          console.log(`✅ Profil ${profile._id} migré (âge: ${profile.age}, sexe: ${profile.sexe})`);
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
    console.log(`   ⏭️  Ignorés (déjà à jour): ${skipped}`);
    console.log(`   ❌ Erreurs: ${errors}`);

    console.log('\n🎉 Migration terminée !');
    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur lors de la migration:', error);
    process.exit(1);
  }
};

migrateAgeAndSexe();
