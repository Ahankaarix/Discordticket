const { Client, GatewayIntentBits, Collection, SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ChannelType, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle, Events, AttachmentBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, REST, Routes } = require('discord.js');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
// Bot Token - Replace with your actual Discord bot token
const DISCORD_TOKEN = "YOUR_DISCORD_BOT_TOKEN_HERE";

// Configuration
const config = {
    guildId: "1407656756779155477",
    ticketChannelId: "1407656785564930068",
    logsChannelId: "1407656810453663754",
    adminRoleId: "1407657166114127962",
    feedbackChannelId: "1407668519990067200",
    ticketCategoryId: null,
    maxTicketsPerUser: 1,
    autoDeleteAfterClose: 5000,
    transcriptChannelId: null
};

// Database setup
const dbPath = path.join(__dirname, 'tickets.db');
let db = null;

function initializeDatabase() {
    return new Promise((resolve, reject) => {
        db = new sqlite3.Database(dbPath, (err) => {
            if (err) {
                console.error('Error opening database:', err);
                reject(err);
                return;
            }
            
            console.log('Connected to SQLite database');
            
            // Create tables if they don't exist
            db.serialize(() => {
                // Tickets table
                db.run(`
                    CREATE TABLE IF NOT EXISTS tickets (
                        id TEXT PRIMARY KEY,
                        channel_id TEXT NOT NULL,
                        user_id TEXT NOT NULL,
                        category TEXT NOT NULL,
                        claimed_by TEXT DEFAULT NULL,
                        status TEXT DEFAULT 'open',
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        closed_at DATETIME DEFAULT NULL
                    )
                `);
                
                // Ticket panels table
                db.run(`
                    CREATE TABLE IF NOT EXISTS ticket_panels (
                        guild_id TEXT PRIMARY KEY,
                        channel_id TEXT NOT NULL,
                        message_id TEXT NOT NULL,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                    )
                `);
                
                // Transcripts table
                db.run(`
                    CREATE TABLE IF NOT EXISTS transcripts (
                        ticket_id TEXT PRIMARY KEY,
                        content TEXT NOT NULL,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                    )
                `);
                
                // Feedback table
                db.run(`
                    CREATE TABLE IF NOT EXISTS feedback (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        ticket_id TEXT NOT NULL,
                        user_id TEXT NOT NULL,
                        rating INTEGER,
                        comment TEXT,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                    )
                `);
            });
            
            resolve();
        });
    });
}

// Database functions
function createTicketDB(ticketId, channelId, userId, category) {
    return new Promise((resolve, reject) => {
        const stmt = db.prepare(`
            INSERT INTO tickets (id, channel_id, user_id, category)
            VALUES (?, ?, ?, ?)
        `);
        
        stmt.run([ticketId, channelId, userId, category], function(err) {
            if (err) {
                reject(err);
            } else {
                resolve(this.lastID);
            }
        });
        
        stmt.finalize();
    });
}

function getTicket(channelId) {
    return new Promise((resolve, reject) => {
        db.get(`
            SELECT * FROM tickets WHERE channel_id = ? AND status = 'open'
        `, [channelId], (err, row) => {
            if (err) {
                reject(err);
            } else {
                resolve(row);
            }
        });
    });
}

function getAnyTicket(channelId) {
    return new Promise((resolve, reject) => {
        db.get(`
            SELECT * FROM tickets WHERE channel_id = ?
        `, [channelId], (err, row) => {
            if (err) {
                reject(err);
            } else {
                resolve(row);
            }
        });
    });
}

function getTicketById(ticketId) {
    return new Promise((resolve, reject) => {
        db.get(`
            SELECT * FROM tickets WHERE id = ?
        `, [ticketId], (err, row) => {
            if (err) {
                reject(err);
            } else {
                resolve(row);
            }
        });
    });
}

function reopenTicket(channelId) {
    return new Promise((resolve, reject) => {
        const stmt = db.prepare(`
            UPDATE tickets SET status = 'open', closed_at = NULL 
            WHERE channel_id = ?
        `);
        
        stmt.run([channelId], function(err) {
            if (err) {
                reject(err);
            } else {
                resolve(this.changes > 0);
            }
        });
        
        stmt.finalize();
    });
}

function getAllOpenTickets() {
    return new Promise((resolve, reject) => {
        db.all(`
            SELECT * FROM tickets WHERE status = 'open'
        `, [], (err, rows) => {
            if (err) {
                reject(err);
            } else {
                resolve(rows);
            }
        });
    });
}

function claimTicket(channelId, adminId) {
    return new Promise((resolve, reject) => {
        const stmt = db.prepare(`
            UPDATE tickets SET claimed_by = ? WHERE channel_id = ? AND status = 'open'
        `);
        
        stmt.run([adminId, channelId], function(err) {
            if (err) {
                reject(err);
            } else {
                resolve(this.changes > 0);
            }
        });
        
        stmt.finalize();
    });
}

function closeTicket(channelId) {
    return new Promise((resolve, reject) => {
        const stmt = db.prepare(`
            UPDATE tickets SET status = 'closed', closed_at = CURRENT_TIMESTAMP 
            WHERE channel_id = ? AND status = 'open'
        `);
        
        stmt.run([channelId], function(err) {
            if (err) {
                reject(err);
            } else {
                resolve(this.changes > 0);
            }
        });
        
        stmt.finalize();
    });
}

function saveTicketPanel(guildId, channelId, messageId) {
    return new Promise((resolve, reject) => {
        const stmt = db.prepare(`
            INSERT OR REPLACE INTO ticket_panels (guild_id, channel_id, message_id)
            VALUES (?, ?, ?)
        `);
        
        stmt.run([guildId, channelId, messageId], function(err) {
            if (err) {
                reject(err);
            } else {
                resolve(this.lastID);
            }
        });
        
        stmt.finalize();
    });
}

function saveTranscript(ticketId, content) {
    return new Promise((resolve, reject) => {
        const stmt = db.prepare(`
            INSERT OR REPLACE INTO transcripts (ticket_id, content)
            VALUES (?, ?)
        `);
        
        stmt.run([ticketId, content], function(err) {
            if (err) {
                reject(err);
            } else {
                resolve(this.lastID);
            }
        });
        
        stmt.finalize();
    });
}

function updateTicketCategory(channelId, newCategory) {
    return new Promise((resolve, reject) => {
        const stmt = db.prepare(`
            UPDATE tickets SET category = ? WHERE channel_id = ? AND status = 'open'
        `);
        
        stmt.run([newCategory, channelId], function(err) {
            if (err) {
                reject(err);
            } else {
                resolve(this.changes > 0);
            }
        });
        
        stmt.finalize();
    });
}

