const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { createTicketPanel } = require('../utils/ticketManager');

module.exports = {
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
