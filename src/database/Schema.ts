import type { SqliteClient } from "@effect/sql-sqlite-bun"
import { Effect, Schema } from "effect"

// WhatsApp Message Schema with validation
export class WhatsAppMessage extends Schema.Class<WhatsAppMessage>("WhatsAppMessage")({
  id: Schema.String,
  from: Schema.NullOr(Schema.String),
  to: Schema.NullOr(Schema.String),
  chat_id: Schema.String,
  timestamp: Schema.String,
  content: Schema.String,
  messageType: Schema.String,
  isFromMe: Schema.Boolean,
  isGroup: Schema.Boolean,
  processed: Schema.Boolean,
  createdAt: Schema.String
}) {}

// Request schemas for database operations
export const InsertMessageSchema = Schema.Struct({
  id: Schema.String,
  from: Schema.NullOr(Schema.String),
  to: Schema.NullOr(Schema.String),
  chat_id: Schema.String,
  timestamp: Schema.String,
  content: Schema.String,
  messageType: Schema.String,
  isFromMe: Schema.Boolean,
  isGroup: Schema.Boolean,
  processed: Schema.Boolean
})

export const MessageIdSchema = Schema.String

export const ChatIdSchema = Schema.String

export const createTables = (sql: SqliteClient.SqliteClient) =>
  Effect.gen(function* () {
    yield* sql`
      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        from_phone TEXT,
        to_phone TEXT,
        chat_id TEXT NOT NULL,
        timestamp TEXT NOT NULL,
        content TEXT NOT NULL,
        message_type TEXT NOT NULL DEFAULT 'text',
        is_from_me BOOLEAN NOT NULL DEFAULT false,
        is_group BOOLEAN NOT NULL DEFAULT false,
        processed BOOLEAN NOT NULL DEFAULT false,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `

    yield* sql`
      CREATE INDEX IF NOT EXISTS idx_messages_chat_id ON messages(chat_id)
    `

    yield* sql`
      CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages(timestamp)
    `

    yield* sql`
      CREATE INDEX IF NOT EXISTS idx_messages_processed ON messages(processed)
    `
  })