function saveFeedback(ticketId, userId, rating, comment) {
    return new Promise((resolve, reject) => {
        const stmt = db.prepare(`
            INSERT INTO feedback (ticket_id, user_id, rating, comment)
            VALUES (?, ?, ?, ?)
        `);
        
        stmt.run([ticketId, userId, rating, comment], function(err) {
            if (err) {
                reject(err);
            } else {
                resolve(this.lastID);
            }
        });
        
        stmt.finalize();
    });
}

// Ticket categories
const TICKET_CATEGORIES = {
    'general_query': {
        label: 'General Support',
        description: 'General questions and support',
        emoji: '🔧'
    },
    'account_issues': {
        label: 'Account Issues',
        description: 'Problems with your account',
        emoji: '📧'
    },
    'business_ticket': {
        label: 'Business Ticket',
        description: 'Business-related inquiries',
        emoji: '💼'
    },
    'membership_ticket': {
        label: 'Membership Ticket',
        description: 'Membership support and questions',
        emoji: '👑'
    },
    'staff_application': {
        label: 'Staff Application',
        description: 'Apply to join our staff team',
        emoji: '📝'
    },
    'report': {
        label: 'Report',
        description: 'Report users or issues',
        emoji: '⚠️'
    },
    'billing': {
        label: 'Billing Support',
        description: 'Payment and billing issues',
        emoji: '💳'
    }
};

