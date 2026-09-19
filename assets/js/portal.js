
const CONFIG = {
  supabaseUrl: "https://ctzgsxxbyvruzmfqibnl.supabase.co",
  publishableKey: "sb_publishable_rF60SyuGpNstim9MqFvqmQ_sSm78z1b",
  protectedApiUrl: "https://ctzgsxxbyvruzmfqibnl.supabase.co/functions/v1/vc-core-private-api",
  publicApiUrl: "https://ctzgsxxbyvruzmfqibnl.supabase.co/functions/v1/vc-core-api"
};

const SESSION_KEY = "vc_portal_session_v1";
const elements = {
  signinView: document.querySelector("#signin-view"),
  workspaceView: document.querySelector("#workspace-view"),
  form: document.querySelector("#signin-form"),
  email: document.querySelector("#email"),
  password: document.querySelector("#password"),
  signinButton: document.querySelector("#signin-button"),
  signupButton: document.querySelector("#signup-button"),
  recoveryButton: document.querySelector("#recovery-button"),
  authStatus: document.querySelector("#auth-status"),
  loginPanel: document.querySelector("#login-panel"),
  resetPanel: document.querySelector("#reset-panel"),
  resetForm: document.querySelector("#reset-form"),
  resetPassword: document.querySelector("#reset-password"),
  resetButton: document.querySelector("#reset-button"),
  resetStatus: document.querySelector("#reset-status"),
  signoutButton: document.querySelector("#signout-button"),
  accountCopy: document.querySelector("#account-copy"),
  workspaceStatus: document.querySelector("#workspace-status"),
  bootstrapSection: document.querySelector("#bootstrap-section"),
  bootstrapCopy: document.querySelector("#bootstrap-copy"),
  bootstrapStatus: document.querySelector("#bootstrap-status"),
  bootstrapAdminButton: document.querySelector("#bootstrap-admin-button"),
  accessSection: document.querySelector("#access-section"),
  accessGrid: document.querySelector("#access-grid"),
  accessCount: document.querySelector("#access-count"),
  emptyState: document.querySelector("#empty-state"),
  organizationSection: document.querySelector("#organization-section"),
  organizationList: document.querySelector("#organization-list"),
  acceptInvitationForm: document.querySelector("#accept-invitation-form"),
  invitationToken: document.querySelector("#invitation-token"),
  invitationStatus: document.querySelector("#invitation-status"),
  adminSection: document.querySelector("#admin-section"),
  adminScopeCopy: document.querySelector("#admin-scope-copy"),
  refreshAdminButton: document.querySelector("#refresh-admin-button"),
  createOrganizationCard: document.querySelector("#create-organization-card"),
  createOrganizationForm: document.querySelector("#create-organization-form"),
  createInvitationCard: document.querySelector("#create-invitation-card"),
  createInvitationForm: document.querySelector("#create-invitation-form"),
  inviteOrganization: document.querySelector("#invite-organization"),
  createSeatPoolCard: document.querySelector("#create-seat-pool-card"),
  createSeatPoolForm: document.querySelector("#create-seat-pool-form"),
  poolOrganization: document.querySelector("#pool-organization"),
  poolProduct: document.querySelector("#pool-product"),
  adminResult: document.querySelector("#admin-result"),
  adminOverviews: document.querySelector("#admin-overviews")
};

let currentSession = null;
let currentAdminScope = null;
let currentProducts = [];

function saveSession(session) {
  const safeSession = {
    access_token: session.access_token,
    refresh_token: session.refresh_token,
    expires_at: session.expires_at || Math.floor(Date.now() / 1000) + Number(session.expires_in || 3600),
    user: session.user ? { id: session.user.id, email: session.user.email } : undefined
  };
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(safeSession));
  return safeSession;
}

function readSession() {
  try {
    const session = JSON.parse(sessionStorage.getItem(SESSION_KEY) || "null");
    return session && session.access_token && session.refresh_token ? session : null;
  } catch {
    sessionStorage.removeItem(SESSION_KEY);
    return null;
  }
}

