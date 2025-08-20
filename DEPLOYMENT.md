# Deployment Guide - PCRP Ticket Bot

## 🌐 Hosting Options Comparison

| Platform | Cost | Difficulty | Uptime | Best For |
|----------|------|------------|--------|----------|
| AWS EC2 | $3-10/month | Medium | 99.9% | Production |
| DigitalOcean | $5/month | Easy | 99.9% | Small-Medium |
| VPS | $2-15/month | Medium | 99%+ | Budget |
| Replit | Free/Pro | Easy | 95% | Development |
| Local PC | Free | Easy | Variable | Testing |

## ☁️ AWS EC2 Deployment (Recommended)

### Instance Setup
```bash
# Launch EC2 Instance
Instance Type: t2.micro (1GB RAM)
OS: Ubuntu 20.04 LTS
Security Group: Allow SSH (22)
Storage: 8GB (sufficient)
```

### Complete Setup Script
```bash
#!/bin/bash
# Save as setup.sh and run: bash setup.sh

# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 18
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs git

# Install PM2
sudo npm install -g pm2

# Clone project (replace with your repo)
git clone <your-repo-url>
cd pcrp-ticket-bot

# Install dependencies
npm install

# Setup environment
echo "DISCORD_TOKEN=your_token_here" > .env

# Start with PM2
pm2 start index.js --name "ticket-bot"
pm2 startup
pm2 save

echo "✅ Bot deployed successfully!"
echo "Check status: pm2 status"
echo "View logs: pm2 logs"
```

### Cost Estimate
- **EC2 t2.micro**: ~$8.50/month
- **Data transfer**: ~$1/month
- **Total**: ~$10/month

## 🌊 DigitalOcean Droplet

### Quick Deploy
```bash
# Create $5 droplet (1GB RAM, Ubuntu 20.04)
# SSH into droplet

# One-command setup
curl -sSL https://raw.githubusercontent.com/your-repo/setup.sh | bash
```

### DigitalOcean Advantages
- Simple pricing ($5/month)
- Great documentation
- Easy snapshots/backups
- Good for beginners

## 💻 VPS Hosting Options

### Budget VPS Providers
1. **Vultr**: $3.50/month
2. **Linode**: $5/month
3. **Hetzner**: €3/month (~$3.20)
4. **Contabo**: €4/month (~$4.30)

### Setup Process (Same for all VPS)
1. Create VPS with Ubuntu
2. Connect via SSH
3. Run setup script (see AWS section)
4. Configure domain (optional)

## 🖥️ Windows Server Deployment

### Windows Server Setup
```powershell
# Install Chocolatey
Set-ExecutionPolicy Bypass -Scope Process -Force
[System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072
iex ((New-Object System.Net.WebClient).DownloadString('https://chocolatey.org/install.ps1'))

# Install Node.js and Git
choco install nodejs git -y

# Clone and setup
git clone <your-repo>
cd pcrp-ticket-bot
npm install

# Install as Windows Service
npm install -g node-windows

# Create service installer
@"
const Service = require('node-windows').Service;
const svc = new Service({
  name: 'PCRP Ticket Bot',
  description: 'Discord ticket management bot',
  script: require('path').join(__dirname, 'index.js')
});
svc.install();
"@ | Out-File -FilePath service.js

node service.js
```

## 🏠 Local Development Setup

### Windows Local
```cmd
# Download Node.js from nodejs.org
# Install Git from git-scm.com

git clone <repo>
cd pcrp-ticket-bot
npm install
echo DISCORD_TOKEN=your_token > .env
node index.js
```

### macOS Local
```bash
# Install Homebrew
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Install Node.js and Git
brew install node git

# Setup project
git clone <repo>
cd pcrp-ticket-bot
npm install
echo "DISCORD_TOKEN=your_token" > .env
node index.js
```

### Linux Local
```bash
# Ubuntu/Debian
sudo apt update
sudo apt install nodejs npm git -y

# CentOS/RHEL
sudo yum install nodejs npm git -y

# Setup project
git clone <repo>
cd pcrp-ticket-bot
npm install
echo "DISCORD_TOKEN=your_token" > .env
node index.js
```

## 🔒 Security Best Practices

### Environment Security
```bash
# Set secure file permissions
chmod 600 .env
chmod 600 tickets.db

# Create non-root user
sudo adduser botuser
sudo su - botuser

# Run bot as non-root
pm2 start index.js --name "ticket-bot" --user botuser
```

