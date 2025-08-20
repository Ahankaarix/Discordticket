const { Client, GatewayIntentBits, Collection, SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ChannelType, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle, Events, AttachmentBuilder } = require('discord.js');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
require('dotenv').config();

// Configuration
const config = {
    guildId: "1407656756779155477",
    ticketChannelId: "1407656785564930068",
    logsChannelId: "1407656810453663754",
    adminRoleId: "1407657166114127962",
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
        
        const ticketId = `pcrp-${user.username}-${categoryShortName}`.toLowerCase().replace(/[^a-z0-9-]/g, '');
        
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
        const ticket = await getTicket(channel.id);
        if (!ticket) {
            return await interaction.reply({
                content: '❌ This is not a valid ticket channel.',
                ephemeral: true
            });
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
        await interaction.reply({
            content: '❌ An error occurred while claiming the ticket.',
            ephemeral: true
        });
    }
}

async function handleTicketClose(interaction) {
    try {
        const guild = interaction.guild;
        const member = interaction.member;
        const channel = interaction.channel;
        
        // Check if user has admin role or is the ticket creator
        const adminRole = guild.roles.cache.get(config.adminRoleId);
        const ticket = await getTicket(channel.id);
        
        if (!ticket) {
            return await interaction.reply({
                content: '❌ This is not a valid ticket channel.',
                ephemeral: true
            });
        }
        
        const isAdmin = adminRole && member.roles.cache.has(adminRole.id);
        const isTicketCreator = ticket.user_id === member.id;
        
        if (!isAdmin && !isTicketCreator) {
            return await interaction.reply({
                content: '❌ You do not have permission to close this ticket.',
                ephemeral: true
            });
        }
        
        await interaction.reply({
            content: '🔒 Closing ticket and saving transcript...'
        });
        
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
                
                await user.user.send({
                    content: `🎫 **Your Support Ticket Transcript**\n\n` +
                            `Hello ${user.user.username}! Your support ticket has been closed.\n\n` +
                            `**Ticket Details:**\n` +
                            `• **Ticket ID:** ${ticket.id}\n` +
                            `• **Category:** ${categoryInfo ? categoryInfo.label : 'Unknown'} ${categoryInfo ? categoryInfo.emoji : ''}\n` +
                            `• **Closed by:** ${member.user.tag}\n` +
                            `• **Date:** ${new Date().toLocaleDateString()}\n\n` +
                            `📎 **Attached:** Complete conversation transcript\n\n` +
                            `Thank you for using PCRP Support! If you need further assistance, feel free to create a new ticket.`,
                    files: [userAttachment]
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
        await interaction.followUp({
            content: '❌ An error occurred while closing the ticket.',
            ephemeral: true
        });
    }
}

async function reconnectToTickets(client, guild) {
    try {
        const openTickets = await getAllOpenTickets();
        let reconnectedCount = 0;
        
        for (const ticket of openTickets) {
            try {
                const channel = guild.channels.cache.get(ticket.channel_id);
                if (!channel) {
                    // Channel doesn't exist, mark ticket as closed
                    await closeTicket(ticket.channel_id);
                    console.log(`Closed orphaned ticket: ${ticket.id}`);
                    continue;
                }
                
                // Verify channel is still a valid ticket
                if (!channel.name.startsWith('ticket-')) {
                    await closeTicket(ticket.channel_id);
                    console.log(`Closed invalid ticket channel: ${ticket.id}`);
                    continue;
                }
                
                reconnectedCount++;
                console.log(`Reconnected to ticket: ${ticket.id} in channel ${channel.name}`);
            } catch (error) {
                console.error(`Error reconnecting to ticket ${ticket.id}:`, error);
                // Mark as closed if there's an error
                await closeTicket(ticket.channel_id);
            }
        }
        
        console.log(`Reconnected to ${reconnectedCount} open tickets`);
    } catch (error) {
        console.error('Error during ticket reconnection:', error);
    }
}

async function handleTicketCreation(interaction) {
    try {
        const category = interaction.values[0];
        const guild = interaction.guild;
        const user = interaction.user;
        
        // Check if user already has an open ticket
        const existingTickets = guild.channels.cache.filter(channel => 
            channel.name.startsWith('ticket-') && 
            channel.topic && 
            channel.topic.includes(user.id)
        );
        
        if (existingTickets.size > 0) {
            return await interaction.reply({
                content: '❌ You already have an open ticket! Please close your existing ticket before creating a new one.',
                ephemeral: true
            });
        }
        
        await interaction.deferReply({ ephemeral: true });
        
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
        await interaction.editReply({
            content: '❌ An error occurred while creating your ticket.'
        });
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

// Setup command
const setupCommand = {
    data: new SlashCommandBuilder()
        .setName('setup')
        .setDescription('Setup the ticket system in this channel')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    
    async execute(interaction) {
        try {
            await interaction.deferReply({ ephemeral: true });
            
            const success = await createTicketPanel(interaction.channel, interaction.guild);
            
            if (success) {
                await interaction.editReply({
                    content: '✅ Ticket system has been successfully set up in this channel!'
                });
            } else {
                await interaction.editReply({
                    content: '❌ Failed to set up ticket system. Please try again.'
                });
            }
        } catch (error) {
            console.error('Setup command error:', error);
            await interaction.editReply({
                content: '❌ An error occurred while setting up the ticket system.'
            });
        }
    }
};

// Add user to ticket command
const addCommand = {
    data: new SlashCommandBuilder()
        .setName('add')
        .setDescription('Add a user to this ticket')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('The user to add to this ticket')
                .setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    
    async execute(interaction) {
        try {
            const guild = interaction.guild;
            const member = interaction.member;
            const channel = interaction.channel;
            const userToAdd = interaction.options.getUser('user');
            
            // Check if user has admin role
            const adminRole = guild.roles.cache.get(config.adminRoleId);
            if (!adminRole || !member.roles.cache.has(adminRole.id)) {
                return await interaction.reply({
                    content: '❌ You do not have permission to add users to tickets.',
                    ephemeral: true
                });
            }
            
            // Check if this is a ticket channel
            const ticket = await getTicket(channel.id);
            if (!ticket) {
                return await interaction.reply({
                    content: '❌ This command can only be used in ticket channels.',
                    ephemeral: true
                });
            }
            
            // Add user to ticket channel with messaging permissions
            await channel.permissionOverwrites.edit(userToAdd.id, {
                ViewChannel: true,
                SendMessages: true,
                ReadMessageHistory: true
            });
            
            await interaction.reply({
                content: `✅ ${userToAdd.toString()} has been added to this ticket!`
            });
            
            console.log(`User ${userToAdd.tag} added to ticket ${ticket.id} by ${member.user.tag}`);
            
        } catch (error) {
            console.error('Add command error:', error);
            await interaction.reply({
                content: '❌ An error occurred while adding the user to this ticket.',
                ephemeral: true
            });
        }
    }
};

// Remove user from ticket command
const removeCommand = {
    data: new SlashCommandBuilder()
        .setName('remove')
        .setDescription('Remove a user from this ticket')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('The user to remove from this ticket')
                .setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    
    async execute(interaction) {
        try {
            const guild = interaction.guild;
            const member = interaction.member;
            const channel = interaction.channel;
            const userToRemove = interaction.options.getUser('user');
            
            // Check if user has admin role
            const adminRole = guild.roles.cache.get(config.adminRoleId);
            if (!adminRole || !member.roles.cache.has(adminRole.id)) {
                return await interaction.reply({
                    content: '❌ You do not have permission to remove users from tickets.',
                    ephemeral: true
                });
            }
            
            // Check if this is a ticket channel
            const ticket = await getTicket(channel.id);
            if (!ticket) {
                return await interaction.reply({
                    content: '❌ This command can only be used in ticket channels.',
                    ephemeral: true
                });
            }
            
            // Don't allow removing the ticket creator
            if (userToRemove.id === ticket.user_id) {
                return await interaction.reply({
                    content: '❌ You cannot remove the ticket creator from their own ticket.',
                    ephemeral: true
                });
            }
            
            // Remove user's permissions from ticket channel
            await channel.permissionOverwrites.delete(userToRemove.id);
            
            await interaction.reply({
                content: `✅ ${userToRemove.toString()} has been removed from this ticket!`
            });
            
            console.log(`User ${userToRemove.tag} removed from ticket ${ticket.id} by ${member.user.tag}`);
            
        } catch (error) {
            console.error('Remove command error:', error);
            await interaction.reply({
                content: '❌ An error occurred while removing the user from this ticket.',
                ephemeral: true
            });
        }
    }
};

// Rename ticket command
const renameCommand = {
    data: new SlashCommandBuilder()
        .setName('rename')
        .setDescription('Rename this ticket channel')
        .addStringOption(option =>
            option.setName('name')
                .setDescription('New name for the ticket')
                .setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    
    async execute(interaction) {
        try {
            const guild = interaction.guild;
            const member = interaction.member;
            const channel = interaction.channel;
            const newName = interaction.options.getString('name');
            
            // Check if user has admin role
            const adminRole = guild.roles.cache.get(config.adminRoleId);
            if (!adminRole || !member.roles.cache.has(adminRole.id)) {
                return await interaction.reply({
                    content: '❌ You do not have permission to rename tickets.',
                    ephemeral: true
                });
            }
            
            // Check if this is a ticket channel
            const ticket = await getTicket(channel.id);
            if (!ticket) {
                return await interaction.reply({
                    content: '❌ This command can only be used in ticket channels.',
                    ephemeral: true
                });
            }
            
            // Clean the name for Discord channel naming rules
            const cleanName = newName.toLowerCase().replace(/[^a-z0-9-]/g, '-').substring(0, 50);
            
            // Rename the channel
            await channel.setName(cleanName);
            
            await interaction.reply({
                content: `✅ Ticket renamed to: **${cleanName}**`
            });
            
            console.log(`Ticket ${ticket.id} renamed to ${cleanName} by ${member.user.tag}`);
            
        } catch (error) {
            console.error('Rename command error:', error);
            await interaction.reply({
                content: '❌ An error occurred while renaming the ticket.',
                ephemeral: true
            });
        }
    }
};

// Transfer ticket command
const transferCommand = {
    data: new SlashCommandBuilder()
        .setName('transfer')
        .setDescription('Transfer this ticket to a different category')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    
    async execute(interaction) {
        try {
            const guild = interaction.guild;
            const member = interaction.member;
            const channel = interaction.channel;
            
            // Check if user has admin role
            const adminRole = guild.roles.cache.get(config.adminRoleId);
            if (!adminRole || !member.roles.cache.has(adminRole.id)) {
                return await interaction.reply({
                    content: '❌ You do not have permission to transfer tickets.',
                    ephemeral: true
                });
            }
            
            // Check if this is a ticket channel
            const ticket = await getTicket(channel.id);
            if (!ticket) {
                return await interaction.reply({
                    content: '❌ This command can only be used in ticket channels.',
                    ephemeral: true
                });
            }
            
            // Create select menu with all categories except current one
            const options = Object.entries(TICKET_CATEGORIES)
                .filter(([value, category]) => value !== ticket.category)
                .map(([value, category]) => ({
                    label: category.label,
                    description: category.description,
                    value: value,
                    emoji: category.emoji
                }));
            
            if (options.length === 0) {
                return await interaction.reply({
                    content: '❌ No other categories available to transfer to.',
                    ephemeral: true
                });
            }
            
            const selectMenu = new StringSelectMenuBuilder()
                .setCustomId('transfer_category')
                .setPlaceholder('Select new category for this ticket...')
                .addOptions(options);
            
            const row = new ActionRowBuilder()
                .addComponents(selectMenu);
            
            const currentCategory = TICKET_CATEGORIES[ticket.category];
            
            await interaction.reply({
                content: `🔄 **Transfer Ticket**\n\nCurrent category: **${currentCategory ? currentCategory.label : 'Unknown'}**\nSelect a new category from the menu below:`,
                components: [row],
                ephemeral: true
            });
            
        } catch (error) {
            console.error('Transfer command error:', error);
            await interaction.reply({
                content: '❌ An error occurred while setting up the transfer.',
                ephemeral: true
            });
        }
    }
};

client.commands.set(setupCommand.data.name, setupCommand);
client.commands.set(addCommand.data.name, addCommand);
client.commands.set(removeCommand.data.name, removeCommand);
client.commands.set(renameCommand.data.name, renameCommand);
client.commands.set(transferCommand.data.name, transferCommand);

// Ready event
client.once(Events.ClientReady, async (client) => {
    console.log(`Ready! Logged in as ${client.user.tag}`);
    
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
        
        console.log('Bot initialization complete!');
        
    } catch (error) {
        console.error('Error during bot initialization:', error);
    }
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
const token = 'MTQwNzY1NzcwMTU0MjIwMzUwMw.GSjnC6.EhJi9azW78Zx3WsSR3YS4JLtSOT6QZlAfpeb2I';

client.login(token).catch(error => {
    console.error('Failed to login to Discord:', error);
    process.exit(1);
});