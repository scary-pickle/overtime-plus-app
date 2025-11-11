-- Seed active rows for local testing (replace storage paths and mappings)
insert into public.pdf_templates (template_type, version, pdf_storage_path, coordinate_mapping, is_active)
values
('avac_normal','v1','pdf-templates/avac_normal/v1.pdf', '{}'::jsonb, true)
on conflict do nothing;

insert into public.pdf_templates (template_type, version, pdf_storage_path, coordinate_mapping, is_active)
values
('avac_smo','v1','pdf-templates/avac_smo/v1.pdf', '{}'::jsonb, true)
on conflict do nothing;