function clearSession() {
  sessionStorage.removeItem(SESSION_KEY);
}

function setSigninLoading(loading) {
  elements.signinButton.disabled = loading;
  elements.signupButton.disabled = loading;
  elements.recoveryButton.disabled = loading;
  elements.signinButton.classList.toggle("is-loading", loading);
  elements.email.disabled = loading;
  elements.password.disabled = loading;
}

function redirectUrl() {
  return window.location.origin + "/entrar";
}

function sessionFromUrl() {
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const accessToken = hash.get("access_token");
  const refreshToken = hash.get("refresh_token");
  const errorDescription = hash.get("error_description");
  const type = hash.get("type") || "";
  if (errorDescription) {
    history.replaceState({}, document.title, window.location.pathname);
    return { error: errorDescription };
  }
  if (!accessToken || !refreshToken) return null;
  const session = saveSession({
    access_token: accessToken,
    refresh_token: refreshToken,
    expires_in: Number(hash.get("expires_in") || 3600)
  });
  history.replaceState({}, document.title, window.location.pathname);
  return { session, type };
}

function humanAccessSource(source) {
  return ({ entitlement: "Licença individual", organization: "Benefício institucional", seat: "Acesso por licença" })[source] || "Acesso V&C";
}

function initials(name) {
  return String(name || "V&C").split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
}

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function renderAccessCard(access) {
  const card = element("article", "access-card");
  card.append(element("span", "product-mark", initials(access.product_name)));
  card.append(element("h3", "", access.product_name || access.product_id || "Produto V&C"));
  const details = [access.market, access.locale, access.channel ? "canal " + access.channel : null, access.version].filter(Boolean).join(" · ");
  card.append(element("p", "access-meta", details || "Edição oficial disponível"));

  const actions = element("div", "access-actions");
  actions.append(element("span", "source-label", humanAccessSource(access.access_source)));
  if (typeof access.launch_url === "string" && /^https:\/\//i.test(access.launch_url)) {
    const link = element("a", "launch-button", "Abrir produto");
    link.href = access.launch_url;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.setAttribute("aria-label", "Abrir " + (access.product_name || "produto") + " em nova aba");
    actions.append(link);
  }
  card.append(actions);
  return card;
}

function renderOrganization(organization) {
  const item = element("div", "organization-item");
  const copy = element("div");
  copy.append(element("strong", "", organization.organization_name || organization.name || "Organização V&C"));
  copy.append(element("span", "", organization.member_role ? "Papel: " + organization.member_role : "Vínculo ativo"));
  item.append(copy);
  item.append(element("span", "", organization.membership_status || organization.status || "active"));
  return item;
}

function idempotencyKey(operation) {
  return "portal:" + operation + ":" + crypto.randomUUID();
}

function setAdminResult(message, error = false) {
  elements.adminResult.hidden = false;
  elements.adminResult.classList.toggle("is-error", error);
  elements.adminResult.replaceChildren(element("span", "", message));
}

function setFormBusy(form, busy) {
  for (const control of form.elements) control.disabled = busy;
}

function populateOrganizationSelect(select, organizations) {
  select.replaceChildren(...organizations.map((organization) => {
    const option = element("option", "", organization.organization_name || organization.name || organization.organization_id);
    option.value = organization.organization_id;
    return option;
  }));
}

function populateProductSelect(products) {
  currentProducts = Array.isArray(products) ? products : [];
  const options = currentProducts.map((product) => {
    const option = element("option", "", product.canonical_name || product.product_id || "Produto V&C");
    option.value = product.product_id;
    return option;
  });
  if (options.length === 0) {
    const option = element("option", "", "Nenhum produto ativo no Registry");
    option.value = "";
    options.push(option);
  }
  elements.poolProduct.replaceChildren(...options);
  elements.poolProduct.disabled = currentProducts.length === 0;
}

function renderBootstrap(status) {
  const activationRequired = status?.activation_required === true;
  elements.bootstrapSection.hidden = !activationRequired;
  elements.bootstrapStatus.textContent = "";
  if (activationRequired && status?.expires_at) {
    const expiresAt = new Date(status.expires_at);
    elements.bootstrapCopy.textContent = "Autorização de uso único disponível para esta conta verificada até " +
      expiresAt.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) + ".";
  }
}