### Firewall Configuration
```bash
# Ubuntu UFW
sudo ufw enable
sudo ufw allow ssh
sudo ufw allow 80  # if using web interface
sudo ufw allow 443 # if using HTTPS

# CentOS/RHEL Firewalld
sudo firewall-cmd --permanent --add-service=ssh
sudo firewall-cmd --reload
```

### Automatic Updates
```bash
# Create update script
cat > update-bot.sh << 'EOF'
#!/bin/bash
cd /path/to/pcrp-ticket-bot
git pull origin main
npm install
pm2 restart ticket-bot
pm2 save
EOF

chmod +x update-bot.sh

# Schedule weekly updates
echo "0 2 * * 0 /path/to/update-bot.sh" | crontab -
```

## 📊 Monitoring & Maintenance

### Health Monitoring Script
```bash
#!/bin/bash
# health-check.sh

BOT_STATUS=$(pm2 jlist | jq -r '.[] | select(.name=="ticket-bot") | .pm2_env.status')

if [ "$BOT_STATUS" != "online" ]; then
    echo "Bot is down! Restarting..."
    pm2 restart ticket-bot
    
    # Send alert (optional)
    curl -X POST "https://api.telegram.org/bot<your-bot-token>/sendMessage" \
         -d "chat_id=<your-chat-id>" \
         -d "text=🚨 PCRP Ticket Bot was restarted due to downtime"
fi
```

### Backup Script
```bash
#!/bin/bash
# backup.sh

BACKUP_DIR="/backups/pcrp-bot"
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p $BACKUP_DIR

# Backup database
cp tickets.db "$BACKUP_DIR/tickets_$DATE.db"

# Backup transcripts
tar -czf "$BACKUP_DIR/transcripts_$DATE.tar.gz" transcript-*.html

# Keep only last 7 days of backups
find $BACKUP_DIR -type f -mtime +7 -delete

echo "Backup completed: $DATE"
```

### Performance Monitoring
```bash
# Add to crontab for daily reports
echo "0 9 * * * /path/to/performance-report.sh" | crontab -

# performance-report.sh
#!/bin/bash
echo "=== PCRP Bot Performance Report ===" 
echo "Date: $(date)"
echo "Uptime: $(pm2 show ticket-bot | grep uptime)"
echo "Memory: $(pm2 show ticket-bot | grep memory)"
echo "CPU: $(pm2 show ticket-bot | grep cpu)"
echo "Database size: $(ls -lh tickets.db | awk '{print $5}')"
echo "Active tickets: $(sqlite3 tickets.db "SELECT COUNT(*) FROM tickets WHERE status='open';")"
```

## 🚨 Troubleshooting Deployment Issues

### Common Problems

1. **Permission Denied Errors**
   ```bash
   sudo chown -R $USER:$USER /path/to/project
   chmod +x index.js
   ```

2. **Port Already in Use**
   ```bash
   # Kill process using port
   sudo kill -9 $(lsof -t -i:3000)
   ```

3. **Out of Memory**
   ```bash
   # Add swap space
   sudo fallocate -l 1G /swapfile
   sudo chmod 600 /swapfile
   sudo mkswap /swapfile
   sudo swapon /swapfile
   ```

4. **Database Locked**
   ```bash
   # Check for zombie processes
   ps aux | grep node
   sudo kill -9 <process-id>
   ```

### Emergency Recovery
```bash
# Complete reset procedure
pm2 stop all
pm2 delete all
cd /path/to/pcrp-ticket-bot
git reset --hard HEAD
git pull origin main
npm install
pm2 start index.js --name "ticket-bot"
pm2 save
```

## 📈 Scaling Considerations

### When to Scale Up
- Memory usage > 80%
- CPU usage > 70%
- Response time > 2 seconds
- Multiple server deployments needed

### Vertical Scaling (Upgrade Instance)
```bash
# AWS: Change instance type
# t2.micro → t2.small → t2.medium

# Monitor before/after
pm2 monit
```

### Horizontal Scaling (Multiple Instances)
- Use database clustering
- Implement Redis for shared state
- Load balancer for multiple bots
- Shared file storage for transcripts

---

**Need help?** Check the main README.md or create an issue in the repository.