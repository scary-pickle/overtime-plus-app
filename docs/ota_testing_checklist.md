## OTA Templates QA Checklist

Scenarios:
- Online, first run with OTA enabled: downloads PDFs and mappings, uses them.
- Offline, first run: falls back to bundled asset, no crash.
- Online, version bump in `pdf_templates`: app picks new version next launch.
- Invalid/corrupt PDF in storage: validation fails, keep using previous good version.
- Rollback: switch active row back; app returns to previous cached version.
- SMO vs normal switching: each template type caches independently.

Technical checks:
- Cache files created in `Paths.cache.uri` with versioned filenames.
- `template_cache` and `template_versions` rows updated.
- No calls to production Supabase during local testing.


