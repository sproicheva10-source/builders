const dashboardRole = document.body.dataset.dashboard;
const isProfessionalDashboard = dashboardRole === "professional";
const toast = document.querySelector("#dashboard-toast");
const storagePrefix = `stroihub_${dashboardRole}_dashboard`;
const serviceImages = {
  "ВиК услуги": "images/plumbing_services.jpg",
  "Електро услуги": "images/electrical_services.jpg",
  "Боядисване": "images/painting.jpg",
  "Строителство": "images/construction.jpg",
  "Ремонти": "images/repairs.jpg",
  "Монтажи": "images/montage.jpg",
  "Дограма и остъкляване": "images/glazing.jpg",
  "Почистване": "images/cleaning.jpg"
};
let toastTimeout;
let professionals = [];
let favoriteIds = [];
let isPreviewMode = false;

function readStoredValue(key, fallback) {
  const value = localStorage.getItem(`${storagePrefix}_${key}`);
  if (!value) return fallback;
  try {
    return JSON.parse(value);
  } catch {
    localStorage.removeItem(`${storagePrefix}_${key}`);
    return fallback;
  }
}

function writeStoredValue(key, value) {
  try {
    localStorage.setItem(`${storagePrefix}_${key}`, JSON.stringify(value));
    return true;
  } catch {
    showToast("Промяната не може да бъде запазена в този браузър.");
    return false;
  }
}

function apiHeaders() {
  const token = localStorage.getItem("stroihub_token") || sessionStorage.getItem("stroihub_token");
  if (!token) throw new Error("Сесията е изтекла. Влез отново.");
  return {Authorization:`Bearer ${token}`};
}

async function apiRequest(url, options = {}) {
  const response = await fetch(url, options);
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 401) {
      localStorage.removeItem("stroihub_token");
      localStorage.removeItem("stroihub_user");
      sessionStorage.removeItem("stroihub_token");
      sessionStorage.removeItem("stroihub_user");
      window.location.replace("login.html");
      throw new Error("Сесията е изтекла. Влез отново.");
    }
    throw new Error(result.message || "Заявката не беше изпълнена. Опитай отново.");
  }
  return result;
}

function showToast(message) {
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add("show");
  window.clearTimeout(toastTimeout);
  toastTimeout = window.setTimeout(() => toast.classList.remove("show"), 3200);
}

function createTextElement(tagName, className, text) {
  const element = document.createElement(tagName);
  if (className) element.className = className;
  element.textContent = text;
  return element;
}

function getMatchingUser() {
  const storedUser = localStorage.getItem("stroihub_user") || sessionStorage.getItem("stroihub_user");
  if (!storedUser) return null;
  try {
    const user = JSON.parse(storedUser);
    const matchingRole = isProfessionalDashboard
      ? user.role === "professional" || user.role === "company"
      : user.role === "client";
    return matchingRole ? user : null;
  } catch {
    return null;
  }
}

function updateUserDisplay(name) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const firstName = parts[0] || name;
  const initials = parts.slice(0, 2).map((part) => part[0]).join("").toLocaleUpperCase("bg-BG");
  document.querySelectorAll("[data-user-name]").forEach((element) => { element.textContent = name; });
  document.querySelectorAll("[data-first-name]").forEach((element) => { element.textContent = firstName; });
  document.querySelectorAll("[data-user-initials]").forEach((element) => { element.textContent = initials; });
  const professionalName = document.querySelector("[data-professional-name]");
  if (professionalName && isProfessionalDashboard) professionalName.textContent = name;
}

function initializeProfile() {
  const demoProfile = isProfessionalDashboard
    ? {name:"", city:"", phone:"", email:"", experience:"", description:""}
    : {name:"", email:"", city:"", phone:""};
  const savedProfile = readStoredValue("profile", {});
  const user = getMatchingUser();
  const profile = {
    ...demoProfile,
    ...(user?.name ? {name:user.name} : {}),
    ...(user?.email ? {email:user.email} : {}),
    ...(user?.phone ? {phone:user.phone} : {}),
    ...(user?.city ? {city:user.city} : {}),
    ...(user?.profileDescription ? {description:user.profileDescription} : {}),
    ...(user?.experience !== undefined ? {experience:String(user.experience)} : {}),
    ...savedProfile
  };
  updateUserDisplay(profile.name);

  const profileForm = document.querySelector("#client-profile-form");
  if (profileForm) {
    for (const [field, value] of Object.entries(profile)) {
      if (profileForm.elements[field] && value) profileForm.elements[field].value = value;
    }
    if (profile.requestNotifications !== undefined) profileForm.elements.requestNotifications.checked = profile.requestNotifications;
    if (profile.reviewNotifications !== undefined) profileForm.elements.reviewNotifications.checked = profile.reviewNotifications;
  }

  const professionalForm = document.querySelector("#professional-profile-form");
  if (professionalForm) {
    for (const [field, value] of Object.entries(profile)) {
      const input = professionalForm.elements[field];
      if (!input || value === undefined || value === null) continue;
      if (input.type === "checkbox") input.checked = Boolean(value);
      else if (value !== "") input.value = value;
    }
    updateProfessionalSummary(professionalForm);
  }

  const settingsForm = document.querySelector("#professional-settings-form");
  if (settingsForm) {
    const savedSettings = readStoredValue("settings", {});
    for (const input of settingsForm.querySelectorAll('input[type="checkbox"]')) {
      if (savedSettings[input.name] !== undefined) input.checked = savedSettings[input.name];
    }
  }
}

