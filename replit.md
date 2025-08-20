# Overview

This is a Discord ticket system bot built with Discord.js v14 and SQLite. The bot provides a comprehensive support ticket management system where users can create tickets by selecting from predefined categories, and staff members can claim and manage these tickets. The system includes features like automatic ticket cleanup, transcript generation, user feedback collection system, and role-based permissions.

## Recent Changes (December 2024)
- **Command Registration System**: Successfully migrated from hardcoded commands to file-based command loading with Discord API registration
- **Slash Commands Working**: All 6 slash commands (/setup, /add, /remove, /rename, /transfer, /transferadmin) now properly registered and available in Discord
- **Bot Connection**: Bot connects as "PCRP TICKET#5559" with full functionality restored
- **One-Time Response System**: Implemented per-user keyword response tracking to prevent duplicate auto-responses
- **Comprehensive Documentation**: Added detailed README with setup guides for AWS Linux and Windows hosting
- **Fixed Interaction Errors**: Resolved duplicate acknowledgment issues in transferadmin and feedback systems

# User Preferences

Preferred communication style: Simple, everyday language.
Ticket naming format: pcrp-username-category-### (simple 3-digit counter, no long timestamps)
Bot behavior: Single response only (no duplicate messages), proper feedback system handling

# System Architecture

## Bot Framework
The bot is built on Discord.js v14 with a modular architecture using:
- **Commands system**: Slash commands loaded dynamically from the `/commands` directory
  - `/setup` - Create ticket panel in channel
  - `/add` - Add user to ticket
  - `/remove` - Remove user from ticket
  - `/rename` - Rename ticket channel
  - `/transfer` - Move ticket to different category
  - `/transferadmin` - Notify specific admin about ticket
- **Events system**: Event handlers loaded from the `/events` directory for clean separation of concerns
- **Gateway intents**: Configured for guilds, messages, message content, and members to handle ticket interactions

## Database Layer
- **SQLite database**: Local file-based storage using sqlite3 for persistent data
- **Four main tables**:
  - `tickets`: Stores ticket metadata (ID, channel, user, status, timestamps)
  - `ticket_panels`: Tracks ticket creation panels in guilds
  - `transcripts`: Stores ticket conversation history
  - `feedback`: Stores user feedback with star ratings and comments
- **Database initialization**: Automatic table creation on startup with proper schema

## Ticket Management System
- **Category-based tickets**: Seven predefined categories (General Support, Account Issues, Business, Membership, Staff Application, Report, Billing)
- **Interactive UI**: Uses Discord select menus for ticket creation and buttons for ticket management
- **Permission system**: Role-based access control using admin roles defined in config
- **Automatic cleanup**: Configurable auto-deletion of closed tickets after specified time
- **Transcript generation**: Conversation history saved before ticket deletion
- **User feedback system**: Star ratings (1-5) and text comments collected when tickets close
- **AI auto-response system**: Category-specific welcome messages and keyword detection
- **Smart keyword detection**: Auto-replies for PayPal, UPI, refunds, and missing items
- **DM notifications**: Transcript delivery with interactive feedback collection buttons

## Configuration Management
- **JSON-based config**: Centralized configuration for guild IDs, channel IDs, role permissions, feedback channel
- **Environment variables**: Bot token and sensitive data stored in .env file
- **Flexible limits**: Configurable maximum tickets per user and auto-delete timers
- **Channel routing**: Automatic feedback routing to designated feedback channel (ID: 1407668519990067200)

## Event Handling Architecture
- **Interaction router**: Single interaction handler that routes slash commands, select menus, button interactions, and modal submissions
- **Ready event**: Bot initialization, ticket panel setup, and reconnection to existing tickets
- **Automatic synchronization**: Runs every 5 minutes to keep Discord channels and database in sync
- **Real-time reconnection**: Auto-reconnects when ticket validation fails during operations
- **Feedback system**: Star ratings open modal for comments (no required text), combined rating+comment posts
- **Error handling**: Comprehensive try-catch blocks with proper defer/edit reply handling to prevent interaction errors

## Utility Modules
- **Embed generator**: Standardized embed creation for consistent UI/UX
- **Ticket manager**: Core business logic for ticket lifecycle management
- **Database abstraction**: Clean separation between database operations and bot logic

# External Dependencies

## Core Dependencies
- **discord.js**: Primary Discord API wrapper for bot functionality and interactions
- **sqlite3**: Local database storage for persistent ticket data and configuration

## Runtime Dependencies
- **Node.js**: JavaScript runtime environment (requires v16.11.0+)
- **dotenv**: Environment variable management for secure token storage

## Discord Platform Integration
- **Discord Gateway**: Real-time event handling for user interactions
- **Discord Slash Commands**: Modern command interface with built-in validation
- **Discord Permissions API**: Role-based access control and channel permissions
- **Discord Channels API**: Dynamic channel creation and management for tickets