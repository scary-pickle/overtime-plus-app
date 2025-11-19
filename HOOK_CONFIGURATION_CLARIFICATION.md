# Auth Hook Configuration - Hook Type Clarification

## ✅ Correct Hook Type: **HTTPS** (HTTP Webhook)

For the `auth-signup-guard` edge function, you **must** use an **HTTPS webhook**, not a PostgreSQL trigger.

### Why HTTPS?

- The edge function is an **HTTP endpoint** that receives POST requests
- It needs to be called via HTTP/HTTPS protocol
- The function validates the secret and email domain via HTTP requests

### Configuration Details

**Location:** Dashboard → Authentication → Hooks

**Hook Type:** Select **"HTTPS"** or **"HTTP Webhook"** (NOT PostgreSQL)

**Configuration:**
- **Event:** "User Signed Up" or "Pre-signup" (if available)
- **URL:** `https://ethllesuiqlomdtctvdh.supabase.co/functions/v1/auth-signup-guard`
  - ⚠️ **IMPORTANT:** The URL format is `<project-ref>.supabase.co/functions/v1/<function-name>`
  - ❌ **WRONG:** `<project-ref>.functions.supabase.co/<function-name>`
- **HTTP Method:** `POST`
- **Secret:** `v1,whsec_8uWRnZb68UxS74XeMFwmktTXlmmf1NW6mQTSHvi8PbWQ7D3cuqCN2ODm+rvn5FrPZQvVGy/ULjLmzlNH`
  - This is the Standard Webhooks format secret

### PostgreSQL vs HTTPS

**PostgreSQL Hooks:**
- Run database functions/triggers
- Execute SQL code directly in the database
- Used for database-level operations
- **NOT suitable for calling HTTP endpoints**

**HTTPS Webhooks:**
- Make HTTP requests to external endpoints
- Call edge functions, APIs, or webhooks
- Used for HTTP-based integrations
- **This is what you need for auth-signup-guard**

### Alternative: Database Webhooks

If you want to use Database Webhooks instead (also HTTPS):
- Go to Dashboard → Database → Webhooks
- Create webhook on `auth.users` table
- Configure HTTPS request to the edge function
- This also uses HTTPS, not PostgreSQL

### Summary

✅ **Use:** HTTPS/HTTP Webhook  
❌ **Don't use:** PostgreSQL trigger/function

The edge function is an HTTP endpoint, so it must be called via HTTPS.