function updateProfessionalSummary(form) {
  const name = form.elements.name.value.trim();
  const city = form.elements.city.value.trim();
  const experience = form.elements.experience.value;
  const description = form.elements.description.value.trim();
  const summaryName = document.querySelector("[data-professional-name]");
  const summary = document.querySelector(".profile-summary-copy");
  if (summaryName) summaryName.textContent = name;
  if (summary) {
    const location = summary.querySelector("[data-professional-location]");
    const summaryDescription = summary.querySelector("[data-professional-description]");
    if (location) location.textContent = `${city}${experience ? ` · ${experience} години опит` : ""}`;
    if (summaryDescription) summaryDescription.textContent = description;
  }
}

function initializeSectionNavigation() {
  const links = [...document.querySelectorAll(".header-links a[href^='#']")];
  const sections = links.map((link) => document.querySelector(link.hash)).filter(Boolean);
  if (!("IntersectionObserver" in window)) return;
  const observer = new IntersectionObserver((entries) => {
    const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
    if (!visible) return;
    links.forEach((link) => {
      const active = link.hash === `#${visible.target.id}`;
      link.classList.toggle("active", active);
      if (active) link.setAttribute("aria-current", "page");
      else link.removeAttribute("aria-current");
    });
  }, {rootMargin:"-20% 0px -65% 0px", threshold:[0, .2, .5]});
  sections.forEach((section) => observer.observe(section));
}

function initializeLogout() {
  document.querySelectorAll("[data-logout]").forEach((button) => button.addEventListener("click", () => {
    const shouldLeave = window.confirm("Да излезеш ли от профила?");
    if (!shouldLeave) return;
    const token = localStorage.getItem("stroihub_token") || sessionStorage.getItem("stroihub_token");
    fetch("/api/auth/logout", {method:"POST", headers:{Authorization:`Bearer ${token}`}})
      .then((response) => {
        if (!response.ok && response.status !== 401) throw new Error("Не успяхме да прекратим сесията. Опитай отново.");
        localStorage.removeItem("stroihub_token");
        localStorage.removeItem("stroihub_user");
        sessionStorage.removeItem("stroihub_token");
        sessionStorage.removeItem("stroihub_user");
        window.location.href = "index.html";
      })
      .catch((error) => showToast(error.message));
  }));
}

function initializePreviewMode() {
  isPreviewMode = true;
  document.body.classList.add("demo-preview");

  const headerUser = document.querySelector(".header-user");
  if (headerUser) {
    const login = createTextElement("a", "text-button", "Вход");
    login.href = "login.html";
    const register = createTextElement("a", "button button-primary button-small", "Създай профил");
    register.href = "register.html";
    headerUser.replaceChildren(login, register);
  }

  const main = document.querySelector(".dashboard-main");
  if (main) {
    const notice = document.createElement("aside");
    notice.className = "preview-notice";
    notice.setAttribute("role", "note");
    notice.append(
      createTextElement("strong", "", "Преглеждате таблото без вход."),
      createTextElement("span", "", "Личните данни и действията се показват след вход в профила."),
      Object.assign(document.createElement("a"), {href:"login.html", textContent:"Влезте в профила си"})
    );
    main.prepend(notice);
  }

  document.querySelectorAll("#client-profile-form, #professional-profile-form, #professional-settings-form").forEach((form) => {
    form.hidden = true;
  });
  document.querySelectorAll("[data-open-dialog], [data-toggle-panel]").forEach((button) => {
    button.disabled = true;
    button.title = "Влезте в профила си, за да използвате тази функция.";
  });

  const profileSection = document.querySelector("#profile");
  if (profileSection) {
    profileSection.append(createTextElement("p", "preview-hint", "Влезте, за да преглеждате и редактирате данните на профила."));
  }

  if (isProfessionalDashboard) {
    document.querySelector("#service-list")?.replaceChildren(createTextElement("p", "empty-copy", "Влезте, за да преглеждате и управлявате услугите."));
    document.querySelector("#portfolio-grid")?.replaceChildren(createTextElement("p", "empty-copy", "Влезте, за да преглеждате и управлявате портфолиото."));
    document.querySelector("#incoming-requests")?.replaceChildren(createTextElement("p", "empty-copy", "Влезте, за да преглеждате получените запитвания."));
    document.querySelectorAll("[data-active-service-count], [data-incoming-request-count]").forEach((element) => { element.textContent = "—"; });
  } else {
    document.querySelector("#request-list")?.replaceChildren(createTextElement("p", "empty-copy", "Влезте, за да преглеждате личните си запитвания."));
    document.querySelector("#favorite-list")?.replaceChildren(createTextElement("p", "empty-copy", "Влезте, за да преглеждате запазените специалисти."));
    document.querySelector("#activity-list")?.replaceChildren(createTextElement("li", "", "Влезте, за да преглеждате известията."));
  }
}