function renderOverview(payload) {
  const card = element("article", "overview-card");
  const head = element("div", "overview-head");
  head.append(element("h3", "", payload?.organization?.name || "Organização"));
  head.append(element("span", "", (payload?.seat_pools?.length || 0) + " pools"));
  card.append(head);
  const pools = element("div", "pool-list");
  const rows = Array.isArray(payload?.seat_pools) ? payload.seat_pools : [];
  if (rows.length === 0) pools.append(element("span", "access-meta", "Nenhuma licença coletiva criada."));
  for (const pool of rows) {
    const row = element("div", "pool-row");
    row.append(element("strong", "", pool.product_id || "Produto"));
    row.append(element("span", "", String(pool.seats_used || 0) + "/" + String(pool.seats_total || 0) + " acessos usados"));
    row.append(element("span", "", pool.status || "active"));
    pools.append(row);
  }
  card.append(pools);
  return card;
}

function showSignin(message = "") {
  elements.workspaceView.hidden = true;
  elements.signinView.hidden = false;
  elements.loginPanel.hidden = false;
  elements.resetPanel.hidden = true;
  elements.authStatus.textContent = message;
  if (message) elements.email.focus();
}

function showPasswordReset(session) {
  currentSession = session;
  elements.workspaceView.hidden = true;
  elements.signinView.hidden = false;
  elements.loginPanel.hidden = true;
  elements.resetPanel.hidden = false;
  elements.resetStatus.textContent = "";
  elements.resetPassword.focus();
}

function showWorkspace(session) {
  currentSession = session;
  elements.signinView.hidden = true;
  elements.workspaceView.hidden = false;
  elements.accountCopy.textContent = session?.user?.email ? "Acessos vigentes para " + session.user.email : "Produtos liberados para sua conta.";
  elements.workspaceStatus.hidden = false;
  elements.workspaceStatus.classList.remove("is-error");
  elements.workspaceStatus.replaceChildren(element("span", "spinner"), element("span", "", "Consultando seus direitos de acesso…"));
  elements.accessSection.hidden = true;
  elements.organizationSection.hidden = true;
  elements.adminSection.hidden = true;
  elements.bootstrapSection.hidden = true;
}

async function publicRequest(path) {
  const response = await fetch(CONFIG.publicApiUrl + path, {
    headers: { accept: "application/json" }
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload?.error?.code || "registry_request_failed");
    error.status = response.status;
    throw error;
  }
  return payload.data;
}

async function authRequest(path, body) {
  const response = await fetch(CONFIG.supabaseUrl + path, {
    method: "POST",
    headers: { apikey: CONFIG.publishableKey, "content-type": "application/json" },
    body: JSON.stringify(body)
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload.error_description || payload.msg || "authentication_failed");
    error.status = response.status;
    throw error;
  }
  return payload;
}

async function refreshSession(session) {
  if (!session?.refresh_token) return null;
  try {
    return saveSession(await authRequest("/auth/v1/token?grant_type=refresh_token", { refresh_token: session.refresh_token }));
  } catch {
    clearSession();
    return null;
  }
}

async function activeSession() {
  let session = readSession();
  if (!session) return null;
  if (Number(session.expires_at || 0) <= Math.floor(Date.now() / 1000) + 30) session = await refreshSession(session);
  return session;
}

async function protectedRequest(path, session, retried = false) {
  const response = await fetch(CONFIG.protectedApiUrl + path, {
    headers: { apikey: CONFIG.publishableKey, authorization: "Bearer " + session.access_token, accept: "application/json" }
  });
  if (response.status === 401 && !retried) {
    const renewed = await refreshSession(session);
    if (renewed) return protectedRequest(path, renewed, true);
  }
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload?.error?.code || "request_failed");
    error.status = response.status;
    throw error;
  }
  return payload.data;
}

