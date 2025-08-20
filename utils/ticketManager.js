const { ChannelType, PermissionFlagsBits, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { createTicket: dbCreateTicket, getTicket, claimTicket, closeTicket, saveTicketPanel, getAllOpenTickets, saveTranscript } = require('../database/database');
const { createTicketEmbed, createTicketControlsEmbed, createTicketPanelEmbed } = require('./embeds');
const config = require('../config.json');

// Ticket categories mapping
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
        await dbCreateTicket(ticketId, ticketChannel.id, user.id, category);
        
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

module.exports = {
    createTicketPanel,
    createTicket,
    handleTicketClaim,
    handleTicketClose,
    reconnectToTickets,
    TICKET_CATEGORIES
};
