// @ts-nocheck -- arquivo legado em JavaScript/Deno; o motor compartilhado abaixo é tipado.
import {assessmentBegin,assessmentSubmit,assessmentBank} from "../_shared/assessment-api.ts";
import {cycleDefinitions,cycleRead,cycleWrite} from "../_shared/cycle-api.ts";
import {evidenceDefinitions, evidenceRead, evidenceWrite} from "../_shared/evidence-api.ts";
import {checkpointSnapshot, gradeStableCheckpoint, resolveModuleStates} from "../_shared/academic-engine.ts";

// Private academic API. Versioned lesson content is read server-side from restricted tables.
// The static site must not contain answer keys or service credentials.
const ROOT = Deno.env.get("SUPABASE_URL") ?? "https://ctzgsxxbyvruzmfqibnl.supabase.co";
const KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "sb_publishable_rF60SyuGpNstim9MqFvqmQ_sSm78z1b";
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const DEFAULT_COURSE_ID = "lideranca-estrategica-aplicada";
const OWNER_PRODUCT_ID = "P-021";
const OWNER_ID = "70aa4d75-bbb9-4839-aad8-670b7654664d";
const OWNER_EMAIL = "vcmenteconvergente@gmail.com";
const PROD = "https://vc-mente-convergente.vercel.app";
const FIELDS = "enrollment_id,course_id,course_version,status,cohort_id,enrolled_at,completed_at";

function trustedOrigin(origin) {
 return origin === PROD ||
  /^https:\/\/vc-mente-convergente-[a-z0-9-]+-life-os22\.vercel\.app$/.test(origin) ||
  ["http://localhost:4173", "http://127.0.0.1:4173"].includes(origin);
}