function renderFavorites() {
  const list = document.querySelector("#favorite-list");
  const count = document.querySelector("[data-favorites-count]");
  if (isPreviewMode) {
    if (count) count.textContent = "—";
    if (list) list.replaceChildren(createTextElement("p", "empty-copy", "Влезте, за да преглеждате запазените специалисти."));
    return;
  }
  if (count) count.textContent = String(favoriteIds.length);
  document.querySelectorAll("[data-favorite]").forEach((button) => {
    const selected = favoriteIds.includes(button.dataset.favorite);
    button.setAttribute("aria-pressed", String(selected));
    button.textContent = selected ? "Премахни от любими" : "Добави в любими";
  });
  if (!list) return;
  list.replaceChildren();
  const savedProfessionals = professionals.filter((professional, index, entries) =>
    favoriteIds.includes(professional.id) && entries.findIndex((entry) => entry.id === professional.id) === index
  );
  if (!savedProfessionals.length) {
    list.append(createTextElement("p", "empty-copy", "Запази профил, за да го намериш лесно по-късно."));
    return;
  }
  savedProfessionals.forEach((professional) => {
    const entry = document.createElement("article");
    entry.className = "favorite-entry";
    const image = document.createElement("img");
    image.src = serviceImages[professional.service] || serviceImages["Строителство"];
    image.alt = "";
    const copy = document.createElement("div");
    copy.append(createTextElement("strong", "", professional.name), createTextElement("small", "", `${professional.service} · ${professional.city}`));
    const remove = createTextElement("button", "", "Премахни");
    remove.type = "button";
    remove.addEventListener("click", () => { void toggleFavorite(professional.id); });
    entry.append(image, copy, remove);
    list.append(entry);
  });
}

async function initializeFavorites() {
  const buttons = [...document.querySelectorAll("[data-favorite]")];
  if (!buttons.length && !document.querySelector("#favorite-list")) return;
  const list = document.querySelector("#favorite-list");
  try {
    favoriteIds = await apiRequest("/api/account/favorites", {headers:apiHeaders()});
  } catch (error) {
    if (list) list.replaceChildren(createTextElement("p", "empty-copy", error.message));
    else showToast(error.message);
    return;
  }
  renderFavorites();
  buttons.forEach((button) => button.addEventListener("click", () => { void toggleFavorite(button.dataset.favorite); }));
}

async function toggleFavorite(professionalId) {
  const updated = favoriteIds.includes(professionalId)
    ? favoriteIds.filter((id) => id !== professionalId)
    : [...favoriteIds, professionalId];
  try {
    favoriteIds = await apiRequest("/api/account/favorites", {
      method:"PUT",
      headers:{...apiHeaders(), "Content-Type":"application/json"},
      body:JSON.stringify({professionalIds:updated})
    });
    renderFavorites();
    showToast(favoriteIds.includes(professionalId) ? "Профилът е добавен в любимите." : "Профилът е премахнат от любимите.");
  } catch (error) {
    showToast(error.message);
  }
}

