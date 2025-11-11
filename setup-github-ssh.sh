#!/bin/bash

# GitHub SSH Setup Helper
# This script helps you set up SSH authentication for GitHub

echo "╔═══════════════════════════════════════════════════════════╗"
echo "║          🔑 GitHub SSH Setup                             ║"
echo "╚═══════════════════════════════════════════════════════════╝"
echo ""

# Check if SSH key exists
if [ -f ~/.ssh/id_ed25519.pub ] || [ -f ~/.ssh/id_rsa.pub ]; then
    echo "✅ SSH key already exists!"
    echo ""
    echo "Your public key:"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    if [ -f ~/.ssh/id_ed25519.pub ]; then
        cat ~/.ssh/id_ed25519.pub
    else
        cat ~/.ssh/id_rsa.pub
    fi
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
else
    echo "📝 Creating new SSH key..."
    echo ""
    read -p "Enter your GitHub email: " EMAIL
    
    ssh-keygen -t ed25519 -C "$EMAIL" -f ~/.ssh/id_ed25519 -N ""
    
    echo ""
    echo "✅ SSH key created!"
    echo ""
    echo "Your public key:"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    cat ~/.ssh/id_ed25519.pub
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
fi

echo ""
echo "📋 Next Steps:"
echo ""
echo "1. Copy the SSH key above (select and copy)"
echo ""
echo "2. Go to: https://github.com/settings/keys"
echo ""
echo "3. Click 'New SSH key'"
echo ""
echo "4. Title: 'My Linux Machine' (or any name)"
echo ""
echo "5. Paste the key in 'Key' field"
echo ""
echo "6. Click 'Add SSH key'"
echo ""
read -p "Press Enter after adding the key to GitHub..."

echo ""
echo "🧪 Testing SSH connection..."
ssh -T git@github.com 2>&1 | grep -q "successfully authenticated" && echo "✅ SSH works!" || echo "⚠️  Check if you added the key correctly"

echo ""
echo "🔄 Switching remote URL to SSH..."
cd /home/xuananh/drng-poc
git remote set-url origin git@github.com:MonUITVN23/HyDrand_workflow.git

echo ""
echo "✅ Remote URL updated to SSH!"
echo ""
echo "Now you can push without password:"
echo "  git push -u origin main"
echo ""
