const professionals = [
  {name:"Иван Петров", service:"ВиК услуги", city:"София", rating:"4.9", reviews:"48", avatar:"👷", color:"blue"},
  {name:"Мария Николова", service:"Боядисване", city:"София", rating:"5.0", reviews:"36", avatar:"👩‍🔧", color:"peach"},
  {name:"Георги Димитров", service:"Електро услуги", city:"София", rating:"4.8", reviews:"29", avatar:"🧰", color:"sand"},
  {name:"Петър Стоянов", service:"ВиК услуги", city:"Пловдив", rating:"4.9", reviews:"22", avatar:"👨‍🔧", color:"green"},
  {name:"Николай Иванов", service:"Монтажи", city:"София", rating:"4.7", reviews:"18", avatar:"🔨", color:"purple"},
  {name:"Анна Георгиева", service:"Ремонт на баня", city:"Варна", rating:"4.9", reviews:"31", avatar:"👩‍🔨", color:"yellow"}
];

const grid = document.querySelector("#professional-grid");
const count = document.querySelector("#result-count");
const serviceFilter = document.querySelector("#service-filter");
const servicePicker = document.querySelector("#service-picker");
const servicePickerTrigger = document.querySelector("#service-picker-trigger");
const servicePickerOptions = document.querySelector("#service-picker-options");
const servicePickerValue = document.querySelector("#service-picker-value");
const locationFilter = document.querySelector("#location-filter");
const locationPicker = document.querySelector("#location-picker");
const locationPickerTrigger = document.querySelector("#location-picker-trigger");
const locationPickerOptions = document.querySelector("#location-picker-options");
const locationPickerResults = document.querySelector("#location-picker-results");
const locationPickerSearch = document.querySelector("#location-picker-search");
const locationPickerEmpty = document.querySelector("#location-picker-empty");
const locationPickerValue = document.querySelector("#location-picker-value");
const categoryCards = [...document.querySelectorAll(".category-card")];
const toast = document.querySelector("#toast");
const authOverlay = document.querySelector("#auth-overlay");
const authForm = document.querySelector("#auth-form");
const authTitle = document.querySelector("#auth-title");
const authSubtitle = document.querySelector("#auth-subtitle");
const authMessage = document.querySelector("#auth-message");
const authSubmit = document.querySelector(".auth-submit");
const profileOverlay = document.querySelector("#profile-overlay");
const accountOverlay = document.querySelector("#account-overlay");
const accountTitle = document.querySelector("#account-title");
const accountAvatar = document.querySelector("#account-avatar");
const accountName = document.querySelector("#account-name");
const accountEmail = document.querySelector("#account-email");
const accountRole = document.querySelector("#account-role");
const accountNav = document.querySelector(".account-nav");
const accountPanels = [...document.querySelectorAll("[data-account-panel]")];
const accountWorkNav = document.querySelector("#account-work-nav");
const accountWorkLabel = document.querySelector("#account-work-label");
const accountWorkTitle = document.querySelector("#account-work-title");
const accountWorkDescription = document.querySelector("#account-work-description");
const accountWorkList = document.querySelector("#account-work-list");
const accountSettingsForm = document.querySelector("#account-settings-form");
const accountSettingsStatus = document.querySelector("#account-settings-status");
const accountProjectForm = document.querySelector("#account-project-form");
const accountProjectStatus = document.querySelector("#account-project-status");
const accountListingForm = document.querySelector("#account-listing-form");
const accountListingStatus = document.querySelector("#account-listing-status");
const accountPrivacyStatus = document.querySelector("#account-privacy-status");
const menuButton = document.querySelector(".menu-button");
const mainNav = document.querySelector(".main-nav");
const headerActions = document.querySelector(".header-actions");
const siteHeader = document.querySelector(".site-header");

const serviceDetails = {
  all: {icon:"✨", description:"Разгледай всички услуги"},
  "Боядисване": {icon:"🖌️", description:"Боядисване и шпакловка"},
  "Електро услуги": {icon:"⚡", description:"Инсталации и осветление"},
  "ВиК услуги": {icon:"🚿", description:"Тръби и санитария"},
  "Монтажи": {icon:"🔧", description:"Мебели, врати и кухни"},
  "Строителство": {icon:"🏗️", description:"Строежи и зидария"},
  "Ремонти": {icon:"🛠️", description:"Плочки, подове и гипсокартон"},
  "Дограма и остъкляване": {icon:"🪟", description:"Прозорци и тераси"},
  "Почистване": {icon:"🧹", description:"Дом и почистване след ремонт"}
};

