const { AVATAR_FILE_SIZE_MAX } = require('../config/constants.js')
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

const uploadProfilePhoto = createUploadPhoto('profile')

module.exports = { uploadProfilePhoto }
