const siteConfig = {
  whatsappNumber: "5500000000000",
  instagramUrl: "https://www.instagram.com/menteinfinita",
  email: "contato@menteinfinita.com.br"
};

const navItems = [
  ["index.html", "In\u00edcio", "home"],
  ["metodo-real.html", "M\u00e9todo REAL", "real"],
  ["pessoas.html", "Para Pessoas", "pessoas"],
  ["empresas.html", "Para Empresas", "empresas"],
  ["escolas.html", "Para Escolas", "escolas"],
  ["familias.html", "Para Fam\u00edlias", "familias"],
  ["universidade-real.html", "Universidade REAL", "universidade"],
  ["livros.html", "Livros", "livros"],
  ["palestras.html", "Palestras", "palestras"],
  ["sobre-edgar.html", "Sobre Edgar", "sobre"],
  ["contato.html", "Contato", "contato"]
];

function renderHeader() {
  const page = document.body.dataset.page || "";
  const header = document.querySelector("[data-site-header]");
  if (!header) return;
  header.innerHTML = `
    <div class="nav-wrap">
      <a class="brand" href="index.html" aria-label="Mente Infinita"><img src="assets/images/logo-mente-infinita.svg" alt="Mente Infinita"></a>
      <button class="nav-toggle" aria-label="Abrir menu" aria-expanded="false"><span></span><span></span><span></span></button>
      <nav class="main-nav" aria-label="Menu principal">
        ${navItems.map(([href, label, key]) => `<a class="${page === key ? "active" : ""}" href="${href}">${label}</a>`).join("")}
      </nav>
      <a class="header-cta" href="real-360-psicossocial.html">REAL 360 Psicossocial</a>
    </div>`;
}

function renderFooter() {
  const footer = document.querySelector("[data-site-footer]");
  if (!footer) return;
  footer.innerHTML = `
    <div class="footer-inner">
      <div class="footer-grid">
        <div><img src="assets/images/logo-mente-infinita.svg" alt="Mente Infinita" width="210"><p>A porta de entrada de um ecossistema global de desenvolvimento humano, sa&uacute;de mental organizacional e intelig&ecirc;ncia emocional aplicada.</p></div>
        <div><h3>Ecossistema</h3><a href="pessoas.html">Pessoas</a><a href="empresas.html">Empresas</a><a href="escolas.html">Escolas</a><a href="familias.html">Fam&iacute;lias</a></div>
        <div><h3>Plataformas</h3><a href="metodo-real.html">M&eacute;todo REAL</a><a href="real-360-psicossocial.html">REAL 360 Psicossocial</a><a href="case-zero.html">CASE ZERO</a><a href="universidade-real.html">Universidade REAL</a></div>
        <div><h3>Contato</h3><a data-whatsapp data-message="Ola, Edgar. Quero falar sobre a Mente Infinita.">WhatsApp</a><a data-instagram>Instagram</a><a href="blog.html">Blog</a><a data-email>E-mail</a><a href="contato.html">Formul&aacute;rios</a></div>
      </div>
      <div class="footer-bottom">&copy; 2026 Mente Infinita. Consci&ecirc;ncia &bull; Evolu&ccedil;&atilde;o &bull; Possibilidade. A REAL 360&deg; Psicossocial apoia gest&atilde;o e desenvolvimento; n&atilde;o realiza diagn&oacute;stico cl&iacute;nico nem substitui avalia&ccedil;&atilde;o especializada.</div>
    </div>`;
}

function setupForms() {
  document.querySelectorAll("form").forEach((form) => {
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const success = form.querySelector(".form-success");
      if (success) success.hidden = false;
      form.reset();
    });
  });
}

function setupLinks() {
  document.querySelectorAll("[data-whatsapp]").forEach((link) => {
    const message = encodeURIComponent(link.getAttribute("data-message") || "Ola, Edgar. Quero conhecer a Mente Infinita.");
    link.href = `https://wa.me/${siteConfig.whatsappNumber}?text=${message}`;
    link.target = "_blank";
    link.rel = "noopener";
  });
  document.querySelectorAll("[data-instagram]").forEach((link) => {
    link.href = siteConfig.instagramUrl;
    link.target = "_blank";
    link.rel = "noopener";
  });
  document.querySelectorAll("[data-email]").forEach((link) => {
    link.href = `mailto:${siteConfig.email}`;
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
}

renderHeader();
renderFooter();
setupForms();
setupLinks();
setupNav();
