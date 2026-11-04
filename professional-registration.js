const registrationForm = document.querySelector(".professional-registration-form");
const categoryContainer = document.querySelector("#registration-categories");
const serviceContainer = document.querySelector("#registration-services");
const categoryError = document.querySelector("#category-error");
const serviceError = document.querySelector("#service-error");
const imageError = document.querySelector("#image-error");
const registrationPanels = [...document.querySelectorAll("[data-step-panel]")];
const stepIndicators = [...document.querySelectorAll("[data-step-indicator]")];
const backButton = document.querySelector("[data-registration-back]");
const nextButton = document.querySelector("[data-registration-next]");
const submitButton = document.querySelector("[data-registration-submit]");
const serviceGroups = {
  "Боядисване":["Боядисване на стени","Шпакловка","Декоративни мазилки"],
  "Електро услуги":["Ремонт на електроинсталации","Монтаж на осветление","Смяна на контакти"],
  "ВиК услуги":["Смяна на тръби","Монтаж на санитария","Отпушване на канали"],
  "Монтажи":["Сглобяване на мебели","Монтаж на врати","Монтаж на кухни"],
  "Строителство":["Зидария","Изливане на бетон","Изграждане на основи"],
  "Ремонти":["Лепене на плочки","Поставяне на ламинат","Монтаж на гипсокартон"],
  "Дограма и остъкляване":["Монтаж на PVC дограма","Остъкляване на тераси","Монтаж на комарници"],
  "Почистване":["Почистване след ремонт","Основно почистване","Почистване на прозорци"]
};
let currentStep = 0;

function setStep(step) {
  currentStep = step;
  registrationPanels.forEach((panel, index) => {
    panel.hidden = index !== step;
  });
  stepIndicators.forEach((indicator, index) => {
    indicator.classList.toggle("active", index === step);
    indicator.classList.toggle("complete", index < step);
    if (index === step) indicator.setAttribute("aria-current", "step");
    else indicator.removeAttribute("aria-current");
  });
  backButton.hidden = step === 0;
  nextButton.hidden = step === registrationPanels.length - 1;
  submitButton.hidden = step !== registrationPanels.length - 1;
  const status = registrationForm.querySelector(".auth-page-status");
  status.textContent = "";
  status.classList.remove("error");
  registrationPanels[step].querySelector("input,select,textarea,button")?.focus({preventScroll:true});
  window.scrollTo({top:0,behavior:"smooth"});
}

function selectedCategories() {
  return [...categoryContainer.querySelectorAll('input[name="categories"]:checked')].map((input) => input.value);
}

function renderServices() {
  const categories = selectedCategories();
  const selectedServices = new Set([...serviceContainer.querySelectorAll('input[name="services"]:checked')].map((input) => input.value));
  const currentPrimary = categoryContainer.querySelector('input[name="primaryCategory"]:checked')?.value;
  serviceContainer.replaceChildren();
  categories.forEach((category) => {
    const group = document.createElement("fieldset");
    group.className = "registration-choice-group service-category";
    const legend = document.createElement("legend");
    legend.textContent = category;
    group.append(legend);
    serviceGroups[category].forEach((service) => {
      const label = document.createElement("label");
      label.className = "choice-option";
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.name = "services";
      checkbox.value = service;
      checkbox.checked = selectedServices.has(service);
      label.append(checkbox, document.createTextNode(` ${service}`));
      group.append(label);
    });
    serviceContainer.append(group);
  });
  if (currentPrimary && categories.includes(currentPrimary)) return;
  const firstCategory = categories[0];
  if (firstCategory) {
    categoryContainer.querySelectorAll('input[name="primaryCategory"]').forEach((input) => {
      input.checked = input.value === firstCategory;
    });
  }
}

Object.keys(serviceGroups).forEach((category) => {
  const label = document.createElement("label");
  label.className = "category-option";
  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.name = "categories";
  checkbox.value = category;
  const primary = document.createElement("input");
  primary.type = "radio";
  primary.name = "primaryCategory";
  primary.value = category;
  primary.setAttribute("aria-label", `Задай ${category} като основна категория`);
  primary.addEventListener("change", () => {
    if (primary.checked && !checkbox.checked) {
      checkbox.checked = true;
      renderServices();
    }
  });
  checkbox.addEventListener("change", () => {
    if (checkbox.checked && !categoryContainer.querySelector('input[name="primaryCategory"]:checked')) {
      primary.checked = true;
    } else if (!checkbox.checked && primary.checked) {
      primary.checked = false;
    }
    renderServices();
  });
  const checkboxText = document.createElement("span");
  checkboxText.textContent = category;
  const primaryLabel = document.createElement("span");
  primaryLabel.className = "primary-category-label";
  primaryLabel.append(primary, document.createTextNode(" Основна"));
  label.append(checkbox, checkboxText, primaryLabel);
  categoryContainer.append(label);
});

function validateStep(step) {
  const panel = registrationPanels[step];
  let valid = true;
  if (step === 0 &&
      registrationForm.elements.password.value !== registrationForm.elements.confirmPassword.value) {
    const status = registrationForm.querySelector(".auth-page-status");
    status.textContent = "Паролите не съвпадат.";
    status.classList.add("error");
    registrationForm.elements.confirmPassword.focus();
    return false;
  }
  if (step === 1) {
    const categories = selectedCategories();
    const services = registrationForm.querySelectorAll('input[name="services"]:checked');
    categoryError.textContent = categories.length ? "" : "Избери поне една категория и посочи основната.";
    serviceError.textContent = services.length ? "" : "Избери поне една конкретна услуга.";
    valid = categories.length > 0 &&
      !!categoryContainer.querySelector('input[name="primaryCategory"]:checked') &&
      services.length > 0;
  }
  if (step === 2) {
    const profilePhoto = registrationForm.elements.profilePhoto.files[0];
    const portfolioPhotos = [...registrationForm.elements.portfolioPhotos.files];
    const imageFiles = [profilePhoto, ...portfolioPhotos].filter(Boolean);
    const imageTotal = imageFiles.reduce((sum, file) => sum + file.size, 0);
    const badImage = imageFiles.some((file) => !["image/jpeg","image/png","image/webp"].includes(file.type) || file.size > 2 * 1024 * 1024);
    imageError.textContent = badImage || portfolioPhotos.length > 5 || imageTotal > 10 * 1024 * 1024
      ? "Изображенията трябва да са JPG, PNG или WebP, до 2 MB всяко и до 5 снимки на проекти."
      : "";
    valid = !badImage && portfolioPhotos.length <= 5 && imageTotal <= 10 * 1024 * 1024;
  }
  const invalid = [...panel.querySelectorAll("input,select,textarea")].find((control) =>
    control.willValidate && !control.checkValidity());
  if (invalid) {
    invalid.reportValidity();
    valid = false;
  }
  return valid;
}

nextButton.addEventListener("click", () => {
  if (validateStep(currentStep)) setStep(currentStep + 1);
});
backButton.addEventListener("click", () => setStep(currentStep - 1));
stepIndicators.forEach((indicator) => {
  indicator.addEventListener("click", () => {
    const targetStep = Number(indicator.dataset.stepIndicator);
    if (targetStep < currentStep) setStep(targetStep);
  });
});
registrationForm.addEventListener("submit", (event) => {
  if (currentStep !== registrationPanels.length - 1) {
    event.preventDefault();
    event.stopImmediatePropagation();
    if (validateStep(currentStep)) setStep(currentStep + 1);
    return;
  }
  if (!validateStep(currentStep)) {
    event.preventDefault();
    event.stopImmediatePropagation();
  }
}, true);

setStep(0);
