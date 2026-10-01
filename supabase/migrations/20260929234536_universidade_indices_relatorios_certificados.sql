-- Índices de cobertura para as FKs apontadas pelo advisor após a Fase 12.
create index if not exists vc_university_corporate_reports_scope_fk_idx
 on public.vc_university_corporate_reports(cohort_id,course_id,organization_id);
create index if not exists vc_university_corporate_reports_generated_by_idx
 on public.vc_university_corporate_reports(generated_by)
 where generated_by is not null;
create index if not exists vc_university_certificates_revoked_by_idx
 on public.vc_university_certificates(revoked_by)
 where revoked_by is not null;
