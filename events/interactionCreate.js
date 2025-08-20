const { Events, ChannelType, PermissionFlagsBits } = require('discord.js');
const { createTicket, handleTicketClaim, handleTicketClose } = require('../utils/ticketManager');
const config = require('../config.json');

module.exports = {
    name: Events.InteractionCreate,
    async execute(interaction) {
        try {
            // Handle slash commands
            if (interaction.isChatInputCommand()) {
                const command = interaction.client.commands.get(interaction.commandName);
                
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
    }
};

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
