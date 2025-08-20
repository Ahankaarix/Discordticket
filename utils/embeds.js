const { EmbedBuilder } = require('discord.js');

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

function createClaimedEmbed(admin) {
    return new EmbedBuilder()
        .setTitle('✅ Ticket Claimed')
        .setDescription(`This ticket has been claimed by ${admin.toString()}`)
        .setColor(0xFFFF00)
        .setTimestamp();
}

function createClosedEmbed() {
    return new EmbedBuilder()
        .setTitle('🔒 Ticket Closed')
        .setDescription('This ticket has been closed and will be deleted shortly.')
        .setColor(0xFF0000)
        .setTimestamp();
}

module.exports = {
    createTicketPanelEmbed,
    createTicketEmbed,
    createTicketControlsEmbed,
    createClaimedEmbed,
    createClosedEmbed
};
