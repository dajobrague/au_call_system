# Move Worker to New Cloudflare Account - Quick Guide

## Situation

You need to move the `voice-proxy` worker from one Cloudflare account/workspace to another (both under the same user).

## Quick Steps

### 1. Get New Account ID

```bash
# 1. Go to https://dash.cloudflare.com
# 2. Select NEW workspace from dropdown (top left)
# 3. Go to Workers & Pages
# 4. Copy "Account ID" from right sidebar
```

### 2. Update wrangler.toml

```bash
cd cloudflare-voice-bridge
nano wrangler.toml  # or your preferred editor
```

Uncomment and set the account_id:
```toml
account_id = "your-new-account-id-here"
```

Save the file.

### 3. (Optional) Delete from Old Account

If the worker is already deployed to the old account:

```bash
# Delete from old account
npx wrangler delete voice-proxy --account-id=old-account-id
```

**Or via Dashboard:**
1. Go to old workspace in Cloudflare Dashboard
2. Workers & Pages → voice-proxy
3. Settings → Delete

### 4. Deploy to New Account

```bash
cd cloudflare-voice-bridge

# Deploy to new account
npx wrangler deploy

# Verify it worked
npx wrangler whoami
```

### 5. Configure Custom Domain in New Account

**Via Dashboard:**
1. Select NEW workspace in Cloudflare
2. Workers & Pages → voice-proxy
3. Settings → Triggers → Add Custom Domain
4. Enter: `sam.netmtion.io`
5. Wait 1-5 minutes for SSL

**Via CLI:**
```bash
npx wrangler domains add sam.netmtion.io
```

### 6. Verify Everything Works

```bash
# Test health check
curl https://sam.netmtion.io/health
# Expected: OK

# Monitor logs
npx wrangler tail
```

## Complete Example

```bash
cd cloudflare-voice-bridge

# 1. Edit wrangler.toml
# Set: account_id = "abc123xyz789"

# 2. Delete from old account (if exists)
npx wrangler delete voice-proxy --account-id=old-account-id

# 3. Deploy to new account
npx wrangler deploy

# 4. Add custom domain
npx wrangler domains add sam.netmtion.io

# 5. Test
curl https://sam.netmtion.io/health

# 6. Monitor
npx wrangler tail
```

## Verify Deployment Location

```bash
# Check current account
npx wrangler whoami

# List workers in new account
npx wrangler list
```

## Important Notes

- ✅ **No logout needed** - Same user, just different workspace
- ✅ **Account ID is key** - Set it in `wrangler.toml`
- ✅ **Custom domain** - Must be reconfigured in new account
- ⚠️ **DNS propagation** - May take 1-5 minutes
- ⚠️ **Durable Objects** - Data from old account won't transfer automatically

## Troubleshooting

**Issue: "Account not found"**
```bash
# Verify account ID is correct
npx wrangler whoami
# Check it matches the ID in wrangler.toml
```

**Issue: Custom domain not working**
```bash
# Check domain status
npx wrangler domains list

# Re-add if needed
npx wrangler domains remove sam.netmtion.io
npx wrangler domains add sam.netmtion.io
```

**Issue: Worker not showing in new account**
```bash
# Check where it was actually deployed
npx wrangler list

# If wrong account, redeploy:
npx wrangler deploy --account-id=correct-account-id
```

## DNS Configuration

If DNS needs updating after account switch:

1. Go to Cloudflare Dashboard → Select NEW workspace
2. Domain: `netmtion.io` → DNS → Records
3. Find CNAME record for `sam`
4. Update target to: `voice-proxy.your-new-username.workers.dev`
5. Ensure Proxy is ON (orange cloud)

Or the custom domain feature handles this automatically.

## After Moving

Update these if needed:

- ✅ Vercel environment variables (should still work - same URL)
- ✅ Twilio webhooks (should still work - same URL)
- ✅ Test with actual call
- ✅ Monitor logs: `npx wrangler tail`

## Need the Old Account ID?

If you don't remember the old account ID:

```bash
# Check git history
git log -p wrangler.toml

# Or check Cloudflare Dashboard
# Go to old workspace → Workers & Pages → right sidebar
```

## Summary

Moving accounts is simple:
1. Get new account ID from dashboard
2. Set it in `wrangler.toml`
3. Deploy with `npx wrangler deploy`
4. Add custom domain
5. Test

That's it! The same domain (`sam.netmtion.io`) will work, just pointing to the new account's worker.


