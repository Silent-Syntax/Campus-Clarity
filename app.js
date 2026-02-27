const TOTAL_STEPS = 4;

const form = document.getElementById("college-form");
const panels = Array.from(document.querySelectorAll(".wizard-panel"));
const steps = Array.from(document.querySelectorAll(".wizard-step"));
const prevBtn = document.getElementById("prev-btn");
const nextBtn = document.getElementById("next-btn");
const submitBtn = document.getElementById("submit-btn");
const currentStepEl = document.getElementById("current-step");
const summaryEl = document.getElementById("summary");
const resultsEl = document.getElementById("results");
const collegeAreaField = document.getElementById("college-area-field");

let currentStep = 1;

function updateConditionalFields() {
  const hostelPreference = getRadioValue("hostelPreference");
  const showCollegeArea = hostelPreference === "yes";

  if (collegeAreaField) {
    collegeAreaField.classList.toggle("is-hidden", !showCollegeArea);
  }
}

function showStep(step) {
  currentStep = step;

  panels.forEach((panel) => {
    const panelStep = Number(panel.dataset.step);
    panel.classList.toggle("active", panelStep === currentStep);
  });

  steps.forEach((stepItem) => {
    const stepIndex = Number(stepItem.dataset.step);
    stepItem.classList.toggle("active", stepIndex === currentStep);
    stepItem.classList.toggle("completed", stepIndex < currentStep);
  });

  prevBtn.disabled = currentStep === 1;
  nextBtn.hidden = currentStep === TOTAL_STEPS;
  submitBtn.hidden = currentStep !== TOTAL_STEPS;

  currentStepEl.textContent = String(currentStep);

  if (currentStep === TOTAL_STEPS) {
    buildSummary();
  }

  updateConditionalFields();
}

function nextStep() {
  if (currentStep < TOTAL_STEPS) {
    showStep(currentStep + 1);
  }
}

function prevStep() {
  if (currentStep > 1) {
    showStep(currentStep - 1);
  }
}

function getCheckedValues(name) {
  return Array.from(
    document.querySelectorAll(`input[name="${name}"]:checked`)
  ).map((el) => el.value);
}

function getRadioValue(name) {
  const el = document.querySelector(`input[name="${name}"]:checked`);
  return el ? el.value : "";
}

function valueOr(label, value) {
  if (!value || String(value).trim() === "") {
    return `<span class="summary-item-label">${label}:</span> Not specified`;
  }
  return `<span class="summary-item-label">${label}:</span> ${value}`;
}

