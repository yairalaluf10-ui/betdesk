// Publishable key: safe to expose in the browser; access is enforced by RLS in the database.
const SUPABASE_URL = "https://qxbykerknlkszuuquofi.supabase.co";
const SUPABASE_KEY = "sb_publishable_teSW7gnwOzrNgfcrUmR4rg_blp6O3Ct";

const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const BET_TYPES = ["1X2", "מעל/מתחת", "תוצאה מדויקת", "הימור משולב", "מבקיע ראשון", "הנדיקפ"];
const ROLE_LABELS = { admin: "מנהל (admin)", staff: "צפייה (staff)", "": "ללא הרשאה" };
const DOC_LABELS = { id_card: "תעודת זהות", passport: "דרכון" };
const DOC_BUCKET = "id-documents";
const DOC_MAX_BYTES = 5 * 1024 * 1024;
const DOC_MIME = ["image/jpeg", "image/png", "image/webp", "application/pdf"];

const state = {
  customers: [], months: [], league: "", bet: "", search: "", adminSearch: "",
  selectedId: null, role: "", userId: null, editingId: null, docsCustomerId: null,
};

const $ = (id) => document.getElementById(id);
const money = (n) => "₪" + Number(n).toLocaleString("he-IL", { maximumFractionDigits: 0 });
const monthLabel = (m) => new Date(m).toLocaleDateString("he-IL", { month: "short", year: "2-digit" });
const dateLabel = (d) => (d ? new Date(d).toLocaleString("he-IL", { dateStyle: "short", timeStyle: "short" }) : "—");
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const totalOf = (c) => Object.values(c.volumes).reduce((a, b) => a + b, 0);

// the three most recent months, as YYYY-MM-01 strings
function recentMonths(n = 3) {
  const now = new Date();
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (n - 1 - i), 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
  });
}

let toastTimer;
function toast(msg, isError = false) {
  const t = $("toast");
  t.textContent = msg;
  t.classList.toggle("error", isError);
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (t.hidden = true), 3500);
}

// ---------- data ----------

async function load() {
  const { data, error } = await db
    .from("customers")
    // customer_documents is admin-only under RLS; for staff it comes back as an empty array
    .select("id, name, email, preferred_league, preferred_bets(bet_type), bet_volumes(month, amount), customer_documents(id, doc_type, file_name, storage_path, uploaded_at)")
    .order("id");

  if (error) {
    $("rows").innerHTML = `<div class="state error">שגיאה בטעינת הנתונים: ${esc(error.message)}</div>`;
    return;
  }
  if (!state.role) {
    // RLS returns no rows for signed-in users without a staff/admin role
    $("rows").innerHTML = `<div class="state error">למשתמש הזה אין הרשאת צפייה בנתונים.</div>`;
    return;
  }

  const months = new Set();
  state.customers = data.map((c) => {
    const pb = Array.isArray(c.preferred_bets) ? c.preferred_bets[0] : c.preferred_bets;
    const volumes = {};
    for (const v of c.bet_volumes) { volumes[v.month] = Number(v.amount); months.add(v.month); }
    const documents = [...(c.customer_documents || [])].sort((a, b) => b.uploaded_at.localeCompare(a.uploaded_at));
    return { ...c, bet_type: pb ? pb.bet_type : "—", volumes, documents };
  });
  state.months = months.size ? [...months].sort() : recentMonths();

  renderFilters();
  render();
  const selected = state.customers.find((c) => c.id === state.selectedId);
  if (selected) showSlip(selected);
  else { state.selectedId = null; $("slipBody").innerHTML = `<p class="muted">בחרו לקוח מהרשימה כדי לראות את הפרטים שלו.</p>`; }
  if (state.role === "admin") renderAdminCustomers();
  if (state.docsCustomerId && $("docsDialog").open) renderDocs();
}

