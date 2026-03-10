// URL de base de l'API pour construire les URLs des médias (photos, sons).
// En prod : utiliser API_BACKEND_PROD_URL ou défaut https://api.jamcloud.app
const getServerBaseUrl = function () {
  const prodUrl = process.env.API_BACKEND_PROD_URL
  const devUrl = process.env.API_BACKEND_DEV_URL
  const isProduction = process.env.NODE_ENV === 'production'
  if (isProduction) {
    return prodUrl && prodUrl.trim() !== '' ? prodUrl.trim() : 'https://api.jamcloud.app'
  }
  return devUrl && devUrl.trim() !== '' ? devUrl.trim() : 'http://localhost:3000'
}

module.exports = getServerBaseUrl
