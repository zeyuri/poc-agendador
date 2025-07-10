import { Effect, Layer, Logger, LogLevel } from "effect"
import { SqliteClient } from "@effect/sql-sqlite-bun"
import { WhatsAppConnection, WhatsAppConnectionLive } from "./whatsapp/Connection.js"
import { MessageStreamLive, processMessageStream } from "./whatsapp/MessageStream.js"
import { MessageRepositoryLive } from "./database/Repository.js"
import { MessageLogger, MessageLoggerLive } from "./effects/Logger.js"
import { createTables } from "./database/Schema.js"

// Database layer with table initialization
const DatabaseLive = Layer.unwrapEffect(
  Effect.gen(function* () {
    const sql = yield* SqliteClient.make({ filename: "./messages.db" })
    yield* createTables(sql)
    yield* Effect.log("📦 Database initialized")
    return Layer.succeed(SqliteClient.SqliteClient, sql)
  })
)

// Main application layer composition
const MainLive = Layer.merge(
  Layer.merge(DatabaseLive, MessageRepositoryLive),
  Layer.merge(
    Layer.merge(WhatsAppConnectionLive, MessageStreamLive),
    MessageLoggerLive
  )
)

// Main application program
const program = Effect.gen(function* () {
  yield* Effect.log("🚀 Starting WhatsApp Effect-TS Bot...")

  const connection = yield* WhatsAppConnection
  const logger = yield* MessageLogger

  // Connect to WhatsApp and get socket
  const socket = yield* connection.connect()
  yield* Effect.log("✅ WhatsApp connection established")

  // Start message processing stream
  const messageProcessingFiber = yield* Effect.fork(
    processMessageStream(socket).pipe(
      Effect.catchAll((error: unknown) =>
        Effect.log(`❌ Message processing error: ${error}`)
      )
    )
  )

  // Start 2-second logging routine
  const loggingFiber = yield* Effect.fork(
    logger.startLogging().pipe(
      Effect.catchAll((error: unknown) =>
        Effect.log(`❌ Logging routine error: ${error}`)
      )
    )
  )

  yield* Effect.log("🎯 All services started successfully!")
  yield* Effect.log("📱 Waiting for WhatsApp messages...")
  yield* Effect.log("🕒 Logging unprocessed messages every 2 seconds...")
  yield* Effect.log("💬 Bot is ready to receive and process messages!")

  // Wait for both fibers to complete (they run forever)
  yield* Effect.all([messageProcessingFiber, loggingFiber], { concurrency: "unbounded" })
})

// Error handling and graceful shutdown
const mainProgram = program.pipe(
  Effect.provide(MainLive),
  Effect.tapErrorCause(Effect.logError),
  Logger.withMinimumLogLevel(LogLevel.Info),
  Effect.scoped
)

// Handle process signals for graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Received SIGINT, shutting down gracefully...')
  process.exit(0)
})

process.on('SIGTERM', () => {
  console.log('\n🛑 Received SIGTERM, shutting down gracefully...')
  process.exit(0)
})

// Run the application
Effect.runFork(mainProgram)