function reply(status, body, origin) {
 return new Response(status === 204 ? null : JSON.stringify(body), {
  status, headers: {
   "content-type": "application/json; charset=utf-8", "cache-control": "private, no-store",
   "x-content-type-options": "nosniff", "vary": "Origin, Authorization",
   "access-control-allow-origin": trustedOrigin(origin) ? origin : PROD,
   "access-control-allow-headers": "authorization, apikey, content-type",
   "access-control-allow-methods": "GET, POST, OPTIONS"
  }
 });
}
async function core(path, bearer, options = {}) {
 const response = await fetch(ROOT + path, {
  ...options, headers: {apikey: KEY, authorization: bearer, accept: "application/json", ...(options.headers ?? {})},
  signal: AbortSignal.timeout(10000), cache: "no-store"
 });
 return response;
}
async function database(table, query = "", options = {}) {
 if (!SERVICE) throw new Error("server_configuration_missing");
 const response = await fetch(ROOT + "/rest/v1/" + table + query, {
  ...options,
  headers: {apikey: SERVICE, authorization: "Bearer " + SERVICE, accept: "application/json",
   ...(options.body ? {"content-type": "application/json"} : {}), ...(options.headers ?? {})},
  signal: AbortSignal.timeout(10000), cache: "no-store"
 });
 if (!response.ok) {
  const failure=await response.json().catch(()=>({}));
  const safe=["assessment_context_denied","assessment_purpose_invalid","assessment_session_invalid","assessment_bank_unavailable","assessment_config_unavailable","answers_invalid","module_locked","modules_required","evidence_required","cycle_context_denied","cycle_definition_unavailable","cycle_setup_required","cycle_setup_ineligible","cycle_start_ineligible","cycle_locked","cycle_transition_denied","cycle_structure_invalid","cycle_entry_key_invalid","cycle_indicator_invalid","cycle_log_date_invalid","weekly_review_not_due","weekly_review_immutable","cycle_duration_pending","weekly_reviews_pending","final_reflection_pending","selected_logs_invalid","required_applications_pending","integrator_size_limit","pedagogical_review_required","goal_change_limit_reached","invalid_cycle_request","cycle_request_id_required","draft_version_conflict","submission_locked","idempotency_payload_conflict","previous_module_required","evidence_structure_invalid","evidence_context_denied","evidence_definition_unavailable","evidence_review_denied","review_revision_stale","review_state_conflict"].find(code=>failure.message?.includes(code));
  throw new Error(safe||("database_error:"+response.status));
 }
 const body = await response.text();
 return body ? JSON.parse(body) : null;
}
function scoped(enrollmentId) { return "enrollment_id=eq." + encodeURIComponent(enrollmentId); }
async function recordEvent(enrollmentId, actorId, eventType, moduleNo, details = {}) {
 await database("vc_university_events", "", {
  method: "POST", headers: {Prefer: "return=minimal"},
  body: JSON.stringify({enrollment_id: enrollmentId, actor_id: actorId, event_type: eventType,
   module_no: moduleNo ?? null, details})
 });
}
async function recordEventOnce(enrollmentId, actorId, eventType, moduleNo, details = {}) {
 const moduleFilter = moduleNo == null ? "&module_no=is.null" : "&module_no=eq." + moduleNo;
 const existing = await database("vc_university_events",
  "?select=event_id&" + scoped(enrollmentId) + "&event_type=eq." + encodeURIComponent(eventType)
   + moduleFilter + "&limit=1");
 if (!existing.length) await recordEvent(enrollmentId, actorId, eventType, moduleNo, details);
}
function legacyModuleVersions(course) {
 return course.modules.map(module => ({module_version_id: `legacy:${course.version}:${module.number}`,
  module_no: module.number, title: module.title}));
}
async function context(bearer, courseId) {
 const identity = await core("/auth/v1/user", bearer);
 if (!identity.ok) return {error: 401};
 const user = await identity.json();
 if (!user?.id) return {error: 401};
 const metadata = await database("vc_university_courses",
  "?select=course_id,product_id,title,version,modality,hours_minutes,final_pass_percent,certificate_requires_project_review" +
   "&course_id=eq." + encodeURIComponent(courseId) + "&limit=1");
 const courseRecord = metadata[0];
 if (!courseRecord?.product_id || !courseRecord.version) return {error: 404};
 const rights = await core("/functions/v1/vc-core-private-api/v1/me/access?market=BR&locale=pt-BR", bearer);
 if (!rights.ok) return {error: rights.status === 401 ? 401 : 503};
 const accesses = (await rights.json())?.data?.accesses;
 if (!Array.isArray(accesses)) return {error: 503};
 if (!accesses.some(a => a.product_id === courseRecord.product_id)) {
  if (courseId !== DEFAULT_COURSE_ID || courseRecord.product_id !== OWNER_PRODUCT_ID ||
      user.id !== OWNER_ID || user.email?.toLowerCase() !== OWNER_EMAIL || !user.email_confirmed_at)
   return {error: 403};
  const scope = await core("/functions/v1/vc-core-private-api/v1/admin/scope", bearer);
  if (!scope.ok || (await scope.json())?.data?.platform_admin !== true) return {error: 403};
 }
 const enrollments = await database("vc_university_enrollments",
  "?select=" + FIELDS + "&course_id=eq." + encodeURIComponent(courseId) + "&user_id=eq." + user.id +
   "&status=in.(active,completed)&limit=1");
 if (!enrollments.length) return {error: 409, code: "enrollment_sync_required"};
 return {user, enrollment: enrollments[0], courseRecord};
}
async function versionRecord(courseId, version) {
 const versions = await database("vc_university_course_versions",
  "?select=course_id,version,title_snapshot,subtitle_snapshot,institution_snapshot,school_snapshot,language_code," +
  "modality_snapshot,hours_minutes,content_model,status&course_id=eq." + encodeURIComponent(courseId) +
  "&version=eq." + encodeURIComponent(version) + "&limit=1");
 return versions[0] ?? null;
}
async function structuredCourse(courseId, version, metadata, preview = false) {
 const editorialStatus = preview ? "in.(draft,review,published)" : "eq.published";
 const moduleVersions = await database("vc_university_module_versions",
  "?select=module_version_id,module_id,module_no,title,estimated_minutes,status&course_id=eq." +
  encodeURIComponent(courseId) + "&course_version=eq." + encodeURIComponent(version) +
  "&status=" + editorialStatus + "&order=module_no.asc");
 const modules = [];
 for (const module of moduleVersions) {
  const lessonVersions = await database("vc_university_lesson_versions",
   "?select=lesson_version_id,lesson_id,revision,title,learning_objectives,estimated_minutes,status" +
   "&module_version_id=eq." + module.module_version_id + "&status=" + editorialStatus + "&order=created_at.asc");
  const lessons = [];
  for (const lesson of lessonVersions) {
   const blocks = await database("vc_university_content_blocks",
    "?select=content_block_id,block_key,block_type,position,revision,content,status" +
    "&lesson_version_id=eq." + lesson.lesson_version_id + "&status=" + editorialStatus + "&order=position.asc");
   lessons.push({...lesson, blocks});
  }
  modules.push({number: module.module_no, title: module.title, moduleVersionId: module.module_version_id,
   estimatedMinutes: module.estimated_minutes, lessons});
 }
 return {id: courseId, version, title: metadata.title_snapshot, subtitle: metadata.subtitle_snapshot,
  institution: metadata.institution_snapshot, school: metadata.school_snapshot,
  language: metadata.language_code, modality: metadata.modality_snapshot,
  hours: metadata.hours_minutes / 60, contentModel: "structured_blocks", modules};
}
async function courseContent(courseId, version, preview = false) {
 const metadata = await versionRecord(courseId, version);
 if (!metadata) throw new Error("course_version_unavailable");
 if (metadata.content_model === "legacy_json") {
  const source = await database("vc_university_course_content",
   "?select=content&course_id=eq." + encodeURIComponent(courseId) + "&course_version=eq." + encodeURIComponent(version) + "&limit=1");
  const course = source[0]?.content;
  if (course?.id !== courseId || course.version !== version || !Array.isArray(course.modules))
   throw new Error("course_content_unavailable");
  return {...course, contentModel: "legacy_json", metadata};
 }
 if (!preview && !["published", "archived"].includes(metadata.status))
  throw new Error("course_version_unavailable");
 return structuredCourse(courseId, version, metadata, preview);
}
async function courseAndProgress(courseId, version, enrollmentId) {
 const course = await courseContent(courseId, version);
 const moduleVersions = course.contentModel === "legacy_json" ?
  await database("vc_university_module_versions", "?select=module_version_id,module_no,title&course_id=eq." +
   encodeURIComponent(courseId) + "&course_version=eq." + encodeURIComponent(version) + "&order=module_no.asc") :
  course.modules.map(module => ({module_version_id: module.moduleVersionId,module_no: module.number,title: module.title}));
 const normalizedModules = moduleVersions.length ? moduleVersions : legacyModuleVersions(course);
 const [progress,requirements,requirementProgress,dependencies] = await Promise.all([
  database("vc_university_module_progress",
   "?select=module_no,module_version_id,status,opened_at,started_at,content_completed_at,evidence,submitted_at," +
   "checkpoint_passed_at,requirements_completed_at,completed_at,review_status,review_feedback&" +
   scoped(enrollmentId) + "&order=module_no.asc"),
  database("vc_university_module_requirements",
   "?select=requirement_id,module_version_id,requirement_key,requirement_type,required,position,status" +
   "&course_id=eq." + encodeURIComponent(courseId) + "&course_version=eq." + encodeURIComponent(version) +
   "&status=eq.published&order=position.asc"),
  database("vc_university_requirement_progress",
   "?select=requirement_id,status,satisfied_at,source_id&" + scoped(enrollmentId)),
  database("vc_university_module_dependencies",
   "?select=module_version_id,depends_on_module_version_id,status&course_id=eq." + encodeURIComponent(courseId) +
   "&course_version=eq." + encodeURIComponent(version) + "&status=eq.published")
 ]);
 const states = resolveModuleStates(normalizedModules,progress,dependencies,requirements,requirementProgress);
 return {course, progress, states, moduleVersions: normalizedModules, requirements};
}
async function checkpointQuestions(courseId, course, moduleNo) {
 const questions = await database("vc_university_questions",
  "?select=question_id,question_key,question_version,prompt,choices,correct_index,correct_option_id,correct_feedback,review_concept,kind"
   + "&course_id=eq." + encodeURIComponent(courseId) + "&course_version=eq." + encodeURIComponent(course.version)
   + "&purpose=eq.checkpoint&module_no=eq." + moduleNo + "&active=eq.true"
   + "&order=kind.asc,question_id.asc&limit=5");
 for (const question of questions) {
  question.options = await database("vc_university_question_options",
   "?select=option_id,option_order,option_text,feedback&question_id=eq." + question.question_id +
   "&order=option_order.asc");
 }
 return questions;
}
async function checkpointConfiguration(courseId, courseVersion, moduleVersionId, moduleNo) {
 const requirements = moduleVersionId ? await database("vc_university_module_requirements",
  "?select=requirement_id,configuration&module_version_id=eq." + moduleVersionId +
  "&requirement_type=eq.checkpoint_passed&status=eq.published&limit=1") : [];
 if (requirements[0]) {
  const percent = Number(requirements[0].configuration?.pass_percent);
  if (!Number.isFinite(percent) || percent < 1 || percent > 100) throw new Error("checkpoint_config_unavailable");
  return {requirementId: requirements[0].requirement_id, passPercent: percent,
   minimum: Math.ceil(5 * percent / 100)};
 }
 const modules = await database("vc_university_modules",
  "?select=checkpoint_pass_count&course_id=eq." + encodeURIComponent(courseId) + "&module_no=eq." + moduleNo + "&limit=1");
 const minimum = modules[0]?.checkpoint_pass_count;
 if (!Number.isInteger(minimum) || minimum < 1 || minimum > 5) throw new Error("checkpoint_config_unavailable");
 return {requirementId: null, passPercent: minimum * 20, minimum};
}
async function finalQuestionPool(courseId, course) {
 return database("vc_university_questions",
  "?select=question_id,prompt,choices,correct_index,review_concept,kind"
   + "&course_id=eq." + encodeURIComponent(courseId) + "&course_version=eq." + encodeURIComponent(course.version)
   + "&purpose=eq.final&active=eq.true&order=question_id.asc&limit=100");
}
function shuffled(items) {
 const result = [...items];
 for (let index = result.length - 1; index > 0; index--) {
  const random = new Uint32Array(1);
  crypto.getRandomValues(random);
  const target = random[0] % (index + 1);
  [result[index], result[target]] = [result[target], result[index]];
 }
 return result;
}
function orderedSessionQuestions(pool, questionIds) {
 const byId = new Map(pool.map(question => [question.question_id, question]));
 const questions = questionIds.map(id => byId.get(id));
 return questions.length === 20 && questions.every(Boolean) ? questions : null;
}
function selectFinalQuestions(pool) {
 const kinds = ["concept", "application", "case", "decision"];
 const selected = kinds.flatMap(kind => shuffled(pool.filter(question => question.kind === kind)).slice(0, 5));
 if (selected.length !== 20) throw new Error("final_bank_distribution_unavailable");
 return shuffled(selected);
}
function validLearnerName(value) {
 return typeof value === "string" && value.trim().length >= 3 && value.trim().length <= 160 &&
  value.trim().split(/\s+/).length >= 2 && /^[A-Za-zÀ-ÖØ-öø-ÿ' -]+$/.test(value.trim());
}
async function completionState(access, courseId, course, progress, states) {
 const [attempts, certificates] = await Promise.all([
  database("vc_university_final_attempts",
   "?select=score,question_count,submitted_at&" + scoped(access.enrollment.enrollment_id) +
    "&course_id=eq." + encodeURIComponent(courseId) +
    "&course_version=eq." + encodeURIComponent(course.version) + "&order=score.desc,submitted_at.desc&limit=1"),
  database("vc_university_certificates",
   "?select=certificate_id,public_code,course_id_snapshot,course_title_snapshot,course_version_snapshot," +
    "nature_snapshot,modality_snapshot,hours_minutes_snapshot,learner_name_snapshot,period_start_snapshot," +
    "completion_date_snapshot,issued_at,issuer_snapshot,issuer_legal_name_snapshot,issuer_document_snapshot," +
    "responsible_snapshot,result_percent_snapshot,program_snapshot,validation_url_snapshot,revoked_at&" +
    scoped(access.enrollment.enrollment_id) + "&limit=1")
 ]);
 const best = attempts[0];
 const finalPercent = best ? Math.floor(best.score * 100 / best.question_count) : null;
 const projectModule = Math.max(...states.map(item => item.number));
 const project = progress.find(item => item.module_no === projectModule);
 const requirements = {
  modules: {done: states.filter(item => item.completed).length, required: states.length,
   met: states.length > 0 && states.every(item => item.completed)},
  evidence: {done: progress.filter(item => item.submitted_at && item.evidence?.trim()).length,
   required: states.length, met: states.length > 0 && progress.filter(item => item.submitted_at && item.evidence?.trim()).length === states.length},
  checkpoints: {done: progress.filter(item => item.checkpoint_passed_at).length,
   required: states.length, met: states.length > 0 && progress.filter(item => item.checkpoint_passed_at).length === states.length},
  assessment: {score: finalPercent, required: access.courseRecord.final_pass_percent,
   met: finalPercent !== null && finalPercent >= access.courseRecord.final_pass_percent},
  project: {required: access.courseRecord.certificate_requires_project_review,
   status: project?.review_status ?? "pending",
   met: !access.courseRecord.certificate_requires_project_review || project?.review_status === "approved"}
 };
 const ready = Object.values(requirements).every(item => item.met);
 return {ready, requirements, certificate: certificates[0] ?? null};
}
async function finalAssessmentSession(enrollmentId, courseId, course) {
 const now = new Date().toISOString();
 const pool = await finalQuestionPool(courseId, course);
 if (pool.length < 20) throw new Error("final_bank_unavailable");
 const open = await database("vc_university_final_sessions",
  "?select=session_id,question_ids,expires_at&" + scoped(enrollmentId)
   + "&course_id=eq." + encodeURIComponent(courseId)
   + "&course_version=eq." + encodeURIComponent(course.version)
   + "&submitted_at=is.null&expires_at=gt." + encodeURIComponent(now)
   + "&order=started_at.desc&limit=1");
 const existing = open[0];
 if (existing) {
  const questions = orderedSessionQuestions(pool, existing.question_ids);
  if (!questions) throw new Error("assessment_session_invalid");
  return {sessionId: existing.session_id, expiresAt: existing.expires_at, questions};
 }
 const questions = selectFinalQuestions(pool);
 const expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
 const created = await database("vc_university_final_sessions", "", {
  method: "POST", headers: {Prefer: "return=representation"},
  body: JSON.stringify({enrollment_id: enrollmentId, course_id: courseId,
   course_version: course.version, question_ids: questions.map(q => q.question_id), expires_at: expiresAt})
 });
 if (!created?.[0]?.session_id) throw new Error("assessment_session_unavailable");
 return {sessionId: created[0].session_id, expiresAt, questions};
}
async function sessionQuestions(sessionId, enrollmentId, courseId, course) {
 const sessions = await database("vc_university_final_sessions",
  "?select=session_id,question_ids,expires_at&session_id=eq." + encodeURIComponent(sessionId)
   + "&" + scoped(enrollmentId) + "&course_id=eq." + encodeURIComponent(courseId)
   + "&course_version=eq." + encodeURIComponent(course.version)
   + "&submitted_at=is.null&expires_at=gt." + encodeURIComponent(new Date().toISOString()) + "&limit=1");
 if (!sessions.length) return null;
 const pool = await finalQuestionPool(courseId, course);
 const questions = orderedSessionQuestions(pool, sessions[0].question_ids);
 return questions ? {session: sessions[0], questions} : null;
}
async function previewAuthorization(bearer, courseId, perspective) {
 const identity = await core("/auth/v1/user", bearer);
 if (!identity.ok) return {error: 401};
 const user = await identity.json();
 if (!user?.id) return {error: 401};
 const scope = await core("/functions/v1/vc-core-private-api/v1/admin/scope", bearer);
 const admin = scope.ok && (await scope.json())?.data?.platform_admin === true;
 if (admin) return {user, role: "owner"};
 if (perspective === "content_master") return {error: 403};
 const assignments = await database("vc_university_teachers",
  "?select=cohort_id&user_id=eq." + user.id);
 if (!assignments.length) return {error: 403};
 const cohortIds = assignments.map(item => item.cohort_id).join(",");
 const cohorts = await database("vc_university_cohorts",
  "?select=cohort_id,course_id&cohort_id=in.(" + cohortIds + ")&course_id=eq." + encodeURIComponent(courseId));
 return cohorts.length ? {user,role: "teacher"} : {error: 403};
}
async function previewCatalog(bearer) {
 const identity = await core("/auth/v1/user", bearer);
 if (!identity.ok) return {error: 401};
 const user = await identity.json();
 const scope = await core("/functions/v1/vc-core-private-api/v1/admin/scope", bearer);
 const admin = scope.ok && (await scope.json())?.data?.platform_admin === true;
 let courseIds = null;
 if (!admin) {
  const assignments = await database("vc_university_teachers", "?select=cohort_id&user_id=eq." + user.id);
  if (!assignments.length) return {error: 403};
  const cohorts = await database("vc_university_cohorts", "?select=course_id&cohort_id=in.(" +
   assignments.map(item => item.cohort_id).join(",") + ")");
  courseIds = [...new Set(cohorts.map(item => item.course_id))];
 }
 const query = "?select=course_id,version,title_snapshot,subtitle_snapshot,content_model,status&order=course_id.asc,version.desc" +
  (courseIds ? "&course_id=in.(" + courseIds.map(encodeURIComponent).join(",") + ")" : "");
 return {user, role: admin ? "owner" : "teacher", versions: await database("vc_university_course_versions",query)};
}
async function previewCourse(bearer, courseId, version, perspective) {
 const access = await previewAuthorization(bearer,courseId,perspective);
 if (access.error) return access;
 const course = await courseContent(courseId,version,true);
 const moduleVersions = course.contentModel === "legacy_json" ? await database("vc_university_module_versions",
  "?select=module_version_id,module_no,title&course_id=eq." + encodeURIComponent(courseId) +
  "&course_version=eq." + encodeURIComponent(version) + "&order=module_no.asc") :
  course.modules.map(module => ({module_version_id:module.moduleVersionId,module_no:module.number,title:module.title}));
 const dependencies = await database("vc_university_module_dependencies",
  "?select=module_version_id,depends_on_module_version_id,status&course_id=eq." + encodeURIComponent(courseId) +
  "&course_version=eq." + encodeURIComponent(version) + "&status=in.(draft,review,published)");
 const previewDependencies = dependencies.map(item => ({...item,status:"published"}));
 const states = resolveModuleStates(moduleVersions,[],previewDependencies,[],[]);
 const evidence = await evidenceDefinitions(database,courseId,version,true);
 const cycles=await cycleDefinitions(database,courseId,version,true);
 return {preview:true,perspective,role:access.role,course,states,evidence,cycles,assessments:await assessmentBank(database,courseId,version),
  writes:{enrollment:false,progress:false,attempt:false,certificate:false,analytics:false}};
}
Deno.serve(async request => {
 const origin = request.headers.get("origin") ?? "";
 if (request.method === "OPTIONS") return reply(204, null, origin);
 if (!["GET", "POST"].includes(request.method)) return reply(405, {error: "method_not_allowed"}, origin);
 const bearer = request.headers.get("authorization") ?? "";
 if (!/^Bearer [A-Za-z0-9._-]{20,4096}$/.test(bearer)) return reply(401, {error: "sign_in_required"}, origin);
 try {
  const url = new URL(request.url);
  const courseId = url.searchParams.get("course") ?? DEFAULT_COURSE_ID;
  if (courseId.length > 96 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(courseId))
   return reply(400, {error: "invalid_course"}, origin);
  if (url.searchParams.get("view") === "preview_catalog") {
   if (request.method !== "GET") return reply(405,{error:"preview_read_only"},origin);
   const catalog = await previewCatalog(bearer);
   return catalog.error ? reply(catalog.error,{error:"access_denied"},origin) : reply(200,catalog,origin);
  }
  const perspective = url.searchParams.get("preview");
  if (perspective) {
   if (request.method !== "GET") return reply(405,{error:"preview_read_only"},origin);
   if (!["student","teacher","content_master"].includes(perspective))
    return reply(400,{error:"invalid_preview_perspective"},origin);
   const version = url.searchParams.get("version");
   if (!version || !/^[A-Za-z0-9][A-Za-z0-9._-]{0,31}$/.test(version))
    return reply(400,{error:"invalid_version"},origin);
   const preview = await previewCourse(bearer,courseId,version,perspective);
   return preview.error ? reply(preview.error,{error:"access_denied"},origin) : reply(200,preview,origin);
  }
  const access = await context(bearer, courseId);
  if (access.error) return reply(access.error, {error: access.code ?? "access_denied"}, origin);
  const enrollmentVersion = access.enrollment.course_version;
  if (typeof enrollmentVersion !== "string" || !enrollmentVersion)
   throw new Error("enrollment_version_unavailable");
  const {course, progress, states, moduleVersions, requirements} = await courseAndProgress(
   courseId, enrollmentVersion, access.enrollment.enrollment_id);
  const input = request.method === "POST" ? await request.json().catch(() => null) : null;
  if(url.searchParams.get("view")==="cycle" && request.method==="GET") return reply(200,await cycleRead(database,access.user.id,access.enrollment.enrollment_id),origin);
  if(input?.action==="cycle") {const result=await cycleWrite(database,access.user.id,access.enrollment.enrollment_id,input);return reply(result.status||200,result,origin);}
  if(course.contentModel!=="legacy_json" && (input?.action==="issue_certificate" || url.searchParams.get("view")==="completion")) return reply(409,{error:"future_academic_gate_not_implemented"},origin);
  if (url.searchParams.get("view") === "completion" || input?.action === "issue_certificate") {
   const completion = await completionState(access, courseId, course, progress, states);
   if (request.method === "GET" || completion.certificate)
    return reply(200, completion, origin);
   if (!completion.ready) return reply(423, {error: "completion_requirements_pending",
    requirements: completion.requirements}, origin);
   if (!validLearnerName(input.learner_name))
    return reply(400, {error: "learner_name_required"}, origin);
   let issued = await database("vc_university_certificates?on_conflict=enrollment_id", "", {
    method: "POST", headers: {Prefer: "resolution=ignore-duplicates,return=representation"},
    body: JSON.stringify({enrollment_id: access.enrollment.enrollment_id,
     learner_name_snapshot: input.learner_name.trim()})
   });
   if (!issued?.length) issued = await database("vc_university_certificates",
    "?select=certificate_id,public_code,issued_at,learner_name_snapshot&" +
     scoped(access.enrollment.enrollment_id) + "&limit=1");
   if (!issued?.[0]?.public_code) throw new Error("certificate_issue_failed");
   return reply(201, {ready: true, requirements: completion.requirements,
    certificate: issued[0]}, origin);
  }
  if(course.contentModel!=="legacy_json" && (url.searchParams.get("view")==="final"||input?.action==="final")) {
   const result=request.method==="GET"?await assessmentBegin(database,access.user.id,access.enrollment.enrollment_id,"final",null):await assessmentSubmit(database,access.user.id,access.enrollment.enrollment_id,input);
   return reply(result.status||200,result,origin);
  }
  if (url.searchParams.get("view") === "final" || input?.action === "final") {
   if (!states.length || !states.every(s => s.completed))
    return reply(423, {error: "modules_required"}, origin);
   const minimum = access.courseRecord.final_pass_percent;
   if (!Number.isInteger(minimum) || minimum < 1 || minimum > 100)
    throw new Error("final_config_unavailable");
   if (request.method === "GET") {
    const assessment = await finalAssessmentSession(access.enrollment.enrollment_id, courseId, course);
    return reply(200, {minimum, sessionId: assessment.sessionId, expiresAt: assessment.expiresAt,
     questions: assessment.questions.map(({correct_index: _answer, review_concept: _concept, ...q}) => q)}, origin);
   }
   if (typeof input.session_id !== "string" ||
       !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(input.session_id))
    return reply(400, {error: "assessment_session_invalid"}, origin);
   if (!Array.isArray(input.answers) || input.answers.length !== 20 ||
       !input.answers.every(a => Number.isInteger(a) && a >= 0 && a <= 3))
    return reply(400, {error: "answers_invalid"}, origin);
   const assessment = await sessionQuestions(input.session_id, access.enrollment.enrollment_id, courseId, course);
   if (!assessment) return reply(409, {error: "assessment_session_invalid"}, origin);
   const questions = assessment.questions;
   const score = questions.reduce((n, q, i) => n + (input.answers[i] === q.correct_index ? 1 : 0), 0);
   const review = [...new Set(questions.filter((q, i) => input.answers[i] !== q.correct_index).map(q => q.review_concept))];
   const stored = await database("rpc/vc_university_submit_final_attempt", "", {
    method: "POST", body: JSON.stringify({p_session_id: input.session_id,
     p_enrollment_id: access.enrollment.enrollment_id, p_course_id: courseId,
     p_course_version: course.version, p_score: score, p_review_concepts: review})
   });
   if (stored?.error === "attempt_limit")
    return reply(429, {error: "attempt_limit", review: "Revise os módulos e tente amanhã."}, origin);
   if (!stored?.attempt_id) return reply(409, {error: "assessment_session_invalid"}, origin);
   await recordEvent(access.enrollment.enrollment_id, access.user.id, "final_assessment_attempted", null,
    {course_id: courseId, course_version: course.version, score, total: 20,
     minimum_percent: minimum, passed: score * 5 >= minimum});
   return reply(200, {score, total: 20, passed: score * 5 >= minimum, review}, origin);
  }
  const moduleNo = Number(url.searchParams.get("module"));
  if (request.method === "GET" && !url.searchParams.has("module")) {
   const auditDetails = {course_id: courseId, course_version: course.version};
   await recordEventOnce(access.enrollment.enrollment_id, access.user.id, "course_started", null, auditDetails);
   if (states[0]?.unlocked)
    await recordEventOnce(access.enrollment.enrollment_id, access.user.id, "module_unlocked", states[0].number, auditDetails);
   const active = states.find(item => item.unlocked && !item.completed) ?? states.find(item => item.unlocked);
   return reply(200, {id: course.id, productId: access.courseRecord.product_id, title: course.title,
    subtitle: course.subtitle ?? course.metadata?.subtitle_snapshot ?? "", version: course.version,
    contentModel: course.contentModel, hours: course.hours, modules: states,
    nextStep: active ? {module:active.number,action:active.nextAction,requirement:active.nextRequirement} : null}, origin);
  }
  if (!Number.isSafeInteger(moduleNo) || moduleNo < 1 || moduleNo > course.modules.length)
   return reply(400, {error: "invalid_module"}, origin);
  const state = states.find(s => s.number === moduleNo);
  if (!state?.unlocked) return reply(423, {error: "previous_module_required"}, origin);
  const lesson = course.modules.find(m => m.number === moduleNo);
  const moduleVersion = moduleVersions.find(module => module.module_no === moduleNo);
  if (!moduleVersion) throw new Error("module_version_unavailable");
  if (url.searchParams.get("view") === "evidence" && request.method === "GET") {
   const evidence = await evidenceRead(database,courseId,enrollmentVersion,access.enrollment.enrollment_id,moduleNo);
   return reply(evidence.error?404:200,evidence,origin);
  }
  if (["evidence_draft","evidence_submit"].includes(input?.action)) {
   const evidence=await evidenceWrite(database,access.user.id,access.enrollment.enrollment_id,moduleVersion.module_version_id,input);
   return reply(evidence.status||200,evidence,origin);
  }
  if (request.method === "GET") {
   if (url.searchParams.get("view") === "checkpoint") {
    if(course.contentModel!=="legacy_json") return reply(200,await assessmentBegin(database,access.user.id,access.enrollment.enrollment_id,"checkpoint",moduleNo),origin);
    const questions = await checkpointQuestions(courseId, course, moduleNo);
    if (questions.length !== 5) return reply(503, {error: "checkpoint_unavailable"}, origin);
    const config = await checkpointConfiguration(courseId,course.version,moduleVersion.module_version_id,moduleNo);
    return reply(200, {minimum:config.minimum,passPercent:config.passPercent,
     questions: questions.map(({correct_index:_legacy,correct_option_id:_answer,correct_feedback:_feedback,
      review_concept:_concept,choices:_choices,...question}) => ({...question,
       options:question.options.map(option => ({id:option.option_id,text:option.option_text}))}))}, origin);
   }
   if(!state.completed){
    const now=new Date().toISOString();
    await database("vc_university_module_progress?on_conflict=enrollment_id,module_no", "", {
     method:"POST",headers:{Prefer:"resolution=merge-duplicates,return=minimal"},
     body:JSON.stringify({enrollment_id:access.enrollment.enrollment_id,course_id:courseId,module_no:moduleNo,
      module_version_id:moduleVersion.module_version_id,
      status:state.status==="not_started"?"in_progress":state.status,opened_at:now,started_at:now})
    });
   }
   if (course.contentModel === "structured_blocks") {
    const existing = await database("vc_university_lesson_progress", "?select=lesson_version_id,first_viewed_at,started_at,content_completed_at&" + scoped(access.enrollment.enrollment_id));
    for (const item of lesson.lessons) {
     const saved = existing.find(row => row.lesson_version_id === item.lesson_version_id);
     if (saved?.content_completed_at) continue;
     const now = new Date().toISOString();
     await database("vc_university_lesson_progress?on_conflict=enrollment_id,lesson_version_id", "", {
      method:"POST",headers:{Prefer:"resolution=merge-duplicates,return=minimal"},
      body:JSON.stringify({enrollment_id:access.enrollment.enrollment_id,lesson_version_id:item.lesson_version_id,
       status:"in_progress",first_viewed_at:saved?.first_viewed_at ?? now,started_at:saved?.started_at ?? now})
     });
    }
   }
   await recordEvent(access.enrollment.enrollment_id, access.user.id, "module_opened", moduleNo,
    {course_id: courseId, course_version: course.version});
   return reply(200, {lesson, moduleVersionId:moduleVersion.module_version_id,state,
    requirements:requirements.filter(item=>item.module_version_id===moduleVersion.module_version_id),
    progress: progress.find(p => p.module_no === moduleNo) ?? null}, origin);
  }
  if (input?.action === "content_complete") {
   const contentRequirement = requirements.find(requirement => requirement.module_version_id===moduleVersion.module_version_id &&
    requirement.requirement_type==="content_completed" && requirement.status==="published");
   if (course.contentModel==="structured_blocks" && (!Array.isArray(lesson?.lessons) || !lesson.lessons.length))
    return reply(409,{error:"content_unavailable"},origin);
   const now=new Date().toISOString();
   if (course.contentModel === "structured_blocks") {
    const viewed = await database("vc_university_lesson_progress", "?select=lesson_version_id,started_at&" + scoped(access.enrollment.enrollment_id));
    if (lesson.lessons.some(item => !viewed.some(row => row.lesson_version_id === item.lesson_version_id && row.started_at)))
     return reply(409,{error:"content_not_started"},origin);
    for (const item of lesson.lessons) await database("vc_university_lesson_progress",
     "?" + scoped(access.enrollment.enrollment_id) + "&lesson_version_id=eq." + item.lesson_version_id, {
      method:"PATCH",headers:{Prefer:"return=minimal"},
      body:JSON.stringify({status:"completed",content_completed_at:now})
     });
   }
   await database("vc_university_module_progress?on_conflict=enrollment_id,module_no","",{
    method:"POST",headers:{Prefer:"resolution=merge-duplicates,return=minimal"},
    body:JSON.stringify({enrollment_id:access.enrollment.enrollment_id,course_id:courseId,module_no:moduleNo,
     module_version_id:moduleVersion.module_version_id,status:"requirements_pending",opened_at:now,started_at:now,
     content_completed_at:now})
   });
   if (contentRequirement) await database("vc_university_requirement_progress?on_conflict=enrollment_id,requirement_id","",{
    method:"POST",headers:{Prefer:"resolution=merge-duplicates,return=minimal"},
    body:JSON.stringify({enrollment_id:access.enrollment.enrollment_id,requirement_id:contentRequirement.requirement_id,
     status:"completed",source_type:"content",source_id:moduleVersion.module_version_id,satisfied_at:now})
   });
   const completion = await database("rpc/vc_university_complete_module_if_ready","",{method:"POST",
    body:JSON.stringify({p_enrollment_id:access.enrollment.enrollment_id,p_module_version_id:moduleVersion.module_version_id})});
   return reply(200,{contentCompleted:true,moduleCompleted:completion?.completed === true,nextAction:state.nextAction},origin);
  }
  if (input?.action === "evidence") {
   if(course.contentModel!=="legacy_json")return reply(400,{error:"structured_evidence_required"},origin);
   const evidence = input.evidence;
   if (typeof evidence !== "string" || evidence.trim().length < 20 || evidence.length > 12000)
    return reply(400, {error: "evidence_invalid"}, origin);
   if (state.completed) return reply(409, {error: "module_already_completed"}, origin);
   const result = await database("vc_university_module_progress?on_conflict=enrollment_id,module_no", "", {
    method: "POST", headers: {Prefer: "resolution=merge-duplicates,return=representation"},
    body: JSON.stringify({enrollment_id: access.enrollment.enrollment_id, course_id: courseId,
     module_no: moduleNo,module_version_id:moduleVersion.module_version_id,status:"requirements_pending",
     started_at:new Date().toISOString(),evidence: evidence.trim(), submitted_at: new Date().toISOString()})
   });
   const evidenceRequirement=requirements.find(requirement=>requirement.module_version_id===moduleVersion.module_version_id &&
    requirement.requirement_type==="evidence_completed" && requirement.status==="published");
   if(evidenceRequirement) await database("vc_university_requirement_progress?on_conflict=enrollment_id,requirement_id","",{
    method:"POST",headers:{Prefer:"resolution=merge-duplicates,return=minimal"},
    body:JSON.stringify({enrollment_id:access.enrollment.enrollment_id,requirement_id:evidenceRequirement.requirement_id,
     status:"completed",source_type:"evidence",source_id:access.enrollment.enrollment_id+":"+moduleNo,
     satisfied_at:new Date().toISOString()})
   });
   await recordEvent(access.enrollment.enrollment_id, access.user.id, "evidence_submitted", moduleNo,
    {course_id: courseId, course_version: course.version, evidence_chars: evidence.trim().length});
   return reply(200, {submitted: !!result?.length}, origin);
  }
  if (input?.action === "checkpoint") {
   if(course.contentModel!=="legacy_json") {const result=await assessmentSubmit(database,access.user.id,access.enrollment.enrollment_id,input);return reply(result.status||200,result,origin);}
   const submitted = progress.find(p => p.module_no === moduleNo);
   const evidenceRequired = course.contentModel === "legacy_json" || requirements.some(requirement =>
    requirement.module_version_id === moduleVersion.module_version_id && requirement.requirement_type === "evidence_completed" && requirement.required);
   const canonicalProgress=course.contentModel!=="legacy_json" && evidenceRequired ? await database("vc_university_requirement_progress","?select=requirement_id,status,satisfied_at,source_id&enrollment_id=eq."+access.enrollment.enrollment_id) : [];
   const evidenceReady=course.contentModel==="legacy_json" ? !!(submitted?.evidence?.trim() && submitted.submitted_at) : requirements.filter(r=>r.module_version_id===moduleVersion.module_version_id && r.requirement_type==="evidence_completed" && r.required && r.status==="published").every(r=>canonicalProgress.some(p=>p.requirement_id===r.requirement_id && p.status==="completed" && p.satisfied_at));
   if (evidenceRequired && !evidenceReady)
    return reply(409, {error: "evidence_required"}, origin);
   const questions = await checkpointQuestions(courseId, course, moduleNo);
   if (questions.length !== 5) return reply(503, {error: "checkpoint_unavailable"}, origin);
   const config = await checkpointConfiguration(courseId,course.version,moduleVersion.module_version_id,moduleNo);
   if (!Array.isArray(input.answers) || input.answers.length !== 5)
    return reply(400, {error: "answers_invalid"}, origin);
   const attempts = await database("vc_university_checkpoint_attempts",
    "?select=attempt_id&" + scoped(access.enrollment.enrollment_id)
     + "&module_no=eq." + moduleNo + "&submitted_at=gte." + new Date(Date.now()-86400000).toISOString());
   if (attempts.length >= 3) return reply(429, {error: "attempt_limit", review: "Revise o módulo e tente amanhã."}, origin);
   let grade;
   const stableAnswers=input.answers.every(answer=>typeof answer==="string");
   if(stableAnswers){
    try{grade=gradeStableCheckpoint(questions,input.answers,config.passPercent)}catch{
     return reply(400,{error:"answers_invalid"},origin);
    }
   }else{
    // Adaptador exclusivo para clientes v1.1 já publicados; conteúdo novo usa option_id.
    if(course.contentModel !== "legacy_json" || !input.answers.every(answer=>Number.isInteger(answer)&&answer>=0&&answer<=3))
     return reply(400,{error:"answers_invalid"},origin);
    const score=questions.reduce((total,question,index)=>total+(input.answers[index]===question.correct_index?1:0),0);
    grade={score,total:questions.length,scorePercent:score*20,passed:score*20>=config.passPercent,
     details:questions.map((question,index)=>({question_id:question.question_id,
      selected_option_id:question.options[input.answers[index]]?.option_id,correct:input.answers[index]===question.correct_index,
      feedback:input.answers[index]===question.correct_index?(question.correct_feedback??"Resposta correta."):
       (question.options[input.answers[index]]?.feedback??`Revise: ${question.review_concept}`)}))};
   }
   const review=[...new Set(grade.details.filter(detail=>!detail.correct).map(detail=>detail.feedback))];
   const storedAttempt = await database("vc_university_checkpoint_attempts", "", {
    method: "POST", headers: {Prefer: "return=representation"},
    body: JSON.stringify({enrollment_id: access.enrollment.enrollment_id, course_id: courseId,
     course_version:course.version,module_no: moduleNo,module_version_id:moduleVersion.module_version_id,
     score:grade.score,score_percent:grade.scorePercent,passed:grade.passed,
     question_snapshot:checkpointSnapshot(questions),answers:grade.details.map(detail=>({question_id:detail.question_id,
      selected_option_id:detail.selected_option_id})),feedback:grade.details,review_concepts: review})
   });
   await recordEvent(access.enrollment.enrollment_id, access.user.id, "checkpoint_attempted", moduleNo,
    {course_id: courseId, course_version: course.version, score:grade.score,total:grade.total,
     minimum_percent:config.passPercent,passed:grade.passed});
   if (grade.passed) {
    const now=new Date().toISOString();
    if(config.requirementId) await database("vc_university_requirement_progress?on_conflict=enrollment_id,requirement_id","",{
     method:"POST",headers:{Prefer:"resolution=merge-duplicates,return=minimal"},
     body:JSON.stringify({enrollment_id:access.enrollment.enrollment_id,requirement_id:config.requirementId,
      status:"completed",source_type:"checkpoint_attempt",source_id:storedAttempt?.[0]?.attempt_id ?? moduleVersion.module_version_id,satisfied_at:now})
    });
    await database("vc_university_module_progress?on_conflict=enrollment_id,module_no","",{
     method:"POST",headers:{Prefer:"resolution=merge-duplicates,return=minimal"},
     body:JSON.stringify({enrollment_id:access.enrollment.enrollment_id,course_id:courseId,module_no:moduleNo,
      module_version_id:moduleVersion.module_version_id,status:"requirements_pending",started_at:now,
      ...(submitted?.evidence ? {evidence:submitted.evidence,submitted_at:submitted.submitted_at} : {}),checkpoint_passed_at:now})
    });
    const completion=await database("rpc/vc_university_complete_module_if_ready","",{method:"POST",
     body:JSON.stringify({p_enrollment_id:access.enrollment.enrollment_id,p_module_version_id:moduleVersion.module_version_id})});
    if(completion?.completed){
     await recordEventOnce(access.enrollment.enrollment_id, access.user.id, "module_completed", moduleNo,
      {course_id: courseId, course_version: course.version});
     const nextState=states.find(item=>item.number>moduleNo);
     if(nextState) await recordEventOnce(access.enrollment.enrollment_id,access.user.id,"module_unlocked",nextState.number,
      {course_id:courseId,course_version:course.version,unlocked_by_module:moduleNo});
    }
   }
   return reply(200, {score:grade.score,total:grade.total,scorePercent:grade.scorePercent,
    passed:grade.passed,review,feedback:grade.details.map(detail=>({questionId:detail.question_id,
     correct:detail.correct,message:detail.feedback}))}, origin);
  }
  return reply(400, {error: "unknown_action"}, origin);
 } catch (error) {
  if(error instanceof Error && ["assessment_context_denied","assessment_session_invalid","assessment_bank_unavailable","assessment_config_unavailable","module_locked","modules_required","answers_invalid","evidence_required"].includes(error.message))return reply(["module_locked","modules_required"].includes(error.message)?423:error.message==="answers_invalid"?400:409,{error:error.message},origin);
  if(error instanceof Error && (error.message.startsWith("cycle_") || ["draft_version_conflict","idempotency_payload_conflict","weekly_review_not_due","weekly_review_immutable","weekly_reviews_pending","final_reflection_pending","selected_logs_invalid","required_applications_pending","integrator_size_limit","pedagogical_review_required","goal_change_limit_reached"].includes(error.message)))return reply(409,{error:error.message},origin);
  console.error("University learner API failed", error instanceof Error ? error.message : "unknown");
  return reply(503, {error: "service_unavailable"}, origin);
 }
});
