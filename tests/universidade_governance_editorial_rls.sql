-- Entire fixture is reversible. Run through scripts/universidade-governance-sql.mjs.
begin;
do $$
declare owner uuid:='70aa4d75-bbb9-4839-aad8-670b7654664d';teacher uuid:=gen_random_uuid();outsider uuid:=gen_random_uuid();cohort uuid;src uuid;q uuid;result jsonb;caught boolean;before_content jsonb;
begin
 insert into auth.users(id,email,email_confirmed_at) values(teacher,'pr6-teacher-'||teacher||'@example.invalid',now()),(outsider,'pr6-outsider-'||outsider||'@example.invalid',now());
 insert into public.vc_university_cohorts(course_id,label,status) values('inteligencia-emocional-aplicada','PR6 rollback fixture','active') returning cohort_id into cohort;
 insert into public.vc_university_sources(title,citation,editorial_classification,status) values('PR6 source fixture','Fixture didática de governança','D','draft') returning source_id into src;
 execute 'set local role service_role';
 perform public.vc_university_teacher_assignment(owner,cohort,teacher,'assign',false);
 if public.vc_university_editor_can(teacher,'inteligencia-emocional-aplicada') then raise exception 'teacher_gets_editor_implicitly';end if;
 caught:=false;begin perform public.vc_university_teacher_assignment(teacher,cohort,outsider,'assign',true);exception when others then caught:=sqlerrm='owner_required';end;if not caught then raise exception 'teacher_assigns_role';end if;
 caught:=false;begin perform public.vc_university_governance_read(teacher);exception when others then caught:=sqlerrm='editorial_scope_denied';end;if not caught then raise exception 'teacher_reads_master';end if;
 perform public.vc_university_teacher_assignment(owner,cohort,teacher,'assign',true);
 if not public.vc_university_editor_can(teacher,'inteligencia-emocional-aplicada') or public.vc_university_editor_can(teacher,'lideranca-estrategica-aplicada') then raise exception 'editor_course_scope';end if;
 result:=public.vc_university_governance_read(teacher);
 if result->>'role'<>'editor' or result::text like '%Structured evidence; see structured_data%' or jsonb_array_length(result->'assignments')<>0 or exists(select 1 from jsonb_array_elements(result->'materials') m where m->>'course_id'='lideranca-estrategica-aplicada') then raise exception 'editor_inventory_leaks_scope';end if;
 -- Ownership is no substitute for assignment to student narratives.
 if jsonb_array_length(public.vc_university_teacher_operations(owner)->'cohorts')<>(select count(*) from public.vc_university_teachers where user_id=owner) then raise exception 'owner_teacher_bypass';end if;
 caught:=false;begin perform public.vc_university_teacher_operations(outsider,cohort);exception when others then caught:=sqlerrm='teacher_scope_required';end;if not caught then raise exception 'unassigned_operations';end if;
 select question_id into q from public.vc_university_questions where editorial_id='IE-M02-Q05';
 caught:=false;begin update public.vc_university_questions set status='published',active=true where question_id=q;exception when others then caught:=sqlerrm='editorial_approval_required';end;if not caught then raise exception 'unreviewed_publication';end if;
 result:=public.vc_university_editorial_decide(owner,'question',q::text,'in_review',0,owner,'Revisar ferramenta oficial','["PENTA não definida"]',array[src]);
 caught:=false;begin perform public.vc_university_editorial_decide(owner,'question',q::text,'approved_for_publication',1,owner,'Sem definição fornecida','[]',array[src]);exception when others then caught:=sqlerrm='editorial_gaps_or_sources_pending';end;if not caught then raise exception 'unresolved_gap_approved';end if;
 result:=public.vc_university_editorial_decide(owner,'source',src::text,'in_review',0,owner,'Submeter fonte técnica','[]',array[src]);
 caught:=false;begin perform public.vc_university_editorial_decide(owner,'source',src::text,'approved_for_publication',0,owner,'Conflito de revisão','[]',array[src]);exception when others then caught:=sqlerrm='editorial_revision_conflict';end;if not caught then raise exception 'stale_decision';end if;
 result:=public.vc_university_editorial_decide(owner,'source',src::text,'approved_for_publication',1,owner,'Fonte aprovada para fixture','[]',array[src]);
 -- Content edits invalidate approval and advance the decision revision atomically.
 result:=public.vc_university_material_draft_save(owner,'source',src::text,2,'{"title":"PR6 revised source fixture"}');
 if result->>'state'<>'draft' or (result->>'revision')::integer<>3 then raise exception 'edit_keeps_approval';end if;
 caught:=false;begin perform public.vc_university_material_draft_save(owner,'source',src::text,3,'{"status":"verified"}');exception when others then caught:=sqlerrm='draft_patch_invalid';end;if not caught then raise exception 'patch_publishes';end if;
 result:=public.vc_university_editorial_decide(owner,'source',src::text,'in_review',3,owner,'Nova análise de fonte','[]',array[src]);
 result:=public.vc_university_editorial_decide(owner,'source',src::text,'approved_for_publication',4,owner,'Nova versão conferida','[]',array[src]);
 result:=public.vc_university_editorial_decide(owner,'source',src::text,'published',5,owner,'Publicação técnica reversível','[]',array[src]);
 if (select status from public.vc_university_sources where source_id=src)<>'verified' then raise exception 'source_not_published';end if;
 caught:=false;begin perform public.vc_university_material_draft_save(owner,'source',src::text,6,'{"title":"silent edit"}');exception when others then caught:=sqlerrm='published_material_immutable';end;if not caught then raise exception 'published_mutation';end if;
 result:=public.vc_university_editorial_decide(owner,'source',src::text,'archived',6,owner,'Arquivamento técnico reversível','[]',array[src]);
 if (select count(*) from public.vc_university_academic_audit_log where entity_type='editorial_material' and entity_id='source:'||src::text)<>7 then raise exception 'editorial_history_missing';end if;
 result:=public.vc_university_editorial_decide(owner,'course','inteligencia-emocional-aplicada@1.0','in_review',0,owner,'Revisão técnica de versão','[]',array[src]);
 result:=public.vc_university_editorial_decide(owner,'course','inteligencia-emocional-aplicada@1.0','approved_for_publication',1,owner,'Pré-publicação técnica','[]',array[src]);
 caught:=false;begin perform public.vc_university_editorial_decide(owner,'course','inteligencia-emocional-aplicada@1.0','published',2,owner,'Publicação bloqueada','[]',array[src]);exception when others then caught:=sqlerrm='ie_publication_disabled';end;if not caught then raise exception 'ie_publication_enabled';end if;
 perform public.vc_university_teacher_assignment(owner,cohort,teacher,'remove',false);
 if public.vc_university_editor_can(teacher,'inteligencia-emocional-aplicada') then raise exception 'revocation_ignored';end if;
 perform set_config('pr6.teacher',teacher::text,true);
end $$;
set local role authenticated;
select set_config('request.jwt.claim.sub',current_setting('pr6.teacher'),true);
do $$begin
 begin perform * from public.vc_university_editorial_reviews;raise exception 'editorial_table_exposed';exception when insufficient_privilege then null;end;
 begin perform public.vc_university_editorial_decide('70aa4d75-bbb9-4839-aad8-670b7654664d','source','fake','published',0,'70aa4d75-bbb9-4839-aad8-670b7654664d','fake');raise exception 'actor_impersonation_allowed';exception when insufficient_privilege then null;end;
 begin perform public.vc_university_certification_eligibility('70aa4d75-bbb9-4839-aad8-670b7654664d',gen_random_uuid());raise exception 'learner_calls_privileged_resolver';exception when insufficient_privilege then null;end;
end $$;
set local role postgres;
select 'PR6 editorial workflow, publication guard, roles, privacy, history, CAS and RLS passed; rollback' result;
rollback;