function renderProfessionalCards(service = "", city = "") {
  const grid = document.querySelector("#professional-grid");
  if (!grid) return;
  const filtered = professionals.filter((professional) =>
    (!service || professional.service === service) &&
    (!city || professional.city.toLocaleLowerCase("bg").includes(city.toLocaleLowerCase("bg")))
  );
  grid.replaceChildren();
  filtered.forEach((professional) => {
    const card = document.createElement("article");
    card.className = "professional-card";
    const image = document.createElement("img");
    image.className = "professional-image";
    image.src = serviceImages[professional.service] || serviceImages["Строителство"];
    image.alt = professional.service;
    const content = document.createElement("div");
    content.className = "professional-card-body";
    content.append(
      createTextElement("span", "service-tag", professional.service),
      createTextElement("h3", "", professional.name),
      createTextElement("p", "", professional.city),
      createTextElement("p", "professional-description", professional.description)
    );
    const actions = document.createElement("div");
    actions.className = "card-actions";
    const profileLink = createTextElement("a", "button button-primary button-small", "Разгледай профила");
    profileLink.href = `professional-profile.html?id=${encodeURIComponent(professional.id)}`;
    if (isPreviewMode) {
      const loginLink = createTextElement("a", "button button-outline button-small", "Вход за любими и запитвания");
      loginLink.href = "login.html";
      actions.append(profileLink, loginLink);
    } else {
      const favorite = createTextElement("button", "favorite-button", "");
      favorite.type = "button";
      favorite.dataset.favorite = professional.id;
      favorite.setAttribute("aria-pressed", String(favoriteIds.includes(professional.id)));
      favorite.textContent = favoriteIds.includes(professional.id) ? "Премахни от любими" : "Добави в любими";
      favorite.addEventListener("click", () => { void toggleFavorite(professional.id); });
      const request = createTextElement("button", "button button-outline button-small", "Изпрати запитване");
      request.type = "button";
      request.addEventListener("click", () => openRequestDialog(professional));
      actions.append(profileLink, favorite, request);
    }
    content.append(actions);
    card.append(image, content);
    grid.append(card);
  });
  const emptyState = document.querySelector("#no-results");
  if (emptyState) {
    emptyState.hidden = filtered.length > 0;
    emptyState.textContent = professionals.length
      ? "Не открихме специалисти по тези критерии. Промени населеното място или избери друга категория."
      : "Все още няма публикувани профили. Опитай отново по-късно.";
  }
  const feedback = document.querySelector("#search-feedback");
  if (feedback) feedback.textContent = `Намерени профили: ${filtered.length}.`;
  const specialistSelect = document.querySelector("#new-request-form [name='professionalId']");
  if (specialistSelect) {
    const selected = specialistSelect.value;
    specialistSelect.replaceChildren(new Option("Избери специалист", ""));
    professionals.forEach((professional) => {
      specialistSelect.add(new Option(`${professional.name} · ${professional.service}, ${professional.city}`, professional.id));
    });
    specialistSelect.value = selected;
  }
  renderFavorites();
}

function openRequestDialog(professional) {
  if (isPreviewMode) {
    window.location.href = "login.html";
    return;
  }
  const dialog = document.querySelector("#request-dialog");
  const form = document.querySelector("#new-request-form");
  if (!dialog || !form) return;
  form.elements.professionalId.value = professional.id;
  form.elements.service.value = professional.service;
  form.elements.city.value = professional.city;
  const profile = getMatchingUser();
  form.elements.phone.value = profile?.phone || "";
  dialog.showModal();
}

async function loadClientDirectory() {
  const grid = document.querySelector("#professional-grid");
  if (grid) grid.replaceChildren(createTextElement("p", "empty-copy", "Зареждане на профилите…"));
  try {
    professionals = await apiRequest("/api/professionals");
    renderProfessionalCards();
  } catch (error) {
    if (grid) grid.replaceChildren(createTextElement("p", "empty-copy", error.message));
    const emptyState = document.querySelector("#no-results");
    if (emptyState) emptyState.hidden = true;
  }
}

function initializeClientSearch() {
  const form = document.querySelector("#specialist-search");
  if (!form) return;
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    renderProfessionalCards(form.elements.service.value, form.elements.city.value);
    document.querySelector("#specialists")?.scrollIntoView({behavior:"smooth"});
  });
  document.querySelectorAll("[data-category-filter]").forEach((link) => link.addEventListener("click", () => {
    form.elements.service.value = link.dataset.categoryFilter;
    renderProfessionalCards(form.elements.service.value, form.elements.city.value);
  }));
  return loadClientDirectory();
}

function initializeClientProfile() {
  const form = document.querySelector("#client-profile-form");
  if (!form) return;
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const profile = {
      name:form.elements.name.value.trim(),
      email:form.elements.email.value.trim(),
      city:form.elements.city.value.trim(),
      phone:form.elements.phone.value.trim(),
      requestNotifications:form.elements.requestNotifications.checked,
      reviewNotifications:form.elements.reviewNotifications.checked
    };
    const feedback = document.querySelector("#profile-feedback");
    if (feedback) feedback.textContent = "Запазване…";
    try {
      const result = await apiRequest("/api/account", {
        method:"PUT",
        headers:{...apiHeaders(), "Content-Type":"application/json"},
        body:JSON.stringify({name:profile.name,email:profile.email,phone:profile.phone,city:profile.city})
      });
      const storage = localStorage.getItem("stroihub_token") ? localStorage : sessionStorage;
      storage.setItem("stroihub_user", JSON.stringify(result.user));
      if (!writeStoredValue("profile", profile)) return;
      updateUserDisplay(profile.name);
      if (feedback) feedback.textContent = "Промените са запазени.";
    } catch (error) {
      if (feedback) {
        feedback.textContent = error.message;
        feedback.classList.add("error");
      }
    }
  });
}

