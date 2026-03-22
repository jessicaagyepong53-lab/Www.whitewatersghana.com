const API = "https://white-water-wells.onrender.com";
const APPROVED_STAFF_LOGINS = [
  "gardiner9wwwl@whitewaterghana",
  "gardiner8wwwl@whitewaterghana",
  "supervisorb@whitewaterghana.com"
];

function fallbackNameFromEmail(email) {
  if (!email) return "";
  const localPart = String(email).split("@")[0] || "";
  return localPart
    .replace(/[._-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function resolveDisplayName(...values) {
  for (const value of values) {
    const normalized = String(value || "").trim();
    if (normalized) return normalized;
  }
  return "";
}

function showMessage(elementId, message, type) {
  const el = document.getElementById(elementId);
  if (!el) return;
  el.textContent = message;
  el.style.display = "block";
  el.style.background = type === "success" ? "#e6f4ea" : "#fde8e8";
  el.style.color = type === "success" ? "green" : "red";
  el.style.border = type === "success" ? "1px solid green" : "1px solid red";
  el.style.padding = "10px";
  el.style.borderRadius = "8px";
  el.style.marginBottom = "10px";
}

function updateAccountDropdown(username) {
  const dropdownBtn = document.querySelector(".dropdown-btn");
  const email = localStorage.getItem("email");
  const displayName = resolveDisplayName(
    username,
    localStorage.getItem("username"),
    fallbackNameFromEmail(email),
    email
  );
  if (!dropdownBtn || !displayName) return;

  dropdownBtn.innerHTML = `<i class="fa-regular fa-circle-user"></i> ${displayName} <i class="fa-solid fa-chevron-down dropdown-arrow"></i>`;
}

function persistUserSession(email, token, username) {
  const displayName = resolveDisplayName(
    username,
    localStorage.getItem("username"),
    fallbackNameFromEmail(email),
    email
  );
  localStorage.setItem("email", email);
  localStorage.setItem("token", token);
  localStorage.setItem("username", displayName);
  updateAccountDropdown(displayName);
}

async function createAuthenticatedSession(email, password, fallbackUsername) {
  const loginResponse = await fetch(`${API}/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password })
  });

  const loginResult = await loginResponse.json();
  if (!loginResponse.ok || !loginResult.token) {
    throw new Error(loginResult.message || "Could not establish a login session.");
  }

  persistUserSession(
    email,
    loginResult.token,
    resolveDisplayName(loginResult.user?.fullName, fallbackUsername, localStorage.getItem("username"), fallbackNameFromEmail(email), email)
  );
}

// ============================================
// AUTH STATE - runs after DOM is fully loaded
// ============================================
function initAuthState() {
  const token = localStorage.getItem("token");
  const username = resolveDisplayName(
    localStorage.getItem("username"),
    fallbackNameFromEmail(localStorage.getItem("email")),
    localStorage.getItem("email")
  );
  const logoutBtn = document.getElementById("logout-btn");
  const inPagesFolder = window.location.pathname.includes("/pages/");
  const onSignupPage = window.location.pathname.endsWith("/index.html") || window.location.pathname.endsWith("/") || window.location.pathname === "/";

  if (token && logoutBtn) {
    document.querySelectorAll('.dropdown-menu a').forEach(link => {
      const href = link.getAttribute("href") || "";
      if (href.includes("login.html") || href.includes("index.html")) {
        link.style.display = "none";
      }
    });
    logoutBtn.style.display = "flex";
    updateAccountDropdown(username);

    if (onSignupPage) {
      window.location.href = "pages/order.html";
      return;
    }
  }

  if (logoutBtn) {
    logoutBtn.addEventListener("click", (e) => {
      e.preventDefault();
      localStorage.removeItem("token");
      localStorage.removeItem("username");
      localStorage.removeItem("email");
      window.location.href = inPagesFolder ? "login.html" : "pages/login.html";
    });
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initAuthState);
} else {
  initAuthState();
}

// ============================================
// BULK PURCHASE AUTOMATION
// ============================================
const productSelect = document.getElementById('product');
if (productSelect) {
  productSelect.addEventListener('change', function () {
    if (this.value === 'bulk-purchase') {
      document.getElementById('quantity').value = 1000;
    } else if (this.value === 'sachet-water') {
      document.getElementById('quantity').value = '';
    }
  });
}

const urlParams = new URLSearchParams(window.location.search);
if (urlParams.get('product') === 'bulk-purchase' && productSelect) {
  productSelect.value = 'bulk-purchase';
  productSelect.dispatchEvent(new Event('change'));
}


// ============================================
// SIGN UP
// ============================================
const signupForm = document.getElementById("signupForm");

if (signupForm) {
  signupForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    document.querySelectorAll(".input-error").forEach(el => el.classList.remove("input-error"));
    document.querySelectorAll(".input-error-msg").forEach(el => el.classList.remove("show"));

    const fullName = document.getElementById("full-name").value.trim();
    const email = document.getElementById("email").value.trim();
    const phone = document.getElementById("phone").value.trim();
    const password = document.getElementById("password").value;
    const confirmPassword = document.getElementById("confirm-password").value;
    const securityQuestion = document.getElementById("security-question").value;
    const securityAnswer = document.getElementById("security-answer").value.trim();

    let hasError = false;
    if (!fullName) { document.getElementById("full-name").classList.add("input-error"); document.getElementById("err-fullname").classList.add("show"); hasError = true; }
    if (!email) { document.getElementById("email").classList.add("input-error"); document.getElementById("err-email").classList.add("show"); hasError = true; }
    if (!phone) { document.getElementById("phone").classList.add("input-error"); document.getElementById("err-phone").classList.add("show"); hasError = true; }
    if (password.length < 8 || !/[A-Z]/.test(password) || !/[0-9]/.test(password)) { document.getElementById("password").classList.add("input-error"); hasError = true; }
    if (password !== confirmPassword) {
      document.getElementById("confirm-password").classList.add("input-error");
      document.getElementById("password-match").textContent = "✗ Passwords do not match";
      document.getElementById("password-match").style.color = "red";
      hasError = true;
    }
    if (!securityQuestion) { document.getElementById("security-question").classList.add("input-error"); document.getElementById("err-question").classList.add("show"); hasError = true; }
    if (!securityAnswer) { document.getElementById("security-answer").classList.add("input-error"); document.getElementById("err-answer").classList.add("show"); hasError = true; }
    if (hasError) return;

    const submitBtn = signupForm.querySelector(".submit-btn");
    submitBtn.disabled = true;
    submitBtn.innerHTML = "Creating Account...";

    try {
      const res = await fetch(`${API}/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fullName, email, phone, password, securityQuestion, securityAnswer })
      });

      const result = await res.json();

      if (res.ok) {
        if (result.token) {
          persistUserSession(email, result.token, fullName);
        } else {
          await createAuthenticatedSession(email, password, fullName);
        }
        showMessage("signup-message", `Welcome to White Water Wells LTD, ${fullName}! Redirecting to the order page...`, "success");
        setTimeout(() => { window.location.href = "pages/order.html"; }, 1200);
      } else if (res.status === 409) {
        document.getElementById("email").classList.add("input-error");
        document.getElementById("err-email").textContent = "This email is already registered!";
        document.getElementById("err-email").classList.add("show");
      } else {
        showMessage("signup-message", result.message || "Signup failed. Please check all fields.", "error");
      }
    } catch (err) {
      showMessage("signup-message", "Could not connect to server. Make sure the server is running.", "error");
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML = '<i class="fa-solid fa-user-plus"></i> Create Account';
    }
  });
}


// ============================================
// LOGIN
// ============================================
const loginForm = document.getElementById("loginForm");

