# Communications Layer Implementation Guide

## 🎯 What Was Implemented

A dedicated communications layer that decouples SMS and Email sending from business logic via a BullMQ queue system with retry logic and persistent logging.

### Architecture:
- **SmsProvider & EmailProvider interfaces** - Allows swapping providers without changing business logic
- **Exotel SMS Provider** - For OTP delivery (India-first, trial account with ₹500 credits)
- **Resend Email Provider** - For transactional emails (100/day, 3,000/month free tier)
- **BullMQ Queue Processor** - Handles async job processing with exponential backoff retry
- **CommunicationLog Table** - Persistent audit trail of all SMS/Email attempts
- **Pre-built Email Templates** - welcome, order_confirmation, order_delivered, refund_processed, onboarding_approved

## 📋 Files Created / Modified

### Created:
- `src/communications/` ✅ - New module
  - `communications.service.ts` - Main service for queuing SMS/Email
  - `communications.processor.ts` - BullMQ job processor
  - `communications.module.ts` - NestJS module
  - `providers/exotel-sms.provider.ts` - SMS implementation
  - `providers/resend-email.provider.ts` - Email implementation
  - `interfaces/sms-provider.interface.ts` - SMS contract
  - `interfaces/email-provider.interface.ts` - Email contract
  - `dto/send-sms.dto.ts` - SMS job payload
  - `dto/send-email.dto.ts` - Email job payload

### Modified:
- `prisma/schema.prisma` ✅
  - Added `CommunicationLog` model
  - Added `CommunicationChannel` enum (SMS, EMAIL, PUSH)
  - Added `CommunicationStatus` enum (PENDING, SENT, FAILED, BOUNCED)
  - Added relation to `User` model

- `src/lib/auth.ts` ✅
  - Added `setCommunicationsService()` function to set service reference
  - Updated `sendOTP` to queue SMS via communications service
  - Added fallback to console.log if service not initialized

- `src/auth/auth.module.ts` ✅
  - Added `OnModuleInit` to set communications service reference
  - Added `CommunicationsModule` import

- `src/orders/orders.service.ts` ✅
  - Injected `CommunicationsService`
  - Added email queue call for order confirmations

- `src/orders/orders.module.ts` ✅
  - Added `CommunicationsModule` import

- `src/app.module.ts` ✅
  - Added `CommunicationsModule` import

## 🚀 What You Need To Do

### 1. Install Dependencies

```bash
# SMS provider: Exotel SDK (if available, otherwise HTTP client works)
npm install axios  # For HTTP requests to Exotel/Resend

# Already installed:
# - @nestjs/bullmq (for queue processing)
# - ioredis (for queue backend)
# - @prisma/client (for database)
```

### 2. Setup Environment Variables

Create a `.env` file in the root with:

```env
# Communication Providers

# Exotel SMS (India-first)
# Get from: https://exotel.com dashboard
EXOTEL_API_KEY=your_exotel_api_key
EXOTEL_SID=your_exotel_sid
EXOTEL_FROM_NUMBER=FoodApp  # Your sender name/number

# Resend Email
# Get from: https://resend.com/api-keys
RESEND_API_KEY=your_resend_api_key
RESEND_FROM_EMAIL=noreply@foodapp.com  # Your sender email
```

### 3. Update Database Schema

Run migration to create the `CommunicationLog` table:

```bash
npm run prisma:migrate -- --name "add-communication-log"
# Or manually:
npx prisma migrate dev --name "add-communication-log"
```

### 4. Testing the Integration

#### Test OTP Flow (SMS):
```bash
# Make a sign-up request with phone
curl -X POST http://localhost:3000/api/auth/sign-up/phone \
  -H "Content-Type: application/json" \
  -d '{"phoneNumber": "+919876543210"}'

# Check the communications_log table for the queued SMS
SELECT * FROM communication_log 
WHERE channel = 'SMS' AND event = 'LOGIN_OTP' 
ORDER BY created_at DESC LIMIT 1;

# Monitor BullMQ dashboard (if enabled):
# http://localhost:3000/bull/dashboard
```

#### Test Order Flow (Email):
```bash
# Create an order
curl -X POST http://localhost:3000/api/orders \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{...order payload...}'

# Check communications_log for queued email
SELECT * FROM communication_log 
WHERE channel = 'EMAIL' AND event = 'ORDER_CONFIRMATION' 
ORDER BY created_at DESC LIMIT 1;
```

### 5. Provider Setup Instructions

#### **Exotel SMS Setup** (Recommended for India)
1. Go to https://exotel.com
2. Sign up for free trial account
3. Navigate to **Settings > API**
4. Copy:
   - API Key
   - SID (Account SID)
   - From Number (or use display name like "FoodApp")
5. Fund your account (trial gives ₹500 credits)
6. Add credentials to `.env`

**Cost**: Trial ₹500 credits (enough for ~100 OTP sends at ₹5/SMS)
**DLT Requirements**: For production, you'll need entity registration (₹5000 + GST)

#### **Resend Email Setup**
1. Go to https://resend.com
2. Sign up with email
3. Go to **API Keys** page
4. Create a new API key
5. Add to `.env`

