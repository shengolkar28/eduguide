//-------------------------------------------
// GLOBAL TOAST NOTIFICATION FUNCTION
function showToast(message, type = "info") {
    const toastContainer = document.getElementById("toastContainer");

    const toast = document.createElement("div");
    toast.className = `toast align-items-center text-bg-${type} border-0`;
    toast.role = "alert";
    toast.innerHTML = `
        <div class="d-flex">
            <div class="toast-body fw-semibold">
                ${message}
            </div>
            <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>
        </div>
    `;

    toastContainer.appendChild(toast);

    const bsToast = new bootstrap.Toast(toast, { delay: 2500 });
    bsToast.show();

    bsToast._element.addEventListener("hidden.bs.toast", () => toast.remove());
}

// GLOBAL GOOGLE SIGN-IN CALLBACK
//-------------------------------------------
function handleGoogleCallback(response) {
    const credential = response.credential;

    fetch("https://eduguide-tdl3.onrender.com/api/google-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ credential })
    })
    .then(res => res.json())
    .then(data => {
        if (data.success) {
            localStorage.setItem("token", data.token);
            localStorage.setItem("user", JSON.stringify(data.user));

            updateNavbarUI();
            bootstrap.Modal.getInstance(document.getElementById("authModal"))?.hide();
        } else {
            showToast("Google login failed", "danger");
        }
    })
    .catch(err => console.error("Google Login ERROR:", err));
}



//-------------------------------------------
// GLOBAL NAVBAR UPDATER
//-------------------------------------------
function updateNavbarUI() {
    const token = localStorage.getItem("token");
    const user = JSON.parse(localStorage.getItem("user") || "{}");

    // DEBUG: show stored token/user so we can debug persistence across pages
    console.debug("updateNavbarUI called — token:", token, "user:", user);

    const loginBtn = document.getElementById("loginBtn");
    const signupBtn = document.getElementById("signupBtn");
    const profileDropdown = document.getElementById("profileDropdown");
    const dropdownName = document.getElementById("dropdownName");
    const dropdownEmail = document.getElementById("dropdownEmail");
    const profileIcon = document.getElementById("profileIcon");
    const profileInitial = document.getElementById("profileInitial");

    if (token && user.email) {
        // Hide login/signup
        loginBtn.classList.add("d-none");
        signupBtn.classList.add("d-none");

        // Update dropdown
        dropdownName.textContent = user.name || user.fullname || "User";
        dropdownEmail.textContent = user.email;

        // Show profile icon
        profileDropdown.classList.remove("d-none");

        // Show avatar if available, otherwise show initial
        if (profileIcon && user.picture) {
            profileIcon.src = user.picture;
            profileIcon.classList.remove("d-none");
        } else if (profileIcon) {
            profileIcon.classList.add("d-none");
        }

        if (profileInitial) {
            if (!user.picture) {
                const nameSource = (user.name || user.fullname || user.email || "").trim();
                const initial = nameSource ? nameSource.split(" ")[0].charAt(0).toUpperCase() : "";
                profileInitial.textContent = initial;
                profileInitial.classList.remove("d-none");
            } else {
                profileInitial.classList.add("d-none");
            }
        }
    } else {
        // Show login/signup
        loginBtn.classList.remove("d-none");
        signupBtn.classList.remove("d-none");

        // Hide profile icon
        profileDropdown.classList.add("d-none");
        if (profileInitial) profileInitial.classList.add("d-none");
    }
}



