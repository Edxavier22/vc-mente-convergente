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
        <div><h3>Contato</h3><a href="palestras.html">Palestras</a><a href="livros.html">Livros</a><a href="blog.html">Conteúdos</a><a data-email>E-mail oficial</a><a href="contato.html">Fale com a V&C</a></div>
      </div>
      <div class="footer-bottom">&copy; 2026 V&amp;C Mente Convergente. Vidas conectadas ao propósito. O REAL 360&deg; Psicossocial apoia gestão e desenvolvimento; não realiza diagnóstico clínico nem substitui avaliação especializada.</div>
    </div>`;
}

function setupForms() {
  document.querySelectorAll("form").forEach((form) => {
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      if (!form.reportValidity()) return;
      const fields = [...form.elements]
        .filter((field) => field.tagName !== "BUTTON" && String(field.value || "").trim())
        .map((field) => {
          const label = field.name || field.getAttribute("placeholder") || field.tagName.toLowerCase();
          return `${label}: ${String(field.value).trim()}`;
        });
      const pageTitle = document.querySelector("h1")?.textContent?.trim() || "Contato";
      const subject = encodeURIComponent(`Contato pelo site V&C — ${pageTitle}`);
      const body = encodeURIComponent([
        "Olá, equipe V&C Mente Convergente.",
        "",
        ...fields,
        "",
        `Origem: ${window.location.href}`
      ].join("\n"));
      const success = form.querySelector(".form-success");
      if (success) {
        success.textContent = "Abrimos seu aplicativo de e-mail com a mensagem preenchida. Revise e toque em Enviar.";
        success.hidden = false;
      }
      window.location.href = `mailto:${siteConfig.email}?subject=${subject}&body=${body}`;
    });
  });
}

function setupLinks() {
  document.querySelectorAll("[data-whatsapp]").forEach((link) => {
    const message = link.getAttribute("data-message") || "Olá. Quero conhecer a V&C Mente Convergente.";
    link.href = `mailto:${siteConfig.email}?subject=${encodeURIComponent("Contato pelo site V&C")}&body=${encodeURIComponent(message)}`;
  });
  document.querySelectorAll("[data-email]").forEach((link) => {
    const subject = link.getAttribute("data-subject") || "Contato pelo site V&C";
    link.href = `mailto:${siteConfig.email}?subject=${encodeURIComponent(subject)}`;
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
