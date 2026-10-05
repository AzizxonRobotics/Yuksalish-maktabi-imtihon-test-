// ====== SOZLAMALAR: shu yerga o'z ma'lumotlaringizni kiriting ======
const CONFIG = {
    TELEGRAM_BOT_TOKEN: "8305049292:AAG2iV6xN7aG8QRPpzzhVnFP84z2kVAFNKw",      // masalan: 123456789:AAFxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
    TELEGRAM_CHAT_ID: "750589627",          // masalan: -1001234567890 yoki shaxsiy chat_id
    GOOGLE_SHEET_URL: "https://script.google.com/macros/s/AKfycbw3FAd0lXq6_1zSgqz3w_zsypJSUrHT-KJwqluoRmM813F3PgNOmtJGvun38INhczCX/exec",  // Google Apps Script Web App URL (.../exec bilan tugaydi)
};

// Yangi bo'lim qo'shmoqchi bo'lsangiz: questions/ papkasiga "bolim-N.json" nomi bilan
// fayl qo'shing (N - keyingi raqam, masalan bolim-2.json). Sayt uni avtomatik topadi.
// Har bir faylda kamida 100 ta savol bo'lishi tavsiya etiladi (shundan 20 tasi tasodifiy tanlanadi).
// Faylning ichida "active": true/false orqali bo'limni ko'rinadigan/yashirin qilasiz.
const MAX_CATEGORY_PROBE = 30; // nechtagacha bolim-N.json fayl tekshirilsin
// =====================================================================

const MAX_PER_ATTEMPT = 20; // bitta urinishda nechta savol
const TIME_PER_Q = 30;      // soniya, savol boshiga

let categories = [];        // topilgan barcha bo'limlar (active + nofaol)
let selectedBolim = null;   // "start" bosqichida tanlangan bo'lim
let currentCategory = null; // test ishlayotgan bo'lim
let quiz, idx, answers, student;
let timerInterval, remaining, TOTAL_TIME;
let cheatLock = false;

const $ = id => document.getElementById(id);

const shuffle = arr => {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
};

function show(id) {
    ["categories", "start", "quiz", "result"].forEach(s => ($(s).hidden = s !== id));
}

// ---------- Bo'limlarni avtomatik topish ----------
async function discoverCategories() {
    const tries = [];
    for (let i = 1; i <= MAX_CATEGORY_PROBE; i++) {
        const file = `questions/bolim-${i}.json`;
        tries.push(
            fetch(file)
                .then(res => (res.ok ? res.json() : null))
                .then(d => (d ? { ...d, file } : null))
                .catch(() => null)
        );
    }
    const results = await Promise.all(tries);
    return results.filter(Boolean).sort((a, b) => (a.id ?? 0) - (b.id ?? 0));
}

async function load() {
    categories = await discoverCategories();
    renderCategories();
}

function renderCategories() {
    const active = categories.filter(c => c.active);
    if (!categories.length) {
        $("info").textContent = "Bo'limlar topilmadi. Saytni 'python -m http.server' yoki Live Server orqali oching.";
    } else if (!active.length) {
        $("info").textContent = "Hozircha faol bo'lim yo'q.";
    } else {
        $("info").textContent = "Bo'limni tanlang, keyin ism-familya va sinfingizni kiritasiz.";
    }

    $("catList").innerHTML = "";
    active.forEach(cat => {
        const div = document.createElement("div");
        div.className = "cat-item";
        div.innerHTML = `<span class="name">${esc(cat.name)}</span><span class="count">${cat.questions.length} ta savol</span>`;
        div.onclick = () => chooseBolim(cat);
        $("catList").appendChild(div);
    });
    show("categories");
}

function chooseBolim(cat) {
    selectedBolim = cat;
    $("chosenBolim").textContent = `Tanlangan bo'lim: ${cat.name}`;
    $("fio").value = "";
    $("klass").value = "";
    checkBeginReady();
    show("start");
}

function checkBeginReady() {
    $("beginBtn").disabled = !($("fio").value.trim() && $("klass").value.trim());
}

function beginTest() {
    student = { fio: $("fio").value.trim(), klass: $("klass").value.trim() };
    startQuiz(selectedBolim);
}

// ---------- Test jarayoni ----------
function startQuiz(cat) {
    currentCategory = cat;
    const count = Math.min(MAX_PER_ATTEMPT, cat.questions.length);
    quiz = shuffle(cat.questions).slice(0, count).map(q => {
        const opts = q.o.map((text, i) => ({ text, ok: i === q.a }));
        return { opts: shuffle(opts), q: q.q };
    });
    idx = 0;
    answers = [];
    TOTAL_TIME = count * TIME_PER_Q;
    cheatLock = false;
    show("quiz");
    render();
    startTimer();
}

function startTimer() {
    remaining = TOTAL_TIME;
    updateTimerDisplay();
    clearInterval(timerInterval);
    timerInterval = setInterval(() => {
        remaining--;
        updateTimerDisplay();
        if (remaining <= 0) {
            clearInterval(timerInterval);
            finish();
        }
    }, 1000);
}

function updateTimerDisplay() {
    const m = String(Math.floor(remaining / 60)).padStart(2, "0");
    const s = String(remaining % 60).padStart(2, "0");
    $("timer").textContent = `⏱ ${m}:${s}`;
    $("timer").classList.toggle("low", remaining <= 60);
}

function render() {
    const q = quiz[idx];
    $("counter").textContent = `Savol ${idx + 1} / ${quiz.length}`;
    $("topic").textContent = currentCategory.name;
    $("fill").style.width = (idx / quiz.length) * 100 + "%";
    $("question").textContent = q.q;
    $("nextBtn").disabled = true;
    $("nextBtn").textContent = idx === quiz.length - 1 ? "Natijani ko'rish" : "Keyingi";
    $("options").innerHTML = "";
    q.opts.forEach((o, i) => {
        const b = document.createElement("button");
        b.className = "opt";
        b.textContent = o.text;
        b.onclick = () => choose(i);
        $("options").appendChild(b);
    });
}

