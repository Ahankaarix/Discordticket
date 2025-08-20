# Quick Setup Guide for PCRP Ticket Bot

## 🚀 Quick Start (5 Minutes)

### 1. Get Your Discord Bot Token
1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Click "New Application" → Enter name → Create
3. Go to "Bot" section → Click "Add Bot"
4. Copy the Token (keep it secret!)
5. Enable these intents:
   - Message Content Intent ✅
   - Server Members Intent ✅

### 2. Invite Bot to Server
1. Go to "OAuth2" → "URL Generator"
2. Select scopes: `bot` and `applications.commands`
3. Select permissions:
   - Manage Channels ✅
   - Manage Messages ✅
   - Send Messages ✅
   - Embed Links ✅
   - Read Message History ✅
   - Use Slash Commands ✅
4. Copy URL and open in browser to invite

### 3. Get Discord IDs
Enable Developer Mode in Discord (Settings → Advanced → Developer Mode)

Right-click and "Copy ID" for:
- Your server (Guild ID)
- Channel for ticket panel
- Admin role
- Feedback channel

### 4. Configure Bot
Create `.env` file:
```
DISCORD_TOKEN=your_bot_token_here
```

Edit `config.json`:
```json
{
    "guildId": "your_server_id",
    "ticketChannelId": "channel_for_panel",
    "logsChannelId": "logs_channel",
    "adminRoleId": "admin_role_id",
    "feedbackChannelId": "feedback_channel",
    "maxTicketsPerUser": 1,
    "autoDeleteAfterClose": 5000
}
```

### 5. Install & Run
```bash
npm install
node index.js
```

### 6. Initialize System
In Discord, type: `/setup` in your ticket channel

## ✅ You're Done!
Users can now create tickets by clicking the dropdown menu in your ticket channel.

---

## 🔧 Advanced Configuration

### Auto-Response Keywords
Edit lines 1578-1583 in `index.js` to customize:
- PayPal link
- UPI payment details
- Refund policy message

### Ticket Categories
Edit lines 648-656 in `index.js` to modify:
- Category names
- Category descriptions
- Category values

### Welcome Messages
Edit lines 1531-1538 in `index.js` for category-specific auto-replies.

---

## 🚨 Common Issues

**Commands not showing?**
- Check bot permissions
- Verify guild ID in config
- Restart bot

**Database errors?**
- Check file permissions
- Ensure disk space available

**Auto-responses not working?**
- Enable Message Content Intent
- Check if user already received response

---

Need help? Check the main README.md for detailed troubleshooting.