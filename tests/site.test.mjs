import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const htmlFiles = readdirSync(root).filter((name) => extname(name) === ".html");

function read(relativePath) {
  return readFileSync(join(root, relativePath), "utf8");
}

test("todas as páginas públicas possuem metadados básicos", () => {
  assert.ok(htmlFiles.length >= 18);
  for (const file of htmlFiles) {
    const html = read(file);
    assert.match(html, /<html lang="pt-BR">/i, file);
    assert.match(html, /<meta name="viewport"/i, file);
    assert.match(html, /<title>.+<\/title>/is, file);
  }
});

test("links locais e recursos referenciados existem", () => {
  const attribute = /(?:href|src)="([^"]+)"/g;
  for (const file of htmlFiles) {
    const html = read(file);
    for (const [, value] of html.matchAll(attribute)) {
      if (/^(?:https?:|mailto:|#|data:|\/)/i.test(value)) continue;
      const target = value.split(/[?#]/)[0];
      if (!target) continue;
      assert.ok(existsSync(join(root, target)), `${file} -> ${target}`);
    }
  }
});

test("âncoras, abas e links externos possuem destino verificável", () => {
  for (const file of htmlFiles) {
    const html = read(file);
    const scripts = [...html.matchAll(/<script\b[^>]*src="([^"]+)"[^>]*><\/script>/gi)]
      .map(([, source]) => source.split(/[?#]/)[0])
      .filter((source) => source && existsSync(join(root, source)))
      .map(read)
      .join("\n");
    const navigableSource = `${html}\n${scripts}`;
    assert.doesNotMatch(html, /href="(?:javascript:|\s*$)/i, file);
    for (const [, id] of html.matchAll(/href="#([^"]+)"/g)) {
      const escaped = id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      assert.match(navigableSource, new RegExp(`(?:id=["']${escaped}["']|\\.id=["']${escaped}["'])`), `${file} -> #${id}`);
    }
    for (const match of html.matchAll(/<a\b[^>]*target="_blank"[^>]*>/gi)) {
      assert.match(match[0], /rel="[^"]*noopener[^"]*"/i, `${file} -> ${match[0]}`);
    }
  }
});

test("a marca pública canônica é V&C Mente Convergente", () => {
  const publicSources = [
    ...htmlFiles.map(read),
    read("assets/js/main.js"),
    read("assets/images/logo-vc-mente-convergente.svg")
  ].join("\n");
  assert.doesNotMatch(publicSources, /Mente Infinita/i);
  assert.match(publicSources, /V(?:&amp;|&)C Mente Convergente/i);
  assert.doesNotMatch(publicSources, /5500000000000|contato@menteinfinita|instagram\.com\/menteinfinita/i);
});

test("comunicação pública apresenta a Universidade única sem linguagem interna", () => {
  const publicSources = htmlFiles.map(read).join("\n");
  assert.doesNotMatch(publicSources, /Universidade REAL|Integração em validação|Portfólio em validação|\bgates\b|captação de leads|Autoridade em construção|Conteúdo e SEO|Pautas estratégicas/i);
  assert.match(publicSources, /Universidade V(?:&amp;|&)C/);
  const legacy = read("universidade-real.html");
  assert.match(legacy, /url=universidade-vc\.html/);
});

test("navegação consolidada aponta para catálogo e portal", () => {
  const script = read("assets/js/main.js");
  assert.match(script, /"\/produtos"/);
  assert.match(script, /"\/entrar"/);
  assert.doesNotMatch(script, /"(?:index|produtos|empresas|escolas|palestras|universidade-vc|sobre-edgar|contato)\.html"/);
  assert.match(script, /vcmenteconvergente@gmail\.com/);
  assert.doesNotMatch(script, /header-cta[^\n]+real-360-psicossocial/);
});

test("portal possui cadastro, login, recuperação e áreas protegidas", () => {
  const html = read("entrar.html");
  const app = read("assets/js/portal.js");
  for (const id of [
    "signin-form", "signup-button", "recovery-button", "reset-form",
    "workspace-view", "access-section", "admin-section", "bootstrap-admin-button"
  ]) {
    assert.match(html, new RegExp(`id="${id}"`), id);
  }
  assert.match(app, /\/auth\/v1\/signup/);
  assert.match(app, /\/auth\/v1\/recover/);
  assert.match(app, /vc-core-private-api/);
  assert.match(app, /vc-core-api/);
  assert.doesNotMatch(app, /service_role|MERCADO_PAGO_ACCESS_TOKEN|SUPABASE_SECRET_KEY/i);
  assert.doesNotMatch(app, /canal \" \+ access\.channel|access\.version/);
  assert.doesNotMatch(html, /V&amp;C Core|pool de acessos/i);
  assert.match(html, /id="workspace-overview"/);
});

test("página institucional apresenta Edgar, Carla e a origem da V&C", () => {
  const about = read("sobre-edgar.html");
  const navigation = read("assets/js/main.js");
  assert.match(navigation, /"\/sobre-edgar", "Sobre nós"/);
  assert.match(about, /Edgar Xavier e Carla Amanda/);
  assert.match(about, /Como surgiu a V&amp;C Mente Convergente/);
  assert.match(about, /Vidas Conectadas ao propósito/);
});

test("configuração Vercel mantém um único site com rotas internas", () => {
  const config = JSON.parse(read("vercel.json"));
  assert.equal(config.cleanUrls, true);
  assert.ok(config.rewrites.some((item) => item.source === "/meus-acessos" && item.destination === "/entrar"));
  assert.ok(config.rewrites.some((item) => item.source === "/admin" && item.destination === "/entrar"));
  assert.ok(config.rewrites.every((item) => !item.destination.endsWith(".html")));
  assert.ok(config.redirects.some((item) => item.source === "/universidade-real" && item.destination === "/universidade-vc"));
  const headers = JSON.stringify(config.headers);
  assert.match(headers, /Content-Security-Policy/);
  assert.match(headers, /frame-ancestors 'none'/);
});

test("rotas aninhadas resolvem recursos e destinos internos a partir da raiz", () => {
  const config = JSON.parse(read("vercel.json"));
  const nested = config.rewrites.filter(item => item.source.split("/").filter(Boolean).length > 1);
  assert.ok(nested.length >= 3);
  for (const route of nested) {
    const page = `${route.destination.replace(/^\//, "")}.html`;
    const html = read(page);
    for (const [, value] of html.matchAll(/(?:href|src)="([^"]+)"/g)) {
      if (/^(?:https?:|mailto:|#|data:)/i.test(value)) continue;
      assert.match(value, /^\//, `${route.source} -> ${value} precisa partir da raiz`);
      const pathname = value.split(/[?#]/)[0].replace(/^\//, "");
      const candidates = [pathname, `${pathname}.html`];
      const linkedRewrite = config.rewrites.find(item => item.source === `/${pathname}`);
      if (linkedRewrite) candidates.push(`${linkedRewrite.destination.replace(/^\//, "")}.html`);
      assert.ok(candidates.some(candidate => existsSync(join(root, candidate))), `${route.source} -> ${value}`);
    }
  }
});

test("Universidade possui catálogo multicursos e sala premium acessível", () => {
  const catalog = read("universidade-vc.html");
  const classroom = read("aluno-lideranca.html");
  const learner = read("assets/js/universidade-aluno-v2.js");
  const styles = read("assets/css/universidade.css");

  assert.match(catalog, /id="catalogo"/);
  assert.match(catalog, /Liderança Estratégica Aplicada/);
  assert.match(catalog, /Inteligência Emocional/);
  assert.match(catalog, /Comportamento Humano/);
  assert.match(catalog, /Formação para pessoas e organizações/);
  assert.match(catalog, /curso livre de capacitação e desenvolvimento profissional/i);
  assert.match(classroom, /class="skip-link"/);
  assert.match(classroom, /aria-live="polite"/);
  assert.match(classroom, /id="progress-percent"/);
  assert.match(learner, /aria-current/);
  assert.match(learner, /aria-busy/);
  assert.match(styles, /@media\(max-width:780px\)/);
  assert.match(styles, /prefers-reduced-motion/);
  assert.match(styles, /\[hidden\]\{display:none!important\}/);
});

test("sala renderiza o contrato pedagógico premium sem expor gabaritos", () => {
  const learner = read("assets/js/universidade-aluno-v2.js");
  const styles = read("assets/css/universidade.css");
  const manifest = read("assets/docs/universidade-lideranca-conteudo-v1.1.md");

  for (const label of [
    "ABERTURA", "OBJETIVOS", "CONCEITOS-CHAVE", "PRINCÍPIO V&C", "EXEMPLO",
    "ESTUDO DE CASO", "ATENÇÃO", "NA PRÁTICA", "PARA REFLETIR", "SÍNTESE",
    "CHECKPOINT V&C", "REFERÊNCIAS"
  ]) assert.match(learner, new RegExp(label));
  assert.match(learner, /textContent/);
  assert.doesNotMatch(learner, /innerHTML/);
  assert.match(styles, /\.pedagogy-block/);
  assert.match(styles, /\.concept-grid/);
  assert.match(manifest, /Conteúdo e estudos guiados \| 7h/);
  assert.match(manifest, /Avaliação final e revisão \| 1h/);
  assert.match(manifest, /prova contém 20 questões/);
  assert.doesNotMatch(manifest, /45 minutos de leitura|75 minutos de oficina/);
});

test("jornada oficial usa API v2 e painel não reduz a prova a dez questões", () => {
  const classroom = read("aluno-lideranca.html");
  const portal = read("assets/js/portal.js");
  const teacher = read("assets/js/universidade-professor.js");
  assert.match(classroom, /universidade-aluno-v2\.js/);
  assert.doesNotMatch(classroom, /universidade-aluno\.js/);
  assert.doesNotMatch(teacher, /score\+"\/10/);
  assert.match(teacher, /question_count\|\|20/);
  assert.doesNotMatch(portal, /rpc\/vc_course_has_access/);
});

test("RADAR e FOCO são ferramentas interativas, acessíveis e vinculadas à evidência", () => {
  const learner = read("assets/js/universidade-aluno-v2.js");
  const styles = read("assets/css/universidade.css");
  assert.match(learner, /Ferramenta V&C · RADAR/);
  assert.match(learner, /Ferramenta V&C · FOCO/);
  assert.match(learner, /Levar RADAR para a evidência/);
  assert.match(learner, /Levar FOCO para a evidência/);
  assert.match(learner, /aria-labelledby","radar-title/);
  assert.match(learner, /aria-labelledby","foco-title/);
  assert.match(styles, /\.radar-grid/);
  assert.match(styles, /\.radar-card/);
});

test("painel do professor lê o modelo acadêmico multicursos", () => {
  const page = read("professor-lideranca.html");
  const app = read("assets/js/universidade-professor.js");
  const api = read("supabase/functions/vc-universidade-professor/index.ts");
  assert.match(page, /href="#fila-revisao"/);
  assert.match(page, /Acompanhamento pedagógico/);
  assert.match(app, /Pulso da turma/);
  assert.match(app, /FILA DE REVISÃO/i);
  assert.match(app, /Acompanhamento individual/);
  assert.match(app, /Registrar parecer/);
  assert.match(api, /vc_university_module_progress/);
  assert.match(api, /vc_university_final_attempts/);
  assert.match(api, /vc_university_teachers/);
  assert.match(api, /cohortIds/);
  assert.match(api, /question_count/);
  assert.match(api, /evidence_reviewed/);
  assert.doesNotMatch(api, /vc_course_assessment_attempts/);
  assert.doesNotMatch(api, /vc_course_evidence/);
});

test("contato não publica arquivos internos como downloads comerciais", () => {
  const contact = read("contato.html");
  assert.doesNotMatch(contact, /href="[^"]+\.md"/i);
  assert.doesNotMatch(contact, /formato editável\/Markdown/i);
  assert.match(contact, /Atendimento orientado/);
  assert.match(contact, /Nenhum aplicativo externo será aberto automaticamente/);
  assert.doesNotMatch(read("assets/js/main.js"), /mailto:/i);
});

test("administração da Universidade é privada, real e separada do professor", () => {
  const page = read("administracao-universidade.html");
  const script = read("assets/js/universidade-admin.js");
  const api = read("supabase/functions/vc-universidade-admin/index.ts");
  const portal = read("assets/js/portal.js");
  const vercel = JSON.parse(read("vercel.json"));
  assert.match(page, /noindex,nofollow/);
  assert.match(page, /Painel Geral V&amp;C/);
  assert.match(page, /Privacidade por padrão/);
  assert.match(script, /vc-universidade-admin/);
  assert.match(api, /OWNER_EMAIL = "vcmenteconvergente@gmail\.com"/);
  assert.match(api, /access\?\.platform_admin !== true/);
  assert.match(api, /select=enrollment_id,module_no,submitted_at,completed_at,review_status,reviewed_at/);
  assert.doesNotMatch(api, /select=[^\n"]*(?:,evidence(?:,|&)|review_feedback|review_concepts)/);
  assert.match(page, /id="certificados"/);
  assert.match(script, /certificate-rows/);
  assert.match(api, /learner_name_snapshot,course_title_snapshot,issued_at,revoked_at/);
  assert.match(portal, /university-admin-card/);
  assert.equal(vercel.rewrites.some((item) => item.source === "/admin/universidade"), true);
});

test("proprietário possui espelho integral privado com provas e gabaritos", () => {
  const page = read("administracao-conteudo-universidade.html");
  const app = read("assets/js/universidade-admin-conteudo.js");
  const admin = read("administracao-universidade.html");
  const api = read("supabase/functions/vc-universidade-admin/index.ts");
  const learnerApi = read("supabase/functions/vc-universidade-learner-v2/index.ts");
  const vercel = JSON.parse(read("vercel.json"));
  assert.match(page, /noindex,nofollow/);
  assert.match(page, /Conteúdo integral do proprietário/);
  assert.match(admin, /href="\/admin\/universidade\/conteudo"/);
  assert.match(app, /view=curriculum/);
  assert.match(app, /question\.correct_index/);
  assert.match(app, /Prova final e gabaritos/);
  assert.ok(api.indexOf("await assertOwner(bearer)") < api.indexOf('url.searchParams.get("view") === "curriculum"'));
  assert.match(api, /access: "owner_full_curriculum"/);
  assert.match(api, /includes_answer_keys: true/);
  assert.match(api, /correct_choice/);
  assert.doesNotMatch(learnerApi, /correct_choice/);
  assert.equal(vercel.rewrites.some((item) => item.source === "/admin/universidade/conteudo"), true);
});

test("sessão autenticada persiste entre abas sem expor segredos", () => {
  const clients = [
    "portal.js", "universidade-admin.js", "universidade-admin-conteudo.js",
    "universidade-empresa.js", "universidade-professor.js", "universidade-aluno-v2.js",
    "universidade-aluno.js", "certificado-aluno.js"
  ].map(name => read(`assets/js/${name}`)).join("\n");
  assert.doesNotMatch(clients, /sessionStorage/);
  assert.match(clients, /localStorage/);
  assert.doesNotMatch(clients, /service_role|SUPABASE_SECRET_KEY/i);
});

test("APIs acadêmicas aceitam previews versionados sem liberar origens externas", () => {
  const apis = [
    "vc-universidade-learner-v2", "vc-universidade-professor", "vc-universidade-admin",
    "vc-universidade-empresa", "vc-universidade-propostas", "vc-certificado-publico"
  ].map(name => read(`supabase/functions/${name}/index.ts`));
  for (const api of apis) {
    assert.match(api, /vc-mente-convergente-\[a-z0-9-\]\+-life-os22/);
    assert.match(api, /(?:trustedOrigin|trusted)\(origin\) \? origin : PROD/);
    assert.doesNotMatch(api, /https:\/\/\[a-z0-9-\]\+\.vercel\.app/);
  }
});

test("sala possui leitura orientada, índice e rascunho recuperável", () => {
  const learner = read("assets/js/universidade-aluno-v2.js");
  const styles = read("assets/css/universidade.css");
  assert.match(learner, /NESTE MÓDULO/);
  assert.match(learner, /lesson-roadmap/);
  assert.match(learner, /localStorage\.getItem\(draftKey\)/);
  assert.match(learner, /Critério de qualidade/);
  assert.match(styles, /\.lesson-reading-grid/);
  assert.match(styles, /\.lesson-outline/);
});

test("sala móvel prioriza conteúdo e mantém continuidade entre módulos", () => {
  const page = read("aluno-lideranca.html");
  const learner = read("assets/js/universidade-aluno-v2.js");
  const styles = read("assets/css/universidade.css");
  assert.match(page, /id="toggle-course-navigation"/);
  assert.match(page, /id="workspace-step"/);
  assert.match(learner, /Continuar formação/);
  assert.match(learner, /navigation\.classList\.toggle\("is-open"/);
  assert.match(styles, /\.course-navigation\{display:none\}/);
  assert.match(styles, /\.course-navigation\.is-open\{display:block/);
});

test("ativação v1.1 valida conteúdo e preserva o trigger de versão", () => {
  const migration = read("supabase/migrations/20260928190000_universidade_ativar_conteudo_v11_homolog.sql");
  assert.match(migration, /module_count is distinct from 10/);
  assert.match(migration, /checkpoint_count is distinct from 50/);
  assert.match(migration, /final_count < 30/);
  assert.match(migration, /status='review'/);
  assert.match(migration, /create trigger vc_university_pin_enrollment_version_guard/);
});

test("migração v1.1 exige cinco questões com distribuição pedagógica por módulo", () => {
  const migration = read("supabase/migrations/20260925171000_universidade_checkpoints_v11.sql");
  assert.match(migration, /course_version = '1\.1'/);
  assert.match(migration, /count\(q\.question_id\) <> 5/);
  assert.match(migration, /q\.kind = 'concept'\) <> 2/);
  assert.match(migration, /q\.kind = 'application'\) <> 2/);
  assert.match(migration, /q\.kind = 'decision'\) <> 1/);
});

test("avaliação final v1.1 usa banco ampliado e sessão atômica privada", () => {
  const migration = read("supabase/migrations/20260928134000_universidade_avaliacao_final_v11.sql");
  const api = read("supabase/functions/vc-universidade-learner-v2/index.ts");
  const learner = read("assets/js/universidade-aluno-v2.js");
  assert.match(migration, /active_items < 30/);
  assert.match(migration, /cardinality\(question_ids\) = 20/);
  assert.match(migration, /security invoker/i);
  assert.match(migration, /grant execute on function public\.vc_university_submit_final_attempt[^;]+to service_role/s);
  assert.match(api, /finalQuestionPool/);
  assert.match(api, /crypto\.getRandomValues/);
  assert.match(api, /const kinds = \["concept", "application", "case", "decision"\]/);
  assert.match(api, /rpc\/vc_university_submit_final_attempt/);
  assert.match(learner, /session_id:data\.sessionId/);
});

test("certificação verificável exige todos os critérios e preserva snapshots", () => {
  const migration = read("supabase/migrations/20260928201649_universidade_certificacao_verificavel.sql");
  const learnerApi = read("supabase/functions/vc-universidade-learner-v2/index.ts");
  const publicApi = read("supabase/functions/vc-certificado-publico/index.ts");
  const validation = read("validar-certificado.html");
  const certificate = read("certificado.html");
  const certificateApp = read("assets/js/certificado-aluno.js");
  assert.match(migration, /academic_requirements_incomplete/);
  assert.match(migration, /final_assessment_required/);
  assert.match(migration, /project_approval_required/);
  assert.match(migration, /issued_certificate_is_immutable/);
  assert.match(migration, /vc_university_certificate_number_seq/);
  assert.match(migration, /revoke all on public\.vc_university_certificates from public, anon, authenticated/);
  assert.match(learnerApi, /completion_requirements_pending/);
  assert.match(learnerApi, /issue_certificate/);
  assert.match(publicApi, /certificate_not_found/);
  assert.match(publicApi, /"public_code", "learner_name_snapshot", "course_title_snapshot"/);
  assert.doesNotMatch(publicApi, /evidence|review_feedback|answers|review_concepts/);
  assert.match(validation, /Validação pública/);
  assert.match(certificate, /noindex,nofollow/);
  assert.match(certificateApp, /Conteúdo programático/);
  assert.match(certificateApp, /window\.print/);
  assert.match(JSON.stringify(JSON.parse(read("vercel.json")).headers), /img-src 'self' data: https:\/\/ctzgsxxbyvruzmfqibnl\.supabase\.co/);
});

test("Universidade reutiliza organizações e vagas canônicas para B2C e B2B", () => {
  const migration = read("supabase/migrations/20260929233712_universidade_b2c_b2b_privacidade.sql");
  assert.match(migration, /core_organization_id uuid unique[\s\S]+references public\.vc_organizations/);
  assert.match(migration, /market_segment in \('b2c','b2b'\)/);
  assert.match(migration, /commercial_modality in \('individual','professional','enterprise'\)/);
  assert.match(migration, /seat_pool_id uuid references public\.vc_seat_pools/);
  assert.match(migration, /seat_assignment_id uuid unique[\s\S]+vc_seat_assignments/);
  assert.match(migration, /cohort_capacity_exceeded/);
  assert.match(migration, /valid_user_seat_assignment_required/);
});

test("relatório corporativo é agregado e suprime amostras pequenas", () => {
  const migration = read("supabase/migrations/20260929233712_universidade_b2c_b2b_privacidade.sql");
  const api = read("supabase/functions/vc-universidade-empresa/index.ts");
  assert.match(migration, /privacy_mode text not null default 'aggregated_only'/);
  assert.match(migration, /minimum_report_group_size smallint not null default 5/);
  assert.match(migration, /vc_university_guard_corporate_report_privacy/);
  assert.match(migration, /revoke all on public\.vc_university_organizations,[\s\S]+vc_university_corporate_reports from public, anon, authenticated/);
  assert.match(api, /member_role=in\.\(owner,admin,manager\)/);
  assert.match(api, /privacy_suppressed: suppressed/);
  assert.match(api, /average_assessment: suppressed \|\| evaluated\.length < minimum \? null/);
  assert.doesNotMatch(api, /select=[^"\n]*(?:evidence|review_feedback|review_concepts|learner_name_snapshot)/);
});

test("gestor corporativo possui painel protegido e responsivo", () => {
  const page = read("gestao-empresa-universidade.html");
  const app = read("assets/js/universidade-empresa.js");
  const portal = read("assets/js/portal.js");
  const styles = read("assets/css/universidade.css");
  const vercel = JSON.parse(read("vercel.json"));
  assert.match(page, /noindex,nofollow/);
  assert.match(page, /Privacidade por padrão/);
  assert.match(app, /vc-universidade-empresa/);
  assert.match(app, /Indicadores protegidos/);
  assert.match(portal, /corporate-university-card/);
  assert.match(styles, /\.vc-corporate-cohorts/);
  assert.equal(vercel.rewrites.some((item) => item.source === "/empresa/universidade"), true);
});

test("administração distingue organizações sem expor conteúdo acadêmico", () => {
  const page = read("administracao-universidade.html");
  const app = read("assets/js/universidade-admin.js");
  const api = read("supabase/functions/vc-universidade-admin/index.ts");
  assert.match(page, /id="organizacoes"/);
  assert.match(page, /id="organization-rows"/);
  assert.match(app, /minimum_report_group_size/);
  assert.match(api, /active_organizations/);
  assert.match(api, /enterprise_cohorts/);
  assert.doesNotMatch(api, /select=[^"\n]*(?:,evidence(?:,|&)|review_feedback|review_concepts)/);
});

test("formação empresarial apresenta escopo, privacidade e solicitação sem cobrança", () => {
  const page = read("formacao-empresas.html");
  const privacy = read("privacidade.html");
  assert.match(page, /Liderança Estratégica Aplicada/);
  assert.match(page, /Indicadores acadêmicos são consolidados/);
  assert.match(page, /id="enterprise-proposal-form"/);
  assert.match(page, /name="consent"/);
  assert.match(page, /não cria cobrança nem contrato/i);
  assert.match(privacy, /finalidade/);
  assert.match(privacy, /até 12 meses/);
});

test("solicitação empresarial é validada no servidor e limitada contra abuso", () => {
  const app = read("assets/js/universidade-propostas.js");
  const api = read("supabase/functions/vc-universidade-propostas/index.ts");
  assert.match(app, /vc-universidade-propostas/);
  assert.match(app, /request_id/);
  assert.match(api, /trustedOrigin/);
  assert.match(api, /origin_not_allowed/);
  assert.match(api, /payload_too_large/);
  assert.match(api, /input\.website/);
  assert.match(api, /proposal_rate_limited/);
  assert.doesNotMatch(app, /service_role|SUPABASE_SECRET_KEY/i);
});

test("propostas possuem RLS, protocolo, idempotência e identidade imutável", () => {
  const migration = read("supabase/migrations/20261001153851_universidade_formacao_empresas_propostas.sql");
  assert.match(migration, /VC-PROP-/);
  assert.match(migration, /idempotency_key uuid not null unique/);
  assert.match(migration, /enable row level security/);
  assert.match(migration, /revoke all on public\.vc_university_proposal_requests from public, anon, authenticated/);
  assert.match(migration, /proposal_identity_is_immutable/);
  assert.match(migration, /proposal_rate_limited/);
  assert.match(migration, /quote_provider_target text not null default 'orca_facil'/);
  assert.match(migration, /acceptance_provider_target text not null default 'confirmapro'/);
});

test("administração recebe fila e usa transições comerciais auditáveis", () => {
  const page = read("administracao-universidade.html");
  const app = read("assets/js/universidade-admin.js");
  const api = read("supabase/functions/vc-universidade-admin/index.ts");
  assert.match(page, /id="propostas"/);
  assert.match(page, /id="proposal-rows"/);
  assert.match(app, /transition_proposal/);
  assert.match(api, /vc_university_transition_proposal/);
  assert.match(api, /proposalTransitions/);
  assert.match(api, /open_proposals/);
  assert.match(api, /não conectados/);
});

test("Orça Fácil e ConfirmaPro permanecem preparados sem integração fictícia", () => {
  const migration = read("supabase/migrations/20261001153851_universidade_formacao_empresas_propostas.sql");
  const api = read("supabase/functions/vc-universidade-admin/index.ts");
  assert.match(migration, /integration_state text not null default 'not_connected'/);
  assert.match(migration, /ready_for_manual_handoff/);
  assert.match(api, /Nenhuma proposta ou aceite é enviado automaticamente/);
  assert.doesNotMatch(read("assets/js/universidade-propostas.js"), /orca|confirma|external_ref/i);
});
