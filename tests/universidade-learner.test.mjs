import test from "node:test";
import assert from "node:assert/strict";

let handler;
globalThis.Deno = {
 env: {get: key => key === "SUPABASE_SERVICE_ROLE_KEY" ? "test-secret" : undefined},
 serve: callback => { handler = callback; }
};
await import("../supabase/functions/vc-universidade-learner-v2/index.ts");

const lesson = number => ({number, title: `Módulo ${number}`, study: [`Estudo ${number}`]});
let progress = [];
let databaseWrites = 0;
let attemptWrites = 0;
let finalWrites = 0;
let eventWrites = [];
let finalAttempts = [];
let certificates = [];
let certificateWrites = 0;
let finalSession = null;
const finalSessionId = "11111111-1111-4111-8111-111111111111";
let allowed = true;
let rightsProducts = ["P-021"];
let enrolled = true;
let sourceAvailable = true;
let enrollmentVersion = "1.0";
let contentReads = 0;
let identity = {id: "u-1"};
let isAdmin = false;
let structuredMode = false;
let structuredStatus = "published";
let lessonProgress = [];
let lessonWrites = 0;
globalThis.fetch = async (input, options = {}) => {
 const url = new URL(input);
 if (url.pathname === "/auth/v1/user") return Response.json(identity);
 if (url.pathname.endsWith("/v1/admin/scope")) return Response.json({data: {platform_admin: isAdmin}});
 if (url.pathname.includes("/vc-core-private-api/")) return Response.json({data: {accesses: allowed ? rightsProducts.map(product_id => ({product_id})) : []}});
 if(url.pathname.endsWith("/vc_university_evidence_definitions")||url.pathname.endsWith("/vc_university_evidence_definition_versions"))return Response.json([]);
 const secondCourse = url.searchParams.get("course_id") === "eq.inteligencia-emocional";
 if (url.pathname.endsWith("/vc_university_courses")) return Response.json(
  secondCourse ? [{course_id: "inteligencia-emocional", product_id: "P-022", title: "Inteligência Emocional", version: "1.0", modality: "online", hours_minutes: 1200, final_pass_percent: 70, certificate_requires_project_review: false}]
   : url.searchParams.get("course_id") === "eq.lideranca-estrategica-aplicada"
    ? [{course_id: "lideranca-estrategica-aplicada", product_id: "P-021", title: "Liderança Estratégica Aplicada", version: "1.0", modality: "online", hours_minutes: 1200, final_pass_percent: 70, certificate_requires_project_review: true}] : []);
 if (url.pathname.endsWith("/vc_university_course_versions")) return Response.json([{
  course_id: secondCourse ? "inteligencia-emocional" : "lideranca-estrategica-aplicada",version:"1.0",
  title_snapshot:secondCourse?"Inteligência Emocional":"Liderança",subtitle_snapshot:"",institution_snapshot:"Universidade V&C",
  school_snapshot:"",language_code:"pt-BR",modality_snapshot:"online",hours_minutes:1200,content_model:structuredMode?"structured_blocks":"legacy_json",status:structuredMode?structuredStatus:"published"
 }]);
 if (url.pathname.endsWith("/vc_university_course_content")) {contentReads++; return Response.json(sourceAvailable ? [{content: {
  id: secondCourse ? "inteligencia-emocional" : "lideranca-estrategica-aplicada", version: "1.0", title: "Liderança",
  modules: [lesson(1), lesson(2)]
 }}] : []);}
 if (url.pathname.endsWith("/vc_university_enrollments"))
  return Response.json(enrolled ? [{enrollment_id: "e-1", course_id: secondCourse ? "inteligencia-emocional" : "lideranca-estrategica-aplicada", course_version: enrollmentVersion, status: "active", cohort_id: "c-1"}] : []);
 if (url.pathname.endsWith("/vc_university_lesson_versions")) return Response.json([{lesson_version_id:"lv-1",title:"Fixture técnica",learning_objectives:["Verificar entrega"],status:"published"}]);
 if (url.pathname.endsWith("/vc_university_content_blocks")) return Response.json([{content_block_id:"b-1",block_type:"paragraph",position:1,content:{text:"Fixture técnica sem conteúdo oficial"},status:"published"}]);
 if (url.pathname.endsWith("/vc_university_lesson_progress")) {
  if(options.method==="POST"){lessonWrites++;lessonProgress=[JSON.parse(options.body)];return new Response(null,{status:201})}
  if(options.method==="PATCH"){lessonWrites++;lessonProgress=lessonProgress.map(row=>({...row,...JSON.parse(options.body)}));return new Response(null,{status:204})}
  return Response.json(lessonProgress);
 }
 if (url.pathname.endsWith("/vc_university_modules")) return Response.json([{checkpoint_pass_count: 4}]);
 if (url.pathname.endsWith("/vc_university_module_versions")) return Response.json([
  {module_version_id:"mv-1",module_no:1,title:"Módulo 1"},{module_version_id:"mv-2",module_no:2,title:"Módulo 2"}
 ]);
 if (url.pathname.endsWith("/vc_university_module_requirements")) {
  const moduleId=url.searchParams.get("module_version_id")?.replace("eq.","");
  const all=[1,2].flatMap(number=>[
   {requirement_id:`r-e-${number}`,module_version_id:`mv-${number}`,requirement_key:"evidence",requirement_type:"evidence_completed",required:true,position:1,status:"published",configuration:{}},
   {requirement_id:`r-c-${number}`,module_version_id:`mv-${number}`,requirement_key:"checkpoint",requirement_type:"checkpoint_passed",required:true,position:2,status:"published",configuration:{question_count:5,minimum_correct:4,pass_percent:80}}
  ]);
  return Response.json(moduleId?all.filter(item=>item.module_version_id===moduleId&&item.requirement_type==="checkpoint_passed"):all);
 }
 if (url.pathname.endsWith("/vc_university_module_dependencies")) return Response.json([
  {module_version_id:"mv-2",depends_on_module_version_id:"mv-1",status:"published"}
 ]);
 if (url.pathname.endsWith("/vc_university_requirement_progress")) {
  if(options.method==="POST") return new Response(null,{status:201});
  return Response.json(progress.flatMap(item=>[
   ...(item.submitted_at?[{requirement_id:`r-e-${item.module_no}`,status:"completed",satisfied_at:item.submitted_at}]:[]),
   ...(item.checkpoint_passed_at?[{requirement_id:`r-c-${item.module_no}`,status:"completed",satisfied_at:item.checkpoint_passed_at}]:[])
  ]));
 }
 if (url.pathname.endsWith("/vc_university_module_progress")) {
  if (options.method === "POST") {databaseWrites++; return Response.json([{enrollment_id: "e-1"}]);}
  return Response.json(progress.map(item=>({...item,module_version_id:`mv-${item.module_no}`})));
 }
 if (url.pathname.endsWith("/vc_university_questions")) return Response.json(
  Array.from({length: url.searchParams.get("purpose") === "eq.final" ? 30 : 5}, (_, i) => ({question_id: `q-${i}`,question_key:`qk-${i}`,question_version:1,prompt: "Qual decisão?", choices: ["A","B","C","D"],
   correct_index: 2,correct_option_id:`q-${i}-o-2`,correct_feedback:"Boa decisão.",review_concept: "Revisar diagnóstico", kind: url.searchParams.get("purpose") === "eq.final"
    ? ["concept","application","case","decision"][i % 4] : "concept"}))
 );
 if (url.pathname.endsWith("/vc_university_question_options")) {
  const questionId=url.searchParams.get("question_id")?.replace("eq.","");
  return Response.json(["A","B","C","D"].map((option_text,option_order)=>({option_id:`${questionId}-o-${option_order}`,option_order,option_text,feedback:option_order===2?"Boa decisão.":"Revisar diagnóstico"})));
 }
 if (url.pathname.endsWith("/vc_university_final_sessions")) {
  if (options.method === "POST") {
   const body = JSON.parse(options.body);
   finalSession = {session_id: finalSessionId, question_ids: body.question_ids, expires_at: body.expires_at};
   return Response.json([finalSession], {status: 201});
  }
  return Response.json(finalSession ? [finalSession] : []);
 }
 if (url.pathname.endsWith("/rpc/vc_university_submit_final_attempt")) {
  if (finalAttempts.length >= 3) return Response.json({error: "attempt_limit"});
  finalWrites++;
  finalSession = null;
  return Response.json({attempt_id: `attempt-${finalWrites}`});
 }
 if (url.pathname.endsWith("/rpc/vc_university_complete_module_if_ready")) return Response.json({completed:true});
 if (url.pathname.endsWith("/vc_university_final_attempts")) {
  if (options.method === "POST") {finalWrites++; return new Response(null, {status: 201});}
  return Response.json(finalAttempts);
 }
 if (url.pathname.endsWith("/vc_university_certificates")) {
  if (options.method === "POST") {
   certificateWrites++;
   const issued = {certificate_id: "cert-1", public_code: "VC-LEA-2026-000001", issued_at: "2026-09-29T00:00:00Z",
    learner_name_snapshot: JSON.parse(options.body).learner_name_snapshot};
   certificates = [issued];
   return Response.json([issued], {status: 201});
  }
  return Response.json(certificates);
 }
 if (url.pathname.endsWith("/vc_university_checkpoint_attempts")) {
  if (options.method === "POST") {attemptWrites++; return Response.json([{attempt_id:"attempt-stable"}], {status: 201});}
  return Response.json([]);
 }
 if (url.pathname.endsWith("/vc_university_events")) {
  if (options.method === "POST") {
   eventWrites.push(JSON.parse(options.body));
   return new Response(null, {status: 201});
  }
  return Response.json([]);
 }
 throw new Error("unexpected request: " + url.pathname);
};
const request = (path, method = "GET", body, auth = true) => new Request("https://example.invalid/" + path, {
 method, headers: auth ? {authorization: "Bearer " + "x".repeat(50), "content-type": "application/json"} : {},
 body: body ? JSON.stringify(body) : undefined
});
test("sem credencial não consulta matrícula", async () => {
 const response = await handler(request("", "GET", null, false));
 assert.equal(response.status, 401);
});
test("previews da branch e do deployment recebem CORS e outra origem não", async () => {
 const previews = [
  "https://vc-mente-convergente-git-feature-universidade-f893e0-life-os22.vercel.app",
  "https://vc-mente-convergente-8r9z25ecx-life-os22.vercel.app"
 ];
 for (const preview of previews) {
  const allowed = await handler(new Request("https://example.invalid/", {headers: {origin: preview}}));
  assert.equal(allowed.headers.get("access-control-allow-origin"), preview);
 }
 const rejected = await handler(new Request("https://example.invalid/", {headers: {origin: "https://outra-origem.vercel.app"}}));
 assert.notEqual(rejected.headers.get("access-control-allow-origin"), "https://outra-origem.vercel.app");
});
test("fonte privada ausente não revela o conteúdo", async () => {
 sourceAvailable = false;
 assert.equal((await handler(request("?module=1"))).status, 503);
 sourceAvailable = true;
});
test("direito revogado e matrícula ausente não entregam conteúdo", async () => {
 allowed = false;
 assert.equal((await handler(request("?module=1"))).status, 403);
 allowed = true; enrolled = false;
 assert.equal((await handler(request("?module=1"))).status, 409);
 enrolled = true;
});
test("curso adicional exige produto e matrícula correspondentes", async () => {
 contentReads = 0;
 assert.equal((await handler(request("?course=inteligencia-emocional&module=1"))).status, 403);
 assert.equal(contentReads, 0);
 rightsProducts = ["P-022"];
 enrolled = false;
 assert.equal((await handler(request("?course=inteligencia-emocional&module=1"))).status, 409);
 assert.equal(contentReads, 0);
 enrolled = true;
 const response = await handler(request("?course=inteligencia-emocional&module=1"));
 assert.equal(response.status, 200);
 assert.equal((await response.json()).lesson.number, 1);
 rightsProducts = ["P-021"];
});
test("identificador inválido e curso desconhecido não consultam o conteúdo", async () => {
 contentReads = 0;
 assert.equal((await handler(request("?course=../lideranca"))).status, 400);
 assert.equal((await handler(request("?course=nao-existe"))).status, 404);
 assert.equal(contentReads, 0);
});
test("exceção proprietária exige ID, e-mail confirmado, administração e matrícula", async () => {
 allowed = false;
 isAdmin = true;
 identity = {id: "70aa4d75-bbb9-4839-aad8-670b7654664d", email: "vcmenteconvergente@gmail.com", email_confirmed_at: "2026-09-19T00:00:00Z"};
 assert.equal((await handler(request("?module=1"))).status, 200);
 enrolled = false;
 assert.equal((await handler(request("?module=1"))).status, 409);
 enrolled = true;
 isAdmin = false;
 assert.equal((await handler(request("?module=1"))).status, 403);
 isAdmin = true;
 identity = {...identity, email: "outro@example.com"};
 assert.equal((await handler(request("?module=1"))).status, 403);
 identity = {id: "u-1"};
 allowed = true;
 isAdmin = false;
});
test("M2 exige a conclusão persistida de M1 e não recebe conteúdo", async () => {
 progress = [];
 const response = await handler(request("?module=2"));
 assert.equal(response.status, 423);
 assert.deepEqual(await response.json(), {error: "previous_module_required"});
});
test("matrícula fixa a versão acadêmica usada para buscar conteúdo e questões", async () => {
 enrollmentVersion = "1.0";
 const response = await handler(request("?module=1"));
 assert.equal(response.status, 200);
 enrollmentVersion = "";
 assert.equal((await handler(request("?module=1"))).status, 503);
 enrollmentVersion = "1.0";
});
test("índice indica bloqueio e módulo liberado devolve somente sua aula", async () => {
 progress = []; eventWrites = [];
 const index = await (await handler(request(""))).json();
 assert.deepEqual(index.modules.map(m => m.unlocked), [true, false]);
 assert.deepEqual(eventWrites.map(event => event.event_type), ["course_started", "module_unlocked"]);
 const first = await (await handler(request("?module=1"))).json();
 assert.equal(first.lesson.number, 1);
 assert.equal(first.lesson.study[0], "Estudo 1");
 assert.equal(JSON.stringify(first).includes("Estudo 2"), false);
 assert.equal(eventWrites.at(-1).event_type, "module_opened");
});
test("checkpoint não expõe o gabarito e não aceita evidência vazia", async () => {
 progress = [];
 const response = await handler(request("?module=1&view=checkpoint"));
 const data = await response.json();
 assert.equal(data.questions.length, 5);
 assert.equal(data.minimum, 4);
 assert.equal(JSON.stringify(data).includes("correct_index"), false);
 assert.equal(JSON.stringify(data).includes("review_concept"), false);
 databaseWrites = 0;
 const invalid = await handler(request("?module=1", "POST", {action: "evidence", evidence: " "}));
 assert.equal(invalid.status, 400);
 assert.equal(databaseWrites, 0);
});
test("evidência válida registra auditoria sem armazenar seu conteúdo no evento", async () => {
 progress = []; databaseWrites = 0; eventWrites = [];
 const evidence = "Diagnóstico com fato, frequência, fonte e hipótese separados.";
 const response = await handler(request("?module=1", "POST", {action: "evidence", evidence}));
 assert.equal(response.status, 200);
 assert.equal(databaseWrites, 1);
 assert.equal(eventWrites.length, 1);
 assert.equal(eventWrites[0].event_type, "evidence_submitted");
 assert.equal(eventWrites[0].details.evidence_chars, evidence.length);
 assert.equal(JSON.stringify(eventWrites[0]).includes(evidence), false);
});
test("conclusão oficial de M1 libera M2", async () => {
 progress = [{module_no: 1, evidence: "Evidência de diagnóstico registrada", submitted_at: "2026-09-19T00:00:00Z",
  checkpoint_passed_at: "2026-09-19T00:01:00Z", completed_at: "2026-09-19T00:02:00Z"}];
 const response = await handler(request("?module=2"));
 assert.equal(response.status, 200);
 assert.equal((await response.json()).lesson.number, 2);
});
test("checkpoint exige evidência antes de consumir tentativa e concluir", async () => {
 progress = []; databaseWrites = 0; attemptWrites = 0; eventWrites = [];
 const payload = {action: "checkpoint", answers: [2,2,2,2,2]};
 const withoutEvidence = await handler(request("?module=1", "POST", payload));
 assert.equal(withoutEvidence.status, 409);
 assert.equal((await withoutEvidence.json()).error, "evidence_required");
 assert.equal(attemptWrites, 0);
 assert.equal(databaseWrites, 0);
 progress = [{module_no: 1, evidence: "Diagnóstico escrito com fonte e período", submitted_at: "2026-09-19T00:00:00Z"}];
 const withEvidence = await handler(request("?module=1", "POST", payload));
 assert.equal(withEvidence.status, 200);
 assert.equal((await withEvidence.json()).passed, true);
 assert.equal(attemptWrites, 1);
 assert.equal(databaseWrites, 1);
 assert.deepEqual(eventWrites.map(event => event.event_type),
  ["checkpoint_attempted", "module_completed", "module_unlocked"]);
 assert.equal(JSON.stringify(eventWrites).includes("answers"), false);
 assert.equal(JSON.stringify(eventWrites).includes("evidence"), false);
});
test("avaliação final permanece bloqueada até todos os módulos", async () => {
 progress = [{module_no: 1, completed_at: "2026-09-19T00:00:00Z"}]; finalWrites = 0;
 assert.equal((await handler(request("?view=final"))).status, 423);
 assert.equal((await handler(request("", "POST", {action: "final", answers: Array(20).fill(2)}))).status, 423);
 assert.equal(finalWrites, 0);
});
test("avaliação corrige no servidor, oculta gabarito e registra tentativas", async () => {
 progress = [1,2].map(module_no => ({module_no, completed_at: "2026-09-19T00:00:00Z"}));
 finalAttempts = []; finalWrites = 0; finalSession = null; eventWrites = [];
 const view = await handler(request("?view=final"));
 assert.equal(view.status, 200);
 const data = await view.json();
 assert.equal(data.questions.length, 20);
 assert.equal(data.minimum, 70);
 assert.equal(data.sessionId, finalSessionId);
 assert.deepEqual(Object.fromEntries(["concept","application","case","decision"].map(kind =>
  [kind, data.questions.filter(question => question.kind === kind).length])),
  {concept: 5, application: 5, case: 5, decision: 5});
 assert.equal(JSON.stringify(data).includes("correct_index"), false);
 assert.equal(JSON.stringify(data).includes("review_concept"), false);
 assert.equal((await handler(request("", "POST", {action: "final", session_id: data.sessionId, answers: Array(19).fill(2)}))).status, 400);
 assert.equal(finalWrites, 0);
 const low = await (await handler(request("", "POST", {action: "final", session_id: data.sessionId, answers: Array(20).fill(1)}))).json();
 assert.equal(low.passed, false);
 assert.deepEqual(low.review, ["Revisar diagnóstico"]);
 const retry = await (await handler(request("?view=final"))).json();
 const high = await (await handler(request("", "POST", {action: "final", session_id: retry.sessionId,
  answers: [...Array(14).fill(2),...Array(6).fill(1)]}))).json();
 assert.equal(high.score, 14);
 assert.equal(high.passed, true);
 assert.equal(finalWrites, 2);
 assert.deepEqual(eventWrites.map(event => event.event_type),
  ["final_assessment_attempted", "final_assessment_attempted"]);
 assert.equal(JSON.stringify(eventWrites).includes("answers"), false);
 finalAttempts = [1,2,3].map(attempt_id => ({attempt_id}));
 const limited = await (await handler(request("?view=final"))).json();
 assert.equal((await handler(request("", "POST", {action: "final", session_id: limited.sessionId,
  answers: Array(20).fill(2)}))).status, 429);
 assert.equal(finalWrites, 2);
 finalAttempts = []; finalSession = null;
});