async function protectedMutation(path, input, session, operation, useIdempotency = true, retried = false) {
  const headers = {
    apikey: CONFIG.publishableKey,
    authorization: "Bearer " + session.access_token,
    accept: "application/json",
    "content-type": "application/json"
  };
  if (useIdempotency) headers["idempotency-key"] = idempotencyKey(operation);
  const response = await fetch(CONFIG.protectedApiUrl + path, {
    method: "POST",
    headers,
    body: JSON.stringify(input)
  });
  if (response.status === 401 && !retried) {
    const renewed = await refreshSession(session);
    if (renewed) {
      currentSession = renewed;
      return protectedMutation(path, input, renewed, operation, useIdempotency, true);
    }
  }
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload?.error?.code || "request_failed");
    error.status = response.status;
    throw error;
  }
  return payload.data;
}

async function renderAdmin(scope, session) {
  currentAdminScope = scope;
  const organizations = Array.isArray(scope?.organizations) ? scope.organizations : [];
  const platformAdmin = scope?.platform_admin === true;
  const professorCard = document.querySelector("#professor-card");
  if (professorCard) professorCard.hidden = !platformAdmin;
  const ownerCourseCard = document.querySelector("#owner-course-card");
  if (ownerCourseCard) ownerCourseCard.hidden = !platformAdmin || session?.user?.email?.toLowerCase() !== "vcmenteconvergente@gmail.com";
  const ownerProduct = document.querySelector("#owner-product");
  if (ownerProduct && !ownerCourseCard.hidden) {
    ownerProduct.replaceChildren(...currentProducts.filter((product) => product.status === "active").map((product) => {
      const option = element("option", "", product.canonical_name || product.product_id);
      option.value = product.product_id;
      return option;
    }));
  }
  elements.adminSection.hidden = !platformAdmin && organizations.length === 0;
  if (elements.adminSection.hidden) return;

  elements.adminScopeCopy.textContent = platformAdmin
    ? "Administrador V&C — criação de organizações, convites e licenças coletivas."
    : "Administrador de organização — convites e acompanhamento dos acessos sob sua responsabilidade.";
  elements.createOrganizationCard.hidden = !platformAdmin;
  elements.createInvitationCard.hidden = organizations.length === 0;
  elements.createSeatPoolCard.hidden = !platformAdmin || organizations.length === 0;
  populateOrganizationSelect(elements.inviteOrganization, organizations);
  populateOrganizationSelect(elements.poolOrganization, organizations);

  const overviews = await Promise.all(organizations.map((organization) =>
    protectedRequest("/v1/organizations/" + organization.organization_id + "/overview", session)
      .catch(() => ({ organization: { name: organization.organization_name }, seat_pools: [] }))
  ));
  elements.adminOverviews.replaceChildren(...overviews.map(renderOverview));
}

async function refreshAdmin(session = currentSession) {
  if (!session) return;
  const scope = await protectedRequest("/v1/admin/scope", session);
  await renderAdmin(scope, session);
}

async function loadWorkspace(session) {
  showWorkspace(session);
  try {
    const [accessPayload, organizationPayload, adminScope, products, bootstrapStatus] = await Promise.all([
      protectedRequest("/v1/me/access?market=BR&locale=pt-BR", session),
      protectedRequest("/v1/me/organizations", session),
      protectedRequest("/v1/admin/scope", session),
      publicRequest("/v1/products"),
      protectedRequest("/v1/bootstrap/admin", session).catch((error) => {
        if (error.status === 400 || error.status === 404) return { activation_required: false };
        throw error;
      })
    ]);
    const accesses = Array.isArray(accessPayload?.accesses) ? accessPayload.accesses : [];
    const organizations = Array.isArray(organizationPayload?.organizations) ? organizationPayload.organizations : Array.isArray(organizationPayload) ? organizationPayload : [];

    elements.workspaceStatus.hidden = true;
    elements.accessSection.hidden = false;
    elements.accessGrid.replaceChildren(...accesses.map(renderAccessCard));
    elements.emptyState.hidden = accesses.length > 0;
    elements.accessCount.textContent = accesses.length + (accesses.length === 1 ? " acesso" : " acessos");

    elements.organizationList.replaceChildren(...organizations.map(renderOrganization));
    elements.organizationSection.hidden = organizations.length === 0;
    populateProductSelect(products);
    renderBootstrap(bootstrapStatus);
    await renderAdmin(adminScope, session);
  } catch (error) {
    if (error.status === 401) {
      clearSession();
      showSignin("Sua sessão expirou. Entre novamente para continuar.");
      return;
    }
    elements.workspaceStatus.classList.add("is-error");
    elements.workspaceStatus.replaceChildren(element("span", "", "Não foi possível consultar seus acessos agora. Tente novamente em instantes."));
  }
}

