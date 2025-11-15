# EAS Setup Notes

## Project Linking Required

The EAS project needs to be linked before production builds can be created.

### Steps to Link Project

1. **Link the project:**
   ```bash
   eas build:configure
   ```
   This will create or link to an EAS project and update `app.config.ts` with the project ID.

2. **Update app.config.ts:**
   - After linking, the `projectId` in `app.config.ts` (line 58) will be automatically updated
   - Current placeholder: `'your-project-id'` needs to be replaced with actual project ID

3. **Verify project is linked:**
   ```bash
   eas project:info
   ```
   Should show project details without errors.

## EAS Secrets Setup

For production builds, set environment variables as EAS Secrets:

```bash
# Set Supabase URL
eas secret:create --scope project --name EXPO_PUBLIC_SUPABASE_URL --value "https://your-project-id.supabase.co"

# Set Supabase Anon Key
eas secret:create --scope project --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value "your-anon-key-here"

# Optional: Set OTA template flag
eas secret:create --scope project --name EXPO_PUBLIC_TEMPLATE_OTA --value "true"
```

## Build Profiles

The `eas.json` file has been created with three profiles:
- **development**: For development builds with debug mode enabled
- **preview**: For internal testing builds
- **production**: For app store builds

All profiles use EAS Secrets for sensitive environment variables (not hardcoded in eas.json).




