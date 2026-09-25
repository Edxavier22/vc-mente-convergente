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

test("navegação consolidada aponta para catálogo e portal", () => {
  const script = read("assets/js/main.js");
  assert.match(script, /produtos\.html/);
  assert.match(script, /entrar\.html/);
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
});

test("configuração Vercel mantém um único site com rotas internas", () => {
  const config = JSON.parse(read("vercel.json"));
  assert.equal(config.cleanUrls, true);
  assert.ok(config.rewrites.some((item) => item.source === "/meus-acessos" && item.destination === "/entrar"));
  assert.ok(config.rewrites.some((item) => item.source === "/admin" && item.destination === "/entrar"));
  assert.ok(config.rewrites.every((item) => !item.destination.endsWith(".html")));
  const headers = JSON.stringify(config.headers);
  assert.match(headers, /Content-Security-Policy/);
  assert.match(headers, /frame-ancestors 'none'/);
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
});
