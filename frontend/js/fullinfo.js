function disableEditMode() {
  isEditMode = false;

  // Disable all text inputs
  document.querySelectorAll("input, select, textarea").forEach(el => {
    el.disabled = true;
  });

  // Disable save buttons
  document.querySelectorAll(".section-save-btn").forEach(btn => {
    btn.disabled = true;
    btn.classList.add("disabled");
  });

  // HIDE chip remove buttons
  document.querySelectorAll(".chip-remove").forEach(btn => {
    btn.style.display = "none";
  });

  // DISABLE add-boxes
  document.querySelectorAll(".add-box").forEach(box => {
    box.style.pointerEvents = "none";
    box.style.opacity = "0.5";
  });

  // COLLAPSE all add areas
  document.querySelectorAll(".collapse").forEach(div => {
    div.classList.remove("show");
  });

  // Buttons toggle
  document.getElementById("finalSaveBtn").disabled = true;
  document.getElementById("editInfoBtn").classList.remove("d-none");

  // Re-render chips to update remove buttons
  renderSelectedSkills();
  renderSelectedInterests();
}
function enableEditMode() {
  isEditMode = true;

  // Enable all inputs & selects
  document.querySelectorAll("input, select, textarea").forEach(el => {
    el.disabled = false;
  });

  // Enable all save buttons
  document.querySelectorAll(".section-save-btn").forEach(btn => {
    btn.disabled = false;
    btn.classList.remove("disabled");
  });

  // ENABLE chip remove buttons
  document.querySelectorAll(".chip-remove").forEach(btn => {
    btn.style.display = "inline-block";
  });

  // SHOW add-box (skills, interests, strengths, weaknesses)
  document.querySelectorAll(".add-box").forEach(box => {
    box.style.pointerEvents = "auto";
    box.style.opacity = "1";
  });

  // SHOW collapsed boxes (so user can add items)
  document.querySelectorAll(".collapse").forEach(div => {
    div.classList.add("show");
  });

  // Buttons toggle
  document.getElementById("finalSaveBtn").disabled = false;
  document.getElementById("editInfoBtn").classList.add("d-none");

  // Re-render chips to update remove buttons
  renderSelectedSkills();
  renderSelectedInterests();
}
let isEditMode = false;
// Render selected interests as chips with remove buttons (edit mode aware)
function renderSelectedInterests() {
  const box = document.getElementById("selectedInterests");
  box.innerHTML = "";

  selectedInterests.forEach(i => {
    const chip = document.createElement("span");
    chip.className = "chip";
    chip.innerHTML = `
      ${i}
      <button class="chip-remove" style="display:${isEditMode ? 'inline-block' : 'none'}" onclick="removeInterest('${i}')">×</button>
    `;
    box.appendChild(chip);
  });
}
// Render selected skills as chips with remove buttons (edit mode aware)
function renderSelectedSkills() {
    const box = document.getElementById("selectedSkills");
    box.innerHTML = "";

    selectedSkills.forEach(s => {
        const chip = document.createElement("span");
        chip.className = "chip";

        chip.innerHTML = `
            ${s}
            <button class="chip-remove" style="display:${isEditMode ? 'inline-block' : 'none'}"
                onclick="removeSkill('${s}')">×</button>
        `;

        box.appendChild(chip);
    });
}
// fullinfo.js
// Handles: sidebar switching, education logic, skill/interest chips, save/load profile
// Assumes the HTML IDs/classes from the page you posted.