elements.form.addEventListener("submit", async (event) => {
  event.preventDefault();
  elements.authStatus.textContent = "";
  if (!elements.form.reportValidity()) return;
  setSigninLoading(true);
  try {
    const session = saveSession(await authRequest("/auth/v1/token?grant_type=password", {
      email: elements.email.value.trim(),
      password: elements.password.value
    }));
    elements.password.value = "";
    await loadWorkspace(session);
  } catch (error) {
    const message = error.status === 400 ? "E-mail ou senha não conferem." : "Não foi possível entrar agora. Tente novamente.";
    elements.authStatus.textContent = message;
  } finally {
    setSigninLoading(false);
  }
});

elements.signupButton.addEventListener("click", async () => {
  elements.authStatus.textContent = "";
  if (!elements.form.reportValidity()) return;
  setSigninLoading(true);
  try {
    const payload = await authRequest("/auth/v1/signup?redirect_to=" + encodeURIComponent(redirectUrl()), {
      email: elements.email.value.trim(),
      password: elements.password.value
    });
    elements.password.value = "";
    if (payload?.access_token && payload?.refresh_token) {
      await loadWorkspace(saveSession(payload));
      return;
    }
    elements.authStatus.textContent = "Conta iniciada. Abra o e-mail de confirmação enviado pela V&C para concluir o acesso.";
  } catch (error) {
    elements.authStatus.textContent = error.status === 422 || error.status === 400
      ? "Não foi possível criar a conta com esses dados. Se o e-mail já estiver cadastrado, use Entrar ou Esqueci minha senha."
      : "Não foi possível criar sua conta agora. Tente novamente.";
  } finally {
    setSigninLoading(false);
  }
});

elements.recoveryButton.addEventListener("click", async () => {
  elements.authStatus.textContent = "";
  if (!elements.email.reportValidity()) return;
  setSigninLoading(true);
  try {
    await authRequest("/auth/v1/recover?redirect_to=" + encodeURIComponent(redirectUrl()), {
      email: elements.email.value.trim()
    });
    elements.authStatus.textContent = "Se esse e-mail estiver cadastrado, enviaremos um link seguro para definir uma nova senha.";
  } catch {
    elements.authStatus.textContent = "Não foi possível iniciar a recuperação agora. Tente novamente.";
  } finally {
    setSigninLoading(false);
  }
});

elements.resetForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  elements.resetStatus.textContent = "";
  if (!elements.resetForm.reportValidity() || !currentSession) return;
  elements.resetButton.disabled = true;
  try {
    const response = await fetch(CONFIG.supabaseUrl + "/auth/v1/user", {
      method: "PUT",
      headers: {
        apikey: CONFIG.publishableKey,
        authorization: "Bearer " + currentSession.access_token,
        "content-type": "application/json"
      },
      body: JSON.stringify({ password: elements.resetPassword.value })
    });
    if (!response.ok) throw new Error("password_update_failed");
    elements.resetPassword.value = "";
    await loadWorkspace(currentSession);
  } catch {
    elements.resetStatus.textContent = "Não foi possível alterar a senha. Solicite um novo link de recuperação.";
  } finally {
    elements.resetButton.disabled = false;
  }
});

