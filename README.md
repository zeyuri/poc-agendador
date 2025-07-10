# WhatsApp Effect-TS Bot 🤖

A high-performance WhatsApp message processing bot built with [Effect-TS](https://effect.website/), [Baileys](https://github.com/WhiskeySockets/Baileys), and [Bun](https://bun.sh/). This application demonstrates modern functional programming patterns with TypeScript while providing real-time WhatsApp message processing capabilities.

## ✨ Features

- 🔄 **Real-time Message Processing**: Automatically captures and processes incoming WhatsApp messages
- 💾 **SQLite Database**: Persistent storage for all message data with SQLite integration
- 📊 **Message Logging**: Automated logging system with 2-second intervals for unprocessed messages
- 🏗️ **Effect-TS Architecture**: Built with modern functional programming patterns and dependency injection
- 🔐 **Type-Safe**: Full TypeScript implementation with strict type checking
- ⚡ **Bun Runtime**: Lightning-fast JavaScript runtime for optimal performance
- 🔄 **Graceful Shutdown**: Proper signal handling for clean application termination
- 📱 **QR Code Login**: Easy WhatsApp authentication via QR code scanning

## 🛠️ Tech Stack

- **Runtime**: [Bun](https://bun.sh/) - Fast JavaScript runtime
- **Framework**: [Effect-TS](https://effect.website/) - Functional programming library
- **WhatsApp Client**: [@whiskeysockets/baileys](https://github.com/WhiskeySockets/Baileys) - WhatsApp Web API
- **Database**: [SQLite](https://www.sqlite.org/) with [@effect/sql-sqlite-bun](https://effect.website/docs/guides/sql)
- **Language**: TypeScript 5+

## 📁 Project Structure

```
src/
├── main.ts              # Application entry point and layer composition
├── database/
│   ├── Schema.ts        # Database schema definitions and table creation
│   └── Repository.ts    # Database operations and message CRUD
├── effects/
│   └── Logger.ts        # Message logging service with scheduled tasks
└── whatsapp/
    ├── Connection.ts    # WhatsApp connection management and QR auth
    └── MessageStream.ts # Real-time message stream processing
```

## 🚀 Quick Start

### Prerequisites

- [Bun](https://bun.sh/) runtime installed
- Node.js 18+ (for compatibility)
- WhatsApp account for authentication

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd poc-agendador
   ```

2. **Install dependencies**
   ```bash
   bun install
   ```

3. **Start the application**
   ```bash
   bun run dev
   # or
   bun run start
   ```

### First Run Setup

1. **QR Code Authentication**: On first run, scan the QR code with your WhatsApp mobile app
2. **Database Initialization**: SQLite database will be automatically created at `./messages.db`
3. **Message Processing**: Start sending messages to your WhatsApp - they'll be captured and logged

## 🏗️ Architecture Overview

### Effect-TS Layer System

The application uses Effect-TS's powerful layer system for dependency injection:

```typescript
// Layer composition hierarchy
MainLive = DatabaseLive + MessageRepositoryLive + 
           WhatsAppConnectionLive + MessageStreamLive + 
           MessageLoggerLive
```

### Core Services

1. **WhatsAppConnection**: Manages WhatsApp authentication and connection lifecycle
2. **MessageStream**: Processes real-time message streams and converts them to typed data
3. **MessageRepository**: Handles all database operations for message persistence  
4. **MessageLogger**: Provides scheduled logging of unprocessed messages every 2 seconds

### Database Schema

Messages are stored with the following structure:

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

## 📝 Available Scripts

- `bun run dev` - Start development server with hot reloading
- `bun run start` - Start production server
- `bunx tsc` - Type checking

## 🔧 Configuration

### Environment Variables

The application uses WhatsApp Web's session management. Authentication state is automatically saved in the `./auth/` directory.

### Database

- **File**: `./messages.db` (SQLite)
- **Tables**: `messages` with indexed columns for optimal query performance
- **Migrations**: Automatic table creation on startup

## 🚦 Application Flow

1. **Startup**: Initialize database, create tables, compose service layers
2. **Authentication**: WhatsApp QR code authentication (first time only)
3. **Connection**: Establish WebSocket connection to WhatsApp servers
4. **Processing**: Real-time message capture and database storage
5. **Logging**: Scheduled logging every 2 seconds for monitoring
6. **Graceful Shutdown**: SIGINT/SIGTERM signal handling

## 🏃‍♂️ Development

### Code Style

The project uses:
- **TypeScript**: Strict mode with comprehensive type checking
- **Effect-TS Patterns**: Functional programming with proper error handling
- **Bun APIs**: Native Bun features for optimal performance

### Architecture Principles

- **Dependency Injection**: Using Effect-TS layers for clean architecture
- **Type Safety**: Comprehensive TypeScript coverage with schema validation
- **Error Handling**: Proper error boundaries and recovery mechanisms
- **Resource Management**: Automatic cleanup and connection management

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes following the existing patterns
4. Ensure TypeScript compilation passes (`bunx tsc`)
5. Test your changes thoroughly
6. Commit your changes (`git commit -m 'Add amazing feature'`)
7. Push to the branch (`git push origin feature/amazing-feature`)
8. Open a Pull Request

## 📄 License

This project is private and proprietary.

## 🔒 Security Notes

- WhatsApp authentication data is stored locally in `./auth/`
- Message database contains personal communication data
- Ensure proper file permissions and secure deployment practices
- Never commit authentication files to version control

## 🐛 Troubleshooting

### Common Issues

1. **QR Code Not Appearing**: Ensure terminal supports image display or check console output
2. **Database Errors**: Verify write permissions in the application directory
3. **Connection Issues**: Check internet connection and WhatsApp service status
4. **TypeScript Errors**: Run `bunx tsc` to identify and fix type issues

### Logs

The application provides comprehensive logging:
- 🚀 Startup and initialization messages
- ✅ Connection status updates  
- 📨 Message processing confirmations
- ❌ Error messages with context
- 🕒 Scheduled logging reports

---

*Built with ❤️ using Effect-TS and modern TypeScript patterns*