function initializeClientRequests() {
  const dialog = document.querySelector("#request-dialog");
  const requestList = document.querySelector("#request-list");
  const form = document.querySelector("#new-request-form");
  if (!dialog || !requestList || !form) return;

  document.querySelectorAll("[data-open-dialog]").forEach((button) => button.addEventListener("click", () => {
    form.reset();
    const user = getMatchingUser();
    form.elements.phone.value = user?.phone || "";
    dialog.showModal();
  }));
  document.querySelectorAll("[data-close-dialog]").forEach((button) => button.addEventListener("click", () => dialog.close()));
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) dialog.close();
  });
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = new FormData(form);
    const feedback = document.querySelector("#request-feedback");
    const submit = form.querySelector('button[type="submit"]');
    submit.disabled = true;
    feedback.textContent = "Изпращане…";
    feedback.classList.remove("error");
    try {
      await apiRequest("/api/projects", {
        method:"POST",
        headers:{...apiHeaders(), "Content-Type":"application/json"},
        body:JSON.stringify({
          professionalId:data.get("professionalId"),
          service:data.get("service"),
          city:data.get("city"),
          description:data.get("description"),
          preferredPeriod:data.get("preferredPeriod"),
          name:document.querySelector("#client-profile-form")?.elements.name.value.trim() || "",
          phone:data.get("phone")
        })
      });
      form.reset();
      dialog.close();
      await loadClientRequests();
      showToast("Запитването е изпратено успешно.");
    } catch (error) {
      feedback.textContent = error.message;
      feedback.classList.add("error");
    } finally {
      submit.disabled = false;
    }
  });
}

function renderClientRequests(requests) {
  const list = document.querySelector("#request-list");
  if (!list) return;
  list.replaceChildren();
  if (!requests.length) {
    list.append(createTextElement("p", "empty-copy", "Все още нямаш изпратени запитвания."));
    renderClientActivity([]);
    return;
  }
  requests.forEach((request) => {
    const professional = professionals.find((entry) => entry.id === request.professionalId);
    const card = document.createElement("article");
    card.className = "request-card";
    const heading = document.createElement("div");
    heading.className = "request-card-heading";
    const copy = document.createElement("div");
    copy.append(createTextElement("span", "service-tag", request.service || "Проект"));
    copy.append(createTextElement("h3", "", professional?.name || "Специалист"));
    const requestStatus = request.status || "Изпратено";
    const statusClass = requestStatus === "Приключено" ? "status-complete"
      : requestStatus === "Изпратено" ? "status-sent"
        : "status-progress";
    heading.append(copy, createTextElement("span", `status ${statusClass}`, requestStatus));
    const date = new Date(request.createdAt).toLocaleDateString("bg-BG");
    const detail = createTextElement("p", "", `${request.city || "Населено място не е посочено"} · ${date}`);
    const description = createTextElement("p", "", request.description);
    const meta = document.createElement("div");
    meta.className = "request-meta";
    meta.append(createTextElement("span", "", request.preferredPeriod ? `Предпочитан период: ${request.preferredPeriod}` : "Очаква отговор от специалист"));
    const profileLink = createTextElement("a", "", "Виж профила");
    if (request.professionalId) profileLink.href = `professional-profile.html?id=${encodeURIComponent(request.professionalId)}`;
    else profileLink.href = "#specialists";
    meta.append(profileLink);
    card.append(heading, detail, description, meta);
    list.append(card);
  });
  renderClientActivity(requests);
}

function renderClientActivity(requests) {
  const list = document.querySelector("#activity-list");
  if (!list) return;
  list.replaceChildren();
  if (!requests.length) {
    const empty = document.createElement("li");
    empty.append(createTextElement("div", "", "Няма нови известия."));
    list.append(empty);
    return;
  }
  requests.slice(0, 3).forEach((request) => {
    const item = document.createElement("li");
    item.append(createTextElement("span", "activity-dot", ""));
    const content = document.createElement("div");
    const pro = professionals.find((entry) => entry.id === request.professionalId);
    content.append(
      createTextElement("strong", "", "Изпратено запитване"),
      createTextElement("p", "", `${request.service || "Проект"}${pro ? ` до ${pro.name}` : ""}`),
      createTextElement("small", "", new Date(request.createdAt).toLocaleDateString("bg-BG"))
    );
    item.append(content);
    list.append(item);
  });
}

async function loadClientRequests() {
  const list = document.querySelector("#request-list");
  if (!list) return;
  list.replaceChildren(createTextElement("p", "empty-copy", "Зареждане на запитванията…"));
  try {
    const requests = await apiRequest("/api/account/projects", {headers:apiHeaders()});
    renderClientRequests(requests);
  } catch (error) {
    list.replaceChildren(createTextElement("p", "empty-copy", error.message));
  }
}

