# Ubuntu Deployment Guide - PCRP Ticket Bot

## 🚀 Complete Ubuntu Setup Commands

### Step 1: Server Setup (Fresh Ubuntu 20.04/22.04)

```bash
# Update system packages
sudo apt update && sudo apt upgrade -y

# Install essential tools
sudo apt install curl wget git unzip htop nano -y

# Create bot user (recommended for security)
sudo adduser pcrpbot
sudo usermod -aG sudo pcrpbot
su - pcrpbot
```

### Step 2: Install Node.js 18.x

```bash
# Add NodeSource repository
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -

# Install Node.js and npm
sudo apt-get install -y nodejs

# Verify installation
node --version
npm --version

# Should show v18.x.x and v9.x.x
```

### Step 3: Install PM2 Process Manager

```bash
# Install PM2 globally
sudo npm install -g pm2

# Verify PM2 installation
pm2 --version
```

### Step 4: Download and Setup Bot

```bash
# Create directory for the bot
mkdir ~/pcrp-ticket-bot
cd ~/pcrp-ticket-bot

# Download project files (replace with your method)
# Option A: If you have git repository
git clone <your-repository-url> .

# Option B: If uploading files manually
# Upload your files to this directory using SCP/SFTP

# Install dependencies
npm install

# Create environment file
nano .env
```

**Add to .env file:**
```env
DISCORD_TOKEN=your_discord_bot_token_here
NODE_ENV=production
```

**Save and exit nano:** `Ctrl+X`, then `Y`, then `Enter`

### Step 5: Configure Bot Settings

```bash
# Edit config file
nano config.json
```

**Update config.json with your Discord IDs:**
```json
{
    "guildId": "your_discord_server_id",
    "ticketChannelId": "ticket_panel_channel_id",
    "logsChannelId": "logs_channel_id",
    "adminRoleId": "admin_role_id",
    "feedbackChannelId": "feedback_channel_id",
    "maxTicketsPerUser": 1,
    "autoDeleteAfterClose": 5000
}
```

### Step 6: Test Bot Locally

```bash
# Test run the bot
node index.js

# If working, you should see:
# "Ready! Logged in as PCRP TICKET#5559"
# Press Ctrl+C to stop
```

### Step 7: Start Bot with PM2

```bash
# Start bot with PM2
pm2 start index.js --name "pcrp-ticket-bot"

# Check status
pm2 status

# View logs
pm2 logs pcrp-ticket-bot

# Save PM2 configuration
pm2 save

# Setup auto-start on server reboot
pm2 startup
# Copy and run the command PM2 shows you
```

### Step 8: Setup Firewall (Optional but Recommended)

```bash
# Enable UFW firewall
sudo ufw enable

# Allow SSH (important - don't lock yourself out!)
sudo ufw allow ssh

# Allow HTTP/HTTPS if needed later
sudo ufw allow 80
sudo ufw allow 443

# Check firewall status
sudo ufw status
```

### Step 9: Create Backup Script

```bash
# Create backup directory
mkdir ~/backups

# Create backup script
nano ~/backup-bot.sh
```

**Add to backup script:**
```bash
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/home/pcrpbot/backups"
BOT_DIR="/home/pcrpbot/pcrp-ticket-bot"

cd $BOT_DIR

# Backup database
cp tickets.db "$BACKUP_DIR/tickets_$DATE.db"

# Backup transcripts
tar -czf "$BACKUP_DIR/transcripts_$DATE.tar.gz" transcript-*.html 2>/dev/null || true

# Keep only last 7 days
find $BACKUP_DIR -type f -mtime +7 -delete

echo "Backup completed: $DATE"
```

```bash
# Make script executable
chmod +x ~/backup-bot.sh

# Test backup
~/backup-bot.sh

# Setup daily backup (2 AM)
crontab -e
# Add this line:
0 2 * * * /home/pcrpbot/backup-bot.sh
```

### Step 10: Setup Health Monitor

```bash
# Create health check script
nano ~/health-check.sh
```

**Add to health check script:**
```bash
#!/bin/bash
BOT_STATUS=$(pm2 jlist | grep -o '"status":"[^"]*"' | head -1 | cut -d'"' -f4)

if [ "$BOT_STATUS" != "online" ]; then
    echo "$(date): Bot is $BOT_STATUS, restarting..."
    pm2 restart pcrp-ticket-bot
    
    # Optional: Send notification (replace with your webhook/email)
    # curl -X POST "your-webhook-url" -d "Bot restarted at $(date)"
fi
```

```bash
# Make executable
chmod +x ~/health-check.sh

# Setup health check every 5 minutes
crontab -e
# Add this line:
*/5 * * * * /home/pcrpbot/health-check.sh
```

## 🔧 Management Commands

### Daily Operations

