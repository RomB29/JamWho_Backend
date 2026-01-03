const isProduction = process.env.NODE_ENV === 'production'
const serverBaseUrl = isProduction
  ? process.env.API_BACKEND_PROD_URL
  : process.env.API_BACKEND_DEV_URL

module.exports = function () {
  return serverBaseUrl
}