const serviceOptions = [...serviceFilter.options].map((option) => {
  const details = serviceDetails[option.value];
  const button = document.createElement("button");
  button.className = "service-picker-option";
  button.type = "button";
  button.setAttribute("role", "option");
  button.setAttribute("aria-selected", "false");
  button.tabIndex = -1;
  button.dataset.serviceValue = option.value;
  button.innerHTML = `<span class="service-option-icon" aria-hidden="true">${details.icon}</span><span class="service-option-copy"><strong></strong><small>${details.description}</small></span><span class="service-option-check" aria-hidden="true">✓</span>`;
  button.querySelector("strong").textContent = option.textContent;
  servicePickerOptions.append(button);
  return button;
});

const locationOptions = [...locationFilter.options].map((option) => {
  const button = document.createElement("button");
  button.className = "location-picker-option";
  button.type = "button";
  button.setAttribute("role", "option");
  button.setAttribute("aria-selected", "false");
  button.tabIndex = -1;
  button.dataset.locationValue = option.value;
  button.innerHTML = `<span class="location-option-copy"><strong></strong></span><span class="location-option-check" aria-hidden="true">✓</span>`;
  button.querySelector("strong").textContent = option.textContent;
  locationPickerResults.append(button);
  return button;
});

function updateServicePicker(value = serviceFilter.value) {
  serviceFilter.value = value;
  const selectedOption = [...serviceFilter.options].find((option) => option.value === value);
  const details = serviceDetails[value];
  servicePickerValue.textContent = selectedOption.textContent;
  servicePicker.querySelector(".service-picker-icon").textContent = details.icon;
  servicePicker.querySelector(".service-picker-copy small").textContent = details.description;
  serviceOptions.forEach((option) => {
    const selected = option.dataset.serviceValue === value;
    option.setAttribute("aria-selected", String(selected));
    option.classList.toggle("selected", selected);
  });
  categoryCards.forEach((card) => card.classList.toggle("selected", card.dataset.category === value));
}

function updateLocationPicker(value = locationFilter.value) {
  locationFilter.value = value;
  const selectedOption = [...locationFilter.options].find((option) => option.value === value);
  locationPickerValue.textContent = selectedOption.textContent;
  locationPicker.querySelector(".location-picker-copy small").textContent =
    value ? "Избрано населено място" : "Покажи всички специалисти";
  locationOptions.forEach((option) => {
    const selected = option.dataset.locationValue === value;
    option.setAttribute("aria-selected", String(selected));
    option.classList.toggle("selected", selected);
  });
}

function closeServicePicker(returnFocus = false) {
  servicePickerOptions.hidden = true;
  servicePickerTrigger.setAttribute("aria-expanded", "false");
  if (returnFocus) servicePickerTrigger.focus();
}

function openServicePicker() {
  servicePickerOptions.hidden = false;
  servicePickerTrigger.setAttribute("aria-expanded", "true");
  const selectedOption = serviceOptions.find((option) => option.dataset.serviceValue === serviceFilter.value);
  (selectedOption || serviceOptions[0]).focus();
}

function closeLocationPicker(returnFocus = false) {
  locationPickerOptions.hidden = true;
  locationPickerTrigger.setAttribute("aria-expanded", "false");
  if (returnFocus) locationPickerTrigger.focus();
}

function openLocationPicker() {
  locationPickerOptions.hidden = false;
  locationPickerTrigger.setAttribute("aria-expanded", "true");
  locationPickerSearch.value = "";
  filterLocationOptions();
  locationPickerSearch.focus();
}

function filterLocationOptions() {
  const query = locationPickerSearch.value.trim().toLocaleLowerCase("bg");
  let visibleCount = 0;
  locationOptions.forEach((option) => {
    const matches = option.textContent.toLocaleLowerCase("bg").includes(query);
    option.hidden = !matches;
    if (matches) visibleCount += 1;
  });
  locationPickerEmpty.hidden = visibleCount > 0;
}

function visibleLocationOptions() {
  return locationOptions.filter((option) => !option.hidden);
}

function selectLocation(option) {
  updateLocationPicker(option.dataset.locationValue);
  closeLocationPicker(true);
}

servicePickerTrigger.addEventListener("click", () => {
  if (servicePickerOptions.hidden) openServicePicker();
  else closeServicePicker();
});

servicePickerTrigger.addEventListener("keydown", (event) => {
  if (event.key === "ArrowDown" || event.key === "ArrowUp") {
    event.preventDefault();
    openServicePicker();
  }
});

locationPickerTrigger.addEventListener("click", () => {
  if (locationPickerOptions.hidden) openLocationPicker();
  else closeLocationPicker();
});

