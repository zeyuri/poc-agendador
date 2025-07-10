import { Effect, Context, Layer, Schema } from "effect"
import { SqliteClient } from "@effect/sql-sqlite-bun"
import { SqlError } from "@effect/sql"
import type { 
  AuthenticationState, 
  AuthenticationCreds, 
  SignalKeyStore, 
  SignalDataTypeMap, 
  SignalDataSet 
} from "@whiskeysockets/baileys"

// Effect Schema for serializable auth data
export const AuthCredsSchema = Schema.Struct({
  data: Schema.String, // JSON stringified AuthenticationCreds
  sessionId: Schema.String
})

export const AuthKeySchema = Schema.Struct({
  sessionId: Schema.String,
  keyType: Schema.String, // 'pre-key', 'session', 'sender-key', etc.
  keyId: Schema.String,
  keyData: Schema.String // JSON stringified key data
})

export type AuthCreds = Schema.Schema.Type<typeof AuthCredsSchema>
export type AuthKey = Schema.Schema.Type<typeof AuthKeySchema>

// Database operations for auth state
export class AuthStateRepository extends Context.Tag("AuthStateRepository")<
  AuthStateRepository,
  {
    readonly saveCredentials: (sessionId: string, creds: AuthenticationCreds) => Effect.Effect<AuthCreds, SqlError.SqlError, SqliteClient.SqliteClient>
    readonly loadCredentials: (sessionId: string) => Effect.Effect<AuthenticationCreds | null, SqlError.SqlError, SqliteClient.SqliteClient>
    readonly saveKeys: (sessionId: string, data: SignalDataSet) => Effect.Effect<void, SqlError.SqlError, SqliteClient.SqliteClient>
    readonly loadKeys: <T extends keyof SignalDataTypeMap>(sessionId: string, type: T, ids: string[]) => Effect.Effect<{ [id: string]: SignalDataTypeMap[T] }, SqlError.SqlError, SqliteClient.SqliteClient>
    readonly clearSession: (sessionId: string) => Effect.Effect<void, SqlError.SqlError, SqliteClient.SqliteClient>
    readonly initializeTables: () => Effect.Effect<void, SqlError.SqlError, SqliteClient.SqliteClient>
  }
>() {}

// Main Auth State service interface
export class WhatsAppAuthState extends Context.Tag("WhatsAppAuthState")<
  WhatsAppAuthState,
  {
    readonly createAuthState: (sessionId: string) => Effect.Effect<AuthenticationState, SqlError.SqlError, AuthStateRepository>
    readonly saveAuthState: (sessionId: string, state: AuthenticationState) => Effect.Effect<void, SqlError.SqlError, AuthStateRepository>
    readonly clearAuthState: (sessionId: string) => Effect.Effect<void, SqlError.SqlError, AuthStateRepository>
  }
>() {}

// Helper functions for serialization
const serializeBinaryData = (obj: any): any => {
  if (obj instanceof Uint8Array || obj instanceof Buffer) {
    return {
      __type: 'binary',
      data: Buffer.from(obj).toString('base64')
    }
  }
  if (Array.isArray(obj)) {
    return obj.map(serializeBinaryData)
  }
  if (obj && typeof obj === 'object') {
    const result: any = {}
    for (const [key, value] of Object.entries(obj)) {
      result[key] = serializeBinaryData(value)
    }
    return result
  }
  return obj
}

const deserializeBinaryData = (obj: any): any => {
  if (obj && obj.__type === 'binary') {
    return new Uint8Array(Buffer.from(obj.data, 'base64'))
  }
  if (Array.isArray(obj)) {
    return obj.map(deserializeBinaryData)
  }
  if (obj && typeof obj === 'object') {
    const result: any = {}
    for (const [key, value] of Object.entries(obj)) {
      result[key] = deserializeBinaryData(value)
    }
    return result
  }
  return obj
}