function choose(i) {
    const q = quiz[idx];
    answers[idx] = i;
    [...$("options").children].forEach((b, k) => {
        b.disabled = true;
        if (q.opts[k].ok) b.classList.add("correct");
        else if (k === i) b.classList.add("wrong");
    });
    $("nextBtn").disabled = false;
}

function next() {
    if (++idx < quiz.length) render();
    else finish();
}

function finish() {
    clearInterval(timerInterval);
    const timeSpent = TOTAL_TIME - Math.max(remaining, 0);

    let score = 0;
    const wrong = [];
    quiz.forEach((q, i) => {
        const answered = answers[i] !== undefined;
        const ok = answered && q.opts[answers[i]].ok;
        if (ok) score++;
        else wrong.push({ q, i, answered });
    });

    const total = quiz.length;
    const pct = Math.round((score / total) * 100);
    const mm = String(Math.floor(timeSpent / 60)).padStart(2, "0");
    const ss = String(timeSpent % 60).padStart(2, "0");

    $("studentInfo").textContent = `${student.fio} — ${student.klass}-sinf — ${currentCategory.name}`;
    $("scoreNum").textContent = `${score} / ${total}`;
    $("scoreText").textContent =
        `${pct}% — ` + (pct >= 85 ? "A'lo! 🎉" : pct >= 70 ? "Yaxshi 👍" : pct >= 50 ? "Qoniqarli, yana mashq qiling" : "Mavzuni takrorlang 📚");
    $("timeText").textContent = `Sarflangan vaqt: ${mm}:${ss}`;

    $("review").innerHTML = wrong.length
        ? wrong.map(({ q, i, answered }) => `<div class="rev">${i + 1}. ${esc(q.q)}<br>Sizning javob: ${answered ? esc(q.opts[answers[i]].text) : "(javob berilmadi)"}<br>To'g'ri javob: <b>${esc(q.opts.find(o => o.ok).text)}</b></div>`).join("")
        : "<p>Xato yo'q, barcha javoblar to'g'ri! 🎯</p>";

    show("result");
    sendResults({ score, total, pct, mm, ss });
}

const esc = s => s.replace(/[&<>]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));

async function sendResults({ score, total, pct, mm, ss }) {
    const statusEl = $("sendStatus");
    statusEl.textContent = "Natija yuborilmoqda...";

    const now = new Date().toLocaleString("uz-UZ");
    const text =
        `📝 Test natijasi\n` +
        `👤 Ism-familya: ${student.fio}\n` +
        `🏫 Sinf: ${student.klass}\n` +
        `📂 Bo'lim: ${currentCategory.name}\n` +
        `✅ Natija: ${score}/${total} (${pct}%)\n` +
        `⏱ Vaqt: ${mm}:${ss}\n` +
        `📅 ${now}`;

    let telegramOk = false;
    let sheetOk = false;

    if (CONFIG.TELEGRAM_BOT_TOKEN && CONFIG.TELEGRAM_BOT_TOKEN !== "YOUR_BOT_TOKEN") {
        try {
            const url = `https://api.telegram.org/bot${CONFIG.TELEGRAM_BOT_TOKEN}/sendMessage`;
            const res = await fetch(url, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ chat_id: CONFIG.TELEGRAM_CHAT_ID, text }),
            });
            telegramOk = res.ok;
        } catch (e) { telegramOk = false; }
    }

    if (CONFIG.GOOGLE_SHEET_URL && CONFIG.GOOGLE_SHEET_URL !== "YOUR_APPS_SCRIPT_URL") {
        try {
            await fetch(CONFIG.GOOGLE_SHEET_URL, {
                method: "POST",
                mode: "no-cors",
                headers: { "Content-Type": "text/plain;charset=utf-8" },
                body: JSON.stringify({
                    fio: student.fio, klass: student.klass, bolim: currentCategory.name,
                    score, total, pct, vaqt: `${mm}:${ss}`, sana: now,
                }),
            });
            sheetOk = true;
        } catch (e) { sheetOk = false; }
    }

    if (!telegramOk && !sheetOk) statusEl.textContent = "⚠️ Hali Telegram/Sheets ulanmagan (CONFIG bo'sh).";
    else statusEl.textContent = "✅ Natija yuborildi.";
}

// ---------- Xavfsizlik: oyna/tab almashtirishni aniqlash ----------
function isQuizActive() {
    return !$("quiz").hidden;
}

function cheatReset() {
    if (cheatLock || !isQuizActive()) return;
    cheatLock = true;
    clearInterval(timerInterval);
    alert("Diqqat! Test davomida boshqa oyna yoki tabga o'tish taqiqlangan. Test qayta boshlanadi.");
    renderCategories();
    cheatLock = false;
}

document.addEventListener("visibilitychange", () => { if (document.hidden) cheatReset(); });
window.addEventListener("blur", cheatReset);
document.addEventListener("contextmenu", e => e.preventDefault());
document.addEventListener("selectstart", e => {
    if (e.target.tagName !== "INPUT" && e.target.tagName !== "TEXTAREA") e.preventDefault();
});

// ---------- Boshlash ----------
$("fio").oninput = checkBeginReady;
$("klass").oninput = checkBeginReady;
$("beginBtn").onclick = beginTest;
$("toCategoriesBtn").onclick = renderCategories;
$("nextBtn").onclick = next;
$("restartBtn").onclick = () => startQuiz(currentCategory);
$("backBtn").onclick = renderCategories;
load();