if (loginForm) {
  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    document.querySelectorAll(".input-error").forEach(el => el.classList.remove("input-error"));
    document.querySelectorAll(".input-error-msg").forEach(el => el.classList.remove("show"));

    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;

    let hasError = false;
    if (!email) { document.getElementById("email").classList.add("input-error"); document.getElementById("err-email").classList.add("show"); hasError = true; }
    if (!password) { document.getElementById("password").classList.add("input-error"); document.getElementById("err-password").classList.add("show"); hasError = true; }
    if (hasError) return;

    const submitBtn = loginForm.querySelector(".submit-btn");
    submitBtn.disabled = true;
    submitBtn.innerHTML = "Signing In...";

    try {
      const res = await fetch(`${API}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
      });

      const result = await res.json();

      if (res.ok) {
        persistUserSession(
          email,
          result.token,
          resolveDisplayName(
            result.user?.fullName,
            localStorage.getItem("username"),
            fallbackNameFromEmail(email),
            email
          )
        );
        // Login is in pages/ folder so go up one level to home
        window.location.href = "../home.html";
      } else if (res.status === 401) {
        document.getElementById("email").classList.add("input-error");
        document.getElementById("password").classList.add("input-error");
        document.getElementById("err-login").textContent = "Incorrect email or password. Please try again!";
        document.getElementById("err-login").classList.add("show");
      } else {
        document.getElementById("err-login").textContent = result.message || "Login failed. Please try again.";
        document.getElementById("err-login").classList.add("show");
      }
    } catch (err) {
      document.getElementById("err-login").textContent = "Could not connect to server. Make sure the server is running.";
      document.getElementById("err-login").classList.add("show");
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML = '<i class="fa-solid fa-right-to-bracket"></i> Sign In';
    }
  });
}


// ============================================
// ORDER FORM
// ============================================
const orderForm = document.getElementById("orderForm");

if (orderForm) {
  const token = localStorage.getItem("token");
  if (!token) {
    alert("Please log in to place an order.");
    window.location.href = "login.html";
  }

  const districts = {
    "Greater Accra": ["Accra Metropolitan", "Tema Metropolitan", "Ga East", "Ga West", "Ga North", "Ga South", "Adentan", "Ashaiman", "Ledzokuku", "Krowor", "La Dade-Kotopon", "La Nkwantanang-Madina", "Ningo-Prampram", "Shai-Osudoku", "Ayawaso East", "Ayawaso North", "Ayawaso West"],
    "Ashanti": ["Kumasi Metropolitan", "Oforikrom", "Asokwa", "Kwadaso", "Suame", "Tafo", "Asante Akim North", "Asante Akim South", "Bekwai", "Bosome Freho", "Bosomtwe", "Ejisu", "Ejura-Sekyedumase", "Juaben", "Kwabre East", "Mampong", "Offinso", "Offinso North"],
    "Western": ["Sekondi-Takoradi Metropolitan", "Ahanta West", "Effia-Kwesimintsim", "Kwesimentsim", "Mpohor", "Nzema East", "Prestea-Huni Valley", "Shama", "Tarkwa-Nsuaem", "Wassa Amenfi East", "Wassa Amenfi West", "Wassa East"],
    "Central": ["Cape Coast Metropolitan", "Abura-Asebu-Kwamankese", "Agona East", "Agona West", "Ajumako-Enyan-Essiam", "Asikuma-Odoben-Brakwa", "Assin Central", "Assin North", "Assin South", "Awutu Senya", "Awutu Senya East", "Effutu", "Ekumfi", "Gomoa East", "Gomoa West", "Komenda-Edina-Eguafo-Abirem", "Mfantsiman", "Twifo-Atti Morkwa", "Upper Denkyira East", "Upper Denkyira West"],
    "Eastern": ["Koforidua", "Abirem", "Abuakwa North", "Abuakwa South", "Achiase", "Akuapim North", "Akuapim South", "Atiwa East", "Atiwa West", "Ayensuano", "Birim Central", "Birim North", "Birim South", "Denkyembour", "Fanteakwa North", "Fanteakwa South", "Kwaebibirem", "Kwahu Afram Plains North", "Kwahu Afram Plains South", "Kwahu East", "Kwahu South", "Kwahu West", "Lower Manya Krobo", "New Juaben North", "New Juaben South", "Nsawam-Adoagyiri", "Suhum", "Upper Manya Krobo", "Upper West Akim", "West Akim", "Yilo Krobo"],
    "Northern": ["Tamale Metropolitan", "Gushegu", "Karaga", "Kpandai", "Mion", "Nanton", "Nanumba North", "Nanumba South", "Saboba", "Sagnarigu", "Savelugu", "Tatale-Sangule", "Tolon", "Yendi", "Zabzugu"],
    "Upper East": ["Bolgatanga Municipal", "Bawku Municipal", "Bawku West", "Binduri", "Bongo", "Builsa North", "Builsa South", "Garu", "Kassena-Nankana East", "Kassena-Nankana West", "Nabdam", "Pusiga", "Talensi", "Tempane"],
    "Upper West": ["Wa Municipal", "Daffiama-Bussie-Issa", "Jirapa", "Lambussie-Karni", "Lawra", "Nadowli-Kaleo", "Nandom", "Sissala East", "Sissala West", "Wa East", "Wa West"],
    "Volta": ["Ho Municipal", "Adaklu", "Afadjato South", "Agotime-Ziope", "Akatsi North", "Akatsi South", "Anloga", "Central Tongu", "Ho West", "Hohoe", "Keta", "Ketu North", "Ketu South", "Kpando", "North Dayi", "North Tongu", "South Dayi", "South Tongu"],
    "Brong-Ahafo": ["Sunyani Municipal", "Berekum East", "Dormaa Central", "Dormaa East", "Dormaa West", "Jaman North", "Jaman South", "Kintampo North", "Kintampo South", "Nkoranza North", "Nkoranza South", "Pru East", "Pru West", "Sene East", "Sene West", "Sunyani West", "Tain", "Tano North", "Tano South", "Techiman", "Techiman North", "Wenchi"],
    "North East": ["Nalerigu-Gambaga", "Bunkpurugu-Nakpayili", "Chereponi", "East Mamprusi", "Mamprugu-Moagduri", "West Mamprusi"],
    "Savannah": ["Damongo", "Bole", "Central Gonja", "East Gonja", "North East Gonja", "North Gonja", "Sawla-Tuna-Kalba", "West Gonja"],
    "Bono East": ["Techiman", "Atebubu-Amantin", "Kintampo North", "Kintampo South", "Nkoranza North", "Nkoranza South", "Pru East", "Pru West", "Sene East", "Sene West"],
    "Oti": ["Dambai", "Biakoye", "Guan", "Jasikan", "Kadjebi", "Krachi East", "Krachi Nchumuru", "Krachi West", "Nkwanta North", "Nkwanta South"],
    "Ahafo": ["Goaso", "Asunafo North", "Asunafo South", "Asutifi North", "Asutifi South", "Tano North", "Tano South"],
    "Western North": ["Sefwi Wiawso", "Amenfi Central", "Amenfi East", "Amenfi West", "Bibiani-Anhwiaso-Bekwai", "Bodi", "Juaboso", "Sefwi Akontombra", "Suaman"]
  };

  const regionSelect = document.getElementById("region");
  const districtSelect = document.getElementById("district");

  regionSelect.addEventListener("change", function () {
    const selectedRegion = this.value;
    districtSelect.innerHTML = '<option value="">-- Select District --</option>';
    if (selectedRegion && districts[selectedRegion]) {
      districts[selectedRegion].forEach(district => {
        const option = document.createElement("option");
        option.value = district;
        option.textContent = district;
        districtSelect.appendChild(option);
      });
    }
  });

  const phoneInput = document.getElementById("telp");
  phoneInput.addEventListener("input", function () {
    this.value = this.value.replace(/[^0-9]/g, "");
    const errPhone = document.getElementById("err-phone");
    if (this.value.length === 10 && /^0[2345]\d{8}$/.test(this.value)) {
      errPhone.classList.remove("show");
      this.classList.remove("input-error");
    } else if (this.value.length === 10) {
      errPhone.classList.add("show");
      this.classList.add("input-error");
    }
  });

  function calculateTotal() {
    const productSelect = document.getElementById("product");
    const quantityInput = document.getElementById("quantity");
    const orderTypeSelect = document.getElementById("order-type");
    const totalBox = document.getElementById("order-total-box");

    const selectedProduct = productSelect.options[productSelect.selectedIndex];
    const price = parseFloat(selectedProduct.getAttribute("data-price")) || 0;
    const quantity = parseInt(quantityInput.value) || 0;
    const selectedOrderType = orderTypeSelect.options[orderTypeSelect.selectedIndex];
    const discount = parseFloat(selectedOrderType.getAttribute("data-discount")) || 0;

    if (price > 0 && quantity > 0) {
      const subtotal = price * quantity;
      const discountAmount = (subtotal * discount) / 100;
      const deliveryFee = 100;
      const total = subtotal - discountAmount + deliveryFee;
      document.getElementById("subtotal").textContent = `GH₵${subtotal.toFixed(2)}`;
      document.getElementById("discount-amount").textContent = `-GH₵${discountAmount.toFixed(2)}`;
      document.getElementById("order-total").textContent = `GH₵${total.toFixed(2)}`;
      totalBox.style.display = "block";
    } else {
      totalBox.style.display = "none";
    }
  }

  document.getElementById("product").addEventListener("change", calculateTotal);
  document.getElementById("quantity").addEventListener("input", calculateTotal);
  document.getElementById("order-type").addEventListener("change", calculateTotal);

  const deliveryDate = document.getElementById("delivery-date");
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  deliveryDate.min = tomorrow.toISOString().split("T")[0];

  orderForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    document.querySelectorAll(".input-error").forEach(el => el.classList.remove("input-error"));
    document.querySelectorAll(".input-error-msg").forEach(el => el.classList.remove("show"));

    const fullName = document.getElementById("full-name").value.trim();
    const phone = document.getElementById("telp").value.trim();
    const email = document.getElementById("email").value.trim();
    const region = document.getElementById("region").value;
    const district = document.getElementById("district").value;
    const streetAddress = document.getElementById("street-address").value.trim();
    const product = document.getElementById("product").value;
    const quantity = document.getElementById("quantity").value;
    const orderType = document.getElementById("order-type").value;
    const deliveryDateVal = document.getElementById("delivery-date").value;
    const timeSlot = document.getElementById("time-slot").value;

    let hasError = false;
    if (!fullName) { document.getElementById("full-name").classList.add("input-error"); document.getElementById("err-name").classList.add("show"); hasError = true; }
    if (!phone || !/^0[2345]\d{8}$/.test(phone)) { document.getElementById("telp").classList.add("input-error"); document.getElementById("err-phone").classList.add("show"); hasError = true; }
    if (!email) { document.getElementById("email").classList.add("input-error"); document.getElementById("err-email").classList.add("show"); hasError = true; }
    if (!region) { document.getElementById("region").classList.add("input-error"); document.getElementById("err-region").classList.add("show"); hasError = true; }
    if (!district) { document.getElementById("district").classList.add("input-error"); document.getElementById("err-district").classList.add("show"); hasError = true; }
    if (!streetAddress) { document.getElementById("street-address").classList.add("input-error"); document.getElementById("err-street").classList.add("show"); hasError = true; }
    if (!product) { document.getElementById("product").classList.add("input-error"); document.getElementById("err-product").classList.add("show"); hasError = true; }
    if (!quantity || quantity < 1) { document.getElementById("quantity").classList.add("input-error"); document.getElementById("err-quantity").classList.add("show"); hasError = true; }
    if (!deliveryDateVal) { document.getElementById("delivery-date").classList.add("input-error"); document.getElementById("err-date").classList.add("show"); hasError = true; }
    if (!timeSlot) { document.getElementById("time-slot").classList.add("input-error"); document.getElementById("err-timeslot").classList.add("show"); hasError = true; }
    if (hasError) return;

    const orderTotal = document.getElementById("order-total").textContent;
    const orderData = {
      name: fullName, phone, email, region, district, streetAddress,
      product, quantity, orderType, delivery: deliveryDateVal, timeSlot,
      instructions: document.getElementById("instructions").value,
      total: orderTotal
    };

    const submitBtn = orderForm.querySelector(".submit-btn");
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Placing Order...';

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    try {
      const res = await fetch(`${API}/order`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(orderData),
        signal: controller.signal
      });
      clearTimeout(timeout);

      const result = await res.json();

      if (res.ok) {
        localStorage.setItem("confirmedOrder", JSON.stringify(result.order || orderData));
        window.location.href = "order-confirmation.html";
      } else {
        document.getElementById("err-order").textContent = result.message || "Failed to place order. Please try again.";
        document.getElementById("err-order").classList.add("show");
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i class="fa-solid fa-cart-shopping"></i> Place Order';
      }
    } catch (err) {
      clearTimeout(timeout);
      localStorage.setItem("confirmedOrder", JSON.stringify(orderData));
      window.location.href = "order-confirmation.html";
    }
  });
}


// ============================================
// PASSWORD LIVE VALIDATION
// ============================================
const passwordInput = document.getElementById("password");

if (passwordInput) {
  passwordInput.addEventListener("input", function () {
    const value = this.value;
    const ruleLength = document.getElementById("rule-length");
    const ruleUpper = document.getElementById("rule-upper");
    const ruleNumber = document.getElementById("rule-number");
    if (ruleLength) { ruleLength.classList.toggle("passed", value.length >= 8); ruleLength.textContent = value.length >= 8 ? "✓ At least 8 characters" : "✗ At least 8 characters"; }
    if (ruleUpper) { ruleUpper.classList.toggle("passed", /[A-Z]/.test(value)); ruleUpper.textContent = /[A-Z]/.test(value) ? "✓ At least one uppercase letter" : "✗ At least one uppercase letter"; }
    if (ruleNumber) { ruleNumber.classList.toggle("passed", /[0-9]/.test(value)); ruleNumber.textContent = /[0-9]/.test(value) ? "✓ At least one number" : "✗ At least one number"; }
  });
}


// ============================================
// CONFIRM PASSWORD LIVE CHECK
// ============================================
const confirmPasswordInput = document.getElementById("confirm-password");

if (confirmPasswordInput) {
  confirmPasswordInput.addEventListener("input", function () {
    const password = document.getElementById("password").value;
    const matchMsg = document.getElementById("password-match");
    if (this.value === "") { matchMsg.textContent = ""; }
    else if (this.value === password) { matchMsg.textContent = "✓ Passwords match"; matchMsg.style.color = "green"; }
    else { matchMsg.textContent = "✗ Passwords do not match"; matchMsg.style.color = "red"; }
  });
}


// ============================================
// FORGOT PASSWORD
// ============================================
const forgotForm = document.getElementById("forgotForm");

if (forgotForm) {
  let emailVerified = false;
  let verifiedEmail = "";
  const isStaffForgotFlow = window.location.pathname.includes("staff-forgot-password.html");

  forgotForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    document.querySelectorAll(".input-error").forEach(el => el.classList.remove("input-error"));
    document.querySelectorAll(".input-error-msg").forEach(el => el.classList.remove("show"));

    const email = document.getElementById("email").value.trim();
    const answerGroup = document.getElementById("security-question-group");

    if (!emailVerified) {
      if (!email) { document.getElementById("email").classList.add("input-error"); document.getElementById("err-email").classList.add("show"); return; }
      try {
        const res = await fetch(`${API}/verify-security`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, securityAnswer: "check-only" })
        });
        const result = await res.json();
        if (res.status === 404) { document.getElementById("email").classList.add("input-error"); document.getElementById("err-email").textContent = "No account found with that email."; document.getElementById("err-email").classList.add("show"); return; }
        answerGroup.style.display = "block";
        emailVerified = true;
        verifiedEmail = email;
        document.getElementById("forgot-btn").innerHTML = '<i class="fa-solid fa-check"></i> Verify Answer';
      } catch (err) { document.getElementById("err-forgot").textContent = "Could not connect to server."; document.getElementById("err-forgot").classList.add("show"); }
    } else {
      const selectedQuestion = document.getElementById("security-question-select").value;
      const answer = document.getElementById("security-answer").value.trim();
      let hasError = false;
      if (!selectedQuestion) { document.getElementById("security-question-select").classList.add("input-error"); document.getElementById("err-question").classList.add("show"); hasError = true; }
      if (!answer) { document.getElementById("security-answer").classList.add("input-error"); document.getElementById("err-answer").classList.add("show"); hasError = true; }
      if (hasError) return;
      try {
        const res = await fetch(`${API}/verify-security`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: verifiedEmail, securityAnswer: answer, securityQuestion: selectedQuestion })
        });
        const result = await res.json();
        if (res.ok) {
          localStorage.setItem("reset-email", verifiedEmail);
          window.location.href = isStaffForgotFlow ? "staff-reset-password.html" : "reset-password.html";
        }
        else { document.getElementById("security-answer").classList.add("input-error"); document.getElementById("err-answer").textContent = "Incorrect question or answer. Please try again!"; document.getElementById("err-answer").classList.add("show"); }
      } catch (err) { document.getElementById("err-forgot").textContent = "Could not connect to server."; document.getElementById("err-forgot").classList.add("show"); }
    }
  });
}


// ============================================
// RESET PASSWORD
// ============================================
const resetForm = document.getElementById("resetForm");

if (resetForm) {
  const isStaffResetFlow = window.location.pathname.includes("staff-reset-password.html");
  const newPasswordInput = document.getElementById("new-password");

  newPasswordInput.addEventListener("input", function () {
    const value = this.value;
    const ruleLength = document.getElementById("rule-length");
    const ruleUpper = document.getElementById("rule-upper");
    const ruleNumber = document.getElementById("rule-number");
    ruleLength.classList.toggle("passed", value.length >= 8); ruleLength.textContent = value.length >= 8 ? "✓ At least 8 characters" : "✗ At least 8 characters";
    ruleUpper.classList.toggle("passed", /[A-Z]/.test(value)); ruleUpper.textContent = /[A-Z]/.test(value) ? "✓ At least one uppercase letter" : "✗ At least one uppercase letter";
    ruleNumber.classList.toggle("passed", /[0-9]/.test(value)); ruleNumber.textContent = /[0-9]/.test(value) ? "✓ At least one number" : "✗ At least one number";
  });

  document.getElementById("confirm-new-password").addEventListener("input", function () {
    const password = document.getElementById("new-password").value;
    const matchMsg = document.getElementById("password-match");
    if (this.value === password) { matchMsg.textContent = "✓ Passwords match"; matchMsg.style.color = "green"; }
    else { matchMsg.textContent = "✗ Passwords do not match"; matchMsg.style.color = "red"; }
  });

  resetForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const email = localStorage.getItem("reset-email");
    const newPassword = document.getElementById("new-password").value;
    const confirmPassword = document.getElementById("confirm-new-password").value;
    const errEl = document.getElementById("err-reset");
    const submitBtn = resetForm.querySelector(".submit-btn");

    errEl.textContent = "";
    errEl.classList.remove("show");

    if (!email) {
      errEl.textContent = "Session expired. Please go back and verify your email again.";
      errEl.classList.add("show");
      setTimeout(() => { window.location.href = isStaffResetFlow ? "staff-forgot-password.html" : "forgot-password.html"; }, 3000);
      return;
    }
    if (newPassword.length < 8 || !/[A-Z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
      errEl.textContent = "Please make sure your password meets all requirements!";
      errEl.classList.add("show");
      return;
    }
    if (newPassword !== confirmPassword) {
      errEl.textContent = "Passwords do not match!";
      errEl.classList.add("show");
      return;
    }

    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Resetting...';

    try {
      const res = await fetch(`${API}/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, newPassword })
      });
      const result = await res.json();
      if (res.ok) {
        localStorage.removeItem("reset-email");
        errEl.textContent = "Password reset successful! Redirecting to login...";
        errEl.style.color = "green";
        errEl.classList.add("show");
        setTimeout(() => { window.location.href = isStaffResetFlow ? "staff-login.html" : "login.html"; }, 2000);
      } else {
        errEl.textContent = result.message || "Reset failed. Please try again.";
        errEl.classList.add("show");
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i class="fa-solid fa-lock"></i> Reset Password';
      }
    } catch (err) {
      errEl.textContent = "Could not connect to server. Please try again.";
      errEl.classList.add("show");
      submitBtn.disabled = false;
      submitBtn.innerHTML = '<i class="fa-solid fa-lock"></i> Reset Password';
    }
  });
}


