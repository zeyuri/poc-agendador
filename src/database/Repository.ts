import { Effect, Context, Layer, Schema } from "effect"
import { SqliteClient } from "@effect/sql-sqlite-bun"
import { SqlError } from "@effect/sql"
import type { WhatsAppMessage, InsertMessageSchema } from "./Schema.js"

export class MessageRepository extends Context.Tag("MessageRepository")<
  MessageRepository,
  {
    readonly insertMessage: (message: Schema.Schema.Type<typeof InsertMessageSchema>) => Effect.Effect<WhatsAppMessage, SqlError.SqlError, SqliteClient.SqliteClient>
    readonly getUnprocessedMessages: () => Effect.Effect<WhatsAppMessage[], SqlError.SqlError, SqliteClient.SqliteClient>
    readonly markAsProcessed: (messageId: string) => Effect.Effect<WhatsAppMessage, SqlError.SqlError, SqliteClient.SqliteClient>
    readonly getMessagesByChat: (chatId: string) => Effect.Effect<WhatsAppMessage[], SqlError.SqlError, SqliteClient.SqliteClient>
  }
>() {}

export const MessageRepositoryLive = Layer.effect(
  MessageRepository,
  Effect.gen(function* () {
    return {
      insertMessage: (message) =>
        Effect.gen(function* () {
          const sql = yield* SqliteClient.SqliteClient

          const result = yield* sql`
            INSERT INTO messages (
              id, from_phone, to_phone, chat_id, timestamp, content,
              message_type, is_from_me, is_group, processed
            ) VALUES (
              ${message.id}, ${message.from}, ${message.to}, ${message.chat_id},
              ${message.timestamp}, ${message.content}, ${message.messageType},
              ${message.isFromMe}, ${message.isGroup}, ${message.processed}
            )
            RETURNING 
              id,
              from_phone as "from",
              to_phone as "to",
              chat_id,
              timestamp,
              content,
              message_type as "messageType",
              is_from_me as "isFromMe",
              is_group as "isGroup",
              processed,
              created_at as "createdAt"
          `

          return result[0] as unknown as WhatsAppMessage
        }),

      getUnprocessedMessages: () =>
        Effect.gen(function* () {
          const sql = yield* SqliteClient.SqliteClient

          const result = yield* sql`
            SELECT 
              id,
              from_phone as "from",
              to_phone as "to",
              chat_id,
              timestamp,
              content,
              message_type as "messageType",
              is_from_me as "isFromMe",
              is_group as "isGroup",
              processed,
              created_at as "createdAt"
            FROM messages 
            WHERE processed = false 
            ORDER BY timestamp ASC
          `

          return result as unknown as WhatsAppMessage[]
        }),

      markAsProcessed: (messageId) =>
        Effect.gen(function* () {
          const sql = yield* SqliteClient.SqliteClient

          const result = yield* sql`
            UPDATE messages 
            SET processed = true 
            WHERE id = ${messageId}
            RETURNING 
              id,
              from_phone as "from",
              to_phone as "to",
              chat_id,
              timestamp,
              content,
              message_type as "messageType",
              is_from_me as "isFromMe",
              is_group as "isGroup",
              processed,
              created_at as "createdAt"
          `

          return result[0] as unknown as WhatsAppMessage
        }),

      getMessagesByChat: (chatId) =>
        Effect.gen(function* () {
          const sql = yield* SqliteClient.SqliteClient

          const result = yield* sql`
            SELECT 
              id,
              from_phone as "from",
              to_phone as "to",
              chat_id,
              timestamp,
              content,
              message_type as "messageType",
              is_from_me as "isFromMe",
              is_group as "isGroup",
              processed,
              created_at as "createdAt"
            FROM messages 
            WHERE chat_id = ${chatId}
            ORDER BY timestamp ASC
          `

          return result as unknown as WhatsAppMessage[]
        })
    }
  })
)