// Implementation layer for AuthStateRepository
export const AuthStateRepositoryLive = Layer.effect(
  AuthStateRepository,
  Effect.gen(function* () {
    return {
      initializeTables: () =>
        Effect.gen(function* () {
          const sql = yield* SqliteClient.SqliteClient

          // Table for authentication credentials
          yield* sql`
            CREATE TABLE IF NOT EXISTS auth_credentials (
              session_id TEXT PRIMARY KEY,
              credentials_data TEXT NOT NULL,
              created_at TEXT NOT NULL DEFAULT (datetime('now')),
              updated_at TEXT NOT NULL DEFAULT (datetime('now'))
            )
          `

          // Table for signal keys
          yield* sql`
            CREATE TABLE IF NOT EXISTS auth_keys (
              session_id TEXT NOT NULL,
              key_type TEXT NOT NULL,
              key_id TEXT NOT NULL,
              key_data TEXT NOT NULL,
              created_at TEXT NOT NULL DEFAULT (datetime('now')),
              updated_at TEXT NOT NULL DEFAULT (datetime('now')),
              PRIMARY KEY (session_id, key_type, key_id)
            )
          `

          // Indexes for performance
          yield* sql`
            CREATE INDEX IF NOT EXISTS idx_auth_keys_session_type ON auth_keys(session_id, key_type)
          `

          yield* sql`
            CREATE INDEX IF NOT EXISTS idx_auth_credentials_session ON auth_credentials(session_id)
          `

          yield* Effect.log("📦 Auth state tables initialized")
        }),

      saveCredentials: (sessionId, creds) =>
        Effect.gen(function* () {
          const sql = yield* SqliteClient.SqliteClient

          const serializedCreds = JSON.stringify(serializeBinaryData(creds))

          const result = yield* sql`
            INSERT OR REPLACE INTO auth_credentials (session_id, credentials_data, updated_at)
            VALUES (${sessionId}, ${serializedCreds}, datetime('now'))
            RETURNING session_id, credentials_data as data
          `

          return {
            sessionId: result[0].session_id,
            data: result[0].data
          } as AuthCreds
        }),

      loadCredentials: (sessionId) =>
        Effect.gen(function* () {
          const sql = yield* SqliteClient.SqliteClient

          const result = yield* sql`
            SELECT credentials_data 
            FROM auth_credentials 
            WHERE session_id = ${sessionId}
          `

          if (result.length === 0) {
            return null
          }

          const credentialsData = JSON.parse(result[0].credentials_data)
          return deserializeBinaryData(credentialsData) as AuthenticationCreds
        }),

      saveKeys: (sessionId, data) =>
        Effect.gen(function* () {
          const sql = yield* SqliteClient.SqliteClient

          // Process each key type and its entries
          for (const [keyType, keyEntries] of Object.entries(data)) {
            if (!keyEntries) continue

            for (const [keyId, keyData] of Object.entries(keyEntries)) {
              if (keyData === null) {
                // Delete the key
                yield* sql`
                  DELETE FROM auth_keys 
                  WHERE session_id = ${sessionId} 
                    AND key_type = ${keyType} 
                    AND key_id = ${keyId}
                `
              } else {
                // Insert or update the key
                const serializedData = JSON.stringify(serializeBinaryData(keyData))
                
                yield* sql`
                  INSERT OR REPLACE INTO auth_keys 
                  (session_id, key_type, key_id, key_data, updated_at)
                  VALUES (${sessionId}, ${keyType}, ${keyId}, ${serializedData}, datetime('now'))
                `
              }
            }
          }
        }),

      loadKeys: (sessionId, type, ids) =>
        Effect.gen(function* () {
          const sql = yield* SqliteClient.SqliteClient

          if (ids.length === 0) {
            return {}
          }

          const placeholders = ids.map(() => '?').join(',')
          const query = `
            SELECT key_id, key_data 
            FROM auth_keys 
            WHERE session_id = ? AND key_type = ? AND key_id IN (${placeholders})
          `

          const result = yield* sql.unsafe(query, [sessionId, type, ...ids])

          const keyMap: { [id: string]: any } = {}
          for (const row of result) {
            const keyData = JSON.parse(row.key_data)
            keyMap[row.key_id] = deserializeBinaryData(keyData)
          }

          return keyMap
        }),

      clearSession: (sessionId) =>
        Effect.gen(function* () {
          const sql = yield* SqliteClient.SqliteClient

          yield* sql`DELETE FROM auth_credentials WHERE session_id = ${sessionId}`
          yield* sql`DELETE FROM auth_keys WHERE session_id = ${sessionId}`

          yield* Effect.log(`🗑️ Cleared auth state for session: ${sessionId}`)
        })
    }
  })
)

// Implementation layer for WhatsAppAuthState
export const WhatsAppAuthStateLive = Layer.effect(
  WhatsAppAuthState,
  Effect.gen(function* () {
    const repository = yield* AuthStateRepository

    return {
      createAuthState: (sessionId) =>
        Effect.gen(function* () {
          // Load existing credentials or create new ones
          const existingCreds = yield* repository.loadCredentials(sessionId)

          let creds: AuthenticationCreds
          if (existingCreds) {
            creds = existingCreds
          } else {
            // If no existing creds, we'll need to create them during auth flow
            // This will be handled by Baileys during the authentication process
            creds = {} as AuthenticationCreds
          }

          // Create the SignalKeyStore implementation
          const keys: SignalKeyStore = {
            get: <T extends keyof SignalDataTypeMap>(type: T, ids: string[]) => 
              repository.loadKeys(sessionId, type, ids),

            set: (data: SignalDataSet) => 
              repository.saveKeys(sessionId, data),

            clear: () => 
              repository.clearSession(sessionId)
          }

          return {
            creds,
            keys
          } as AuthenticationState
        }),

      saveAuthState: (sessionId, state) =>
        Effect.gen(function* () {
          yield* repository.saveCredentials(sessionId, state.creds)
          yield* Effect.log(`💾 Saved auth state for session: ${sessionId}`)
        }),

      clearAuthState: (sessionId) =>
        repository.clearSession(sessionId)
    }
  })
)

// Combined layer for all auth state services
export const AuthStateLive = Layer.merge(
  AuthStateRepositoryLive,
  WhatsAppAuthStateLive
)

// Helper to initialize auth state tables
export const initializeAuthTables = (sql: SqliteClient.SqliteClient) =>
  Effect.gen(function* () {
    const repository = yield* AuthStateRepository
    yield* repository.initializeTables()
  }).pipe(
    Effect.provide(AuthStateRepositoryLive.pipe(
      Layer.provide(Layer.succeed(SqliteClient.SqliteClient, sql))
    ))
  )