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
let professionalAccount = null;
let professionalProfilePhoto = "";
let professionalServices = [];
let professionalPortfolio = [];
let incomingRequestsViewed = false;
let markingIncomingRequests = false;
let reloadIncomingRequests = null;

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

function readDashboardImage(file) {
  if (!file || !["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 2 * 1024 * 1024)
    return Promise.reject(new Error("Избери JPG, PNG или WebP снимка до 2 MB."));
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => resolve(String(reader.result)));
    reader.addEventListener("error", () => reject(new Error("Снимката не може да бъде прочетена.")));
    reader.readAsDataURL(file);
  });
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

function cacheProfessionalUser(user) {
  const storage = localStorage.getItem("stroihub_token") ? localStorage : sessionStorage;
  const cachedUser = getMatchingUser() || {};
  const {id, name, email, role, phone, city} = user;
  storage.setItem("stroihub_user", JSON.stringify({...cachedUser, id, name, email, role, phone, city}));
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
    ...((isPreviewMode || !isProfessionalDashboard) ? savedProfile : {})
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
    const savedSettings = isPreviewMode ? readStoredValue("settings", {}) : {};
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
  const photo = document.querySelector("[data-profile-photo-preview]");
  if (photo) {
    photo.src = professionalProfilePhoto || "images/platform-overview.jpg";
    photo.alt = name ? `Профилна снимка на ${name}` : "Профилна снимка";
  }
  updateProfessionalProfileProgress();
}

function updateProfessionalProfileProgress() {
  const form = document.querySelector("#professional-profile-form");
  if (!form) return;
  const description = form.elements.description.value.trim();
  const completed = [
    Boolean(form.elements.name.value.trim()),
    Boolean(form.elements.city.value.trim()),
    Boolean(form.elements.phone.value.trim()),
    Boolean(form.elements.email.value.trim()),
    form.elements.experience.value !== "",
    description.length >= 20,
    Boolean(professionalProfilePhoto),
    Boolean(professionalAccount?.primaryCategory),
    professionalServices.length > 0,
    professionalPortfolio.length > 0
  ].filter(Boolean).length;
  const percent = completed * 10;
  const label = document.querySelector("[data-profile-progress-label]");
  const track = document.querySelector("[data-profile-progress-track]");
  const bar = document.querySelector("[data-profile-progress]");
  const hint = document.querySelector("[data-profile-progress-hint]");
  if (label) label.textContent = `${percent}%`;
  if (bar) bar.style.width = `${percent}%`;
  if (track) track.setAttribute("aria-valuenow", String(percent));
  if (hint) hint.textContent = percent === 100
    ? "Профилът ти е готов за клиенти."
    : "Попълни основните данни, добави услуга и покажи завършена работа.";

  const steps = {
    services: professionalServices.length > 0,
    portfolio: professionalPortfolio.length > 0,
    description: description.length >= 20
  };
  document.querySelectorAll("[data-next-step]").forEach((step) => {
    const isComplete = Boolean(steps[step.dataset.nextStep]);
    step.classList.toggle("complete", isComplete);
    step.setAttribute("aria-label", `${step.lastElementChild?.textContent || ""}${isComplete ? " — готово" : ""}`);
    const marker = step.querySelector("[aria-hidden='true']");
    if (marker) marker.textContent = isComplete ? "✓" : "○";
  });
}

function updateProfileVisibility(isPublic) {
  const badge = document.querySelector("[data-profile-visibility-status]");
  if (badge) {
    badge.textContent = isPublic ? "Публичен профил" : "Скрит профил";
    badge.classList.toggle("profile-status-hidden", !isPublic);
  }
  const publicLink = document.querySelector("[data-public-profile]");
  if (publicLink) {
    publicLink.href = `professional-profile.html?id=${encodeURIComponent(professionalAccount?.id || "")}`;
    publicLink.setAttribute("aria-disabled", String(!isPublic));
    publicLink.tabIndex = isPublic ? 0 : -1;
    publicLink.classList.toggle("is-disabled", !isPublic);
  }
}

function initializeAccountMenu() {
  const toggle = document.querySelector("[data-account-menu-toggle]");
  const menu = document.querySelector("[data-account-menu]");
  if (!toggle || !menu) return;
  const setOpen = (open) => {
    menu.hidden = !open;
    toggle.setAttribute("aria-expanded", String(open));
  };
  toggle.addEventListener("click", () => setOpen(menu.hidden));
  document.addEventListener("click", (event) => {
    if (!toggle.contains(event.target) && !menu.contains(event.target)) setOpen(false);
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !menu.hidden) {
      setOpen(false);
      toggle.focus();
    }
  });
  menu.querySelectorAll("a,button").forEach((item) => item.addEventListener("click", () => setOpen(false)));
}

