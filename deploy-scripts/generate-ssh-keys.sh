#!/bin/bash

# SSH Key Generation Script for Gitea to Unraid Deployment
# Run this on your Gitea server or local machine

set -e

KEY_NAME="gitea-to-unraid-deploy"
KEY_DIR="$HOME/.ssh"
GITEA_USER=${1:-"git"}  # Default Gitea user is usually 'git'

echo "🔑 Generating SSH keys for Gitea to Unraid deployment"

# Function to log with timestamp
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1"
}

# Create .ssh directory if it doesn't exist
mkdir -p "$KEY_DIR"
chmod 700 "$KEY_DIR"

# Generate SSH key pair if it doesn't exist
if [ ! -f "$KEY_DIR/$KEY_NAME" ]; then
    log "🔐 Generating new SSH key pair..."
    ssh-keygen -t ed25519 -C "gitea-deploy-$(date +%Y%m%d)" -f "$KEY_DIR/$KEY_NAME" -N ""
    log "✅ SSH key pair generated"
else
    log "ℹ️  SSH key pair already exists"
fi

# Set proper permissions
chmod 600 "$KEY_DIR/$KEY_NAME"
chmod 644 "$KEY_DIR/$KEY_NAME.pub"

echo
echo "📋 SSH Key Setup Instructions"
echo "============================="
echo
echo "1. 🔑 PUBLIC KEY (Add this to your Unraid server):"
echo "   Copy the following public key to /root/.ssh/authorized_keys on your Unraid server:"
echo
cat "$KEY_DIR/$KEY_NAME.pub"
echo
echo "   Command to add on Unraid:"
echo "   echo '$(cat "$KEY_DIR/$KEY_NAME.pub")' >> /root/.ssh/authorized_keys"
echo

echo "2. 🔒 PRIVATE KEY (Add this as Gitea secret):"
echo "   Add the following private key as UNRAID_SSH_KEY secret in your Gitea repository:"
echo "   (Go to your repo -> Settings -> Secrets -> Actions)"
echo
echo "   Secret name: UNRAID_SSH_KEY"
echo "   Secret value:"
echo "   ------------------------"
cat "$KEY_DIR/$KEY_NAME"
echo "   ------------------------"
echo

echo "3. 🌐 Test the connection:"
echo "   ssh -i $KEY_DIR/$KEY_NAME root@YOUR_UNRAID_IP"
echo

echo "4. 🚀 Required Gitea Secrets:"
echo "   Go to your repository -> Settings -> Secrets -> Actions and add:"
echo
echo "   UNRAID_HOST: your.unraid.ip.address"
echo "   UNRAID_USERNAME: root"
echo "   UNRAID_SSH_KEY: [paste the private key content from above]"
echo

# Create a quick test script
cat > "$KEY_DIR/test-connection.sh" << EOF
#!/bin/bash
# Test connection to Unraid server
# Usage: ./test-connection.sh UNRAID_IP

UNRAID_IP=\${1:-""}

if [ -z "\$UNRAID_IP" ]; then
    echo "Usage: \$0 <UNRAID_IP>"
    echo "Example: \$0 192.168.1.100"
    exit 1
fi

echo "🧪 Testing SSH connection to \$UNRAID_IP..."

if ssh -i "$KEY_DIR/$KEY_NAME" -o ConnectTimeout=10 -o BatchMode=yes root@\$UNRAID_IP 'echo "✅ Connection successful!"'; then
    echo "✅ SSH connection test passed!"
    echo "🐳 Testing Docker access..."
    ssh -i "$KEY_DIR/$KEY_NAME" root@\$UNRAID_IP 'docker --version' && echo "✅ Docker access confirmed!"
else
    echo "❌ SSH connection test failed!"
    echo "Please check:"
    echo "1. Unraid IP address is correct"
    echo "2. SSH is enabled on Unraid"
    echo "3. Public key is added to /root/.ssh/authorized_keys on Unraid"
    echo "4. Network connectivity between servers"
    exit 1
fi
EOF

chmod +x "$KEY_DIR/test-connection.sh"

echo "📧 Files created:"
echo "   Private key: $KEY_DIR/$KEY_NAME"
echo "   Public key:  $KEY_DIR/$KEY_NAME.pub"
echo "   Test script: $KEY_DIR/test-connection.sh"
echo
echo "🔒 Security Notes:"
echo "   - Keep the private key secure and never share it"
echo "   - The private key should only be added to Gitea secrets"
echo "   - You can delete the local private key after adding it to Gitea secrets"
echo "   - Consider setting up SSH key rotation periodically"
echo
echo "✅ SSH key generation completed!"