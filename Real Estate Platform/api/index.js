// Vercel Serverless Function entry point
// This wraps the Express app for Vercel's serverless runtime

require('dotenv').config({ path: require('path').resolve(__dirname, '../backend/.env') })

const app = require('../backend/src/app')

module.exports = app
