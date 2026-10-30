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
const locationFilter = document.querySelector("#location-filter");
const toast = document.querySelector("#toast");
const authOverlay = document.querySelector("#auth-overlay");
const authForm = document.querySelector("#auth-form");
const authTitle = document.querySelector("#auth-title");
const authSubtitle = document.querySelector("#auth-subtitle");
const authMessage = document.querySelector("#auth-message");
const authSubmit = document.querySelector(".auth-submit");
const profileOverlay = document.querySelector("#profile-overlay");
const menuButton = document.querySelector(".menu-button");
const mainNav = document.querySelector(".main-nav");
const headerActions = document.querySelector(".header-actions");
const siteHeader = document.querySelector(".site-header");
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
  const location = locationFilter.value.trim().toLowerCase();
  const filtered = professionals.filter((pro) =>
    (service === "all" || pro.service === service) &&
    (!location || pro.city.toLowerCase().includes(location))
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

function updateHeaderUser() {
  const user = JSON.parse(localStorage.getItem("stroihub_user") || "null");
  let login = document.querySelector("[data-auth='login']");
  let register = document.querySelector("[data-auth='register']");
  if (!user) return;
  login = login.cloneNode(true);
  register = register.cloneNode(true);
  document.querySelector(".header-actions").replaceChildren(login, register);
  login.textContent = user.name.split(" ")[0];
  login.addEventListener("click", () => showToast(`Влезли сте като ${user.name}.`));
  register.textContent = "Изход";
  register.classList.remove("register-link");
  register.addEventListener("click", () => {
    localStorage.removeItem("stroihub_token");
    localStorage.removeItem("stroihub_user");
    window.location.reload();
  });
}

function setAuthMode(mode, role) {
  authMode = mode;
  const isRegister = mode === "register";
  authTitle.textContent = isRegister ? "Създайте своя профил" : "Влезте във вашия профил";
  authSubtitle.textContent = isRegister
    ? "Запазвайте проекти и намирайте подходящите майстори по-бързо."
    : "Управлявайте проектите си и общувайте с майстори.";
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
profileOverlay.addEventListener("click", (event) => { if (event.target === profileOverlay) profileOverlay.hidden = true; });
authOverlay.addEventListener("click", (event) => { if (event.target === authOverlay) authOverlay.hidden = true; });
document.addEventListener("keydown", (event) => { if (event.key === "Escape") authOverlay.hidden = true; });
document.addEventListener("click", (event) => {
  const modeButton = event.target.closest("[data-auth-mode]");
  if (modeButton) setAuthMode(modeButton.dataset.authMode);
});
document.querySelector("[data-toggle-password]").addEventListener("click", (event) => {
  const input = event.currentTarget.parentElement.querySelector("input");
  input.type = input.type === "password" ? "text" : "password";
  event.currentTarget.textContent = input.type === "password" ? "Покажи" : "Скрий";
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
    localStorage.setItem("stroihub_token", result.token);
    localStorage.setItem("stroihub_user", JSON.stringify(result.user));
    authMessage.textContent = authMode === "register" ? "Профилът е създаден успешно!" : "Входът е успешен! Добре дошли в StroiHub.";
    authMessage.classList.remove("error");
    window.setTimeout(() => { authOverlay.hidden = true; showToast(authMessage.textContent); }, 900);
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

const categoryCards = [...document.querySelectorAll(".category-card")];
const categoryPageSize = 4;
let categoryPage = 0;
const categoryPageStatus = document.querySelector("#category-page-status");
const categoryPrev = document.querySelector("#category-prev");
const categoryNext = document.querySelector("#category-next");

function showCategoryPage() {
  const pageCount = Math.ceil(categoryCards.length / categoryPageSize);
  categoryCards.forEach((card, index) => {
    card.hidden = Math.floor(index / categoryPageSize) !== categoryPage;
  });
  categoryPageStatus.textContent = `${categoryPage + 1} / ${pageCount}`;
  categoryPrev.disabled = categoryPage === 0;
  categoryNext.disabled = categoryPage === pageCount - 1;
}

categoryPrev.addEventListener("click", () => {
  if (categoryPage > 0) {
    categoryPage -= 1;
    showCategoryPage();
  }
});
categoryNext.addEventListener("click", () => {
  if (categoryPage < Math.ceil(categoryCards.length / categoryPageSize) - 1) {
    categoryPage += 1;
    showCategoryPage();
  }
});
showCategoryPage();

categoryCards.forEach((card) => card.addEventListener("click", () => {
  serviceFilter.value = card.dataset.category;
  document.querySelectorAll(".category-card").forEach((item) => item.classList.remove("selected"));
  card.classList.add("selected");
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
