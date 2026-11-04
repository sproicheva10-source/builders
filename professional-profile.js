const profileId = new URLSearchParams(location.search).get("id");
const profileStatus = document.querySelector("#profile-feedback");
const profileSection = document.querySelector("#professional-profile");
const listingSection = document.querySelector("#profile-services");
const profileListings = document.querySelector("#profile-listings");
const portfolioSection = document.querySelector("#profile-portfolio");
const portfolioList = document.querySelector("#profile-portfolio-list");
const profileToast = document.querySelector("#dashboard-toast");
const profileImages = {
  "ВиК услуги":"images/plumbing_services.jpg",
  "Електро услуги":"images/electrical_services.jpg",
  "Боядисване":"images/painting.jpg",
  "Строителство":"images/construction.jpg",
  "Ремонти":"images/repairs.jpg",
  "Монтажи":"images/montage.jpg",
  "Дограма и остъкляване":"images/glazing.jpg",
  "Почистване":"images/cleaning.jpg"
};

function showProfileToast(message) {
  profileToast.textContent = message;
  profileToast.classList.add("show");
  window.setTimeout(() => profileToast.classList.remove("show"), 3200);
}

function profileAuthHeaders() {
  const token = localStorage.getItem("stroihub_token") || sessionStorage.getItem("stroihub_token");
  if (!token) throw new Error("Влез в профила си, за да запазваш любими специалисти.");
  return {Authorization:`Bearer ${token}`};
}

async function loadProfessionalProfile() {
  if (!profileId) {
    profileStatus.textContent = "Липсва идентификатор на профила.";
    profileStatus.classList.add("error");
    return;
  }
  try {
    const response = await fetch(`/api/professionals/${encodeURIComponent(profileId)}`);
    const profile = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(profile.message || "Профилът не е намерен.");
    document.title = `${profile.name} — StroiHub`;
    document.querySelector("#profile-name").textContent = profile.name;
    const firstListing = profile.listings[0];
    document.querySelector("#profile-location").textContent = firstListing
      ? `${firstListing.service} · ${firstListing.city}${profile.region ? `, обл. ${profile.region}` : ""}`
      : `${profile.city}${profile.region ? `, обл. ${profile.region}` : ""}${profile.additionalCities ? ` · Работи и в: ${profile.additionalCities}` : ""}`;
    document.querySelector("#profile-description").textContent = profile.description || firstListing?.description || "";
    const profileDetails = [
      profile.experience !== null ? `Опит: ${profile.experience} г.` : "",
      profile.workPreference ? `Предпочита да работи ${profile.workPreference.toLowerCase()}` : "",
      profile.primaryCategory ? `Основна категория: ${profile.primaryCategory}` : "",
      profile.categories?.length ? `Категории: ${profile.categories.join(", ")}` : "",
      profile.services?.length ? `Услуги: ${profile.services.join(", ")}` : ""
    ].filter(Boolean);
    const profileDetailsElement = document.querySelector("#profile-details");
    profileDetailsElement.textContent = profileDetails.join(" · ");
    if (/^https?:\/\/\S+$/i.test(profile.professionalLink || "")) {
      if (profileDetailsElement.textContent) profileDetailsElement.append(" · ");
      const link = document.createElement("a");
      link.href = profile.professionalLink;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.textContent = "Професионална страница";
      profileDetailsElement.append(link);
    }
    document.querySelector("#profile-image").src = profile.profilePhoto || profileImages[firstListing?.service] || "images/platform-overview.jpg";
    profile.listings.forEach((listing) => {
      const card = document.createElement("article");
      card.className = "professional-card";
      const image = document.createElement("img");
      image.className = "professional-image";
      image.src = profileImages[listing.service] || "images/platform-overview.jpg";
      image.alt = listing.service;
      const copy = document.createElement("div");
      copy.className = "professional-card-body";
      copy.append(
        Object.assign(document.createElement("span"), {className:"service-tag",textContent:listing.service}),
        Object.assign(document.createElement("h3"), {textContent:listing.title || listing.service}),
        Object.assign(document.createElement("p"), {textContent:listing.description}),
        Object.assign(document.createElement("small"), {textContent:listing.city})
      );
      card.append(image, copy);
      profileListings.append(card);
    });
    (profile.portfolio || []).forEach((project) => {
      const card = document.createElement("article");
      card.className = "portfolio-card";
      const image = document.createElement("img");
      image.src = profileImages[project.category] || "images/platform-overview.jpg";
      image.alt = project.category;
      const copy = document.createElement("div");
      copy.append(
        Object.assign(document.createElement("span"), {className:"service-tag",textContent:project.category}),
        Object.assign(document.createElement("h3"), {textContent:project.title}),
        Object.assign(document.createElement("p"), {textContent:project.description})
      );
      card.append(image, copy);
      portfolioList.append(card);
    });
    (profile.portfolioPhotos || []).forEach((photo, index) => {
      const card = document.createElement("article");
      card.className = "portfolio-card";
      const image = document.createElement("img");
      image.src = photo;
      image.alt = `Завършен проект ${index + 1}`;
      card.append(image);
      portfolioList.append(card);
    });
    profileSection.hidden = false;
    listingSection.hidden = profile.listings.length === 0;
    portfolioSection.hidden = !(profile.portfolio || []).length && !(profile.portfolioPhotos || []).length;
    profileStatus.textContent = "";
    document.querySelector("#send-request").addEventListener("click", () => {
      const token = localStorage.getItem("stroihub_token") || sessionStorage.getItem("stroihub_token");
      if (!token) {
        location.href = `login.html?returnTo=${encodeURIComponent(`client-dashboard.html?professionalId=${profile.id}`)}`;
        return;
      }
      location.href = `client-dashboard.html?professionalId=${encodeURIComponent(profile.id)}`;
    });
    document.querySelector("#favorite-profile").addEventListener("click", async (event) => {
      const button = event.currentTarget;
      button.disabled = true;
      try {
        const headers = profileAuthHeaders();
        const response = await fetch("/api/account/favorites", {headers});
        const favorites = await response.json().catch(() => []);
        if (!response.ok) throw new Error(favorites.message || "Любимите профили не бяха заредени.");
        const updated = favorites.includes(profile.id)
          ? favorites.filter((id) => id !== profile.id)
          : [...favorites, profile.id];
        const saveResponse = await fetch("/api/account/favorites", {
          method:"PUT",
          headers:{...headers,"Content-Type":"application/json"},
          body:JSON.stringify({professionalIds:updated})
        });
        const saved = await saveResponse.json().catch(() => ({}));
        if (!saveResponse.ok) throw new Error(saved.message || "Промяната не беше запазена.");
        button.textContent = saved.includes(profile.id) ? "Премахни от любими" : "Добави в любими";
        showProfileToast(saved.includes(profile.id) ? "Профилът е добавен в любимите." : "Профилът е премахнат от любимите.");
      } catch (error) {
        showProfileToast(error.message);
      } finally {
        button.disabled = false;
      }
    });
    if (localStorage.getItem("stroihub_token") || sessionStorage.getItem("stroihub_token")) {
      const favoriteResponse = await fetch("/api/account/favorites", {headers:profileAuthHeaders()});
      if (favoriteResponse.ok) {
        const favorites = await favoriteResponse.json();
        document.querySelector("#favorite-profile").textContent = favorites.includes(profile.id)
          ? "Премахни от любими"
          : "Добави в любими";
      }
    }
  } catch (error) {
    profileStatus.textContent = error.message;
    profileStatus.classList.add("error");
  }
}

void loadProfessionalProfile();
