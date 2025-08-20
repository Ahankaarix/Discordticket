# 🎟️ Discord Ticket Bot

A simple, powerful, and always-on **Discord ticket system** built with Node.js and Discord.js.

🔧 Features:
- ✅ One-click ticket creation with buttons
- ✅ Automatic thread/channel creation
- ✅ Data saved in SQLite
- ✅ Customizable panel title, status, and activity
- ✅ Runs 24/7 using PM2
- ✅ Auto-restart on crash or reboot

![Discord Bot Screenshot](image.png)

---

## 🚀 Quick Start (All-in-One Guide)

Follow these steps to deploy your bot on **Ubuntu 20.04/22.04**.

---

### 1. Update System & Install Dependencies

```bash
sudo apt update && sudo apt upgrade -y
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs git sqlite3 nano

git clone https://github.com/Ahankaarix/Discordticket.git
cd Discordticket

npm install

node --version  # Should show v18.x.x
npm --version   # Should show v9.x.x

nano .env

TOKEN=your_bot_token_here
CLIENT_ID=your_application_id
GUILD_ID=your_server_guild_id
PANEL_TITLE=Support Tickets
BOT_STATUS=online
BOT_ACTIVITY_TYPE=WATCHING
BOT_ACTIVITY_NAME=your tickets

📌 How to get:

TOKEN: Discord Developer Portal → Bot → Token
CLIENT_ID: Application ID from same page
GUILD_ID: Right-click your server → "Copy ID" (enable Developer Mode in Discord settings)
Save: Ctrl+O → Enter → Ctrl+X


6. Enable Discord Intents
Go to:
🔗 https://discord.com/developers/applications

Select your app → Bot → Scroll down to Privileged Gateway Intents → Enable:

✅ Server Members Intent
✅ Message Content Intent
Without these, the bot won’t respond to messages. 

7. Test the Bot Manually

node index.js
If you see:



1
2
Bot is online!
Ticket system is read

8. Run in Background with PM2
Install PM2 (process manager):
npm install -g pm2

pm2 start index.js --name "discord-ticket-bot"

┌─────────────────────┬────┬─────────┬──────┬───────────┬──────────┬──────────┐
│ App name            │ id │ version │ mode │ status    │ cpu      │ memory   │
│ discord-ticket-bot  │ 0  │ N/A     │ fork │ online    │ 0%       │ 50.2 MB  │
└─────────────────────┴────┴─────────┴──────┴───────────┴──────────┴──────────┘

pm2 logs discord-ticket-bot

pm2 startup

sudo env PATH=$PATH:/usr/bin /usr/lib/node_modules/pm2/bin/pm2 startup systemd -u discordbot --hp /home/discordbot

pm2 save

✅ Survive server reboots
✅ Auto-restart if it crashes
✅ Run silently in the background

10. Useful PM2 Commands

pm2 list
pm2 logs discord-ticket-bot
pm2 restart discord-ticket-bot
pm2 stop discord-ticket-bot
pm2 delete discord-ticket-bot
pm2 monit

cd ~/Discordticket
git pull
pm2 restart discord-ticket-bot