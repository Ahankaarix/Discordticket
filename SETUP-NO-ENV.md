# Setup Guide - Bot Token in Index.js

## 🔧 Configuration with Token in Code

Since the bot token is now hardcoded in index.js, you don't need to create a .env file. Follow these simplified steps:

### Step 1: Get Your Discord Bot Token
1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Create new application → Go to "Bot" section
3. Copy your bot token (keep it secret!)

### Step 2: Edit index.js
Open `index.js` and find line 9:
```javascript
const DISCORD_TOKEN = "YOUR_DISCORD_BOT_TOKEN_HERE";
```

Replace `YOUR_DISCORD_BOT_TOKEN_HERE` with your actual bot token:
```javascript
const DISCORD_TOKEN = "MTQwNzY1Njc1Njc3OTE1NTQ3Nw.GK7vPz.example_token_here";
```

### Step 3: Configure Discord IDs
Update the config section (lines 11-18) with your Discord server information:
```javascript
const config = {
    guildId: "your_discord_server_id",
    ticketChannelId: "ticket_panel_channel_id", 
    logsChannelId: "logs_channel_id",
    adminRoleId: "admin_role_id",
    feedbackChannelId: "feedback_channel_id",
    // Other settings remain the same
};
```

### Step 4: Install Dependencies
```bash
npm install discord.js sqlite3
```

### Step 5: Run Bot
```bash
node index.js
```

## ⚠️ Security Warning

**Important:** Since the token is in your code file:
- Never share your index.js file publicly
- Don't commit it to public repositories
- Be careful when sharing code snippets

## 🚀 Ubuntu Deployment (Token in Code)

For Ubuntu deployment, you no longer need the .env file setup:

```bash
# Clone/upload your project
cd ~/pcrp-ticket-bot

# Install dependencies
npm install

# No need to create .env file - token is in index.js

# Start with PM2
pm2 start index.js --name "pcrp-ticket-bot"
pm2 startup
pm2 save
```

The rest of the Ubuntu deployment process remains the same as described in UBUNTU-DEPLOYMENT.md.

---

**Remember:** Keep your bot token secure and never share the index.js file that contains it!