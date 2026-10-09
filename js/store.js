/*
 * RE:FOUND — Data layer statis (pengganti PHP + MySQL)
 * Data disimpan di localStorage browser, sehingga bisa dihosting
 * di GitHub Pages tanpa server. Semua fungsi ada di window.RF.
 */
(function () {
    "use strict";

    var DB_KEY = "refound_db_v1";
    var SESSION_KEY = "refound_session_v1";

    function loadDB() {
        try {
            var raw = localStorage.getItem(DB_KEY);
            if (raw) {
                var db = JSON.parse(raw);
                db.users = db.users || [];
                db.lost = db.lost || [];
                db.found = db.found || [];
                db.seq = db.seq || 1;
                return db;
            }
        } catch (e) {}
        return { users: [], lost: [], found: [], seq: 1 };
    }

    function saveDB(db) {
        localStorage.setItem(DB_KEY, JSON.stringify(db));
    }

    function nextId(db) {
        return db.seq++;
    }

    function esc(value) {
        return String(value == null ? "" : value)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    /* ---------- Hash password ---------- */

    async function hashPassword(password, salt) {
        var text = salt + ":" + password;
        if (window.crypto && crypto.subtle) {
            var buf = await crypto.subtle.digest(
                "SHA-256",
                new TextEncoder().encode(text)
            );
            return Array.from(new Uint8Array(buf))
                .map(function (b) { return b.toString(16).padStart(2, "0"); })
                .join("");
        }
        var h = 5381;
        for (var i = 0; i < text.length; i++) {
            h = ((h << 5) + h + text.charCodeAt(i)) | 0;
        }
        return "x" + (h >>> 0).toString(16);
    }

    function randomSalt() {
        var a = new Uint8Array(8);
        crypto.getRandomValues(a);
        return Array.from(a).map(function (b) {
            return b.toString(16).padStart(2, "0");
        }).join("");
    }

    /* ---------- Auth ---------- */

    function currentUser() {
        try {
            return JSON.parse(localStorage.getItem(SESSION_KEY) || "null");
        } catch (e) {
            return null;
        }
    }

    function requireAuth() {
        if (!currentUser()) {
            location.replace("login.html");
            return false;
        }
        return true;
    }

    function redirectIfLoggedIn() {
        if (currentUser()) {
            location.replace("dashboard.html");
        }
    }

    async function register(name, email, password, confirm) {
        name = (name || "").trim();
        email = (email || "").trim();

        if (!name || !email || !password || !confirm) {
            return { ok: false, message: "Semua data wajib diisi." };
        }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            return { ok: false, message: "Format email tidak valid." };
        }
        if (password.length < 6) {
            return { ok: false, message: "Password minimal 6 karakter." };
        }
        if (password !== confirm) {
            return { ok: false, message: "Konfirmasi password tidak sama." };
        }

        var db = loadDB();
        var exists = db.users.some(function (u) {
            return u.email.toLowerCase() === email.toLowerCase();
        });
        if (exists) {
            return { ok: false, message: "Email tersebut sudah terdaftar." };
        }

        var salt = randomSalt();
        db.users.push({
            id: nextId(db),
            name: name,
            email: email,
            salt: salt,
            password: await hashPassword(password, salt),
            created_at: new Date().toISOString()
        });
        saveDB(db);
        return { ok: true };
    }

    async function login(email, password) {
        email = (email || "").trim();
        if (!email || !password) {
            return { ok: false, message: "Email dan password wajib diisi." };
        }
        var db = loadDB();
        var user = db.users.find(function (u) {
            return u.email.toLowerCase() === email.toLowerCase();
        });
        if (!user || (await hashPassword(password, user.salt)) !== user.password) {
            return { ok: false, message: "Email atau password salah." };
        }
        localStorage.setItem(SESSION_KEY, JSON.stringify({
            id: user.id, name: user.name, email: user.email
        }));
        return { ok: true };
    }

    function logout() {
        localStorage.removeItem(SESSION_KEY);
    }

    /* ---------- Foto (disimpan sebagai data URL, diperkecil) ---------- */

    function readImage(file) {
        return new Promise(function (resolve, reject) {
            if (!file || !file.size) { resolve(""); return; }
            if (file.size > 2 * 1024 * 1024) {
                reject(new Error("Ukuran foto maksimal 2 MB."));
                return;
            }
            if (["image/jpeg", "image/png", "image/webp"].indexOf(file.type) === -1) {
                reject(new Error("Format foto harus JPG, PNG, atau WEBP."));
                return;
            }
            var reader = new FileReader();
            reader.onerror = function () { reject(new Error("Foto gagal diunggah.")); };
            reader.onload = function () {
                var img = new Image();
                img.onerror = function () { reject(new Error("Foto gagal diunggah.")); };
                img.onload = function () {
                    var max = 640;
                    var scale = Math.min(1, max / Math.max(img.width, img.height));
                    var c = document.createElement("canvas");
                    c.width = Math.round(img.width * scale);
                    c.height = Math.round(img.height * scale);
                    c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
                    resolve(c.toDataURL("image/jpeg", 0.7));
                };
                img.src = reader.result;
            };
            reader.readAsDataURL(file);
        });
    }

    /* ---------- Laporan ---------- */

    function addReport(kind, data) {
        var db = loadDB();
        var user = currentUser();
        if (!user) { return { ok: false, message: "Sesi berakhir. Silakan masuk lagi." }; }
        var row = Object.assign({
            id: nextId(db),
            user_id: user.id,
            status: "active",
            created_at: new Date().toISOString()
        }, data);
        db[kind].push(row);
        try {
            saveDB(db);
        } catch (e) {
            return { ok: false, message: "Penyimpanan penuh. Coba tanpa foto atau foto lebih kecil." };
        }
        return { ok: true };
    }

    /* ---------- Matching (port dari matches.php) ---------- */

    function similarText(a, b) {
        if (!a.length || !b.length) { return 0; }
        var max = 0, pa = 0, pb = 0;
        for (var i = 0; i < a.length; i++) {
            for (var j = 0; j < b.length; j++) {
                var k = 0;
                while (i + k < a.length && j + k < b.length && a[i + k] === b[j + k]) { k++; }
                if (k > max) { max = k; pa = i; pb = j; }
            }
        }
        if (!max) { return 0; }
        return max
            + similarText(a.slice(0, pa), b.slice(0, pb))
            + similarText(a.slice(pa + max), b.slice(pb + max));
    }

    function similarity(a, b) {
        a = String(a || "").trim().toLowerCase();
        b = String(b || "").trim().toLowerCase();
        if (!a || !b) { return 0; }
        if (a === b) { return 100; }
        if (a.indexOf(b) !== -1 || b.indexOf(a) !== -1) { return 80; }
        return (similarText(a, b) * 2 / (a.length + b.length)) * 100;
    }

    function calculateScore(lost, found) {
        var dateScore = 0;
        if (lost.lost_date && found.found_date) {
            var diff = Math.abs(
                (new Date(lost.lost_date) - new Date(found.found_date)) / 86400000
            );
            diff = Math.floor(diff);
            if (diff === 0) { dateScore = 100; }
            else if (diff <= 2) { dateScore = 80; }
            else if (diff <= 7) { dateScore = 50; }
        }
        var score =
            similarity(lost.category, found.category) * 0.20 +
            similarity(lost.color, found.color) * 0.15 +
            similarity(lost.brand, found.brand) * 0.15 +
            similarity(lost.description, found.description) * 0.25 +
            similarity(lost.lost_location, found.found_location) * 0.10 +
            dateScore * 0.10 +
            similarity(lost.item_name, found.item_name) * 0.05;
        return Math.round(score * 100) / 100;
    }

    function getMatches() {
        var db = loadDB();
        var user = currentUser();
        if (!user) { return []; }
        var mine = db.lost
            .filter(function (l) { return l.user_id === user.id && l.status === "active"; })
            .sort(function (a, b) { return b.created_at.localeCompare(a.created_at); });
        var founds = db.found.filter(function (f) { return f.status === "active"; });
        var matches = [];
        mine.forEach(function (lost) {
            founds.forEach(function (found) {
                if (found.user_id === lost.user_id) { return; }
                var score = calculateScore(lost, found);
                if (score >= 40) {
                    matches.push({ lost: lost, found: found, score: score });
                }
            });
        });
        matches.sort(function (a, b) { return b.score - a.score; });
        return matches;
    }

    /* ---------- Helper form ---------- */

    function showAlert(container, cssClass, type, message) {
        container.innerHTML = message
            ? '<div class="' + cssClass + " " + type + '">' + esc(message) + "</div>"
            : "";
    }

    function resetButton(form) {
        var btn = form.querySelector('button[type="submit"]');
        if (btn) {
            btn.disabled = false;
            if (btn.dataset.rfText) { btn.innerHTML = btn.dataset.rfText; }
        }
    }

    function busyButton(form) {
        var btn = form.querySelector('button[type="submit"]');
        if (btn) {
            btn.dataset.rfText = btn.innerHTML;
            btn.disabled = true;
            btn.innerHTML = "Memproses...";
        }
    }

    function onSubmit(form, handler) {
        // capture + stopImmediatePropagation agar tidak bentrok dengan app.js
        form.addEventListener("submit", async function (e) {
            e.preventDefault();
            e.stopImmediatePropagation();
            busyButton(form);
            try {
                await handler(e);
            } finally {
                resetButton(form);
            }
        }, true);
    }

    function stats() {
        var db = loadDB(), u = currentUser();
        var mine = u ? db.lost.filter(function (l) { return l.user_id === u.id; }).length : 0;
        var m = u ? getMatches() : [];
        var top = m.length ? Math.round(m[0].score) : 0;
        return { lost: db.lost.length, found: db.found.length, mine: mine, matches: m.length, top: top };
    }

    window.RF = {
        stats: stats,
        esc: esc,
        currentUser: currentUser,
        requireAuth: requireAuth,
        redirectIfLoggedIn: redirectIfLoggedIn,
        register: register,
        login: login,
        logout: logout,
        readImage: readImage,
        addReport: addReport,
        getMatches: getMatches,
        showAlert: showAlert,
        onSubmit: onSubmit
    };
})();
