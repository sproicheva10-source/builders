const professionals = [
  {name:"Иван Петров", service:"Ремонт на баня", city:"София", rating:"4.9", reviews:"48", avatar:"👷", color:"blue"},
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
let authMode = "login";

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
  grid.querySelectorAll("[data-profile]").forEach((button) => button.addEventListener("click", () => showProfile(button.dataset.profile)));
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
  document.querySelector(".header-actions").replaceChildren(login, register, document.querySelector("[data-scroll-to='request']"));
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

function setAuthMode(mode) {
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
  authOverlay.hidden = false;
  authForm.querySelector("input:not([type=checkbox])").focus();
}

document.querySelectorAll("[data-auth]").forEach((button) => button.addEventListener("click", () => setAuthMode(button.dataset.auth)));
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
    ? {name: data.get("name"), email: data.get("email"), password: data.get("password")}
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

document.querySelectorAll(".category-card").forEach((card) => card.addEventListener("click", () => {
  serviceFilter.value = card.dataset.category;
  document.querySelectorAll(".category-card").forEach((item) => item.classList.remove("selected"));
  card.classList.add("selected");
  renderProfessionals();
}));

document.querySelector("#request-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const fields = form.querySelectorAll("input, textarea");
  const [name, phone, description] = [...fields].map((field) => field.value);
  try {
    const response = await fetch("/api/projects", {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({name, phone, description})
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.message || "Заявката не беше изпратена.");
    form.reset();
    showToast(result.message);
  } catch (error) {
    showToast(error.message);
  }
});

document.querySelectorAll("[data-scroll-to]").forEach((button) => button.addEventListener("click", () => document.querySelector(`#${button.dataset.scrollTo}`).scrollIntoView({behavior:"smooth"})));
document.querySelectorAll("[data-toast]").forEach((button) => button.addEventListener("click", () => showToast(button.dataset.toast)));
renderProfessionals();
updateHeaderUser();
