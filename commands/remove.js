const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('remove')
        .setDescription('Remove a user from the current ticket')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('The user to remove from the ticket')
                .setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),
    
    async execute(interaction) {
        try {
            const user = interaction.options.getUser('user');
            const channel = interaction.channel;
            
            // Check if this is a ticket channel
            if (!channel.name.startsWith('pcrp-')) {
                return await interaction.reply({
                    content: '❌ This command can only be used in ticket channels.',
                    ephemeral: true
                });
            }
            
            // Remove user from channel permissions
            await channel.permissionOverwrites.delete(user);
            
            await interaction.reply({
                content: `✅ ${user.toString()} has been removed from this ticket.`,
                ephemeral: true
            });
            
            // Send notification in the channel
            await channel.send(`📤 ${user.tag} has been removed from this ticket by ${interaction.user.toString()}.`);
            
        } catch (error) {
            console.error('Remove command error:', error);
            await interaction.reply({
                content: '❌ Failed to remove user from ticket.',
                ephemeral: true
            });
        }
    }
};