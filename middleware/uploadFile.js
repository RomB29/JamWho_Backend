const { AVATAR_FILE_SIZE_MAX, SONG_FILE_SIZE_MAX } = require('../config/constants.js')
const multer = require('multer')
const fs = require('fs')
const path = require('path')

function createUploadPhoto(type) {
  const storage = multer.diskStorage({
    destination: (req, file, cb) => {
      // Utilise l'ID de l'utilisateur depuis req.user (disponible après le middleware auth)
      const userId = req.user._id.toString()
      const destinationPath = path.join(__dirname, '../PUBLIC_UPLOAD/profile', userId, 'photo_uploads')

      // Create the directory if it doesn't exist
      fs.mkdirSync(destinationPath, { recursive: true })
      cb(null, destinationPath)
    },
    filename: (req, file, cb) => {
      // Valide que c'est bien une image
      const allowedMimes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']
      if (!allowedMimes.includes(file.mimetype)) {
        return cb(new Error('Type de fichier non autorisé. Seules les images sont acceptées.'))
      }

      const extension = file.mimetype.split('/')[1] // mimetype extension image/extension
      const userId = req.user._id.toString()
      cb(null, `avatar_${userId}_${Date.now()}.${extension}`)
    }
  })

  return multer({
    storage,
    limits: { fileSize: AVATAR_FILE_SIZE_MAX }, // Set the maximum file size limit
    fileFilter: (req, file, cb) => {
      // Validation supplémentaire du type de fichier
      const allowedMimes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']
      if (allowedMimes.includes(file.mimetype)) {
        cb(null, true)
      } else {
        cb(new Error('Type de fichier non autorisé. Seules les images sont acceptées.'))
      }
    }
  })
}

function createUploadSong(type) {
  const storage = multer.diskStorage({
    destination: (req, file, cb) => {
      // Utilise l'ID de l'utilisateur depuis req.user (disponible après le middleware auth)
      const userId = req.user._id.toString()
      const destinationPath = path.join(__dirname, '../PUBLIC_UPLOAD/profile', userId, 'song_uploads')

      // Create the directory if it doesn't exist
      fs.mkdirSync(destinationPath, { recursive: true })
      cb(null, destinationPath)
    },
    filename: (req, file, cb) => {
      // Valide que c'est bien un fichier audio
      const allowedMimes = ['audio/mpeg', 'audio/mp3', 'audio/mp4', 'audio/wav', 'audio/ogg', 'audio/webm']
      if (!allowedMimes.includes(file.mimetype)) {
        return cb(new Error('Type de fichier non autorisé. Seuls les fichiers audio sont acceptés.'))
      }

      // Détermine l'extension depuis le mimetype ou le nom du fichier
      let extension = 'mp3' // par défaut
      if (file.mimetype === 'audio/mpeg' || file.mimetype === 'audio/mp3') {
        extension = 'mp3'
      } else if (file.mimetype === 'audio/mp4') {
        extension = 'm4a'
      } else if (file.mimetype === 'audio/wav') {
        extension = 'wav'
      } else if (file.mimetype === 'audio/ogg') {
        extension = 'ogg'
      } else if (file.mimetype === 'audio/webm') {
        extension = 'webm'
      } else if (file.originalname) {
        // Essaie d'extraire l'extension depuis le nom du fichier
        const parts = file.originalname.split('.')
        if (parts.length > 1) {
          extension = parts[parts.length - 1].toLowerCase()
        }
      }

      const userId = req.user._id.toString()
      cb(null, `song_${userId}_${Date.now()}.${extension}`)
    }
  })

  return multer({
    storage,
    limits: { fileSize: SONG_FILE_SIZE_MAX }, // Set the maximum file size limit
    fileFilter: (req, file, cb) => {
      // Validation supplémentaire du type de fichier
      const allowedMimes = ['audio/mpeg', 'audio/mp3', 'audio/mp4', 'audio/wav', 'audio/ogg', 'audio/webm']
      if (allowedMimes.includes(file.mimetype)) {
        cb(null, true)
      } else {
        cb(new Error('Type de fichier non autorisé. Seuls les fichiers audio (MP3, WAV, OGG, etc.) sont acceptés.'))
      }
    }
  })
}

const uploadProfilePhoto = createUploadPhoto('profile')
const uploadProfileSong = createUploadSong('profile')

module.exports = { uploadProfilePhoto, uploadProfileSong }
