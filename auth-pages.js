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

function validateRegistrationFields(form) {
  const email = form.elements.email;
  validateRegistrationEmail(email);

  const password = form.elements.password;
  validatePasswordField(password);

  const phone = form.elements.phone;
  phone.value = normalizeInternationalPhone(phone.value);
  phone.setCustomValidity(
    !phone.value ||
    isValidInternationalPhone(phone.value)
      ? ""
      : "Въведи +, валиден международен код и точно 9 цифри след него."
  );

  for (const name of ["firstName", "lastName"]) {
    const field = form.elements[name];
    field.setCustomValidity(
      !field.value || field.value.trim().length >= 2
        ? ""
        : "Въведи поне два символа."
    );
  }

  const city = form.elements.city;
  city.setCustomValidity(
    !city.value || city.value.trim()
      ? ""
      : "Въведи населено място."
  );
}

function validateRegistrationEmail(email) {
  const emailValue = email.value.trim();
  const emailIsValid = isValidRegistrationEmail(emailValue) &&
    !email.validity.typeMismatch;
  email.setCustomValidity(
    !email.value || emailIsValid
      ? ""
      : "Въведи валиден имейл адрес с домейн, например name@example.com."
  );
}

function passwordValidationMessage(value) {
  if (value.length < 8 || value.length > 128)
    return "Паролата трябва да е между 8 и 128 символа.";
  if (!/\p{Lu}/u.test(value) || !/\p{Ll}/u.test(value) || !/\p{Nd}/u.test(value))
    return "Паролата трябва да съдържа главна и малка буква и поне една цифра.";
  return "";
}

function validatePasswordField(password) {
  password.setCustomValidity(passwordValidationMessage(password.value));
}

function isValidRegistrationEmail(value) {
  const separator = value.indexOf("@");
  if (separator <= 0 || separator !== value.lastIndexOf("@")) return false;

  const labels = value.slice(separator + 1).split(".");
  if (labels.length < 2 ||
      labels.some((label) =>
        label.length < 2 ||
        label.length > 63 ||
        !/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])$/i.test(label))) {
    return false;
  }
  return /^[a-z]{2,}$/i.test(labels[labels.length - 1]) ||
    /^xn--[a-z0-9-]{2,}$/i.test(labels[labels.length - 1]);
}

document.querySelectorAll('form[data-auth-form="register"]').forEach((form) => {
  const email = form.elements.email;
  const password = form.elements.password;
  email.addEventListener("input", () => validateRegistrationEmail(email));
  password.addEventListener("input", () => validatePasswordField(password));
});

document.querySelectorAll('form[data-auth-form="forgot-password"]').forEach((form) => {
  const email = form.elements.email;
  email.addEventListener("input", () => validateRegistrationEmail(email));
});

document.querySelectorAll('form[data-auth-form="reset-password"]').forEach((form) => {
  const password = form.elements.password;
  password.addEventListener("input", () => validatePasswordField(password));
});

const countryCallingCodes = new Set(
  (
    "1 7 20 27 30 31 32 33 34 36 39 40 41 43 44 45 46 47 48 49 " +
    "51 52 53 54 55 56 57 58 60 61 62 63 64 65 66 81 82 84 86 " +
    "90 91 92 93 94 95 98 211 212 213 216 218 " +
    "220 221 222 223 224 225 226 227 228 229 230 231 232 233 234 " +
    "235 236 237 238 239 240 241 242 243 244 245 246 247 248 249 " +
    "250 251 252 253 254 255 256 257 258 260 261 262 263 264 265 266 267 268 269 " +
    "290 291 297 298 299 " +
    "350 351 352 353 354 355 356 357 358 359 370 371 372 373 374 375 376 377 378 380 381 382 383 385 386 387 389 " +
    "420 421 423 " +
    "500 501 502 503 504 505 506 507 508 509 " +
    "590 591 592 593 594 595 596 597 598 599 " +
    "670 672 673 674 675 676 677 678 679 680 681 682 683 685 686 687 688 689 690 691 692 " +
    "850 852 853 855 856 880 886 " +
    "960 961 962 963 964 965 966 967 968 970 971 972 973 974 975 976 977 " +
    "992 993 994 995 996 998"
  ).split(" ")
);

function normalizeInternationalPhone(value) {
  const trimmed = value.trim();
  if (!trimmed) return "";
  const compact = trimmed.replace(/[\s().-]/g, "");
  if (compact.startsWith("+")) return compact;
  if (compact.startsWith("00")) return `+${compact.slice(2)}`;
  return `+${compact}`;
}

function isValidInternationalPhone(value) {
  const digits = value.startsWith("+") ? value.slice(1) : "";
  if (!/^[1-9]\d{9,11}$/.test(digits)) return false;
  return [...countryCallingCodes].some((code) =>
    digits.startsWith(code) && digits.length - code.length === 9);
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
      const passwordMessage = passwordValidationMessage(password);
      form.elements.password.setCustomValidity(passwordMessage);
      if (passwordMessage) {
        form.elements.password.reportValidity();
        return;
      }
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
        region:values.get("region"),
        password,
        role:form.dataset.role
      };
      payload.termsAccepted = values.get("termsAccepted") === "on";
      payload.privacyAccepted = values.get("privacyAccepted") === "on";
      const profilePhoto = values.get("profilePhoto");
      if (form.dataset.role === "professional") {
        const portfolioPhotos = values.getAll("portfolioPhotos");
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
      } else if (profilePhoto?.size > 0) {
        submit.disabled = true;
        showAuthStatus(form, "Подготовка на изображенията…");
        try {
          payload.profilePhoto = await readImageFile(profilePhoto);
        } catch (error) {
          submit.disabled = false;
          showAuthStatus(form, error.message, true);
          return;
        }
      }
    } else if (mode === "forgot-password") {
      path = "/api/auth/forgot-password";
      payload = {email:values.get("email")};
    } else {
      const password = String(values.get("password"));
      const passwordMessage = passwordValidationMessage(password);
      form.elements.password.setCustomValidity(passwordMessage);
      if (passwordMessage) {
        form.elements.password.reportValidity();
        return;
      }
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
