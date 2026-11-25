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
const accountProjectCalendar = createAvailabilityCalendar(accountProjectForm);
const accountListingForm = document.querySelector("#account-listing-form");
const accountListingStatus = document.querySelector("#account-listing-status");
const accountPrivacyStatus = document.querySelector("#account-privacy-status");
const menuButton = document.querySelector(".menu-button");
const mainNav = document.querySelector(".main-nav");
const headerActions = document.querySelector(".header-actions");
const siteHeader = document.querySelector(".site-header");

function getAuthToken() {
  return localStorage.getItem("stroihub_token") || sessionStorage.getItem("stroihub_token");
}

function getAuthUser() {
  const stored = localStorage.getItem("stroihub_user") || sessionStorage.getItem("stroihub_user");
  return stored ? JSON.parse(stored) : null;
}

function storeAuthSession(token, user, remember = true) {
  localStorage.removeItem("stroihub_token");
  localStorage.removeItem("stroihub_user");
  sessionStorage.removeItem("stroihub_token");
  sessionStorage.removeItem("stroihub_user");
  const storage = remember ? localStorage : sessionStorage;
  storage.setItem("stroihub_token", token);
  storage.setItem("stroihub_user", JSON.stringify(user));
}

function clearAuthSession() {
  localStorage.removeItem("stroihub_token");
  localStorage.removeItem("stroihub_user");
  sessionStorage.removeItem("stroihub_token");
  sessionStorage.removeItem("stroihub_user");
}

const serviceDetails = {
  "Боядисване": {image:"images/painting.jpg", description:"Боядисване и шпакловка"},
  "Електро услуги": {image:"images/electrical_services.jpg", description:"Инсталации и осветление"},
  "ВиК услуги": {image:"images/plumbing_services.jpg", description:"Тръби и санитария"},
  "Монтажи": {image:"images/montage.jpg", description:"Мебели, врати и кухни"},
  "Строителство": {image:"images/construction.jpg", description:"Строежи и зидария"},
  "Ремонти": {image:"images/repairs.jpg", description:"Плочки, подове и гипсокартон"},
  "Дограма и остъкляване": {image:"images/glazing.jpg", description:"Прозорци и тераси"},
  "Почистване": {image:"images/cleaning.jpg", description:"Дом и почистване след ремонт"}
};

const serviceOptions = [...serviceFilter.options].filter((option) => option.value !== "all").map((option) => {
  const details = serviceDetails[option.value];
  const button = document.createElement("button");
  button.className = "service-picker-option";
  button.type = "button";
  button.setAttribute("role", "option");
  button.setAttribute("aria-selected", "false");
  button.tabIndex = -1;
  button.dataset.serviceValue = option.value;
  button.innerHTML = `<span class="service-option-icon" aria-hidden="true">${getServiceIconMarkup(option.value)}</span><span class="service-option-copy"><strong></strong><small>${details.description}</small></span>`;
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
  button.innerHTML = `<span class="location-option-copy"><strong></strong></span>`;
  button.querySelector("strong").textContent = option.textContent;
  locationPickerResults.append(button);
  return button;
});

function updateServicePicker(value = serviceFilter.value) {
  serviceFilter.value = value;
  const selectedOption = [...serviceFilter.options].find((option) => option.value === value);
  servicePickerValue.textContent = selectedOption.textContent;
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
  locationOptions.forEach((option) => {
    const selected = option.dataset.locationValue === value;
    option.setAttribute("aria-selected", String(selected));
    option.classList.toggle("selected", selected);
  });
}

const pickerCloseTimers = new WeakMap();

function openPickerMenu(field, menu, trigger) {
  const closeTimer = pickerCloseTimers.get(menu);
  if (closeTimer) window.clearTimeout(closeTimer);
  fitPickerMenuToViewport(field, menu);
  menu.hidden = false;
  menu.setAttribute("aria-hidden", "false");
  menu.classList.remove("is-closing");
  field.classList.add("is-open");
  trigger.setAttribute("aria-expanded", "true");
  window.requestAnimationFrame(() => {
    if (!menu.hidden && trigger.getAttribute("aria-expanded") === "true") {
      menu.classList.add("is-open");
    }
  });
}