```bash
# Check bot status
pm2 status

# View live logs
pm2 logs pcrp-ticket-bot --lines 50

# Restart bot
pm2 restart pcrp-ticket-bot

# Stop bot
pm2 stop pcrp-ticket-bot

# Start bot
pm2 start pcrp-ticket-bot

# Monitor resources
pm2 monit
```

### Update Bot

```bash
# Go to bot directory
cd ~/pcrp-ticket-bot

# Stop bot
pm2 stop pcrp-ticket-bot

# Backup current version
cp -r . ../pcrp-ticket-bot-backup-$(date +%Y%m%d)

# Update files (git pull or upload new files)
git pull origin main
# OR upload new files

# Install new dependencies
npm install

# Restart bot
pm2 restart pcrp-ticket-bot

# Check logs for errors
pm2 logs pcrp-ticket-bot --lines 20
```

### System Monitoring

```bash
# Check disk space
df -h

# Check memory usage
free -h

# Check CPU usage
htop

# Check bot process
ps aux | grep node

# Check database size
ls -lh ~/pcrp-ticket-bot/tickets.db
```

## 🚨 Troubleshooting Commands

### Bot Not Starting

```bash
# Check logs for errors
pm2 logs pcrp-ticket-bot

# Check if files exist
ls -la ~/pcrp-ticket-bot/

# Check permissions
ls -la ~/.env

# Test manual start
cd ~/pcrp-ticket-bot
node index.js
```

### Database Issues

```bash
# Check database permissions
ls -la ~/pcrp-ticket-bot/tickets.db

# Fix permissions if needed
chmod 664 ~/pcrp-ticket-bot/tickets.db

# Check disk space
df -h

# Test database manually
sqlite3 ~/pcrp-ticket-bot/tickets.db "SELECT COUNT(*) FROM tickets;"
```

### Memory Issues

```bash
# Check memory usage
free -h

# Check bot memory specifically
pm2 show pcrp-ticket-bot

# Add swap if needed (1GB)
sudo fallocate -l 1G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile

# Make swap permanent
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

### Network Issues

```bash
# Test internet connection
ping discord.com

# Check DNS
nslookup discord.com

# Check if bot can reach Discord
curl -I https://discord.com/api/v10/gateway
```

## 📋 Quick Commands Reference

### Essential Daily Commands
```bash
pm2 status                          # Check bot status
pm2 logs pcrp-ticket-bot            # View logs
pm2 restart pcrp-ticket-bot         # Restart bot
~/backup-bot.sh                     # Manual backup
df -h                               # Check disk space
```

### Weekly Maintenance
```bash
sudo apt update && sudo apt upgrade -y    # Update system
pm2 update                                # Update PM2
npm update                                # Update dependencies
pm2 restart pcrp-ticket-bot              # Restart after updates
```

### Emergency Commands
```bash
pm2 kill                           # Stop all PM2 processes
pm2 resurrect                      # Restore PM2 processes
sudo reboot                        # Restart server (last resort)
```

## 🔐 Security Hardening

### Additional Security Steps

```bash
# Disable root login (optional)
sudo nano /etc/ssh/sshd_config
# Set: PermitRootLogin no
sudo systemctl restart ssh

# Setup automatic security updates
sudo apt install unattended-upgrades -y
sudo dpkg-reconfigure unattended-upgrades

# Install fail2ban for SSH protection
sudo apt install fail2ban -y
sudo systemctl enable fail2ban
sudo systemctl start fail2ban
```

### File Permissions

```bash
# Secure the .env file
chmod 600 ~/.env

# Secure the database
chmod 664 ~/pcrp-ticket-bot/tickets.db

# Secure backup directory
chmod 700 ~/backups
```

## 💰 Cost Estimation (Monthly)

### VPS Requirements
- **RAM**: 1GB minimum (2GB recommended)
- **CPU**: 1 core sufficient
- **Storage**: 10GB minimum
- **Bandwidth**: 1TB (more than enough)

### Provider Costs
- **DigitalOcean**: $6/month (1GB RAM)
- **Vultr**: $3.50/month (1GB RAM)
- **Linode**: $5/month (1GB RAM)
- **AWS EC2**: $8-12/month (t2.micro)
- **Hetzner**: €3.29/month (~$3.50)

## ✅ Deployment Checklist

- [ ] Ubuntu server ready
- [ ] Node.js 18.x installed
- [ ] PM2 installed
- [ ] Bot files uploaded
- [ ] .env file configured
- [ ] config.json updated
- [ ] Bot tested manually
- [ ] PM2 startup configured
- [ ] Backup script created
- [ ] Health monitor setup
- [ ] Firewall configured
- [ ] Discord commands working

Your bot should now be running 24/7 on Ubuntu with automatic restarts, backups, and monitoring!