locationPickerTrigger.addEventListener("keydown", (event) => {
  if (event.key === "ArrowDown" || event.key === "ArrowUp") {
    event.preventDefault();
    openLocationPicker();
  }
});

servicePickerOptions.addEventListener("click", (event) => {
  const option = event.target.closest("[data-service-value]");
  if (!option) return;
  updateServicePicker(option.dataset.serviceValue);
  closeServicePicker(true);
});

locationPickerOptions.addEventListener("click", (event) => {
  const option = event.target.closest("[data-location-value]");
  if (!option) return;
  selectLocation(option);
});

locationPickerSearch.addEventListener("input", filterLocationOptions);
locationPickerSearch.addEventListener("keydown", (event) => {
  const visibleOptions = visibleLocationOptions();
  if (event.key === "ArrowDown" && visibleOptions.length) {
    event.preventDefault();
    visibleOptions[0].focus();
  } else if (event.key === "ArrowUp" && visibleOptions.length) {
    event.preventDefault();
    visibleOptions[visibleOptions.length - 1].focus();
  } else if (event.key === "Enter" && visibleOptions.length) {
    event.preventDefault();
    selectLocation(visibleOptions[0]);
  } else if (event.key === "Escape") {
    event.preventDefault();
    closeLocationPicker(true);
  }
});

servicePickerOptions.addEventListener("keydown", (event) => {
  const currentIndex = serviceOptions.indexOf(event.target.closest("[data-service-value]"));
  if (currentIndex < 0) return;
  let nextIndex = currentIndex;
  if (event.key === "ArrowDown") nextIndex = (currentIndex + 1) % serviceOptions.length;
  else if (event.key === "ArrowUp") nextIndex = (currentIndex - 1 + serviceOptions.length) % serviceOptions.length;
  else if (event.key === "Home") nextIndex = 0;
  else if (event.key === "End") nextIndex = serviceOptions.length - 1;
  else if (event.key === "Escape") {
    event.preventDefault();
    closeServicePicker(true);
    return;
  } else return;
  event.preventDefault();
  serviceOptions[nextIndex].focus();
});

locationPickerOptions.addEventListener("keydown", (event) => {
  const visibleOptions = visibleLocationOptions();
  const currentIndex = visibleOptions.indexOf(event.target.closest("[data-location-value]"));
  if (currentIndex < 0) return;
  let nextIndex = currentIndex;
  if (event.key === "ArrowDown") nextIndex = (currentIndex + 1) % visibleOptions.length;
  else if (event.key === "ArrowUp") nextIndex = (currentIndex - 1 + visibleOptions.length) % visibleOptions.length;
  else if (event.key === "Home") nextIndex = 0;
  else if (event.key === "End") nextIndex = visibleOptions.length - 1;
  else if (event.key === "Escape") {
    event.preventDefault();
    closeLocationPicker(true);
    return;
  } else if (event.key === "Enter") {
    event.preventDefault();
    selectLocation(visibleOptions[currentIndex]);
    return;
  } else return;
  event.preventDefault();
  visibleOptions[nextIndex].focus();
});

document.addEventListener("click", (event) => {
  if (!servicePicker.contains(event.target)) closeServicePicker();
  if (!locationPicker.contains(event.target)) closeLocationPicker();
});

servicePicker.addEventListener("focusout", () => {
  window.setTimeout(() => {
    if (!servicePicker.contains(document.activeElement)) closeServicePicker();
  });
});

locationPicker.addEventListener("focusout", () => {
  window.setTimeout(() => {
    if (!locationPicker.contains(document.activeElement)) closeLocationPicker();
  });
});

updateServicePicker();
updateLocationPicker();
let authMode = "login";

function showImageFallback(image) {
  const fallback = document.createElement("span");
  fallback.className = `${image.className} image-fallback`;
  fallback.textContent = image.alt;
  fallback.setAttribute("role", "img");
  fallback.setAttribute("aria-label", image.alt);
  image.replaceWith(fallback);
}

document.querySelectorAll("img[alt]").forEach((image) => {
  image.addEventListener("error", () => showImageFallback(image), {once:true});
  if (image.complete && image.naturalWidth === 0) showImageFallback(image);
});

function closeMobileMenu() {
  mainNav.classList.remove("mobile-open");
  headerActions.classList.remove("mobile-open");
  siteHeader.classList.remove("menu-open");
  menuButton.setAttribute("aria-expanded", "false");
  menuButton.setAttribute("aria-label", "Отвори меню");
}