function closePickerMenu(field, menu, trigger, returnFocus = false) {
  trigger.setAttribute("aria-expanded", "false");
  menu.setAttribute("aria-hidden", "true");
  menu.classList.remove("is-open");
  menu.classList.add("is-closing");
  field.classList.remove("is-open");
  if (returnFocus) trigger.focus();

  const closeTimer = pickerCloseTimers.get(menu);
  if (closeTimer) window.clearTimeout(closeTimer);
  const finishClose = () => {
    menu.hidden = true;
    menu.classList.remove("is-closing");
    pickerCloseTimers.delete(menu);
  };
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    finishClose();
  } else {
    pickerCloseTimers.set(menu, window.setTimeout(finishClose, 220));
  }
}

function closeServicePicker(returnFocus = false) {
  closePickerMenu(servicePicker, servicePickerOptions, servicePickerTrigger, returnFocus);
}

function fitPickerMenuToViewport(field, menu) {
  const availableHeight = window.innerHeight - field.getBoundingClientRect().bottom - 12;
  menu.style.maxHeight = `${Math.max(120, Math.min(360, window.innerHeight * 0.55, availableHeight))}px`;
}

function openServicePicker() {
  openPickerMenu(servicePicker, servicePickerOptions, servicePickerTrigger);
  const selectedOption = serviceOptions.find((option) => option.dataset.serviceValue === serviceFilter.value);
  window.requestAnimationFrame(() => {
    if (servicePickerTrigger.getAttribute("aria-expanded") === "true") {
      (selectedOption || serviceOptions[0]).focus();
    }
  });
}

function closeLocationPicker(returnFocus = false) {
  closePickerMenu(locationPicker, locationPickerOptions, locationPickerTrigger, returnFocus);
}