//-------------------------------------------
// DOM READY
//-------------------------------------------
document.addEventListener("DOMContentLoaded", () => {

    const loginBtn = document.getElementById("loginBtn");
    const signupBtn = document.getElementById("signupBtn");
    const authModalEl = document.getElementById("authModal");
    const authModal = new bootstrap.Modal(authModalEl);

    const fullnameInput = document.getElementById("fullname");
    const emailInput = document.getElementById("email");
    const passwordInput = document.getElementById("password");
    const authTitle = document.getElementById("authTitle");
    const authSubmit = document.getElementById("authSubmit");
    const authSwitch = document.getElementById("authSwitch");
    const authSwitchText = document.getElementById("authSwitchText");
    const authForm = document.getElementById("authForm");
    const logoutBtn = document.getElementById("logoutBtn");

    let mode = "login"; // login or signup

    // HIGHLIGHT ACTIVE NAV LINK
function highlightActivePage() {
    const path = window.location.pathname.toLowerCase();

    const home = document.getElementById("home-link");
    const assess = document.getElementById("assessment-link");
    // Reset styles and aria-current (if present)
    [home, assess].forEach(el => {
        if (!el) return;
        el.classList.remove("fw-bold", "text-primary");
        el.removeAttribute("aria-current");
    });

    // CASE 1: Home page (index.html OR opened directly without filename)
    if (
        path.endsWith("index.html") ||
        path.endsWith("/") ||
        path.endsWith("career project/") ||   // Windows folder path case
        path.endsWith("career%20project/") || // Space encoded case
        path === ""                            // Rare browser case
    ) {
        if (home) {
            home.classList.add("fw-bold", "text-primary");
            home.setAttribute("aria-current", "page");
        }
    }

    // CASE 2: Assessment page
    else if (
        path.endsWith("assessment.html") ||
        // Fallbacks: some environments may include full file paths or queries
        window.location.href.toLowerCase().includes("assessment") ||
        document.title.toLowerCase().includes("assessment")
    ) {
        if (assess) {
            assess.classList.add("fw-bold", "text-primary");
            assess.setAttribute("aria-current", "page");
        }
    }
}

highlightActivePage();


    //-------------------------------------------
    // SWITCH LOGIN <-> SIGNUP IN MODAL
    //-------------------------------------------
    function setMode(newMode) {
        mode = newMode;

        if (mode === "login") {
            fullnameInput.style.display = "none";
            authTitle.textContent = "Login";
            authSubmit.textContent = "Login";
            authSwitchText.textContent = "New user?";
            authSwitch.textContent = "Create account";
        } else {
            fullnameInput.style.display = "block";
            authTitle.textContent = "Sign Up";
            authSubmit.textContent = "Sign Up";
            authSwitchText.textContent = "Already registered?";
            authSwitch.textContent = "Login";
        }
    }

    setMode("login"); // default

    // Intercept clicks on Path Finder nav link and Ask Path Finder button.
    // If user is not logged in (no token in localStorage), show the auth modal
    // instead of navigating.
    const askPathBtn = document.getElementById("askPathBtn");
    const assessNavLink = document.getElementById("assessment-link");

    function requireLoginHandler(e) {
        // Only intercept normal left-clicks without modifier keys
        if (e.button && e.button !== 0) return; // ignore non-left clicks
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return; // allow modified clicks

        const token = localStorage.getItem("token");
        if (!token) {
            e.preventDefault();
            setMode("login");
            authModal.show();
        }
        // If token exists, allow navigation to proceed normally
    }

    if (askPathBtn) askPathBtn.addEventListener("click", requireLoginHandler);
    if (assessNavLink) assessNavLink.addEventListener("click", requireLoginHandler);



    //-------------------------------------------
    // BUTTON EVENTS TO OPEN MODAL
    //-------------------------------------------
    loginBtn.addEventListener("click", () => {
        setMode("login");
        authModal.show();
    });

    signupBtn.addEventListener("click", () => {
        setMode("signup");
        authModal.show();
    });



    //-------------------------------------------
    // INSIDE MODAL SWITCH LINK
    //-------------------------------------------
    authSwitch.addEventListener("click", (e) => {
        e.preventDefault();
        setMode(mode === "login" ? "signup" : "login");
    });



    //-------------------------------------------
    // EMAIL SIGNUP / LOGIN FORM SUBMIT
    //-------------------------------------------
    authForm.addEventListener("submit", (e) => {
        e.preventDefault();

        const fullname = fullnameInput.value.trim();
        const email = emailInput.value.trim();
        const password = passwordInput.value.trim();

        if (!email || !password || (mode === "signup" && !fullname)) {
            showToast("Please fill all fields", "warning");
            return;
        }

        if (mode === "signup") {
            //---------------------------------------
            // EMAIL SIGNUP
            //---------------------------------------
            fetch("https://eduguide-tdl3.onrender.com/api/register", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ fullname, email, password })
            })
            .then(res => res.json())
            .then(data => {
                if (data.success) {
                    localStorage.setItem("token", data.token);
                    localStorage.setItem("user", JSON.stringify(data.user));
                    updateNavbarUI();
                    authModal.hide();
                } else {
                    showToast(data.message || "Signup failed", "danger");
                }
            });

        } else {
            //---------------------------------------
            // EMAIL LOGIN
            //---------------------------------------
            fetch("https://eduguide-tdl3.onrender.com/api/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, password })
            })
            .then(res => res.json())
            .then(data => {
                if (data.success) {
                    localStorage.setItem("token", data.token);
                    localStorage.setItem("user", JSON.stringify(data.user));
                    updateNavbarUI();
                    authModal.hide();
                } else {
                    showToast(data.message || "Login failed", "danger");
                }
            });
        }
    });



    //-------------------------------------------
    // LOGOUT
    //-------------------------------------------
    logoutBtn.addEventListener("click", () => {
        localStorage.removeItem("token");
        localStorage.removeItem("user");

        updateNavbarUI();
       showToast("Logged out", "info");
    });



    //-------------------------------------------
    // ON PAGE LOAD - UPDATE NAVBAR
    //-------------------------------------------
    updateNavbarUI();



    //-------------------------------------------
    // HANDLE 'HOW IT WORKS' BUTTON
    //-------------------------------------------
    const howItWorksBtn = document.querySelector("button.btn-outline-secondary");
    howItWorksBtn.addEventListener("click", () => {
        const token = localStorage.getItem("token");
        if (token) {
            window.location.href = "fullinfo.html";
        } else {
            const authModal = new bootstrap.Modal(document.getElementById("authModal"));
            authModal.show();
        }
    });



    //-------------------------------------------
    // HANDLE 'FULL PROFILE' LINK IN DROPDOWN
    //-------------------------------------------
    const fullProfileLink = document.querySelector("a[href='fullinfo.html']");
    fullProfileLink.addEventListener("click", (event) => {
        const token = localStorage.getItem("token");
        if (token) {
            window.location.href = "fullinfo.html";
        } else {
            const authModal = new bootstrap.Modal(document.getElementById("authModal"));
            authModal.show();
        }
    });
});


// Some browsers restore pages from back/forward cache (bfcache) and don't
// fire DOMContentLoaded again. Re-run the navbar updater on pageshow and
// when the document becomes visible to ensure login state is reflected.
window.addEventListener("pageshow", (e) => {
    console.debug("pageshow event — re-checking navbar state", e.persisted);
    updateNavbarUI();
});

document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
        console.debug("visibilitychange -> visible — updating navbar");
        updateNavbarUI();
    }
});