// ============================================
// PASSWORD TOGGLE VISIBILITY
// ============================================
document.querySelectorAll(".toggle-password").forEach(icon => {
  icon.addEventListener("click", function () {
    const targetId = this.getAttribute("data-target");
    const input = document.getElementById(targetId);
    if (input.type === "password") { input.type = "text"; this.classList.remove("fa-eye"); this.classList.add("fa-eye-slash"); }
    else { input.type = "password"; this.classList.remove("fa-eye-slash"); this.classList.add("fa-eye"); }
  });
});


// ============================================
// ORDER HISTORY
// ============================================
const ordersContainer = document.getElementById("orders-container");

if (ordersContainer) {
  const token = localStorage.getItem("token");
  const email = localStorage.getItem("email");

  if (!token) { window.location.href = "login.html"; }
  else {
    const productNames = { "sachet-water": "Sachet Water - 500ml", "bulk-purchase": "Sachet Water - Bulk Purchase" };
    const orderTypeNames = { "one-time": "One-Time Purchase", "weekly": "Weekly Subscription", "biweekly": "Bi-Weekly Subscription", "monthly": "Monthly Subscription" };

    fetch(`${API}/orders/${email}`)
      .then(res => res.json())
      .then(data => {
        document.getElementById("loading").style.display = "none";
        if (!data.orders || data.orders.length === 0) { document.getElementById("no-orders").style.display = "block"; return; }

        window._orderHistory = [];
        data.orders.forEach((order, i) => {
          window._orderHistory.push(order);
          const date = new Date(order.createdAt).toDateString();
          const deliveryDate = new Date(order.delivery).toDateString();
          const productName = productNames[order.product] || order.product;
          const orderTypeName = orderTypeNames[order.orderType] || order.orderType;
          const isPaid = order.paymentStatus === "paid";

          ordersContainer.innerHTML += `
            <div class="order-card">
              <div class="order-card-header">
                <h3><i class="fa-solid fa-cart-shopping" style="color:var(--blue-mid); margin-right:8px;"></i>${productName}</h3>
                <span class="order-date">${date}</span>
              </div>
              <div class="order-card-body">
                <div class="order-detail-item"><label>Quantity</label><p>${order.quantity} bag(s)</p></div>
                <div class="order-detail-item"><label>Order Type</label><p>${orderTypeName}</p></div>
                <div class="order-detail-item"><label>Delivery Date</label><p>${deliveryDate}</p></div>
                <div class="order-detail-item"><label>Time Slot</label><p>${order.timeSlot || "Not specified"}</p></div>
                <div class="order-detail-item"><label>Location</label><p>${order.district || ""}, ${order.region || ""}</p></div>
                <div class="order-detail-item"><label>Address</label><p>${order.streetAddress || "Not specified"}</p></div>
                <div class="order-detail-item"><label>Payment Method</label><p>${order.paymentMethod || "Not specified"}</p></div>
              </div>
              <div class="order-card-footer">
                <span class="order-total-display">${order.total || "N/A"}</span>
                <span class="order-status" style="background:${isPaid ? '#e6f4ea' : '#fef3c7'}; color:${isPaid ? '#16a34a' : '#d97706'};">
                  <i class="fa-solid fa-${isPaid ? 'circle-check' : 'clock'}"></i>
                  ${isPaid ? 'Paid' : 'Payment Pending'}
                </span>
              </div>
              <div style="display:flex; gap:8px; margin-top:12px; padding-top:12px; border-top:1px solid var(--border); flex-wrap:wrap;">
                ${!isPaid ? `<button onclick="payNow(${i})" style="display:inline-flex; align-items:center; gap:8px; padding:8px 16px; background:#d97706; color:white; border:none; border-radius:8px; cursor:pointer; font-size:13px; font-weight:600;"><i class="fa-solid fa-credit-card"></i> Pay Now</button>` : ''}
                <button onclick="reorder(${i})" style="display:inline-flex; align-items:center; gap:8px; padding:8px 16px; background:var(--blue-mid); color:white; border:none; border-radius:8px; cursor:pointer; font-size:13px; font-weight:600;"><i class="fa-solid fa-rotate-right"></i> Reorder</button>
              </div>
            </div>
          `;
        });

    window.payNow = function(i) {
      const order = window._orderHistory[i];
      localStorage.setItem("confirmedOrder", JSON.stringify(order));
      window.location.href = "payments.html";
    };

    window.reorder = function(i) {
      window.location.href = "order.html#Place-order";
    };
      })
      .catch(() => {
        document.getElementById("loading").style.display = "none";
        ordersContainer.innerHTML = `<p style="color:red; text-align:center;">Could not load orders. Make sure the server is running.</p>`;
      });
  }
}


// ============================================
// PAYMENT PAGE
// ============================================
const summaryDetails = document.getElementById("summary-details");