function countBy(key) {
  const counts = {};
  for (const c of state.customers) counts[c[key]] = (counts[c[key]] || 0) + 1;
  return Object.entries(counts).sort((a, b) => b[1] - a[1]);
}

// ---------- dashboard ----------

function renderFilters() {
  const leagues = countBy("preferred_league");
  $("leagueList").innerHTML =
    `<li class="${state.league ? "" : "active"}" data-league=""><span>כל הליגות</span><b>${state.customers.length}</b></li>` +
    leagues.map(([l, n]) => `<li class="${state.league === l ? "active" : ""}" data-league="${esc(l)}"><span>${esc(l)}</span><b>${n}</b></li>`).join("");

  $("betTypeTabs").innerHTML =
    `<button class="tab ${state.bet ? "" : "active"}" data-bet="">כל סוגי ההימור</button>` +
    countBy("bet_type").map(([b]) => `<button class="tab ${state.bet === b ? "active" : ""}" data-bet="${esc(b)}">${esc(b)}</button>`).join("");

  $("monthHeads").innerHTML = state.months.map((m) => `<div>${monthLabel(m)}</div>`).join("");
  $("leagueOptions").innerHTML = leagues.map(([l]) => `<option value="${esc(l)}">`).join("");
}

function filtered() {
  return state.customers.filter((c) =>
    (!state.league || c.preferred_league === state.league) &&
    (!state.bet || c.bet_type === state.bet) &&
    (!state.search || c.name.toLowerCase().includes(state.search) || c.email.toLowerCase().includes(state.search))
  );
}

function statsHtml(list) {
  const lastMonth = state.months[state.months.length - 1];
  const totalLast = list.reduce((s, c) => s + (c.volumes[lastMonth] || 0), 0);
  const totalAll = list.reduce((s, c) => s + totalOf(c), 0);
  const top = [...list].sort((a, b) => (b.volumes[lastMonth] || 0) - (a.volumes[lastMonth] || 0))[0];
  return `
    <div class="stat"><div class="label">לקוחות</div><div class="value">${list.length}</div></div>
    <div class="stat"><div class="label">מחזור ${lastMonth ? monthLabel(lastMonth) : ""}</div><div class="value gold">${money(totalLast)}</div></div>
    <div class="stat"><div class="label">מחזור ${state.months.length} חודשים</div><div class="value">${money(totalAll)}</div></div>
    <div class="stat"><div class="label">המהמר המוביל החודש</div><div class="value" style="font-size:17px">${top ? esc(top.name) : "—"}</div></div>`;
}

function render() {
  const list = filtered();
  $("stats").innerHTML = statsHtml(list);

  if (!list.length) {
    $("rows").innerHTML = `<div class="state">לא נמצאו לקוחות שמתאימים לסינון.</div>`;
    return;
  }

  $("rows").innerHTML = list.map((c) => {
    const cells = state.months.map((m, i) => {
      const v = c.volumes[m];
      const prev = i > 0 ? c.volumes[state.months[i - 1]] : undefined;
      const trend = v === undefined || prev === undefined ? "" : v >= prev ? '<small class="up">▲</small>' : '<small class="down">▼</small>';
      return `<div class="odds">${v === undefined ? "—" : money(v)}${trend}</div>`;
    }).join("");
    return `
      <div class="row ${c.id === state.selectedId ? "selected" : ""}" data-id="${c.id}">
        <div class="who">
          <div class="name">${esc(c.name)}</div>
          <div class="meta"><span class="pill">${esc(c.preferred_league)}</span><span class="pill bet">${esc(c.bet_type)}</span></div>
        </div>
        <div class="col-odds">${cells}</div>
      </div>`;
  }).join("");
}

