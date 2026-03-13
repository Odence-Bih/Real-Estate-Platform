require('dotenv').config()

const app = require('./app')
const { startEscrowAutoRelease } = require('./jobs/escrowAutoRelease')

const PORT = process.env.PORT || 5001

// Process error handlers
process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Promise Rejection:', reason)
})

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err.message)
  process.exit(1)
})

// Start server
const server = app.listen(PORT, () => {
  console.log(`LimbeHomes API running on port ${PORT}`)
  startEscrowAutoRelease()
})

// Graceful shutdown
function shutdown(signal) {
  console.log(`${signal} received. Shutting down gracefully...`)
  server.close(() => {
    console.log('HTTP server closed')
    process.exit(0)
  })
  setTimeout(() => process.exit(1), 10000)
}

process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT', () => shutdown('SIGINT'))

module.exports = app