function initializeSectionNavigation() {
  const links = [...document.querySelectorAll(".header-links a[href^='#']")];
  const sections = links.map((link) => document.querySelector(link.hash)).filter(Boolean);
  document.querySelectorAll('a[href="#requests"]').forEach((link) => {
    link.addEventListener("click", () => void markIncomingRequestsViewed());
  });
  document.querySelectorAll("[data-unread-request-hint]").forEach((hint) => {
    hint.addEventListener("click", () => {
      document.querySelector("[href='#requests']")?.click();
    });
  });
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
    register.href = "signup.html";
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

function normalizeServiceCategory(value) {
  return value.replace(/\s+/g, "").toLocaleLowerCase("bg");
}

function renderProfessionalCards(service = "", city = "") {
  const grid = document.querySelector("#professional-grid");
  if (!grid) return;
  const filtered = professionals.filter((professional) =>
    (!service ||
      professional.service === service ||
      professional.serviceCategories?.some((category) =>
        normalizeServiceCategory(category) === normalizeServiceCategory(service)
      )) &&
    (!city || professional.city.toLocaleLowerCase("bg").includes(city.toLocaleLowerCase("bg")))
  );
  grid.replaceChildren();
  filtered.forEach((professional) => {
    const card = document.createElement("article");
    card.className = "professional-card";
    const image = document.createElement("img");
    image.className = "professional-image";
    image.src = professional.profilePhoto || serviceImages[professional.service] || serviceImages["Строителство"];
    image.alt = professional.profilePhoto ? `Снимка на ${professional.name}` : professional.service;
    const content = document.createElement("div");
    content.className = "professional-card-body";
    content.append(createTextElement("span", "service-tag", professional.service));
    content.append(
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

function loadSearchCities(select, feedback) {
  fetch("locations.json")
    .then((response) => {
      if (!response.ok) throw new Error(`Неуспешно зареждане на градовете (${response.status}).`);
      return response.json();
    })
    .then((citiesByRegion) => {
      const selectedCity = select.value;
      const cities = [...new Set(Object.values(citiesByRegion).flat())]
        .sort((left, right) => left.localeCompare(right, "bg"));
      select.replaceChildren(
        new Option("Всички населени места", ""),
        ...cities.map((city) => new Option(city, city))
      );
      select.value = selectedCity;
    })
    .catch((error) => {
      console.error(error);
      feedback.textContent = "Списъкът с населени места не се зареди. Презареди страницата.";
    });
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
  const searchFeedback = document.querySelector("#search-feedback");
  loadSearchCities(form.elements.city, searchFeedback);
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
  const feedback = document.querySelector("#professional-profile-feedback");
  const updateFeedback = (message, isError = false) => {
    if (!feedback) return;
    feedback.textContent = message;
    feedback.classList.toggle("error", isError);
  };
  const populateProfileForm = (profile) => {
    form.elements.name.value = profile.name || "";
    form.elements.email.value = profile.email || "";
    form.elements.city.value = profile.city || "";
    form.elements.phone.value = profile.phone || "";
    form.elements.experience.value = profile.experience ?? "";
    form.elements.description.value = profile.profileDescription || "";
    form.elements.profilePhoto.value = "";
    professionalProfilePhoto = profile.profilePhoto || "";
    updateProfessionalSummary(form);
  };
  const loadAccount = async () => {
    const result = await apiRequest("/api/account", {headers:apiHeaders()});
    professionalAccount = result.user;
    populateProfileForm(professionalAccount);
    updateUserDisplay(professionalAccount.name);
    const settingsForm = document.querySelector("#professional-settings-form");
    if (settingsForm) {
      settingsForm.elements.requestNotifications.checked = professionalAccount.requestNotifications;
      settingsForm.elements.reviewNotifications.checked = professionalAccount.reviewNotifications;
      settingsForm.elements.isProfilePublic.checked = professionalAccount.isProfilePublic;
    }
    updateProfileVisibility(professionalAccount.isProfilePublic);
    const viewCount = document.querySelector("[data-profile-view-count]");
    if (viewCount) viewCount.textContent = String(professionalAccount.profileViews || 0);
    cacheProfessionalUser(professionalAccount);
  };

  void loadAccount().catch((error) => updateFeedback(error.message, true));

  const photoInput = form.elements.profilePhoto;
  form.addEventListener("input", () => updateProfessionalSummary(form));
  photoInput.addEventListener("change", async () => {
    const file = photoInput.files?.[0];
    if (!file) return;
    try {
      professionalProfilePhoto = await readDashboardImage(file);
      updateProfessionalSummary(form);
    } catch (error) {
      photoInput.value = "";
      updateFeedback(error.message, true);
    }
  });

  form.querySelector("[data-reset-profile]")?.addEventListener("click", () => {
    if (!professionalAccount) return;
    populateProfileForm(professionalAccount);
    updateFeedback("");
  });

  document.querySelector("[data-public-profile]")?.addEventListener("click", (event) => {
    if (professionalAccount?.isProfilePublic) return;
    event.preventDefault();
    showToast("Профилът е скрит. Включи видимостта в настройките, за да го отвориш.");
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    updateFeedback("Запазване…");
    const submit = form.querySelector('button[type="submit"]');
    submit.disabled = true;
    try {
      const result = await apiRequest("/api/account", {
        method:"PUT",
        headers:{...apiHeaders(), "Content-Type":"application/json"},
        body:JSON.stringify({
          name:form.elements.name.value.trim(),
          email:form.elements.email.value.trim(),
          phone:form.elements.phone.value.trim(),
          city:form.elements.city.value.trim(),
          profileDescription:form.elements.description.value.trim(),
          experience:form.elements.experience.value ? Number(form.elements.experience.value) : null,
          profilePhoto:professionalProfilePhoto
        })
      });
      professionalAccount = {...professionalAccount, ...result.user};
      cacheProfessionalUser(professionalAccount);
      populateProfileForm(professionalAccount);
      updateUserDisplay(professionalAccount.name);
      updateProfessionalSummary(form);
      updateFeedback("Профилът е запазен.");
    } catch (error) {
      updateFeedback(error.message, true);
    } finally {
      submit.disabled = false;
    }
  });
}

function initializeProfessionalSettings() {
  const form = document.querySelector("#professional-settings-form");
  if (!form) return;
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const feedback = document.querySelector("#professional-settings-feedback");
    const submit = form.querySelector('button[type="submit"]');
    submit.disabled = true;
    if (feedback) {
      feedback.textContent = "Запазване…";
      feedback.classList.remove("error");
    }
    try {
      const settings = {
        requestNotifications:form.elements.requestNotifications.checked,
        reviewNotifications:form.elements.reviewNotifications.checked,
        isProfilePublic:form.elements.isProfilePublic.checked
      };
      await apiRequest("/api/account/settings", {
        method:"PUT",
        headers:{...apiHeaders(), "Content-Type":"application/json"},
        body:JSON.stringify(settings)
      });
      professionalAccount = {...professionalAccount, ...settings};
      updateProfileVisibility(settings.isProfilePublic);
      if (feedback) feedback.textContent = "Настройките са запазени.";
    } catch (error) {
      if (feedback) {
        feedback.textContent = error.message;
        feedback.classList.add("error");
      }
    } finally {
      submit.disabled = false;
    }
  });
}

function initializeDeleteAccount() {
  document.querySelector("[data-delete-account]")?.addEventListener("click", async (event) => {
    if (!window.confirm("Сигурен ли си, че искаш да изтриеш профила и свързаните с него данни? Това действие е необратимо.")) return;
    const button = event.currentTarget;
    button.disabled = true;
    try {
      await apiRequest("/api/account", {method:"DELETE", headers:apiHeaders()});
      localStorage.removeItem("stroihub_token");
      localStorage.removeItem("stroihub_user");
      sessionStorage.removeItem("stroihub_token");
      sessionStorage.removeItem("stroihub_user");
      window.location.href = "index.html";
    } catch (error) {
      showToast(error.message);
      button.disabled = false;
    }
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
  const setEditing = (listing = null) => {
    form.reset();
    const category = form.elements.category;
    category.querySelector("[data-existing-service]")?.remove();
    if (listing && ![...category.options].some((option) => option.value === listing.service)) {
      const option = new Option(listing.service, listing.service);
      option.dataset.existingService = "true";
      category.add(option, 1);
    }
    form.elements.listingId.value = listing?.id || "";
    form.elements.category.value = listing?.service || "";
    form.elements.title.value = listing?.title || "";
    form.elements.area.value = listing?.city || "";
    form.elements.description.value = listing?.description || "";
    form.elements.price.value = listing?.price || "";
    form.querySelector("h3").textContent = listing ? "Редактирай услуга" : "Добави услуга";
    form.querySelector('[type="submit"]').textContent = listing ? "Запази промените" : "Запази услугата";
    form.hidden = false;
    form.scrollIntoView({behavior:"smooth", block:"center"});
    form.elements.category.focus({preventScroll:true});
  };
  form.addEventListener("reset", () => {
    form.querySelector("h3").textContent = "Добави услуга";
    form.querySelector('[type="submit"]').textContent = "Запази услугата";
  });
  document.querySelector('[data-toggle-panel="service-form-wrap"]')?.addEventListener("click", () => setEditing());
  async function loadServices() {
    list.replaceChildren(createTextElement("p", "empty-copy", "Зареждане на услугите…"));
    try {
      const listings = await apiRequest("/api/account/listings", {headers:apiHeaders()});
      professionalServices = listings;
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
          createTextElement("small", "", listing.city),
          createTextElement("strong", "service-price", listing.price || "Цена по договаряне")
        );
        const status = createTextElement("span", "service-tag service-published", "Публикувана");
        copy.append(status);
        const actions = document.createElement("div");
        actions.className = "service-actions";
        const edit = createTextElement("button", "text-button", "Редактирай");
        edit.type = "button";
        edit.dataset.editService = listing.id;
        const remove = createTextElement("button", "text-button", "Премахни");
        remove.type = "button";
        remove.dataset.removeService = listing.id;
        actions.append(edit, remove);
        card.append(image, copy, actions);
        list.append(card);
      });
      updateServiceCount(listings.length);
      updateProfessionalProfileProgress();
    } catch (error) {
      list.replaceChildren(createTextElement("p", "empty-copy", error.message));
    }
  }
  list.addEventListener("click", async (event) => {
    const editButton = event.target.closest("[data-edit-service]");
    if (editButton) {
      const listing = professionalServices.find((item) => item.id === editButton.dataset.editService);
      if (listing) setEditing(listing);
      return;
    }
    const removeButton = event.target.closest("[data-remove-service]");
    if (!removeButton) return;
    if (!window.confirm("Сигурен ли си, че искаш да премахнеш тази услуга?")) return;
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
      const listingId = String(data.get("listingId") || "");
      await apiRequest(listingId
        ? `/api/account/listings/${encodeURIComponent(listingId)}`
        : "/api/account/listings", {
        method:listingId ? "PUT" : "POST",
        headers:{...apiHeaders(), "Content-Type":"application/json"},
        body:JSON.stringify({
          service:data.get("category"),
          title:data.get("title"),
          city:data.get("area"),
          description:data.get("description"),
          price:data.get("price")
        })
      });
      form.reset();
      form.hidden = true;
      await loadServices();
      showToast(listingId ? "Услугата е актуализирана." : "Услугата е публикувана.");
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
      professionalPortfolio = projects;
      grid.replaceChildren();
      if (!projects.length) grid.append(createTextElement("p", "empty-copy", "Все още няма добавени проекти в портфолиото."));
      projects.forEach((project) => {
        const card = document.createElement("article");
        card.className = "portfolio-card";
        const image = document.createElement("img");
        image.src = project.image || serviceImages[project.category] || serviceImages["Строителство"];
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
      updateProfessionalProfileProgress();
    } catch (error) {
      grid.replaceChildren(createTextElement("p", "empty-copy", error.message));
    }
  }
  grid.addEventListener("click", async (event) => {
    const removeButton = event.target.closest("[data-remove-portfolio]");
    if (!removeButton) return;
    if (!window.confirm("Сигурен ли си, че искаш да премахнеш този проект от портфолиото?")) return;
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
      const image = await readDashboardImage(data.get("image"));
      await apiRequest("/api/account/portfolio", {
        method:"POST",
        headers:{...apiHeaders(), "Content-Type":"application/json"},
        body:JSON.stringify({
          title:data.get("title"),
          category:data.get("category"),
          description:data.get("description"),
          image
        })
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
      const unreadCount = requests.filter((request) => request.isNew).length;
      if (unreadCount > 0) incomingRequestsViewed = false;
      document.querySelectorAll("[data-unread-request-count]").forEach((element) => { element.textContent = String(unreadCount); });
      document.querySelectorAll("[data-unread-request-badge]").forEach((element) => {
        element.textContent = unreadCount ? String(unreadCount) : "";
        element.hidden = unreadCount === 0;
      });
      document.querySelectorAll("[data-unread-request-hint]").forEach((element) => {
        element.textContent = unreadCount ? "Отвори запитванията, за да ги прегледаш." : "Всички запитвания са прегледани.";
      });
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
        const statusLabel = request.status === "Изпратено" ? "Ново"
          : request.status === "Прието" || request.status === "В процес на обсъждане" ? "В процес"
            : request.status;
        const badgeClass = request.status === "Приключено" ? "status-complete"
          : request.status === "Изпратено" ? "status-new"
            : "status-progress";
        heading.append(copy, createTextElement("span", `status ${badgeClass}`, statusLabel));
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
  reloadIncomingRequests = loadRequests;
  void loadRequests();
}

async function markIncomingRequestsViewed() {
  if (incomingRequestsViewed || markingIncomingRequests || isPreviewMode) return;
  markingIncomingRequests = true;
  try {
    await apiRequest("/api/account/incoming-requests/mark-viewed", {
      method:"POST",
      headers:apiHeaders()
    });
    incomingRequestsViewed = true;
    document.querySelectorAll("[data-unread-request-count]").forEach((element) => { element.textContent = "0"; });
    document.querySelectorAll("[data-unread-request-badge]").forEach((element) => {
      element.textContent = "";
      element.hidden = true;
    });
    document.querySelectorAll("[data-unread-request-hint]").forEach((element) => {
      element.textContent = "Всички запитвания са прегледани.";
    });
    if (reloadIncomingRequests) await reloadIncomingRequests();
  } catch (error) {
    showToast(error.message);
  } finally {
    markingIncomingRequests = false;
  }
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

async function initializeProfessionalReviews() {
  const list = document.querySelector("#professional-reviews-list");
  if (!list) return;
  try {
    const result = await apiRequest("/api/account/reviews", {headers:apiHeaders()});
    const average = document.querySelector("[data-average-review]");
    const count = document.querySelector("[data-review-count]");
    average.textContent = result.average === null ? "—" : `${result.average.toFixed(1)} / 5`;
    count.textContent = `${result.reviews.length} публикувани ${result.reviews.length === 1 ? "отзив" : "отзива"}`;
    list.replaceChildren();
    if (!result.reviews.length) {
      list.append(createTextElement("p", "empty-copy", "Все още няма публикувани отзиви. Отзив може да се остави след приключена услуга."));
      return;
    }
    result.reviews.forEach((review) => {
      const card = document.createElement("article");
      card.className = "review-card";
      const heading = document.createElement("div");
      heading.className = "review-heading";
      const avatar = review.authorPhoto
        ? document.createElement("img")
        : document.createElement("span");
      avatar.className = "review-avatar";
      if (review.authorPhoto) {
        avatar.src = review.authorPhoto;
        avatar.alt = `Профилна снимка на ${review.author}`;
      } else {
        avatar.classList.add("review-avatar-placeholder");
        avatar.textContent = review.author.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toLocaleUpperCase("bg-BG");
        avatar.setAttribute("aria-label", `Профил на ${review.author}`);
      }
      const identity = document.createElement("div");
      identity.className = "review-identity";
      identity.append(
        createTextElement("strong", "", review.author),
        createTextElement("span", "", new Date(review.createdAt).toLocaleDateString("bg-BG"))
      );
      heading.append(avatar, identity);
      const rating = createTextElement("span", "review-rating", `${"★".repeat(review.rating)}${"☆".repeat(5 - review.rating)}`);
      rating.setAttribute("aria-label", `Оценка ${review.rating} от 5`);
      card.append(heading, rating, createTextElement("p", "", review.comment));
      list.append(card);
    });
  } catch (error) {
    list.replaceChildren(createTextElement("p", "empty-copy", error.message));
  }
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
      initializeAccountMenu();
      initializeDeleteAccount();
      initializePanelToggles();
      initializeServices();
      initializePortfolio();
      initializeIncomingRequests();
      initializeReviewReplies();
      void initializeProfessionalReviews();
      if (window.location.hash === "#requests") void markIncomingRequestsViewed();
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
