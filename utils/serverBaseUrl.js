const isProduction = process.env.NODE_ENV === 'production'
const serverBaseUrl = isProduction
  ? (process.env.API_BACKEND_PROD_URL || 'https://api.jamcloud.app')
  : (process.env.API_BACKEND_DEV_URL || 'http://localhost:3000')

module.exports = function () {
  return serverBaseUrl
}
