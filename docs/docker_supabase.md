## Local Supabase via Docker (Safe Testing Only)

This project must not touch the real Supabase until OTA templates are proven locally. Use the local stack below.

Prereqs:
- Docker Desktop installed and running
- Supabase CLI installed (`brew install supabase/tap/supabase`)

Steps:
1) Initialize and start local stack
```bash
mkdir -p supabase_local && cd supabase_local
supabase init
supabase start
```

2) Apply schema
```bash
# from repo root
supabase db push --db-url "$(supabase status -o json | jq -r '.db.url')"
# Or copy and run SQL:
psql "$(supabase status -o json | jq -r '.db.url')" -f supabase/sql/pdf_templates.sql
```

3) Create Storage bucket and upload PDFs
- In Supabase Studio (local), create bucket `pdf-templates` (public).
- Upload: `assets/pdf/AVAC template horizontal.pdf` and `assets/pdf/SMO AVAC Template.pdf`
- Note the storage paths, e.g. `pdf-templates/avac_normal/v1.pdf` and `pdf-templates/avac_smo/v1.pdf`

4) Seed metadata row per template
```sql
insert into public.pdf_templates (template_type, version, pdf_storage_path, coordinate_mapping, is_active)
values
('avac_normal','v1','pdf-templates/avac_normal/v1.pdf', '{}'::jsonb, true)
on conflict do nothing;
```
Replace `{}` with the canonical mapping JSON.

5) Point the app to local
- Set `EXPO_PUBLIC_SUPABASE_URL` to the local REST URL from `supabase status`.
- Set `EXPO_PUBLIC_SUPABASE_ANON_KEY` from local project.
- Set `EXPO_PUBLIC_TEMPLATE_OTA=true`

6) Test OTA updates
- Bump `version` and/or `coordinate_mapping` in `pdf_templates`.
- Relaunch app or run full sync; verify the new template/mapping is used.

Never connect these steps to production until validated. 


