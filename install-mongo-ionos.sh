#!/bin/bash
# ==============================================================================
# MongoDB Automated Deployment Script for IONOS Ubuntu VPS
# Server IP: 82.223.222.181
# ==============================================================================

echo "[1/8] Installing prerequisites..."
sudo apt-get update
sudo apt-get install -y gnupg curl lsb-release

echo "[2/8] Importing MongoDB GPG Key..."
curl -fsSL https://www.mongodb.org/static/pgp/server-7.0.asc | \
   sudo gpg --yes -o /usr/share/keyrings/mongodb-server-7.0.gpg --dearmor

echo "[3/8] Adding MongoDB repository..."
OS_CODENAME=$(lsb_release -cs)
# MongoDB 7.0 doesn't have an official Ubuntu 24.04 (noble) repo yet, but the 22.04 (jammy) one works perfectly.
if [ "$OS_CODENAME" = "noble" ]; then
    OS_CODENAME="jammy"
fi
echo "deb [ arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg ] https://repo.mongodb.org/apt/ubuntu ${OS_CODENAME}/mongodb-org/7.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-7.0.list

echo "[4/8] Installing MongoDB..."
sudo apt-get update
sudo apt-get install -y mongodb-org

echo "[5/8] Starting MongoDB service..."
sudo systemctl start mongod
sudo systemctl enable mongod

# Wait a few seconds for the daemon to fully initialize
sleep 5

echo "[6/8] Creating Admin User and Database..."
ADMIN_USER="lucy_admin"
ADMIN_PASS="LucySecretPass123!"

# Connect locally without auth first to create the admin user
mongosh admin --eval "
  db.createUser({
    user: '${ADMIN_USER}',
    pwd: '${ADMIN_PASS}',
    roles: [ { role: 'userAdminAnyDatabase', db: 'admin' }, 'readWriteAnyDatabase' ]
  })
"

echo "[7/8] Configuring external access and authentication..."
# 1. Bind to all IPs (0.0.0.0)
sudo sed -i 's/bindIp: 127.0.0.1/bindIp: 0.0.0.0/g' /etc/mongod.conf

# 2. Enable authentication in the config if it isn't already there
if ! grep -q "security:" /etc/mongod.conf; then
sudo bash -c 'cat <<EOF >> /etc/mongod.conf

security:
  authorization: "enabled"
EOF'
fi

# Restart to apply bindIp and auth changes
sudo systemctl restart mongod

echo "[8/8] Configuring UFW Firewall..."
# Always allow SSH so you don't lock yourself out of the IONOS VPS!
sudo ufw allow 22/tcp 
sudo ufw allow 27017/tcp
# Enable UFW non-interactively
sudo ufw --force enable 

echo "======================================================================="
echo " ✅ MONGODB DEPLOYMENT COMPLETE!"
echo "======================================================================="
echo "Please update your local .env file in the Lucy project with the following:"
echo ""
echo "MONGODB_URI=mongodb://${ADMIN_USER}:${ADMIN_PASS}@82.223.222.181:27017/middlefinger_db?authSource=admin"
echo ""
echo "Note: Keep these credentials safe. The database is now secured and accessible!"
echo "======================================================================="