if (summaryDetails) {
  const order = JSON.parse(localStorage.getItem("confirmedOrder"));

  if (!order) { window.location.href = "order.html"; }
  else {
    const productNames = { "sachet-water": "Sachet Water - 500ml", "bulk-purchase": "Sachet Water - Bulk Purchase" };
    summaryDetails.innerHTML = `
      <div style="display:flex; justify-content:space-between; margin-bottom:6px;"><span>Customer:</span><strong>${order.name}</strong></div>
      <div style="display:flex; justify-content:space-between; margin-bottom:6px;"><span>Product:</span><strong>${productNames[order.product] || order.product}</strong></div>
      <div style="display:flex; justify-content:space-between; margin-bottom:6px;"><span>Quantity:</span><strong>${order.quantity} bag(s)</strong></div>
      <div style="display:flex; justify-content:space-between; margin-bottom:6px;"><span>Delivery Date:</span><strong>${new Date(order.delivery).toDateString()}</strong></div>
      <div style="display:flex; justify-content:space-between; padding-top:12px; border-top:1px solid var(--border); font-size:16px; margin-top:6px;"><span><strong>Total:</strong></span><strong style="color:var(--blue-deep);">${order.total || ("GH\u20B5" + ((7 * order.quantity) + 100).toFixed(2))}</strong></div>
    `;
  }
}

let selectedPaymentMethod = null;

window.selectPayment = function(method) {
  document.querySelectorAll(".payment-option").forEach(opt => opt.classList.remove("selected"));
  document.querySelectorAll(".payment-details").forEach(det => det.style.display = "none");
  const option = document.getElementById(`${method}-option`);
  const details = document.getElementById(`${method}-details`);
  if (option) option.classList.add("selected");
  if (details) details.style.display = "block";
  selectedPaymentMethod = method;
  const errEl = document.getElementById("err-payment");
  if (errEl) { errEl.textContent = ""; errEl.classList.remove("show"); }
};

window.confirmPayment = function() {
  const errEl = document.getElementById("err-payment");
  if (!selectedPaymentMethod) {
    if (errEl) { errEl.textContent = "Please select a payment method to continue."; errEl.classList.add("show"); }
    return;
  }
  const methodNames = { mtn: "MTN Mobile Money", vodafone: "Vodafone Cash", airteltigo: "AirtelTigo Money", card: "Card Payment", cash: "Cash on Delivery" };
  const order = JSON.parse(localStorage.getItem("confirmedOrder")) || {};
  order.paymentMethod = methodNames[selectedPaymentMethod] || selectedPaymentMethod;
  localStorage.setItem("confirmedOrder", JSON.stringify(order));

  if (order._id) {
    fetch(`${API}/order/${order._id}/payment`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paymentMethod: order.paymentMethod })
    }).catch(() => {});
  }

  const btn = document.querySelector(".submit-btn[onclick=\"confirmPayment()\"]");
  if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-circle-check"></i> Payment Method Confirmed!'; btn.style.background = "#16a34a"; }

  setTimeout(() => {
    localStorage.removeItem("confirmedOrder");
    window.location.href = "order-history.html";
  }, 1500);
};


// ============================================
// STAFF SIGNUP
// ============================================
const staffSignupForm = document.getElementById("staffSignupForm");

if (staffSignupForm) {
  staffSignupForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    document.querySelectorAll(".input-error").forEach(el => el.classList.remove("input-error"));
    document.querySelectorAll(".input-error-msg").forEach(el => el.classList.remove("show"));

    const fullName = document.getElementById("full-name").value.trim();
    const email = document.getElementById("email").value.trim();
    const phone = document.getElementById("phone").value.trim();
    const password = document.getElementById("password").value;
    const confirmPassword = document.getElementById("confirm-password").value;
    const securityQuestion = document.getElementById("security-question").value;
    const securityAnswer = document.getElementById("security-answer").value.trim();
    const terms = document.getElementById("terms").checked;

    const normalizedStaffLogin = email.toLowerCase();
    const isStaffEmail = APPROVED_STAFF_LOGINS.includes(normalizedStaffLogin);

    let hasError = false;
    if (!fullName) { document.getElementById("full-name").classList.add("input-error"); document.getElementById("err-fullname").classList.add("show"); hasError = true; }
    if (!email || !isStaffEmail) { document.getElementById("email").classList.add("input-error"); document.getElementById("err-email").textContent = "This staff login ID is not approved."; document.getElementById("err-email").classList.add("show"); hasError = true; }
    if (!phone) { document.getElementById("phone").classList.add("input-error"); document.getElementById("err-phone").classList.add("show"); hasError = true; }
    if (password.length < 8 || !/[A-Z]/.test(password) || !/[0-9]/.test(password)) { document.getElementById("password").classList.add("input-error"); hasError = true; }
    if (password !== confirmPassword) { document.getElementById("confirm-password").classList.add("input-error"); document.getElementById("password-match").textContent = "Passwords do not match"; document.getElementById("password-match").style.color = "red"; hasError = true; }
    if (!securityQuestion) { document.getElementById("security-question").classList.add("input-error"); document.getElementById("err-question").classList.add("show"); hasError = true; }
    if (!securityAnswer) { document.getElementById("security-answer").classList.add("input-error"); document.getElementById("err-answer").classList.add("show"); hasError = true; }
    if (!terms) { hasError = true; }
    if (hasError) return;

    const submitBtn = staffSignupForm.querySelector(".submit-btn");
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Creating Account...';

    const msgEl = document.getElementById("staff-signup-message");

    try {
      const res = await fetch(`${API}/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fullName, email, phone, password, securityQuestion, securityAnswer })
      });
      const result = await res.json();
      if (res.ok) {
        msgEl.style.display = "block";
        msgEl.style.background = "#e6f4ea";
        msgEl.style.color = "#16a34a";
        msgEl.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Account created! Signing you in...';
        // Auto login to determine role and redirect
        try {
          const loginRes = await fetch(`${API}/staff-login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password })
          });
          const loginResult = await loginRes.json();
          if (loginRes.ok) {
            const staffDisplayName = resolveDisplayName(
              loginResult.user?.fullName,
              fullName,
              localStorage.getItem("staff-name"),
              fallbackNameFromEmail(email),
              email
            );
            localStorage.setItem("staff-token", loginResult.token);
            localStorage.setItem("staff-name", staffDisplayName);
            localStorage.setItem("staff-role", loginResult.user.role);
            msgEl.innerHTML = '<i class="fa-solid fa-circle-check"></i> Account created! Redirecting...';
            setTimeout(() => {
              window.location.href = loginResult.user.role === "admin" ? "admin-dashboard.html" : "waybill.html";
            }, 1200);
          } else {
            setTimeout(() => { window.location.href = "staff-login.html"; }, 1200);
          }
        } catch {
          setTimeout(() => { window.location.href = "staff-login.html"; }, 1200);
        }
      } else {
        msgEl.style.display = "block";
        msgEl.style.background = "#fef2f2";
        msgEl.style.color = "#dc2626";
        msgEl.textContent = result.message || "Failed to create account. Please try again.";
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i class="fa-solid fa-id-badge"></i> Create Staff Account';
      }
    } catch (err) {
      msgEl.style.display = "block";
      msgEl.style.background = "#fef2f2";
      msgEl.style.color = "#dc2626";
      msgEl.textContent = "Could not connect to server. Please try again.";
      submitBtn.disabled = false;
      submitBtn.innerHTML = '<i class="fa-solid fa-id-badge"></i> Create Staff Account';
    }
  });
}


// ============================================
// STAFF LOGIN
// ============================================
const staffLoginForm = document.getElementById("staffLoginForm");

