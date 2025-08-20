const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('transferadmin')
        .setDescription('Notify a specific admin about this ticket')
        .addUserOption(option =>
            option.setName('admin')
                .setDescription('The admin to notify about this ticket')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('reason')
                .setDescription('Reason for the admin notification')
                .setRequired(false)
                .setMaxLength(500))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),
    
    async execute(interaction) {
        try {
            const admin = interaction.options.getUser('admin');
            const reason = interaction.options.getString('reason') || 'No reason provided';
            const channel = interaction.channel;
            
            // Check if this is a ticket channel
            if (!channel.name.startsWith('pcrp-')) {
                return await interaction.reply({
                    content: '❌ This command can only be used in ticket channels.',
                    flags: 64 // Ephemeral flag
                });
            }
            
            // Check if the mentioned user is actually an admin
            const member = await interaction.guild.members.fetch(admin.id).catch(() => null);
            if (!member) {
                return await interaction.reply({
                    content: '❌ Could not find that user in this server.',
                    flags: 64 // Ephemeral flag
                });
            }
            
            // Add admin to channel permissions if not already added
            await channel.permissionOverwrites.edit(admin, {
                ViewChannel: true,
                SendMessages: true,
                ReadMessageHistory: true
            });
            
            await interaction.reply({
                content: `✅ ${admin.toString()} has been notified about this ticket.`,
                flags: 64 // Ephemeral flag
            });
            
            // Send notification in the channel
            await channel.send(`🔔 **Admin Notification**\n\n${admin.toString()}, you have been requested to assist with this ticket by ${interaction.user.toString()}.\n\n**Reason:** ${reason}\n\n📍 This ticket requires your attention.`);
            
            // Try to send DM to the admin
            try {
                await admin.send(`🎫 **Ticket Notification**\n\nYou have been requested to assist with a ticket in **${interaction.guild.name}**.\n\n**Ticket:** ${channel.toString()}\n**Requested by:** ${interaction.user.tag}\n**Reason:** ${reason}\n\nPlease check the ticket channel for more details.`);
            } catch (dmError) {
                console.log(`Could not send DM to ${admin.tag}: ${dmError.message}`);
            }
            
        } catch (error) {
            console.error('Transferadmin command error:', error);
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({
                    content: '❌ Failed to notify admin.',
                    flags: 64 // Ephemeral flag
                });
            }
        }
    }
};