test("avaliação rejeita envio sem sessão persistida", async () => {
 progress = [1,2].map(module_no => ({module_no, completed_at: "2026-09-19T00:00:00Z"}));
 finalWrites = 0; finalSession = null;
 const response = await handler(request("", "POST", {action: "final", answers: Array(20).fill(2)}));
 assert.equal(response.status, 400);
 assert.equal((await response.json()).error, "assessment_session_invalid");
 assert.equal(finalWrites, 0);
});

test("certificado permanece bloqueado sem aprovação do projeto", async () => {
 progress = [1,2].map(module_no => ({module_no, evidence: "Evidência aplicada válida", submitted_at: "2026-09-19T00:00:00Z",
  checkpoint_passed_at: "2026-09-19T00:01:00Z", completed_at: "2026-09-19T00:02:00Z",
  review_status: module_no === 2 ? "pending" : null}));
 finalAttempts = [{score: 14, question_count: 20, submitted_at: "2026-09-19T00:03:00Z"}];
 certificates = []; certificateWrites = 0;
 const view = await (await handler(request("?view=completion"))).json();
 assert.equal(view.ready, false);
 assert.equal(view.requirements.project.met, false);
 const blocked = await handler(request("", "POST", {action: "issue_certificate", learner_name: "Edgar Xavier"}));
 assert.equal(blocked.status, 423);
 assert.equal(certificateWrites, 0);
});

