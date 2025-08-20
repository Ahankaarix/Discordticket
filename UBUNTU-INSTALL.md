
# Ubuntu Installation Guide for Discord Ticket Bot

## Prerequisites
- Ubuntu 20.04/22.04 server
- Root or sudo access
- Discord bot token ready

## Step 1: Update System and Install Dependencies

```bash
# Update system packages
sudo apt update && sudo apt upgrade -y

# Install Node.js 18.x (LTS)
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install Git and other essentials
sudo apt install git sqlite3 nano htop unzip -y

# Verify installations
node --version  # Should show v18.x.x
npm --version   # Should show v9.x.x
git --version
```

## Step 2: Create Bot User (Recommended for Security)

```bash
# Create dedicated user for the bot
sudo adduser discordbot
sudo usermod -aG sudo discordbot

# Switch to bot user
sudo su - discordbot
```

## Step 3: Clone Repository and Setup

```bash
# Navigate to home directory
cd ~

# Clone your GitHub repository
git clone https://github.com/Ahankaarix/Discordticket.git

# Navigate to project directory
cd Discordticket

# Install npm dependencies
npm install
```

## Step 4: Configure Discord Bot

```bash
# Configure your Discord IDs in config.json
nano config.json
```

Update the following values in `config.json`:
```json
{
    "guildId": "your_discord_server_id_here",
    "ticketChannelId": "your_ticket_channel_id_here",
    "logsChannelId": "your_logs_channel_id_here",
    "adminRoleId": "your_admin_role_id_here",
    "feedbackChannelId": "your_feedback_channel_id_here",
    "maxTicketsPerUser": 1,
    "autoDeleteAfterClose": 5000
}
```

## Step 5: Add Discord Bot Token

Since your bot uses embedded token configuration, edit the index.js file:

```bash
nano index.js
```

Find line 9 and replace `YOUR_DISCORD_BOT_TOKEN_HERE` with your actual Discord bot token:
```javascript
const DISCORD_TOKEN = "your_actual_discord_bot_token_here";
```

## Step 6: Install PM2 Process Manager

```bash
# Install PM2 globally
sudo npm install -g pm2

# Verify PM2 installation
pm2 --version
```

## Step 7: Test Bot Locally

```bash
# Test run to ensure everything works
node index.js

# You should see:
# "Loaded command: add"
# "Loaded command: remove"
# ... (other commands)
# "Ready! Logged in as YOUR_BOT_NAME#1234"

# Press Ctrl+C to stop the test
```

## Step 8: Start Bot with PM2

```bash
# Start bot with PM2
pm2 start index.js --name "discord-ticket-bot"

# Check status
pm2 status

# View logs
pm2 logs discord-ticket-bot

# Save PM2 configuration for auto-restart
pm2 save

# Setup auto-start on server reboot
pm2 startup
# Follow the command PM2 displays (copy and run it)
```

## Step 9: Setup Firewall Security

```bash
# Enable UFW firewall
sudo ufw enable

# Allow SSH (IMPORTANT - don't lock yourself out!)
sudo ufw allow ssh

# Check firewall status
sudo ufw status
```

## Step 10: Create Backup System

```bash
# Create backup directory
mkdir ~/backups

# Create backup script
nano ~/backup-bot.sh
```

Add this backup script content:
```bash
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/home/discordbot/backups"
BOT_DIR="/home/discordbot/Discordticket"

cd $BOT_DIR

# Backup database
cp tickets.db "$BACKUP_DIR/tickets_backup_$DATE.db" 2>/dev/null || echo "No database found"

# Backup transcripts
cp transcript-*.html "$BACKUP_DIR/" 2>/dev/null || echo "No transcripts found"

# Keep only last 7 days of backups
find $BACKUP_DIR -type f -mtime +7 -delete

echo "Backup completed: $DATE"
```

```bash
# Make script executable
chmod +x ~/backup-bot.sh

# Test backup
~/backup-bot.sh

# Setup daily automatic backup at 2 AM
crontab -e
# Add this line:
0 2 * * * /home/discordbot/backup-bot.sh
```

## Step 11: Create Health Monitor

```bash
# Create health monitoring script
nano ~/health-check.sh
```

Add this health check content:
```bash
#!/bin/bash
BOT_STATUS=$(pm2 jlist | grep -o '"status":"[^"]*"' | head -1 | cut -d'"' -f4)

if [ "$BOT_STATUS" != "online" ]; then
    echo "$(date): Bot is $BOT_STATUS, restarting..."
    pm2 restart discord-ticket-bot
    echo "$(date): Bot restarted" >> ~/bot-restart.log
fi
```

```bash
# Make executable
chmod +x ~/health-check.sh

# Setup health check every 5 minutes
crontab -e
# Add this line:
*/5 * * * * /home/discordbot/health-check.sh
```

## Management Commands

### Daily Operations
```bash
# Check bot status
pm2 status

# View live logs
pm2 logs discord-ticket-bot --lines 50

# Restart bot
pm2 restart discord-ticket-bot

# Stop bot
pm2 stop discord-ticket-bot

# Monitor system resources
pm2 monit
```

### Update Bot from GitHub
```bash
# Navigate to bot directory
cd ~/Discordticket

# Stop bot
pm2 stop discord-ticket-bot

# Pull latest changes
git pull origin main

# Install any new dependencies
npm install

# Restart bot
pm2 restart discord-ticket-bot

# Check logs for any issues
pm2 logs discord-ticket-bot --lines 20
```

### View System Status
```bash
# Check disk space
df -h

# Check memory usage
free -h

# Check bot process specifically
ps aux | grep node

# Check database size
ls -lh ~/Discordticket/tickets.db
```

## Troubleshooting

### Bot Not Starting
```bash
# Check detailed logs
pm2 logs discord-ticket-bot

# Check if Discord token is valid
grep "DISCORD_TOKEN" ~/Discordticket/index.js

# Test manual start
cd ~/Discordticket
node index.js
```

### Database Issues
```bash
# Check database permissions
ls -la ~/Discordticket/tickets.db

# Check if SQLite is working
sqlite3 ~/Discordticket/tickets.db "SELECT name FROM sqlite_master WHERE type='table';"
```

### Memory Issues
```bash
# Check memory usage
free -h

# Add 1GB swap if needed
sudo fallocate -l 1G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

## Discord Setup Checklist

Before running the bot, ensure:

- [ ] Discord bot created in Discord Developer Portal
- [ ] Bot token copied and added to index.js
- [ ] Bot invited to your Discord server with proper permissions:
  - Manage Channels
  - Manage Messages
  - Send Messages
  - Embed Links
  - Read Message History
  - Use Slash Commands
- [ ] Message Content Intent enabled in Discord Developer Portal
- [ ] Server Members Intent enabled in Discord Developer Portal
- [ ] All Discord IDs updated in config.json
- [ ] Bot has admin role in your Discord server

## Final Verification

After completing all steps:

1. Check bot status: `pm2 status`
2. View logs: `pm2 logs discord-ticket-bot`
3. Test in Discord: Use `/setup` command in your ticket channel
4. Create a test ticket to verify functionality

Your Discord ticket bot should now be running 24/7 on Ubuntu with automatic restarts, backups, and monitoring!

## Support

For issues:
1. Check PM2 logs: `pm2 logs discord-ticket-bot`
2. Verify Discord bot permissions
3. Check config.json values
4. Ensure internet connectivity: `ping discord.com`
