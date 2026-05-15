#!/bin/bash
# Run this script on your remote Ubuntu/Debian server using sudo.

echo "================================================="
echo " Opening MongoDB port 27017 to all IPs (0.0.0.0) "
echo "================================================="

# 1. Update mongod.conf to bind to all IPs instead of just localhost
echo "[1/3] Updating /etc/mongod.conf to bind to 0.0.0.0..."
if [ -f /etc/mongod.conf ]; then
    sudo sed -i 's/bindIp: 127.0.0.1/bindIp: 0.0.0.0/g' /etc/mongod.conf
    echo "Updated bindIp in mongod.conf."
else
    echo "Warning: /etc/mongod.conf not found. You may need to update the config manually."
fi

# 2. Restart the MongoDB service to apply changes
echo "[2/3] Restarting MongoDB service..."
if systemctl list-units --all -t service --full --no-legend | grep -Fq "mongod.service"; then
    sudo systemctl restart mongod
    echo "Restarted mongod service."
elif systemctl list-units --all -t service --full --no-legend | grep -Fq "mongodb.service"; then
    sudo systemctl restart mongodb
    echo "Restarted mongodb service."
else
    echo "Warning: Could not find mongod.service or mongodb.service to restart."
    echo "If you are running MongoDB inside Docker, you need to restart the container manually (e.g., docker restart <container_name>)."
fi

# 3. Allow port 27017 through the local UFW firewall (if installed)
echo "[3/3] Opening port 27017 on local firewall (ufw)..."
if command -v ufw >/dev/null 2>&1; then
    sudo ufw allow 27017/tcp
    echo "Port 27017 opened in UFW."
else
    echo "UFW is not installed. Skipping local firewall step."
fi

echo "================================================="
echo " DONE! "
echo "================================================="
echo ""
echo "⚠️ IMPORTANT AWS/CLOUD NOTE ⚠️"
echo "If this server is hosted on AWS EC2 (as the IP suggests), running this script is NOT ENOUGH."
echo "You MUST also update the AWS Security Group from the AWS Console:"
echo "  1. Go to AWS Console -> EC2 -> Instances."
echo "  2. Select your instance and click on its 'Security' tab."
echo "  3. Click the Security Group link."
echo "  4. Click 'Edit inbound rules'."
echo "  5. Add a rule: Type = Custom TCP, Port = 27017, Source = 0.0.0.0/0 (or preferably just your local IP)."
echo "  6. Save rules."
