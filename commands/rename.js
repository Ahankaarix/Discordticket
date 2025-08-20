const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('rename')
        .setDescription('Rename the current ticket channel')
        .addStringOption(option =>
            option.setName('name')
                .setDescription('New name for the ticket channel')
                .setRequired(true)
                .setMaxLength(100))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),
    
    async execute(interaction) {
        try {
            const newName = interaction.options.getString('name');
            const channel = interaction.channel;
            
            // Check if this is a ticket channel
            if (!channel.name.startsWith('pcrp-')) {
                return await interaction.reply({
                    content: '❌ This command can only be used in ticket channels.',
                    ephemeral: true
                });
            }
            
            const oldName = channel.name;
            
            // Clean the name to make it Discord-compatible
            const cleanName = newName.toLowerCase()
                .replace(/[^a-z0-9-]/g, '-')
                .replace(/-+/g, '-')
                .replace(/^-|-$/g, '');
            
            if (!cleanName) {
                return await interaction.reply({
                    content: '❌ Please provide a valid name for the channel.',
                    ephemeral: true
                });
            }
            
            await channel.setName(cleanName);
            
            await interaction.reply({
                content: `✅ Ticket channel renamed from \`${oldName}\` to \`${cleanName}\`.`,
                ephemeral: true
            });
            
            // Send notification in the channel
            await channel.send(`📝 This ticket has been renamed to **${cleanName}** by ${interaction.user.toString()}.`);
            
        } catch (error) {
            console.error('Rename command error:', error);
            await interaction.reply({
                content: '❌ Failed to rename ticket channel.',
                ephemeral: true
            });
        }
    }
};