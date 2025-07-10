import { Effect, Context, Scope, Schedule, Layer } from "effect"
import { makeWASocket, DisconnectReason, useMultiFileAuthState, type WASocket } from "@whiskeysockets/baileys"
import qrcode from "qrcode-terminal"

export interface ConnectionState {
  status: "connecting" | "open" | "close" | "reconnecting"
  socket?: WASocket
}

export class WhatsAppConnection extends Context.Tag("WhatsAppConnection")<
  WhatsAppConnection,
  {
    readonly connect: () => Effect.Effect<WASocket, Error, Scope.Scope>
    readonly getConnectionState: () => Effect.Effect<ConnectionState>
  }
>() {}

const createReconnectionPolicy = Schedule.exponential("1 seconds").pipe(
  Schedule.intersect(Schedule.recurs(5)),
  Schedule.jittered
)

export const WhatsAppConnectionLive = Layer.succeed(
  WhatsAppConnection,
  {
    connect: () => Effect.acquireRelease(
      Effect.gen(function* () {
        yield* Effect.log("🚀 Starting WhatsApp connection...")

        const authResult = yield* Effect.tryPromise({
          try: () => useMultiFileAuthState('./auth'),
          catch: (error) => new Error(`Failed to load auth state: ${error}`)
        })

        const { state, saveCreds } = authResult

        const socket = yield* Effect.try({
          try: () => makeWASocket({
            auth: state,
            printQRInTerminal: false,
            generateHighQualityLinkPreview: true,
          }),
          catch: (error) => new Error(`Failed to create socket: ${error}`)
        })

        // Setup connection event handler
        socket.ev.on('connection.update', (update) => {
          const { connection, lastDisconnect, qr } = update

          if (qr) {
            console.log('📱 Scan the QR Code below with your WhatsApp:')
            console.log('')
            qrcode.generate(qr, { small: true })
            console.log('')
          }

          if (connection === 'close') {
            const shouldReconnect = (lastDisconnect?.error as any)?.output?.statusCode !== DisconnectReason.loggedOut

            console.log('🔌 Connection closed due to:', lastDisconnect?.error)

            if (shouldReconnect) {
              console.log('🔄 Attempting to reconnect...')
            } else {
              console.log('❌ Disconnected. Please login again.')
            }
          } else if (connection === 'open') {
            console.log('✅ Connected to WhatsApp successfully!')
          }
        })

        // Setup credentials save handler
        socket.ev.on('creds.update', () => {
          Effect.runFork(
            Effect.tryPromise({
              try: () => saveCreds(),
              catch: (error) => new Error(`Failed to save credentials: ${error}`)
            }).pipe(
              Effect.catchAll(error => Effect.log(`Credential save error: ${error.message}`))
            )
          )
        })

        // Wait for connection to be established
        yield* Effect.sleep("3 seconds")

        return socket
      }),
      (socket) => Effect.sync(() => {
        console.log('🛑 Cleaning up WhatsApp connection...')
        socket.ev.removeAllListeners('connection.update')
        socket.ev.removeAllListeners('creds.update')
        socket.ev.removeAllListeners('messages.upsert')
        socket.end(undefined)
      })
    ).pipe(
      Effect.retry(createReconnectionPolicy),
      Effect.tapError((error) => Effect.log(`Connection failed: ${error.message}`))
    ),

    getConnectionState: () => Effect.succeed({ status: "open" as const })
  }
)