function buildSummary() {
  const data = {
    examName: form.examName.value,
    examRank: form.examRank.value,
    examRankBand: getRadioValue("examRankBand"),
    requiredBranch: form.requiredBranch.value,
    category: form.category.value,
    collegeType: getCheckedValues("collegeType"),
    budgetMin: form.budgetMin.value,
    budgetMax: form.budgetMax.value,
    naacGrade: form.naacGrade.value,
    dualDegree: form.dualDegree.value,
    hostelPreference: getRadioValue("hostelPreference"),
    collegeArea: getRadioValue("collegeArea"),
    homeLocation: form.homeLocation.value,
    maxDistanceKm: form.maxDistanceKm.value,
    transportImportance: getRadioValue("transportImportance"),
    festFrequency: form.festFrequency.value,
    facilities: getCheckedValues("facilities"),
    genderRatio: form.genderRatio.value,
    scholarshipImportance: form.scholarshipImportance.value,
    placementImportance: form.placementImportance.value,
    dreamColleges: form.dreamColleges.value,
  };

  const budgetText =
    data.budgetMin || data.budgetMax
      ? `₹${data.budgetMin || "0"} – ₹${data.budgetMax || "N/A"}`
      : "";

  const rankTextParts = [];
  if (data.examRank && String(data.examRank).trim() !== "") {
    rankTextParts.push(`Exact: ${data.examRank}`);
  }
  if (data.examRankBand && data.examRankBand !== "not-sure") {
    rankTextParts.push(`Band: ${data.examRankBand}`);
  }
  const rankText = rankTextParts.join(" • ");

  const collegeTypeText =
    data.collegeType.length > 0 ? data.collegeType.join(", ") : "";

  const facilitiesText =
    data.facilities.length > 0 ? data.facilities.join(", ") : "";

  summaryEl.innerHTML = `
    <div class="summary-group">
      <h4>Academic profile</h4>
      <p class="summary-kv">${valueOr("Entrance exam", data.examName)}</p>
      <p class="summary-kv">${valueOr("Entrance rank", rankText)}</p>
      <p class="summary-kv">${valueOr("Preferred branch", data.requiredBranch)}</p>
      <p class="summary-kv">${valueOr("Category", data.category)}</p>
      <p class="summary-kv">${valueOr("Preferred college type", collegeTypeText)}</p>
      <p class="summary-kv">${valueOr("Budget (per year)", budgetText)}</p>
      <p class="summary-kv">${valueOr("Minimum NAAC grade", data.naacGrade)}</p>
      <p class="summary-kv">${valueOr("Dual degree preference", data.dualDegree)}</p>
    </div>

    <div class="summary-group">
      <h4>Location & stay</h4>
      <p class="summary-kv">${valueOr("Hostel preference", data.hostelPreference)}</p>
      ${
        data.hostelPreference === "yes"
          ? `<p class="summary-kv">${valueOr(
              "Preferred college area (urban/rural)",
              data.collegeArea
            )}</p>`
          : ""
      }
      <p class="summary-kv">${valueOr("Home location", data.homeLocation)}</p>
      <p class="summary-kv">${valueOr(
        "Max distance from home (km)",
        data.maxDistanceKm
      )}</p>
      <p class="summary-kv">${valueOr(
        "Transport importance",
        data.transportImportance
      )}</p>
    </div>

    <div class="summary-group">
      <h4>Campus life & extras</h4>
      <p class="summary-kv">${valueOr(
        "Fest / events frequency",
        data.festFrequency
      )}</p>
      <p class="summary-kv">${valueOr("Campus facilities", facilitiesText)}</p>
      <p class="summary-kv">${valueOr(
        "Gender ratio importance",
        data.genderRatio
      )}</p>
      <p class="summary-kv">${valueOr(
        "Scholarship importance",
        data.scholarshipImportance
      )}</p>
      <p class="summary-kv">${valueOr(
        "Placement record importance",
        data.placementImportance
      )}</p>
      <p class="summary-kv">${valueOr(
        "Dream colleges",
        data.dreamColleges
      )}</p>
    </div>
  `;
}

prevBtn.addEventListener("click", prevStep);
nextBtn.addEventListener("click", nextStep);

document
  .querySelectorAll('input[name="hostelPreference"]')
  .forEach((el) => el.addEventListener("change", updateConditionalFields));

form.addEventListener("submit", (event) => {
  event.preventDefault();
  buildSummary();

  const formData = new FormData(form);
  const payload = {};

  for (const [key, value] of formData.entries()) {
    if (payload[key]) {
      if (!Array.isArray(payload[key])) {
        payload[key] = [payload[key]];
      }
      payload[key].push(value);
    } else {
      payload[key] = value;
    }
  }

  console.log("College finder payload:", payload);

  if (!resultsEl) {
    alert("Results container not found in the page.");
    return;
  }

  resultsEl.hidden = false;
  resultsEl.innerHTML = `
    <div class="results-header">
      <h2 class="results-title">Finding best matches…</h2>
      <div class="results-pills">
        <span class="results-pill">Loading college database</span>
        <span class="results-pill">Checking eligibility</span>
        <span class="results-pill">Ranking options</span>
      </div>
    </div>
  `;

  // Client-side "agent" suggestion engine (static database under /data).
  const advisor = window.CollegeAdvisor;
  if (!advisor) {
    resultsEl.innerHTML = `
      <div class="results-empty">
        <h3>Advisor agent is not loaded.</h3>
        <p>Make sure <code>collegeAdvisor.js</code> is included before <code>app.js</code>.</p>
      </div>
    `;
    return;
  }

  Promise.resolve()
    .then(async () => {
      const db = await advisor.loadDatabase();
      const suggestions = advisor.suggestColleges(payload, db, { topN: 10 });
      advisor.renderResults(resultsEl, suggestions);
    })
    .catch((err) => {
      console.error("Advisor agent error:", err);
      resultsEl.innerHTML = `
        <div class="results-empty">
          <h3>Could not load the college database.</h3>
          <p>${String(err && err.message ? err.message : err)}</p>
          <p><strong>Tip:</strong> Open this project via a local server (for example VS Code Live Server), not via <code>file://</code>.</p>
        </div>
      `;
    });
});

showStep(1);

