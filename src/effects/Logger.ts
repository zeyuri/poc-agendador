import { Effect, Schedule, Context, Layer } from "effect"
import { SqliteClient } from "@effect/sql-sqlite-bun"
import { SqlError } from "@effect/sql"
import { MessageRepository } from "../database/Repository.js"

export class MessageLogger extends Context.Tag("MessageLogger")<
  MessageLogger,
  {
    readonly startLogging: () => Effect.Effect<void, SqlError.SqlError, MessageRepository | SqliteClient.SqliteClient>
    readonly logUnprocessedMessages: () => Effect.Effect<void, SqlError.SqlError, MessageRepository | SqliteClient.SqliteClient>
  }
>() {}

export const MessageLoggerLive = Layer.effect(
  MessageLogger,
  Effect.gen(function* () {
    return {
      startLogging: () =>
        Effect.gen(function* () {
          const repository = yield* MessageRepository

          yield* Effect.log("🕒 Starting 2-second message logging routine...")

          yield* Effect.schedule(
            Effect.gen(function* () {
              const unprocessedMessages = yield* repository.getUnprocessedMessages()

              if (unprocessedMessages.length === 0) {
                yield* Effect.log("📋 No unprocessed messages")
                return
              }

              yield* Effect.log(`📨 Found ${unprocessedMessages.length} unprocessed messages:`)

              for (const message of unprocessedMessages) {
                const direction = message.isFromMe ? "→" : "←"
                const truncatedContent = message.content.length > 50
                  ? message.content.substring(0, 50) + "..."
                  : message.content

                yield* Effect.log(
                  `${direction} [${message.messageType}] ${message.from} ${direction} ${message.to}: ${truncatedContent}`
                )

                // Mark as processed after logging
                yield* repository.markAsProcessed(message.id)
              }

              yield* Effect.log(`✅ Processed ${unprocessedMessages.length} messages`)
            }).pipe(
              Effect.catchAll(() =>
                Effect.log(`❌ Logging error`)
              )
            ),
            Schedule.fixed("2 seconds")
          )
        }),

      logUnprocessedMessages: () =>
        Effect.gen(function* () {
          const repository = yield* MessageRepository

          const unprocessedMessages = yield* repository.getUnprocessedMessages()

          if (unprocessedMessages.length === 0) {
            yield* Effect.log("📋 No unprocessed messages")
            return
          }

          yield* Effect.log(`📨 Found ${unprocessedMessages.length} unprocessed messages:`)

          for (const message of unprocessedMessages) {
            const direction = message.isFromMe ? "→" : "←"
            const truncatedContent = message.content.length > 50
              ? message.content.substring(0, 50) + "..."
              : message.content

            yield* Effect.log(
              `${direction} [${message.messageType}] ${message.from} ${direction} ${message.to}: ${truncatedContent}`
            )

            // Mark as processed after logging
            yield* repository.markAsProcessed(message.id)
          }

          yield* Effect.log(`✅ Processed ${unprocessedMessages.length} messages`)
        })
    }
  })
)