function openLocationPicker() {
  openPickerMenu(locationPicker, locationPickerOptions, locationPickerTrigger);
  locationPickerSearch.value = "";
  filterLocationOptions();
  window.requestAnimationFrame(() => {
    if (locationPickerTrigger.getAttribute("aria-expanded") === "true") locationPickerSearch.focus();
  });
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
let professionals = [];

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

async function renderProfessionals() {
  const service = serviceFilter.value;
  const selectedLocation = locationFilter.selectedOptions[0];
  const location = (selectedLocation.dataset.cityName || locationFilter.value).trim().toLocaleLowerCase("bg");
  const query = new URLSearchParams();
  if (service !== "all") query.set("service", service);
  if (location) query.set("city", selectedLocation.dataset.cityName || locationFilter.value);
  grid.replaceChildren();
  count.textContent = "Зареждане…";
  try {
    const response = await fetch(`/api/professionals?${query}`);
    const result = await response.json().catch(() => []);
    if (!response.ok) throw new Error(result.message || "Профилите не бяха заредени.");
    professionals = result;
    count.textContent = `${professionals.length} резултата`;
    if (!professionals.length) {
      const empty = document.createElement("div");
      empty.className = "empty-state";
      empty.textContent = "Не открихме публикувани специалисти по тези критерии.";
      grid.append(empty);
      return;
    }
    professionals.forEach((pro) => {
      const card = document.createElement("article");
      card.className = "pro-card";
      const avatar = document.createElement("div");
      avatar.className = "avatar blue";
      const initials = pro.name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toLocaleUpperCase("bg");
      if (pro.profilePhoto) {
        const image = document.createElement("img");
        image.src = pro.profilePhoto;
        image.alt = `Снимка на ${pro.name}`;
        image.addEventListener("error", () => {
          image.remove();
          avatar.textContent = initials;
        }, {once:true});
        avatar.append(image);
      } else {
        avatar.textContent = initials;
      }
      const identity = document.createElement("div");
      const name = document.createElement("h3");
      name.textContent = pro.name;
      const serviceLabel = document.createElement("div");
      serviceLabel.className = "service";
      serviceLabel.textContent = `${pro.service} · ${pro.city}`;
      const profile = document.createElement("a");
      profile.className = "link-button";
      profile.href = `professional-profile.html?id=${encodeURIComponent(pro.id)}`;
      profile.textContent = "Виж профил";
      const description = document.createElement("p");
      description.className = "professional-description";
      description.textContent = pro.description.trim();
      identity.append(name, serviceLabel);
      card.append(avatar, identity, profile, description);
      grid.append(card);
    });
  } catch (error) {
    count.textContent = "0 резултата";
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = error.message;
    grid.append(empty);
  }
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");
  window.setTimeout(() => toast.classList.remove("show"), 3200);
}

function getDashboardPath(role) {
  if (role === "admin") return "admin-dashboard.html";
  if (role === "professional" || role === "company") return "professional-dashboard.html";
  return "client-dashboard.html";
}

function showAccountDashboard() {
  const user = getAuthUser();
  if (!user || typeof user.name !== "string" || typeof user.email !== "string") {
    throw new Error("Информацията за профила не е налична. Влезте отново.");
  }

  const role = user.role || "client";
  const roleLabels = {admin:"Администратор", client:"Клиент", professional:"Майстор", company:"Фирма"};
  const initials = user.name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toLocaleUpperCase("bg");

  accountTitle.textContent = `Здравей, ${user.name.trim().split(/\s+/)[0]}!`;
  if (user.profilePhoto) {
    const image = document.createElement("img");
    image.className = "account-avatar-photo";
    image.src = user.profilePhoto;
    image.alt = "";
    accountAvatar.replaceChildren(image);
  } else {
    accountAvatar.textContent = initials;
  }
  accountName.textContent = user.name;
  accountEmail.textContent = user.email;
  accountRole.textContent = roleLabels[role] || "Потребител";
  accountSettingsForm.elements.name.value = user.name;
  accountSettingsForm.elements.email.value = user.email;
  accountSettingsForm.elements.phone.value = user.phone || "";
  accountSettingsForm.elements.city.value = user.city || "";
  document.querySelector("#account-profile-name").textContent = user.name;
  document.querySelector("#account-profile-email").textContent = user.email;
  document.querySelector("#account-profile-phone").textContent = user.phone || "Не е посочен";
  document.querySelector("#account-profile-city").textContent = user.city || "Не е посочено";
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
  if (!isProfessional) {
    accountProjectForm.elements.name.value = user.name;
    accountProjectForm.elements.phone.value = user.phone || "";
    void populateProjectProfessionals();
  }
  openAccountView("profile");
  accountOverlay.hidden = false;
}

async function populateProjectProfessionals() {
  const select = accountProjectForm.elements.professionalId;
  const status = accountProjectStatus;
  select.replaceChildren(new Option("Зареждане на майсторите…", ""));
  select.disabled = true;
  try {
    const response = await fetch("/api/professionals");
    const result = await response.json().catch(() => []);
    if (!response.ok) throw new Error(result.message || "Майсторите не бяха заредени.");
    select.replaceChildren(new Option("Избери майстор", ""));
    result.forEach((professional) => {
      const option = new Option(`${professional.name} · ${professional.service}, ${professional.city}`, professional.id);
      option.dataset.service = professional.service;
      option.dataset.city = professional.city;
      select.add(option);
    });
    select.disabled = result.length === 0;
    if (!result.length) {
      select.replaceChildren(new Option("Няма публикувани майстори", ""));
      status.textContent = "Все още няма публикувани майстори, до които да изпратиш заявка.";
      status.classList.add("error");
    }
  } catch (error) {
    select.replaceChildren(new Option("Майсторите не бяха заредени", ""));
    status.textContent = error.message;
    status.classList.add("error");
  }
}

let projectAvailabilityRequest = 0;
accountProjectForm.elements.professionalId.addEventListener("change", async (event) => {
  const professionalId = event.currentTarget.value;
  const requestId = ++projectAvailabilityRequest;
  accountProjectCalendar.clear(professionalId ? "Зареждане на свободните дати…" : undefined);
  if (!professionalId) return;
  accountProjectStatus.textContent = "";
  accountProjectStatus.classList.remove("error");
  try {
    const response = await fetch(`/api/professionals/${encodeURIComponent(professionalId)}`);
    const profile = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(profile.message || "Графикът на майстора не беше зареден.");
    if (requestId !== projectAvailabilityRequest) return;
    accountProjectCalendar.setUnavailableDates(profile.busyDates);
  } catch (error) {
    if (requestId !== projectAvailabilityRequest) return;
    accountProjectCalendar.clear(error.message);
    accountProjectStatus.textContent = error.message;
    accountProjectStatus.classList.add("error");
  }
});

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
  const token = getAuthToken();
  if (!token) throw new Error("Сесията е изтекла. Влезте отново.");
  return {Authorization:`Bearer ${token}`};
}

