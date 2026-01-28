#!/bin/bash
# Find all places where provider object is assigned

echo "🔍 Searching for all provider object assignments..."
echo "================================================================"

cd /Users/davidbracho/auestralian_project/voice-agent

echo ""
echo "Pattern 1: provider: provider ? {"
grep -rn "provider:\s*provider\s*?" src/ --color=never | grep "{" || echo "None found"

echo ""
echo "Pattern 2: provider: { (direct assignment)"
grep -rn "provider:\s*{" src/ --color=never | grep -v "// " | head -20

echo ""
echo "Pattern 3: provider: result.provider"
grep -rn "provider:\s*\w*\.provider" src/ --color=never || echo "None found"

echo ""
echo "Pattern 4: provider: authResult"
grep -rn "provider:\s*auth" src/ --color=never || echo "None found"

echo ""
echo "================================================================"
echo "✅ Search complete"

