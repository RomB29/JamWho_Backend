/**
 * Script de migration pour ajouter conversationId aux messages existants
 * 
 * Usage: node scripts/migrate-conversationId.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Message = require('../models/Message');
const connectDB = require('../config/database');

// Fonction pour générer conversationId (identique à celle du contrôleur)
function generateConversationId(userId1, userId2) {
  const id1 = userId1.toString();
  const id2 = userId2.toString();
  const sortedIds = [id1, id2].sort();
  return `${sortedIds[0]}_${sortedIds[1]}`;
}

const migrateConversationId = async () => {
  try {
    // Connexion à MongoDB
    await connectDB();
    console.log('✅ Connecté à MongoDB');

    // Récupère tous les messages sans conversationId
    const messages = await Message.find({
      $or: [
        { conversationId: { $exists: false } },
        { conversationId: null }
      ]
    });
    console.log(`📊 ${messages.length} messages trouvés sans conversationId`);

    let migrated = 0;
    let errors = 0;

    for (const message of messages) {
      try {
        // Génère le conversationId à partir de senderId et receiverId
        const conversationId = generateConversationId(message.senderId, message.receiverId);
        
        message.conversationId = conversationId;
        await message.save();
        
        migrated++;
        if (migrated % 100 === 0) {
          console.log(`✅ ${migrated} messages migrés...`);
        }
      } catch (error) {
        console.error(`❌ Erreur pour le message ${message._id}:`, error.message);
        errors++;
      }
    }

    console.log('\n📈 Résumé de la migration:');
    console.log(`   ✅ Migrés: ${migrated}`);
    console.log(`   ❌ Erreurs: ${errors}`);

    console.log('\n🎉 Migration terminée !');
    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur lors de la migration:', error);
    process.exit(1);
  }
};

migrateConversationId();

