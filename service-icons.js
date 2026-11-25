const serviceIcons = {
  "ВиК услуги": '<path d="M5 5v5a3 3 0 0 0 3 3h8a3 3 0 0 1 3 3v3"/><path d="M3 5h4M17 19h4"/><path d="M12 3v4"/><path d="M10 3h4"/><path class="service-icon-accent" d="M18 7c1.4 1.7 2 2.7 2 3.6a2 2 0 0 1-4 0c0-.9.6-1.9 2-3.6Z"/>',
  "Електро услуги": '<path d="m13 2-8 12h6l-1 8 9-13h-6l1-7Z"/>',
  "Боядисване": '<path d="M4 4h13v5H4z"/><path d="M17 6h2a2 2 0 0 1 2 2v3a3 3 0 0 1-3 3h-4v3"/><path d="M12 17v4"/><path class="service-icon-accent" d="M9 21h6"/>',
  "Строителство": '<path d="m3 11 9-8 9 8"/><path d="M5 10v11h14V10"/><path d="M9 21v-6h6v6"/><path class="service-icon-accent" d="M3 21h18"/>',
  "Ремонти": '<path d="m14 7 3-3a5 5 0 0 0-6 6L4 17a2.1 2.1 0 0 0 3 3l7-7a5 5 0 0 0 6-6l-3 3-3-3Z"/>',
  "Монтажи": '<path d="m14 4 6 6"/><path d="m16 2 6 6-3 3-6-6"/><path d="m13 7-9 9a2 2 0 0 0 3 3l9-9"/><path class="service-icon-accent" d="m5 17 2 2"/>',
  "Дограма и остъкляване": '<rect x="3" y="3" width="18" height="18" rx="1"/><path d="M12 3v18M3 12h18"/><path class="service-icon-accent" d="M6 6h3M15 18h3"/>',
  "Почистване": '<path d="m14 3-2 10"/><path d="m10 3 4 1"/><path d="M12 13 5 20"/><path d="M10 15 7 18M13 16l-3 3M16 17l-2 3M8 13l-3 3"/><path class="service-icon-accent" d="m18 4 .5 1.5L20 6l-1.5.5L18 8l-.5-1.5L16 6l1.5-.5L18 4Z"/>'
};

function getServiceIconMarkup(service) {
  const paths = serviceIcons[service] || serviceIcons["Строителство"];
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${paths}</svg>`;
}

document.querySelectorAll("[data-service-icon]").forEach((icon) => {
  icon.innerHTML = getServiceIconMarkup(icon.dataset.serviceIcon);
});
