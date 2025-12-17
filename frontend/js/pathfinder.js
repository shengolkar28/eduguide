// pathfinder.js

const API_BASE = "https://eduguide-tdl3.onrender.com"; // production API base
let userProfile = null;

// Convert a string to Title Case (each word capitalized)
function toTitle(str) {
  if (!str) return "";
  return str
    .toLowerCase()
    .split(/[^A-Za-z0-9]+/)  // supports "data_science", "data-science", "data science"
    .filter(Boolean)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

// ---------------------------
// Load full profile once
// ---------------------------
async function loadUserProfile() {
  const token = localStorage.getItem("token");
  if (!token) {
    console.error("No token found");
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/api/get-fullinfo`, {
      method: "GET",
      headers: {
        "Authorization": "Bearer " + token
      }
    });

    const data = await res.json();

    if (!res.ok) {
      console.error("Failed to load profile", data);
      return;
    }

    // backend returns { profile: {...}, success: true }
    userProfile = data.profile;
    console.log("Loaded user profile for roadmap:", userProfile);
  } catch (err) {
    console.error("Error loading profile:", err);
  }
}

// ---------------------------
// Run recommender + render cards
// ---------------------------
async function runRecommendations() {
  const loadingBox = document.getElementById("loadingState");
  const resultsSection = document.getElementById("resultsSection");
  const resultsContainer = document.getElementById("careerResults");

  const token = localStorage.getItem("token");

  if (!token) {
    if (loadingBox) {
      loadingBox.innerHTML = `<h5 class="text-danger fw-bold">Please login first.</h5>`;
    }
    if (typeof showToast === "function") {
      showToast("Please login first", "danger");
    }
    return;
  }

  // Show loader
  if (loadingBox) {
    loadingBox.classList.remove("d-none");
    loadingBox.innerHTML = `
      <div class="col-md-12 text-center py-4">
        <div class="spinner-border text-primary" style="width:40px;height:40px"></div>
        <p class="mt-3 fw-semibold">Running career predictor...</p>
      </div>
    `;
  }
  if (resultsContainer) resultsContainer.innerHTML = "";
  if (resultsSection) resultsSection.classList.add("d-none");

  try {
    // 1. Fetch full profile (also refresh global userProfile)
    const profileRes = await fetch(`${API_BASE}/api/get-fullinfo`, {
      headers: {
        "Authorization": "Bearer " + token
      }
    });

    const profileJson = await profileRes.json();
    console.log("Fetched profile from /api/get-fullinfo:", profileJson);

    if (!profileJson.success || !profileJson.profile || Object.keys(profileJson.profile).length === 0) {
      if (loadingBox) {
        loadingBox.innerHTML = `
          <h5 class="text-danger fw-bold">Complete your full info first.</h5>
          <a href="fullinfo.html" class="btn btn-primary mt-3">Complete Now</a>
        `;
      }
      return;
    }

    // update global profile used by roadmap
    userProfile = profileJson.profile;

    // 2. Call recommendation API
    const recoRes = await fetch(`${API_BASE}/api/recommend`, {
      method: "POST",
      headers: {
        "Authorization": "Bearer " + token,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ profile: userProfile }) // backend expects { profile: {...} }
    });

    const reco = await recoRes.json();
    console.log("Reco response:", reco);

    if (!reco.success || !Array.isArray(reco.results) || reco.results.length === 0) {
      if (loadingBox) {
        loadingBox.innerHTML = `<h5 class="text-danger fw-bold">Unable to generate recommendations.</h5>`;
      }
      return;
    }

    const top3 = reco.results.slice(0, 3);

    // 3. Hide loader, show results
    if (loadingBox) loadingBox.classList.add("d-none");
    if (resultsSection) resultsSection.classList.remove("d-none");

    if (resultsContainer) {
      resultsContainer.innerHTML = "";
      top3.forEach((item, idx) => {
        const scorePct = Math.max(0, Math.min(100, Math.round(item.score * 100)));

        resultsContainer.innerHTML += `
          <div class="col-md-4">
            <div class="modern-card">
              <div class="modern-card-inner">
                <div class="d-flex align-items-center justify-content-between mb-3">
                  <div>
                    <div class="match-rank">#${idx + 1}</div>
                    <div class="career-title">${item.career}</div>
                  </div>
                  <div class="match-chip">Top match</div>
                </div>

                <div class="confidence-meter">
                  <div class="confidence-bar-bg">
                    <div class="confidence-bar-fill" style="width: ${scorePct}%;"></div>
                  </div>
                  <div class="confidence-label">Match strength</div>
                </div>

                <button class="roadmap-btn btn-roadmap mt-3" data-career="${item.career}">
                  Personalized Roadmap
                </button>
              </div>
            </div>
          </div>
        `;
      });
    }

  } catch (err) {
    console.error("Error in runRecommendations:", err);
    if (loadingBox) {
      loadingBox.innerHTML = `<h5 class="text-danger fw-bold">Something went wrong. Check console.</h5>`;
    }
  }
}

// ---------------------------
// Roadmap click handler
// ---------------------------
document.addEventListener("click", async (e) => {
  if (e.target.classList.contains("roadmap-btn")) {
    const career = e.target.getAttribute("data-career");

    // highlight selected card
    const allCards = document.querySelectorAll(".modern-card");
    allCards.forEach(card => card.classList.remove("active-roadmap-card"));

    const clickedCard = e.target.closest(".modern-card");
    if (clickedCard) {
      clickedCard.classList.add("active-roadmap-card");
    }

    await handleRoadmapClick(career);
  }
});

async function handleRoadmapClick(career) {
  if (!userProfile) {
    console.error("User profile not loaded yet");
    alert("Profile not loaded yet. Please refresh the page.");
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/api/roadmap`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
        // No Authorization needed for this route currently
      },
      body: JSON.stringify({
        career: career,
        profile: userProfile
      })
    });

    const data = await res.json();

    if (!res.ok) {
      console.error("Roadmap error:", data);
      alert(data.error || "Failed to load roadmap");
      return;
    }

    console.log("Roadmap for", career, data);
    renderRoadmap(data); // <--- NEW
  } catch (err) {
    console.error("Roadmap request failed:", err);
    alert("Something went wrong while loading roadmap.");
  }
}

