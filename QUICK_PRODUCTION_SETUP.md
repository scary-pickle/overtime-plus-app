# Quick Production Setup

## Step 1: Create Table (2 minutes)

1. Open: https://supabase.com/dashboard/project/ethllesuiqlomdtctvdh/sql/new
2. Copy the entire contents of: `supabase/sql/pdf_templates_production.sql`
3. Paste and click **Run**
4. You should see: "Success. No rows returned"

## Step 2: Create Storage Bucket (1 minute)

1. Open: https://supabase.com/dashboard/project/ethllesuiqlomdtctvdh/storage/buckets
2. Click **New bucket**
3. Name: `pdf-templates`
4. ✅ Check **Public bucket**
5. Click **Create bucket**

## Step 3: Set Storage Policy (1 minute)

1. Click on `pdf-templates` bucket
2. Go to **Policies** tab
3. Click **New policy** → **For full customization**
4. Paste this SQL:

```sql
CREATE POLICY "Public read access"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'pdf-templates');
```

5. Click **Review** → **Save policy**

## Step 4: I'll Do the Rest Automatically! 🚀

Once you complete Steps 1-3, tell me and I'll:
- ✅ Upload both PDF templates
- ✅ Seed coordinate mappings
- ✅ Verify everything works

**Total time: ~4 minutes of manual work, then I handle the rest!**