// HTML Transcript Generator
function generateHTMLTranscript(ticket, messages, guild, closedBy) {
    const categoryInfo = TICKET_CATEGORIES[ticket.category];
    const categoryLabel = categoryInfo ? categoryInfo.label : 'Unknown';
    
    const messagesHTML = messages.map(msg => {
        const timestamp = msg.createdAt.toLocaleString();
        const author = msg.author.tag;
        const avatar = msg.author.displayAvatarURL();
        const content = msg.content || '[No text content]';
        const isBot = msg.author.bot ? 'bot-message' : 'user-message';
        
        return `
        <div class="message ${isBot}">
            <img src="${avatar}" alt="${author}" class="avatar">
            <div class="message-content">
                <div class="message-header">
                    <span class="author">${author}</span>
                    <span class="timestamp">${timestamp}</span>
                </div>
                <div class="message-text">${content}</div>
            </div>
        </div>`;
    }).join('\\n');

    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Ticket Transcript - ${ticket.id}</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: #36393f;
            color: #dcddde;
            line-height: 1.6;
        }
        
        .container {
            max-width: 1000px;
            margin: 0 auto;
            padding: 20px;
        }
        
        .header {
            background: #2f3136;
            padding: 20px;
            border-radius: 8px;
            margin-bottom: 20px;
            border-left: 4px solid #5865f2;
        }
        
        .header h1 {
            color: #5865f2;
            margin-bottom: 10px;
        }
        
        .info-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 15px;
            margin-top: 15px;
        }
        
        .info-item {
            background: #40444b;
            padding: 10px;
            border-radius: 4px;
        }
        
        .info-label {
            color: #b9bbbe;
            font-size: 12px;
            text-transform: uppercase;
            margin-bottom: 5px;
        }
        
        .info-value {
            color: #ffffff;
            font-weight: 500;
        }
        
        .messages {
            background: #2f3136;
            border-radius: 8px;
            padding: 20px;
        }
        
        .message {
            display: flex;
            margin-bottom: 15px;
            padding: 10px;
            border-radius: 4px;
        }
        
        .user-message {
            background: #40444b;
        }
        
        .bot-message {
            background: #36393f;
            border-left: 3px solid #5865f2;
        }
        
        .avatar {
            width: 40px;
            height: 40px;
            border-radius: 50%;
            margin-right: 15px;
        }
        
        .message-content {
            flex: 1;
        }
        
        .message-header {
            display: flex;
            align-items: center;
            margin-bottom: 5px;
        }
        
        .author {
            font-weight: 600;
            color: #ffffff;
            margin-right: 10px;
        }
        
        .timestamp {
            font-size: 12px;
            color: #72767d;
        }
        
        .message-text {
            color: #dcddde;
            word-wrap: break-word;
        }
        
        .footer {
            text-align: center;
            margin-top: 30px;
            padding: 20px;
            background: #2f3136;
            border-radius: 8px;
            color: #72767d;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🎫 Ticket Transcript</h1>
            <div class="info-grid">
                <div class="info-item">
                    <div class="info-label">Ticket ID</div>
                    <div class="info-value">${ticket.id}</div>
                </div>
                <div class="info-item">
                    <div class="info-label">Category</div>
                    <div class="info-value">${categoryLabel}</div>
                </div>
                <div class="info-item">
                    <div class="info-label">Created</div>
                    <div class="info-value">${new Date(ticket.created_at).toLocaleString()}</div>
                </div>
                <div class="info-item">
                    <div class="info-label">Closed</div>
                    <div class="info-value">${new Date().toLocaleString()}</div>
                </div>
                <div class="info-item">
                    <div class="info-label">Closed By</div>
                    <div class="info-value">${closedBy.user.tag}</div>
                </div>
                <div class="info-item">
                    <div class="info-label">Server</div>
                    <div class="info-value">${guild.name}</div>
                </div>
            </div>
        </div>
        
        <div class="messages">
            <h2 style="margin-bottom: 20px; color: #ffffff;">💬 Conversation</h2>
            ${messagesHTML}
        </div>
        
        <div class="footer">
            <p>Generated on ${new Date().toLocaleString()}</p>
            <p>PCRP Ticket System - Discord Bot</p>
        </div>
    </div>
</body>
</html>`;
}

// Embed functions
function createTicketPanelEmbed() {
    return new EmbedBuilder()
        .setTitle('🎟️ Support Tickets')
        .setDescription(
            'Please choose the option that best matches your issue from the menu below.\n' +
            'Once you select, ✅ a private ticket channel will be created where our team can assist you.\n\n' +
            '✨ **How it works:**\n' +
            '• Pick a category from the menu ⬇️\n' +
            '• A new ticket will open 📂\n' +
            '• Our staff will reply as soon as possible ⏳'
        )
        .setColor(0x5865F2)
        .setTimestamp();
}

function createTicketEmbed(user, categoryInfo) {
    return new EmbedBuilder()
        .setTitle(`🎫 New Ticket - ${categoryInfo.label}`)
        .setDescription(
            `Hello ${user.toString()}!\n\n` +
            `Thank you for creating a ticket. Please describe your issue in detail and our support team will assist you shortly.\n\n` +
            `**Category:** ${categoryInfo.label}\n` +
            `**Created:** <t:${Math.floor(Date.now() / 1000)}:F>`
        )
        .setColor(0x00FF00)
        .setThumbnail(user.displayAvatarURL())
        .setTimestamp();
}

function createTicketControlsEmbed() {
    return new EmbedBuilder()
        .setTitle('🔧 Staff Management Panel')
        .setDescription(
            '**For Support Staff:**\n' +
            '🔷 Click **Claim Ticket** to assign yourself to this ticket\n' +
            '🔷 Click **Close Ticket** to close and archive this ticket\n\n' +
            '**For User:**\n' +
            '🔷 You can also close your ticket using the **Close Ticket** button'
        )
        .setColor(0x0099FF)
        .setTimestamp();
}

// Ticket management functions
async function createTicketPanel(channel, guild) {
    try {
        // Clear existing messages in the channel
        const messages = await channel.messages.fetch({ limit: 100 });
        if (messages.size > 0) {
            await channel.bulkDelete(messages).catch(console.error);
        }
        
        // Create select menu options
        const options = Object.entries(TICKET_CATEGORIES).map(([value, category]) => ({
            label: category.label,
            description: category.description,
            value: value,
            emoji: category.emoji
        }));
        
        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId('ticket_category')
            .setPlaceholder('Select the option that best fits your problem...')
            .addOptions(options);
        
        const row = new ActionRowBuilder()
            .addComponents(selectMenu);
        
        const embed = createTicketPanelEmbed();
        
        const message = await channel.send({
            embeds: [embed],
            components: [row]
        });
        
        // Save panel info to database
        await saveTicketPanel(guild.id, channel.id, message.id);
        
        console.log('Ticket panel created successfully');
        return true;
    } catch (error) {
        console.error('Error creating ticket panel:', error);
        return false;
    }
}

async function createTicket(guild, user, category) {
    try {
        const categoryInfo = TICKET_CATEGORIES[category];
        if (!categoryInfo) {
            throw new Error('Invalid ticket category');
        }
        
        // Generate unique ticket ID with category
        const categoryShortName = {
            'general_query': 'general',
            'account_issues': 'account',
            'business_ticket': 'business',
            'membership_ticket': 'membership',
            'staff_application': 'staff',
            'report': 'report',
            'billing': 'billing'
        }[category] || 'general';
        
        // Generate a simple counter-based ticket ID
        const existingTickets = await new Promise((resolve, reject) => {
            db.all("SELECT COUNT(*) as count FROM tickets WHERE user_id = ?", [user.id], (err, rows) => {
                if (err) reject(err);
                else resolve(rows[0].count);
            });
        });
        const ticketNumber = (existingTickets + 1).toString().padStart(3, '0');
        const ticketId = `pcrp-${user.username}-${categoryShortName}-${ticketNumber}`.toLowerCase().replace(/[^a-z0-9-]/g, '');
        
        // Get admin role
        const adminRole = guild.roles.cache.get(config.adminRoleId);
        
        // Create ticket channel with restricted permissions
        const ticketChannel = await guild.channels.create({
            name: ticketId,
            type: ChannelType.GuildText,
            topic: `Ticket for ${user.tag} (${user.id}) - Category: ${categoryInfo.label}`,
            permissionOverwrites: [
                {
                    id: guild.roles.everyone,
                    deny: [PermissionFlagsBits.ViewChannel]
                },
                {
                    id: user.id,
                    allow: [
                        PermissionFlagsBits.ViewChannel,
                        PermissionFlagsBits.SendMessages,
                        PermissionFlagsBits.ReadMessageHistory
                    ]
                },
                ...(adminRole ? [{
                    id: adminRole.id,
                    allow: [
                        PermissionFlagsBits.ViewChannel,
                        PermissionFlagsBits.ReadMessageHistory,
                        PermissionFlagsBits.ManageMessages
                    ],
                    deny: [PermissionFlagsBits.SendMessages]
                }] : [])
            ]
        });
        
        // Create ticket controls
        const claimButton = new ButtonBuilder()
            .setCustomId('claim_ticket')
            .setLabel('Claim Ticket')
            .setStyle(ButtonStyle.Primary)
            .setEmoji('👋');
        
        const closeButton = new ButtonBuilder()
            .setCustomId('close_ticket')
            .setLabel('Close Ticket')
            .setStyle(ButtonStyle.Danger)
            .setEmoji('🔒');
        
        const controlRow = new ActionRowBuilder()
            .addComponents(claimButton, closeButton);
        
        // Send ticket message
        const ticketEmbed = createTicketEmbed(user, categoryInfo);
        
        // Send main ticket message for everyone
        await ticketChannel.send({
            content: `${user.toString()}${adminRole ? ` ${adminRole.toString()}` : ''}`,
            embeds: [ticketEmbed]
        });
        
        // Send auto-response message based on category
        await sendAutoResponse(ticketChannel, user, category);
        
        // Send controls message only visible to admins
        if (adminRole) {
            const controlsEmbed = createTicketControlsEmbed();
            await ticketChannel.send({
                content: `${adminRole.toString()}`,
                embeds: [controlsEmbed],
                components: [controlRow]
            });
        }
        
        // Save ticket to database
        await createTicketDB(ticketId, ticketChannel.id, user.id, category);
        
        console.log(`Ticket created: ${ticketId} for user ${user.tag}`);
        return ticketChannel;
    } catch (error) {
        console.error('Error creating ticket:', error);
        return null;
    }
}

async function handleTicketClaim(interaction) {
    try {
        const guild = interaction.guild;
        const member = interaction.member;
        const channel = interaction.channel;
        
        // Check if user has admin role
        const adminRole = guild.roles.cache.get(config.adminRoleId);
        if (!adminRole || !member.roles.cache.has(adminRole.id)) {
            return await interaction.reply({
                content: '❌ You do not have permission to claim tickets.',
                ephemeral: true
            });
        }
        
        // Get ticket from database
        let ticket = await getTicket(channel.id);
        if (!ticket) {
            // Try auto-reconnect first
            const reconnected = await autoReconnectOnError(client, channel.id);
            
            if (reconnected) {
                // Try to get ticket again after reconnection
                ticket = await getTicket(channel.id).catch(() => null);
                if (ticket) {
                    console.log(`✅ Auto-reconnect successful for ticket claim in ${channel.name}`);
                } else {
                    return await interaction.reply({
                        content: '❌ This is not a valid ticket channel.',
                        ephemeral: true
                    });
                }
            } else {
                return await interaction.reply({
                    content: '❌ This is not a valid ticket channel.',
                    ephemeral: true
                });
            }
        }
        
        if (ticket.claimed_by) {
            const claimedUser = await guild.members.fetch(ticket.claimed_by).catch(() => null);
            return await interaction.reply({
                content: `❌ This ticket is already claimed by ${claimedUser ? claimedUser.toString() : 'another admin'}.`,
                ephemeral: true
            });
        }
        
        // Claim the ticket
        await claimTicket(channel.id, member.id);
        
        // Give claimer permission to send messages
        await channel.permissionOverwrites.edit(member.id, {
            ViewChannel: true,
            SendMessages: true,
            ReadMessageHistory: true,
            ManageMessages: true
        });
        
        await interaction.reply({
            content: `✅ ${member.toString()} has claimed this ticket!`
        });
        
        console.log(`Ticket ${ticket.id} claimed by ${member.user.tag}`);
    } catch (error) {
        console.error('Error claiming ticket:', error);
        if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({
                content: '❌ An error occurred while claiming the ticket.',
                ephemeral: true
            });
        }
    }
}

async function handleTicketClose(interaction) {
    try {
        const guild = interaction.guild;
        const member = interaction.member;
        const channel = interaction.channel;
        
        // Check if user has admin role or is the ticket creator
        const adminRole = guild.roles.cache.get(config.adminRoleId);
        let ticket = await getTicket(channel.id);
        
        if (!ticket) {
            // Try auto-reconnect first
            const reconnected = await autoReconnectOnError(client, channel.id);
            
            if (reconnected) {
                // Try to get ticket again after reconnection
                ticket = await getTicket(channel.id).catch(() => null);
                if (ticket) {
                    console.log(`✅ Auto-reconnect successful for ticket close in ${channel.name}`);
                } else {
                    if (!interaction.replied && !interaction.deferred) {
                        return await interaction.reply({
                            content: '❌ This is not a valid ticket channel.',
                            ephemeral: true
                        });
                    }
                    return;
                }
            } else {
                if (!interaction.replied && !interaction.deferred) {
                    return await interaction.reply({
                        content: '❌ This is not a valid ticket channel.',
                        ephemeral: true
                    });
                }
                return;
            }
        }
        
        const isAdmin = adminRole && member.roles.cache.has(adminRole.id);
        const isTicketCreator = ticket.user_id === member.id;
        
        if (!isAdmin && !isTicketCreator) {
            if (!interaction.replied && !interaction.deferred) {
                return await interaction.reply({
                    content: '❌ You do not have permission to close this ticket.',
                    ephemeral: true
                });
            }
            return;
        }
        
        // Defer the interaction to give us more time for processing
        if (!interaction.replied && !interaction.deferred) {
            await interaction.deferReply();
        }
        
        // Generate transcript
        const messages = await channel.messages.fetch({ limit: 100 });
        const sortedMessages = messages.reverse();
        
        // Generate plain text transcript
        const transcript = sortedMessages.map(msg => 
            `[${msg.createdAt.toISOString()}] ${msg.author.tag}: ${msg.content}`
        ).join('\n');
        
        // Generate HTML transcript
        const htmlTranscript = generateHTMLTranscript(ticket, sortedMessages, guild, member);
        const fileName = `transcript-${ticket.id}.html`;
        const filePath = path.join(__dirname, fileName);
        
        // Save HTML file
        fs.writeFileSync(filePath, htmlTranscript);
        
        // Save transcript to database
        await saveTranscript(ticket.id, transcript);
        
        // Close ticket in database
        await closeTicket(channel.id);
        
        // Update the user about the process
        if (interaction.deferred) {
            await interaction.editReply({
                content: '✅ Ticket closed successfully! Transcript saved and sent to logs.'
            });
        }
        
        // Get ticket creator for DM and logs
        const user = await guild.members.fetch(ticket.user_id).catch(() => null);
        const claimedBy = ticket.claimed_by ? await guild.members.fetch(ticket.claimed_by).catch(() => null) : null;
        
        // Create attachment for HTML transcript
        const attachment = new AttachmentBuilder(filePath, { name: fileName });
        
        // Send transcript to logs channel if configured
        const logsChannel = guild.channels.cache.get(config.logsChannelId);
        if (logsChannel) {
            await logsChannel.send({
                content: `**Ticket Closed**\n` +
                        `**Ticket ID:** ${ticket.id}\n` +
                        `**Created by:** ${user ? user.toString() : 'Unknown User'}\n` +
                        `**Claimed by:** ${claimedBy ? claimedBy.toString() : 'Unclaimed'}\n` +
                        `**Closed by:** ${member.toString()}\n` +
                        `**Category:** ${ticket.category}\n` +
                        `**Created:** ${ticket.created_at}\n` +
                        `**Closed:** ${new Date().toISOString()}`,
                files: [attachment]
            });
        }
        
        // Send transcript copy to ticket creator via DM
        if (user) {
            try {
                const categoryInfo = TICKET_CATEGORIES[ticket.category];
                const userAttachment = new AttachmentBuilder(filePath, { name: fileName });
                
                // Create feedback buttons
                const star1 = new ButtonBuilder()
                    .setCustomId(`feedback_1_${ticket.id}`)
                    .setLabel('1⭐')
                    .setStyle(ButtonStyle.Secondary);
                
                const star2 = new ButtonBuilder()
                    .setCustomId(`feedback_2_${ticket.id}`)
                    .setLabel('2⭐')
                    .setStyle(ButtonStyle.Secondary);
                
                const star3 = new ButtonBuilder()
                    .setCustomId(`feedback_3_${ticket.id}`)
                    .setLabel('3⭐')
                    .setStyle(ButtonStyle.Secondary);
                
                const star4 = new ButtonBuilder()
                    .setCustomId(`feedback_4_${ticket.id}`)
                    .setLabel('4⭐')
                    .setStyle(ButtonStyle.Secondary);
                
                const star5 = new ButtonBuilder()
                    .setCustomId(`feedback_5_${ticket.id}`)
                    .setLabel('5⭐')
                    .setStyle(ButtonStyle.Success);
                
                const feedbackRow = new ActionRowBuilder()
                    .addComponents(star1, star2, star3, star4, star5);
                
                // Removed text feedback button since comments are now handled in star rating modals
                
                await user.user.send({
                    content: `🎫 **Your Support Ticket Transcript**\n\n` +
                            `Hello ${user.user.username}! Your support ticket has been closed.\n\n` +
                            `**Ticket Details:**\n` +
                            `• **Ticket ID:** ${ticket.id}\n` +
                            `• **Category:** ${categoryInfo ? categoryInfo.label : 'Unknown'} ${categoryInfo ? categoryInfo.emoji : ''}\n` +
                            `• **Closed by:** ${member.user.tag}\n` +
                            `• **Date:** ${new Date().toLocaleDateString()}\n\n` +
                            `📎 **Attached:** Complete conversation transcript\n\n` +
                            `💭 **How was our support?** Please rate your experience:\n\n` +
                            `Thank you for using PCRP Support! If you need further assistance, feel free to create a new ticket.`,
                    files: [userAttachment],
                    components: [feedbackRow]
                });
                
                console.log(`Transcript DM sent successfully to ${user.user.tag}`);
            } catch (dmError) {
                console.log(`Could not send transcript DM to ${user.user.tag}: ${dmError.message}`);
                // Try to inform in logs channel that DM failed
                if (logsChannel) {
                    try {
                        await logsChannel.send({
                            content: `⚠️ **DM Failed** - Could not send transcript to ${user.toString()}: ${dmError.message}`
                        });
                    } catch (logError) {
                        console.log('Failed to log DM error:', logError.message);
                    }
                }
            }
        }
        
        // Delete channel after a short delay
        setTimeout(async () => {
            try {
                await channel.delete();
                console.log(`Ticket channel ${channel.name} deleted`);
                
                // Clean up HTML file after sending
                if (fs.existsSync(filePath)) {
                    fs.unlinkSync(filePath);
                    console.log(`Cleaned up transcript file: ${fileName}`);
                }
            } catch (error) {
                console.error('Error deleting ticket channel:', error);
            }
        }, 5000);
        
    } catch (error) {
        console.error('Error closing ticket:', error);
        if (!interaction.replied && !interaction.deferred) {
            try {
                await interaction.reply({
                    content: '❌ An error occurred while closing the ticket.',
                    ephemeral: true
                });
            } catch (replyError) {
                console.error('Could not send error reply:', replyError);
            }
        } else {
            try {
                await interaction.followUp({
                    content: '❌ An error occurred while closing the ticket.',
                    ephemeral: true
                });
            } catch (followUpError) {
                console.error('Could not send follow up message:', followUpError);
            }
        }
    }
}

async function reconnectToTickets(client, guild) {
    try {
        console.log('Starting comprehensive ticket reconnection...');
        
        // Step 1: Get all open tickets from database
        const openTickets = await getAllOpenTickets();
        console.log(`Found ${openTickets.length} open tickets in database`);
        
        // Step 2: Get all pcrp- channels from Discord
        const ticketChannels = guild.channels.cache.filter(channel => 
            channel.name.startsWith('pcrp-') && channel.type === 0 // Text channel
        );
        console.log(`Found ${ticketChannels.size} pcrp- channels in Discord`);
        
        let reconnectedCount = 0;
        let createdCount = 0;
        let closedCount = 0;
        
        // Step 3: Process database tickets and match with Discord channels
        for (const ticket of openTickets) {
            try {
                const channel = guild.channels.cache.get(ticket.channel_id);
                if (!channel) {
                    // Channel doesn't exist, mark ticket as closed
                    await closeTicket(ticket.channel_id);
                    console.log(`Closed orphaned ticket: ${ticket.id} (channel deleted)`);
                    closedCount++;
                    continue;
                }
                
                // Verify channel is still a valid ticket
                if (!channel.name.startsWith('pcrp-')) {
                    await closeTicket(ticket.channel_id);
                    console.log(`Closed invalid ticket: ${ticket.id} (wrong format)`);
                    closedCount++;
                    continue;
                }
                
                reconnectedCount++;
                console.log(`✅ Reconnected: ${ticket.id} -> ${channel.name}`);
            } catch (error) {
                console.error(`Error processing ticket ${ticket.id}:`, error);
                await closeTicket(ticket.channel_id);
                closedCount++;
            }
        }
        
        // Step 4: Find Discord channels that don't have open database records
        for (const [channelId, channel] of ticketChannels) {
            try {
                const existingOpenTicket = await getTicket(channelId).catch(() => null);
                if (!existingOpenTicket) {
                    // Check if there's any ticket record (even closed)
                    const anyTicket = await getAnyTicket(channelId).catch(() => null);
                    
                    if (anyTicket) {
                        // Ticket exists but is closed - reopen it
                        await reopenTicket(channelId);
                        console.log(`🔄 Reopened ticket: ${anyTicket.id} -> ${channel.name}`);
                        reconnectedCount++;
                    } else {
                        // Check if ticket exists by ID (different channel)
                        const ticketId = channel.name;
                        const ticketById = await getTicketById(ticketId).catch(() => null);
                        
                        if (ticketById) {
                            // Ticket exists but wrong channel - update channel ID
                            const stmt = db.prepare(`
                                UPDATE tickets SET channel_id = ?, status = 'open', closed_at = NULL 
                                WHERE id = ?
                            `);
                            
                            await new Promise((resolve, reject) => {
                                stmt.run([channelId, ticketId], function(err) {
                                    if (err) reject(err);
                                    else resolve(this.changes > 0);
                                });
                                stmt.finalize();
                            });
                            
                            console.log(`🔄 Updated ticket channel: ${ticketId} -> ${channelId}`);
                            reconnectedCount++;
                        } else {
                            // Completely new channel - create database record
                            const ticketId = channel.name;
                            
                            // Try to extract user ID from channel topic
                            let userId = null;
                            let category = 'general_query';
                            
                            if (channel.topic) {
                                const topicMatch = channel.topic.match(/\((\d+)\)/);
                                if (topicMatch) {
                                    userId = topicMatch[1];
                                }
                                
                                // Try to extract category from topic
                                const categoryMatch = channel.topic.match(/Category: (.+)/);
                                if (categoryMatch) {
                                    const categoryLabel = categoryMatch[1].toLowerCase();
                                    const categoryKey = Object.keys(TICKET_CATEGORIES).find(key => 
                                        TICKET_CATEGORIES[key].label.toLowerCase() === categoryLabel
                                    );
                                    if (categoryKey) {
                                        category = categoryKey;
                                    }
                                }
                            }
                            
                            if (userId) {
                                try {
                                    await createTicketDB(ticketId, channelId, userId, category);
                                    console.log(`🆕 Created database record: ${ticketId}`);
                                    createdCount++;
                                    reconnectedCount++;
                                } catch (createError) {
                                    if (createError.message.includes('UNIQUE constraint')) {
                                        console.log(`⚠️ Ticket ID ${ticketId} already exists, skipping creation`);
                                    } else {
                                        throw createError;
                                    }
                                }
                            } else {
                                console.log(`⚠️ Could not determine user for channel ${channel.name}`);
                            }
                        }
                    }
                }
            } catch (error) {
                console.error(`Error processing channel ${channel.name}:`, error);
            }
        }
        
        console.log(`\n📊 Reconnection Summary:`);
        console.log(`✅ Reconnected: ${reconnectedCount} tickets`);
        console.log(`🆕 Created: ${createdCount} database records`);
        console.log(`❌ Closed: ${closedCount} orphaned tickets`);
        console.log(`📍 Total active: ${reconnectedCount} tickets\n`);
        
    } catch (error) {
        console.error('Error during ticket reconnection:', error);
    }
}

async function handleTicketCreation(interaction) {
    try {
        const category = interaction.values[0];
        const guild = interaction.guild;
        const user = interaction.user;
        
        // Check if user already has an open ticket (updated for pcrp- format)
        const existingTickets = guild.channels.cache.filter(channel => 
            channel.name.startsWith('pcrp-') && 
            channel.topic && 
            channel.topic.includes(user.id)
        );
        
        await interaction.deferReply({ ephemeral: true });
        
        if (existingTickets.size > 0) {
            return await interaction.editReply({
                content: '❌ You already have an open ticket! Please close your existing ticket before creating a new one.'
            });
        }
        
        const ticket = await createTicket(guild, user, category);
        
        if (ticket) {
            await interaction.editReply({
                content: `✅ Your ticket has been created! Please check ${ticket.toString()}`
            });
        } else {
            await interaction.editReply({
                content: '❌ Failed to create ticket. Please try again or contact an administrator.'
            });
        }
    } catch (error) {
        console.error('Ticket creation error:', error);
        if (interaction.deferred && !interaction.replied) {
            await interaction.editReply({
                content: '❌ An error occurred while creating your ticket.'
            });
        } else if (!interaction.replied) {
            await interaction.reply({
                content: '❌ An error occurred while creating your ticket.',
                ephemeral: true
            });
        }
    }
}

async function handleTicketTransfer(interaction) {
    try {
        const newCategory = interaction.values[0];
        const guild = interaction.guild;
        const member = interaction.member;
        const channel = interaction.channel;
        
        // Get ticket from database
        const ticket = await getTicket(channel.id);
        if (!ticket) {
            return await interaction.reply({
                content: '❌ This is not a valid ticket channel.',
                ephemeral: true
            });
        }
        
        const oldCategoryInfo = TICKET_CATEGORIES[ticket.category];
        const newCategoryInfo = TICKET_CATEGORIES[newCategory];
        
        if (!newCategoryInfo) {
            return await interaction.reply({
                content: '❌ Invalid category selected.',
                ephemeral: true
            });
        }
        
        // Update ticket category in database
        await updateTicketCategory(channel.id, newCategory);
        
        // Update channel topic
        const user = await guild.members.fetch(ticket.user_id).catch(() => null);
        const newTopic = `Ticket for ${user ? user.user.tag : 'Unknown User'} (${ticket.user_id}) - Category: ${newCategoryInfo.label}`;
        await channel.setTopic(newTopic);
        
        // Generate new channel name with new category
        const categoryShortName = {
            'general_query': 'general',
            'account_issues': 'account', 
            'business_ticket': 'business',
            'membership_ticket': 'membership',
            'staff_application': 'staff',
            'report': 'report',
            'billing': 'billing'
        }[newCategory] || 'general';
        
        const username = user ? user.user.username : 'unknown';
        const newChannelName = `pcrp-${username}-${categoryShortName}`.toLowerCase().replace(/[^a-z0-9-]/g, '');
        
        // Rename channel to reflect new category
        await channel.setName(newChannelName);
        
        await interaction.reply({
            content: `✅ **Ticket Transferred Successfully**\n\n` +
                    `**From:** ${oldCategoryInfo ? oldCategoryInfo.label : 'Unknown'} ${oldCategoryInfo ? oldCategoryInfo.emoji : ''}\n` +
                    `**To:** ${newCategoryInfo.label} ${newCategoryInfo.emoji}\n` +
                    `**New Channel Name:** ${newChannelName}`
        });
        
        // Send notification message in the ticket
        await channel.send({
            content: `🔄 **Ticket Category Changed**\n\n` +
                    `This ticket has been transferred from **${oldCategoryInfo ? oldCategoryInfo.label : 'Unknown'}** to **${newCategoryInfo.label}** by ${member.toString()}.`
        });
        
        console.log(`Ticket ${ticket.id} transferred from ${ticket.category} to ${newCategory} by ${member.user.tag}`);
        
    } catch (error) {
        console.error('Ticket transfer error:', error);
        await interaction.reply({
            content: '❌ An error occurred while transferring the ticket.',
            ephemeral: true
        });
    }
}

// Create Discord client
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
    ]
});

// Initialize collections
client.commands = new Collection();

// Load commands from files
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

const commands = [];
for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);
    if ('data' in command && 'execute' in command) {
        client.commands.set(command.data.name, command);
        commands.push(command.data.toJSON());
        console.log(`Loaded command: ${command.data.name}`);
    } else {
        console.log(`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`);
    }
}

// All commands are now loaded from the /commands directory

// Trigger reconnection when ticket not found
async function autoReconnectOnError(client, channelId) {
    try {
        const guild = client.guilds.cache.get(config.guildId);
        if (guild) {
            console.log(`🔄 Auto-reconnecting due to missing ticket: ${channelId}`);
            await reconnectToTickets(client, guild);
            
            // Check if ticket is now available
            const ticket = await getTicket(channelId).catch(() => null);
            return ticket !== null;
        }
    } catch (error) {
        console.error('Auto-reconnect on error failed:', error);
    }
    return false;
}

// Commands are now loaded from files above

// Ready event
client.once(Events.ClientReady, async (client) => {
    console.log(`Ready! Logged in as ${client.user.tag}`);
    
    // Register slash commands with Discord
    try {
        console.log('Started refreshing application (/) commands.');
        
        const rest = new REST().setToken(DISCORD_TOKEN);
        await rest.put(
            Routes.applicationGuildCommands(client.user.id, config.guildId),
            { body: commands }
        );
        
        console.log('Successfully reloaded application (/) commands.');
    } catch (error) {
        console.error('Error registering slash commands:', error);
    }
    
    try {
        // Get the specified guild and channels from config
        const guild = client.guilds.cache.get(config.guildId);
        if (!guild) {
            console.error('Guild not found! Please check your guild ID in config');
            return;
        }
        
        const ticketChannel = guild.channels.cache.get(config.ticketChannelId);
        if (!ticketChannel) {
            console.error('Ticket channel not found! Please check your ticket channel ID in config');
            return;
        }
        
        // Clean up old messages and create new ticket panel
        console.log('Setting up ticket panel...');
        await createTicketPanel(ticketChannel, guild);
        
        // Reconnect to existing open tickets
        console.log('Reconnecting to open tickets...');
        await reconnectToTickets(client, guild);
        
        // Start automatic reconnection system (every 5 minutes)
        setInterval(async () => {
            try {
                await reconnectToTickets(client, guild);
            } catch (error) {
                console.error('Auto-reconnect failed:', error);
            }
        }, 5 * 60 * 1000);
        
        console.log('Bot initialization complete!');
        
    } catch (error) {
        console.error('Error during bot initialization:', error);
    }
});

// Feedback handling functions
async function handleFeedback(interaction) {
    const [prefix, rating, ticketId] = interaction.customId.split('_');
    
    try {
        if (prefix === 'feedback' && rating && rating !== 'text') {
            // Star rating feedback - show modal with rating pre-selected
            const ratingNum = parseInt(rating);
            
            const modal = new ModalBuilder()
                .setCustomId(`feedback_modal_${ticketId}_${ratingNum}`)
                .setTitle(`Feedback - ${ratingNum}⭐`);
            
            const commentInput = new TextInputBuilder()
                .setCustomId('feedback_comment')
                .setLabel('Add your comment (optional)')
                .setPlaceholder('Share your thoughts about the support you received...')
                .setStyle(TextInputStyle.Paragraph)
                .setMinLength(0)
                .setMaxLength(1000)
                .setRequired(false);
            
            const firstActionRow = new ActionRowBuilder().addComponents(commentInput);
            modal.addComponents(firstActionRow);
            
            await interaction.showModal(modal);
            return; // Don't send additional response for modal
            
        } else if (prefix === 'feedback' && rating === 'text') {
            // Text feedback - show modal
            const modal = new ModalBuilder()
                .setCustomId(`feedback_modal_${ticketId}`)
                .setTitle('Share Your Feedback');
                
            const feedbackInput = new TextInputBuilder()
                .setCustomId('feedback_comment')
                .setLabel('How was your support experience?')
                .setPlaceholder('Please share your thoughts about the support you received...')
                .setStyle(TextInputStyle.Paragraph)
                .setMinLength(10)
                .setMaxLength(1000)
                .setRequired(true);
                
            const firstActionRow = new ActionRowBuilder().addComponents(feedbackInput);
            modal.addComponents(firstActionRow);
            
            await interaction.showModal(modal);
        }
    } catch (error) {
        console.error('Feedback handling error:', error);
        await interaction.reply({
            content: '❌ There was an error processing your feedback. Please try again later.',
            ephemeral: true
        });
    }
}

async function handleFeedbackModal(interaction) {
    const customId = interaction.customId.replace('feedback_modal_', '');
    const parts = customId.split('_');
    const ticketId = parts.slice(0, -1).join('_'); // Everything except the last part
    const rating = parts[parts.length - 1]; // Last part is the rating
    const comment = interaction.fields.getTextInputValue('feedback_comment');
    
    try {
        await interaction.deferReply({ ephemeral: true });
        
        // Save feedback to database with both rating and comment
        const ratingNum = rating ? parseInt(rating) : null;
        await saveFeedback(ticketId, interaction.user.id, ratingNum, comment || null);
        
        // Send to feedback channel
        const feedbackChannel = client.channels.cache.get(config.feedbackChannelId);
        if (feedbackChannel) {
            const embed = {
                title: '⭐ Customer Feedback',
                color: ratingNum ? (ratingNum >= 4 ? 0x00ff00 : ratingNum >= 3 ? 0xffff00 : 0xff0000) : 0x0099ff,
                fields: [
                    { name: '🎫 Ticket ID', value: ticketId, inline: true },
                    { name: '👤 User', value: interaction.user.tag, inline: true }
                ],
                timestamp: new Date(),
                footer: { text: 'PCRP Support Feedback System' }
            };
            
            if (ratingNum) {
                embed.fields.push({ name: '⭐ Rating', value: `${ratingNum}/5 stars`, inline: true });
            }
            
            if (comment && comment.trim()) {
                embed.fields.push({ 
                    name: '💬 Comment', 
                    value: comment.length > 1000 ? comment.substring(0, 997) + '...' : comment, 
                    inline: false 
                });
            }
            
            await feedbackChannel.send({ embeds: [embed] });
        }
        
        let responseMessage = '✅ Thank you for your feedback!';
        if (ratingNum) {
            responseMessage += `\n\n**Rating:** ${ratingNum}/5 stars`;
        }
        if (comment && comment.trim()) {
            responseMessage += `\n**Your comment:** ${comment}`;
        }
        responseMessage += '\n\nWe appreciate your time and will use this feedback to improve our service.';
        
        await interaction.editReply({
            content: responseMessage
        });
        
    } catch (error) {
        console.error('Feedback modal handling error:', error);
        if (interaction.deferred) {
            await interaction.editReply({
                content: '❌ There was an error saving your feedback. Please try again later.'
            });
        } else {
            await interaction.reply({
                content: '❌ There was an error saving your feedback. Please try again later.',
                ephemeral: true
            });
        }
    }
}

// Auto-response system
async function sendAutoResponse(channel, user, category) {
    const autoResponses = {
        'general_query': `👋 Welcome ${user.toString()}! How can we assist you today?`,
        'account_issues': `👋 Hi ${user.toString()}, please describe your account problem (include username, email, or any proof if needed).`,
        'business_ticket': `💼 Hello ${user.toString()}, please provide details about your business inquiry so our team can review it.`,
        'membership_ticket': `👑 Hi ${user.toString()}, please share your membership details or questions so we can assist you.`,
        'staff_application': `📝 Welcome ${user.toString()}! Please provide your details (Name, Age, Experience, and why you'd like to join our team).`,
        'report': `⚠️ Hello ${user.toString()}, please provide details about the issue or user you are reporting.\nℹ️ Include names, IDs, screenshots, or any proof to help us review it quickly.`,
        'billing': `💳 Hi ${user.toString()}, please explain your billing/payment issue 🧾.\nRemember: since your payment is an investment to the server, we follow a no refund policy for all purchases.`
    };
    
    const response = autoResponses[category];
    if (response) {
        setTimeout(async () => {
            try {
                // Check if bot has already sent a message in this channel to avoid duplicates
                const recentMessages = await channel.messages.fetch({ limit: 10 });
                const botMessages = recentMessages.filter(msg => msg.author.bot && msg.author.id === client.user.id);
                
                // Only send if no bot message exists or the last bot message is older than 30 seconds
                const shouldSend = botMessages.size === 0 || 
                    (Date.now() - botMessages.first().createdTimestamp) > 30000;
                
                if (shouldSend) {
                    await channel.send({
                        content: response
                    });
                }
            } catch (error) {
                console.error('Error sending auto-response:', error);
            }
        }, 2000); // 2 second delay
    }
}

