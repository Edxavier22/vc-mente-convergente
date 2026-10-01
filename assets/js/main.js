const siteConfig = {
  email: "vcmenteconvergente@gmail.com"
};

const navItems = [
  ["index.html", "Início", "home"],
  ["produtos.html", "Soluções", "produtos"],
  ["empresas.html", "Para Empresas", "empresas"],
  ["escolas.html", "Para Escolas", "escolas"],
  ["palestras.html", "Palestras", "palestras"],
  ["universidade-vc.html", "Universidade V&C", "universidade"],
  ["sobre-edgar.html", "Sobre Edgar", "sobre"],
  ["contato.html", "Contato", "contato"]
];

function renderHeader() {
  const page = document.body.dataset.page || "";
  const header = document.querySelector("[data-site-header]");
  if (!header) return;
  header.innerHTML = `
    <div class="nav-wrap">
      <a class="brand" href="index.html" aria-label="V&C Mente Convergente"><img src="assets/images/logo-vc-mente-convergente.svg" alt="V&C Mente Convergente"></a>
      <button class="nav-toggle" aria-label="Abrir menu" aria-expanded="false"><span></span><span></span><span></span></button>
      <nav class="main-nav" aria-label="Menu principal">
        ${navItems.map(([href, label, key]) => `<a class="${page === key ? "active" : ""}" href="${href}">${label}</a>`).join("")}
      </nav>
      <a class="header-cta" href="entrar.html">Meus acessos</a>
    </div>`;
}

function renderFooter() {
  const footer = document.querySelector("[data-site-footer]");
  if (!footer) return;
  footer.innerHTML = `
    <div class="footer-inner">
      <div class="footer-grid">
        <div><img src="assets/images/logo-vc-mente-convergente.svg" alt="V&C Mente Convergente" width="270"><p>Vidas conectadas ao propósito por meio de desenvolvimento humano, tecnologia, educação e sistemas práticos.</p></div>
        <div><h3>Ecossistema</h3><a href="produtos.html">Todas as soluções</a><a href="pessoas.html">Pessoas</a><a href="empresas.html">Empresas</a><a href="escolas.html">Escolas</a><a href="familias.html">Famílias</a></div>
        <div><h3>Plataformas</h3><a href="metodo-real.html">Método REAL</a><a href="real-360-psicossocial.html">REAL 360 Psicossocial</a><a href="universidade-vc.html">Universidade V&amp;C</a><a href="entrar.html">Meus acessos</a></div>
        <div><h3>Contato</h3><a href="palestras.html">Palestras</a><a href="livros.html">Livros</a><a href="blog.html">Conteúdos</a><a data-email>E-mail oficial</a><a href="contato.html">Fale com a V&C</a><a href="privacidade.html">Privacidade</a></div>
      </div>
      <div class="footer-bottom">&copy; 2026 V&amp;C Mente Convergente. Vidas conectadas ao propósito. O REAL 360&deg; Psicossocial apoia gestão e desenvolvimento; não realiza diagnóstico clínico nem substitui avaliação especializada.</div>
    </div>`;
}

function setupForms() {
  document.querySelectorAll("form:not([data-managed-form])").forEach((form) => {
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (!form.reportValidity()) return;
      const fields = [...form.elements]
        .filter((field) => field.tagName !== "BUTTON" && String(field.value || "").trim())
        .map((field) => {
          const label = field.name || field.getAttribute("placeholder") || field.tagName.toLowerCase();
          return `${label}: ${String(field.value).trim()}`;
        });
      const pageTitle = document.querySelector("h1")?.textContent?.trim() || "Contato";
      const message = [
        `Assunto: Contato pelo site V&C — ${pageTitle}`,
        `Destinatário: ${siteConfig.email}`,
        "",
        "Olá, equipe V&C Mente Convergente.",
        "",
        ...fields,
        "",
        `Origem: ${window.location.href}`
      ].join("\n");
      const success = form.querySelector(".form-success");
      let copied = false;
      try {
        await navigator.clipboard.writeText(message);
        copied = true;
      } catch {
        const helper = document.createElement("textarea");
        helper.value = message;
        helper.setAttribute("readonly", "");
        helper.style.position = "fixed";
        helper.style.opacity = "0";
        document.body.append(helper);
        helper.select();
        copied = document.execCommand("copy");
        helper.remove();
      }
      if (success) {
        success.textContent = copied
          ? `Mensagem copiada. Cole no seu e-mail e envie para ${siteConfig.email}.`
          : `Envie estas informações para ${siteConfig.email}. Não foi possível copiar automaticamente neste navegador.`;
        success.hidden = false;
        success.focus?.();
      }
    });
  });
}

function setupLinks() {
  document.querySelectorAll("[data-whatsapp]").forEach((link) => {
    link.href = "contato.html#formulario";
  });
  document.querySelectorAll("[data-email]").forEach((link) => {
    link.href = "contato.html#formulario";
  });
}

function setupNav() {
  const navToggle = document.querySelector(".nav-toggle");
  const mainNav = document.querySelector(".main-nav");
  if (!navToggle || !mainNav) return;
  navToggle.addEventListener("click", () => {
    const isOpen = mainNav.classList.toggle("open");
    navToggle.setAttribute("aria-expanded", String(isOpen));
  });
  mainNav.querySelectorAll("a").forEach((link) => link.addEventListener("click", () => {
    mainNav.classList.remove("open");
    navToggle.setAttribute("aria-expanded", "false");
  }));
}

renderHeader();
renderFooter();
setupForms();
setupLinks();
setupNav();