test("certificado é emitido uma única vez após todos os critérios", async () => {
 progress = [1,2].map(module_no => ({module_no, evidence: "Evidência aplicada válida", submitted_at: "2026-09-19T00:00:00Z",
  checkpoint_passed_at: "2026-09-19T00:01:00Z", completed_at: "2026-09-19T00:02:00Z",
  review_status: module_no === 2 ? "approved" : null}));
 finalAttempts = [{score: 14, question_count: 20, submitted_at: "2026-09-19T00:03:00Z"}];
 certificates = []; certificateWrites = 0;
 const ready = await (await handler(request("?view=completion"))).json();
 assert.equal(ready.ready, true);
 assert.equal((await handler(request("", "POST", {action: "issue_certificate", learner_name: "Edgar"}))).status, 400);
 const issued = await handler(request("", "POST", {action: "issue_certificate", learner_name: "Edgar Xavier"}));
 assert.equal(issued.status, 201);
 assert.equal((await issued.json()).certificate.public_code, "VC-LEA-2026-000001");
 const repeated = await handler(request("", "POST", {action: "issue_certificate", learner_name: "Outro Nome"}));
 assert.equal(repeated.status, 200);
 assert.equal(certificateWrites, 1);
 finalAttempts = []; certificates = [];
});


test("curso estruturado entrega blocos e registra início/conclusão das aulas", async () => {
 structuredMode=true;progress=[];lessonProgress=[];lessonWrites=0;
 try {
  const unopened=await handler(request("?module=1","POST",{action:"content_complete"}));
  assert.equal(unopened.status,409);assert.equal(lessonWrites,0);
  const opened=await handler(request("?module=1"));assert.equal(opened.status,200);
  assert.equal((await opened.json()).lesson.lessons[0].blocks[0].content.text,"Fixture técnica sem conteúdo oficial");
  assert.equal(lessonProgress[0].status,"in_progress");assert.ok(lessonProgress[0].first_viewed_at);
  const completed=await handler(request("?module=1","POST",{action:"content_complete"}));
  assert.equal(completed.status,200);assert.equal(lessonProgress[0].status,"completed");
  assert.ok(lessonProgress[0].content_completed_at);
 } finally {structuredMode=false;lessonProgress=[]}
});

test("draft estruturado não é entregue a aluno e preview não grava aulas", async () => {
 structuredMode=true;structuredStatus="draft";isAdmin=true;lessonWrites=0;eventWrites=[];
 try {
  assert.equal((await handler(request("?module=1"))).status,503);
  const preview=await handler(request("?course=lideranca-estrategica-aplicada&version=1.0&preview=content_master"));
  assert.equal(preview.status,200);assert.equal((await preview.json()).course.modules[0].lessons[0].title,"Fixture técnica");
  assert.equal(lessonWrites,0);assert.equal(eventWrites.length,0);
 } finally {structuredMode=false;structuredStatus="published";isAdmin=false}
});

test("checkpoint estruturado rejeita índices numéricos legados", async () => {
 structuredMode=true;progress=[{module_no:1,evidence:"Fixture técnica válida",submitted_at:"2026-10-06T00:00:00Z"}];
 const previous=attemptWrites;
 try {assert.equal((await handler(request("?module=1","POST",{action:"checkpoint",answers:Array(5).fill(2)}))).status,400);assert.equal(attemptWrites,previous)}
 finally {structuredMode=false;progress=[]}
});
