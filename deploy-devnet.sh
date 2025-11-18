#!/bin/bash

# Devnet Deployment Script
# This script helps you deploy to Devnet and update the frontend

set -e

echo "🚀 Task Manager - Devnet Deployment"
echo "===================================="
echo ""

# Check Solana config
echo "📋 Step 1: Checking Solana configuration..."
CURRENT_RPC=$(solana config get | grep "RPC URL" | awk '{print $3}')
if [[ "$CURRENT_RPC" == *"devnet"* ]]; then
    echo "✅ Already configured for Devnet: $CURRENT_RPC"
else
    echo "⚠️  Not on Devnet. Setting to Devnet..."
    solana config set --url devnet
    echo "✅ Configured for Devnet"
fi

# Check balance
echo ""                                         
echo "📋 Step 2: Checking Devnet SOL balance..."
BALANCE=$(solana balance --url devnet 2>/dev/null | grep -o '[0-9.]*' | head -1 || echo "0")
echo "Current balance: $BALANCE SOL"

if (( $(echo "$BALANCE < 2" | bc -l 2>/dev/null || echo "1") )); then
    echo "💰 Getting more Devnet SOL..."
    solana airdrop 2 --url devnet || {
        echo "⚠️  Airdrop failed. You may need to use a faucet:"
        echo "   https://faucet.solana.com/"
        echo ""
        read -p "Press Enter to continue anyway, or Ctrl+C to get SOL first..."
    }
    BALANCE=$(solana balance --url devnet 2>/dev/null | grep -o '[0-9.]*' | head -1 || echo "0")
    echo "New balance: $BALANCE SOL"
fi

# Build
echo ""
echo "📋 Step 3: Building program..."
cd anchor_project
anchor build
echo "✅ Build complete"

# Deploy
echo ""
echo "📋 Step 4: Deploying to Devnet..."
echo "This may take a minute..."
anchor deploy

# Get the deployed program ID
echo ""
echo "📋 Step 5: Getting deployed program ID..."
PROGRAM_ID=$(solana address -k target/deploy/task_manager-keypair.json)
echo "✅ Program ID: $PROGRAM_ID"

# Update Anchor.toml
echo ""
echo "📋 Step 6: Updating Anchor.toml..."
sed -i "s/task_manager = \".*\"/task_manager = \"$PROGRAM_ID\"/" Anchor.toml
echo "✅ Anchor.toml updated"

# Update frontend TaskManager.tsx
echo ""
echo "📋 Step 7: Updating frontend program ID..."
cd ../frontend/src/components
sed -i "s/new PublicKey('.*')/new PublicKey('$PROGRAM_ID')/" TaskManager.tsx
echo "✅ Frontend program ID updated"

# Copy IDL
echo ""
echo "📋 Step 8: Copying IDL to frontend..."
cd ../../..  # Go back to project root
cp anchor_project/target/idl/task_manager.json frontend/public/
echo "✅ IDL copied"

echo ""
echo "===================================="
echo "✅ Deployment Complete!"
echo ""
echo "Program ID: $PROGRAM_ID"
echo ""
echo "Next steps:"
echo "1. Run the frontend:"
echo "   cd frontend && npm run dev"
echo ""
echo "2. Open http://localhost:5173 in your browser"
echo ""
echo "3. Make sure your wallet is on Devnet network"
echo "4. Connect wallet and test!"
echo ""