function showSlip(c) {
  const values = state.months.map((m) => c.volumes[m] || 0);
  const max = Math.max(...values, 1);
  $("slipBody").innerHTML = `
    <h4>${esc(c.name)}</h4>
    <div class="email">${esc(c.email)}</div>
    <dl>
      <dt>מזהה</dt><dd>#${c.id}</dd>
      <dt>ליגה מועדפת</dt><dd>${esc(c.preferred_league)}</dd>
      <dt>הימור מועדף</dt><dd>${esc(c.bet_type)}</dd>
    </dl>
    <div class="muted">מחזור הימורים חודשי</div>
    <div class="bars">
      ${state.months.map((m, i) => `
        <div class="bar">
          <span>${monthLabel(m)}</span>
          <div class="track"><div class="fill" style="width:${(values[i] / max) * 100}%"></div></div>
          <span class="amt">${money(values[i])}</span>
        </div>`).join("")}
    </div>
    <div class="total"><span>סה״כ</span><span>${money(totalOf(c))}</span></div>
    ${state.role === "admin" ? `
      <div class="slip-docs">
        <div class="muted">אמצעי זיהוי</div>
        ${c.documents.map((d) => `
          <button data-view-doc="${esc(d.storage_path)}"><span>${DOC_LABELS[d.doc_type]}</span><span>צפייה ↗</span></button>`).join("")
          || `<p class="muted small">לא הועלו מסמכים.</p>`}
      </div>` : ""}`;
}

$("slipBody").addEventListener("click", (e) => {
  const btn = e.target.closest("[data-view-doc]");
  if (btn) viewDoc(btn.dataset.viewDoc);
});

$("leagueList").addEventListener("click", (e) => {
  const li = e.target.closest("li");
  if (!li) return;
  state.league = li.dataset.league;
  renderFilters();
  render();
});

$("betTypeTabs").addEventListener("click", (e) => {
  const b = e.target.closest(".tab");
  if (!b) return;
  state.bet = b.dataset.bet;
  renderFilters();
  render();
});

$("search").addEventListener("input", (e) => {
  state.search = e.target.value.trim().toLowerCase();
  render();
});

$("rows").addEventListener("click", (e) => {
  const row = e.target.closest(".row");
  if (!row) return;
  state.selectedId = Number(row.dataset.id);
  render();
  showSlip(state.customers.find((c) => c.id === state.selectedId));
});

// ---------- views ----------

function showView(view) {
  const isAdmin = view === "admin" && state.role === "admin";
  $("dashView").hidden = isAdmin;
  $("adminView").hidden = !isAdmin;
  $("search").parentElement.hidden = isAdmin;
  document.querySelectorAll("#mainNav a").forEach((a) => a.classList.toggle("active", a.dataset.view === (isAdmin ? "admin" : "dash")));
  if (isAdmin) { renderAdminCustomers(); loadUsers(); }
}

$("mainNav").addEventListener("click", (e) => {
  const a = e.target.closest("a[data-view]");
  if (!a) return;
  e.preventDefault();
  showView(a.dataset.view);
});

// ---------- admin: customers ----------

function renderAdminCustomers() {
  $("adminStats").innerHTML = statsHtml(state.customers);
  const q = state.adminSearch;
  const list = state.customers.filter((c) => !q || c.name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q));
  $("adminCustomers").innerHTML = list.map((c) => `
    <tr>
      <td>${c.id}</td>
      <td>${esc(c.name)}</td>
      <td>${esc(c.email)}</td>
      <td>${esc(c.preferred_league)}</td>
      <td>${esc(c.bet_type)}</td>
      <td class="num">${money(totalOf(c))}</td>
      <td>
        <span class="doc-count ${c.documents.length ? "has" : ""}">${c.documents.length}</span>
        <button class="btn-sm" data-docs="${c.id}">מסמכים</button>
      </td>
      <td class="actions">
        <button class="btn-sm" data-edit="${c.id}">עריכה</button>
        <button class="btn-sm danger" data-del="${c.id}">מחיקה</button>
      </td>
    </tr>`).join("") || `<tr><td colspan="8" class="muted">אין לקוחות להצגה.</td></tr>`;
}

