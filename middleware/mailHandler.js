const nodemailer = require('nodemailer')
const dotenv = require('dotenv')
dotenv.config()

const { CODE_RESET_PASSWORD_LENGTH } = require('../config/constants')

const environment = process.env.NODE_ENV || 'development' // production or development
const suffix = environment === 'production' ? '_PROD' : '_DEV'

const SMTP_HOST = process.env['SMTP_HOST' + suffix]
const SMTP_PORT = process.env['SMTP_PORT' + suffix]
const SMTP_AUTH_USER = process.env['SMTP_AUTH_USER' + suffix]
const SMTP_PASS = process.env['SMTP_AUTH_PASS' + suffix]
const SMTP_EMAIL_SENDER = process.env['SMTP_EMAIL_SENDER' + suffix]

function sendEmail (toEmail, subject, text) {
  const transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: false, // true for 465, false for other ports
    auth: {
      user: SMTP_AUTH_USER,
      pass: SMTP_PASS
    },
    ignoreTLS: true,
    from: SMTP_EMAIL_SENDER
  })

  const mailOptions = {
    from: SMTP_EMAIL_SENDER,
    to: toEmail,
    subject,
    text
  }

  transporter.sendMail(mailOptions)
    .then(info => {
      console.log('Verification email sent:', info.response)
    })
    .catch(error => {
      console.log('Error sending verification email:', error)
      console.log('SMTP response:', error.response)
    })
}

function generateRandomVerificationCode () {
  return Math.floor(100000 + Math.random() * 900000) // Generates a 6-digit code
}

function generateCodeForgottenPassword () {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#?'
  let code = ''
  for (let i = 0; i < CODE_RESET_PASSWORD_LENGTH; i++) {
    const randomIndex = Math.floor(Math.random() * (characters.length))
    code += characters.charAt(randomIndex)
  }

  return code
}

module.exports = {
  sendEmail,
  generateRandomVerificationCode,
  generateCodeForgottenPassword
}