function renderProfessionals() {
  const service = serviceFilter.value;
  const selectedLocation = locationFilter.selectedOptions[0];
  const location = (selectedLocation.dataset.cityName || locationFilter.value).trim().toLocaleLowerCase("bg");
  const filtered = professionals.filter((pro) =>
    (service === "all" || pro.service === service) &&
    (!location || pro.city.toLocaleLowerCase("bg").includes(location))
  );
  count.textContent = `${filtered.length ? filtered.length : 0} резултата`;
  grid.innerHTML = filtered.length ? filtered.map((pro) => `
    <article class="pro-card">
      <div class="avatar ${pro.color}">${pro.avatar}</div>
      <div><h3>${pro.name} <span class="verified">✓ Проверен</span></h3><div class="service">${pro.service} · ${pro.city}</div></div>
      <button class="link-button" type="button" data-profile="${pro.name}">Виж профил</button>
      <div class="meta"><span class="rating">★ ${pro.rating} <span style="color:#9aa6b0">(${pro.reviews} оценки)</span></span><span>Отговаря до 1 час</span></div>
    </article>`).join("") : `<div class="empty-state">Няма намерени майстори. Опитайте с друга услуга или локация.</div>`;
  grid.querySelectorAll("[data-profile]").forEach((button) => button.addEventListener("click", () => {
    if (!localStorage.getItem("stroihub_token")) {
      setAuthMode("register", "client");
      authMessage.textContent = "Създайте профил, за да разгледате профила на майстора.";
      return;
    }
    showProfile(button.dataset.profile);
  }));
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");
  window.setTimeout(() => toast.classList.remove("show"), 3200);
}

function showProfile(name) {
  const pro = professionals.find((candidate) => candidate.name === name);
  if (!pro) return;
  document.querySelector("#profile-avatar").textContent = pro.avatar;
  document.querySelector("#profile-title").textContent = pro.name;
  document.querySelector("#profile-service").textContent = `${pro.service} · ${pro.city}`;
  document.querySelector("#profile-rating").textContent = `★ ${pro.rating}`;
  document.querySelector("#profile-reviews").textContent = pro.reviews;
  document.querySelector("#profile-description").textContent = `${pro.name} предлага професионално изпълнение на ${pro.service.toLowerCase()} с внимание към детайла и ясна комуникация.`;
  profileOverlay.hidden = false;
}

function showAccountDashboard() {
  const user = JSON.parse(localStorage.getItem("stroihub_user") || "null");
  if (!user || typeof user.name !== "string" || typeof user.email !== "string") {
    throw new Error("Информацията за профила не е налична. Влезте отново.");
  }

  const role = user.role || "client";
  const roleLabels = {client:"Клиент", professional:"Майстор", company:"Фирма"};
  const initials = user.name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toLocaleUpperCase("bg");

  accountTitle.textContent = `Здравей, ${user.name.trim().split(/\s+/)[0]}!`;
  accountAvatar.textContent = initials;
  accountName.textContent = user.name;
  accountEmail.textContent = user.email;
  accountRole.textContent = roleLabels[role] || "Потребител";
  accountSettingsForm.elements.name.value = user.name;
  accountSettingsForm.elements.email.value = user.email;
  document.querySelector("#account-profile-name").textContent = user.name;
  document.querySelector("#account-profile-email").textContent = user.email;
  document.querySelector("#account-profile-role").textContent = roleLabels[role] || "Потребител";
  const isProfessional = role === "professional" || role === "company";
  accountSettingsStatus.textContent = "";
  accountSettingsStatus.classList.remove("error");
  accountPrivacyStatus.textContent = "";
  accountPrivacyStatus.classList.remove("error");
  accountProjectStatus.textContent = "";
  accountProjectStatus.classList.remove("error");
  accountListingStatus.textContent = "";
  accountListingStatus.classList.remove("error");
  accountWorkLabel.textContent = isProfessional ? "Обяви" : "Заявки";
  accountWorkTitle.textContent = isProfessional ? "Моите обяви" : "Моите заявки";
  accountWorkDescription.textContent = isProfessional
    ? "Управлявай обявите за услугите, които предлагаш."
    : "Заявки за проекти, изпратени от твоя профил.";
  accountProjectForm.hidden = isProfessional;
  accountListingForm.hidden = !isProfessional;
  populateListingOptions();
  openAccountView("profile");
  accountOverlay.hidden = false;
}

function populateListingOptions() {
  const serviceSelect = accountListingForm.elements.service;
  const citySelect = accountListingForm.elements.city;
  if (serviceSelect.options.length === 0) {
    [...serviceFilter.options].filter((option) => option.value !== "all").forEach((option) => {
      serviceSelect.add(new Option(option.textContent, option.value));
    });
  }
  if (citySelect.options.length === 0) {
    [...locationFilter.options].filter((option) => option.value !== "").forEach((option) => {
      citySelect.add(new Option(option.textContent, option.value));
    });
  }
}

