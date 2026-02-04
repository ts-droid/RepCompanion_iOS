# Resend Email Service Setup

## Quick Start

### 1. Create Resend Account

1. Go to [resend.com](https://resend.com)
2. Sign up (no credit card required for free tier)
3. Verify your email

### 2. Get API Key

1. Go to [API Keys](https://resend.com/api-keys)
2. Click "Create API Key"
3. Name it "RepCompanion Production"
4. Copy the key (starts with `re_`)

### 3. Add to Railway

1. Go to your Railway project
2. Click on `RepCompanion_server` service
3. Go to **Variables** tab
4. Click **+ New Variable**
5. Add:
   - **Name:** `RESEND_API_KEY`
   - **Value:** `re_your_api_key_here`
6. Click **Deploy**

### 4. Verify Domain (Optional but Recommended)

**For production emails, you need to verify your domain:**

1. Go to [Domains](https://resend.com/domains) in Resend
2. Click "Add Domain"
3. Enter your domain (e.g., `repcompanion.se`)
4. Add the DNS records to your domain provider:
   - **SPF Record** (TXT)
   - **DKIM Record** (TXT)
   - **DMARC Record** (TXT)
5. Wait for verification (usually 5-10 minutes)

**Update the "from" address in `server/email-service.ts`:**

```typescript
from: 'RepCompanion <noreply@repcompanion.se>', // Your verified domain
```

### 5. Testing

**Without API Key (Development):**

- Magic links will be logged to Railway console
- No emails will be sent
- Perfect for local testing

**With API Key:**

- Real emails will be sent via Resend
- Check Resend dashboard for delivery stats
- Monitor Railway logs for any errors

## Free Tier Limits

- **3,000 emails/month** - Free forever
- **100 emails/day** - Rate limit
- **No credit card required**

## Pricing After Free Tier

- **$20/month** - 50,000 emails
- **$80/month** - 100,000 emails
- Pay-as-you-go available

## Troubleshooting

### Emails not sending?

1. Check Railway logs for errors
2. Verify `RESEND_API_KEY` is set correctly
3. Check Resend dashboard for failed sends

### Emails going to spam?

1. Verify your domain (see step 4)
2. Add SPF, DKIM, and DMARC records
3. Warm up your domain (send gradually increasing volumes)

### Rate limit errors?

- Free tier: 100 emails/day
- Upgrade to paid plan for higher limits

## Support

- [Resend Documentation](https://resend.com/docs)
- [Resend Discord](https://resend.com/discord)
- Email: support@resend.com
