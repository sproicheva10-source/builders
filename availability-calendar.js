function createAvailabilityCalendar(form) {
  const calendar = form.querySelector("[data-availability-calendar]");
  if (!calendar) return null;

  const monthLabel = calendar.querySelector("[data-calendar-month]");
  const daysContainer = calendar.querySelector("[data-calendar-days]");
  const status = calendar.querySelector("[data-calendar-status]");
  const previousMonth = calendar.querySelector("[data-calendar-previous]");
  const nextMonth = calendar.querySelector("[data-calendar-next]");
  const selectedPeriod = form.elements.preferredPeriod;
  const selectedPeriodDisplay = form.elements.preferredPeriodDisplay;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const currentMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  let visibleMonth = new Date(currentMonth);
  let unavailableDates = new Set();
  let isReady = false;
  let selectedStartValue = "";
  let selectedEndValue = "";
  let statusMessage = "Избери майстор, за да видиш свободните периоди.";

  function toDateValue(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function isBeforeToday(date) {
    return date.getTime() < today.getTime();
  }

  function render() {
    monthLabel.textContent = visibleMonth.toLocaleDateString("bg-BG", {month:"long",year:"numeric"});
    status.textContent = statusMessage;
    daysContainer.replaceChildren();
    previousMonth.disabled = visibleMonth <= currentMonth;
    const latestMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 12, 1);
    nextMonth.disabled = visibleMonth >= latestMonth;

    const firstDay = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), 1);
    const startingOffset = (firstDay.getDay() + 6) % 7;
    for (let index = 0; index < startingOffset; index += 1) {
      const emptyDay = document.createElement("span");
      emptyDay.className = "calendar-day-empty";
      emptyDay.setAttribute("aria-hidden", "true");
      daysContainer.append(emptyDay);
    }

    const daysInMonth = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1, 0).getDate();
    for (let day = 1; day <= daysInMonth; day += 1) {
      const date = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), day);
      const value = toDateValue(date);
      const isUnavailable = unavailableDates.has(value);
      const button = document.createElement("button");
      button.className = "calendar-day";
      button.type = "button";
      button.textContent = String(day);
      button.setAttribute("aria-pressed", String(value === selectedStartValue || value === selectedEndValue));
      button.setAttribute("aria-label", date.toLocaleDateString("bg-BG", {weekday:"long",day:"numeric",month:"long",year:"numeric"}));
      const isInSelectedRange = selectedStartValue &&
        selectedEndValue &&
        value >= selectedStartValue &&
        value <= selectedEndValue;
      if (isInSelectedRange) button.classList.add("is-range");
      if (value === selectedStartValue) button.classList.add("is-range-start");
      if (value === selectedEndValue) button.classList.add("is-range-end");
      if (isInSelectedRange) button.setAttribute("aria-pressed", "true");
      if (toDateValue(date) === toDateValue(today)) button.classList.add("is-today");
      if (isUnavailable) {
        button.classList.add("is-busy");
        button.disabled = true;
        button.title = "Зает период";
        button.setAttribute("aria-label", `${button.getAttribute("aria-label")} · зает период`);
      } else {
        button.disabled = !isReady || isBeforeToday(date);
      }
      button.addEventListener("click", () => {
        if (button.disabled || isUnavailable) return;
        if (!selectedStartValue || selectedEndValue) {
          selectedStartValue = value;
          selectedEndValue = "";
          selectedPeriod.value = "";
          selectedPeriodDisplay.value = "";
          statusMessage = `Начало на периода: ${formatScheduleDate(value)}. Избери последния ден на периода.`;
          render();
          return;
        }

        if (value <= selectedStartValue) {
          selectedStartValue = value;
          selectedPeriod.value = "";
          selectedPeriodDisplay.value = "";
          statusMessage = `Начало на периода: ${formatScheduleDate(value)}. Избери последния ден на периода.`;
          render();
          return;
        }

        const rangeStart = new Date(`${selectedStartValue}T00:00:00`);
        const rangeEnd = new Date(`${value}T00:00:00`);
        for (const cursor = new Date(rangeStart); cursor <= rangeEnd; cursor.setDate(cursor.getDate() + 1)) {
          if (unavailableDates.has(toDateValue(cursor))) {
            statusMessage = "Избраният период включва зает ден. Избери край преди заетия период.";
            render();
            return;
          }
        }

        selectedEndValue = value;
        selectedPeriod.value = `${selectedStartValue}/${selectedEndValue}`;
        selectedPeriodDisplay.value = `${formatScheduleDate(selectedStartValue)} – ${formatScheduleDate(selectedEndValue)}`;
        statusMessage = `Избран период: ${selectedPeriodDisplay.value}.`;
        render();
      });
      daysContainer.append(button);
    }
  }

  previousMonth.addEventListener("click", () => {
    visibleMonth = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() - 1, 1);
    render();
  });
  nextMonth.addEventListener("click", () => {
    visibleMonth = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1, 1);
    render();
  });

  render();
  return {
    clear(message = "Избери майстор, за да видиш свободните периоди.") {
      unavailableDates = new Set();
      isReady = false;
      selectedStartValue = "";
      selectedEndValue = "";
      selectedPeriod.value = "";
      selectedPeriodDisplay.value = "";
      statusMessage = message;
      visibleMonth = new Date(currentMonth);
      render();
    },
    setUnavailableDates(dates) {
      unavailableDates = new Set(Array.isArray(dates) ? dates : []);
      isReady = true;
      selectedStartValue = "";
      selectedEndValue = "";
      selectedPeriod.value = "";
      selectedPeriodDisplay.value = "";
      statusMessage = "Избери начална и крайна дата. По-тъмните дни са заети.";
      visibleMonth = new Date(currentMonth);
      render();
    }
  };
}

function formatScheduleDate(value) {
  const period = /^(\d{4}-\d{2}-\d{2})\/(\d{4}-\d{2}-\d{2})$/.exec(value || "");
  if (period) return `${formatScheduleDate(period[1])} – ${formatScheduleDate(period[2])}`;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value || "");
  if (!match) return value || "";
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])).toLocaleDateString("bg-BG");
}
