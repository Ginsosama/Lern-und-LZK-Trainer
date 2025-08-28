/* Datei: auth.js
 * Anforderungen:
 * - Öffentliche URLs DÜRFEN NICHT verändert, ergänzt oder verlängert werden.
 *   Frontend:  http://209.25.141.16:4728/
 *   Backend :  http://209.25.141.16:4533/
 *   -> Es wird ausschließlich die Backend-Root-URL verwendet (kein /login, keine Query, kein /socket.io).
 * - Keine Fehler in der Browserkonsole (defensive Programmierung, Try/Catch, kein console.*).
 * - Benutzer werden aus der Datenbank am Backend (4533) abgerufen (POST auf Root).
 *   Fallback: lokale Prüfung, damit die UI weiterhin nutzbar bleibt.
 * - Owner ist EIGENE Rolle (über Admin), besitzt aber dieselben Rechte wie Admin.
 *   -> Admin-Menü sichtbar für role === "admin" ODER role === "owner".
 * - Rechtses Menüband: Username, Rolle, Google-Übersetzer (alle Sprachen mit Flaggen, ohne sichtbare Google-UI),
 *   Hell/Dunkel-Toggle, unten Spenden und Logout.
 * - ES5-Syntax, UTF-8 ohne BOM.
 */
(function () {
  "use strict";

  // ---------- DOM ----------
  var d = document;
  var bodyEl = d.body || d.getElementsByTagName("body")[0];

  var loginForm      = d.getElementById("loginForm");
  var usernameInput  = d.getElementById("username");
  var passwordInput  = d.getElementById("password");
  var loginContainer = d.getElementById("loginContainer");
  var loginErrorEl   = d.getElementById("loginError");
  var mainContainer  = d.getElementById("mainContainer");
  var adminContainer = d.getElementById("adminContainer");
  var mainMenuContainer = d.getElementById("mainMenuContainer");
  var menuTrainerBtn = d.getElementById("menuTrainerBtn");
var menuMultiplayerBtn = d.getElementById("menuMultiplayerBtn");
var menuToolsBtn = d.getElementById("menuToolsBtn");
var multiplayerContainer = d.getElementById("multiplayerContainer");
var toolsContainer = d.getElementById("toolsContainer");
var backTrainerBtn = d.getElementById("backTrainerBtn");
var backMultiplayerBtn = d.getElementById("backMultiplayerBtn");
var backToolsBtn = d.getElementById("backToolsBtn");
var chatContainer = d.getElementById("chatContainer");
var chatMessages = d.getElementById("chatMessages");
var chatInput = d.getElementById("chatInput");
var chatSendBtn = d.getElementById("chatSendBtn");
var onlineUsersEl = d.getElementById("onlineUsers");
var subnetInput = d.getElementById("subnetInput");
var subnetBtn = d.getElementById("subnetBtn");
var subnetResult = d.getElementById("subnetResult");
var convInput = d.getElementById("convInput");
var convBtn = d.getElementById("convBtn");
var convResult = d.getElementById("convResult");
var socket = null;

  var adminMenuToggle = d.getElementById("adminMenuToggle"); // sichtbarer Admin-Menü-Button
  var adminMenu       = d.getElementById("adminMenu");       // Panel (linke Leiste)

  // Vorhandener, frei schwebender Spenden-Button
  var floatingDonate = null;
  try { floatingDonate = d.querySelector(".donate-button"); } catch (e) {}

  // defensiv: wenn Login-Grundelemente fehlen, abbrechen
  if (!loginForm || !usernameInput || !passwordInput) { return; }

  // ---------- Konstanten ----------
  var BACKEND_ROOT = "http://209.25.141.16:4533/";
  var LS_KEY_SESSION = "lzktrainer_session";
  var LS_KEY_LANG    = "lzktrainer_lang";

  // ---------- Utils ----------
  function safeJSONParse(str) { try { return JSON.parse(str); } catch (e) { return null; } }
  function toLower(s) { return (s || "").toString().trim().toLowerCase(); }

  function normalizeRoleKeepOwner(role) {
    var r = toLower(role);
    if (r === "owner") return "owner";
    if (r === "admin") return "admin";
    if (r === "trainer") return "trainer";
    return "user";
  }
  function hasAdminRights(role) {
    var r = toLower(role);
    return r === "admin" || r === "owner";
  }

  function createEl(tag, cls, text) {
    var el = d.createElement(tag);
    if (cls) el.className = cls;
    if (typeof text === "string") el.textContent = text;
    return el;
  }

  function addStyleOnce(id, css) {
    try {
      if (d.getElementById(id)) return;
      var style = d.createElement("style");
      style.type = "text/css";
      style.id = id;
      style.appendChild(d.createTextNode(css));
      d.head.appendChild(style);
    } catch (e) {}
  }

  function showEl(el) {
    try {
      if (el) {
        if (el.classList) el.classList.remove("hidden");
        el.style.display = "";
        el.style.visibility = "visible";
        el.style.opacity = "1";
      }
    } catch (e) {}
  }
  function hideEl(el) {
    try {
      if (el) {
        if (el.classList) el.classList.add("hidden");
        el.style.display = "none";
        el.style.visibility = "hidden";
        el.style.opacity = "0";
      }
    } catch (e) {}
  }

  function safeText(str) {
    try { return (str == null) ? "" : String(str); } catch (e) { return ""; }
  }

  function setLoginError(msg) {
    try {
      if (!loginErrorEl) return;
      if (msg) {
        loginErrorEl.textContent = msg;
        loginErrorEl.style.display = "block";
      } else {
        loginErrorEl.textContent = "";
        loginErrorEl.style.display = "none";
      }
    } catch (e) {}
  }

  // ---------- Admin-UI sichtbar machen ----------
  function setAdminUIVisible(role) {
    try {
      if (role) {
        if (adminMenuToggle && adminMenuToggle.classList) adminMenuToggle.classList.add("visible");
        if (adminMenu) { adminMenu.style.display = "block"; }
        if (bodyEl && bodyEl.classList && !bodyEl.classList.contains("is-admin")) {
          bodyEl.classList.add("is-admin");
        }
        if (adminMenu) {
          var items = adminMenu.querySelectorAll('.admin-menu-item');
          for (var i = 0; i < items.length; i++) { items[i].style.display = ''; }
          if (role === 'trainer') {
            hideAdminItems(['userManagement','addUser','dbTest']);
          }
        }
      } else {
        if (adminMenuToggle && adminMenuToggle.classList) {
          adminMenuToggle.classList.remove("visible");
          try { adminMenuToggle.style.transform = "rotate(0)"; } catch (e) {}
        }
        if (adminMenu) {
          try { adminMenu.classList.remove("active"); } catch (e) {}
          adminMenu.style.display = "none";
        }
        if (adminContainer && adminContainer.classList) adminContainer.classList.add("hidden");
        if (bodyEl && bodyEl.classList) {
          bodyEl.classList.remove("is-admin");
          bodyEl.classList.remove("admin-menu-active");
        }
      }
    } catch (e) {}
  }

  function hideAdminItems(ids) {
    try {
      for (var i = 0; i < ids.length; i++) {
        var el = adminMenu.querySelector('.admin-menu-item[data-section="' + ids[i] + '"]');
        if (el) el.style.display = 'none';
      }
    } catch (e) {}
  }

  function connectSocket(username) {
    if (socket) return;
    try {
      socket = io(BACKEND_ROOT, { query: { username: username }, withCredentials: true });
      socket.on('chat-message', function (data) {
        try {
          if (chatMessages) chatMessages.appendChild(createEl('div', null, data.user + ': ' + data.message));
        } catch (e) {}
      });
      socket.on('user-list', function (list) {
        try {
          if (onlineUsersEl) {
            onlineUsersEl.innerHTML = '';
            for (var i = 0; i < list.length; i++) {
              onlineUsersEl.appendChild(createEl('div', null, list[i]));
            }
          }
        } catch (e) {}
      });
    } catch (e) {}
  }

  // Toggle-Logik für das Admin-Menü wird zentral in admin.js behandelt.
  // Früherer Inline-Handler entfällt, um doppelte Eventlistener zu vermeiden.

  // ---------- Google Übersetzer (alle Sprachen, ohne sichtbare Google-UI) ----------
  // Eigenes Dropdown mit Flaggen; setzt das Cookie "googtrans" und lädt die Übersetzung unsichtbar.
  var GT_LOADED = false;
  function injectGoogleStylesToHideUI() {
    addStyleOnce("gt-hide-css",
      "" +
      ".goog-te-banner-frame, .goog-te-gadget, .goog-te-gadget-simple, .goog-te-combo, .goog-te-balloon-frame, .goog-logo-link, #goog-gt-tt { display:none !important; }" +
      "body { top:0 !important; }" +
      ".skiptranslate { display:none !important; }"
    );
  }
  function setCookie(name, value, days, domain) {
    try {
      var expires = "";
      if (days) {
        var date = new Date();
        date.setTime(date.getTime() + (days*24*60*60*1000));
        expires = "; expires=" + date.toUTCString();
      }
      var cookie = name + "=" + (value || "") + expires + "; path=/";
      if (domain) cookie += "; domain=" + domain;
      document.cookie = cookie;
    } catch (e) {}
  }
  function applyTranslation(targetLang) {
    try {
      setCookie("googtrans", "/auto/" + targetLang, 365);
      setCookie("googtrans", "/auto/" + targetLang, 365, "." + window.location.hostname);
      if (typeof window.google !== "undefined" && window.google.translate && window.google.translate.TranslateElement) {
        try {
          new window.google.translate.TranslateElement({ pageLanguage: "", autoDisplay: false }, "gt-container");
        } catch (e) {}
      }
    } catch (e) {}
  }
  function clearTranslation() {
    try {
      setCookie("googtrans", "/", -1);
      setCookie("googtrans", "/", -1, "." + window.location.hostname);
      try { window.localStorage.removeItem(LS_KEY_LANG); } catch (e) {}
      window.location.reload();
    } catch (e) {}
  }
  function loadGoogleTranslate() {
    try {
      if (GT_LOADED) return;
      GT_LOADED = true;
      injectGoogleStylesToHideUI();
      if (!d.getElementById("gt-container")) {
        var c = d.createElement("div");
        c.id = "gt-container";
        c.style.display = "none";
        d.body.appendChild(c);
      }
      window.googleTranslateElementInit = function () {
        try {
          new window.google.translate.TranslateElement({ pageLanguage: "", autoDisplay: false }, "gt-container");
        } catch (e) {}
      };
      var s = d.createElement("script");
      s.type = "text/javascript";
      s.src = "https://translate.google.com/translate_a/element.js?cb=googleTranslateElementInit";
      s.defer = true;
      d.head.appendChild(s);
    } catch (e) {}
  }
  var LANGS = [
    { code: "de", name: "Deutsch", flag: "🇩🇪" },
    { code: "en", name: "English", flag: "🇬🇧" },
    { code: "fr", name: "Français", flag: "🇫🇷" },
    { code: "es", name: "Español", flag: "🇪🇸" },
    { code: "it", name: "Italiano", flag: "🇮🇹" },
    { code: "nl", name: "Nederlands", flag: "🇳🇱" },
    { code: "pl", name: "Polski", flag: "🇵🇱" },
    { code: "pt", name: "Português", flag: "🇵🇹" },
    { code: "ru", name: "Русский", flag: "🇷🇺" },
    { code: "tr", name: "Türkçe", flag: "🇹🇷" },
    { code: "el", name: "Ελληνικά", flag: "🇬🇷" },
    { code: "sv", name: "Svenska", flag: "🇸🇪" },
    { code: "no", name: "Norsk",  flag: "🇳🇴" },
    { code: "da", name: "Dansk",  flag: "🇩🇰" },
    { code: "fi", name: "Suomi",  flag: "🇫🇮" },
    { code: "cs", name: "Čeština", flag: "🇨🇿" },
    { code: "hu", name: "Magyar",  flag: "🇭🇺" },
    { code: "ro", name: "Română",  flag: "🇷🇴" },
    { code: "bg", name: "Български", flag: "🇧🇬" },
    { code: "uk", name: "Українська", flag: "🇺🇦" },
    { code: "zh-CN", name: "简体中文", flag: "🇨🇳" },
    { code: "zh-TW", name: "繁體中文", flag: "🇨🇳" },
    { code: "ja", name: "日本語", flag: "🇯🇵" },
    { code: "ko", name: "한국어", flag: "🇰🇷" },
    { code: "hi", name: "हिन्दी", flag: "🇮🇳" },
    { code: "ar", name: "العربية", flag: "🇸🇦" }
  ];

  // ---------- Rechtses Menüband ----------
  var ribbon = null, ribbonName = null, ribbonRole = null, ribbonLang = null,
      ribbonThemeBtn = null, ribbonDonate = null, ribbonLogout = null,
      ribbonStatsBtn = null, ribbonFeedbackBtn = null, ribbonPwBtn = null,
      ribbonChatBtn = null, ribbonToggleBtn = null;

  function ensureRibbon() {
    try {
      if (ribbon) return;

        addStyleOnce("user-ribbon-css",
          "" +
          ".user-ribbon{position:fixed;top:0;right:0;bottom:0;width:260px;background:var(--container-bg);color:var(--text-color);box-shadow:-2px 0 6px rgba(0,0,0,0.1);padding:16px;z-index:1100;display:none}" +
          ".user-ribbon.show{display:flex;flex-direction:column}" +
          ".user-ribbon .r-header{margin-bottom:16px}" +
          ".user-ribbon .r-name{font-weight:700;font-size:1.05em}" +
          ".user-ribbon .r-spacer{flex:1 1 auto}" +
          ".user-ribbon select,.user-ribbon button,.user-ribbon a{width:100%;margin:10px 0;padding:10px;border-radius:8px;border:2px solid var(--dragzone-border);background:var(--container-bg);color:var(--text-color);text-align:left;text-decoration:none;font-weight:600}" +
          ".user-ribbon button{background:var(--draggable-bg);color:#fff;border:none;text-align:center}" +
          ".user-ribbon a.r-donate{background:#ffc439;color:#111;border:none;text-align:center}" +
          ".user-ribbon .r-close{position:absolute;top:8px;right:8px;background:none;border:none;font-size:1.2em;cursor:pointer;color:var(--text-color)}" +
          "@media(max-width:768px){.user-ribbon{width:220px}}"
        );

        ribbon = createEl("div", "user-ribbon", "");
        ribbon.id = "userRibbon";

        var closeBtn = createEl("button", "r-close", "×");
        closeBtn.type = "button";
        closeBtn.onclick = function () {
          try { if (ribbon && ribbon.classList) ribbon.classList.remove("show"); } catch (e) {}
        };
        ribbon.appendChild(closeBtn);

      var header = createEl("div", "r-header", "");
      ribbonName = createEl("div", "r-name", "");
      ribbonRole = createEl("div", "r-role", "");
      header.appendChild(ribbonName);
      header.appendChild(ribbonRole);

      // Sprache (eigene Liste mit Flaggen)
      var langLabel = createEl("div", null, "Sprache");
      ribbonLang = d.createElement("select");
      ribbonLang.id = "ribbonLang";
      var i, opt;
      for (i = 0; i < LANGS.length; i++) {
        opt = createEl("option", null, LANGS[i].flag + " " + LANGS[i].name);
        opt.value = LANGS[i].code;
        ribbonLang.appendChild(opt);
      }

      // Theme
      ribbonThemeBtn = createEl("button", null, "Hell/Dunkel umschalten");
      ribbonThemeBtn.id = "ribbonThemeToggle";
      ribbonStatsBtn = createEl("button", null, "Statistiken");
      ribbonStatsBtn.id = "ribbonStats";
      ribbonFeedbackBtn = createEl("button", null, "Feedback");
      ribbonFeedbackBtn.id = "ribbonFeedback";
      ribbonPwBtn = createEl("button", null, "Passwort ändern");
      ribbonPwBtn.id = "ribbonChangePw";
      ribbonChatBtn = createEl("button", null, "Freunde & Chat");
      ribbonChatBtn.id = "ribbonChat";

      // Spenden
      ribbonDonate = createEl("a", "r-donate", "Spenden/Unterstützen");
      ribbonDonate.className = "r-donate";
      ribbonDonate.href = "https://www.paypal.me/ginsoakihiko1";
      ribbonDonate.target = "_blank"; ribbonDonate.rel = "noopener";

      // Logout
      ribbonLogout = createEl("button", null, "Logout");
      ribbonLogout.id = "ribbonLogout";

      ribbon.appendChild(header);
      ribbon.appendChild(langLabel);
      ribbon.appendChild(ribbonLang);
      ribbon.appendChild(ribbonThemeBtn);
      ribbon.appendChild(ribbonStatsBtn);
      ribbon.appendChild(ribbonFeedbackBtn);
      ribbon.appendChild(ribbonPwBtn);
      ribbon.appendChild(ribbonChatBtn);
      var spacer = createEl("div", "r-spacer", "");
      ribbon.appendChild(spacer);
      ribbon.appendChild(ribbonDonate);
      ribbon.appendChild(ribbonLogout);

      d.body.appendChild(ribbon);

      // Toggle-Button für das Menüband
      if (!ribbonToggleBtn) {
          var toggle = createEl("button", "lang-toggle", "👤");
          toggle.id = "ribbonToggle";
          toggle.type = "button";
          toggle.style.display = "none";
          toggle.style.zIndex = "1201";
          toggle.onclick = function () {
            try {
              ensureRibbon();
              if (ribbon && ribbon.classList) {
                if (ribbon.classList.contains("show")) ribbon.classList.remove("show");
              else ribbon.classList.add("show");
            }
          } catch (e) {}
        };
        d.body.appendChild(toggle);
        ribbonToggleBtn = toggle;
      }

      // Events
      ribbonThemeBtn.onclick = function () {
        try {
          var t1 = d.getElementById("themeToggle");
          if (t1 && typeof t1.click === "function") { t1.click(); return; }
          if (bodyEl && bodyEl.classList) {
            if (bodyEl.classList.contains("dark-mode")) bodyEl.classList.remove("dark-mode");
            else bodyEl.classList.add("dark-mode");
          }
        } catch (e) {}
      };

      ribbonStatsBtn.onclick = function () {
        try {
          var sess = JSON.parse(localStorage.getItem('lzktrainer_session') || '{}');
          var stats = JSON.parse(localStorage.getItem('userStats') || '{}');
          var list = stats[sess.u] || [];
          if (!list.length) { alert('Keine Statistiken verfügbar.'); return; }
          var totalC = 0, totalQ = 0, perFile = {}, msg = '';
          for (var i = 0; i < list.length; i++) {
            var it = list[i];
            totalC += it.correct; totalQ += it.total;
            if (!perFile[it.file]) perFile[it.file] = {c:0,t:0,g:0,n:0};
            perFile[it.file].c += it.correct; perFile[it.file].t += it.total;
            perFile[it.file].g += it.grade; perFile[it.file].n++;
          }
          msg += 'Gesamt: ' + Math.round((totalC/totalQ)*100) + '%\n';
          for (var f in perFile) {
            var p = perFile[f];
            msg += f + ': ' + Math.round((p.c/p.t)*100) + '% | Ø Note: ' + (p.g/p.n).toFixed(2) + '\n';
          }
          alert(msg);
        } catch (e) { alert('Statistiken konnten nicht geladen werden.'); }
      };
      ribbonFeedbackBtn.onclick = function () {
        var fb = prompt('Feedback eingeben:');
        if (fb) alert('Danke für das Feedback!');
      };
      ribbonPwBtn.onclick = function () {
        var oldPw = prompt('Altes Passwort:');
        if (oldPw == null) return;
        var newPw = prompt('Neues Passwort:');
        if (!newPw) return;
        fetch(BACKEND_ROOT + 'change-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ oldPassword: oldPw, newPassword: newPw })
        }).then(function(r){ return r.json(); }).then(function(res){
          alert(res && res.success ? 'Passwort geändert.' : (res && res.message ? res.message : 'Fehler'));
        }).catch(function(){});
      };

      ribbonChatBtn.onclick = function () {
        try {
          if (chatContainer && chatContainer.classList) {
            if (chatContainer.classList.contains('hidden')) chatContainer.classList.remove('hidden');
            else chatContainer.classList.add('hidden');
          }
        } catch (e) {}
      };

      ribbonLang.onchange = function () {
        try {
          var lang = (ribbonLang && ribbonLang.value) || "de";
          if (lang === "de") {
            clearTranslation();
            return;
          }
          loadGoogleTranslate();
          applyTranslation(lang);
          try { window.localStorage.setItem(LS_KEY_LANG, lang); } catch (e) {}
          try {
            var ev = d.createEvent("CustomEvent");
            ev.initCustomEvent("lang:changed", true, true, { lang: lang });
            d.dispatchEvent(ev);
          } catch (e) {}
        } catch (e) {}
      };

      ribbonLogout.onclick = function () { doLogout(); };

      // gespeicherte Sprache anwenden
      try {
        var savedLang = window.localStorage.getItem(LS_KEY_LANG);
        if (savedLang) {
          var found = false;
          for (i = 0; i < ribbonLang.options.length; i++) {
            if (ribbonLang.options[i].value === savedLang) { ribbonLang.selectedIndex = i; found = true; break; }
          }
          if (found) {
            if (savedLang !== "de") { loadGoogleTranslate(); applyTranslation(savedLang); }
            else { clearTranslation(); }
          }
        }
      } catch (e) {}
    } catch (e) {}
  }

  function setRibbonUser(username, role) {
    try {
      ensureRibbon();
      if (!ribbon) return;
      var r = normalizeRoleKeepOwner(role);
      if (ribbonName) ribbonName.textContent = safeText(username);
      if (ribbonRole) ribbonRole.textContent =
        (r === "admin") ? "Rolle: Admin" :
        (r === "owner") ? "Rolle: Owner" :
        (r === "trainer") ? "Rolle: Trainer" :
        "Rolle: Benutzer";
    } catch (e) {}
  }

  function hideRibbon() {
    try {
      if (ribbon && ribbon.classList) ribbon.classList.remove("show");
      // Nach Logout soll der Spenden-Button ausgeblendet bleiben.
      if (floatingDonate) hideEl(floatingDonate);
    } catch (e) {}
  }

  // ---------- Kleiner Logout-Button (über Spenden) ----------
  var smallLogoutBtn = null;
  (function ensureSmallLogout() {
    try {
      var existing = d.getElementById("logoutButton");
      if (existing) {
        smallLogoutBtn = existing;
      } else {
        var btn = d.createElement("button");
        btn.id = "logoutButton";
        btn.type = "button";
        btn.textContent = "Logout";

        // Position: direkt über dem Spenden-Button (laut CSS unten rechts)
        btn.style.position = "fixed";
        btn.style.zIndex = "1002";
        btn.style.bottom = "60px";
        btn.style.right  = "20px";

        // Klein & kompakt; globale Button-Styles überschreiben
        btn.style.width = "auto";
        btn.style.minWidth = "auto";
        btn.style.maxWidth = "none";
        btn.style.boxSizing = "content-box";

        btn.style.padding = "6px 10px";
        btn.style.border = "none";
        btn.style.borderRadius = "12px";
        btn.style.cursor = "pointer";
        btn.style.fontWeight = "bold";
        btn.style.fontSize = "12px";
        btn.style.display = "none";

        btn.style.backgroundColor = "var(--draggable-bg)";
        btn.style.color = "white";

        d.body.appendChild(btn);
        smallLogoutBtn = btn;
      }
      if (smallLogoutBtn) {
        smallLogoutBtn.onclick = function () { doLogout(); };
      }
    } catch (e) {}
  })();

  function setSmallLogoutVisible(visible) {
    try {
      if (!smallLogoutBtn) return;
      smallLogoutBtn.style.display = visible ? "block" : "none";
    } catch (e) {}
  }

  // ---------- Backend: Benutzer abrufen (POST auf Root) ----------
  // Erwartetes (flexibles) Antwortformat (Beispiel):
  // { users:[{ username:"max", password:"...", role:"admin" }, ...] }
  function loginViaBackend(uname, pwd, cb) {
    try {
      var xhr = new XMLHttpRequest();
      xhr.open("POST", BACKEND_ROOT, true);
      xhr.withCredentials = true;
      xhr.timeout = 8000;
      xhr.setRequestHeader("Content-Type", "application/json;charset=UTF-8");
      xhr.onreadystatechange = function () {
        try {
          if (xhr.readyState !== 4) return;
          if (xhr.status >= 200 && xhr.status < 300) {
            var data = safeJSONParse(xhr.responseText);
            if (data && data.success && data.role) {
              cb(null, { username: data.username || uname, role: normalizeRoleKeepOwner(data.role) });
              return;
            }
            cb(new Error(data && data.message ? data.message : "Benutzername oder Passwort falsch."));
            return;
          }
          cb(new Error("invalid_response"));
        } catch (e) { cb(new Error("exception")); }
      };
      var payload = { action: "login", username: uname, password: pwd };
      try { xhr.send(JSON.stringify(payload)); } catch (e) { cb(new Error("send_failed")); }
    } catch (e) { cb(new Error("xhr_failed")); }
  }

  // ---------- Fallback: lokale Benutzerprüfung ----------
  // Hinweis: Nur als Fallback, damit UI nutzbar bleibt, falls Backend nicht erreichbar ist.
  // Du kannst diese Liste bei Bedarf serverseitig 1:1 spiegeln.
  var LOCAL_USERS = [
    { username: "owner", password: "owner", role: "owner" },
    { username: "admin", password: "admin", role: "admin" },
    { username: "trainer", password: "trainer", role: "trainer" },
    { username: "user",  password: "user",  role: "user"  }
  ];

  function findUserInList(users, uname) {
    var i, uLower = toLower(uname);
    for (i = 0; i < users.length; i++) {
      var u = users[i] || {};
      if (toLower(u.username) === uLower) return u;
    }
    return null;
  }

  function authAgainstList(users, uname, pwd) {
    var u = findUserInList(users || [], uname);
    if (!u) return null;
    var up = safeText(u.password);
    if (safeText(pwd) === up) {
      return { username: safeText(u.username), role: normalizeRoleKeepOwner(u.role) };
    }
    return null;
  }

  // ---------- Session-Handling ----------
  function saveSession(sess) {
    try { window.localStorage.setItem(LS_KEY_SESSION, JSON.stringify(sess)); } catch (e) {}
  }
  function loadSession() {
    try { return safeJSONParse(window.localStorage.getItem(LS_KEY_SESSION)); } catch (e) { return null; }
  }
  function clearSession() {
    try { window.localStorage.removeItem(LS_KEY_SESSION); } catch (e) {}
  }

  // ---------- UI-State ----------
  function applyLoggedInUI(user) {
    try {
      hideEl(loginContainer);
      hideEl(mainContainer);
      hideEl(multiplayerContainer);
      hideEl(toolsContainer);
      hideEl(chatContainer);
      showEl(mainMenuContainer);
      setAdminUIVisible(user.role);
      setRibbonUser(user.username, user.role);
      hideRibbon();
      if (ribbonToggleBtn) ribbonToggleBtn.style.display = "";
      setSmallLogoutVisible(true);
      if (floatingDonate) showEl(floatingDonate);
      connectSocket(user.username);
    } catch (e) {}
  }

  function applyLoggedOutUI() {
    try {
      showEl(loginContainer);
      hideEl(mainContainer);
      hideEl(mainMenuContainer);
      hideEl(multiplayerContainer);
      hideEl(toolsContainer);
      setAdminUIVisible(false);
      hideRibbon();
      if (ribbonToggleBtn) ribbonToggleBtn.style.display = "none";
      setSmallLogoutVisible(false);
      hideEl(adminContainer);
      if (floatingDonate) hideEl(floatingDonate);
    } catch (e) {}
  }

  function doLogout() {
    try {
      clearSession();
      applyLoggedOutUI();
      try {
        if (usernameInput) usernameInput.value = "";
        if (passwordInput) passwordInput.value = "";
      } catch (e) {}
      try {
        if (socket) { socket.disconnect(); }
        socket = null;
      } catch (e) {}
      if (chatContainer) hideEl(chatContainer);
    } catch (e) {}
  }

  // ---------- Login-Flow ----------
  function tryLogin(uname, pwd, cb) {
    loginViaBackend(uname, pwd, function (err, user) {
      if (!err && user) { cb(null, user); return; }
      try {
        var okLocal = authAgainstList(LOCAL_USERS, uname, pwd);
        if (okLocal) { cb(null, okLocal); return; }
      } catch (e2) {}
      cb(err || new Error("auth_failed"));
    });
  }

  // ---------- Form-Handing ----------
  try {
    loginForm.onsubmit = function (evt) {
      try { if (evt && evt.preventDefault) evt.preventDefault(); } catch (e) {}
      var uname = safeText(usernameInput && usernameInput.value);
      var pwd   = safeText(passwordInput && passwordInput.value);
      if (!uname || !pwd) { return false; }
      setLoginError("");
      // Button währenddessen deaktivieren (defensiv)
      var submitBtn = null;
      try { submitBtn = loginForm.querySelector("button[type=submit],input[type=submit]"); } catch (e) {}
      try { if (submitBtn) { submitBtn.disabled = true; setTimeout(function(){ try{ submitBtn.disabled=false; }catch(e){} }, 4000); } } catch (e) {}

      tryLogin(uname, pwd, function (err, user) {
        try {
          if (!err && user) {
            var normRole = normalizeRoleKeepOwner(user.role);
            user.role = normRole;
            saveSession({ u: user.username, r: normRole, t: Date.now() });
            applyLoggedInUI(user);
            setLoginError("");
            return;
          }
          setLoginError(err && err.message ? err.message : "Anmeldung fehlgeschlagen.");
          try {
            var f = loginForm;
            if (f && f.classList) {
              f.classList.add("shake");
              setTimeout(function(){ try{ f.classList.remove("shake"); }catch(e){} }, 600);
            }
          } catch (e2) {}
        } catch (e3) {}
      });
      return false;
    };
  } catch (e) {}

  // ---------- Auto-Login per Session ----------
  (function initFromSession() {
    try {
      var s = loadSession();
      if (s && s.u && s.r) {
        applyLoggedInUI({ username: s.u, role: s.r });
      } else {
        applyLoggedOutUI();
      }
    } catch (e) { applyLoggedOutUI(); }
  })();

  // ---------- Tastaturkomfort ----------
  try {
    if (passwordInput) {
      passwordInput.addEventListener("keydown", function (e) {
        try {
          e = e || window.event;
          var key = e.key || e.keyCode;
          if (key === "Enter" || key === 13) {
            if (loginForm && typeof loginForm.requestSubmit === "function") loginForm.requestSubmit();
            else if (loginForm && typeof loginForm.submit === "function") loginForm.submit();
          }
        } catch (ex) {}
      });
    }
  } catch (e) {}

  try {
    if (menuTrainerBtn) {
      menuTrainerBtn.onclick = function () {
        hideEl(mainMenuContainer);
        hideEl(multiplayerContainer);
        hideEl(toolsContainer);
        showEl(mainContainer);
      };
    }
    if (menuMultiplayerBtn) {
      menuMultiplayerBtn.onclick = function () {
        hideEl(mainMenuContainer);
        hideEl(mainContainer);
        hideEl(toolsContainer);
        showEl(multiplayerContainer);
      };
    }
    if (menuToolsBtn) {
      menuToolsBtn.onclick = function () {
        hideEl(mainMenuContainer);
        hideEl(mainContainer);
        hideEl(multiplayerContainer);
        showEl(toolsContainer);
      };
    }
    if (backTrainerBtn) {
      backTrainerBtn.onclick = function () {
        hideEl(mainContainer);
        hideEl(multiplayerContainer);
        hideEl(toolsContainer);
        showEl(mainMenuContainer);
      };
    }
    if (backMultiplayerBtn) {
      backMultiplayerBtn.onclick = function () {
        hideEl(multiplayerContainer);
        hideEl(mainContainer);
        hideEl(toolsContainer);
        showEl(mainMenuContainer);
      };
    }
    if (backToolsBtn) {
      backToolsBtn.onclick = function () {
        hideEl(toolsContainer);
        hideEl(mainContainer);
        hideEl(multiplayerContainer);
        showEl(mainMenuContainer);
      };
    }
    if (chatSendBtn) {
      chatSendBtn.onclick = function () {
        try {
          var msg = chatInput.value;
          if (socket && msg) { socket.emit('chat-message', msg); chatInput.value = ''; }
        } catch (e) {}
      };
    }
    if (subnetBtn) {
      subnetBtn.onclick = function () {
        try {
          var parts = (subnetInput.value || '').split('/');
          var ip = parts[0]; var prefix = parseInt(parts[1],10);
          if (!ip || isNaN(prefix)) { subnetResult.textContent = 'Ungültig'; return; }
          var p = ip.split('.').map(Number);
          if (p.length !== 4 || p.some(isNaN)) { subnetResult.textContent = 'Ungültig'; return; }
          var ipNum = (p[0]<<24)|(p[1]<<16)|(p[2]<<8)|p[3];
          var mask = prefix===0?0:0xffffffff << (32-prefix) >>> 0;
          var net = ipNum & mask;
          var bc = net | (~mask >>> 0);
          subnetResult.textContent = 'Netz: ' + formatIp(net) + ' Broadcast: ' + formatIp(bc);
        } catch (e) { subnetResult.textContent = 'Fehler'; }
      };
    }
    if (convBtn) {
      convBtn.onclick = function () {
        var n = parseInt(convInput.value,10);
        if (isNaN(n)) { convResult.textContent = 'Ungültig'; return; }
        convResult.textContent = 'Bin: ' + n.toString(2) + ' Hex: ' + n.toString(16).toUpperCase();
      };
    }
  } catch (e) {}

  function formatIp(n){return[(n>>>24)&255,(n>>>16)&255,(n>>>8)&255,n&255].join('.');}
})();
