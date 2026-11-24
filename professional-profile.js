const profileId = new URLSearchParams(location.search).get("id");
const profileStatus = document.querySelector("#profile-feedback");
const profileSection = document.querySelector("#professional-profile");
const profileReviewsSection = document.querySelector("#profile-reviews");
const profileReviewsSummary = document.querySelector("#profile-reviews-summary");
const profileReviewsList = document.querySelector("#profile-reviews-list");
const reviewComposeSection = document.querySelector("#review-compose");
const profileReviewForm = document.querySelector("#profile-review-form");
const profileReviewFeedback = document.querySelector("#profile-review-feedback");
const listingSection = document.querySelector("#profile-services");
const profileListings = document.querySelector("#profile-listings");
const portfolioSection = document.querySelector("#profile-portfolio");
const portfolioList = document.querySelector("#profile-portfolio-list");
const profileToast = document.querySelector("#dashboard-toast");
const profileHeaderUser = document.querySelector("#profile-header-user");
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

function updateProfileHeader() {
  const token = localStorage.getItem("stroihub_token") || sessionStorage.getItem("stroihub_token");
  const storedUser = localStorage.getItem("stroihub_user") || sessionStorage.getItem("stroihub_user");
  let user = null;
  try {
    user = storedUser ? JSON.parse(storedUser) : null;
  } catch {
    user = null;
  }
  const action = document.createElement("a");
  action.className = "button button-outline button-small";
  if (token && user) {
    action.href = user.role === "professional" || user.role === "company"
      ? "professional-dashboard.html"
      : "client-dashboard.html";
    action.textContent = "Моят профил";
    profileHeaderUser.replaceChildren(action);
    return;
  }
  action.href = "login.html";
  action.textContent = "Вход";
  const register = document.createElement("a");
  register.className = "button button-primary button-small";
  register.href = "signup.html";
  register.textContent = "Създай профил";
  profileHeaderUser.replaceChildren(action, register);
}

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

function getStoredProfileUser() {
  const storedUser = localStorage.getItem("stroihub_user") || sessionStorage.getItem("stroihub_user");
  try {
    return storedUser ? JSON.parse(storedUser) : null;
  } catch {
    return null;
  }
}

function renderProfileReviews(reviews) {
  profileReviewsList.replaceChildren();
  if (!reviews.length) {
    profileReviewsSection.hidden = true;
    return;
  }
  const realReviews = reviews.filter((review) => !review.isDemo);
  const demoCount = reviews.length - realReviews.length;
  profileReviewsSummary.replaceChildren();
  if (realReviews.length) {
    const average = realReviews.reduce((sum, review) => sum + review.rating, 0) / realReviews.length;
    profileReviewsSummary.append(
      Object.assign(document.createElement("strong"), {textContent: `${average.toFixed(1)} / 5`}),
      Object.assign(document.createElement("span"), {textContent: `${realReviews.length} реални ${realReviews.length === 1 ? "отзив" : "отзива"}${demoCount ? ` · ${demoCount} примерни` : ""}`})
    );
  } else {
    profileReviewsSummary.append(
      Object.assign(document.createElement("span"), {textContent: `${demoCount} примерни ${demoCount === 1 ? "отзив" : "отзива"} · не се включват в средната оценка`})
    );
  }
  reviews.forEach((review) => {
    const card = document.createElement("article");
    card.className = "review-card";
    const heading = document.createElement("div");
    heading.className = "review-heading";
    const avatar = review.authorPhoto
      ? document.createElement("img")
      : document.createElement("span");
    avatar.className = "review-avatar";
    if (review.authorPhoto) {
      avatar.src = review.authorPhoto;
      avatar.alt = `Профилна снимка на ${review.author}`;
    } else {
      avatar.classList.add("review-avatar-placeholder");
      avatar.textContent = review.author.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toLocaleUpperCase("bg-BG");
      avatar.setAttribute("aria-label", `Профил на ${review.author}`);
    }
    const identity = document.createElement("div");
    identity.className = "review-identity";
    const author = document.createElement("strong");
    author.textContent = review.author;
    const date = document.createElement("span");
    date.textContent = new Date(review.createdAt).toLocaleDateString("bg-BG");
    identity.append(author, date);
    heading.append(avatar, identity);
    const rating = document.createElement("span");
    rating.className = "review-rating";
    rating.textContent = `${"★".repeat(review.rating)}${"☆".repeat(5 - review.rating)}`;
    rating.setAttribute("aria-label", `Оценка ${review.rating} от 5`);
    if (review.isDemo) {
      const demoLabel = document.createElement("span");
      demoLabel.className = "review-demo-label";
      demoLabel.textContent = "Примерен отзив";
      card.append(heading, rating, demoLabel);
    } else {
      card.append(heading, rating);
    }
    const comment = document.createElement("p");
    comment.textContent = review.comment;
    card.append(comment);
    profileReviewsList.append(card);
  });
  profileReviewsSection.hidden = false;
}

async function loadEligibleReviewProjects() {
  const token = localStorage.getItem("stroihub_token") || sessionStorage.getItem("stroihub_token");
  if (!token || getStoredProfileUser()?.role !== "client") return;
  try {
    const response = await fetch(`/api/account/reviews/eligible/${encodeURIComponent(profileId)}`, {
      headers:profileAuthHeaders()
    });
    const projects = await response.json().catch(() => []);
    if (!response.ok) throw new Error(projects.message || "Завършените услуги не бяха заредени.");
    if (!projects.length) return;
    const selector = profileReviewForm.elements.projectId;
    projects.forEach((project) => {
      selector.add(new Option(`${project.service || "Услуга"} · ${project.city || "населено място"}`, project.id));
    });
    reviewComposeSection.hidden = false;
  } catch (error) {
    profileReviewFeedback.textContent = error.message;
    reviewComposeSection.hidden = false;
  }
}

profileReviewForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const submit = profileReviewForm.querySelector('button[type="submit"]');
  submit.disabled = true;
  profileReviewFeedback.textContent = "";
  const formData = new FormData(profileReviewForm);
  try {
    const response = await fetch("/api/account/reviews", {
      method:"POST",
      headers:{...profileAuthHeaders(),"Content-Type":"application/json"},
      body:JSON.stringify({
        projectId:formData.get("projectId"),
        rating:Number(formData.get("rating")),
        comment:formData.get("comment")
      })
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.message || "Мнението не беше публикувано.");
    location.reload();
  } catch (error) {
    profileReviewFeedback.textContent = error.message;
    submit.disabled = false;
  }
});

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
    const profileImage = document.querySelector("#profile-image");
    profileImage.alt = `Снимка на ${profile.name}`;
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
    profileImage.src = profile.profilePhoto || profileImages[firstListing?.service] || "images/platform-overview.jpg";
    renderProfileReviews(Array.isArray(profile.reviews) ? profile.reviews : []);
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
        Object.assign(document.createElement("small"), {textContent:listing.city}),
        Object.assign(document.createElement("strong"), {className:"service-price",textContent:listing.price || "Цена по договаряне"})
      );
      card.append(image, copy);
      profileListings.append(card);
    });
    (profile.portfolio || []).forEach((project) => {
      const card = document.createElement("article");
      card.className = "portfolio-card";
      const image = document.createElement("img");
      image.src = project.image || profileImages[project.category] || "images/platform-overview.jpg";
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
    await loadEligibleReviewProjects();
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

updateProfileHeader();
void loadProfessionalProfile();
