import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {join} from "node:path";

const root = new URL("..", import.meta.url).pathname;
const read = path => readFileSync(join(root, path), "utf8");
const migration = read("supabase/migrations/20261005014328_ie_course_academic_foundation.sql");
const hardening = read("supabase/migrations/20261005014650_ie_course_academic_foundation_hardening.sql");
const questionIndexes = read("supabase/migrations/20261005014806_ie_course_question_fk_indexes.sql");

test("fundação evolui o schema canônico sem criar Universidade paralela", () => {
  assert.match(migration, /create table if not exists public\.vc_university_course_versions/);
  assert.match(migration, /create table if not exists public\.vc_university_module_versions/);
  assert.match(migration, /create table if not exists public\.vc_university_lessons/);
  assert.match(migration, /create table if not exists public\.vc_university_lesson_versions/);
  assert.match(migration, /create table if not exists public\.vc_university_content_blocks/);
  assert.doesNotMatch(migration, /courses_v2|users_v2|university_v2/i);
  assert.doesNotMatch(migration, /drop table|truncate table/i);
});

test("Liderança é preservada e suas versões legadas são catalogadas", () => {
  assert.match(migration, /from public\.vc_university_course_content cc/);
  assert.match(migration, /content_model[^\n]+legacy_json/);
  assert.match(migration, /where course_id='lideranca-estrategica-aplicada'/);
  assert.match(migration, /leadership_modules<>10/);
  assert.doesNotMatch(migration, /delete from public\.vc_university_(?:courses|modules|course_content)/);
});

test("questões usam opção estável sem remover o contrato v1.1", () => {
  assert.match(migration, /create table if not exists public\.vc_university_question_options/);
  assert.match(migration, /correct_option_id uuid/);
  assert.match(migration, /foreign key \(question_id,correct_option_id\)/);
  assert.match(migration, /jsonb_array_elements_text\(q\.choices\)/);
  assert.match(migration, /Campo legado mantido temporariamente/);
  assert.doesNotMatch(migration, /drop column (?:choices|correct_index)/i);
});

test("evidência separa modo de validação, estado e revisões imutáveis", () => {
  for (const mode of ["structural", "guided", "sampled", "human_required"])
    assert.match(migration, new RegExp(`'${mode}'`));
  for (const status of ["draft", "submitted", "under_review", "revision_requested", "resubmitted", "approved"])
    assert.match(migration, new RegExp(`'${status}'`));
  assert.match(migration, /vc_university_evidence_definition_versions/);
  assert.match(migration, /vc_university_evidence_revisions/);
  assert.match(migration, /vc_university_evidence_reviews/);
  assert.match(migration, /vc_university_evidence_revision_immutable/);
});

test("RLS impede leitura cruzada e não dá bypass pessoal ao proprietário", () => {
  assert.match(migration, /university_evidence_submissions_scoped_read/);
  assert.match(migration, /s\.learner_id=\(select auth\.uid\(\)\)/);
  assert.match(migration, /t\.user_id=\(select auth\.uid\(\)\)/);
  assert.match(migration, /d\.validation_mode in \('sampled','human_required'\)/);
  assert.doesNotMatch(migration, /OWNER_(?:ID|EMAIL)|platform_admin/i);
  assert.doesNotMatch(migration, /grant select on public\.vc_university_evidence_(?:submissions|revisions|reviews)[^;]+to anon/is);
  assert.match(migration, /Empresa, administrador e professor não possuem leitura direta/);
});

test("hardening indexa relações e explicita a fronteira server-only", () => {
  assert.match(hardening, /vc_university_evidence_submissions_enrollment_learner_idx/);
  assert.match(hardening, /vc_university_source_links_question_idx/);
  assert.match(hardening, /vc_university_preview_sessions_course_idx/);
  assert.match(hardening, /for all to anon, authenticated using \(false\) with check \(false\)/);
  assert.match(questionIndexes, /vc_university_questions_competency_idx/);
  assert.match(questionIndexes, /vc_university_questions_correct_option_idx/);
  assert.doesNotMatch(hardening, /drop table|truncate table/i);
});

test("ciclos aplicados são genéricos e não pressupõem psicometria", () => {
  assert.match(migration, /vc_university_application_cycle_definitions/);
  assert.match(migration, /vc_university_application_cycle_versions/);
  assert.match(migration, /vc_university_application_cycle_entries/);
  for (const type of ["objective", "context", "signal", "strategy", "implementation_intention", "indicator", "log", "weekly_review", "final_reflection", "academic_evaluation"])
    assert.match(migration, new RegExp(`'${type}'`));
  assert.doesNotMatch(migration, /inteligencia_emocional_ie30|score_global|ie_(?:alta|media|baixa)/i);
});

test("fontes, competências e ferramentas são versionáveis e relacionáveis", () => {
  assert.match(migration, /vc_university_competencies/);
  assert.match(migration, /vc_university_course_competencies/);
  assert.match(migration, /vc_university_sources/);
  assert.match(migration, /editorial_classification in \('E','C','D','H','P'\)/);
  assert.match(migration, /vc_university_learning_tool_versions/);
  assert.match(migration, /vc_university_source_links/);
});

test("preview não possui matrícula e trilha acadêmica é append-only", () => {
  const previewSection = migration.slice(
    migration.indexOf("create table if not exists public.vc_university_preview_sessions"),
    migration.indexOf("create table if not exists public.vc_university_academic_audit_log")
  );
  const previewDefinition = previewSection.slice(0, previewSection.indexOf(");") + 2);
  assert.doesNotMatch(previewDefinition, /enrollment_id|progress|certificate/);
  assert.match(migration, /vc_university_audit_log_immutable/);
  assert.match(migration, /before_state jsonb/);
  assert.match(migration, /after_state jsonb/);
  assert.match(migration, /reason text/);
});

test("professor é multicursos e continua limitado às turmas atribuídas", () => {
  const api = read("supabase/functions/vc-universidade-professor/index.ts");
  assert.match(api, /DEFAULT_COURSE_ID/);
  assert.match(api, /url\.searchParams\.get\("course"\)/);
  assert.match(api, /input\?\.course_id/);
  assert.match(api, /cohort_id=in\.\(/);
  assert.match(api, /vc_university_teachers/);
  assert.doesNotMatch(api, /const COURSE_ID =/);
});
