const ROOT = Deno.env.get("SUPABASE_URL") ?? "https://ctzgsxxbyvruzmfqibnl.supabase.co";
const KEY = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY") ?? "sb_publishable_rF60SyuGpNstim9MqFvqmQ_sSm78z1b";
const SERVICE = Deno.env.get("SUPABASE_SECRET_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const OWNER_ID = "70aa4d75-bbb9-4839-aad8-670b7654664d";
const OWNER_EMAIL = "vcmenteconvergente@gmail.com";
const PROD = "https://vc-mente-convergente.vercel.app";

function trusted(origin: string) {
  return origin === PROD ||
    /^https:\/\/vc-mente-convergente-git-feature-universidade-[a-z0-9-]+-life-os22\.vercel\.app$/.test(origin) ||
    ["http://localhost:4173", "http://127.0.0.1:4173"].includes(origin);
}
function reply(status: number, body: unknown, origin: string) {
  return new Response(status === 204 ? null : JSON.stringify(body), { status, headers: {
    "content-type": "application/json; charset=utf-8", "cache-control": "private, no-store",
    "x-content-type-options": "nosniff", "vary": "Origin, Authorization",
    "access-control-allow-origin": trusted(origin) ? origin : PROD,
    "access-control-allow-headers": "authorization, apikey, content-type",
    "access-control-allow-methods": "GET, POST, OPTIONS"
  }});
}
async function db(table: string, query = "") {
  if (!SERVICE) throw new Error("server_configuration_missing");
  const response = await fetch(`${ROOT}/rest/v1/${table}${query}`, {
    headers: { apikey: SERVICE, authorization: `Bearer ${SERVICE}`, accept: "application/json" },
    signal: AbortSignal.timeout(10000), cache: "no-store"
  });
  if (!response.ok) throw new Error(`database_error:${table}:${response.status}`);
  return response.json();
}
async function rpc(name: string, body: Record<string, unknown>) {
  if (!SERVICE) throw new Error("server_configuration_missing");
  const response = await fetch(`${ROOT}/rest/v1/rpc/${name}`, {method: "POST", headers: {
    apikey: SERVICE, authorization: `Bearer ${SERVICE}`, accept: "application/json", "content-type": "application/json"
  }, body: JSON.stringify(body), signal: AbortSignal.timeout(10000), cache: "no-store"});
  if (!response.ok) throw new Error(`rpc_error:${name}:${response.status}:${await response.text()}`);
  return response.json();
}
async function assertOwner(bearer: string) {
  const headers = { apikey: KEY, authorization: bearer };
  const [identity, scope] = await Promise.all([
    fetch(`${ROOT}/auth/v1/user`, { headers, signal: AbortSignal.timeout(8000) }),
    fetch(`${ROOT}/functions/v1/vc-core-private-api/v1/admin/scope`, { headers, signal: AbortSignal.timeout(8000) })
  ]);
  if (identity.status === 401 || scope.status === 401) return { error: 401 };
  if (!identity.ok || !scope.ok) return { error: 503 };
  const user = await identity.json();
  const access = (await scope.json())?.data;
  if (user.id !== OWNER_ID || user.email?.toLowerCase() !== OWNER_EMAIL || !user.email_confirmed_at || access?.platform_admin !== true) return { error: 403 };
  return { user };
}
function human(value: string) {
  return ({ published: "Publicado", review: "Em revisão", draft: "Rascunho", archived: "Arquivado",
    active: "Ativo", open: "Aberta", closed: "Encerrada", completed: "Concluída",
    suspended: "Suspensa", cancelled: "Cancelada" } as Record<string, string>)[value] ?? value;
}
const proposalLabels: Record<string, string> = {received: "Recebida", reviewing: "Em análise", qualified: "Qualificada",
  proposal_prepared: "Proposta preparada", sent: "Enviada", accepted: "Aceita", declined: "Não avançou", archived: "Arquivada"};
const proposalTransitions: Record<string, string[]> = {received: ["reviewing","qualified","declined","archived"],
  reviewing: ["qualified","declined","archived"], qualified: ["proposal_prepared","declined","archived"],
  proposal_prepared: ["qualified","sent","archived"], sent: ["accepted","declined","archived"],
  accepted: ["archived"], declined: ["reviewing","archived"], archived: []};

Deno.serve(async request => {
  const origin = request.headers.get("origin") ?? "";
  if (request.method === "OPTIONS") return reply(204, null, origin);
  if (!["GET", "POST"].includes(request.method)) return reply(405, { error: "method_not_allowed" }, origin);
  const bearer = request.headers.get("authorization") ?? "";
  if (!/^Bearer [A-Za-z0-9._-]{20,4096}$/.test(bearer)) return reply(401, { error: "sign_in_required" }, origin);
  try {
    const owner = await assertOwner(bearer);
    if (owner.error) return reply(owner.error, { error: owner.error === 403 ? "owner_required" : owner.error === 401 ? "sign_in_required" : "service_unavailable" }, origin);
    if (request.method === "POST") {
      if (!trusted(origin)) return reply(403, {error: "origin_not_allowed"}, origin);
      const input = await request.json().catch(() => ({}));
      const proposalId = String(input.proposal_id ?? "");
      const nextStatus = String(input.status ?? "");
      if (input.action !== "transition_proposal" || !/^[0-9a-f-]{36}$/i.test(proposalId) || !proposalLabels[nextStatus]) return reply(422, {error: "invalid_request"}, origin);
      try {
        await rpc("vc_university_transition_proposal", {p_proposal_id: proposalId, p_new_status: nextStatus,
          p_actor_user_id: owner.user.id, p_internal_note: String(input.note ?? "").trim().slice(0, 1000) || null});
      } catch (error) {
        if (String(error).includes("invalid_proposal_transition")) return reply(409, {error: "invalid_transition"}, origin);
        throw error;
      }
      return reply(200, {updated: true}, origin);
    }
    const [courses, modules, cohorts, organizations, enrollments, teachers, progress, finals, certificates, proposals] = await Promise.all([
      db("vc_university_courses", "?select=course_id,title,description,modality,hours_minutes,version,status,final_pass_percent,certificate_requires_project_review,certificate_prefix&order=created_at.asc&limit=100"),
      db("vc_university_modules", "?select=course_id,module_no&limit=1000"),
      db("vc_university_cohorts", "?select=cohort_id,course_id,organization_id,label,capacity,status,market_segment,commercial_modality,delivery_mode,reporting_enabled,created_at&order=created_at.desc&limit=1000"),
      db("vc_university_organizations", "?select=organization_id,core_organization_id,legal_name,status,privacy_mode,minimum_report_group_size&limit=1000"),
      db("vc_university_enrollments", "?select=enrollment_id,cohort_id,course_id,user_id,status,enrolled_at,completed_at&order=enrolled_at.desc&limit=2000"),
      db("vc_university_teachers", "?select=cohort_id,user_id&limit=1000"),
      db("vc_university_module_progress", "?select=enrollment_id,module_no,submitted_at,completed_at,review_status,reviewed_at&limit=10000"),
      db("vc_university_final_attempts", "?select=enrollment_id,score,question_count,submitted_at&order=submitted_at.desc&limit=5000"),
      db("vc_university_certificates", "?select=certificate_id,enrollment_id,public_code,learner_name_snapshot,course_title_snapshot,issued_at,revoked_at&order=issued_at.desc&limit=5000"),
      db("vc_university_proposal_requests", "?select=proposal_id,proposal_reference,contact_name,organization_name,contact_role,email,phone,team_size,delivery_mode,course_interest,goals,status,quote_provider_target,acceptance_provider_target,integration_state,created_at&order=created_at.desc&limit=500")
    ]);
    const userIds = [...new Set([...enrollments.map((row: any) => row.user_id), ...teachers.map((row: any) => row.user_id)])].slice(0, 500);
    const people: Record<string, string> = {};
    await Promise.all(userIds.map(async id => { try {
      const response = await fetch(`${ROOT}/auth/v1/admin/users/${id}`, { headers: { apikey: SERVICE!, authorization: `Bearer ${SERVICE}` }, signal: AbortSignal.timeout(5000) });
      if (response.ok) people[id] = (await response.json()).email ?? id;
    } catch { people[id] = id; } }));
    const courseMap = Object.fromEntries(courses.map((row: any) => [row.course_id, row]));
    const cohortMap = Object.fromEntries(cohorts.map((row: any) => [row.cohort_id, row]));
    const organizationMap = Object.fromEntries(organizations.map((row: any) => [row.organization_id, row.legal_name]));
    const progressBy: Record<string, any[]> = {};
    progress.forEach((row: any) => (progressBy[row.enrollment_id] ??= []).push(row));
    const finalBy: Record<string, any> = {};
    finals.forEach((row: any) => { if (!finalBy[row.enrollment_id]) finalBy[row.enrollment_id] = row; });
    const enrollmentRows = enrollments.map((row: any) => {
      const items = progressBy[row.enrollment_id] ?? [];
      const total = modules.filter((item: any) => item.course_id === row.course_id).length;
      const completed = items.filter((item: any) => item.completed_at).length;
      const final = finalBy[row.enrollment_id];
      return { student: people[row.user_id] ?? row.user_id, course_title: courseMap[row.course_id]?.title ?? row.course_id,
        cohort_label: cohortMap[row.cohort_id]?.label ?? "Turma V&C", completed_modules: completed, module_count: total,
        final_score: final ? Math.round(final.score / final.question_count * 100) : null,
        status_label: human(row.status === "active" && completed > 0 ? "Em andamento" : row.status) };
    });
    const finalScores = enrollmentRows.filter((row: any) => row.final_score !== null).map((row: any) => row.final_score);
    return reply(200, {
      summary: { enrollments: enrollments.length, in_progress: enrollments.filter((row: any) => row.status === "active").length,
        awaiting_review: progress.filter((row: any) => row.submitted_at && !row.reviewed_at).length,
        completed: enrollments.filter((row: any) => row.status === "completed").length,
        average_final: finalScores.length ? Math.round(finalScores.reduce((a: number, b: number) => a + b, 0) / finalScores.length) : null,
        active_cohorts: cohorts.filter((row: any) => ["active", "open"].includes(row.status)).length,
        active_organizations: organizations.filter((row: any) => row.status === "active").length,
        enterprise_cohorts: cohorts.filter((row: any) => row.market_segment === "b2b").length,
        open_proposals: proposals.filter((row: any) => !["accepted","declined","archived"].includes(row.status)).length },
      courses: courses.map((row: any) => ({ ...row, status_label: human(row.status), hours_label: `${Math.round(row.hours_minutes / 60)}h`,
        module_count: modules.filter((item: any) => item.course_id === row.course_id).length,
        enrollment_count: enrollments.filter((item: any) => item.course_id === row.course_id).length })),
      cohorts: cohorts.map((row: any) => ({ ...row, status_label: human(row.status), course_title: courseMap[row.course_id]?.title ?? row.course_id,
        organization_name: row.organization_id ? organizationMap[row.organization_id] : null,
        enrollment_count: enrollments.filter((item: any) => item.cohort_id === row.cohort_id).length })),
      organizations: organizations.map((row: any) => {
        const organizationCohorts = cohorts.filter((item: any) => item.organization_id === row.organization_id);
        const cohortIds = new Set(organizationCohorts.map((item: any) => item.cohort_id));
        return { organization_id: row.organization_id, legal_name: row.legal_name,
          status_label: human(row.status), privacy_mode: row.privacy_mode,
          minimum_report_group_size: row.minimum_report_group_size,
          cohort_count: organizationCohorts.length,
          participant_count: enrollments.filter((item: any) => cohortIds.has(item.cohort_id) && item.status !== "cancelled").length,
          capacity: organizationCohorts.reduce((total: number, item: any) => total + (item.capacity ?? 0), 0) };
      }),
      enrollments: enrollmentRows,
      teachers: [...new Set<string>(teachers.map((row: any) => String(row.user_id)))].map(id => ({ teacher: people[id] ?? id,
        cohorts: teachers.filter((row: any) => row.user_id === id).map((row: any) => cohortMap[row.cohort_id]?.label ?? row.cohort_id) })),
      certificates: certificates.map((row: any) => ({ code: row.public_code, learner: row.learner_name_snapshot,
        course: row.course_title_snapshot, issued_at: row.issued_at, status: row.revoked_at ? "Revogado" : "Autêntico" })),
      proposals: proposals.map((row: any) => ({proposal_id: row.proposal_id, reference: row.proposal_reference,
        contact_name: row.contact_name, organization_name: row.organization_name, contact_role: row.contact_role,
        email: row.email, phone: row.phone, goals: row.goals, status_label: proposalLabels[row.status] ?? row.status,
        team_size_label: ({up_to_10:"Até 10", "11_to_30":"11 a 30", "31_to_100":"31 a 100", "101_to_300":"101 a 300", over_300:"Mais de 300", not_defined:"A definir"} as Record<string,string>)[row.team_size] ?? row.team_size,
        delivery_mode_label: ({online:"On-line", in_person:"Presencial", hybrid:"Híbrido", to_define:"A definir"} as Record<string,string>)[row.delivery_mode] ?? row.delivery_mode,
        integration_label: row.integration_state === "not_connected" ? "Destinos preparados · não conectados" : "Pronta para registro controlado",
        allowed_transitions: (proposalTransitions[row.status] ?? []).map(value => ({value, label: proposalLabels[value]}))})),
      readiness: [
        { label: "Pagamentos", status: "Não implementado", message: "A Universidade ainda não possui conciliação financeira própria. Nenhum valor é estimado neste painel." },
        { label: "Orça Fácil + ConfirmaPro", status: "Preparado", message: "Solicitações possuem protocolo, fila e destinos de integração. Nenhuma proposta ou aceite é enviado automaticamente enquanto as integrações não estiverem conectadas." },
        { label: "Certificados", status: "Operacional", message: `${certificates.filter((row: any) => !row.revoked_at).length} certificado(s) ativo(s), com emissão condicionada e validação pública por código ou QR Code.` }
      ], scope: { owner_id: owner.user.id, privacy: "aggregated_only" }
    }, origin);
  } catch (error) {
    console.error("University admin API failed", error instanceof Error ? error.message : "unknown");
    return reply(503, { error: "service_unavailable" }, origin);
  }
});
