function saveAuthSession(token, user, remember = true) {
  localStorage.removeItem("stroihub_token");
  localStorage.removeItem("stroihub_user");
  sessionStorage.removeItem("stroihub_token");
  sessionStorage.removeItem("stroihub_user");
  const storage = remember ? localStorage : sessionStorage;
  storage.setItem("stroihub_token", token);
  storage.setItem("stroihub_user", JSON.stringify(user));
}

async function postJson(url, payload) {
  const response = await fetch(url, {
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify(payload)
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.detail || result.message || "Заявката не беше изпълнена. Опитай отново.");
  return result;
}

function showAuthStatus(form, message, isError = false) {
  const status = form.querySelector(".auth-page-status");
  status.textContent = message;
  status.classList.toggle("error", isError);
}

function readImageFile(file) {
  if (!file || file.size === 0) return Promise.resolve("");
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => resolve(String(reader.result)));
    reader.addEventListener("error", () => reject(new Error("Изображението не може да бъде прочетено.")));
    reader.readAsDataURL(file);
  });
}

function dashboardPath(role) {
  return role === "professional" || role === "company"
    ? "professional-dashboard.html"
    : "client-dashboard.html";
}

function getSafeReturnTarget() {
  const requested = new URLSearchParams(location.search).get("returnTo");
  if (!requested) return "";
  const target = new URL(requested, location.href);
  const dashboard = new URL("client-dashboard.html", location.href);
  const professionalId = target.searchParams.get("professionalId");
  if (target.origin !== location.origin ||
      target.pathname !== dashboard.pathname ||
      !professionalId ||
      !/^[a-f0-9]{32}$/i.test(professionalId))
    return "";
  return `client-dashboard.html?professionalId=${encodeURIComponent(professionalId)}`;
}

const authForm = document.querySelector("[data-auth-form]");
if (authForm) {
  authForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const submit = form.querySelector('button[type="submit"]');
    const values = new FormData(form);
    const mode = form.dataset.authForm;
    let path;
    let payload;
    if (mode === "login") {
      path = "/api/auth/login";
      payload = {email:values.get("email"), password:values.get("password")};
    } else if (mode === "register") {
      const password = String(values.get("password"));
      if (password !== values.get("confirmPassword")) {
        showAuthStatus(form, "Паролите не съвпадат.", true);
        return;
      }
      path = "/api/auth/register";
      payload = {
        name:`${values.get("firstName")} ${values.get("lastName")}`.trim(),
        email:values.get("email"),
        phone:values.get("phone"),
        city:values.get("city"),
        password,
        role:form.dataset.role
      };
      if (form.dataset.role === "professional") {
        const profilePhoto = values.get("profilePhoto");
        const portfolioPhotos = values.getAll("portfolioPhotos");
        payload.region = values.get("region");
        payload.additionalCities = values.get("additionalCities");
        payload.primaryCategory = values.get("primaryCategory");
        payload.categories = values.getAll("categories");
        payload.services = values.getAll("services");
        payload.experience = Number(values.get("experience"));
        payload.profileDescription = values.get("profileDescription");
        payload.workPreference = values.get("workPreference");
        payload.professionalLink = values.get("professionalLink");
        submit.disabled = true;
        showAuthStatus(form, "Подготовка на изображенията…");
        try {
          payload.profilePhoto = await readImageFile(profilePhoto);
          payload.portfolioPhotos = await Promise.all(portfolioPhotos.filter((file) => file.size > 0).map(readImageFile));
        } catch (error) {
          submit.disabled = false;
          showAuthStatus(form, error.message, true);
          return;
        }
        payload.termsAccepted = values.get("termsAccepted") === "on";
        payload.privacyAccepted = values.get("privacyAccepted") === "on";
      }
    } else if (mode === "forgot-password") {
      path = "/api/auth/forgot-password";
      payload = {email:values.get("email")};
    } else {
      const password = String(values.get("password"));
      if (password !== values.get("confirmPassword")) {
        showAuthStatus(form, "Паролите не съвпадат.", true);
        return;
      }
      path = "/api/auth/reset-password";
      payload = {token:new URLSearchParams(location.search).get("token") || "", password};
    }

    submit.disabled = true;
    showAuthStatus(form, mode === "forgot-password" ? "Изпращане…" : "Обработка…");
    try {
      const result = await postJson(path, payload);
      if (mode === "login" || mode === "register") {
        if (!result.token || !result.user?.name || !result.user?.email) {
          throw new Error("Сървърът върна непълни данни за профила.");
        }
        saveAuthSession(result.token, result.user, mode === "register" || values.get("remember") === "on");
        location.href = mode === "login" && getSafeReturnTarget()
          ? getSafeReturnTarget()
          : dashboardPath(result.user.role);
        return;
      }
      showAuthStatus(form, result.message || "Готово.");
      if (mode === "reset-password") {
        form.reset();
        form.querySelectorAll("input").forEach((input) => { input.disabled = true; });
      }
    } catch (error) {
      showAuthStatus(form, error.message, true);
    } finally {
      submit.disabled = false;
    }
  });
}
