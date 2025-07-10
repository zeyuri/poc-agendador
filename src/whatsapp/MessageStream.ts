import { Effect, Stream, Queue, Chunk, Context, Layer, Schema } from "effect"
import type { WASocket, proto } from "@whiskeysockets/baileys"
import { MessageRepository } from "../database/Repository.js"
import { WhatsAppMessage, InsertMessageSchema } from "../database/Schema.js"

export interface BaileysMessage {
  type: "notify" | "append"
  messages: proto.IWebMessageInfo[]
}

const extractMessageDataEffect = (message: proto.IWebMessageInfo, myNumber?: string): Effect.Effect<Schema.Schema.Type<typeof InsertMessageSchema> | null> =>
  Effect.gen(function* () {
    try {
      const key = message.key
      const messageInfo = message.message

      if (!key || !key.remoteJid) return null

      // Extract basic data
      const id = key.id!
      const chatId = key.remoteJid
      const timestamp = message.messageTimestamp
        ? new Date(Number(message.messageTimestamp) * 1000).toISOString()
        : new Date().toISOString()
      const isFromMe = key.fromMe || false
      const isGroup = chatId.includes('@g.us')

      // Extract phone numbers
      const extractNumber = (fullId: string | null): string | null => {
        if (!fullId) return null
        return fullId.split('@')[0]?.split(':')[0] || null
      }

      let from: string | null, to: string | null

      if (isFromMe) {
        from = myNumber ? extractNumber(myNumber) : null
        to = extractNumber(chatId)
      } else {
        if (isGroup) {
          from = extractNumber(key.participant || chatId)
          to = myNumber ? extractNumber(myNumber) : null
        } else {
          from = extractNumber(chatId)
          to = myNumber ? extractNumber(myNumber) : null
        }
      }

      // Extract message content
      let content = ''
      let messageType = 'unknown'

      if (messageInfo?.conversation) {
        content = messageInfo.conversation
        messageType = 'text'
      } else if (messageInfo?.extendedTextMessage?.text) {
        content = messageInfo.extendedTextMessage.text
        messageType = 'text'
      } else if (messageInfo?.imageMessage) {
        content = messageInfo.imageMessage.caption || '[Image]'
        messageType = 'image'
      } else if (messageInfo?.videoMessage) {
        content = messageInfo.videoMessage.caption || '[Video]'
        messageType = 'video'
      } else if (messageInfo?.audioMessage) {
        content = '[Audio]'
        messageType = 'audio'
      } else if (messageInfo?.stickerMessage) {
        content = '[Sticker]'
        messageType = 'sticker'
      } else if (messageInfo?.documentMessage) {
        content = `[Document: ${messageInfo.documentMessage.fileName || 'No name'}]`
        messageType = 'document'
      } else {
        content = '[Special message]'
        messageType = 'other'
      }

      const messageData: Schema.Schema.Type<typeof InsertMessageSchema> = {
        id,
        from,
        to,
        chat_id: chatId,
        timestamp,
        content,
        messageType,
        isFromMe,
        isGroup,
        processed: false
      }

      return messageData
    } catch (error) {
      yield* Effect.log(`Error extracting message data: ${error instanceof Error ? error.message : String(error)}`)
      return null
    }
  })

export class MessageStream extends Context.Tag("MessageStream")<
  MessageStream,
  {
    readonly createMessageStream: (socket: WASocket) => Effect.Effect<Stream.Stream<WhatsAppMessage, never, never>>
    readonly extractMessageData: (message: proto.IWebMessageInfo, myNumber?: string) => Effect.Effect<Schema.Schema.Type<typeof InsertMessageSchema> | null>
  }
>() {}

export const MessageStreamLive = Layer.succeed(MessageStream, {
  createMessageStream: (socket) =>
    Effect.gen(function* () {
      const messageQueue = yield* Queue.bounded<BaileysMessage>(1000)

      // Setup Baileys event listener
      socket.ev.on('messages.upsert', ({ type, messages }) => {
        Effect.runFork(
          Queue.offer(messageQueue, { type, messages }).pipe(
            Effect.catchAll(() =>
              Effect.log(`Failed to queue message`)
            )
          )
        )
      })

      // Convert queue to stream and process messages
      return Stream.fromQueue(messageQueue).pipe(
        Stream.mapEffect(({ messages }) =>
          Effect.gen(function* () {
            const processedMessages: Schema.Schema.Type<typeof InsertMessageSchema>[] = []

            for (const message of messages) {
              if (message.key && message.key.remoteJid) {
                const processed = yield* extractMessageDataEffect(message)
                if (processed) {
                  processedMessages.push(processed)
                }
              }
            }

            return processedMessages
          })
        ),
        Stream.mapEffect(messages => Effect.succeed(Chunk.fromIterable(messages))),
        Stream.flattenChunks,
        Stream.mapEffect(message => {
          // Convert to WhatsAppMessage after processing for the stream
          return Effect.succeed(WhatsAppMessage.make({
            ...message,
            createdAt: new Date().toISOString()
          }))
        })
      )
    }),

  extractMessageData: (message, myNumber) => extractMessageDataEffect(message, myNumber)
})

export const processMessageStream = (socket: WASocket) =>
  Effect.gen(function* () {
    const messageStream = yield* MessageStream
    const repository = yield* MessageRepository

    const stream = yield* messageStream.createMessageStream(socket)

    yield* Stream.runForEach(stream, (message) =>
      Effect.gen(function* () {
        yield* Effect.log(`📨 Processing message: ${message.id} from ${message.from}`)
        yield* repository.insertMessage(message)
        yield* Effect.log(`💾 Message stored: ${message.content.substring(0, 50)}...`)
      }).pipe(
        Effect.catchAll(() =>
          Effect.log(`❌ Failed to process message ${message.id}`)
        )
      )
    )
  })