$("adminSearch").addEventListener("input", (e) => {
  state.adminSearch = e.target.value.trim().toLowerCase();
  renderAdminCustomers();
});

$("adminCustomers").addEventListener("click", async (e) => {
  const edit = e.target.closest("[data-edit]");
  const del = e.target.closest("[data-del]");
  const docs = e.target.closest("[data-docs]");
  if (edit) openCustomerDialog(state.customers.find((c) => c.id === Number(edit.dataset.edit)));
  if (docs) openDocsDialog(Number(docs.dataset.docs));
  if (del) {
    const c = state.customers.find((x) => x.id === Number(del.dataset.del));
    if (!confirm(`למחוק את ${c.name}? הפעולה תמחק גם את ההימור המועדף, נתוני המחזור ואמצעי הזיהוי שלו.`)) return;
    // files are not removed by the FK cascade, so delete them from storage first
    if (c.documents.length) {
      const { error } = await db.storage.from(DOC_BUCKET).remove(c.documents.map((d) => d.storage_path));
      if (error) return toast(`מחיקת הקבצים נכשלה: ${error.message}`, true);
    }
    const { data, error } = await db.from("customers").delete().eq("id", c.id).select("id");
    if (error || !data.length) return toast(error ? error.message : "המחיקה נחסמה (אין הרשאה).", true);
    toast(`${c.name} נמחק/ה.`);
    load();
  }
});

$("addCustomerBtn").addEventListener("click", () => openCustomerDialog(null));
$("cancelCustomer").addEventListener("click", () => $("customerDialog").close());

function openCustomerDialog(c) {
  state.editingId = c ? c.id : null;
  $("customerDialogTitle").textContent = c ? `עריכת לקוח #${c.id}` : "לקוח חדש";
  $("fName").value = c ? c.name : "";
  $("fEmail").value = c ? c.email : "";
  $("fLeague").value = c ? c.preferred_league : "";
  $("fBet").innerHTML = BET_TYPES.map((b) => `<option ${c && c.bet_type === b ? "selected" : ""}>${esc(b)}</option>`).join("");
  $("fVolumes").innerHTML = state.months.map((m) => `
    <label>${monthLabel(m)}<input type="number" min="0" step="0.01" data-month="${m}" value="${c && c.volumes[m] !== undefined ? c.volumes[m] : 0}" required></label>`).join("");
  $("customerError").textContent = "";
  $("customerDialog").showModal();
}

$("customerForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const btn = e.submitter;
  btn.disabled = true;
  $("customerError").textContent = "";
  try {
    await saveCustomer();
    $("customerDialog").close();
    toast("הלקוח נשמר.");
    load();
  } catch (err) {
    $("customerError").textContent = err.code === "23505" ? "כבר קיים לקוח עם האימייל הזה." : err.message;
  } finally {
    btn.disabled = false;
  }
});

async function saveCustomer() {
  const payload = {
    name: $("fName").value.trim(),
    email: $("fEmail").value.trim().toLowerCase(),
    preferred_league: $("fLeague").value.trim(),
  };

  let id = state.editingId;
  if (id) {
    const { error } = await db.from("customers").update(payload).eq("id", id);
    if (error) throw error;
  } else {
    const { data, error } = await db.from("customers").insert(payload).select("id").single();
    if (error) throw error;
    id = data.id;
  }

  const bet = await db.from("preferred_bets").upsert({ customer_id: id, bet_type: $("fBet").value }, { onConflict: "customer_id" });
  if (bet.error) throw bet.error;

  const volumes = [...$("fVolumes").querySelectorAll("input")].map((i) => ({
    customer_id: id, month: i.dataset.month, amount: Number(i.value),
  }));
  const vol = await db.from("bet_volumes").upsert(volumes, { onConflict: "customer_id,month" });
  if (vol.error) throw vol.error;
}

// ---------- admin: ID documents (Supabase Storage) ----------