// Track user keyword responses to prevent repeats
const userKeywordResponses = new Map();

// Keyword detection system with per-user response tracking
async function handleKeywordResponse(message) {
    const content = message.content.toLowerCase();
    const userId = message.author.id;
    const channelId = message.channel.id;
    
    // Create unique key for user + channel + keyword type
    let keywordType = null;
    if (content.includes('paypal')) keywordType = 'paypal';
    else if (content.includes('upi')) keywordType = 'upi';
    else if (content.includes('refund')) keywordType = 'refund';
    else if (content.includes('item missing') || content.includes('inventory') || content.includes('missing item') || 
             content.includes('lost item') || content.includes('bug report') || content.includes('report bug')) {
        keywordType = 'missing_item';
    }
    
    // If no keyword matched, return
    if (!keywordType) return;
    
    const responseKey = `${userId}_${channelId}_${keywordType}`;
    
    // Check if user already received this type of response in this channel
    if (userKeywordResponses.has(responseKey)) {
        return; // Don't respond again
    }
    
    // Mark that this user has received this response
    userKeywordResponses.set(responseKey, Date.now());
    
    // Send appropriate response based on keyword type
    try {
        if (keywordType === 'paypal') {
            await message.reply('💳 **PayPal Payment Link:**\nhttps://paypal.me/DavidBarma');
        } else if (keywordType === 'upi') {
            await message.reply('💳 **UPI Payment ID:**\ndavidbarma9-4@okicici');
        } else if (keywordType === 'refund') {
            await message.reply({
                embeds: [{
                    title: '⚠️ No Refund Policy',
                    description: 'All payments made are considered an investment into the server.\nOnce a purchase is completed, refunds will not be provided under any circumstances.',
                    color: 0xff0000,
                    footer: { text: 'PCRP Support Policy' }
                }]
            });
        } else if (keywordType === 'missing_item') {
            await message.reply('📋 **Please provide all the necessary details or proof (POV) so we can review your issue properly.**\n\n' +
                               '**Include:**\n' +
                               '• Screenshots or video proof\n' +
                               '• Detailed description of the issue\n' +
                               '• Your username/ID\n' +
                               '• When it happened\n' +
                               '• Any error messages you received');
        }
    } catch (error) {
        console.error('Error sending keyword response:', error);
        // Remove the tracking if sending failed
        userKeywordResponses.delete(responseKey);
    }
}

