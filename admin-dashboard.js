const token = localStorage.getItem("stroihub_token") || sessionStorage.getItem("stroihub_token");
const storedUser = localStorage.getItem("stroihub_user") || sessionStorage.getItem("stroihub_user");
let user = null;
try { user = storedUser ? JSON.parse(storedUser) : null; } catch { user = null; }

function getHeaders() {
  return {"Authorization":`Bearer ${token}`,"Content-Type":"application/json"};
}

async function apiRequest(url, options = {}) {
  const response = await fetch(url, {...options, headers: getHeaders()});
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.message || "Заявката не беше изпълнена.");
  return result;
}

function setFeedback(message) {
  document.querySelector("#admin-feedback").textContent = message;
}

function escapeHtml(value) {
  const element = document.createElement("span");
  element.textContent = value ?? "";
  return element.innerHTML;
}

async function loadSummary() {
  const summary = await apiRequest("/api/admin/summary");
  document.querySelectorAll("[data-summary]").forEach((element) => {
    element.textContent = summary[element.dataset.summary] ?? 0;
  });
}

async function loadUsers() {
  const users = await apiRequest("/api/admin/users");
  document.querySelector("#admin-users").innerHTML = users.map((item) => `
    <tr>
      <td>${escapeHtml(item.name)}</td>
      <td>${escapeHtml(item.email)}</td>
      <td>${escapeHtml(item.role)}</td>
      <td>${escapeHtml(item.city)}</td>
      <td>${item.role === "admin" ? "—" : `<button class="admin-danger" type="button" data-delete-user="${escapeHtml(item.id)}">Изтрий</button>`}</td>
    </tr>`).join("") || '<tr><td colspan="5">Няма потребители.</td></tr>';
}

async function loadListings() {
  const listings = await apiRequest("/api/admin/listings");
  document.querySelector("#admin-listings").innerHTML = listings.map((item) => `
    <tr>
      <td>${escapeHtml(item.title || item.service)}</td>
      <td>${escapeHtml(item.owner)}</td>
      <td>${escapeHtml(item.city)}</td>
      <td class="admin-description">${escapeHtml(item.description)}</td>
      <td><button class="admin-danger" type="button" data-delete-listing="${escapeHtml(item.id)}">Изтрий</button></td>
    </tr>`).join("") || '<tr><td colspan="5">Няма обяви.</td></tr>';
}

async function loadProjects() {
  const projects = await apiRequest("/api/admin/projects");
  document.querySelector("#admin-projects").innerHTML = projects.map((item) => `
    <tr>
      <td>${escapeHtml(item.client)}</td>
      <td>${escapeHtml(item.service)}</td>
      <td>${escapeHtml(item.city)}</td>
      <td>
        <select class="admin-status" data-project-status="${escapeHtml(item.id)}">
          ${["Изпратено","Преглеждано","Прието","Отхвърлено","Завършено"].map((status) => `<option${status === item.status ? " selected" : ""}>${status}</option>`).join("")}
        </select>
      </td>
      <td>${escapeHtml(item.professional)}</td>
    </tr>`).join("") || '<tr><td colspan="5">Няма проекти.</td></tr>';
}

async function refreshAll() {
  await Promise.all([loadSummary(), loadUsers(), loadListings(), loadProjects()]);
}

document.querySelectorAll("[data-admin-tab]").forEach((tab) => {
  tab.addEventListener("click", () => {
    document.querySelectorAll("[data-admin-tab]").forEach((item) => item.classList.remove("active"));
    tab.classList.add("active");
    document.querySelectorAll("[data-admin-section]").forEach((section) => {
      section.hidden = section.dataset.adminSection !== tab.dataset.adminTab;
    });
  });
});

document.addEventListener("click", async (event) => {
  const deleteUser = event.target.closest("[data-delete-user]");
  const deleteListing = event.target.closest("[data-delete-listing]");
  if (!deleteUser && !deleteListing) return;
  if (!confirm(deleteUser ? "Изтрий този потребител и свързаните му данни?" : "Изтрий тази обява?")) return;
  try {
    if (deleteUser) await apiRequest(`/api/admin/users/${encodeURIComponent(deleteUser.dataset.deleteUser)}`, {method:"DELETE"});
    if (deleteListing) await apiRequest(`/api/admin/listings/${encodeURIComponent(deleteListing.dataset.deleteListing)}`, {method:"DELETE"});
    setFeedback("Промяната е запазена.");
    await refreshAll();
  } catch (error) { setFeedback(error.message); }
});

document.addEventListener("change", async (event) => {
  const select = event.target.closest("[data-project-status]");
  if (!select) return;
  try {
    await apiRequest(`/api/admin/projects/${encodeURIComponent(select.dataset.projectStatus)}/status`, {
      method:"PUT",
      body:JSON.stringify({status:select.value})
    });
    setFeedback("Статусът е обновен.");
  } catch (error) { setFeedback(error.message); }
});

document.querySelector("[data-admin-logout]").addEventListener("click", () => {
  localStorage.removeItem("stroihub_token");
  localStorage.removeItem("stroihub_user");
  sessionStorage.removeItem("stroihub_token");
  sessionStorage.removeItem("stroihub_user");
  location.replace("login.html");
});

if (!token || !user || user.role !== "admin") {
  location.replace("login.html");
} else {
  document.querySelector("[data-user-name]").textContent = user.name || "Администратор";
  refreshAll().catch((error) => setFeedback(error.message));
}