if (staffLoginForm) {
  staffLoginForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    document.querySelectorAll(".input-error").forEach(el => el.classList.remove("input-error"));
    document.querySelectorAll(".input-error-msg").forEach(el => el.classList.remove("show"));

    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;

    let hasError = false;
    if (!email) { document.getElementById("email").classList.add("input-error"); document.getElementById("err-email").classList.add("show"); hasError = true; }
    if (!password) { document.getElementById("password").classList.add("input-error"); document.getElementById("err-password").classList.add("show"); hasError = true; }
    if (hasError) return;

    const submitBtn = staffLoginForm.querySelector(".submit-btn");
    submitBtn.disabled = true;
    submitBtn.innerHTML = "Signing In...";

    try {
      const res = await fetch(`${API}/staff-login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
      });

      const result = await res.json();

      if (res.ok) {
        const staffDisplayName = resolveDisplayName(
          result.user?.fullName,
          localStorage.getItem("staff-name"),
          fallbackNameFromEmail(email),
          email
        );
        localStorage.setItem("staff-token", result.token);
        localStorage.setItem("staff-name", staffDisplayName);
        localStorage.setItem("staff-role", result.user.role);
        window.location.href = result.user.role === "admin" ? "admin-dashboard.html" : "waybill.html";
      } else if (res.status === 403) {
        document.getElementById("err-staff-login").textContent = result.message || "Access denied. This staff login ID is not approved.";
        document.getElementById("err-staff-login").classList.add("show");
      } else {
        document.getElementById("err-staff-login").textContent = result.message || "Invalid credentials.";
        document.getElementById("err-staff-login").classList.add("show");
      }
    } catch (err) {
      document.getElementById("err-staff-login").textContent = "Could not connect to server.";
      document.getElementById("err-staff-login").classList.add("show");
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML = '<i class="fa-solid fa-right-to-bracket"></i> Sign In';
    }
  });
}


// ============================================
// WAYBILL PAGE
// ============================================
const waybillForm = document.getElementById("waybillForm");

if (waybillForm) {
  const staffToken = localStorage.getItem("staff-token");
  const staffName = localStorage.getItem("staff-name");
  const staffRole = localStorage.getItem("staff-role");

  if (!staffToken) { window.location.href = "staff-login.html"; }

  const welcomeEl = document.getElementById("staff-welcome");
  if (welcomeEl && staffName) welcomeEl.textContent = staffName;

  const staffNameEl = document.getElementById("waybill-staff-name");
  if (staffNameEl && staffName) staffNameEl.textContent = staffName;

  const previousWaybillsList = document.getElementById("previous-waybills-list");
  const previousWaybillsLoading = document.getElementById("previous-waybills-loading");
  const previousWaybillsDate = document.getElementById("previous-waybills-date");
  const previousWaybillsClear = document.getElementById("previous-waybills-clear");
  const previousWaybillsSummary = document.getElementById("previous-waybills-summary");

  const staffLogoutBtn = document.getElementById("staff-logout-btn");
  if (staffLogoutBtn) {
    staffLogoutBtn.addEventListener("click", (e) => {
      e.preventDefault();
      localStorage.removeItem("staff-token");
      localStorage.removeItem("staff-name");
      localStorage.removeItem("staff-role");
      window.location.href = "staff-login.html";
    });
  }

  let waybillNum = "Loading...";
  let allPreviousWaybills = [];

  function getWaybillDateKey(waybill) {
    const entryDate = new Date(waybill.date || waybill.createdAt || Date.now());
    return `${entryDate.getFullYear()}-${String(entryDate.getMonth() + 1).padStart(2, "0")}-${String(entryDate.getDate()).padStart(2, "0")}`;
  }

  function refreshNextWaybillNumber() {
    fetch(`${API}/waybills/count`)
      .then(res => res.json())
      .then(data => {
        waybillNum = `WWW2026${String(data.count + 1).padStart(4, "0")}`;
        document.getElementById("waybill-number").textContent = waybillNum;
      })
      .catch(() => {
        document.getElementById("waybill-number").textContent = "Unavailable";
      });
  }

  function renderPreviousWaybills() {
    if (!previousWaybillsList) return;

    const selectedDate = previousWaybillsDate ? previousWaybillsDate.value : "";
    const filteredWaybills = selectedDate
      ? allPreviousWaybills.filter(w => getWaybillDateKey(w) === selectedDate)
      : allPreviousWaybills;

    if (previousWaybillsSummary) {
      previousWaybillsSummary.textContent = selectedDate
        ? `${filteredWaybills.length} waybill(s) on ${selectedDate}`
        : `${filteredWaybills.length} recent waybill(s)`;
    }

    if (filteredWaybills.length === 0) {
      previousWaybillsList.innerHTML = `<div style="text-align:center; padding:24px; border:1.5px dashed var(--border); border-radius:var(--radius); color:var(--text-muted);"><i class="fa-solid fa-inbox" style="font-size:20px; display:block; margin-bottom:8px;"></i>${selectedDate ? "No waybills found for this date." : "No previous waybills yet."}</div>`;
      return;
    }

    const grouped = filteredWaybills.reduce((acc, waybill) => {
      const key = getWaybillDateKey(waybill);
      if (!acc[key]) acc[key] = [];
      acc[key].push(waybill);
      return acc;
    }, {});

    const dateKeys = Object.keys(grouped).sort((a, b) => b.localeCompare(a));

    previousWaybillsList.innerHTML = dateKeys.map(dateKey => {
      const [year, month, day] = dateKey.split("-").map(Number);
      const groupDate = new Date(year, month - 1, day);
      const sectionItems = grouped[dateKey].map(w => {
        const entryDate = new Date(w.date || w.createdAt || Date.now());
        const amount = Number(w.amount || 0).toFixed(2);
        const received = w.receivedBy || w.driverSignature;

        return `
          <div style="background:var(--white); border-radius:var(--radius-lg); padding:16px 18px; box-shadow:var(--shadow-sm); border-left:4px solid ${received ? '#16a34a' : 'var(--blue-mid)'};">
            <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:12px; flex-wrap:wrap; margin-bottom:10px;">
              <div>
                <p style="font-size:13px; color:var(--text-muted); margin:0 0 4px 0;">Waybill No</p>
                <p style="font-size:16px; font-weight:700; color:var(--blue-deep); margin:0;">${w.waybillNumber || "N/A"}</p>
              </div>
              <span class="status-badge ${received ? 'paid' : 'pending'}" style="margin-top:2px;">
                <i class="fa-solid fa-${received ? 'circle-check' : 'clock'}"></i>
                ${received ? 'Received' : 'Awaiting Receipt'}
              </span>
            </div>
            <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(180px,1fr)); gap:8px; font-size:13px; color:var(--text-muted);">
              <p><i class="fa-solid fa-calendar" style="color:var(--blue-mid); margin-right:4px;"></i>${entryDate.toDateString()}</p>
              <p><i class="fa-solid fa-user" style="color:var(--blue-mid); margin-right:4px;"></i>${w.to || "No recipient"}</p>
              <p><i class="fa-solid fa-truck" style="color:var(--blue-mid); margin-right:4px;"></i>${w.driverName || "No driver"}</p>
              <p><i class="fa-solid fa-money-bill-wave" style="color:var(--blue-mid); margin-right:4px;"></i>GH₵${amount}</p>
            </div>
          </div>
        `;
      }).join("");

      return `
        <div style="margin-bottom:8px;">
          <div style="display:flex; align-items:center; justify-content:space-between; margin:10px 2px 12px 2px;">
            <h3 style="font-size:16px; color:var(--blue-deep); margin:0; font-family:'Playfair Display', serif;">${groupDate.toDateString()}</h3>
            <span style="font-size:12px; color:var(--text-muted);">${grouped[dateKey].length} waybill(s)</span>
          </div>
          <div style="display:grid; gap:14px;">${sectionItems}</div>
        </div>
      `;
    }).join("");
  }

  function loadPreviousWaybills() {
    if (!previousWaybillsList || !previousWaybillsLoading) return;

    previousWaybillsLoading.style.display = "block";
    previousWaybillsList.innerHTML = "";

    fetch(`${API}/waybills`)
      .then(res => res.json())
      .then(data => {
        previousWaybillsLoading.style.display = "none";

        const waybills = data.waybills || [];
        allPreviousWaybills = waybills
          .filter(w => !staffName || w.submittedBy === staffName)
          .slice(0, 8);
        renderPreviousWaybills();
      })
      .catch(() => {
        previousWaybillsLoading.style.display = "none";
        if (previousWaybillsSummary) previousWaybillsSummary.textContent = "";
        previousWaybillsList.innerHTML = `<div style="text-align:center; padding:24px; border:1.5px dashed var(--border); border-radius:var(--radius); color:var(--text-muted);"><i class="fa-solid fa-circle-exclamation" style="font-size:20px; display:block; margin-bottom:8px;"></i>Could not load previous waybills right now.</div>`;
      });
  }

  if (previousWaybillsDate) {
    previousWaybillsDate.addEventListener("change", () => {
      renderPreviousWaybills();
    });
  }

  if (previousWaybillsClear) {
    previousWaybillsClear.addEventListener("click", () => {
      if (previousWaybillsDate) previousWaybillsDate.value = "";
      renderPreviousWaybills();
    });
  }

  refreshNextWaybillNumber();
  loadPreviousWaybills();

  document.getElementById("waybill-date").value = new Date().toISOString().split("T")[0];

  waybillForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    document.querySelectorAll(".input-error").forEach(el => el.classList.remove("input-error"));
    document.querySelectorAll(".input-error-msg").forEach(el => el.classList.remove("show"));

    const to = document.getElementById("to").value.trim();
    const driverName = document.getElementById("driver-name").value.trim();
    const address = document.getElementById("address").value.trim();
    const carNumber = document.getElementById("car-number").value.trim();
    const date = document.getElementById("waybill-date").value;
    const quantity = document.getElementById("quantity").value.trim();
    const description = document.getElementById("description").value.trim();
    const remarks = document.getElementById("remarks").value.trim();
    const despatchedBy = document.getElementById("despatched-by").value.trim();
    const receivedBy = document.getElementById("received-by").value.trim();
    const driverSignature = document.getElementById("driver-signature").value.trim();
    const amount = parseFloat(document.getElementById("waybill-amount").value) || 0;

    let hasError = false;
    if (!to) { document.getElementById("to").classList.add("input-error"); document.getElementById("err-to").classList.add("show"); hasError = true; }
    if (!driverName) { document.getElementById("driver-name").classList.add("input-error"); document.getElementById("err-driver").classList.add("show"); hasError = true; }
    if (!address) { document.getElementById("address").classList.add("input-error"); document.getElementById("err-address").classList.add("show"); hasError = true; }
    if (!carNumber) { document.getElementById("car-number").classList.add("input-error"); document.getElementById("err-car").classList.add("show"); hasError = true; }
    if (!date) { document.getElementById("waybill-date").classList.add("input-error"); document.getElementById("err-date").classList.add("show"); hasError = true; }
    if (!quantity || !description) { document.getElementById("err-items").classList.add("show"); hasError = true; }
    if (!despatchedBy) { document.getElementById("despatched-by").classList.add("input-error"); document.getElementById("err-despatched").classList.add("show"); hasError = true; }
    if (!amount || amount <= 0) { document.getElementById("waybill-amount").classList.add("input-error"); document.getElementById("err-amount").classList.add("show"); hasError = true; }
    if (hasError) return;

    const submitBtn = waybillForm.querySelector(".submit-btn");
    submitBtn.disabled = true;
    submitBtn.innerHTML = "Submitting...";

    try {
      const res = await fetch(`${API}/waybill`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${staffToken}` },
        body: JSON.stringify({ to, driverName, address, carNumber, date, quantity, description, remarks, despatchedBy, receivedBy, driverSignature, waybillNumber: waybillNum, submittedBy: staffName, amount })
      });

      const result = await res.json();

      if (res.ok) {
        document.getElementById("waybill-success").style.display = "block";
        waybillForm.reset();
        document.getElementById("waybill-date").value = new Date().toISOString().split("T")[0];
        refreshNextWaybillNumber();
        loadPreviousWaybills();
        window.scrollTo({ top: 0, behavior: "smooth" });
      } else {
        document.getElementById("err-waybill").textContent = result.message || "Failed to submit. Please try again.";
        document.getElementById("err-waybill").classList.add("show");
      }
    } catch (err) {
      document.getElementById("err-waybill").textContent = "Could not connect to server. Make sure the server is running.";
      document.getElementById("err-waybill").classList.add("show");
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Submit Waybill';
    }
  });
}


// ============================================
// ORDER CONFIRMATION PAGE
// ============================================
const confirmationContent = document.getElementById("confirmation-content");

if (confirmationContent) {
  const order = JSON.parse(localStorage.getItem("confirmedOrder"));

  if (!order) { window.location.href = "order.html"; }
  else {
    const productNames = { "sachet-water": "Sachet Water - 500ml", "bulk-purchase": "Sachet Water - Bulk Purchase" };
    const discountMap = { "weekly": 10, "biweekly": 15, "monthly": 20, "one-time": 0 };

    document.getElementById("loading").style.display = "none";
    confirmationContent.style.display = "block";

    const unitPrice = 7;
    const subtotal = unitPrice * order.quantity;
    const discount = discountMap[order.orderType] || 0;
    const discountAmount = (subtotal * discount) / 100;
    const deliveryFee = 100;
    const grandTotal = subtotal - discountAmount + deliveryFee;
    const date = order.createdAt ? new Date(order.createdAt) : new Date();

    if (document.getElementById("invoice-number")) document.getElementById("invoice-number").textContent = `Invoice No: WWW${String(order._id || "XXXX").slice(-4).toUpperCase()}`;
    if (document.getElementById("invoice-date")) document.getElementById("invoice-date").textContent = `Date: ${date.toDateString()}`;
    if (document.getElementById("invoice-name")) document.getElementById("invoice-name").textContent = order.name;
    if (document.getElementById("invoice-address")) document.getElementById("invoice-address").textContent = `${order.streetAddress}, ${order.district}, ${order.region}`;
    if (document.getElementById("invoice-phone")) document.getElementById("invoice-phone").textContent = `Phone: ${order.phone}`;
    if (document.getElementById("invoice-email")) document.getElementById("invoice-email").textContent = `Email: ${order.email}`;
    if (document.getElementById("invoice-items")) document.getElementById("invoice-items").innerHTML = `
      <span>${productNames[order.product] || order.product}</span>
      <span>${order.quantity}</span>
      <span>GH₵${unitPrice}.00</span>
      <span>GH₵${subtotal}.00</span>
    `;
    if (document.getElementById("invoice-subtotal")) document.getElementById("invoice-subtotal").textContent = `GH₵${subtotal}.00`;
    if (document.getElementById("invoice-discount")) document.getElementById("invoice-discount").textContent = `-GH₵${discountAmount}.00`;
    if (document.getElementById("invoice-total")) document.getElementById("invoice-total").textContent = `GH₵${grandTotal}.00`;
    if (document.getElementById("invoice-payment")) document.getElementById("invoice-payment").textContent = order.paymentMethod || "To be confirmed";
    if (document.getElementById("invoice-delivery")) document.getElementById("invoice-delivery").textContent = new Date(order.delivery).toDateString();
  }
}

