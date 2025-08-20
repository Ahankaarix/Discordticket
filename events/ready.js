const { Events } = require('discord.js');
const { createTicketPanel, reconnectToTickets } = require('../utils/ticketManager');
const config = require('../config.json');

module.exports = {
    name: Events.ClientReady,
    once: true,
    async execute(client) {
        console.log(`Ready! Logged in as ${client.user.tag}`);
        
        try {
            // Get the specified guild and channels from config
            const guild = client.guilds.cache.get(config.guildId);
            if (!guild) {
                console.error('Guild not found! Please check your guild ID in config.json');
                return;
            }
            
            const ticketChannel = guild.channels.cache.get(config.ticketChannelId);
            if (!ticketChannel) {
                console.error('Ticket channel not found! Please check your ticket channel ID in config.json');
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
    }
};
