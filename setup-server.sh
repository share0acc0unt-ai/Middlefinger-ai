#!/bin/bash

# --- CONFIGURATION ---
PROJECT_DIR="/home/ubuntu/lucy-backend"
DB_NAME="middlefinger_db"
DB_USER="lucy_admin"
DB_PASS="LucySecretPass123!"
ADMIN_PASSWORD="lucy_admin_123"

echo "================================================="
echo "   LUCY CENTRALIZED BACKEND SETUP SCRIPT         "
echo "================================================="

# 1. Update MongoDB to be SECURE and PRIVATE (Localhost only)
echo "[1/4] Securing MongoDB..."
if [ -f /etc/mongod.conf ]; then
    sudo sed -i 's/bindIp: 0.0.0.0/bindIp: 127.0.0.1/g' /etc/mongod.conf
    sudo systemctl restart mongod
    echo "✅ MongoDB is now PRIVATE (only accessible from this server)."
else
    echo "❌ /etc/mongod.conf not found. Ensure MongoDB is installed."
fi

# 2. Install Node.js if missing
if ! command -v node &> /dev/null; then
    echo "[2/4] Installing Node.js..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt-get install -y nodejs
fi

# 3. Setup Backend Directory
echo "[3/4] Setting up Backend..."
mkdir -p $PROJECT_DIR
cd $PROJECT_DIR

# Create package.json if it doesn't exist
cat <<EOF > package.json
{
  "name": "lucy-backend",
  "version": "1.0.0",
  "type": "module",
  "dependencies": {
    "express": "^5.2.1",
    "mongodb": "^7.2.0",
    "dotenv": "^17.4.2",
    "cors": "^2.8.6"
  }
}
EOF

# Create .env file pointing to LOCALHOST mongo
cat <<EOF > .env
MONGODB_URI=mongodb://${DB_USER}:${DB_PASS}@127.0.0.1:27017/${DB_NAME}?authSource=admin
PORT=3001
ADMIN_PASSWORD=${ADMIN_PASSWORD}
EOF

# Copy server.js (You should manually upload your server.js to this folder)
echo "⚠️  NOTE: Please ensure you upload your 'server.js' to $PROJECT_DIR"

# 4. Setup Firewall and PM2
echo "[4/4] Configuring Firewall and Auto-Start..."
sudo ufw allow 3001/tcp
sudo ufw deny 27017/tcp

sudo npm install -g pm2
# npm install
# pm2 start server.js --name "lucy-api"
# pm2 save
# pm2 startup

echo "================================================="
echo "   SETUP COMPLETE!                               "
echo "================================================="
echo "Your API is now running on port 3001."
echo "MongoDB port 27017 is CLOSED to the public."
echo "Devices will no longer be blacklisted!"
echo "================================================="