function finalizeOrder() {
  window.location.href = "payments.html";
}

function isCashOnDeliveryOrder(order) {
  return order?.paymentMethod === "Cash on Delivery";
}

function isPaidOrder(order) {
  return order?.paymentStatus === "paid";
}

function isPendingCustomerOrder(order) {
  return !isPaidOrder(order) && !isCashOnDeliveryOrder(order);
}

function isPaidOnSiteOrder(order) {
  return isPaidOrder(order) && !isCashOnDeliveryOrder(order);
}

function getAdminOrderStatusMeta(order) {
  if (isCashOnDeliveryOrder(order) && isPaidOrder(order)) {
    return {
      badgeClass: "paid",
      icon: "money-bill-wave",
      text: "Paid on Delivery",
      actionText: "Cash Received"
    };
  }

  if (isCashOnDeliveryOrder(order)) {
    return {
      badgeClass: "pending",
      icon: "truck",
      text: "Pay on Delivery",
      actionText: "Confirm Cash Received"
    };
  }

  if (isPaidOrder(order)) {
    return {
      badgeClass: "paid",
      icon: "circle-check",
      text: "Paid on Site",
      actionText: "Payment Confirmed"
    };
  }

  return {
    badgeClass: "pending",
    icon: "clock",
    text: "Pending Payment",
    actionText: "Awaiting Customer Payment"
  };
}


// ============================================
// ADMIN DASHBOARD
// ============================================
const ordersList = document.getElementById("orders-list");

if (ordersList) {
  const staffToken = localStorage.getItem("staff-token");
  const staffRole = localStorage.getItem("staff-role");
  const staffName = localStorage.getItem("staff-name");

  if (!staffToken || staffRole !== "admin") { alert("Admin access only!"); window.location.href = "staff-login.html"; }

  const welcomeEl = document.getElementById("staff-welcome");
  if (welcomeEl) welcomeEl.textContent = staffName;

  const staffLogoutBtn = document.getElementById("staff-logout-btn");
  if (staffLogoutBtn) {
    staffLogoutBtn.addEventListener("click", (e) => {
      e.preventDefault();
      localStorage.removeItem("staff-token");
      localStorage.removeItem("staff-name");
      localStorage.removeItem("staff-role");
      window.location.href = "staff-login.html";
    });
  }

  let allOrders = [];
  const productNames = { "sachet-water": "Sachet Water - 500ml", "bulk-purchase": "Sachet Water - Bulk Purchase" };

  function renderOrders(orders) {
    if (orders.length === 0) {
      ordersList.innerHTML = `<div style="text-align:center; padding:60px; color:var(--text-muted);"><i class="fa-solid fa-box-open" style="font-size:48px; margin-bottom:16px; display:block;"></i><p>No orders found.</p></div>`;
      return;
    }
    ordersList.innerHTML = orders.map(order => `
      <div class="admin-order-card status-${order.paymentStatus || 'pending'}" id="card-${order._id}">
        <div style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:12px;">
          <div>
            <div style="display:flex; align-items:center; gap:12px; margin-bottom:8px;">
              <h3 style="font-family:'Playfair Display',serif; font-size:16px;">${order.name}</h3>
              <span class="status-badge ${getAdminOrderStatusMeta(order).badgeClass}">
                <i class="fa-solid fa-${getAdminOrderStatusMeta(order).icon}"></i>
                ${getAdminOrderStatusMeta(order).text}
              </span>
            </div>
            <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(160px,1fr)); gap:8px; font-size:13px; color:var(--text-muted);">
              <p><i class="fa-solid fa-phone" style="color:var(--blue-mid); margin-right:4px;"></i>${order.phone}</p>
              <p><i class="fa-regular fa-envelope" style="color:var(--blue-mid); margin-right:4px;"></i>${order.email}</p>
              <p><i class="fa-solid fa-box" style="color:var(--blue-mid); margin-right:4px;"></i>${productNames[order.product] || order.product} × ${order.quantity}</p>
              <p><i class="fa-solid fa-calendar" style="color:var(--blue-mid); margin-right:4px;"></i>${new Date(order.delivery).toDateString()}</p>
              <p><i class="fa-solid fa-location-dot" style="color:var(--blue-mid); margin-right:4px;"></i>${order.district || ""}, ${order.region || ""}</p>
              <p><i class="fa-solid fa-credit-card" style="color:var(--blue-mid); margin-right:4px;"></i>${order.paymentMethod || "Not specified"}</p>
            </div>
          </div>
          <div style="display:flex; flex-direction:column; align-items:flex-end; gap:8px;">
            <p style="font-size:18px; font-weight:700; color:var(--blue-deep);">${order.total || "N/A"}</p>
            <p style="font-size:12px; color:var(--text-muted);">${new Date(order.createdAt).toDateString()}</p>
            ${isCashOnDeliveryOrder(order) && !isPaidOrder(order) ? `
              <button class="mark-paid-btn" onclick="markAsPaid('${order._id}', this)">
                <i class="fa-solid fa-money-bill-wave"></i> Confirm Cash Received
              </button>
            ` : isPaidOrder(order)
              ? `<p style="color:#16a34a; font-size:13px; font-weight:600;"><i class="fa-solid fa-circle-check"></i> ${getAdminOrderStatusMeta(order).actionText}</p>`
              : `<p style="color:#d97706; font-size:13px; font-weight:600;"><i class="fa-solid fa-clock"></i> Awaiting Customer Payment</p>`}
          </div>
        </div>
      </div>
    `).join("");
  }

  function filterOrders(type) {
    document.querySelectorAll(".filter-btn").forEach(btn => btn.classList.remove("active-filter"));
    document.getElementById(`filter-${type}`).classList.add("active-filter");
    let filtered = allOrders;
    if (type === "pending") filtered = allOrders.filter(o => isPendingCustomerOrder(o));
    if (type === "paid") filtered = allOrders.filter(o => isPaidOnSiteOrder(o));
    if (type === "cash") filtered = allOrders.filter(o => isCashOnDeliveryOrder(o));
    renderOrders(filtered);
  }
  window.filterOrders = filterOrders;

  window.markAsPaid = async function(orderId, btn) {
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Processing...';
    try {
      const res = await fetch(`${API}/admin/orders/${orderId}/paid`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" }
      });
      const result = await res.json();
      if (res.ok) {
        const card = document.getElementById(`card-${orderId}`);
        card.classList.remove("status-pending");
        card.classList.add("status-paid");
        btn.parentElement.innerHTML = `<p style="color:#16a34a; font-size:13px; font-weight:600;"><i class="fa-solid fa-circle-check"></i> Cash Received</p>`;
        const badge = card.querySelector(".status-badge");
        if (badge) { badge.className = "status-badge paid"; badge.innerHTML = '<i class="fa-solid fa-money-bill-wave"></i> Paid on Delivery'; }
        const order = allOrders.find(o => o._id === orderId);
        if (order) order.paymentStatus = "paid";
      } else {
        btn.disabled = false;
        btn.innerHTML = '<i class="fa-solid fa-money-bill-wave"></i> Confirm Cash Received';
        alert(result.message || "Failed to update order.");
      }
    } catch (err) {
      btn.disabled = false;
      btn.innerHTML = '<i class="fa-solid fa-money-bill-wave"></i> Confirm Cash Received';
      alert("Could not connect to server.");
    }
  };

  const _dashController = new AbortController();
  setTimeout(() => _dashController.abort(), 8000);
  fetch(`${API}/admin/orders`, { signal: _dashController.signal })
    .then(res => res.json())
    .then(data => {
      document.getElementById("loading-orders").style.display = "none";
      allOrders = data.orders || [];
      document.getElementById("stat-total").textContent = allOrders.length;
      document.getElementById("stat-pending").textContent = allOrders.filter(o => isPendingCustomerOrder(o)).length;
      document.getElementById("stat-paid").textContent = allOrders.filter(o => isPaidOnSiteOrder(o)).length;
      document.getElementById("stat-cod").textContent = allOrders.filter(o => isCashOnDeliveryOrder(o)).length;
      renderOrders(allOrders);
    })
    .catch(() => {
      document.getElementById("loading-orders").style.display = "none";
      ordersList.innerHTML = `<div style="text-align:center; padding:60px; color:var(--text-muted);"><i class="fa-solid fa-box-open" style="font-size:48px; margin-bottom:16px; display:block;"></i><h3 style="margin-bottom:8px;">No Orders Yet</h3><p>No orders found or the server could not be reached.</p></div>`;
    });
}


// ============================================
// ANALYTICS
// ============================================
let analyticsData = null;
let currentPeriod = 'today';

function showPeriod(period) {
  currentPeriod = period;
  document.querySelectorAll('[id^="tab-"]').forEach(btn => btn.classList.remove("active-filter"));
  document.getElementById(`tab-${period}`).classList.add("active-filter");

  const customRange = document.getElementById("custom-range");
  if (period === 'custom') { customRange.style.display = "block"; return; }
  customRange.style.display = "none";

  if (!analyticsData) return;

  const d = analyticsData[period];
  const periodLabels = { today: "Today", week: "This Week", month: "This Month", year: "This Year" };
  const compKeys = { today: "lastWeek", week: "lastWeek", month: "lastMonth", year: "lastYear" };

  document.getElementById("online-paid-total").textContent = `GH₵${d.online.paid.toFixed(2)}`;
  document.getElementById("online-paid-count").innerHTML = `<i class="fa-solid fa-circle-check"></i> ${d.online.paidCount} paid`;
  document.getElementById("online-pending-total").innerHTML = `<i class="fa-solid fa-clock"></i> GH₵${d.online.pending.toFixed(2)} pending`;
  document.getElementById("online-pending-count").textContent = `${d.online.pendingCount} pending orders`;
  document.getElementById("waybill-total").textContent = `GH₵${d.waybills.total.toFixed(2)}`;
  document.getElementById("waybill-count").textContent = `${d.waybills.count} deliveries`;
  document.getElementById("invoice-paid-total").textContent = `GH₵${d.online.paid.toFixed(2)}`;
  document.getElementById("invoice-paid-count").innerHTML = `<i class="fa-solid fa-circle-check"></i> ${d.online.paidCount} paid invoices`;
  document.getElementById("invoice-pending-total").innerHTML = `<i class="fa-solid fa-clock"></i> GH₵${d.online.pending.toFixed(2)} unpaid`;
  document.getElementById("grand-total").textContent = `GH₵${d.grandTotal.toFixed(2)}`;
  document.getElementById("period-label").textContent = `Showing: ${periodLabels[period]}`;

  const prev = analyticsData[compKeys[period]];
  const prevTotal = (prev?.online?.paid || 0) + (prev?.waybills?.total || 0);
  const diff = d.grandTotal - prevTotal;
  const pct = prevTotal > 0 ? ((diff / prevTotal) * 100).toFixed(1) : 0;
  const isProfit = diff >= 0;

  document.getElementById("profit-icon").className = `fa-solid fa-arrow-${isProfit ? 'up' : 'down'}`;
  document.getElementById("profit-icon").style.color = isProfit ? '#86efac' : '#fca5a5';
  document.getElementById("profit-text").textContent = isProfit
    ? `+GH₵${diff.toFixed(2)} (${pct}%) vs previous period`
    : `-GH₵${Math.abs(diff).toFixed(2)} (${Math.abs(pct)}%) vs previous period`;
}

