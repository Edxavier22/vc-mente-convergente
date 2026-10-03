// Private academic API. Versioned lesson content is read server-side from a restricted table.
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
 if (!response.ok) throw new Error("database_error:" + response.status);
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
function moduleState(modules, rows) {
 const completed = new Set(rows.filter(r => r.completed_at).map(r => r.module_no));
 return modules.map((m, index) => ({
  number: m.number, title: m.title, unlocked: index === 0 || completed.has(modules[index - 1].number),
  completed: completed.has(m.number), submitted: !!rows.find(r => r.module_no === m.number)?.submitted_at
 }));
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
async function courseAndProgress(courseId, version, enrollmentId) {
 const source = await database("vc_university_course_content",
  "?select=content&course_id=eq." + encodeURIComponent(courseId) + "&course_version=eq." + encodeURIComponent(version) + "&limit=1");
 const course = source[0]?.content;
 if (course?.id !== courseId || course.version !== version || !Array.isArray(course.modules))
  throw new Error("course_content_unavailable");
 const progress = await database("vc_university_module_progress",
  "?select=module_no,evidence,submitted_at,checkpoint_passed_at,completed_at,review_status,review_feedback&"
   + scoped(enrollmentId) + "&order=module_no.asc");
 return {course, progress, states: moduleState(course.modules, progress)};
}
async function checkpointQuestions(courseId, course, moduleNo) {
 return database("vc_university_questions",
  "?select=question_id,prompt,choices,correct_index,review_concept,kind"
   + "&course_id=eq." + encodeURIComponent(courseId) + "&course_version=eq." + encodeURIComponent(course.version)
   + "&purpose=eq.checkpoint&module_no=eq." + moduleNo + "&active=eq.true"
   + "&order=kind.asc,question_id.asc&limit=5");
}
async function checkpointMinimum(courseId, moduleNo) {
 const modules = await database("vc_university_modules",
  "?select=checkpoint_pass_count&course_id=eq." + encodeURIComponent(courseId) + "&module_no=eq." + moduleNo + "&limit=1");
 const minimum = modules[0]?.checkpoint_pass_count;
 if (!Number.isInteger(minimum) || minimum < 1 || minimum > 5) throw new Error("checkpoint_config_unavailable");
 return minimum;
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
  const access = await context(bearer, courseId);
  if (access.error) return reply(access.error, {error: access.code ?? "access_denied"}, origin);
  const enrollmentVersion = access.enrollment.course_version;
  if (typeof enrollmentVersion !== "string" || !enrollmentVersion)
   throw new Error("enrollment_version_unavailable");
  const {course, progress, states} = await courseAndProgress(courseId, enrollmentVersion, access.enrollment.enrollment_id);
  const input = request.method === "POST" ? await request.json().catch(() => null) : null;
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
   return reply(200, {id: course.id, productId: access.courseRecord.product_id, title: course.title,
    version: course.version, hours: course.hours, modules: states}, origin);
  }
  if (!Number.isSafeInteger(moduleNo) || moduleNo < 1 || moduleNo > course.modules.length)
   return reply(400, {error: "invalid_module"}, origin);
  const state = states.find(s => s.number === moduleNo);
  if (!state?.unlocked) return reply(423, {error: "previous_module_required"}, origin);
  const lesson = course.modules.find(m => m.number === moduleNo);
  if (request.method === "GET") {
   if (url.searchParams.get("view") === "checkpoint") {
    const questions = await checkpointQuestions(courseId, course, moduleNo);
    if (questions.length !== 5) return reply(503, {error: "checkpoint_unavailable"}, origin);
    const minimum = await checkpointMinimum(courseId, moduleNo);
    return reply(200, {minimum, questions: questions.map(({correct_index: _answer, review_concept: _concept, ...q}) => q)}, origin);
   }
   await recordEvent(access.enrollment.enrollment_id, access.user.id, "module_opened", moduleNo,
    {course_id: courseId, course_version: course.version});
   return reply(200, {lesson, progress: progress.find(p => p.module_no === moduleNo) ?? null}, origin);
  }
  if (input?.action === "evidence") {
   const evidence = input.evidence;
   if (typeof evidence !== "string" || evidence.trim().length < 20 || evidence.length > 12000)
    return reply(400, {error: "evidence_invalid"}, origin);
   if (state.completed) return reply(409, {error: "module_already_completed"}, origin);
   const result = await database("vc_university_module_progress?on_conflict=enrollment_id,module_no", "", {
    method: "POST", headers: {Prefer: "resolution=merge-duplicates,return=representation"},
    body: JSON.stringify({enrollment_id: access.enrollment.enrollment_id, course_id: courseId,
     module_no: moduleNo, evidence: evidence.trim(), submitted_at: new Date().toISOString()})
   });
   await recordEvent(access.enrollment.enrollment_id, access.user.id, "evidence_submitted", moduleNo,
    {course_id: courseId, course_version: course.version, evidence_chars: evidence.trim().length});
   return reply(200, {submitted: !!result?.length}, origin);
  }
  if (input?.action === "checkpoint") {
   const submitted = progress.find(p => p.module_no === moduleNo);
   if (!submitted?.evidence?.trim() || !submitted.submitted_at)
    return reply(409, {error: "evidence_required"}, origin);
   const questions = await checkpointQuestions(courseId, course, moduleNo);
   if (questions.length !== 5) return reply(503, {error: "checkpoint_unavailable"}, origin);
   const minimum = await checkpointMinimum(courseId, moduleNo);
   if (!Array.isArray(input.answers) || input.answers.length !== 5 ||
     !input.answers.every(a => Number.isInteger(a) && a >= 0 && a <= 3))
    return reply(400, {error: "answers_invalid"}, origin);
   const attempts = await database("vc_university_checkpoint_attempts",
    "?select=attempt_id&" + scoped(access.enrollment.enrollment_id)
     + "&module_no=eq." + moduleNo + "&submitted_at=gte." + new Date(Date.now()-86400000).toISOString());
   if (attempts.length >= 3) return reply(429, {error: "attempt_limit", review: "Revise o módulo e tente amanhã."}, origin);
   const score = questions.reduce((n, q, i) => n + (input.answers[i] === q.correct_index ? 1 : 0), 0);
   const review = [...new Set(questions.filter((q, i) => input.answers[i] !== q.correct_index).map(q => q.review_concept))];
   await database("vc_university_checkpoint_attempts", "", {
    method: "POST", headers: {Prefer: "return=minimal"},
    body: JSON.stringify({enrollment_id: access.enrollment.enrollment_id, course_id: courseId,
     module_no: moduleNo, score, review_concepts: review})
   });
   await recordEvent(access.enrollment.enrollment_id, access.user.id, "checkpoint_attempted", moduleNo,
    {course_id: courseId, course_version: course.version, score, total: 5, minimum, passed: score >= minimum});
   if (score >= minimum) {
    // The trigger additionally verifies prior modules, a stored passing attempt and evidence.
    await database("vc_university_module_progress?on_conflict=enrollment_id,module_no", "", {
     method: "POST", headers: {Prefer: "resolution=merge-duplicates,return=minimal"},
     body: JSON.stringify({enrollment_id: access.enrollment.enrollment_id, course_id: courseId,
      module_no: moduleNo, evidence: submitted.evidence, submitted_at: submitted.submitted_at,
      checkpoint_passed_at: new Date().toISOString(), completed_at: new Date().toISOString()})
    });
    await recordEventOnce(access.enrollment.enrollment_id, access.user.id, "module_completed", moduleNo,
     {course_id: courseId, course_version: course.version});
    const nextModule = course.modules.find(m => m.number === moduleNo + 1);
    if (nextModule)
     await recordEventOnce(access.enrollment.enrollment_id, access.user.id, "module_unlocked", nextModule.number,
      {course_id: courseId, course_version: course.version, unlocked_by_module: moduleNo});
   }
   return reply(200, {score, total: 5, passed: score >= minimum, review}, origin);
  }
  return reply(400, {error: "unknown_action"}, origin);
 } catch (error) {
  console.error("University learner API failed", error instanceof Error ? error.message : "unknown");
  return reply(503, {error: "service_unavailable"}, origin);
 }
});
