-- Technical publication metadata exclusively within a caller-owned BEGIN/ROLLBACK.
-- Not an application endpoint or persistent bypass. Never run without rollback.
create function pg_temp.pr6_refresh_editorial_fixture() returns void language plpgsql as $$
begin
 update public.vc_university_questions set editorial_gap=null where course_id='inteligencia-emocional-aplicada' and status='draft' and editorial_gap is not null;
 insert into public.vc_university_editorial_reviews(material_kind,material_id,course_id,course_version,state,revision,fingerprint,author_id,decided_by,note,gaps)
 select m->>'kind',m->>'id',m->>'course_id',m->>'course_version','approved_for_publication',1,m->>'fingerprint','70aa4d75-bbb9-4839-aad8-670b7654664d','70aa4d75-bbb9-4839-aad8-670b7654664d','Technical rollback fixture only','[]' from public.vc_university_academic_materials('inteligencia-emocional-aplicada') m
 on conflict(material_kind,material_id) do update set fingerprint=excluded.fingerprint,state=excluded.state;
end $$;