function updateServiceCount() {
  const count = document.querySelector("[data-active-service-count]");
  const services = document.querySelectorAll("#service-list .managed-service");
  if (count) count.textContent = String(services.length);
}

function initializeProfessionalProfile() {
  const form = document.querySelector("#professional-profile-form");
  if (!form) return;
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const profile = Object.fromEntries(new FormData(form).entries());
    profile.name = String(profile.name).trim();
    profile.email = String(profile.email).trim();
    profile.city = String(profile.city).trim();
    profile.phone = String(profile.phone).trim();
    profile.description = String(profile.description).trim();
    profile.emailVisible = form.elements.emailVisible.checked;
    profile.phoneVisible = form.elements.phoneVisible.checked;
    const feedback = document.querySelector("#professional-profile-feedback");
    if (feedback) {
      feedback.textContent = "Запазване…";
      feedback.classList.remove("error");
    }
    try {
      const result = await apiRequest("/api/account", {
        method:"PUT",
        headers:{...apiHeaders(), "Content-Type":"application/json"},
        body:JSON.stringify({
          name:profile.name,
          email:profile.email,
          phone:profile.phone,
          city:profile.city,
          profileDescription:profile.description,
          experience:profile.experience ? Number(profile.experience) : null
        })
      });
      const storage = localStorage.getItem("stroihub_token") ? localStorage : sessionStorage;
      storage.setItem("stroihub_user", JSON.stringify(result.user));
      if (!writeStoredValue("profile", profile)) return;
      updateUserDisplay(profile.name);
      updateProfessionalSummary(form);
      if (feedback) feedback.textContent = "Профилът е запазен.";
    } catch (error) {
      if (feedback) {
        feedback.textContent = error.message;
        feedback.classList.add("error");
      }
    }
  });
}

function initializeProfessionalSettings() {
  const form = document.querySelector("#professional-settings-form");
  if (!form) return;
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const settings = Object.fromEntries(
      [...form.querySelectorAll('input[type="checkbox"]')].map((input) => [input.name, input.checked])
    );
    if (!writeStoredValue("settings", settings)) return;
    const feedback = document.querySelector("#professional-settings-feedback");
    if (feedback) feedback.textContent = "Настройките са запазени в този браузър.";
  });
}

function initializePanelToggles() {
  document.querySelectorAll("[data-toggle-panel]").forEach((button) => button.addEventListener("click", () => {
    const panel = document.getElementById(button.dataset.togglePanel);
    if (!panel) return;
    panel.hidden = !panel.hidden;
    if (!panel.hidden) {
      panel.scrollIntoView({behavior:"smooth", block:"center"});
      panel.querySelector("input,select")?.focus({preventScroll:true});
    }
  }));
  document.querySelectorAll("[data-cancel-panel]").forEach((button) => button.addEventListener("click", () => {
    const panel = button.closest("form");
    if (panel) {
      panel.reset();
      panel.hidden = true;
    }
  }));
}

function initializeServices() {
  const list = document.querySelector("#service-list");
  const form = document.querySelector("#service-form-wrap");
  if (!list || !form) return;
  async function loadServices() {
    list.replaceChildren(createTextElement("p", "empty-copy", "Зареждане на услугите…"));
    try {
      const listings = await apiRequest("/api/account/listings", {headers:apiHeaders()});
      list.replaceChildren();
      if (!listings.length) list.append(createTextElement("p", "empty-copy", "Все още няма публикувани услуги."));
      listings.forEach((listing) => {
        const card = document.createElement("article");
        card.className = "managed-service";
        const image = document.createElement("img");
        image.src = serviceImages[listing.service] || serviceImages["Строителство"];
        image.alt = "";
        const copy = document.createElement("div");
        copy.append(
          createTextElement("span", "service-tag", listing.service),
          createTextElement("h3", "", listing.title || listing.service),
          createTextElement("p", "", listing.description),
          createTextElement("small", "", listing.city)
        );
        const remove = createTextElement("button", "text-button", "Премахни");
        remove.type = "button";
        remove.dataset.removeService = listing.id;
        card.append(image, copy, remove);
        list.append(card);
      });
      updateServiceCount(listings.length);
    } catch (error) {
      list.replaceChildren(createTextElement("p", "empty-copy", error.message));
    }
  }
  list.addEventListener("click", async (event) => {
    const removeButton = event.target.closest("[data-remove-service]");
    if (!removeButton) return;
    removeButton.disabled = true;
    try {
      await apiRequest(`/api/account/listings/${encodeURIComponent(removeButton.dataset.removeService)}`, {
        method:"DELETE",
        headers:apiHeaders()
      });
      await loadServices();
      showToast("Услугата е премахната.");
    } catch (error) {
      showToast(error.message);
      removeButton.disabled = false;
    }
  });
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = new FormData(form);
    const submit = form.querySelector('button[type="submit"]');
    submit.disabled = true;
    try {
      await apiRequest("/api/account/listings", {
        method:"POST",
        headers:{...apiHeaders(), "Content-Type":"application/json"},
        body:JSON.stringify({
          service:data.get("category"),
          title:data.get("title"),
          city:data.get("area"),
          description:data.get("description")
        })
      });
      form.reset();
      form.hidden = true;
      await loadServices();
      showToast("Услугата е публикувана.");
    } catch (error) {
      showToast(error.message);
    } finally {
      submit.disabled = false;
    }
  });
  void loadServices();
}

