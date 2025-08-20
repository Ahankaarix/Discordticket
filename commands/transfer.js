const { SlashCommandBuilder, PermissionFlagsBits, StringSelectMenuBuilder, ActionRowBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('transfer')
        .setDescription('Transfer ticket to a different category')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),
    
    async execute(interaction) {
        try {
            const channel = interaction.channel;
            
            // Check if this is a ticket channel
            if (!channel.name.startsWith('pcrp-')) {
                return await interaction.reply({
                    content: '❌ This command can only be used in ticket channels.',
                    ephemeral: true
                });
            }
            
            // Create category selection menu
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
            
            const options = Object.entries(TICKET_CATEGORIES).map(([value, info]) => ({
                label: info.label,
                description: info.description,
                value: value,
                emoji: info.emoji
            }));
            
            const selectMenu = new StringSelectMenuBuilder()
                .setCustomId('transfer_category')
                .setPlaceholder('Choose new category for this ticket')
                .addOptions(options);
            
            const row = new ActionRowBuilder()
                .addComponents(selectMenu);
            
            await interaction.reply({
                content: '🔄 **Transfer Ticket**\n\nSelect the new category for this ticket:',
                components: [row],
                ephemeral: true
            });
            
        } catch (error) {
            console.error('Transfer command error:', error);
            await interaction.reply({
                content: '❌ Failed to create transfer menu.',
                ephemeral: true
            });
        }
    }
};