async function loadAccountWork() {
  accountWorkList.replaceChildren();
  accountWorkList.textContent = "Зареждане...";
  try {
    const user = getAuthUser();
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
      title.textContent = isProfessional ? `${item.service} · ${item.city}` : `${item.professionalName || "Майстор"} · ${item.status || "Изпратено"}`;
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
  const token = getAuthToken();
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
  clearAuthSession();
  window.location.reload();
}

async function switchAccount() {
  try {
    await revokeCurrentSession();
  } catch (error) {
    showToast(error.message);
    return;
  }
  clearAuthSession();
  accountOverlay.hidden = true;
  setAuthMode("login");
  updateHeaderUser();
}

function updateHeaderUser() {
  const user = getAuthUser();
  if (!user) {
    const login = document.createElement("a");
    login.className = "auth-button login-button";
    login.textContent = "Вход";
    login.href = "login.html";
    const register = document.createElement("a");
    register.className = "auth-button register-button";
    register.textContent = "Регистрирай се";
    register.href = "signup.html";
    headerActions.replaceChildren(login, register);
    return;
  }
  const login = document.createElement("button");
  login.type = "button";
  login.className = "auth-button login-button";
  if (user.profilePhoto) {
    const image = document.createElement("img");
    image.className = "auth-profile-photo";
    image.src = user.profilePhoto;
    image.alt = "";
    login.append(image);
  }
  login.append(document.createTextNode("Моят профил"));
  login.setAttribute("aria-label", `Моят профил: ${user.name}`);
  login.addEventListener("click", () => {
    window.location.href = getDashboardPath(user.role);
  });
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
    ? "Създайте профил, за да запазвате любими специалисти и да управлявате заявките си."
    : "Влезте, за да изпращате запитвания и да управлявате заявките си.";
  authSubmit.textContent = isRegister ? "Създай профил" : "Вход";
  document.querySelectorAll(".auth-tab").forEach((tab) => tab.classList.toggle("active", tab.dataset.authMode === mode));
  document.querySelectorAll(".register-only").forEach((item) => {
    item.hidden = !isRegister;
    item.querySelectorAll("input,select,textarea").forEach((input) => { input.disabled = !isRegister; });
  });
  document.querySelectorAll(".login-only").forEach((item) => { item.hidden = isRegister; });
  document.querySelector("#auth-switch").innerHTML = isRegister
    ? 'Вече имате профил? <button type="button" data-auth-mode="login">Влезте в профила си</button>'
    : 'Нямате профил? <button type="button" data-auth-mode="register">Създайте го безплатно</button>';
  authMessage.textContent = "";
  authMessage.classList.remove("error");
  authForm.reset();
  authForm.elements.password.minLength = isRegister ? 8 : 6;
  authForm.elements.password.placeholder = isRegister ? "Минимум 8 символа" : "Въведи паролата си";
  authForm.elements.confirmPassword.minLength = 8;
  if (isRegister && role) {
    const roleOption = authForm.querySelector(`input[name="role"][value="${role}"]`);
    if (!roleOption) throw new Error(`Registration role not found: ${role}`);
    roleOption.checked = true;
  }
  authOverlay.hidden = false;
  authForm.querySelector("input:not([type=checkbox])").focus();
}

document.querySelectorAll("[data-auth]").forEach((button) => button.addEventListener("click", () => {
  const {auth, authRole} = button.dataset;
  if (auth === "register") {
    window.location.href = authRole === "professional"
      ? "professional-signup.html"
      : authRole === "client" ? "client-signup.html" : "signup.html";
    return;
  }
  setAuthMode(auth, authRole);
}));
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
    clearAuthSession();
    accountOverlay.hidden = true;
    updateHeaderUser();
    setAuthMode("login");
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
accountOverlay.addEventListener("click", (event) => { if (event.target === accountOverlay) accountOverlay.hidden = true; });
authOverlay.addEventListener("click", (event) => { if (event.target === authOverlay) authOverlay.hidden = true; });
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    authOverlay.hidden = true;
    accountOverlay.hidden = true;
  }
});
document.addEventListener("click", (event) => {
  const modeButton = event.target.closest("[data-auth-mode]");
  if (modeButton?.dataset.authMode === "register") {
    window.location.href = "signup.html";
    return;
  }
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
      body:JSON.stringify({name:data.get("name"), email:data.get("email"), phone:data.get("phone"), city:data.get("city")})
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.message || "Промените не бяха запазени.");
    const storage = localStorage.getItem("stroihub_token") ? localStorage : sessionStorage;
    storage.setItem("stroihub_user", JSON.stringify(result.user));
    accountTitle.textContent = `Здравей, ${result.user.name.trim().split(/\s+/)[0]}!`;
    accountAvatar.textContent = result.user.name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toLocaleUpperCase("bg");
    accountName.textContent = result.user.name;
    accountEmail.textContent = result.user.email;
    accountRole.textContent = result.user.role === "professional" ? "Майстор" : result.user.role === "company" ? "Фирма" : "Клиент";
    document.querySelector("#account-profile-name").textContent = result.user.name;
    document.querySelector("#account-profile-email").textContent = result.user.email;
    document.querySelector("#account-profile-phone").textContent = result.user.phone || "Не е посочен";
    document.querySelector("#account-profile-city").textContent = result.user.city || "Не е посочено";
    accountSettingsStatus.textContent = "Промените са запазени.";
    if (result.user.profilePhoto) {
      const image = document.createElement("img");
      image.className = "account-avatar-photo";
      image.src = result.user.profilePhoto;
      image.alt = "";
      accountAvatar.replaceChildren(image);
    }
    updateHeaderUser();
  } catch (error) {
    accountSettingsStatus.textContent = error.message;
    accountSettingsStatus.classList.add("error");
  }
});

accountProjectForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const data = new FormData(accountProjectForm);
  if (!data.get("preferredPeriod")) {
    accountProjectStatus.textContent = "Избери начало и край на свободен период от календара.";
    accountProjectStatus.classList.add("error");
    return;
  }
  accountProjectStatus.textContent = "Изпращане...";
  accountProjectStatus.classList.remove("error");
  try {
    const response = await fetch("/api/projects", {
      method:"POST",
      headers:{...accountAuthHeaders(), "Content-Type":"application/json"},
      body:JSON.stringify({
        name:data.get("name"),
        phone:data.get("phone"),
        description:data.get("description"),
        professionalId:data.get("professionalId"),
        service:accountProjectForm.elements.professionalId.selectedOptions[0]?.dataset.service,
        city:accountProjectForm.elements.professionalId.selectedOptions[0]?.dataset.city,
        preferredPeriod:data.get("preferredPeriod")
      })
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.message || "Заявката не беше изпратена.");
    accountProjectForm.reset();
    accountProjectCalendar.clear();
    accountProjectStatus.textContent = "Заявката е изпратена успешно.";
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
  const endpoint = authMode === "register" ? "/api/auth/register" : "/api/auth/login";
  const payload = authMode === "register"
    ? {name:data.get("name"), email:data.get("email"), password:data.get("password"), role:data.get("role"), phone:data.get("phone"), city:data.get("city")}
    : {email: data.get("email"), password: data.get("password")};
  authSubmit.disabled = true;
  try {
    const response = await fetch(endpoint, {method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify(payload)});
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.message || "Възникна проблем. Опитайте отново.");
    if (!result.token || !result.user?.name || !result.user?.email) {
      throw new Error("Сървърът върна непълни данни за профила. Опитайте отново.");
    }
    storeAuthSession(result.token, result.user, authMode === "register" || authForm.elements.remember.checked);
    authOverlay.hidden = true;
    window.location.href = getDashboardPath(result.user.role);
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
    const response = await fetch("https://formspree.io/f/mwloregz", {
      method: "POST",
      headers: {"Accept": "application/json"},
      body: formData
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      const formspreeError = result.errors?.map((error) => error.message).join(" ") || "Съобщението не беше изпратено.";
      throw new Error(formspreeError);
    }
    form.reset();
    contactTopic.dispatchEvent(new Event("change"));
    status.textContent = "Съобщението е изпратено успешно.";
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