function openAccountView(view) {
  accountPanels.forEach((panel) => { panel.hidden = panel.dataset.accountPanel !== view; });
  accountNav.querySelectorAll("[data-account-view]").forEach((button) => {
    const active = button.dataset.accountView === view;
    button.classList.toggle("active", active);
    if (active) button.setAttribute("aria-current", "page");
    else button.removeAttribute("aria-current");
  });
  if (view === "requests") void loadAccountWork();
}

function accountAuthHeaders() {
  const token = localStorage.getItem("stroihub_token");
  if (!token) throw new Error("Сесията е изтекла. Влезте отново.");
  return {Authorization:`Bearer ${token}`};
}

async function loadAccountWork() {
  accountWorkList.replaceChildren();
  accountWorkList.textContent = "Зареждане...";
  try {
    const user = JSON.parse(localStorage.getItem("stroihub_user") || "null");
    const isProfessional = user?.role === "professional" || user?.role === "company";
    const response = await fetch(isProfessional ? "/api/account/listings" : "/api/account/projects", {
      headers:accountAuthHeaders()
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.message || "Неуспешно зареждане на данните.");
    accountWorkList.replaceChildren();
    if (!result.length) {
      const empty = document.createElement("p");
      empty.className = "account-empty-state";
      empty.textContent = isProfessional
        ? "Все още нямаш обяви. Попълни формата, за да публикуваш първата си услуга."
        : "Все още нямаш изпратени заявки. Можеш да добавиш проект от формата по-долу.";
      accountWorkList.append(empty);
      return;
    }
    result.forEach((item) => {
      const card = document.createElement("article");
      card.className = "account-record-card";
      const title = document.createElement("strong");
      title.textContent = isProfessional ? `${item.service} · ${item.city}` : item.name;
      const description = document.createElement("p");
      description.textContent = item.description;
      const date = document.createElement("small");
      date.textContent = new Date(item.createdAt).toLocaleDateString("bg-BG");
      card.append(title, description, date);
      accountWorkList.append(card);
    });
  } catch (error) {
    accountWorkList.replaceChildren();
    const message = document.createElement("p");
    message.className = "account-form-status error";
    message.textContent = error.message;
    accountWorkList.append(message);
  }
}

async function revokeCurrentSession() {
  const token = localStorage.getItem("stroihub_token");
  if (!token) return;
  const response = await fetch("/api/auth/logout", {
    method:"POST",
    headers:{Authorization:`Bearer ${token}`}
  });
  if (!response.ok) throw new Error("Сесията не беше прекратена. Опитайте отново.");
}

async function logoutUser() {
  try {
    await revokeCurrentSession();
  } catch (error) {
    showToast(error.message);
    return;
  }
  localStorage.removeItem("stroihub_token");
  localStorage.removeItem("stroihub_user");
  window.location.reload();
}

async function switchAccount() {
  try {
    await revokeCurrentSession();
  } catch (error) {
    showToast(error.message);
    return;
  }
  localStorage.removeItem("stroihub_token");
  localStorage.removeItem("stroihub_user");
  accountOverlay.hidden = true;
  setAuthMode("login");
  updateHeaderUser();
}

function updateHeaderUser() {
  const user = JSON.parse(localStorage.getItem("stroihub_user") || "null");
  if (!user) {
    const login = document.createElement("button");
    login.type = "button";
    login.className = "auth-button login-button";
    login.textContent = "Вход";
    login.addEventListener("click", () => setAuthMode("login"));
    const register = document.createElement("button");
    register.type = "button";
    register.className = "auth-button register-button";
    register.textContent = "Регистрация";
    register.addEventListener("click", () => setAuthMode("register"));
    headerActions.replaceChildren(login, register);
    return;
  }
  const login = document.createElement("button");
  login.type = "button";
  login.className = "auth-button login-button";
  login.textContent = "Моят профил";
  login.setAttribute("aria-label", `Моят профил: ${user.name}`);
  login.addEventListener("click", showAccountDashboard);
  const register = document.createElement("button");
  register.type = "button";
  register.className = "auth-button register-button";
  register.textContent = "Изход";
  register.addEventListener("click", logoutUser);
  headerActions.replaceChildren(login, register);
}

function setAuthMode(mode, role) {
  authMode = mode;
  const isRegister = mode === "register";
  authTitle.textContent = isRegister ? "Създайте своя профил" : "Влезте във вашия профил";
  authSubtitle.textContent = isRegister
    ? "Създайте профил, за да разглеждате специалисти и да откривате подходящи услуги."
    : "Влезте, за да разглеждате профилите на специалистите.";
  authSubmit.textContent = isRegister ? "Създай профил" : "Вход";
  document.querySelectorAll(".auth-tab").forEach((tab) => tab.classList.toggle("active", tab.dataset.authMode === mode));
  document.querySelectorAll(".register-only").forEach((item) => {
    item.hidden = !isRegister;
    const input = item.querySelector("input");
    if (input) input.disabled = !isRegister;
  });
  document.querySelectorAll(".login-only").forEach((item) => { item.hidden = isRegister; });
  document.querySelector("#auth-switch").innerHTML = isRegister
    ? 'Вече имате профил? <button type="button" data-auth-mode="login">Влезте в профила си</button>'
    : 'Нямате профил? <button type="button" data-auth-mode="register">Създайте го безплатно</button>';
  authMessage.textContent = "";
  authMessage.classList.remove("error");
  authForm.reset();
  if (isRegister && role) {
    const roleOption = authForm.querySelector(`input[name="role"][value="${role}"]`);
    if (!roleOption) throw new Error(`Registration role not found: ${role}`);
    roleOption.checked = true;
  }
  authOverlay.hidden = false;
  authForm.querySelector("input:not([type=checkbox])").focus();
}

document.querySelectorAll("[data-auth]").forEach((button) => button.addEventListener("click", () => setAuthMode(button.dataset.auth, button.dataset.authRole)));
menuButton.addEventListener("click", () => {
  const isOpen = mainNav.classList.toggle("mobile-open");
  headerActions.classList.toggle("mobile-open", isOpen);
  siteHeader.classList.toggle("menu-open", isOpen);
  menuButton.setAttribute("aria-expanded", String(isOpen));
  menuButton.setAttribute("aria-label", isOpen ? "Затвори меню" : "Отвори меню");
});
document.querySelectorAll(".main-nav a").forEach((link) => link.addEventListener("click", (event) => {
  event.preventDefault();
  document.querySelectorAll(".main-nav a").forEach((item) => item.classList.remove("active"));
  link.classList.add("active");
  closeMobileMenu();
  const target = document.querySelector(link.hash);
  if (!target) {
    throw new Error(`Navigation target not found: ${link.hash}`);
  }
  if (window.location.hash !== link.hash) {
    window.history.pushState(null, "", link.hash);
  }
  window.requestAnimationFrame(() => target.scrollIntoView({behavior:"smooth", block:"start"}));
}));
window.addEventListener("popstate", () => {
  const activeHref = window.location.hash || "#platform";
  document.querySelectorAll(".main-nav a").forEach((item) => {
    item.classList.toggle("active", item.hash === activeHref);
  });
});
document.querySelectorAll(".step").forEach((step) => step.addEventListener("click", () => {
  const stepNumber = Number(step.dataset.step);
  document.querySelectorAll(".step").forEach((item) => {
    const active = item === step;
    item.classList.toggle("active", active);
    item.setAttribute("aria-pressed", String(active));
  });
  const progress = document.querySelector(".steps-progress");
  progress.setAttribute("aria-valuenow", String(stepNumber));
  progress.style.setProperty("--step-progress", `${((stepNumber - 1) / 3) * 100}%`);
}));
const aboutTabs = [...document.querySelectorAll("[data-about-tab]")];
function activateAboutTab(tab, moveFocus = false) {
  aboutTabs.forEach((item) => {
    const active = item === tab;
    item.classList.toggle("active", active);
    item.setAttribute("aria-selected", String(active));
    item.tabIndex = active ? 0 : -1;
    document.querySelector(`#${item.getAttribute("aria-controls")}`).hidden = !active;
  });
  if (moveFocus) tab.focus();
}
aboutTabs.forEach((tab, index) => {
  tab.addEventListener("click", () => activateAboutTab(tab));
  tab.addEventListener("keydown", (event) => {
    let nextIndex;
    if (event.key === "ArrowRight") nextIndex = (index + 1) % aboutTabs.length;
    else if (event.key === "ArrowLeft") nextIndex = (index - 1 + aboutTabs.length) % aboutTabs.length;
    else if (event.key === "Home") nextIndex = 0;
    else if (event.key === "End") nextIndex = aboutTabs.length - 1;
    else return;
    event.preventDefault();
    activateAboutTab(aboutTabs[nextIndex], true);
  });
});
const benefitActions = {
  search: "Използвай търсачката, за да филтрираш майстори по услуга и град.",
  profiles: "Отвори профил на майстор от секцията с най-търсените специалисти.",
  contact: "Изпрати запитване и се свържи директно с подходящ специалист.",
  planning: "Разгледай стъпките, за да организираш проекта си по-лесно."
};
document.querySelectorAll(".benefit-card").forEach((card) => card.addEventListener("click", () => {
  showToast(benefitActions[card.dataset.benefit]);
}));
document.querySelector("[data-auth-close]").addEventListener("click", () => { authOverlay.hidden = true; });
document.querySelector("[data-profile-close]").addEventListener("click", () => { profileOverlay.hidden = true; });
document.querySelector("[data-account-close]").addEventListener("click", () => { accountOverlay.hidden = true; });
document.querySelector("[data-account-logout]").addEventListener("click", logoutUser);
document.querySelector("[data-account-switch]").addEventListener("click", switchAccount);
document.querySelectorAll("[data-account-delete]").forEach((button) => button.addEventListener("click", async () => {
  const confirmed = window.confirm("Изтриването е окончателно. Да изтрия ли профила и свързаните с него заявки и обяви?");
  if (!confirmed) return;
  accountPrivacyStatus.textContent = "Изтриване на профила...";
  accountPrivacyStatus.classList.remove("error");
  try {
    const response = await fetch("/api/account", {method:"DELETE", headers:accountAuthHeaders()});
    const result = await response.json();
    if (!response.ok) throw new Error(result.message || "Профилът не беше изтрит.");
    localStorage.removeItem("stroihub_token");
    localStorage.removeItem("stroihub_user");
    accountOverlay.hidden = true;
    updateHeaderUser();
    setAuthMode("register");
    showToast(result.message);
  } catch (error) {
    accountPrivacyStatus.textContent = error.message;
    accountPrivacyStatus.classList.add("error");
  }
}));
accountNav.addEventListener("click", (event) => {
  const button = event.target.closest("[data-account-view]");
  if (button) openAccountView(button.dataset.accountView);
});
document.querySelectorAll("[data-account-open-view]").forEach((button) => {
  button.addEventListener("click", () => openAccountView(button.dataset.accountOpenView));
});
profileOverlay.addEventListener("click", (event) => { if (event.target === profileOverlay) profileOverlay.hidden = true; });
accountOverlay.addEventListener("click", (event) => { if (event.target === accountOverlay) accountOverlay.hidden = true; });
authOverlay.addEventListener("click", (event) => { if (event.target === authOverlay) authOverlay.hidden = true; });
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    authOverlay.hidden = true;
    profileOverlay.hidden = true;
    accountOverlay.hidden = true;
  }
});
document.addEventListener("click", (event) => {
  const modeButton = event.target.closest("[data-auth-mode]");
  if (modeButton) setAuthMode(modeButton.dataset.authMode);
});
document.querySelector("[data-toggle-password]").addEventListener("click", (event) => {
  const input = event.currentTarget.parentElement.querySelector("input");
  input.type = input.type === "password" ? "text" : "password";
  event.currentTarget.textContent = input.type === "password" ? "Покажи" : "Скрий";
});
accountSettingsForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  accountSettingsStatus.textContent = "Запазване...";
  accountSettingsStatus.classList.remove("error");
  const data = new FormData(accountSettingsForm);
  try {
    const response = await fetch("/api/account", {
      method:"PUT",
      headers:{...accountAuthHeaders(), "Content-Type":"application/json"},
      body:JSON.stringify({name:data.get("name"), email:data.get("email")})
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.message || "Промените не бяха запазени.");
    localStorage.setItem("stroihub_user", JSON.stringify(result.user));
    accountTitle.textContent = `Здравей, ${result.user.name.trim().split(/\s+/)[0]}!`;
    accountAvatar.textContent = result.user.name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toLocaleUpperCase("bg");
    accountName.textContent = result.user.name;
    accountEmail.textContent = result.user.email;
    accountRole.textContent = result.user.role === "professional" ? "Майстор" : result.user.role === "company" ? "Фирма" : "Клиент";
    document.querySelector("#account-profile-name").textContent = result.user.name;
    document.querySelector("#account-profile-email").textContent = result.user.email;
    accountSettingsStatus.textContent = "Промените са запазени.";
    updateHeaderUser();
  } catch (error) {
    accountSettingsStatus.textContent = error.message;
    accountSettingsStatus.classList.add("error");
  }
});

accountProjectForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  accountProjectStatus.textContent = "Изпращане...";
  accountProjectStatus.classList.remove("error");
  const data = new FormData(accountProjectForm);
  try {
    const response = await fetch("/api/projects", {
      method:"POST",
      headers:{...accountAuthHeaders(), "Content-Type":"application/json"},
      body:JSON.stringify({name:data.get("name"), phone:data.get("phone"), description:data.get("description")})
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.message || "Заявката не беше изпратена.");
    accountProjectForm.reset();
    accountProjectStatus.textContent = result.message;
    await loadAccountWork();
  } catch (error) {
    accountProjectStatus.textContent = error.message;
    accountProjectStatus.classList.add("error");
  }
});

accountListingForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  accountListingStatus.textContent = "Публикуване...";
  accountListingStatus.classList.remove("error");
  const data = new FormData(accountListingForm);
  try {
    const response = await fetch("/api/account/listings", {
      method:"POST",
      headers:{...accountAuthHeaders(), "Content-Type":"application/json"},
      body:JSON.stringify({service:data.get("service"), city:data.get("city"), description:data.get("description")})
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.message || "Обявата не беше публикувана.");
    accountListingForm.reset();
    accountListingStatus.textContent = "Обявата е публикувана.";
    await loadAccountWork();
  } catch (error) {
    accountListingStatus.textContent = error.message;
    accountListingStatus.classList.add("error");
  }
});
authForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const data = new FormData(authForm);
  if (authMode === "register" && data.get("password") !== data.get("confirmPassword")) {
    authMessage.textContent = "Паролите не съвпадат.";
    authMessage.classList.add("error");
    return;
  }
  if (authMode === "register" && !data.get("terms")) {
    authMessage.textContent = "Необходимо е да приемете условията.";
    authMessage.classList.add("error");
    return;
  }
  const endpoint = authMode === "register" ? "/api/auth/register" : "/api/auth/login";
  const payload = authMode === "register"
    ? {name: data.get("name"), email: data.get("email"), password: data.get("password"), role: data.get("role")}
    : {email: data.get("email"), password: data.get("password")};
  authSubmit.disabled = true;
  try {
    const response = await fetch(endpoint, {method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify(payload)});
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.message || "Възникна проблем. Опитайте отново.");
    if (!result.token || !result.user?.name || !result.user?.email) {
      throw new Error("Сървърът върна непълни данни за профила. Опитайте отново.");
    }
    localStorage.setItem("stroihub_token", result.token);
    localStorage.setItem("stroihub_user", JSON.stringify(result.user));
    authOverlay.hidden = true;
    updateHeaderUser();
    showAccountDashboard();
  } catch (error) {
    authMessage.textContent = error.message;
    authMessage.classList.add("error");
  } finally {
    authSubmit.disabled = false;
  }
});