// Message event for keyword detection
client.on(Events.MessageCreate, async (message) => {
    // Ignore bot messages
    if (message.author.bot) return;
    
    // Only check messages in ticket channels
    const ticket = await getTicket(message.channel.id).catch(() => null);
    if (!ticket) return;
    
    // Handle keyword responses
    await handleKeywordResponse(message);
});

// Interaction event
client.on(Events.InteractionCreate, async (interaction) => {
    try {
        // Handle slash commands
        if (interaction.isChatInputCommand()) {
            const command = client.commands.get(interaction.commandName);
            
            if (!command) {
                console.error(`No command matching ${interaction.commandName} was found.`);
                return;
            }
            
            await command.execute(interaction);
        }
        
        // Handle select menu interactions
        else if (interaction.isStringSelectMenu()) {
            if (interaction.customId === 'ticket_category') {
                await handleTicketCreation(interaction);
            } else if (interaction.customId === 'transfer_category') {
                await handleTicketTransfer(interaction);
            }
        }
        
        // Handle button interactions
        else if (interaction.isButton()) {
            if (interaction.customId === 'claim_ticket') {
                await handleTicketClaim(interaction);
            } else if (interaction.customId === 'close_ticket') {
                await handleTicketClose(interaction);
            } else if (interaction.customId.startsWith('feedback_')) {
                await handleFeedback(interaction);
            }
        }
        
        // Handle modal submissions
        else if (interaction.isModalSubmit()) {
            if (interaction.customId.startsWith('feedback_modal_')) {
                await handleFeedbackModal(interaction);
            }
        }
    } catch (error) {
        console.error('Interaction error:', error);
        
        const errorMessage = 'There was an error while executing this interaction!';
        
        if (interaction.replied || interaction.deferred) {
            await interaction.followUp({ content: errorMessage, ephemeral: true });
        } else {
            await interaction.reply({ content: errorMessage, ephemeral: true });
        }
    }
});

// Initialize database
initializeDatabase().then(() => {
    console.log('Database initialized successfully');
}).catch(error => {
    console.error('Failed to initialize database:', error);
    process.exit(1);
});

// Error handling
client.on('error', error => {
    console.error('Discord client error:', error);
});

process.on('unhandledRejection', error => {
    console.error('Unhandled promise rejection:', error);
});

process.on('uncaughtException', error => {
    console.error('Uncaught exception:', error);
    process.exit(1);
});

// Login to Discord
if (!DISCORD_TOKEN || DISCORD_TOKEN === "YOUR_DISCORD_BOT_TOKEN_HERE") {
    console.error('Please replace DISCORD_TOKEN with your actual Discord bot token in index.js');
    process.exit(1);
}

client.login(DISCORD_TOKEN).catch(error => {
    console.error('Failed to login to Discord:', error);
    process.exit(1);
});