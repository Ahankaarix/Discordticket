const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('add')
        .setDescription('Add a user to the current ticket')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('The user to add to the ticket')
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
            
            // Add user to channel permissions
            await channel.permissionOverwrites.edit(user, {
                ViewChannel: true,
                SendMessages: true,
                ReadMessageHistory: true
            });
            
            await interaction.reply({
                content: `✅ ${user.toString()} has been added to this ticket.`,
                ephemeral: true
            });
            
            // Send notification in the channel
            await channel.send(`📨 ${user.toString()} has been added to this ticket by ${interaction.user.toString()}.`);
            
        } catch (error) {
            console.error('Add command error:', error);
            await interaction.reply({
                content: '❌ Failed to add user to ticket.',
                ephemeral: true
            });
        }
    }
};