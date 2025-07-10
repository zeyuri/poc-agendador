# CLAUDE.md

This file provides guidance to Claude Code when working with code in this repository.

## Repository Overview

This is a **WhatsApp Effect-TS Bot** - a high-performance WhatsApp message processing bot built with modern functional programming patterns. The application demonstrates Effect-TS architecture while providing real-time WhatsApp message processing capabilities.

## Tech Stack & Runtime

**Primary Runtime**: [Bun](https://bun.sh/) - Fast JavaScript runtime
**Core Framework**: [Effect-TS](https://effect.website/) - Functional programming library with dependency injection
**WhatsApp Client**: [@whiskeysockets/baileys](https://github.com/WhiskeySockets/Baileys) - WhatsApp Web API
**Database**: SQLite with [@effect/sql-sqlite-bun](https://effect.website/docs/guides/sql)
**Language**: TypeScript 5+ with strict mode

### Bun Usage Guidelines

- Use `bun <file>` instead of `node <file>` or `ts-node <file>`
- Use `bun test` instead of `jest` or `vitest` 
- Use `bun build <file.html|file.ts|file.css>` instead of `webpack` or `esbuild`
- Use `bun install` instead of `npm install` or `yarn install` or `pnpm install`
- Use `bun run <script>` instead of `npm run <script>` or `yarn run <script>` or `pnpm run <script>`
- Bun automatically loads .env, so don't use dotenv

### Preferred Bun APIs

- `bun:sqlite` for SQLite (already using @effect/sql-sqlite-bun)
- `Bun.redis` for Redis. Don't use `ioredis`
- `Bun.sql` for Postgres. Don't use `pg` or `postgres.js`
- `WebSocket` is built-in. Don't use `ws`
- Prefer `Bun.file` over `node:fs`'s readFile/writeFile
- Bun.$`ls` instead of execa

## Development Commands

```bash
bun install           # Install dependencies
bun run dev          # Start development server with hot reloading
bun run start        # Start production server
bunx tsc             # Type checking
```

## Architecture Overview

### Effect-TS Layer System

The application uses Effect-TS's powerful dependency injection system with layered composition:

```typescript
// Layer composition hierarchy in src/main.ts
MainLive = DatabaseLive + MessageRepositoryLive + 
           WhatsAppConnectionLive + MessageStreamLive + 
           MessageLoggerLive
```

### Project Structure

```
src/
├── main.ts              # Application entry point and layer composition
├── database/
│   ├── Schema.ts        # Database schema definitions with Effect Schema
│   └── Repository.ts    # Database operations and message CRUD with dependency injection
├── effects/
│   └── Logger.ts        # Message logging service with scheduled tasks
└── whatsapp/
    ├── Connection.ts    # WhatsApp connection management and QR auth
    └── MessageStream.ts # Real-time message stream processing with Effect Streams
```

### Core Services & Dependencies

1. **WhatsAppConnection** (`src/whatsapp/Connection.ts`)
   - Manages WhatsApp authentication via QR code
   - Handles connection lifecycle with automatic reconnection
   - Uses Baileys library with Effect resource management
   - Implements exponential backoff retry policy

2. **MessageStream** (`src/whatsapp/MessageStream.ts`) 
   - Processes real-time message streams using Effect Streams
   - Converts Baileys messages to typed WhatsApp message data
   - Handles message queuing with bounded queues
   - Extracts content from various message types (text, image, video, audio, etc.)

3. **MessageRepository** (`src/database/Repository.ts`)
   - Provides typed database operations using Effect-TS contexts
   - CRUD operations: insertMessage, getUnprocessedMessages, markAsProcessed, getMessagesByChat
   - Uses SQLite with @effect/sql integration
   - Returns properly typed WhatsAppMessage objects

4. **MessageLogger** (`src/effects/Logger.ts`)
   - Scheduled logging service that runs every 2 seconds using Effect Schedule
   - Logs unprocessed messages and marks them as processed
   - Truncates long messages for display purposes
   - Error handling with Effect error management

5. **Database Layer** (`src/database/Schema.ts`)
   - SQLite database with indexed columns for performance
   - Effect Schema validation for type safety
   - WhatsAppMessage class with comprehensive validation
   - Automatic table creation on startup

### Database Schema

Messages stored with the following structure using Effect Schema:

```typescript
interface WhatsAppMessage {
  id: string                 // Unique message ID
  from: string | null       // Sender phone number
  to: string | null         // Recipient phone number  
  chat_id: string           // WhatsApp chat identifier
  timestamp: string         // ISO timestamp
  content: string           // Message text content
  messageType: string       // Type: text, image, video, audio, etc.
  isFromMe: boolean         // Whether sent by bot user
  isGroup: boolean          // Group vs direct message
  processed: boolean        // Processing status flag
  createdAt: string         // Database insertion timestamp
}
```

## Key Architectural Patterns

### Effect-TS Dependency Injection
- All services defined as Context.Tag for dependency injection
- Layer-based composition for clean architecture
- Effect.gen for readable async/functional programming
- Proper resource management with Effect.acquireRelease

### Functional Programming
- Pure functions with explicit error handling
- Stream-based message processing
- Schedule-based periodic tasks
- Immutable data structures with Effect Schema

### Error Handling
- Effect error boundaries with proper error types
- Retry policies with exponential backoff
- Graceful degradation and logging
- Type-safe error propagation

### Type Safety
- Comprehensive TypeScript coverage with strict mode
- Effect Schema for runtime validation
- Domain-driven type definitions
- No any types - full type inference

## Application Flow

1. **Startup**: Initialize database, create tables, compose service layers
2. **Authentication**: WhatsApp QR code authentication (stored in `./auth/`)
3. **Connection**: Establish WebSocket connection with retry logic
4. **Processing**: Real-time message capture using Effect Streams
5. **Storage**: Type-safe message persistence to SQLite
6. **Logging**: Scheduled processing every 2 seconds
7. **Graceful Shutdown**: Proper SIGINT/SIGTERM signal handling

## Development Guidelines

### Code Style
- Use Effect.gen syntax for readable async operations
- Follow functional programming patterns with Effect-TS
- Implement proper error handling with Effect error types
- Use Context.Tag for all services requiring dependency injection
- Leverage Effect Schema for all data validation

### Architecture Principles
- Dependency Injection: Effect-TS layers for clean architecture
- Type Safety: Effect Schema validation with compile-time safety
- Error Handling: Explicit error types and proper recovery
- Resource Management: Automatic cleanup using Effect scopes
- Stream Processing: Effect Streams for real-time data handling

### Testing
Use `bun test` for testing:

```ts
import { test, expect } from "bun:test";

test("hello world", () => {
  expect(1).toBe(1);
});
```

## Security & Configuration

### Authentication
- WhatsApp authentication state automatically saved in `./auth/` directory
- QR code authentication on first run
- Credential management handled by Baileys with Effect integration

### Database
- SQLite database file: `./messages.db`
- Indexed columns for optimal query performance
- Automatic migrations on startup

### File Permissions
- Ensure proper write permissions for database and auth directories
- Never commit authentication files to version control
- Use secure deployment practices for production

For more Bun-specific information, read the Bun API docs in `node_modules/bun-types/docs/**.md`.
