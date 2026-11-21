const regionSelect = document.querySelector("#registration-region");
const citySelect = document.querySelector("#registration-city");
const cityStatus = document.querySelector("#registration-city-status");

if (regionSelect && citySelect && cityStatus) {
  let citiesByRegion;
  let locationsLoadError = false;

  function updateCities() {
    const region = regionSelect.value;
    citySelect.replaceChildren(new Option("Избери град", ""));
    citySelect.value = "";
    citySelect.disabled = !region;
    citySelect.setCustomValidity("");

    if (!region) {
      cityStatus.textContent = "Избери област, за да видиш градовете.";
      return;
    }

    if (locationsLoadError) {
      cityStatus.textContent = "Списъкът с градове не се зареди. Презареди страницата.";
      citySelect.disabled = false;
      citySelect.setCustomValidity("Списъкът с градове не е зареден.");
      return;
    }

    const cities = citiesByRegion?.[region] || [];
    cities.forEach((city) => citySelect.add(new Option(city, city)));
    cityStatus.textContent = cities.length
      ? "Избери град от списъка."
      : "Няма налични градове за избраната област.";
  }

  regionSelect.addEventListener("change", updateCities);
  updateCities();

  fetch("locations.json")
    .then((response) => {
      if (!response.ok) throw new Error(`Неуспешно зареждане на градовете (${response.status}).`);
      return response.json();
    })
    .then((locations) => {
      citiesByRegion = locations;
      updateCities();
    })
    .catch((error) => {
      console.error(error);
      locationsLoadError = true;
      updateCities();
    });
}
