/**
 * Script de migration pour initialiser les nouveaux champs premium
 * - Ajoute isPremium à tous les utilisateurs (par défaut: false)
 * - Initialise dailySwipes et dailyMessages dans tous les profils
 * 
 * Usage: node scripts/migrate-premium.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const Profile = require('../models/Profile');
const connectDB = require('../config/database');

const migratePremium = async () => {
  try {
    // Connexion à MongoDB
    await connectDB();
    console.log('✅ Connecté à MongoDB');

    // Migration des Users
    console.log('\n📝 Migration des utilisateurs...');
    const users = await User.find({});
    console.log(`📊 ${users.length} utilisateurs trouvés`);

    let usersUpdated = 0;
    let usersSkipped = 0;

    for (const user of users) {
      try {
        // Vérifie si isPremium existe déjà
        if (user.isPremium === undefined || user.isPremium === null) {
          user.isPremium = false;
          await user.save();
          usersUpdated++;
          console.log(`✅ Utilisateur ${user._id} mis à jour (isPremium: false)`);
        } else {
          usersSkipped++;
        }
      } catch (error) {
        console.error(`❌ Erreur pour l'utilisateur ${user._id}:`, error.message);
      }
    }

    console.log(`\n✅ Utilisateurs mis à jour: ${usersUpdated}`);
    console.log(`⏭️  Utilisateurs ignorés: ${usersSkipped}`);

    // Migration des Profiles
    console.log('\n📝 Migration des profils...');
    const profiles = await Profile.find({});
    console.log(`📊 ${profiles.length} profils trouvés`);

    let profilesUpdated = 0;
    let profilesSkipped = 0;

    for (const profile of profiles) {
      try {
        let updated = false;

        // Initialise dailySwipes si nécessaire
        if (!profile.dailySwipes || !profile.dailySwipes.count || profile.dailySwipes.date === undefined) {
          profile.dailySwipes = {
            count: 0,
            date: new Date()
          };
          updated = true;
        }

        // Initialise dailyMessages si nécessaire
        if (!profile.dailyMessages || !profile.dailyMessages.profiles || profile.dailyMessages.resetDate === undefined) {
          profile.dailyMessages = {
            profiles: [],
            resetDate: new Date()
          };
          updated = true;
        }

        if (updated) {
          await profile.save();
          profilesUpdated++;
          console.log(`✅ Profil ${profile._id} mis à jour`);
        } else {
          profilesSkipped++;
        }
      } catch (error) {
        console.error(`❌ Erreur pour le profil ${profile._id}:`, error.message);
      }
    }

    console.log(`\n✅ Profils mis à jour: ${profilesUpdated}`);
    console.log(`⏭️  Profils ignorés: ${profilesSkipped}`);

    console.log('\n🎉 Migration terminée !');
    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur lors de la migration:', error);
    process.exit(1);
  }
};

migratePremium();