function openDocsDialog(customerId) {
  state.docsCustomerId = customerId;
  $("docFile").value = "";
  $("docsError").textContent = "";
  renderDocs();
  $("docsDialog").showModal();
}

function renderDocs() {
  const c = state.customers.find((x) => x.id === state.docsCustomerId);
  if (!c) return $("docsDialog").close();
  $("docsDialogTitle").textContent = `אמצעי זיהוי — ${c.name}`;
  $("docsList").innerHTML = c.documents.map((d) => `
    <li>
      <span class="doc-icon">${d.doc_type === "passport" ? "🛂" : "🪪"}</span>
      <div class="doc-info">
        <div class="doc-name">${DOC_LABELS[d.doc_type]} · ${esc(d.file_name)}</div>
        <div class="doc-meta">הועלה ${dateLabel(d.uploaded_at)}</div>
      </div>
      <button type="button" class="btn-sm" data-view-doc="${esc(d.storage_path)}">צפייה</button>
      <button type="button" class="btn-sm danger" data-del-doc="${d.id}">מחיקה</button>
    </li>`).join("") || `<li class="empty">לא הועלו מסמכים ללקוח הזה.</li>`;
}

// private bucket: files are opened through a short-lived signed URL
async function viewDoc(path) {
  const win = window.open("", "_blank"); // open synchronously so the popup isn't blocked
  const { data, error } = await db.storage.from(DOC_BUCKET).createSignedUrl(path, 60);
  if (error) { win?.close(); return toast(`פתיחת הקובץ נכשלה: ${error.message}`, true); }
  if (win) { win.opener = null; win.location = data.signedUrl; }
  else location.assign(data.signedUrl);
}

$("docsList").addEventListener("click", async (e) => {
  const view = e.target.closest("[data-view-doc]");
  const del = e.target.closest("[data-del-doc]");
  if (view) viewDoc(view.dataset.viewDoc);
  if (del) {
    const c = state.customers.find((x) => x.id === state.docsCustomerId);
    const doc = c.documents.find((d) => d.id === Number(del.dataset.delDoc));
    if (!confirm(`למחוק את ${DOC_LABELS[doc.doc_type]} (${doc.file_name})?`)) return;
    const removed = await db.storage.from(DOC_BUCKET).remove([doc.storage_path]);
    if (removed.error) return toast(removed.error.message, true);
    const { error } = await db.from("customer_documents").delete().eq("id", doc.id);
    if (error) return toast(error.message, true);
    toast("המסמך נמחק.");
    load();
  }
});

$("closeDocs").addEventListener("click", () => $("docsDialog").close());

$("docsForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  $("docsError").textContent = "";
  const file = $("docFile").files[0];
  if (!file) return;
  if (!DOC_MIME.includes(file.type)) return ($("docsError").textContent = "סוג קובץ לא נתמך. אפשר להעלות JPG, PNG, WEBP או PDF.");
  if (file.size > DOC_MAX_BYTES) return ($("docsError").textContent = "הקובץ גדול מ-5MB.");

  const btn = $("uploadDocBtn");
  btn.disabled = true;
  btn.textContent = "מעלה…";
  try {
    const ext = file.name.includes(".") ? file.name.split(".").pop().toLowerCase() : "bin";
    const path = `${state.docsCustomerId}/${crypto.randomUUID()}.${ext}`;
    const up = await db.storage.from(DOC_BUCKET).upload(path, file, { contentType: file.type, upsert: false });
    if (up.error) throw up.error;

    const { error } = await db.from("customer_documents").insert({
      customer_id: state.docsCustomerId, doc_type: $("docType").value, storage_path: path, file_name: file.name,
    });
    if (error) {
      await db.storage.from(DOC_BUCKET).remove([path]); // don't leave an orphaned file behind
      throw error;
    }
    $("docFile").value = "";
    toast("המסמך הועלה.");
    load();
  } catch (err) {
    $("docsError").textContent = `ההעלאה נכשלה: ${err.message}`;
  } finally {
    btn.disabled = false;
    btn.textContent = "העלאה";
  }
});