function renderRoadmap(roadmap) {
  const section = document.getElementById("roadmapSection");
  const container = document.getElementById("roadmapContent");

  if (!section || !container) {
    console.error("Roadmap section elements not found");
    return;
  }

  section.classList.remove("d-none");

  const gaps = roadmap.skill_gaps || { core_missing: [], nice_to_have_missing: [] };

  const coreText =
    gaps.core_missing && gaps.core_missing.length
      ? gaps.core_missing.map(toTitle).join(", ")
      : "You already cover most core skills.";

  const niceText =
    gaps.nice_to_have_missing && gaps.nice_to_have_missing.length
      ? gaps.nice_to_have_missing.map(toTitle).join(", ")
      : "You are already strong on nice-to-have skills.";

  const phases = roadmap.phases || [];

  let html = `
    <div class="roadmap-wrapper">
      <div class="roadmap-header-card">
        <div class="roadmap-header-main">
          <div>
            <div class="roadmap-pill">Personalised roadmap</div>
            <h4 class="roadmap-title">${roadmap.career}</h4>
            ${
              roadmap.short_description
                ? `<p class="roadmap-subtitle">${roadmap.short_description}</p>`
                : ""
            }
          </div>
        </div>

        <div class="roadmap-header-meta">
          <div class="roadmap-meta-block">
            <div class="roadmap-meta-icon"><i class="bi bi-tools"></i></div>
            <div>
              <div class="roadmap-meta-label">Core</div>
              <div class="roadmap-meta-value">${coreText}</div>
            </div>
          </div>
          <div class="roadmap-meta-block">
            <div class="roadmap-meta-icon"><i class="bi bi-stars"></i></div>
            <div>
              <div class="roadmap-meta-label">Good-to-have</div>
              <div class="roadmap-meta-value">${niceText}</div>
            </div>
          </div>
        </div>
      </div>

      <div class="roadmap-timeline">
  `;

  phases.forEach((phase, idx) => {
    const duration =
      phase.personalized_duration_months ||
      phase.recommended_duration_months ||
      "?";

    const tasksHtml = (phase.tasks || [])
      .map((task) => {
        const priority = task.priority || "medium";
        const status = task.status || "";
        const level = task.level || "";
        const hint = task.preferred_format_hint || "";

        let priorityLabel = "Medium focus";
        if (priority === "high") priorityLabel = "High priority";
        if (priority === "low") priorityLabel = "Already strong";

        return `
          <li class="roadmap-task">
            <div class="roadmap-task-main">
              <div class="roadmap-task-title-row">
                <span class="roadmap-task-title">${task.title}</span>
                ${
                  level
                    ? `<span class="roadmap-task-level">${level}</span>`
                    : ""
                }
              </div>
              ${
                task.description
                  ? `<p class="roadmap-task-desc">${task.description}</p>`
                  : ""
              }
              ${
                hint
                  ? `<p class="roadmap-task-hint">${hint}</p>`
                  : ""
              }
            </div>
            <div class="roadmap-task-tags">
              <span class="roadmap-tag roadmap-tag-${priority}">${priorityLabel}</span>
              ${
                status
                  ? `<span class="roadmap-tag muted-tag">${status}</span>`
                  : ""
              }
            </div>
          </li>
        `;
      })
      .join("");

    html += `
      <div class="roadmap-phase">
        <div class="roadmap-phase-marker">
          <div class="roadmap-phase-dot"></div>
          ${
            idx < phases.length - 1
              ? `<div class="roadmap-phase-line"></div>`
              : ""
          }
        </div>
        <div class="roadmap-phase-card">
          <div class="roadmap-phase-header">
            <div>
              <div class="roadmap-phase-label">Phase ${idx + 1}</div>
              <h5 class="roadmap-phase-title">${phase.title}</h5>
            </div>
            <div class="roadmap-phase-duration">
              ~ ${duration} months
            </div>
          </div>
          <ul class="roadmap-task-list">
            ${tasksHtml}
          </ul>
        </div>
      </div>
    `;
  });

  html += `
      </div>
  `;

  const courses = roadmap.recommended_courses || [];

  if (courses.length) {
    html += `
      <div class="roadmap-courses">
        <h6 class="roadmap-courses-title">Suggested Courses</h6>
        <div class="roadmap-courses-grid">
          ${courses
            .map(
              c => `
              <a href="${c.url}" target="_blank" rel="noopener noreferrer" class="roadmap-course-card">
                <div class="course-provider">${c.provider} · ${c.platform}</div>
                <div class="course-title">${c.title}</div>
                <div class="course-meta">
                  <span class="course-level">${c.level}</span>
                  <span class="course-focus">${c.focus}</span>
                </div>
              </a>
            `
            )
            .join("")}
        </div>
      </div>
    `;
  }

  html += `
    </div>
  `;

  container.innerHTML = html;

  // Smooth scroll to roadmap section
  section.scrollIntoView({ behavior: "smooth", block: "start" });
}

// ---------------------------
// INIT: on page load + button
// ---------------------------
document.addEventListener("DOMContentLoaded", () => {
  const runBtn = document.getElementById("runModelBtn");

  // Load user profile on page load
  loadUserProfile();

  // Run automatically once on load
  runRecommendations();

  // Also allow manual re-run
  if (runBtn) {
    runBtn.addEventListener("click", (e) => {
      e.preventDefault();
      runRecommendations();
    });
  }
});
