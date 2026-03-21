const API = "https://white-water-wells.onrender.com";

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

// AUTH STATE
const token = localStorage.getItem("token");
const username = localStorage.getItem("username");
const logoutBtn = document.getElementById("logout-btn");

if (token && logoutBtn) {
  const loginLink = document.querySelector('.dropdown-menu a[href="login.html"]');
  const signupLink = document.querySelector('.dropdown-menu a[href="sign.html"]');
  if (loginLink) loginLink.style.display = "none";
  if (signupLink) signupLink.style.display = "none";
  logoutBtn.style.display = "flex";

  const dropdownBtn = document.querySelector(".dropdown-btn");
  if (dropdownBtn) {
    dropdownBtn.innerHTML = `<i class="fa-regular fa-circle-user"></i> ${username} <i class="fa-solid fa-chevron-down dropdown-arrow"></i>`;
  }
}

if (logoutBtn) {
  logoutBtn.addEventListener("click", (e) => {
    e.preventDefault();
    localStorage.removeItem("token");
    localStorage.removeItem("username");
    localStorage.removeItem("email");
    window.location.href = "../index.html";
  });
}

// Bulk-purchase automation
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

// Check URL parameters on page load
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
        localStorage.setItem("email", email);
        localStorage.setItem("token", result.token);
        localStorage.setItem("username", fullName);
        showMessage("signup-message", `Welcome to White Water Wells LTD, ${fullName}! Redirecting...`, "success");
        setTimeout(() => { window.location.href = "../index.html"; }, 2000);
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
        localStorage.setItem("email", email);
        localStorage.setItem("token", result.token);
        localStorage.setItem("username", result.user?.fullName || email);
        window.location.href = "../index.html";
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
    if (!orderType) { document.getElementById("order-type").classList.add("input-error"); document.getElementById("err-ordertype").classList.add("show"); hasError = true; }
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

    localStorage.setItem("pendingOrder", JSON.stringify(orderData));
    window.location.href = "payment.html";
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
        if (res.ok) { localStorage.setItem("reset-email", verifiedEmail); window.location.href = "reset-password.html"; }
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

    if (newPassword.length < 8 || !/[A-Z]/.test(newPassword) || !/[0-9]/.test(newPassword)) { document.getElementById("err-reset").textContent = "Please make sure your password meets all requirements!"; document.getElementById("err-reset").classList.add("show"); return; }
    if (newPassword !== confirmPassword) { document.getElementById("err-reset").textContent = "Passwords do not match!"; document.getElementById("err-reset").classList.add("show"); return; }

    try {
      const res = await fetch(`${API}/reset-password`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, newPassword }) });
      const result = await res.json();
      if (res.ok) { localStorage.removeItem("reset-email"); window.location.href = "../index.html"; }
      else { document.getElementById("err-reset").textContent = result.message || "Reset failed. Please try again."; document.getElementById("err-reset").classList.add("show"); }
    } catch (err) { document.getElementById("err-reset").textContent = "Could not connect to server."; document.getElementById("err-reset").classList.add("show"); }
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

    fetch(`${process.env.API}/orders/${email}`)
      .then(res => res.json())
      .then(data => {
        document.getElementById("loading").style.display = "none";
        if (!data.orders || data.orders.length === 0) { document.getElementById("no-orders").style.display = "block"; return; }

        data.orders.forEach(order => {
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
            </div>
          `;
        });
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
let selectedPayment = null;

function selectPayment(method) {
  document.querySelectorAll(".payment-option").forEach(el => el.classList.remove("selected"));
  document.querySelectorAll(".payment-details").forEach(el => el.style.display = "none");
  document.getElementById(`${method}-option`).classList.add("selected");
  document.getElementById(`${method}-details`).style.display = "block";
  selectedPayment = method;
}

function confirmPayment() {
  const errPayment = document.getElementById("err-payment");

  if (!selectedPayment) { errPayment.textContent = "Please select a payment method."; errPayment.classList.add("show"); return; }

  let transactionId = "";
  if (selectedPayment === "mtn") transactionId = document.getElementById("mtn-transaction").value;
  if (selectedPayment === "vodafone") transactionId = document.getElementById("vodafone-transaction").value;
  if (selectedPayment === "airteltigo") transactionId = document.getElementById("airteltigo-transaction").value;

  if ((selectedPayment === "mtn" || selectedPayment === "vodafone" || selectedPayment === "airteltigo") && !transactionId) {
    errPayment.textContent = "Please enter your transaction ID."; errPayment.classList.add("show"); return;
  }

  const order = JSON.parse(localStorage.getItem("pendingOrder"));
  if (!order) { window.location.href = "order.html"; return; }

  const paymentNames = { mtn: "MTN Mobile Money", vodafone: "Vodafone Cash", airteltigo: "AirtelTigo Money", card: "Card Payment", cash: "Cash on Delivery" };
  order.paymentMethod = paymentNames[selectedPayment];
  order.transactionId = transactionId;

  fetch(`${process.env.API}/order`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(order)
  })
  .then(res => res.json())
  .then(result => {
    if (result.order) {
      localStorage.setItem("lastOrderId", result.order._id);
      localStorage.removeItem("pendingOrder");
      window.location.href = "order-confirmation.html";
    } else {
      errPayment.textContent = result.message || "Something went wrong. Please try again.";
      errPayment.classList.add("show");
    }
  })
  .catch(() => { errPayment.textContent = "Could not connect to server. Make sure the server is running."; errPayment.classList.add("show"); });
}

const summaryDetails = document.getElementById("summary-details");
if (summaryDetails) {
  const order = JSON.parse(localStorage.getItem("pendingOrder"));
  if (!order) { window.location.href = "order.html"; }
  else {
    const productNames = { "sachet-water": "Sachet Water - 500ml", "bulk-purchase": "Sachet Water - Bulk Purchase" };
    summaryDetails.innerHTML = `
      <p><strong>Name:</strong> ${order.name}</p>
      <p><strong>Product:</strong> ${productNames[order.product] || order.product}</p>
      <p><strong>Quantity:</strong> ${order.quantity} bag(s)</p>
      <p><strong>Delivery:</strong> ${new Date(order.delivery).toDateString()}</p>
      <p><strong>Address:</strong> ${order.streetAddress}, ${order.district}, ${order.region}</p>
      <p style="font-size:16px; font-weight:700; color:var(--blue-deep); margin-top:8px;"><strong>Total:</strong> ${order.total}</p>
    `;
  }
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
        localStorage.setItem("staff-token", result.token);
        localStorage.setItem("staff-name", result.user.fullName);
        localStorage.setItem("staff-role", result.user.role);
        if (result.user.role === "admin") {
          window.location.href = "admin-dashboard.html";
        } else {
          window.location.href = "waybill.html";
        }
      } else if (res.status === 403) {
        document.getElementById("err-staff-login").textContent = "Access denied. Staff emails only (@whitewatersghana.com)";
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
  if (welcomeEl && staffName) welcomeEl.textContent = `Welcome, ${staffName} (${staffRole})`;

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
  fetch(`${process.env.API}/waybills/count`)
    .then(res => res.json())
    .then(data => {
      waybillNum = `WWW2026${String(data.count + 1).padStart(4, "0")}`;
      document.getElementById("waybill-number").textContent = waybillNum;
    });

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
    const amount = document.getElementById("waybill-amount").value;
if (!amount || amount <= 0) { 
  document.getElementById("waybill-amount").classList.add("input-error"); 
  document.getElementById("err-amount").classList.add("show"); 
  hasError = true; 
}

    let hasError = false;
    if (!to) { document.getElementById("to").classList.add("input-error"); document.getElementById("err-to").classList.add("show"); hasError = true; }
    if (!driverName) { document.getElementById("driver-name").classList.add("input-error"); document.getElementById("err-driver").classList.add("show"); hasError = true; }
    if (!address) { document.getElementById("address").classList.add("input-error"); document.getElementById("err-address").classList.add("show"); hasError = true; }
    if (!carNumber) { document.getElementById("car-number").classList.add("input-error"); document.getElementById("err-car").classList.add("show"); hasError = true; }
    if (!date) { document.getElementById("waybill-date").classList.add("input-error"); document.getElementById("err-date").classList.add("show"); hasError = true; }
    if (!quantity || !description) { document.getElementById("err-items").classList.add("show"); hasError = true; }
    if (!despatchedBy) { document.getElementById("despatched-by").classList.add("input-error"); document.getElementById("err-despatched").classList.add("show"); hasError = true; }
    if (hasError) return;

    const submitBtn = waybillForm.querySelector(".submit-btn");
    submitBtn.disabled = true;
    submitBtn.innerHTML = "Submitting...";

    try {
      const res = await fetch(`${API}/waybill`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${staffToken}` },
        body: JSON.stringify({ to, driverName, address, carNumber, date, quantity, description, remarks, despatchedBy, receivedBy, driverSignature, waybillNumber: waybillNum, submittedBy: staffName })
      });

      const result = await res.json();

      if (res.ok) {
        document.getElementById("waybill-success").style.display = "block";
        waybillForm.reset();
        document.getElementById("waybill-date").value = new Date().toISOString().split("T")[0];
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
body: JSON.stringify({
  to, driverName, address, carNumber, date,
  quantity, description, remarks,
  despatchedBy, receivedBy, driverSignature,
  waybillNumber: waybillNum, submittedBy: staffName,
  amount: parseFloat(document.getElementById("waybill-amount").value) || 0
})

// ============================================
// ORDER CONFIRMATION PAGE
// ============================================
const confirmationContent = document.getElementById("confirmation-content");

if (confirmationContent) {
  const orderId = localStorage.getItem("lastOrderId");

  if (!orderId) { window.location.href = "order.html"; }
  else {
    const productNames = { "sachet-water": "Sachet Water - 500ml", "bulk-purchase": "Sachet Water - Bulk Purchase" };
    const discountMap = { "weekly": 10, "biweekly": 15, "monthly": 20, "one-time": 0 };

    fetch(`${process.env.API}/order/${orderId}`)
      .then(res => res.json())
      .then(data => {
        document.getElementById("loading").style.display = "none";
        confirmationContent.style.display = "block";

        const order = data.order;
        const unitPrice = 7;
        const subtotal = unitPrice * order.quantity;
        const discount = discountMap[order.orderType] || 0;
        const discountAmount = (subtotal * discount) / 100;
        const deliveryFee = 100;
        const grandTotal = subtotal - discountAmount + deliveryFee;
        const date = new Date(order.createdAt);

        document.getElementById("invoice-number").textContent = `Invoice No: WWW${String(order._id).slice(-4).toUpperCase()}`;
        document.getElementById("invoice-date").textContent = `Date: ${date.toDateString()}`;
        document.getElementById("invoice-name").textContent = order.name;
        document.getElementById("invoice-address").textContent = `${order.streetAddress}, ${order.district}, ${order.region}`;
        document.getElementById("invoice-phone").textContent = `Phone: ${order.phone}`;
        document.getElementById("invoice-email").textContent = `Email: ${order.email}`;
        document.getElementById("invoice-items").innerHTML = `
          <span>${productNames[order.product] || order.product}</span>
          <span>${order.quantity}</span>
          <span>GH₵${unitPrice}.00</span>
          <span>GH₵${subtotal}.00</span>
        `;
        document.getElementById("invoice-subtotal").textContent = `GH₵${subtotal}.00`;
        document.getElementById("invoice-discount").textContent = `-GH₵${discountAmount}.00`;
        document.getElementById("invoice-total").textContent = `GH₵${grandTotal}.00`;
        document.getElementById("invoice-payment").textContent = order.paymentMethod || "To be confirmed";
        document.getElementById("invoice-delivery").textContent = new Date(order.delivery).toDateString();
      })
      .catch(() => {
        document.getElementById("loading").innerHTML = `<p style="color:red;">Could not load order. Make sure the server is running.</p>`;
      });
  }
}

function finalizeOrder() {
  localStorage.removeItem("lastOrderId");
  window.location.href = "../index.html";
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
  if (welcomeEl) welcomeEl.textContent = `Welcome, ${staffName}`;

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
              <span class="status-badge ${order.paymentStatus === 'paid' ? 'paid' : 'pending'}">
                <i class="fa-solid fa-${order.paymentStatus === 'paid' ? 'circle-check' : 'clock'}"></i>
                ${order.paymentStatus === 'paid' ? 'Paid' : 'Pending Payment'}
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
            ${order.paymentStatus !== 'paid' ? `
              <button class="mark-paid-btn" onclick="markAsPaid('${order._id}', this)">
                <i class="fa-solid fa-circle-check"></i> Mark as Paid
              </button>
            ` : `<p style="color:#16a34a; font-size:13px; font-weight:600;"><i class="fa-solid fa-circle-check"></i> Payment Confirmed</p>`}
          </div>
        </div>
      </div>
    `).join("");
  }

  function filterOrders(type) {
    document.querySelectorAll(".filter-btn").forEach(btn => btn.classList.remove("active-filter"));
    document.getElementById(`filter-${type}`).classList.add("active-filter");
    let filtered = allOrders;
    if (type === "pending") filtered = allOrders.filter(o => o.paymentStatus !== "paid");
    if (type === "paid") filtered = allOrders.filter(o => o.paymentStatus === "paid");
    if (type === "cash") filtered = allOrders.filter(o => o.paymentMethod === "Cash on Delivery");
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
        btn.parentElement.innerHTML = `<p style="color:#16a34a; font-size:13px; font-weight:600;"><i class="fa-solid fa-circle-check"></i> Payment Confirmed</p>`;
        const badge = card.querySelector(".status-badge");
        if (badge) { badge.className = "status-badge paid"; badge.innerHTML = '<i class="fa-solid fa-circle-check"></i> Paid'; }

        document.getElementById("stat-pending").textContent = parseInt(document.getElementById("stat-pending").textContent) - 1;
        document.getElementById("stat-paid").textContent = parseInt(document.getElementById("stat-paid").textContent) + 1;

        const order = allOrders.find(o => o._id === orderId);
        if (order) order.paymentStatus = "paid";
      } else {
        btn.disabled = false;
        btn.innerHTML = '<i class="fa-solid fa-circle-check"></i> Mark as Paid';
        alert(result.message || "Failed to update order.");
      }
    } catch (err) {
      btn.disabled = false;
      btn.innerHTML = '<i class="fa-solid fa-circle-check"></i> Mark as Paid';
      alert("Could not connect to server.");
    }
  };

  fetch(`${process.env.API}/admin/orders`)
    .then(res => res.json())
    .then(data => {
      document.getElementById("loading-orders").style.display = "none";
      allOrders = data.orders || [];

      document.getElementById("stat-total").textContent = allOrders.length;
      document.getElementById("stat-pending").textContent = allOrders.filter(o => o.paymentStatus !== "paid").length;
      document.getElementById("stat-paid").textContent = allOrders.filter(o => o.paymentStatus === "paid").length;
      document.getElementById("stat-cod").textContent = allOrders.filter(o => o.paymentMethod === "Cash on Delivery").length;

      renderOrders(allOrders);
    })
    .catch(() => {
      document.getElementById("loading-orders").innerHTML = `<p style="color:red; text-align:center;">Could not load orders. Make sure the server is running.</p>`;
    });
}
// ANALYTICS
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

  // Online orders
  document.getElementById("online-paid-total").textContent = `GH₵${d.online.paid.toFixed(2)}`;
  document.getElementById("online-paid-count").innerHTML = `<i class="fa-solid fa-circle-check"></i> ${d.online.paidCount} paid`;
  document.getElementById("online-pending-total").innerHTML = `<i class="fa-solid fa-clock"></i> GH₵${d.online.pending.toFixed(2)} pending`;
  document.getElementById("online-pending-count").textContent = `${d.online.pendingCount} pending orders`;

  // Waybills
  document.getElementById("waybill-total").textContent = `GH₵${d.waybills.total.toFixed(2)}`;
  document.getElementById("waybill-count").textContent = `${d.waybills.count} deliveries`;

  // Invoices (same as online orders)
  document.getElementById("invoice-paid-total").textContent = `GH₵${d.online.paid.toFixed(2)}`;
  document.getElementById("invoice-paid-count").innerHTML = `<i class="fa-solid fa-circle-check"></i> ${d.online.paidCount} paid invoices`;
  document.getElementById("invoice-pending-total").innerHTML = `<i class="fa-solid fa-clock"></i> GH₵${d.online.pending.toFixed(2)} unpaid`;

  // Grand total
  document.getElementById("grand-total").textContent = `GH₵${d.grandTotal.toFixed(2)}`;
  document.getElementById("period-label").textContent = `Showing: ${periodLabels[period]}`;

  // Profit comparison
  const prev = analyticsData[compKeys[period]];
  const prevTotal = prev.online + prev.waybills;
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

// Load analytics
fetch(`${API}/admin/analytics`)
  .then(res => res.json())
  .then(data => {
    analyticsData = data;
    document.getElementById("analytics-loading").style.display = "none";
    document.getElementById("analytics-content").style.display = "block";
    showPeriod('today');

    // Draw chart
    const ctx = document.getElementById("revenueChart").getContext("2d");
    new Chart(ctx, {
      type: 'bar',
      data: {
        labels: data.monthlyData.map(m => m.month),
        datasets: [
          {
            label: 'Online Orders',
            data: data.monthlyData.map(m => m.orders),
            backgroundColor: 'rgba(26, 111, 196, 0.7)',
            borderColor: '#1a6fc4',
            borderWidth: 1,
            borderRadius: 4
          },
          {
            label: 'Waybills',
            data: data.monthlyData.map(m => m.waybills),
            backgroundColor: 'rgba(245, 158, 11, 0.7)',
            borderColor: '#f59e0b',
            borderWidth: 1,
            borderRadius: 4
          }
        ]
      },
      options: {
        responsive: true,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: { label: ctx => `GH₵${ctx.raw.toFixed(2)}` }
          }
        },
        scales: {
          x: { stacked: false },
          y: { beginAtZero: true, ticks: { callback: val => `GH₵${val}` } }
        }
      }
    });
  })
  .catch(() => {
    document.getElementById("analytics-loading").innerHTML = `<p style="color:red;">Could not load analytics.</p>`;
  });