// ---------- admin: users ----------

async function loadUsers() {
  $("adminUsers").innerHTML = `<tr><td colspan="4" class="muted">טוען…</td></tr>`;
  const { data, error } = await db.rpc("admin_list_users");
  if (error) {
    $("adminUsers").innerHTML = `<tr><td colspan="4" class="auth-error">${esc(error.message)}</td></tr>`;
    return;
  }
  $("adminUsers").innerHTML = data.map((u) => {
    const self = u.id === state.userId;
    const options = Object.entries(ROLE_LABELS)
      .map(([r, label]) => `<option value="${r}" ${(u.role || "") === r ? "selected" : ""}>${label}</option>`).join("");
    return `
      <tr>
        <td>${esc(u.email)}${self ? '<span class="you">(את/ה)</span>' : ""}</td>
        <td><select data-user="${u.id}" ${self ? "disabled title='לא ניתן לשנות את התפקיד של עצמך'" : ""}>${options}</select></td>
        <td>${dateLabel(u.created_at)}</td>
        <td>${dateLabel(u.last_sign_in_at)}</td>
      </tr>`;
  }).join("");
}

$("adminUsers").addEventListener("change", async (e) => {
  const sel = e.target.closest("select[data-user]");
  if (!sel) return;
  const { error } = await db.rpc("admin_set_user_role", { target_user: sel.dataset.user, new_role: sel.value || null });
  if (error) toast(error.message, true);
  else toast("התפקיד עודכן.");
  loadUsers();
});

// ---------- auth ----------

let loaded = false;

const AUTH_ERRORS = {
  invalid_credentials: "אימייל או סיסמה שגויים.",
  same_password: "הסיסמה החדשה חייבת להיות שונה מהסיסמה הזמנית.",
  weak_password: "הסיסמה חלשה מדי. יש לבחור סיסמה של 10 תווים לפחות.",
  over_request_rate_limit: "יותר מדי ניסיונות. נסו שוב בעוד כמה דקות.",
};
const authError = (err) => AUTH_ERRORS[err.code] || err.message;

function route(session) {
  const mustChange = session && session.user.user_metadata?.must_change_password;
  $("authView").hidden = Boolean(session && !mustChange);
  $("loginForm").hidden = Boolean(session);
  $("changeForm").hidden = !mustChange;
  $("appView").hidden = !session || mustChange;

  if (session && !mustChange) {
    // UI only; the database enforces roles through RLS
    state.role = session.user.app_metadata?.role || "";
    state.userId = session.user.id;
    $("userEmail").textContent = session.user.email;
    $("adminLink").hidden = state.role !== "admin";
    if (!loaded) { loaded = true; load(); }
  }
}

// defer: calling other supabase methods directly inside this callback can deadlock
db.auth.onAuthStateChange((_event, session) => setTimeout(() => route(session), 0));

$("loginForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const btn = e.submitter;
  btn.disabled = true;
  $("loginError").textContent = "";
  const { error } = await db.auth.signInWithPassword({
    email: $("loginEmail").value.trim(),
    password: $("loginPassword").value,
  });
  btn.disabled = false;
  if (error) $("loginError").textContent = authError(error);
});

$("changeForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  $("changeError").textContent = "";
  const pw = $("newPassword").value;
  if (pw !== $("newPassword2").value) {
    $("changeError").textContent = "הסיסמאות אינן תואמות.";
    return;
  }
  const btn = e.submitter;
  btn.disabled = true;
  const { error } = await db.auth.updateUser({ password: pw, data: { must_change_password: false } });
  btn.disabled = false;
  if (error) $("changeError").textContent = authError(error);
});

$("logoutBtn").addEventListener("click", async () => {
  await db.auth.signOut();
  location.reload();
});
