const { Client, GatewayIntentBits, Collection, SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ChannelType, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle, Events } = require('discord.js');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
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

// Embed functions
function createTicketPanelEmbed() {
    return new EmbedBuilder()
        .setTitle('Select Menus')
        .setDescription('**Support Tickets**\n\nSelect the option that best fits your problem. A support ticket will be created for you automatically.')
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
        .setTitle('🎛️ Ticket Controls')
        .setDescription(
            '**For Support Staff:**\n' +
            '🔷 Click **Claim Ticket** to assign yourself to this ticket\n' +
            '🔷 Click **Close Ticket** to close and archive this ticket\n\n' +
            '**For Ticket Creator:**\n' +
            '🔷 You can also close your own ticket using the **Close Ticket** button'
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
        
        // Generate unique ticket ID
        const ticketId = `ticket-${user.username}-${Date.now()}`.toLowerCase().replace(/[^a-z0-9-]/g, '');
        
        // Get admin role
        const adminRole = guild.roles.cache.get(config.adminRoleId);
        
        // Create ticket channel
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
                        PermissionFlagsBits.SendMessages,
                        PermissionFlagsBits.ReadMessageHistory,
                        PermissionFlagsBits.ManageMessages
                    ]
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
        const controlsEmbed = createTicketControlsEmbed();
        
        await ticketChannel.send({
            content: `${user.toString()}${adminRole ? ` ${adminRole.toString()}` : ''}`,
            embeds: [ticketEmbed, controlsEmbed],
            components: [controlRow]
        });
        
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
        const transcript = messages.reverse().map(msg => 
            `[${msg.createdAt.toISOString()}] ${msg.author.tag}: ${msg.content}`
        ).join('\n');
        
        // Save transcript
        await saveTranscript(ticket.id, transcript);
        
        // Close ticket in database
        await closeTicket(channel.id);
        
        // Send transcript to logs channel if configured
        const logsChannel = guild.channels.cache.get(config.logsChannelId);
        if (logsChannel) {
            const user = await guild.members.fetch(ticket.user_id).catch(() => null);
            const claimedBy = ticket.claimed_by ? await guild.members.fetch(ticket.claimed_by).catch(() => null) : null;
            
            await logsChannel.send({
                content: `**Ticket Closed**\n` +
                        `**Ticket ID:** ${ticket.id}\n` +
                        `**Created by:** ${user ? user.toString() : 'Unknown User'}\n` +
                        `**Claimed by:** ${claimedBy ? claimedBy.toString() : 'Unclaimed'}\n` +
                        `**Closed by:** ${member.toString()}\n` +
                        `**Category:** ${ticket.category}\n` +
                        `**Created:** ${ticket.created_at}\n` +
                        `**Closed:** ${new Date().toISOString()}`
            });
        }
        
        // Delete channel after a short delay
        setTimeout(async () => {
            try {
                await channel.delete();
                console.log(`Ticket channel ${channel.name} deleted`);
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

client.commands.set(setupCommand.data.name, setupCommand);

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
const token = process.env.DISCORD_TOKEN;
if (!token) {
    console.error('DISCORD_TOKEN not found in environment variables!');
    process.exit(1);
}

client.login(token).catch(error => {
    console.error('Failed to login to Discord:', error);
    process.exit(1);
});