elements.bootstrapAdminButton.addEventListener("click", async () => {
  if (!currentSession) return;
  elements.bootstrapAdminButton.disabled = true;
  elements.bootstrapStatus.textContent = "Ativando a administração oficial…";
  try {
    await protectedMutation("/v1/bootstrap/admin", {}, currentSession, "bootstrap-admin", false);
    elements.bootstrapStatus.textContent = "Administração ativada com segurança.";
    await loadWorkspace(currentSession);
  } catch (error) {
    elements.bootstrapStatus.textContent = error.message === "platform_admin_invitation_not_found"
      ? "Esta conta não possui uma autorização administrativa válida."
      : "Não foi possível concluir a ativação agora.";
  } finally {
    elements.bootstrapAdminButton.disabled = false;
  }
});

elements.acceptInvitationForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  elements.invitationStatus.textContent = "";
  if (!elements.acceptInvitationForm.reportValidity() || !currentSession) return;
  setFormBusy(elements.acceptInvitationForm, true);
  try {
    await protectedMutation("/v1/invitations/accept", {
      invitation_token: elements.invitationToken.value.trim().toLowerCase()
    }, currentSession, "accept-invitation", false);
    elements.acceptInvitationForm.reset();
    elements.invitationStatus.textContent = "Convite aceito. Seus vínculos e acessos foram atualizados.";
    await loadWorkspace(currentSession);
  } catch (error) {
    elements.invitationStatus.textContent = error.message === "invitation_email_mismatch"
      ? "Este convite foi emitido para outro e-mail."
      : error.message === "invitation_not_pending" ? "Este convite já foi utilizado ou revogado."
      : "Não foi possível aceitar o convite. Confira o código e a validade.";
  } finally {
    setFormBusy(elements.acceptInvitationForm, false);
  }
});

elements.createOrganizationForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!elements.createOrganizationForm.reportValidity() || !currentSession) return;
  setFormBusy(elements.createOrganizationForm, true);
  try {
    const input = Object.fromEntries(new FormData(elements.createOrganizationForm));
    const result = await protectedMutation("/v1/admin/organizations", input, currentSession, "create-organization");
    elements.createOrganizationForm.reset();
    setAdminResult("Organização “" + result.organization_name + "” criada com você como responsável.");
    await refreshAdmin();
  } catch (error) {
    setAdminResult("Não foi possível criar a organização: " + error.message + ".", true);
  } finally {
    setFormBusy(elements.createOrganizationForm, false);
  }
});

elements.createInvitationForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!elements.createInvitationForm.reportValidity() || !currentSession) return;
  setFormBusy(elements.createInvitationForm, true);
  try {
    const input = Object.fromEntries(new FormData(elements.createInvitationForm));
    input.expires_in_days = Number(input.expires_in_days);
    const result = await protectedMutation(
      "/v1/organizations/" + input.organization_id + "/invitations",
      input,
      currentSession,
      "create-invitation"
    );
    elements.createInvitationForm.reset();
    populateOrganizationSelect(elements.inviteOrganization, currentAdminScope?.organizations || []);
    setAdminResult("Convite criado. O código é exibido uma única vez; copie-o agora.");
    if (result.token_returned && result.invitation_token) {
      const box = element("div", "invite-token-box");
      box.append(element("code", "", result.invitation_token));
      const copy = element("button", "copy-button", "Copiar código");
      copy.type = "button";
      copy.addEventListener("click", async () => {
        try {
          await navigator.clipboard.writeText(result.invitation_token);
          copy.textContent = "Código copiado";
        } catch {
          copy.textContent = "Selecione e copie o código";
        }
      });
      box.append(copy);
      elements.adminResult.append(box);
    }
  } catch (error) {
    setAdminResult("Não foi possível criar o convite: " + error.message + ".", true);
  } finally {
    setFormBusy(elements.createInvitationForm, false);
  }
});

elements.createSeatPoolForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!elements.createSeatPoolForm.reportValidity() || !currentSession) return;
  setFormBusy(elements.createSeatPoolForm, true);
  try {
    const input = Object.fromEntries(new FormData(elements.createSeatPoolForm));
    input.seats_total = Number(input.seats_total);
    const result = await protectedMutation("/v1/admin/seat-pools", input, currentSession, "create-seat-pool");
    setAdminResult("Pool criado: " + result.seats_total + " acessos de " + result.product_id + ".");
    await refreshAdmin();
  } catch (error) {
    setAdminResult("Não foi possível criar a licença coletiva: " + error.message + ".", true);
  } finally {
    setFormBusy(elements.createSeatPoolForm, false);
  }
});