async function fetchCustomRange() {
  const from = document.getElementById("custom-from").value;
  const to = document.getElementById("custom-to").value;
  if (!from || !to) { alert("Please select both dates"); return; }

  const [ordersRes, waybillsRes] = await Promise.all([
    fetch(`${API}/admin/analytics/custom?from=${from}&to=${to}`),
    fetch(`${API}/admin/analytics/custom-waybills?from=${from}&to=${to}`)
  ]);

  const ordersData = await ordersRes.json();
  const waybillsData = await waybillsRes.json();

  document.getElementById("custom-result").style.display = "grid";
  document.getElementById("custom-online-total").textContent = `GH₵${ordersData.total.toFixed(2)}`;
  document.getElementById("custom-online-count").textContent = `${ordersData.count} orders`;
  document.getElementById("custom-waybill-total").textContent = `GH₵${waybillsData.total.toFixed(2)}`;
  document.getElementById("custom-waybill-count").textContent = `${waybillsData.count} waybills`;
  document.getElementById("custom-grand-total").textContent = `GH₵${(ordersData.total + waybillsData.total).toFixed(2)}`;
}

window.fetchCustomRange = fetchCustomRange;
window.showPeriod = showPeriod;

fetch(`${API}/admin/analytics`)
  .then(res => res.json())
  .then(data => {
    analyticsData = data;
    document.getElementById("analytics-loading").style.display = "none";
    document.getElementById("analytics-content").style.display = "block";
    showPeriod('today');

    const ctx = document.getElementById("revenueChart").getContext("2d");
    new Chart(ctx, {
      type: 'bar',
      data: {
        labels: data.monthlyData.map(m => m.month),
        datasets: [
          { label: 'Online Orders', data: data.monthlyData.map(m => m.orders), backgroundColor: 'rgba(26, 111, 196, 0.7)', borderColor: '#1a6fc4', borderWidth: 1, borderRadius: 4 },
          { label: 'Waybills', data: data.monthlyData.map(m => m.waybills), backgroundColor: 'rgba(245, 158, 11, 0.7)', borderColor: '#f59e0b', borderWidth: 1, borderRadius: 4 }
        ]
      },
      options: {
        responsive: true,
        plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => `GH₵${ctx.raw.toFixed(2)}` } } },
        scales: { x: { stacked: false }, y: { beginAtZero: true, ticks: { callback: val => `GH₵${val}` } } }
      }
    });
  })
  .catch(() => {
    const analyticsLoadingEl = document.getElementById("analytics-loading");
    if (analyticsLoadingEl) {
      analyticsLoadingEl.innerHTML = `<p style="color:red;">Could not load analytics.</p>`;
    }


  // ============================================
  // ADMIN ORDERS PAGE
  // ============================================
  const adminOrdersList = document.getElementById("admin-orders-list");

  if (adminOrdersList) {
    const _aoToken = localStorage.getItem("staff-token");
    const _aoRole = localStorage.getItem("staff-role");
    const _aoName = localStorage.getItem("staff-name");

    if (!_aoToken || _aoRole !== "admin") { alert("Admin access only!"); window.location.href = "staff-login.html"; }

    const _aoWelcome = document.getElementById("staff-welcome");
    if (_aoWelcome) _aoWelcome.textContent = _aoName;

    const _aoLogout = document.getElementById("staff-logout-btn");
    if (_aoLogout) {
      _aoLogout.addEventListener("click", (e) => {
        e.preventDefault();
        localStorage.removeItem("staff-token");
        localStorage.removeItem("staff-name");
        localStorage.removeItem("staff-role");
        window.location.href = "staff-login.html";
      });
    }

    let allAoOrders = [];
    const aoProductNames = { "sachet-water": "Sachet Water - 500ml", "bulk-purchase": "Sachet Water - Bulk Purchase" };
    const validAdminOrderViews = ["all", "pending", "paid", "cash"];

    function getAdminOrdersView() {
      const params = new URLSearchParams(window.location.search);
      const view = params.get("view");
      return validAdminOrderViews.includes(view) ? view : "all";
    }

    function updateAdminOrdersUrl(type) {
      const url = new URL(window.location.href);
      url.searchParams.set("view", type);
      window.history.replaceState({}, "", url.toString());
    }

    function renderAdminOrders(orders) {
      document.getElementById("ao-loading").style.display = "none";
      if (orders.length === 0) {
        adminOrdersList.innerHTML = `<div style="text-align:center; padding:60px; color:var(--text-muted);"><i class="fa-solid fa-box-open" style="font-size:48px; margin-bottom:16px; display:block;"></i><h3 style="margin-bottom:8px;">No Orders Found</h3><p>No customer orders yet.</p></div>`;
        return;
      }
      adminOrdersList.innerHTML = orders.map(order => `
        <div class="admin-order-card status-${order.paymentStatus || 'pending'}" id="ao-card-${order._id}">
          <div style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:12px;">
            <div>
              <div style="display:flex; align-items:center; gap:12px; margin-bottom:8px;">
                <h3 style="font-family:'Playfair Display',serif; font-size:16px;">${order.name}</h3>
                <span class="status-badge ${getAdminOrderStatusMeta(order).badgeClass}">
                  <i class="fa-solid fa-${getAdminOrderStatusMeta(order).icon}"></i>
                  ${getAdminOrderStatusMeta(order).text}
                </span>
              </div>
              <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(160px,1fr)); gap:8px; font-size:13px; color:var(--text-muted);">
                <p><i class="fa-solid fa-phone" style="color:var(--blue-mid); margin-right:4px;"></i>${order.phone}</p>
                <p><i class="fa-regular fa-envelope" style="color:var(--blue-mid); margin-right:4px;"></i>${order.email}</p>
                <p><i class="fa-solid fa-box" style="color:var(--blue-mid); margin-right:4px;"></i>${aoProductNames[order.product] || order.product} × ${order.quantity}</p>
                <p><i class="fa-solid fa-calendar" style="color:var(--blue-mid); margin-right:4px;"></i>${new Date(order.delivery).toDateString()}</p>
                <p><i class="fa-solid fa-location-dot" style="color:var(--blue-mid); margin-right:4px;"></i>${order.district || ""}, ${order.region || ""}</p>
                <p><i class="fa-solid fa-credit-card" style="color:var(--blue-mid); margin-right:4px;"></i>${order.paymentMethod || "Not specified"}</p>
              </div>
            </div>
            <div style="display:flex; flex-direction:column; align-items:flex-end; gap:8px;">
              <p style="font-size:18px; font-weight:700; color:var(--blue-deep);">${order.total || "N/A"}</p>
              <p style="font-size:12px; color:var(--text-muted);">${new Date(order.createdAt).toDateString()}</p>
              ${isCashOnDeliveryOrder(order) && !isPaidOrder(order) ? `
                <button class="mark-paid-btn" onclick="markAoOrderPaid('${order._id}', this)">
                  <i class="fa-solid fa-money-bill-wave"></i> Confirm Cash Received
                </button>
              ` : isPaidOrder(order)
                ? `<p style="color:#16a34a; font-size:13px; font-weight:600;"><i class="fa-solid fa-circle-check"></i> ${getAdminOrderStatusMeta(order).actionText}</p>`
                : `<p style="color:#d97706; font-size:13px; font-weight:600;"><i class="fa-solid fa-clock"></i> Awaiting Customer Payment</p>`}
            </div>
          </div>
        </div>
      `).join("");
    }

    window.filterAdminOrders = function(type) {
      const safeType = validAdminOrderViews.includes(type) ? type : "all";
      document.querySelectorAll("[id^='ao-filter-']").forEach(btn => btn.classList.remove("active-filter"));
      document.getElementById(`ao-filter-${safeType}`).classList.add("active-filter");
      let filtered = allAoOrders;
      if (safeType === "pending") filtered = allAoOrders.filter(o => isPendingCustomerOrder(o));
      if (safeType === "paid") filtered = allAoOrders.filter(o => isPaidOnSiteOrder(o));
      if (safeType === "cash") filtered = allAoOrders.filter(o => isCashOnDeliveryOrder(o));
      updateAdminOrdersUrl(safeType);
      renderAdminOrders(filtered);
    };

    window.markAoOrderPaid = async function(orderId, btn) {
      btn.disabled = true;
      btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Processing...';
      try {
        const res = await fetch(`${API}/admin/orders/${orderId}/paid`, { method: "PATCH", headers: { "Content-Type": "application/json" } });
        const result = await res.json();
        if (res.ok) {
          const card = document.getElementById(`ao-card-${orderId}`);
          card.classList.remove("status-pending");
          card.classList.add("status-paid");
          btn.parentElement.innerHTML = `<p style="color:#16a34a; font-size:13px; font-weight:600;"><i class="fa-solid fa-circle-check"></i> Cash Received</p>`;
          const badge = card.querySelector(".status-badge");
          if (badge) { badge.className = "status-badge paid"; badge.innerHTML = '<i class="fa-solid fa-money-bill-wave"></i> Paid on Delivery'; }
          const order = allAoOrders.find(o => o._id === orderId);
          if (order) order.paymentStatus = "paid";
        } else {
          btn.disabled = false;
          btn.innerHTML = '<i class="fa-solid fa-money-bill-wave"></i> Confirm Cash Received';
          alert(result.message || "Failed to update order.");
        }
      } catch (err) {
        btn.disabled = false;
        btn.innerHTML = '<i class="fa-solid fa-money-bill-wave"></i> Confirm Cash Received';
        alert("Could not connect to server.");
      }
    };

    const _aoCtrl = new AbortController();
    setTimeout(() => _aoCtrl.abort(), 8000);
    fetch(`${API}/admin/orders`, { signal: _aoCtrl.signal })
      .then(res => res.json())
      .then(data => {
        allAoOrders = data.orders || [];
        window.filterAdminOrders(getAdminOrdersView());
      })
      .catch(() => {
        document.getElementById("ao-loading").style.display = "none";
        adminOrdersList.innerHTML = `<div style="text-align:center; padding:60px; color:var(--text-muted);"><i class="fa-solid fa-box-open" style="font-size:48px; margin-bottom:16px; display:block;"></i><h3 style="margin-bottom:8px;">No Orders Found</h3><p>No orders yet or server could not be reached.</p></div>`;
      });
  }


  // ============================================
  // ADMIN INVOICES PAGE
  // ============================================
  const invoicesContainer = document.getElementById("invoices-container");

  if (invoicesContainer) {
    const _invToken = localStorage.getItem("staff-token");
    const _invRole = localStorage.getItem("staff-role");
    const _invName = localStorage.getItem("staff-name");

    if (!_invToken || _invRole !== "admin") { alert("Admin access only!"); window.location.href = "staff-login.html"; }

    const _invWelcome = document.getElementById("staff-welcome");
    if (_invWelcome) _invWelcome.textContent = _invName;

    const _invLogout = document.getElementById("staff-logout-btn");
    if (_invLogout) {
      _invLogout.addEventListener("click", (e) => {
        e.preventDefault();
        localStorage.removeItem("staff-token");
        localStorage.removeItem("staff-name");
        localStorage.removeItem("staff-role");
        window.location.href = "staff-login.html";
      });
    }

    let allInvoices = [];

    function isSentSupervisorInvoice(invoice) {
      return invoice?.emailSent === true;
    }

    function renderInvoices(invoices) {
      document.getElementById("inv-loading").style.display = "none";
      if (invoices.length === 0) {
        invoicesContainer.innerHTML = `<div style="text-align:center; padding:60px; color:var(--text-muted);"><i class="fa-solid fa-file-invoice" style="font-size:48px; margin-bottom:16px; display:block;"></i><h3 style="margin-bottom:8px;">No Invoices Found</h3><p>No supervisor invoices have been submitted yet.</p></div>`;
        return;
      }
      invoicesContainer.innerHTML = invoices.map(invoice => {
        const invoiceNumber = invoice.waybillNumber || `INV-${String(invoice._id || "").slice(-6).toUpperCase()}`;
        const invoiceDate = invoice.date ? new Date(invoice.date) : new Date(invoice.createdAt || Date.now());
        const isSent = isSentSupervisorInvoice(invoice);
        return `
          <div style="background:var(--white); border-radius:var(--radius-lg); padding:28px; box-shadow:var(--shadow-sm); margin-bottom:20px; border-left:4px solid ${isSent ? '#16a34a' : '#d97706'};">
            <div style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:12px; margin-bottom:16px; padding-bottom:16px; border-bottom:1.5px solid var(--border);">
              <div>
                <p style="font-size:13px; color:var(--text-muted); margin-bottom:4px;">Invoice No</p>
                <p style="font-size:16px; font-weight:700; color:var(--blue-deep); font-family:'Playfair Display',serif;">${invoiceNumber}</p>
              </div>
              <div>
                <p style="font-size:13px; color:var(--text-muted); margin-bottom:4px;">Date</p>
                <p style="font-size:14px; font-weight:600;">${invoiceDate.toDateString()}</p>
              </div>
              <div>
                <p style="font-size:13px; color:var(--text-muted); margin-bottom:4px;">Supervisor</p>
                <p style="font-size:14px; font-weight:600;">${invoice.submittedBy || 'Unknown Supervisor'}</p>
                <p style="font-size:13px; color:var(--text-muted);">Driver: ${invoice.driverName || 'Not specified'}</p>
              </div>
              <div style="text-align:right;">
                <span class="status-badge ${isSent ? 'paid' : 'pending'}" style="margin-bottom:6px; display:inline-block;">
                  <i class="fa-solid fa-${isSent ? 'paper-plane' : 'clock'}"></i>
                  ${isSent ? 'Sent to Email' : 'Awaiting Send'}
                </span>
                <p style="font-size:13px; color:var(--text-muted);">Vehicle: ${invoice.carNumber || 'Not specified'}</p>
              </div>
            </div>
            <div style="display:grid; grid-template-columns:2fr 1fr 1fr; gap:8px; font-size:13px; font-weight:600; color:var(--text-muted); padding-bottom:8px; border-bottom:1px solid var(--border); margin-bottom:8px;">
              <span>Description</span><span style="text-align:center;">Qty</span><span style="text-align:right;">Amount</span>
            </div>
            <div style="display:grid; grid-template-columns:2fr 1fr 1fr; gap:8px; font-size:14px; padding-bottom:12px; border-bottom:1px solid var(--border); margin-bottom:12px;">
              <span>${invoice.description || 'Delivery Invoice'}</span>
              <span style="text-align:center;">${invoice.quantity || 'N/A'}</span>
              <span style="text-align:right;">GH₵${Number(invoice.amount || 0).toFixed(2)}</span>
            </div>
            <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(220px, 1fr)); gap:12px; font-size:13px; color:var(--text-muted); margin-bottom:12px;">
              <p><strong style="color:var(--text-dark);">Bill To:</strong> ${invoice.to || 'Not specified'}</p>
              <p><strong style="color:var(--text-dark);">Address:</strong> ${invoice.address || 'Not specified'}</p>
              <p><strong style="color:var(--text-dark);">Despatched By:</strong> ${invoice.despatchedBy || 'Not specified'}</p>
              <p><strong style="color:var(--text-dark);">Received By:</strong> ${invoice.receivedBy || 'Pending'}</p>
              <p><strong style="color:var(--text-dark);">Email Sent At:</strong> ${invoice.emailSentAt ? new Date(invoice.emailSentAt).toDateString() : 'Not sent yet'}</p>
            </div>
            <div style="display:flex; justify-content:space-between; align-items:flex-end; gap:16px; flex-wrap:wrap;">
              <div style="font-size:13px; color:var(--text-muted); max-width:760px;">
                <p><strong style="color:var(--text-dark);">Remarks:</strong> ${invoice.remarks || 'No remarks added.'}</p>
              </div>
              <div style="text-align:right;">
                <p style="font-size:13px; color:var(--text-muted); margin-bottom:4px;">Invoice Total</p>
                <p style="font-size:18px; font-weight:700; color:var(--blue-deep);">GH₵${Number(invoice.amount || 0).toFixed(2)}</p>
              </div>
            </div>
          </div>
        `;
      }).join("");
    }

    window.filterInvoices = function(type) {
      document.querySelectorAll("[id^='inv-filter-']").forEach(btn => btn.classList.remove("active-filter"));
      document.getElementById(`inv-filter-${type}`).classList.add("active-filter");
      let filtered = allInvoices;
      if (type === "awaiting") filtered = allInvoices.filter(invoice => !isSentSupervisorInvoice(invoice));
      if (type === "sent") filtered = allInvoices.filter(invoice => isSentSupervisorInvoice(invoice));
      renderInvoices(filtered);
    };

    const _invCtrl = new AbortController();
    setTimeout(() => _invCtrl.abort(), 8000);
    fetch(`${API}/waybills`, { signal: _invCtrl.signal })
      .then(res => res.json())
      .then(data => {
        allInvoices = data.waybills || [];
        renderInvoices(allInvoices);
      })
      .catch(() => {
        document.getElementById("inv-loading").style.display = "none";
        invoicesContainer.innerHTML = `<div style="text-align:center; padding:60px; color:var(--text-muted);"><i class="fa-solid fa-file-invoice" style="font-size:48px; margin-bottom:16px; display:block;"></i><h3 style="margin-bottom:8px;">No Invoices Found</h3><p>No supervisor invoices were found or the server could not be reached.</p></div>`;
      });
  }


  // ============================================
  // ADMIN PROFITS PAGE
  // ============================================
  const profitsContent = document.getElementById("profits-content");

  if (profitsContent) {
    const _profitToken = localStorage.getItem("staff-token");
    const _profitRole = localStorage.getItem("staff-role");
    const _profitName = localStorage.getItem("staff-name");

    if (!_profitToken || _profitRole !== "admin") { alert("Admin access only!"); window.location.href = "staff-login.html"; }

    const _profitWelcome = document.getElementById("staff-welcome");
    if (_profitWelcome) _profitWelcome.textContent = _profitName;

    const _profitLogout = document.getElementById("staff-logout-btn");
    if (_profitLogout) {
      _profitLogout.addEventListener("click", (e) => {
        e.preventDefault();
        localStorage.removeItem("staff-token");
        localStorage.removeItem("staff-name");
        localStorage.removeItem("staff-role");
        window.location.href = "staff-login.html";
      });
    }

    let profitsData = null;
    let activeProfitPeriod = "today";

    const periodLabels = {
      today: "Daily",
      week: "Weekly",
      month: "Monthly",
      year: "Yearly"
    };

    function renderProfitPeriod(period) {
      if (!profitsData || !profitsData[period]) return;

      activeProfitPeriod = period;
      const d = profitsData[period];
      const trend = profitsData.trends?.[period] || { change: 0, changePct: 0, trend: "profit" };
      const isProfit = trend.trend !== "loss";

      document.querySelectorAll("[id^='profit-tab-']").forEach(btn => btn.classList.remove("active-filter"));
      document.getElementById(`profit-tab-${period}`).classList.add("active-filter");

      document.getElementById("profit-total").textContent = `GH₵${d.grandTotal.toFixed(2)}`;
      document.getElementById("profit-orders").textContent = `GH₵${d.online.paid.toFixed(2)}`;
      document.getElementById("profit-orders-count").textContent = `${d.online.paidCount} paid orders`;
      document.getElementById("profit-waybills").textContent = `GH₵${d.waybills.total.toFixed(2)}`;
      document.getElementById("profit-waybills-count").textContent = `${d.waybills.count} sent waybills`;
      document.getElementById("profit-period-label").textContent = `Showing: ${periodLabels[period]}`;

      document.getElementById("profit-trend").textContent = isProfit ? "Profit" : "Loss";
      document.getElementById("profit-trend").style.color = isProfit ? "#86efac" : "#fecaca";
      const sign = trend.change >= 0 ? "+" : "-";
      document.getElementById("profit-trend-text").textContent = `${sign}GH₵${Math.abs(trend.change).toFixed(2)} (${Math.abs(trend.changePct).toFixed(1)}%) vs previous period`;
    }

    window.showProfitPeriod = function(period) {
      renderProfitPeriod(period);
    };

    fetch(`${API}/admin/profits`)
      .then(res => res.json())
      .then(data => {
        profitsData = data;
        document.getElementById("profits-loading").style.display = "none";
        profitsContent.style.display = "block";

        renderProfitPeriod(activeProfitPeriod);

        const chartEl = document.getElementById("profitChart");
        if (chartEl && data.monthlyData) {
          const ctx = chartEl.getContext("2d");
          new Chart(ctx, {
            type: "line",
            data: {
              labels: data.monthlyData.map(m => m.month),
              datasets: [
                {
                  label: "Total Profit",
                  data: data.monthlyData.map(m => m.total),
                  borderColor: "#1a6fc4",
                  backgroundColor: "rgba(26, 111, 196, 0.15)",
                  tension: 0.35,
                  fill: true,
                  pointRadius: 4,
                  pointHoverRadius: 6
                }
              ]
            },
            options: {
              responsive: true,
              plugins: {
                legend: { display: false },
                tooltip: { callbacks: { label: ctx => `GH₵${Number(ctx.raw).toFixed(2)}` } }
              },
              scales: {
                y: { beginAtZero: true, ticks: { callback: val => `GH₵${val}` } }
              }
            }
          });
        }
      })
      .catch(() => {
        document.getElementById("profits-loading").innerHTML = `<p style="color:red;">Could not load profit analytics.</p>`;
      });
  }
  });