**Cost**: Free tier = 100/day, 3,000/month (sufficient for MVP)
**Production**: Pay as you scale

### 6. Extending Communication Templates

Add more email templates in `src/communications/communications.processor.ts`:

```typescript
const EMAIL_TEMPLATES: Record<string, (data: any) => string> = {
  // ... existing templates ...
  
  // Add your template:
  custom_event: (data) => `
    <h2>Custom Event</h2>
    <p>Hi ${data.userName},</p>
    <p>${data.customMessage}</p>
  `,
};
```

Then use it:
```typescript
await this.communicationsService.queueEmail({
  to: 'user@example.com',
  subject: 'Your Custom Subject',
  template: 'custom_event',  // ← matches key above
  event: 'CUSTOM_EVENT',
  templateData: {
    userName: 'John',
    customMessage: 'Your message here',
  },
});
```

### 7. Monitor & Debug Communications

#### Check Queued Jobs:
```typescript
// In your controller or service:
const jobs = await this.communicationsQueue.getJobs(['active', 'delayed', 'failed']);
console.log(jobs);
```

#### View Communication Logs:
```sql
-- All failed communications
SELECT * FROM communication_log 
WHERE status = 'FAILED' 
ORDER BY created_at DESC;

-- All communications for a user
SELECT * FROM communication_log 
WHERE user_id = 'user_id' 
ORDER BY created_at DESC;

-- Retry rate analysis
SELECT channel, event, status, COUNT(*) 
FROM communication_log 
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY channel, event, status;
```

### 8. Advanced: Switch to Different Providers

To use **MSG91** instead of Exotel:
1. Create `src/communications/providers/msg91-sms.provider.ts`
2. Implement `ISmsProvider` interface
3. Update `communications.module.ts` provider registration

Example MSG91 provider:
```typescript
@Injectable()
export class Msg91SmsProvider implements ISmsProvider {
  name = 'msg91';
  
  async send(to: string, message: string): Promise<string> {
    // Call MSG91 API
    const response = await fetch('https://control.msg91.com/api/sendhttp.php', {
      method: 'POST',
      body: new URLSearchParams({
        authkey: process.env.MSG91_AUTHKEY!,
        mobiles: to,
        message,
        route: '4',
      }),
    });
    const data = await response.json();
    return data.request_id;
  }
}
```

Then in module:
```typescript
{
  provide: 'ISmsProvider',
  useClass: process.env.SMS_PROVIDER === 'msg91' ? Msg91SmsProvider : ExotelSmsProvider,
}
```

### 9. Monitoring & Observability

Consider adding:
- **BullMQ UI Dashboard**: https://github.com/felixmosh/bull-monitor
- **Prometheus metrics** for queue depth and failure rates
- **Slack/Discord webhooks** for communication failures
- **Email open tracking** via Resend webhooks

### 10. Production Checklist

- [ ] Set up DLT entity registration for SMS (India-only, ₹5000)
- [ ] Configure email domain verification (SPF/DKIM) in Resend
- [ ] Set up monitoring alerts for failed communications
- [ ] Configure exponential backoff parameters based on testing
- [ ] Add rate limiting to communications queue
- [ ] Set up automated cleanup of old logs
- [ ] Test failover between providers
- [ ] Document phone numbers/emails that opted out

## 🔄 Current Queue Flow

```
User Action (OTP login or Order creation)
        ↓
CommunicationsService.queueSms/Email()
        ↓
Create CommunicationLog (PENDING status)
        ↓
Add job to BullMQ redis queue
        ↓
CommunicationsProcessor picks up job
        ↓
Render template → Call provider API
        ↓
Update CommunicationLog (SENT or FAILED status)
        ↓
If failed: retry with exponential backoff (2s, 4s, 8s, etc.)
        ↓
Max 3 attempts, then mark as FAILED
```

## ⚠️ Important Notes

1. **Service Initialization**: The CommunicationsService is wired into auth.ts when AuthModule initializes. If auth requests happen before auth.module is loaded, they'll fall back to console.log. This is fine for development.

2. **Email Templates**: Currently using simple string templates. For production, consider using:
   - Handlebars or EJS for complex layouts
   - Resend's built-in template system
   - MJML for responsive email design

3. **Phone Number Format**: Exotel expects E.164 format: `+919876543210`

4. **Email from Address**: Resend requires verified sender domains. Use the domain verified in your Resend dashboard.

5. **DLT in India**: SMS to India numbers requires entity registration with telecom regulators. This is a compliance requirement every SMS provider enforces.

## 📚 References

- Exotel API: https://developer.exotel.com/api-reference/#send-sms
- Resend API: https://resend.com/docs/api-reference/emails/send
- BullMQ Docs: https://docs.bullmq.io
- Prisma Enums: https://www.prisma.io/docs/concepts/components/prisma-schema/data-model#enums

---

**Next Steps After Implementation:**
1. Add SMS to delivery confirmation ("Rider is here")
2. Add Email for restaurant/driver onboarding approvals
3. Implement Twilio as fallback SMS provider
4. Add WhatsApp messaging via provider
5. Build admin dashboard for resending communications