function initializePortfolio() {
  const form = document.querySelector("#project-form-wrap");
  const grid = document.querySelector("#portfolio-grid");
  if (!form || !grid) return;
  async function loadPortfolio() {
    grid.replaceChildren(createTextElement("p", "empty-copy", "Зареждане на проектите…"));
    try {
      const projects = await apiRequest("/api/account/portfolio", {headers:apiHeaders()});
      grid.replaceChildren();
      if (!projects.length) grid.append(createTextElement("p", "empty-copy", "Все още няма добавени проекти в портфолиото."));
      projects.forEach((project) => {
        const card = document.createElement("article");
        card.className = "portfolio-card";
        const image = document.createElement("img");
        image.src = serviceImages[project.category] || serviceImages["Строителство"];
        image.alt = project.category;
        const copy = document.createElement("div");
        copy.append(
          createTextElement("span", "service-tag", project.category),
          createTextElement("h3", "", project.title),
          createTextElement("p", "", project.description),
          createTextElement("small", "", new Date(project.createdAt).toLocaleDateString("bg-BG"))
        );
        const remove = createTextElement("button", "text-button", "Премахни");
        remove.type = "button";
        remove.dataset.removePortfolio = project.id;
        card.append(image, copy, remove);
        grid.append(card);
      });
    } catch (error) {
      grid.replaceChildren(createTextElement("p", "empty-copy", error.message));
    }
  }
  grid.addEventListener("click", async (event) => {
    const removeButton = event.target.closest("[data-remove-portfolio]");
    if (!removeButton) return;
    removeButton.disabled = true;
    try {
      await apiRequest(`/api/account/portfolio/${encodeURIComponent(removeButton.dataset.removePortfolio)}`, {
        method:"DELETE",
        headers:apiHeaders()
      });
      await loadPortfolio();
      showToast("Проектът е премахнат от портфолиото.");
    } catch (error) {
      showToast(error.message);
      removeButton.disabled = false;
    }
  });
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = new FormData(form);
    const submit = form.querySelector('button[type="submit"]');
    submit.disabled = true;
    try {
      await apiRequest("/api/account/portfolio", {
        method:"POST",
        headers:{...apiHeaders(), "Content-Type":"application/json"},
        body:JSON.stringify({title:data.get("title"), category:data.get("category"), description:data.get("description")})
      });
      form.reset();
      form.hidden = true;
      await loadPortfolio();
      showToast("Проектът е добавен в портфолиото.");
    } catch (error) {
      showToast(error.message);
    } finally {
      submit.disabled = false;
    }
  });
  void loadPortfolio();
}