document.querySelector("#search-form").addEventListener("submit", (event) => {
  event.preventDefault();
  renderProfessionals();
  document.querySelector("#professionals").scrollIntoView({behavior:"smooth"});
});

categoryCards.forEach((card) => card.addEventListener("click", () => {
  updateServicePicker(card.dataset.category);
  renderProfessionals();
}));

document.querySelectorAll("[data-scroll-to]").forEach((button) => button.addEventListener("click", () => {
  const target = document.querySelector(`#${button.dataset.scrollTo}`);
  if (!target) throw new Error(`Scroll target not found: #${button.dataset.scrollTo}`);
  target.scrollIntoView({behavior:"smooth"});
}));
document.querySelector("#contact-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const status = document.querySelector("#contact-status");
  const formData = new FormData(form);
  const topic = formData.get("topic");
  const customTopic = formData.get("topicOther");
  formData.delete("topicOther");
  if (topic === "Друго") formData.set("topic", customTopic);
  status.textContent = "Изпращане...";
  status.classList.remove("error");
  try {
    const response = await fetch("/api/contact", {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify(Object.fromEntries(formData))
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.message || "Съобщението не беше изпратено.");
    form.reset();
    contactTopic.dispatchEvent(new Event("change"));
    status.textContent = result.message;
  } catch (error) {
    status.textContent = error.message;
    status.classList.add("error");
  }
});
const contactTopic = document.querySelector("#contact-topic");
const customTopicField = document.querySelector("#contact-custom-topic-field");
const customTopic = document.querySelector("#contact-custom-topic");
contactTopic.addEventListener("change", () => {
  const isCustomTopic = contactTopic.value === "Друго";
  customTopicField.hidden = !isCustomTopic;
  customTopic.disabled = !isCustomTopic;
  customTopic.required = isCustomTopic;
  if (isCustomTopic) customTopic.focus();
  else customTopic.value = "";
});
contactTopic.dispatchEvent(new Event("change"));
document.querySelectorAll("[data-toast]").forEach((button) => button.addEventListener("click", () => showToast(button.dataset.toast)));
renderProfessionals();
updateHeaderUser();