elements.refreshAdminButton.addEventListener("click", async () => {
  if (!currentSession) return;
  elements.refreshAdminButton.disabled = true;
  try {
    await refreshAdmin();
    setAdminResult("Dados de gestão atualizados.");
  } catch {
    setAdminResult("Não foi possível atualizar a gestão agora.", true);
  } finally {
    elements.refreshAdminButton.disabled = false;
  }
});

document.querySelector("#owner-course-button")?.addEventListener("click", async (event) => {
  const button = event.currentTarget;
  const status = document.querySelector("#owner-course-status");
  if (!currentSession || currentAdminScope?.platform_admin !== true || currentSession.user?.email?.toLowerCase() !== "vcmenteconvergente@gmail.com") return;
  button.disabled = true;
  status.textContent = "Conferindo o direito de acesso…";
  try {
    const accesses = await protectedRequest("/v1/me/access?market=BR&locale=pt-BR", currentSession);
    if (!accesses?.accesses?.some((access) => access.product_id === "P-021")) {
      await protectedMutation("/v1/admin/entitlements", {
        subject_type: "person", subject_id: currentSession.user.id, product_id: "P-021", source_type: "admin",
        market: "BR", release_channel: "stable", starts_at: new Date().toISOString()
      }, currentSession, "owner-p021-access");
    }
    status.textContent = "Seu acesso ao curso foi autorizado. Abra a formação em Meus Acessos.";
    await loadWorkspace(currentSession);
  } catch { status.textContent = "Não foi possível liberar o acesso. Tente novamente mais tarde."; }
  finally { button.disabled = false; }
});

document.querySelector("#owner-product-button")?.addEventListener("click", async (event) => {
  const button = event.currentTarget;
  const status = document.querySelector("#owner-product-status");
  const productId = document.querySelector("#owner-product").value;
  if (!currentSession || currentAdminScope?.platform_admin !== true || currentSession.user?.email?.toLowerCase() !== "vcmenteconvergente@gmail.com" || !currentProducts.some((product) => product.product_id === productId && product.status === "active")) return;
  button.disabled = true;
  status.textContent = "Conferindo acesso ao produto…";
  try {
    const data = await protectedRequest("/v1/me/access?market=BR&locale=pt-BR", currentSession);
    if (!data?.accesses?.some((access) => access.product_id === productId)) {
      await protectedMutation("/v1/admin/entitlements", {
        subject_type: "person", subject_id: currentSession.user.id, product_id: productId, source_type: "admin",
        market: "BR", release_channel: "stable", starts_at: new Date().toISOString()
      }, currentSession, "owner-" + productId + "-access");
    }
    status.textContent = "Acesso registrado. Consulte o produto em Meus Acessos.";
    await loadWorkspace(currentSession);
  } catch { status.textContent = "Não foi possível liberar este produto agora."; }
  finally { button.disabled = false; }
});

elements.signoutButton.addEventListener("click", async () => {
  const session = readSession();
  clearSession();
  currentSession = null;
  currentAdminScope = null;
  if (session?.access_token) {
    await fetch(CONFIG.supabaseUrl + "/auth/v1/logout", {
      method: "POST",
      headers: { apikey: CONFIG.publishableKey, authorization: "Bearer " + session.access_token }
    }).catch(() => undefined);
  }
  elements.form.reset();
  showSignin("Sessão encerrada com segurança.");
});

const callback = sessionFromUrl();
if (callback?.error) {
  showSignin("O link de acesso não pôde ser validado. Solicite um novo link.");
} else if (callback?.session && callback.type === "recovery") {
  showPasswordReset(callback.session);
} else {
  const initialSession = callback?.session || await activeSession();
  if (initialSession) await loadWorkspace(initialSession);
  else showSignin();
}