function initializeIncomingRequests() {
  const list = document.querySelector("#incoming-requests");
  if (!list) return;
  async function loadRequests() {
    list.replaceChildren(createTextElement("p", "empty-copy", "Зареждане на запитванията…"));
    try {
      const requests = await apiRequest("/api/account/incoming-requests", {headers:apiHeaders()});
      list.replaceChildren();
      const count = document.querySelector("[data-incoming-request-count]");
      if (count) count.textContent = String(requests.length);
      if (!requests.length) {
        list.append(createTextElement("p", "empty-copy", "Все още няма получени запитвания."));
        return;
      }
      requests.forEach((request) => {
        const card = document.createElement("article");
        card.className = "request-card incoming-request";
        const heading = document.createElement("div");
        heading.className = "request-card-heading";
        const copy = document.createElement("div");
        copy.append(
          createTextElement("span", "service-tag", request.service || "Проект"),
          createTextElement("h3", "", request.name)
        );
        const badgeClass = request.status === "Приключено" ? "status-complete"
          : request.status === "Изпратено" ? "status-sent"
            : "status-progress";
        heading.append(copy, createTextElement("span", `status ${badgeClass}`, request.status));
        const date = new Date(request.createdAt).toLocaleDateString("bg-BG");
        const details = createTextElement("p", "", `${request.city} · ${date} · ${request.phone}`);
        const description = createTextElement("p", "request-description", request.description);
        const meta = document.createElement("div");
        meta.className = "request-meta";
        meta.append(createTextElement("span", "", request.preferredPeriod ? `Предпочитан срок: ${request.preferredPeriod}` : "Няма посочен предпочитан период"));
        if (request.status === "Изпратено" || request.status === "Прието" || request.status === "В процес на обсъждане") {
          const actions = document.createElement("div");
          actions.className = "request-actions";
          const actionsForStatus = request.status === "Изпратено"
            ? [
                ["Прието", "Приеми", "button button-primary button-small"],
                ["Отказано", "Откажи", "button button-outline button-small"]
              ]
            : [["Приключено", "Маркирай като приключено", "button button-primary button-small"]];
          for (const [status, label, style] of actionsForStatus) {
            const button = createTextElement("button", style, label);
            button.type = "button";
            button.addEventListener("click", async () => {
              button.disabled = true;
              try {
                await apiRequest(`/api/account/incoming-requests/${encodeURIComponent(request.id)}`, {
                  method:"PATCH",
                  headers:{...apiHeaders(), "Content-Type":"application/json"},
                  body:JSON.stringify({status})
                });
                await loadRequests();
                showToast(status === "Прието" ? "Запитването е прието." : "Запитването е отказано.");
              } catch (error) {
                button.disabled = false;
                showToast(error.message);
              }
            });
            actions.append(button);
          }
          meta.append(actions);
        }
        card.append(heading, details, description, meta);
        list.append(card);
      });
    } catch (error) {
      list.replaceChildren(createTextElement("p", "empty-copy", error.message));
    }
  }
  void loadRequests();
}

function initializeReviewReplies() {
  document.querySelectorAll(".reply-form").forEach((form) => form.addEventListener("submit", (event) => {
    event.preventDefault();
    const input = form.elements.reply;
    const feedback = form.querySelector(".form-feedback");
    if (!input.value.trim()) {
      input.focus();
      if (feedback) feedback.textContent = "Напиши отговор преди публикуване.";
      return;
    }
    const reply = createTextElement("p", "review-reply", `Твоят отговор: ${input.value.trim()}`);
    form.before(reply);
    form.remove();
    showToast("Отговорът е добавен локално за демонстрация.");
  }));
  document.querySelectorAll("[data-review-reply]").forEach((button) => button.addEventListener("click", () => {
    const replyForm = document.querySelector(".reply-form");
    if (replyForm) {
      replyForm.scrollIntoView({behavior:"smooth", block:"center"});
      replyForm.elements.reply.focus({preventScroll:true});
    }
  }));
}

const dashboardUser = getMatchingUser();
const dashboardToken = localStorage.getItem("stroihub_token") || sessionStorage.getItem("stroihub_token");
const storedUser = localStorage.getItem("stroihub_user") || sessionStorage.getItem("stroihub_user");
let parsedUser = null;
if (storedUser) {
  try {
    parsedUser = JSON.parse(storedUser);
  } catch {
    parsedUser = null;
  }
}
if (dashboardToken && parsedUser && !dashboardUser) {
  const correctDashboard = parsedUser.role === "professional" || parsedUser.role === "company"
    ? "professional-dashboard.html"
    : parsedUser.role === "client"
      ? "client-dashboard.html"
      : "login.html";
  if (correctDashboard === "login.html") {
    localStorage.removeItem("stroihub_token");
    localStorage.removeItem("stroihub_user");
    sessionStorage.removeItem("stroihub_token");
    sessionStorage.removeItem("stroihub_user");
  }
  window.location.replace(correctDashboard);
} else {
  isPreviewMode = !dashboardToken || !dashboardUser;
  if (isPreviewMode) initializePreviewMode();
  initializeProfile();
  initializeSectionNavigation();
  if (!isPreviewMode) initializeLogout();

  if (isProfessionalDashboard) {
    if (!isPreviewMode) {
      initializeProfessionalProfile();
      initializeProfessionalSettings();
      initializePanelToggles();
      initializeServices();
      initializePortfolio();
      initializeIncomingRequests();
      initializeReviewReplies();
      updateServiceCount();
    }
  } else {
    if (!isPreviewMode) void initializeFavorites();
    const directoryReady = initializeClientSearch();
    if (!isPreviewMode) {
      initializeClientProfile();
      initializeClientRequests();
      void loadClientRequests();
    }
    const professionalId = new URLSearchParams(window.location.search).get("professionalId");
    if (professionalId) {
      void directoryReady.then(() => {
        const professional = professionals.find((entry) => entry.id === professionalId);
        if (professional) openRequestDialog(professional);
        else showToast("Този специалист вече няма активна обява.");
      });
    }
  }
}