(function () {
  // ---------- helper: toast ----------
  function _showToast(msg, type = "info") {
    if (typeof showToast === "function") {
      showToast(msg, type);
      return;
    }
    // minimal fallback
    console[type === "danger" ? "error" : "log"]("[toast]", msg);
  }

  // Simple in-page toast helper (used by _showToast when available)
  function showToast(msg, type = "success") {
    try {
      const t = document.createElement("div");
      t.className = `toast align-items-center text-bg-${type} border-0 show`;
      t.style.position = "fixed";
      t.style.right = "20px";
      t.style.top = "20px";
      t.style.zIndex = 1080;
      t.innerHTML = `
        <div class="d-flex">
          <div class="toast-body">${msg}</div>
          <button type="button" class="btn-close btn-close-white me-2 m-auto"></button>
        </div>`;
      document.body.appendChild(t);
      // allow click-to-close
      t.querySelector('.btn-close')?.addEventListener('click', () => t.remove());
      setTimeout(() => t.remove(), 2500);
    } catch (e) {
      console.log('[showToast]', msg);
    }
  }

  // ---------- config ----------
  const API_BASE = "https://eduguide-tdl3.onrender.com"; // production API base
  const MAX_SKILLS = 50;
  const MAX_INTERESTS = 50;
  const DEBOUNCE_MS = 250;

  // ---------- state ----------
  let state = {
    skills: [], // selected skills
    interests: [], // selected interests
    skillSuggestions: [],
    interestSuggestions: [],
    experience: [],
    certifications: [],
    strengths: [],
    weaknesses: [],
    strengthSuggestions: [],
    weaknessSuggestions: []
  };

  // Track which sections have been saved
  const savedSections = new Set();

  // Global tracking for chip selections
  let selectedLearningFormats = [];
  let selectedWorkEnvironments = [];
  let selectedSalaryOption = "";

  function markSectionSaved(sec) {
    savedSections.add(sec);

    const el = document.querySelector(`.section-item[data-target="${sec}"]`);
    if (el) el.classList.add("saved-section");
  }

  function checkIfAllSectionsSaved() {
    const total = 12;
    if (savedSections.size === total) {
      document.getElementById("finalSaveBtn").disabled = false;
      document.getElementById("editInfoBtn").classList.add("d-none");
    }
  }

  // ---------- DOM shortcuts ----------
  const sectionItems = document.querySelectorAll(".section-item");
  const sectionCards = document.querySelectorAll(".section-card");

  // Basic info fields
  const fullNameEl = document.getElementById("fullName");
  const ageEl = document.getElementById("age");
  const genderEl = document.getElementById("gender");
  const currentEducationEl = document.getElementById("currentEducation");

  // Personality / preferences fields
  const workTypeEl = document.getElementById("workType");
  const workStyleEl = document.getElementById("workStyle");
  const environmentPreferenceEl = document.getElementById("environmentPreference");
  const stressLevelEl = document.getElementById("stressLevel");

  // Education selectors (new IDs)
  const edu12TypeEl = document.getElementById("edu12_type");

  // Common degree options (up to 15)
  const UG_DEGREES = [
    "B.Tech / BE", "B.Sc", "BCA", "B.Com", "BBA",
    "B.Arch", "B.Des", "B.Pharm", "BA", "BFA",
    "Integrated M.Sc", "Integrated M.Tech", "B.Ed", "BVoc", "Other"
  ];

  // populate degree select
  function populateDegreeOptions() {
    if (!ug_degree) return;
    ug_degree.innerHTML = '<option value="">Select degree</option>';
    UG_DEGREES.forEach(d => {
      const o = document.createElement("option");
      o.value = d; o.textContent = d;
      ug_degree.appendChild(o);
    });
  }

  // show/hide 12th vs Diploma based on select
  function handle12TypeToggle() {
    const t = (edu12TypeEl && edu12TypeEl.value) || "12th";
    if (t === "12th") {
      const e12 = document.getElementById("eduClass12");
      const dip = document.getElementById("eduDiploma");
      if (e12) e12.style.display = "";
      if (dip) dip.style.display = "none";
    } else {
      const e12 = document.getElementById("eduClass12");
      const dip = document.getElementById("eduDiploma");
      if (e12) e12.style.display = "none";
      if (dip) dip.style.display = "";
    }
  }

  // show/hide UG block based on Basic Info selection
  function handleUGVisibility() {
    const ce = document.getElementById("currentEducation");
    const val = ce ? ce.value.toLowerCase() : "";
    if (val.includes("undergraduate") || val.includes("ug")) {
      if (ug_block) ug_block.style.display = "";
    } else {
      if (ug_block) ug_block.style.display = "none";
    }
  }

  const edu10_state = document.getElementById("edu10_state");
  const edu10_board = document.getElementById("edu10_board");
  const edu10_score = document.getElementById("edu10_score");

  const edu12_state = document.getElementById("edu12_state");
  const edu12_board = document.getElementById("edu12_board");
  const edu12_stream = document.getElementById("edu12_stream");
  const edu12_score = document.getElementById("edu12_score");

  const diploma_state = document.getElementById("diploma_state");
  const diploma_institute = document.getElementById("diploma_institute");
  const diploma_branch = document.getElementById("diploma_branch");
  const diploma_score = document.getElementById("diploma_score");

  const ug_block = document.getElementById("eduUG");
  const ug_state = document.getElementById("ug_state");
  const ug_institute = document.getElementById("ug_institute");
  const ug_degree = document.getElementById("ug_degree");
  const ug_branch = document.getElementById("ug_branch");
  const ug_cgpa = document.getElementById("ug_cgpa");

  // Legacy blocks (used for show/hide)
  const edu10_block = document.getElementById("eduClass10");
  const edu12_block = document.getElementById("eduClass12");

  // skills/interests DOM containers & inputs
  const selectedSkillsEl = document.getElementById("selectedSkills");
  const skillBoxEl = document.getElementById("skillBox");
  const skillSearchInput = skillBoxEl ? skillBoxEl.querySelector("input") : null;
  const skillSuggestionsEl = document.getElementById("skillSuggestions");

  const selectedInterestsEl = document.getElementById("selectedInterests");
  const interestBoxEl = document.getElementById("interestBox");
  const interestSearchInput = interestBoxEl ? interestBoxEl.querySelector("input") : null;
  const interestSuggestionsEl = document.getElementById("interestSuggestions");

  // Achievements removed from UI

  const saveBtn = document.getElementById("saveInfoBtn");
  
// Strengths
const selectedStrengthsEl = document.getElementById("selectedStrengths");
const strengthBoxEl = document.getElementById("strengthBox");
const strengthSearchInput = document.getElementById("strengthSearch");
const strengthSuggestionsEl = document.getElementById("strengthSuggestions");

// Weaknesses
const selectedWeaknessesEl = document.getElementById("selectedWeaknesses");
const weaknessBoxEl = document.getElementById("weaknessBox");
const weaknessSearchInput = document.getElementById("weaknessSearch");
const weaknessSuggestionsEl = document.getElementById("weaknessSuggestions");

// Learning Preferences
const learningFormatsEl = document.getElementById("learningFormats");
const learningPaceEl = document.getElementById("learningPace");
const learningModeEl = document.getElementById("learningMode");
const learningFormatContainer = document.getElementById("learningFormatContainer");
// Salary expectations container
const salaryExpectationsContainer = document.getElementById("salaryExpectationsContainer");
const workEnvironmentContainer = document.getElementById("workEnvironmentContainer");

const certificationListEl = document.getElementById("certificationList");
const addCertificationBtn = document.getElementById("addCertificationBtn");

const certNameEl = document.getElementById("certName");
const certOrgEl = document.getElementById("certOrg");
const certIssueDateEl = document.getElementById("certIssueDate");
const certExpiryDateEl = document.getElementById("certExpiryDate");
const certIdEl = document.getElementById("certId");
const certFileEl = document.getElementById("certFile");


  // ---------- utilities ----------
  function debounce(fn, ms = DEBOUNCE_MS) {
    let t;
    return (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn.apply(this, args), ms);
    };
  }

  // ---------- render certifications ----------
  function renderCertifications() {
    if (!certificationListEl) return;

    certificationListEl.innerHTML = "";

    (state.certifications || []).forEach((c, index) => {
      const div = document.createElement("div");
      div.className = "cert-card";

      div.innerHTML = `
      <div class="cert-delete" data-index="${index}">
        <i class="bi bi-trash"></i>
      </div>

      <div class="cert-title">${c.name || "Untitled"}</div>
      <div><strong>Organization:</strong> ${c.org || "—"}</div>
      <div><strong>Issue:</strong> ${c.issue_date || "—"}</div>
      <div><strong>Expiry:</strong> ${c.expiry_date || "—"}</div>
      <div><strong>Certificate ID:</strong> ${c.id || "—"}</div>
      ${c.fileName ? `<div><strong>Uploaded:</strong> ${c.fileName}</div>` : ""}
    `;

      certificationListEl.appendChild(div);
    });

    // Attach delete handlers
    certificationListEl.querySelectorAll(".cert-delete").forEach(btn => {
      btn.addEventListener("click", () => {
        const idx = Number(btn.dataset.index);
        if (!Number.isNaN(idx)) {
          state.certifications.splice(idx, 1);
          renderCertifications();
        }
      });
    });
  }

  function createChip(text, onRemove) {
    const chip = document.createElement("span");
    chip.className = "chip";
    chip.textContent = text;

    const x = document.createElement("i");
    x.className = "bi bi-x-lg ms-2";
    x.style.cursor = "pointer";
    x.title = "Remove";

    x.addEventListener("click", (e) => {
      e.stopPropagation();
      onRemove && onRemove(text);
    });

    chip.appendChild(x);
    return chip;
  }

  function renderChips(list, container, onRemove) {
    container.innerHTML = "";
    (list || []).forEach(item => {
      const chip = createChip(item, onRemove);
      container.appendChild(chip);
    });
  }

  function arrayAddUnique(arr, val, max = 999) {
    if (!val) return arr;
    if (arr.includes(val)) return arr;
    if (arr.length >= max) {
      _showToast("Maximum items reached", "warning");
      return arr;
    }
    arr.push(val);
    return arr;
  }

  function arrayRemove(arr, val) {
    return arr.filter(x => x !== val);
  }

  // ---------- sidebar switching ----------
  function activateSection(targetId) {
    // update left menu active class
    sectionItems.forEach(si => {
      if (si.dataset.target === targetId) si.classList.add("active");
      else si.classList.remove("active");
    });

    // show/hide section cards
    sectionCards.forEach(card => {
      if (card.id === targetId) card.classList.add("active");
      else card.classList.remove("active");
    });

    // focus first input for accessibility
    const targetCard = document.getElementById(targetId);
    if (targetCard) {
      const input = targetCard.querySelector("input, select, textarea, button");
      input && input.focus();
    }
  }

  sectionItems.forEach(si => {
    si.addEventListener("click", () => {
      activateSection(si.dataset.target);
    });
  });

  // ---------- education logic ----------
  function handleEducationVisibility() {
    const val = (currentEducationEl && currentEducationEl.value || "").toLowerCase();
    if (val.includes("undergraduate") || val.includes("ug")) {
      // show UG, show 12, show 10
      if (ug_block) ug_block.style.display = "";
      if (edu12_block) edu12_block.style.display = "";
      if (edu10_block) edu10_block.style.display = "";
    } else if (val.includes("class 12") || val.includes("diploma")) {
      // hide UG, show 12 & 10
      if (ug_block) ug_block.style.display = "none";
      if (edu12_block) edu12_block.style.display = "";
      if (edu10_block) edu10_block.style.display = "";
    } else {
      // default: hide UG, show 10 and 12
      if (ug_block) ug_block.style.display = "none";
      if (edu12_block) edu12_block.style.display = "";
      if (edu10_block) edu10_block.style.display = "";
    }
  }

  currentEducationEl && currentEducationEl.addEventListener("change", handleEducationVisibility);

  // ---------- suggestions fetchers ----------
  async function fetchSuggestions(path) {
    try {
      const res = await fetch(`${API_BASE}/${path}`);
      if (!res.ok) throw new Error("no-suggest");
      const data = await res.json();
      if (Array.isArray(data)) return data;
      if (Array.isArray(data.suggestions)) return data.suggestions;
      return [];
    } catch (e) {
      console.error("fetchSuggestions error:", e);
      return [];
    }
  }

  // ---------- skill search & suggestion rendering ----------
  const updateSkillSuggestions = debounce(async (q) => {
    if (!skillSuggestionsEl) return;
    if (!q) {
      renderSkillSuggestions(state.skillSuggestions.slice(0, 10));
      return;
    }
    // local filter first
    const local = (state.skillSuggestions || []).filter(s => s.toLowerCase().includes(q.toLowerCase()));
    if (local.length > 0) {
      renderSkillSuggestions(local.slice(0, 15));
      return;
    }
    // server search
    try {
      const res = await fetch(`${API_BASE}/api/search-skills?q=${encodeURIComponent(q)}`);
      if (!res.ok) throw new Error("server search failed");
      const arr = await res.json();
      renderSkillSuggestions(arr || []);
    } catch (err) {
      console.error("search-skills failed:", err);
      renderSkillSuggestions([]);
    }
  }, 220);

  function renderSkillSuggestions(arr) {
  if (!skillSuggestionsEl) return;
  skillSuggestionsEl.innerHTML = "";
  if (!arr || arr.length === 0) {
    skillSuggestionsEl.innerHTML = `<div class="text-muted small">No matches</div>`;
    return;
  }
  arr.forEach(s => {
    const it = document.createElement("div");
    it.className = "suggestion-item";
    it.textContent = s;
    it.addEventListener("click", () => {
      addSkill(s);
      if (skillSearchInput) skillSearchInput.value = "";
      renderSkillSuggestions([]);   // keep box OPEN like Interests
    });
    skillSuggestionsEl.appendChild(it);
  });
  }

  // ---------- interest search & suggestion ----------
  const updateInterestSuggestions = debounce(async (q) => {
    if (!interestSuggestionsEl) return;
    if (!q) {
      renderInterestSuggestions(state.interestSuggestions.slice(0, 10));
      return;
    }
    const local = (state.interestSuggestions || []).filter(s => s.toLowerCase().includes(q.toLowerCase()));
    if (local.length > 0) {
      renderInterestSuggestions(local.slice(0, 15));
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/api/search-interests?q=${encodeURIComponent(q)}`);
      if (!res.ok) throw new Error("server search failed");
      const arr = await res.json();
      renderInterestSuggestions(arr || []);
    } catch (err) {
      console.error("search-interests failed:", err);
      renderInterestSuggestions([]);
    }
  }, 220);

  function renderInterestSuggestions(arr) {
    if (!interestSuggestionsEl) return;
    interestSuggestionsEl.innerHTML = "";
    if (!arr || arr.length === 0) {
      interestSuggestionsEl.innerHTML = `<div class="text-muted small">No matches</div>`;
      return;
    }
    arr.forEach(s => {
      const it = document.createElement("div");
      it.className = "suggestion-item";
      it.textContent = s;
      it.addEventListener("click", () => {
        addInterest(s);
        if (interestSearchInput) interestSearchInput.value = "";
        renderInterestSuggestions(state.interestSuggestions.slice(0, 10));
      });
      interestSuggestionsEl.appendChild(it);
    });
  }

function renderStrengthSuggestions(arr) {
    strengthSuggestionsEl.innerHTML = "";
    if (!arr.length) {
        strengthSuggestionsEl.innerHTML = `<div class="text-muted small">No matches</div>`;
        return;
    }
    arr.forEach(s => {
        const it = document.createElement("div");
        it.className = "suggestion-item";
        it.textContent = s;
        it.onclick = () => addStrength(s);
        strengthSuggestionsEl.appendChild(it);
    });
}

function renderWeaknessSuggestions(arr) {
    weaknessSuggestionsEl.innerHTML = "";
    if (!arr.length) {
        weaknessSuggestionsEl.innerHTML = `<div class="text-muted small">No matches</div>`;
        return;
    }
    arr.forEach(s => {
        const it = document.createElement("div");
        it.className = "suggestion-item";
        it.textContent = s;
        it.onclick = () => addWeakness(s);
        weaknessSuggestionsEl.appendChild(it);
    });
}


  // ---------- add / remove skill/interest ----------
  function addSkill(skill) {
    const name = String(skill || "").trim();
    if (!name) return;
    state.skills = arrayAddUnique(state.skills, name, MAX_SKILLS);
    renderChips(state.skills, selectedSkillsEl, removeSkill);
  }

  function removeSkill(name) {
    state.skills = arrayRemove(state.skills, name);
    renderChips(state.skills, selectedSkillsEl, removeSkill);
  }

  function addInterest(interest) {
    const name = String(interest || "").trim();
    if (!name) return;
    state.interests = arrayAddUnique(state.interests, name, MAX_INTERESTS);
    renderChips(state.interests, selectedInterestsEl, removeInterest);
  }

  function removeInterest(name) {
    state.interests = arrayRemove(state.interests, name);
    renderChips(state.interests, selectedInterestsEl, removeInterest);
  }

function addStrength(strength) {
    strength = strength.trim();
    if (!strength) return;

    state.strengths = arrayAddUnique(state.strengths, strength, 50);
    renderChips(state.strengths, selectedStrengthsEl, (t) => {
        state.strengths = arrayRemove(state.strengths, t);
        renderChips(state.strengths, selectedStrengthsEl, (x) => {
            state.strengths = arrayRemove(state.strengths, x);
        });
    });
}

function addWeakness(weakness) {
    weakness = weakness.trim();
    if (!weakness) return;

    state.weaknesses = arrayAddUnique(state.weaknesses, weakness, 50);
    renderChips(state.weaknesses, selectedWeaknessesEl, (t) => {
        state.weaknesses = arrayRemove(state.weaknesses, t);
        renderChips(state.weaknesses, selectedWeaknessesEl, (x) => {
            state.weaknesses = arrayRemove(state.weaknesses, x);
        });
    });
}


  // ---------- keyboard support on inputs ----------
if (skillSearchInput) {
  skillSearchInput.addEventListener("input", (e) => {
    updateSkillSuggestions(e.target.value);
  });
  skillSearchInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const v = skillSearchInput.value.trim();
      if (v) addSkill(v);
      skillSearchInput.value = "";
      renderSkillSuggestions([]);   // again: keep it open
    }
  });
}

  if (interestSearchInput) {
    interestSearchInput.addEventListener("input", (e) => {
      updateInterestSuggestions(e.target.value);
    });
    interestSearchInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        const v = interestSearchInput.value.trim();
        if (v) addInterest(v);
        interestSearchInput.value = "";
        renderInterestSuggestions([]);
        try { const c = bootstrap.Collapse.getInstance(interestBoxEl); } catch (e) {}
      }
    });
  }

  // Achievements inputs removed from UI

// Strengths input
if (strengthSearchInput) {
    strengthSearchInput.addEventListener("input", (e) => {
        const q = e.target.value.trim().toLowerCase();
        const local = state.strengthSuggestions?.filter(x => x.toLowerCase().includes(q)) || [];
        renderStrengthSuggestions(local.slice(0, 15));
    });

    strengthSearchInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
            e.preventDefault();
            addStrength(strengthSearchInput.value.trim());
            strengthSearchInput.value = "";
            renderStrengthSuggestions([]);
        }
    });
}

// Weaknesses input
if (weaknessSearchInput) {
    weaknessSearchInput.addEventListener("input", (e) => {
        const q = e.target.value.trim().toLowerCase();
        const local = state.weaknessSuggestions?.filter(x => x.toLowerCase().includes(q)) || [];
        renderWeaknessSuggestions(local.slice(0, 15));
    });

    weaknessSearchInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
            e.preventDefault();
            addWeakness(weaknessSearchInput.value.trim());
            weaknessSearchInput.value = "";
            renderWeaknessSuggestions([]);
        }
    });
}
  // ---------- auth header ----------
  function _authHeader() {
    const token = localStorage.getItem("token");
    const headers = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = "Bearer " + token;
    return headers;
  }

  // ---------- save & load profile ----------
  async function saveProfile() {
    // collect data
    const payload = {
      full_name: fullNameEl ? fullNameEl.value.trim() : "",
      age: ageEl ? (ageEl.value ? Number(ageEl.value) : null) : null,
      gender: genderEl ? genderEl.value : "",
      current_education: currentEducationEl ? currentEducationEl.value : "",
      education: {
        class10: {
          school: edu10_block ? (edu10_block.querySelector('input[type="text"]')?.value || "") : "",
          board: edu10_block ? (edu10_block.querySelectorAll('input')[1]?.value || "") : "",
          score: edu10_block ? (edu10_block.querySelectorAll('input')[2]?.value || "") : ""
        },
        class12: {
          institute: edu12_block ? (edu12_block.querySelector('input')?.value || "") : "",
          stream: edu12_block ? (edu12_block.querySelector('select')?.value || "") : "",
          score: edu12_block ? (edu12_block.querySelectorAll('input')[1]?.value || "") : ""
        },
        ug: {
          course: ug_block ? (ug_block.querySelectorAll('input')[0]?.value || "") : "",
          college: ug_block ? (ug_block.querySelectorAll('input')[1]?.value || "") : "",
          cgpa: ug_block ? (ug_block.querySelectorAll('input')[2]?.value || "") : ""
        }
      },
      skills: state.skills,
      interests: state.interests,
      personality: {
        work_type: workTypeEl?.value || "",
        work_style: workStyleEl?.value || "",
        environment: environmentPreferenceEl?.value || "",
        stress_level: stressLevelEl?.value || ""
      },
      learning_preferences: {
        formats: Array.from(
          learningFormatContainer?.querySelectorAll(".format-chip.selected") || []
        ).map(c => c.dataset.value),
        pace: learningPaceEl?.value || "",
        mode: learningModeEl?.value || ""
      },
      work_environment: Array.from(
        workEnvironmentContainer?.querySelectorAll(".format-chip.selected") || []
      ).map(c => c.dataset.value),
      salary_expectation: (() => {
        const sel = salaryExpectationsContainer?.querySelector(".salary-chip.selected");
        return sel ? sel.dataset.value : "";
      })(),
      strengths: state.strengths,
      weaknesses: state.weaknesses,
      certifications: state.certifications,

      updated_at: new Date().toISOString()
    };

    try {
      const res = await fetch(`${API_BASE}/api/save-fullinfo`, {
        method: "POST",
        headers: _authHeader(),
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        const txt = await res.text();
        _showToast("Save failed: " + (txt || res.statusText), "danger");
        return;
      }
      const data = await res.json();
      _showToast("Profile saved", "success");
      return data;
    } catch (err) {
      console.error(err);
      _showToast("Network or server error during save", "danger");
    }
  }

  // build education payload (re-usable by section save)
  function buildEducationPayload() {
    let obj = {};

    obj.class10 = {
      state: edu10_state?.value || "",
      board: edu10_board?.value || "",
      score: edu10_score?.value || ""
    };

    if (edu12TypeEl && edu12TypeEl.value === "12th") {
      obj.class12 = {
        state: edu12_state?.value || "",
        board: edu12_board?.value || "",
        stream: edu12_stream?.value || "",
        score: edu12_score?.value || ""
      };
    } else {
      obj.diploma = {
        state: diploma_state?.value || "",
        institute: diploma_institute?.value || "",
        branch: diploma_branch?.value || "",
        score: diploma_score?.value || ""
      };
    }

    if (ug_block && ug_block.style.display !== "none") {
      obj.ug = {
        state: ug_state?.value || "",
        institute: ug_institute?.value || "",
        degree: ug_degree?.value || "",
        branch: ug_branch?.value || "",
        cgpa: ug_cgpa?.value || ""
      };
    }

    return obj;
  }

  // Save only a single section. Merges with existing profile to avoid overwriting unrelated fields.
  async function saveSection(section) {
    const token = localStorage.getItem("token");
    if (!token) {
      _showToast("Please login first", "warning");
      return;
    }


    // fetch existing profile to merge
    let existing = {};
    try {
      const r = await fetch(`${API_BASE}/api/get-fullinfo`, { headers: _authHeader() });
      if (r.ok) {
        const res = await r.json();
        existing = res.profile || {};
      }
    } catch (e) {
      console.warn("Could not fetch existing profile, proceeding with empty", e);
    }

    // Deep merge helper
    function deepMerge(target, source) {
      for (const key in source) {
        if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
          if (!target[key]) target[key] = {};
          deepMerge(target[key], source[key]);
        } else {
          target[key] = source[key];
        }
      }
      return target;
    }

    // Build section update
    const sectionUpdates = {};
    const selectedLearningFormats = Array.from(learningFormatContainer?.querySelectorAll('.format-chip.selected')||[]).map(c=>c.dataset.value);
    const selectedWorkEnvironment = Array.from(workEnvironmentContainer?.querySelectorAll('.format-chip.selected')||[]).map(c=>c.dataset.value);
    const selSalary = salaryExpectationsContainer?.querySelector('.salary-chip.selected')?.dataset.value || "";

    switch(section) {
      case "basicInfo":
        sectionUpdates.fullName = fullNameEl?.value?.trim() || existing.fullName || "";
        sectionUpdates.age = ageEl && ageEl.value ? Number(ageEl.value) : existing.age || null;
        sectionUpdates.gender = genderEl?.value || existing.gender || "";
        sectionUpdates.currentEducation = currentEducationEl?.value || existing.currentEducation || "";
        break;
      case "education":
        sectionUpdates.education = buildEducationPayload();
        break;
      case "skills":
        sectionUpdates.skills = state.skills || [];
        break;
      case "interests":
        sectionUpdates.interests = state.interests || [];
        break;
      case "personality":
        sectionUpdates.personality = {
          workType: workTypeEl?.value || "",
          workStyle: workStyleEl?.value || "",
          environmentPreference: environmentPreferenceEl?.value || "",
          stressLevel: stressLevelEl?.value || ""
        };
        break;
      
      case "strengthsWeaknesses":
        sectionUpdates.strengths = state.strengths || [];
        sectionUpdates.weaknesses = state.weaknesses || [];
        break;
      case "learningPreferences":
        sectionUpdates.learningPreferences = {
          formats: selectedLearningFormats,
          pace: learningPaceEl?.value || "",
          mode: learningModeEl?.value || ""
        };
        break;
      case "workenvironment":
        sectionUpdates.workenvironment = {
          environment: selectedWorkEnvironment
        };
        break;
      case "salary":
        sectionUpdates.salary = {
          expected: selSalary
        };
        break;
      case "certifications":
        sectionUpdates.certifications = state.certifications || [];
        break;
      default:
        _showToast("Unsupported section, saving full profile instead", "info");
        return await saveProfile();
    }

    // Deep merge sectionUpdates into existing profile
    const payload = deepMerge({...existing}, sectionUpdates);
    payload.updated_at = new Date().toISOString();

    // Debug: print payload being sent
    console.log('[DEBUG] Sending payload to backend:', JSON.stringify(payload, null, 2));

    // POST merged payload
    try {
      const res = await fetch(`${API_BASE}/api/save-fullinfo`, {
        method: "POST",
        headers: _authHeader(),
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        const txt = await res.text();
        _showToast("Save failed: " + (txt || res.statusText), "danger");
        return;
      }
      _showToast("Saved successfully", "success");
      return await res.json();
    } catch (err) {
      console.error("saveSection err", err);
      _showToast("Network or server error during save", "danger");
    }
  }

  function checkCompletionState(profile) {
    const finalSaveBtn = document.getElementById("finalSaveBtn");
    const editInfoBtn = document.getElementById("editInfoBtn");

    // Map section to nested key path(s)
    const sectionKeyPaths = {
      basicInfo: ["basicInfo.fullName"],
      education: ["education"],
      skills: ["skills"],
      interests: ["interests"],
      personality: ["personality"],
      strengthsWeaknesses: ["strengthsWeaknesses.strengths", "strengthsWeaknesses.weaknesses"],
      learningPreferences: ["learningPreferences.formats"],
      workenvironment: ["workenvironment.environment"],
      salary: ["salary.expected"],
      certifications: ["certifications"]
    };

    function getNested(obj, path) {
      return path.split('.').reduce((o, k) => (o && o[k] !== undefined ? o[k] : undefined), obj);
    }

    savedSections.clear();
    if (profile) {
      for (const sec in sectionKeyPaths) {
        if (sectionKeyPaths[sec].every(path => {
          const val = getNested(profile, path);
          return val !== undefined && val !== null && !(Array.isArray(val) && val.length === 0);
        })) {
          savedSections.add(sec);
        }
      }
    }

    console.log("DEBUG checkCompletionState - savedSections:", Array.from(savedSections));

    // Update sidebar visual state
    document.querySelectorAll(".section-item").forEach(item => {
        const sec = item.dataset.target;
        const isSaved = savedSections.has(sec);
        item.classList.toggle("saved-section", isSaved);
        console.log(`Section ${sec} saved: ${isSaved}`);
    });

    const totalSections = 10;
    const savedCount = savedSections.size;

    console.log(`Completion: ${savedCount}/${totalSections}`);

    if (savedCount === totalSections) {
        finalSaveBtn.disabled = true;
        finalSaveBtn.textContent = "Full Info Saved ✓";
        finalSaveBtn.style.display = 'block';

        editInfoBtn.classList.remove("d-none");
        editInfoBtn.style.display = 'inline-block';

        // Disable form controls
        document.querySelectorAll(".section-card input, .section-card select, .section-card textarea").forEach(el => el.disabled = true);
        document.querySelectorAll(".section-save-btn, .add-box, #addCertificationBtn, .chip i").forEach(el => {
            el.style.pointerEvents = 'none';
            el.style.opacity = '0.7';
        });
        document.querySelectorAll(".add-box, .cert-delete").forEach(el => el.style.display = 'none');
    } else if (savedCount > 0) {
        // Partial saves: disable only saved sections
        disableSavedSectionsInputs();
    } else {
        // Not all saved - make sure buttons are enabled
        finalSaveBtn.disabled = false;
        editInfoBtn.classList.add("d-none");
        document.querySelectorAll(".section-card input, .section-card select, .section-card textarea").forEach(el => el.disabled = false);
        document.querySelectorAll(".section-save-btn, .add-box, #addCertificationBtn, .chip i").forEach(el => {
            el.style.pointerEvents = '';
            el.style.opacity = '';
        });
    }
  }

  // Disable inputs for saved sections (partial saves case)
  function disableSavedSectionsInputs() {
    savedSections.forEach(sectionName => {
      const sectionEl = document.getElementById(sectionName);
      if (!sectionEl) return;

      // Disable all inputs, selects, textareas
      sectionEl.querySelectorAll("input, select, textarea").forEach(el => {
        el.disabled = true;
      });

      // Disable add buttons and delete buttons within the section
      sectionEl.querySelectorAll(".add-box, .section-save-btn, .chip i, .cert-delete, #addCertificationBtn").forEach(el => {
        el.style.pointerEvents = 'none';
        el.style.opacity = '0.5';
      });

      // Disable chip selections and dropdowns
      sectionEl.querySelectorAll(".format-chip, .salary-chip").forEach(chip => {
        chip.style.pointerEvents = 'none';
        chip.style.opacity = '0.6';
      });
    });
  }

  // Allow user to edit saved sections
  document.addEventListener('DOMContentLoaded', () => {
    const editInfoBtn = document.getElementById("editInfoBtn");
    if (editInfoBtn) {
      editInfoBtn.addEventListener("click", () => {
        const finalSaveBtn = document.getElementById("finalSaveBtn");
        
        finalSaveBtn.disabled = false;
        finalSaveBtn.textContent = "Save Full Info";
        editInfoBtn.classList.add("d-none");

        // Re-enable form controls
        document.querySelectorAll(".section-card input, .section-card select, .section-card textarea").forEach(el => el.disabled = false);
        document.querySelectorAll(".section-save-btn, .add-box, #addCertificationBtn, .chip i").forEach(el => {
            el.style.pointerEvents = '';
            el.style.opacity = '';
        });
        document.querySelectorAll(".add-box, .cert-delete").forEach(el => el.style.display = '');

        // Re-enable chip selections for learning, work env, salary
        document.querySelectorAll(".format-chip, .salary-chip").forEach(chip => {
          chip.style.pointerEvents = '';
          chip.style.opacity = '';
        });
      });
    }
  });

  // ===== Collection Functions =====
  function collectBasicInfo() {
    return {
      fullName: fullName.value.trim(),
      age: age.value,
      gender: gender.value,
      currentEducation: currentEducation.value
    };
  }

  function collectEducation() {
    return {
      class10: {
        state: edu10_state.value,
        board: edu10_board.value,
        score: edu10_score.value
      },
      type12: edu12_type.value,
      class12: {
        state: edu12_state.value,
        board: edu12_board.value,
        stream: edu12_stream.value,
        score: edu12_score.value
      },
      diploma: {
        state: diploma_state.value,
        institute: diploma_institute.value,
        branch: diploma_branch.value,
        score: diploma_score.value
      },
      ug: {
        state: ug_state.value,
        institute: ug_institute.value,
        degree: ug_degree.value,
        branch: ug_branch.value,
        cgpa: ug_cgpa.value
      }
    };
  }

  function collectSkills() {
    return {
      skills: state.skills || []
    };
  }

  function collectInterests() {
    return {
      interests: state.interests || []
    };
  }

  function collectPersonality() {
    return {
      workType: workType.value,
      workStyle: workStyle.value,
      environmentPreference: environmentPreference.value,
      stressLevel: stressLevel.value
    };
  }

  function collectSalary() {
    return {
      expected: selectedSalaryOption
    };
  }

  // Achievements collection removed

  function collectStrengthsWeaknesses() {
    return {
      strengths: state.strengths || [],
      weaknesses: state.weaknesses || []
    };
  }

  function collectLearningPreferences() {
    return {
      formats: selectedLearningFormats,
      pace: learningPace.value,
      mode: learningMode.value
    };
  }

  function collectWorkEnvironment() {
    return {
      environment: selectedWorkEnvironments
    };
  }

  function collectCertifications() {
    return {
      certifications: state.certifications || []
    };
  }

  const collectors = {
    basicInfo: collectBasicInfo,
    education: collectEducation,
    skills: collectSkills,
    interests: collectInterests,
    personality: collectPersonality,
    
    strengthsWeaknesses: collectStrengthsWeaknesses,
    learningPreferences: collectLearningPreferences,
    workenvironment: collectWorkEnvironment,
    salary: collectSalary,
    certifications: collectCertifications
  };

  async function saveSection(section, data) {
    console.log("DEBUG: Saving section", section, "with data:", data);

    if (!data || typeof data !== "object") {
      console.error("❌ INVALID DATA SENT:", section, data);
      alert("Save failed: missing data in " + section);
      return;
    }

    const token = localStorage.getItem("token");
    if (!token) return alert("Not logged in");

    const res = await fetch("https://eduguide-tdl3.onrender.com/api/save-section", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + token
      },
      body: JSON.stringify({ section, data })
    });

    const json = await res.json();
    console.log("DEBUG: Response status:", res.status);
    console.log("DEBUG: Response JSON:", json);

    if (!json.success) {
      alert("Save failed: " + (json.message || "unknown error"));
      return;
    }

    // Visually mark section as saved
    const sectionItem = document.querySelector(`[data-target="${section}"]`);
    if (sectionItem) {
      sectionItem.classList.add("saved");
    }

    // If certifications (last section), show final save button
    if (section === "certifications") {
      const finalSaveBtn = document.getElementById("finalSaveBtn");
      if (finalSaveBtn) {
        finalSaveBtn.disabled = false;
        finalSaveBtn.style.display = "inline-block";
      }
      alert("All sections completed! Click 'Save Full Info' to finalize.");
      return;
    }

    // Auto-advance to next section
    const sectionOrder = [
      "basicInfo", "education", "skills", "interests", "personality",
      "strengthsWeaknesses", "learningPreferences",
      "workenvironment", "salary", "certifications"
    ];

    const currentIndex = sectionOrder.indexOf(section);
    if (currentIndex !== -1 && currentIndex < sectionOrder.length - 1) {
      const nextSection = sectionOrder[currentIndex + 1];
      const nextItem = document.querySelector(`[data-target="${nextSection}"]`);
      if (nextItem) {
        nextItem.click();
      }
    }
  }

  async function loadProfile() {
          // Ensure sidebar color for saved sections
          const ensureSidebarSaved = (section) => {
            const el = document.querySelector(`.section-item[data-target="${section}"]`);
            if (el) el.classList.add("saved-section");
          };
    try {
      const res = await fetch(`${API_BASE}/api/get-fullinfo`, { headers: _authHeader() });
      if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
          _showToast("Please login", "warning");
          window.location.href = "index.html";
        }
        return;
      }
      
      const responseData = await res.json();
      if (!responseData || !responseData.profile) {
        checkCompletionState(null); // Check with no profile
        return;
      }
      
      const obj = responseData.profile;
      // Debug: print loaded profile
      console.log('[DEBUG] Loaded profile from backend:', JSON.stringify(obj, null, 2));

      // basicInfo (nested)
      if (obj.basicInfo) {
        document.getElementById("fullName").value = obj.basicInfo.fullName || "";
        document.getElementById("age").value = obj.basicInfo.age || "";
        document.getElementById("gender").value = obj.basicInfo.gender || "";
        document.getElementById("currentEducation").value = obj.basicInfo.currentEducation || "";
        markSectionSaved("basicInfo");
        disableSavedSectionsInputs();
      } else {
        if (fullNameEl && obj.fullName) fullNameEl.value = obj.fullName;
        if (ageEl && obj.age) ageEl.value = obj.age;
        if (genderEl && obj.gender) genderEl.value = obj.gender;
        if (currentEducationEl && obj.currentEducation) currentEducationEl.value = obj.currentEducation;
      }
      handleEducationVisibility();

      if (obj.education) {
        const c10 = obj.education.class10 || {};
        if (edu10_block) {
          const inputs = edu10_block.querySelectorAll("input");
          if (inputs[0]) inputs[0].value = c10.school || "";
          if (inputs[1]) inputs[1].value = c10.board || "";
          if (inputs[2]) inputs[2].value = c10.score || "";
        }
        const c12 = obj.education.class12 || {};
        if (edu12_block) {
          const inputs = edu12_block.querySelectorAll("input");
          const sel = edu12_block.querySelector("select");
          if (inputs[0]) inputs[0].value = c12.institute || "";
          if (sel) sel.value = c12.stream || "";
          if (inputs[1]) inputs[1].value = c12.score || "";
        }
        const ug = obj.education.ug || {};
        if (ug_block) {
          const inputs = ug_block.querySelectorAll("input");
          if (inputs[0]) inputs[0].value = ug.course || "";
          if (inputs[1]) inputs[1].value = ug.college || "";
          if (inputs[2]) inputs[2].value = ug.cgpa || "";
        }
      }

      // SKILLS
      if (obj.skills && Array.isArray(obj.skills.skills)) {
          selectedSkills = [...obj.skills.skills];   // store
      } else {
          selectedSkills = [];
      }
      renderSelectedSkills();   // <--- MUST BE CALLED
        // INTERESTS
        if (obj.interests && Array.isArray(obj.interests.interests)) {
          selectedInterests = [...obj.interests.interests];
        } else {
          selectedInterests = [];
        }
        renderSelectedInterests();  // <--- MUST BE CALLED


      // Handle strengthsWeaknesses (nested)
      if (obj.strengthsWeaknesses) {
        if (Array.isArray(obj.strengthsWeaknesses.strengths)) {
          state.strengths = obj.strengthsWeaknesses.strengths.slice();
        }
        if (Array.isArray(obj.strengthsWeaknesses.weaknesses)) {
          state.weaknesses = obj.strengthsWeaknesses.weaknesses.slice();
        }
        markSectionSaved("strengthsWeaknesses");
        disableSavedSectionsInputs();
      } else {
        state.strengths = Array.isArray(obj.strengths) ? obj.strengths.slice() : [];
        state.weaknesses = Array.isArray(obj.weaknesses) ? obj.weaknesses.slice() : [];
      }

      renderChips(state.strengths, selectedStrengthsEl, (t) => {
          state.strengths = arrayRemove(state.strengths, t);
          renderChips(state.strengths, selectedStrengthsEl);
      });

      renderChips(state.weaknesses, selectedWeaknessesEl, (t) => {
          state.weaknesses = arrayRemove(state.weaknesses, t);
          renderChips(state.weaknesses, selectedWeaknessesEl);
      });

      if (Array.isArray(obj.certifications)) {
        state.certifications = obj.certifications.slice();
        renderCertifications();
      }

      if (obj.personality) {
        if (document.getElementById("workType"))
          document.getElementById("workType").value = obj.personality.workType || "";
        if (document.getElementById("workStyle"))
          document.getElementById("workStyle").value = obj.personality.workStyle || "";
        if (document.getElementById("environmentPreference"))
          document.getElementById("environmentPreference").value = obj.personality.environmentPreference || "";
        if (document.getElementById("stressLevel"))
          document.getElementById("stressLevel").value = obj.personality.stressLevel || "";
      }


      // learningPreferences (nested)
      let lp = {};
      if (obj.learningPreferences) {
        lp = obj.learningPreferences;
        markSectionSaved("learningPreferences");
        disableSavedSectionsInputs();
      } else if (obj.learningPreference) {
        lp = obj.learningPreference;
      }
      if (learningPaceEl) learningPaceEl.value = lp.pace || "";
      if (learningModeEl) learningModeEl.value = lp.mode || "";

      selectedLearningFormats = Array.isArray(lp.formats) ? lp.formats.slice() : [];
      if (learningFormatContainer) {
        learningFormatContainer.querySelectorAll(".format-chip").forEach(chip => {
          const isSelected = selectedLearningFormats.includes(chip.dataset.value);
          chip.classList.toggle("selected", isSelected);
        });
      }


      // workenvironment (nested)
      let envArr = [];
      if (obj.workenvironment && Array.isArray(obj.workenvironment.environment)) {
        envArr = obj.workenvironment.environment;
        markSectionSaved("workenvironment");
        disableSavedSectionsInputs();
      } else if (Array.isArray(obj.environment)) {
        envArr = obj.environment;
      } else if (obj.workenvironment && typeof obj.workenvironment.environment === 'string') {
        envArr = [obj.workenvironment.environment];
      }
      selectedWorkEnvironments = Array.isArray(envArr) ? envArr.slice() : [];
      if (workEnvironmentContainer) {
        workEnvironmentContainer.querySelectorAll(".format-chip").forEach(chip => {
          const isSelected = selectedWorkEnvironments.includes(chip.dataset.value);
          chip.classList.toggle("selected", isSelected);
        });
      }


      // salary (nested)
      if (obj.salary) {
        selectedSalaryOption = obj.salary.expected || "";

        // Highlight correct salary button
        document.querySelectorAll(".salary-chip").forEach(chip => {
            if (chip.dataset.value === selectedSalaryOption) {
                chip.classList.add("selected");
            } else {
                chip.classList.remove("selected");
            }
        });

        markSectionSaved("salary");
        disableSavedSectionsInputs();
      } else {
        selectedSalaryOption = "";
        if (salaryExpectationsContainer) {
          salaryExpectationsContainer.querySelectorAll(".salary-chip").forEach(chip => {
            chip.classList.remove("selected");
          });
        }
      }

      checkCompletionState(obj);
      // Explicitly ensure sidebar highlight for the five key sections after loading
      // ["basicInfo", "strengthsWeaknesses", "learningPreferences", "workenvironment", "salary"].forEach(ensureSidebarSaved);

    } catch (err) {
      console.error("loadProfile err", err);
    }
  }

  // ---------- init: fetch master suggestions + load profile ----------
  async function initSuggestionsAndProfile() {
    // fetch masters (DB-driven)
    state.skillSuggestions = await fetchSuggestions("api/get-skills");
    state.interestSuggestions = await fetchSuggestions("api/get-interests");
    // strengths/weaknesses suggestions (backend endpoints added)
    state.strengthSuggestions = await fetchSuggestions("api/get-strengths");
    state.weaknessSuggestions = await fetchSuggestions("api/get-weaknesses");

    // populate initial suggestions preview (first few)
    renderSkillSuggestions(state.skillSuggestions.slice(0, 8));
    renderInterestSuggestions(state.interestSuggestions.slice(0, 8));
  renderStrengthSuggestions(state.strengthSuggestions.slice(0, 8));
  renderWeaknessSuggestions(state.weaknessSuggestions.slice(0, 8));

    // render current chips area from state (initially empty)
    renderChips(state.skills, selectedSkillsEl, removeSkill);
    renderChips(state.interests, selectedInterestsEl, removeInterest);

    // load user profile (if exists)
    await loadProfile();
  }

  // ---------- attach save handler ----------
  saveBtn && saveBtn.addEventListener("click", async (e) => {
    e.preventDefault();
    if (!fullNameEl.value.trim()) {
      _showToast("Please enter your full name", "warning");
      activateSection("basicInfo");
      return;
    }
    await saveProfile();
  });

  // ---------- protect page: ensure user logged in ----------
  function ensureAuth() {
    const token = localStorage.getItem("token");
    if (!token) {
      _showToast("Please login first", "warning");
      setTimeout(() => window.location.href = "index.html", 800);
      return false;
    }
    return true;
  }

  // ---------- run on DOM ready ----------
  document.addEventListener("DOMContentLoaded", () => {
    if (!ensureAuth()) return;

    // initial visibility (basic info shown by default)
    activateSection("basicInfo");
    handleEducationVisibility();

    // populate degree dropdown and set initial visibility for 12th/diploma and UG
    populateDegreeOptions();
    handle12TypeToggle();
    handleUGVisibility();

    // init suggestions + load profile
    initSuggestionsAndProfile();

    // Learning format chip toggle with tracking
    if (learningFormatContainer) {
      learningFormatContainer.querySelectorAll(".format-chip").forEach(chip => {
        chip.addEventListener("click", () => {
          const value = chip.dataset.value;

          chip.classList.toggle("selected");

          if (chip.classList.contains("selected")) {
            if (!selectedLearningFormats.includes(value)) {
              selectedLearningFormats.push(value);
            }
          } else {
            selectedLearningFormats = selectedLearningFormats.filter(v => v !== value);
          }

          console.log("Learning formats =>", selectedLearningFormats);
        });
      });
    }

    // Work Environment chip toggle with tracking
    if (workEnvironmentContainer) {
      workEnvironmentContainer.querySelectorAll(".format-chip").forEach(chip => {
        chip.addEventListener("click", () => {
          const value = chip.dataset.value;

          chip.classList.toggle("selected");

          if (chip.classList.contains("selected")) {
            if (!selectedWorkEnvironments.includes(value)) {
              selectedWorkEnvironments.push(value);
            }
          } else {
            selectedWorkEnvironments = selectedWorkEnvironments.filter(v => v !== value);
          }

          console.log("Work env =>", selectedWorkEnvironments);
        });
      });
    }

    // Salary chip toggle with tracking
    document.querySelectorAll('.salary-chip').forEach(chip => {
      chip.addEventListener("click", () => {
        // remove active from all
        document.querySelectorAll('.salary-chip').forEach(c => c.classList.remove("selected"));

        // activate this one
        chip.classList.add("selected");

        selectedSalaryOption = chip.dataset.value;

        console.log("Salary =>", selectedSalaryOption);
      });
    });

    // attach education related handlers
    if (edu12TypeEl) edu12TypeEl.addEventListener("change", handle12TypeToggle);
    if (currentEducationEl) currentEducationEl.addEventListener("change", handleUGVisibility);

    // section-level save buttons (save only that section)
    document.querySelectorAll(".section-save-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        const section = btn.dataset.section;
        const data = collectors[section]();
        saveSection(section, data);
      });
    });

    // Basic Info save handler
    document.querySelector('[data-section="basicInfo"]').addEventListener("click", () => {
      saveSection("basicInfo", {
        fullName: fullNameEl.value,
        age: ageEl.value,
        gender: genderEl.value,
        currentEducation: currentEducationEl.value
      });
    });

    // Education save handler
    document.querySelector('[data-section="education"]').addEventListener("click", () => {
      const edu = {
        class10: {
          state: edu10_state.value,
          board: edu10_board.value,
          score: edu10_score.value
        },
        type12: edu12_type.value,
        class12: {
          state: edu12_state.value,
          board: edu12_board.value,
          stream: edu12_stream.value,
          score: edu12_score.value
        },
        diploma: {
          state: diploma_state.value,
          institute: diploma_institute.value,
          branch: diploma_branch.value,
          score: diploma_score.value
        },
        ug: {
          state: ug_state.value,
          institute: ug_institute.value,
          degree: ug_degree.value,
          branch: ug_branch.value,
          cgpa: ug_cgpa.value
        }
      };

      saveSection("education", edu);
    });

    // Skills save handler
    document.querySelector('[data-section="skills"]').addEventListener("click", () => {
      saveSection("skills", collectSkills());
    });

    // Interests save handler
    document.querySelector('[data-section="interests"]').addEventListener("click", () => {
      saveSection("interests", collectInterests());
    });

    // Personality save handler
    document.querySelector('[data-section="personality"]').addEventListener("click", () => {
      saveSection("personality", collectPersonality());
    });

    // Salary save handler
    document.querySelector('[data-section="salary"]').addEventListener("click", () => {
      saveSection("salary", collectSalary());
    });

    // Achievements save handler removed (section deprecated)

    // Strengths & Weaknesses save handler
    document.querySelector('[data-section="strengthsWeaknesses"]').addEventListener("click", () => {
      saveSection("strengthsWeaknesses", collectStrengthsWeaknesses());
    });

    // Learning Preferences save handler
    document.querySelector('[data-section="learningPreferences"]').addEventListener("click", () => {
      saveSection("learningPreferences", {
        formats: selectedLearningFormats,
        pace: learningPace.value,
        mode: learningMode.value
      });
    });

    // Work Environment save handler
    document.querySelector('[data-section="workenvironment"]').addEventListener("click", () => {
      saveSection("workenvironment", collectWorkEnvironment());
    });

    // Certifications save handler
    document.querySelector('[data-section="certifications"]').addEventListener("click", () => {
      saveSection("certifications", collectCertifications());
    });

    // Final Save button handler
    document.getElementById("finalSaveBtn").addEventListener("click", async () => {
      alert("Full profile saved successfully!");
    });

    // Salary Expectations (single select)
    if (salaryExpectationsContainer) {
      salaryExpectationsContainer.querySelectorAll(".salary-chip").forEach(chip => {
        chip.addEventListener("click", () => {
          // unselect all
          salaryExpectationsContainer.querySelectorAll(".salary-chip").forEach(c => c.classList.remove("selected"));
          // select clicked
          chip.classList.add("selected");
        });
      });
    }

    // Add Certification handler
    if (addCertificationBtn) {
      addCertificationBtn.addEventListener("click", (e) => {
        e.preventDefault();
        const name = certNameEl?.value?.trim();
        const org = certOrgEl?.value?.trim();
        const issue = certIssueDateEl?.value;
        const expiry = certExpiryDateEl?.value;
        const id = certIdEl?.value?.trim();
        const file = certFileEl && certFileEl.files && certFileEl.files[0];

        if (!name || !org || !issue) {
          _showToast("Please fill required fields", "warning");
          return;
        }

        let fileName = "";
        if (file) fileName = file.name;

        state.certifications = state.certifications || [];
        state.certifications.push({
          name,
          org,
          issue_date: issue,
          expiry_date: expiry,
          id,
          fileName
        });

        renderCertifications();

        // Clear input fields
        if (certNameEl) certNameEl.value = "";
        if (certOrgEl) certOrgEl.value = "";
        if (certIssueDateEl) certIssueDateEl.value = "";
        if (certExpiryDateEl) certExpiryDateEl.value = "";
        if (certIdEl) certIdEl.value = "";
        if (certFileEl) certFileEl.value = "";

        _showToast("Certification added", "success");
      });
    }

    // clicking outside suggestion area doesn't break anything
    document.addEventListener("click", (ev) => {
      // no-op for now; left for UX enhancements
    });
  });

  // expose for debugging
  window._fullInfoState = state;

})();