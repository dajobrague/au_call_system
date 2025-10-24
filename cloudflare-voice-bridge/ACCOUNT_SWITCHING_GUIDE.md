# Switching Cloudflare Accounts/Workspaces

## Overview

When you have multiple Cloudflare accounts or workspaces under the same user login, you need to specify which account to deploy workers to. This guide shows you how to switch between accounts without logging out.

## The Key Concept

**Account ID** is what determines where your worker gets deployed. You stay logged in as the same user, but specify which workspace/account to use.

## Quick Steps

### 1. Find Your Project's Account ID

```
1. Go to https://dash.cloudflare.com
2. Click the account dropdown (top left corner)
3. Select the correct workspace/account for this project
4. Navigate to Workers & Pages
5. Look at the right sidebar - copy the "Account ID"
```

The Account ID looks like: `a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6`

### 2. Set the Account ID

**Method A: Edit wrangler.toml (Recommended)**

```bash
cd cloudflare-voice-bridge
nano wrangler.toml  # or use any editor
```

Uncomment and set:
```toml
account_id = "paste-your-account-id-here"
```

**Method B: Use Command Line Flag**

```bash
npx wrangler deploy --account-id=your-account-id
```

**Method C: Use Environment Variable**

```bash
export CLOUDFLARE_ACCOUNT_ID="your-account-id"
npx wrangler deploy
```

### 3. Verify Before Deploying

```bash
npx wrangler whoami
```

This shows:
- Your email (the user you're logged in as)
- Available accounts
- Current account ID (if set)

### 4. Deploy to the Correct Account

```bash
npx wrangler deploy
```

The worker will be created in the account specified by the account ID.

## Moving an Existing Worker

If you already deployed the worker to the wrong account and need to move it:

### Option 1: Delete and Redeploy

**In OLD account:**
```bash
# Set to old account ID
npx wrangler deploy --account-id=old-account-id

# Delete the worker
npx wrangler delete voice-proxy --account-id=old-account-id
```

**In NEW account:**
```bash
# Update wrangler.toml with new account ID
# Then deploy
npx wrangler deploy --account-id=new-account-id
```

### Option 2: Export/Import Configuration

Unfortunately, Cloudflare Workers don't have a native "move" feature. The best approach is:

1. Ensure your code is in git
2. Delete from old account
3. Deploy to new account
4. Reconfigure custom domain in new account

## Custom Domain After Account Switch

After moving to a new account, you need to reconfigure the custom domain:

```bash
# In NEW account
npx wrangler domains add sam.netmtion.io --account-id=new-account-id
```

Or in Cloudflare Dashboard:
1. Select the NEW workspace
2. Workers & Pages → voice-proxy → Settings → Triggers
3. Add Custom Domain: `sam.netmtion.io`

## Troubleshooting

### Issue: "Worker not found" after deployment

**Cause:** Deployed to wrong account

**Solution:**
1. Run `npx wrangler whoami` to see current account
2. Check if account ID in `wrangler.toml` matches your project's account
3. Redeploy with correct account ID

### Issue: Multiple workers with same name

**Cause:** Worker exists in multiple accounts

**Solution:**
```bash
# List workers in specific account
npx wrangler list --account-id=account-1

# Delete from wrong account
npx wrangler delete voice-proxy --account-id=wrong-account-id

# Deploy to correct account
npx wrangler deploy --account-id=correct-account-id
```

### Issue: Custom domain not working after switch

**Cause:** Domain still pointed to old account

**Solution:**
1. In NEW account: Add custom domain `sam.netmtion.io`
2. DNS should auto-update, or manually update CNAME target
3. Wait 1-5 minutes for SSL provisioning

## Account ID Quick Reference

```bash
# Find all your accounts
npx wrangler whoami

# Check current configuration
cat wrangler.toml | grep account_id

# Deploy to specific account
npx wrangler deploy --account-id=abc123

# List workers in account
npx wrangler list --account-id=abc123

# Delete worker from account
npx wrangler delete voice-proxy --account-id=abc123
```

## Best Practices

1. **Always set account_id in wrangler.toml** for consistency
2. **Verify with `whoami`** before deploying
3. **Use git** to track which account ID is in wrangler.toml
4. **Document** which workspace is for which project
5. **Test after switching** to ensure everything works

## Example Workflow

```bash
# Starting fresh with new project account
cd cloudflare-voice-bridge

# 1. Find project account ID in dashboard
# 2. Set it in wrangler.toml
echo 'account_id = "abc123def456"' >> wrangler.toml

# 3. Verify
npx wrangler whoami

# 4. Deploy
npx wrangler deploy

# 5. Add custom domain
npx wrangler domains add sam.netmtion.io

# 6. Test
curl https://sam.netmtion.io/health
```

## Important Notes

- **Same user, different workspaces:** No need to logout/login
- **Account ID is the key:** This determines deployment location
- **Custom domains:** Need to be reconfigured in new account
- **No automatic migration:** Workers must be deleted from old account and redeployed
- **Durable Objects:** Data stored in old account's DOs won't transfer automatically

## Need Help?

If you're unsure which account to use:
1. Check with your project manager/client
2. Look at where the domain `netmtion.io` is configured
3. Use the account where other project resources are located


