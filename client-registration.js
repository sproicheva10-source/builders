const registrationForm = document.querySelector(".client-registration-form");
const registrationPanels = [...document.querySelectorAll("[data-step-panel]")];
const stepIndicators = [...document.querySelectorAll("[data-step-indicator]")];
const backButton = document.querySelector("[data-registration-back]");
const nextButton = document.querySelector("[data-registration-next]");
const submitButton = document.querySelector("[data-registration-submit]");
const imageError = document.querySelector("#image-error");
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

function validateStep(step) {
  const panel = registrationPanels[step];
  let valid = true;
  imageError.textContent = "";

  if (step === 1) {
    if (registrationForm.elements.password.value !== registrationForm.elements.confirmPassword.value) {
      const status = registrationForm.querySelector(".auth-page-status");
      status.textContent = "Паролите не съвпадат.";
      status.classList.add("error");
      registrationForm.elements.confirmPassword.focus();
      return false;
    }

    const profilePhoto = registrationForm.elements.profilePhoto.files[0];
    if (profilePhoto &&
        (!["image/jpeg","image/png","image/webp"].includes(profilePhoto.type) ||
         profilePhoto.size > 2 * 1024 * 1024)) {
      imageError.textContent = "Снимката трябва да е JPG, PNG или WebP и да е до 2 MB.";
      valid = false;
    }
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
