/* =========================================================
💎 Solstitium QR Manager — Check-in System 2025 FINAL v2.8
• Modalità doppia (cliente / manager)
• Manager Mode permanente (finché non viene disattivata)
• Badge visivo 👑 in alto a destra
• Telegram breve ed elegante
========================================================= */

const SUPABASE_URL = "https://srnlpifcanveusghgqaa.supabase.co";
const SUPABASE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNybmxwaWZjYW52ZXVzZ2hncWFhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjExNjM0MjUsImV4cCI6MjA3NjczOTQyNX0.isY5dL5MIkL6tiIM3yKIkirpCYoOt9AliM1hs_nQEFs";

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const params = new URLSearchParams(location.search);
const file = params.get("file");
const mgr  = params.get("mgr");

const MANAGER_CODE = "8008";
const MGR_FLAG_KEY = "SLS_MGR_AUTH_PERM"; // sessione permanente

const TELEGRAM_TOKEN = "7578879852:AAENCFfDGha7cqqzFoYogtwhtqtb56rmY40";
const TELEGRAM_CHAT_ID = "-4806269233";

const msgBox = document.getElementById("message");
const box    = document.getElementById("checkin");

// ===== Gestione Manager Mode =====
function activateManagerSession() { localStorage.setItem(MGR_FLAG_KEY, "true"); }
function isManagerSession() { return localStorage.getItem(MGR_FLAG_KEY) === "true"; }
function clearManagerSession() { localStorage.removeItem(MGR_FLAG_KEY); }

if (mgr === MANAGER_CODE) activateManagerSession();
function isManager() { return mgr === MANAGER_CODE || isManagerSession(); }

// ===== Badge visivo in alto a destra =====
function showManagerBadge() {
  if (!isManagerSession()) return;
  const badge = document.createElement("div");
  badge.textContent = "👑 Manager attivo";
  Object.assign(badge.style, {
    position: "fixed",
    top: "12px",
    right: "14px",
    background: "rgba(212,175,55,0.12)",
    color: "#d4af37",
    border: "1px solid rgba(212,175,55,0.35)",
    padding: "6px 12px",
    borderRadius: "10px",
    fontSize: "0.85rem",
    fontWeight: "600",
    letterSpacing: "0.3px",
    zIndex: 9999,
    backdropFilter: "blur(4px)",
    boxShadow: "0 0 8px rgba(212,175,55,0.25)"
  });
  document.body.appendChild(badge);
}

// ===== Pulsante Esci Manager =====
function mountExitButtonIfManager() {
  if (!isManagerSession()) return;
  const btn = document.createElement("button");
  btn.textContent = "🔓 Esci manager";
  Object.assign(btn.style, {
    position: "fixed",
    right: "16px",
    bottom: "16px",
    background: "#222",
    color: "#ffd766",
    border: "1px solid #444",
    borderRadius: "12px",
    padding: "10px 14px",
    cursor: "pointer",
    zIndex: 9999,
    boxShadow: "0 0 12px rgba(212,175,55,0.35)",
  });
  btn.onclick = () => { clearManagerSession(); location.reload(); };
  document.body.appendChild(btn);
}

// ===== Telegram helper =====
async function notifyTelegram(message) {
  try {
    if (typeof window.sendTelegramMessage === "function") {
      await window.sendTelegramMessage(message);
      return;
    }
    await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: TELEGRAM_CHAT_ID,
        text: message,
        parse_mode: "Markdown",
      }),
    });
  } catch (e) {
    console.warn("Telegram notify error:", e);
  }
}

// ===== MAIN LOGIC =====
async function initCheckin() {
  if (!file) {
    msgBox.innerHTML = `<p class="warn">⚠️ Link QR non valido</p>`;
    return;
  }

  const qrUrl = `${SUPABASE_URL}/storage/v1/object/public/qrcodes/${file}`;

  // --- CLIENTE / VISUALIZZATORE ---
  if (!isManager()) {
    msgBox.innerHTML = `
      <div class="locked" style="margin-bottom:14px">
        <p>🔒 QR riservato al sistema <strong>Solstitium</strong></p>
        <p>Nessuna azione richiesta.</p>
      </div>`;
    box.innerHTML = `
      <img src="${qrUrl}" alt="Solstitium QR"
           style="width:280px;height:280px;border-radius:16px;box-shadow:0 0 25px rgba(212,175,55,0.35);" />`;
    mountExitButtonIfManager();
    showManagerBadge();
    return;
  }

  // --- MANAGER AUTENTICATO ---
  msgBox.innerHTML = `<p class="loading">⏳ Verifica prenotazione...</p>`;

  try {
    const { data: row, error: findErr } = await supabase
      .from("prenotazioni")
      .select("*")
      .eq("qr_url", qrUrl)
      .limit(1)
      .maybeSingle();

    if (findErr || !row) {
      msgBox.innerHTML = `<p class="warn">❌ Prenotazione non trovata</p>`;
      console.warn("Errore ricerca prenotazione:", findErr);
      mountExitButtonIfManager();
      showManagerBadge();
      return;
    }

    const { id, nome, data: dataPren, ora, tavolo, pax, checkin_at } = row;

    if (checkin_at) {
      const oraIT = new Date(checkin_at).toLocaleTimeString("it-IT", {
        hour: "2-digit",
        minute: "2-digit",
      });
      box.innerHTML = `
        <div class="already">
          <h1>⚠️ Già registrato</h1>
          <p>${nome}</p>
          <p>${dataPren} — ${ora} · Tav. ${tavolo || "-"}</p>
          <p>Check-in alle ${oraIT}</p>
        </div>`;
      msgBox.innerHTML = "";
      mountExitButtonIfManager();
      showManagerBadge();
      return;
    }

    const nowISO = new Date().toISOString();
    const { error: updErr } = await supabase
      .from("prenotazioni")
      .update({
        stato: "ARRIVATO",
        checkin_at: nowISO,
        checkin_by: MANAGER_CODE,
      })
      .eq("id", id);

    if (updErr) throw updErr;

    const oraNow = new Date().toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });
    box.innerHTML = `
      <div class="success">
        <div class="checkmark">✔️</div>
        <h1>Check-in registrato</h1>
        <p>${nome}</p>
        <p>${dataPren} — ${oraNow}</p>
        <p>Tavolo ${tavolo || "-"} · ${pax || 0} pax</p>
      </div>`;
    msgBox.innerHTML = "";

    const tMsg = `💫 *${nome}* — Tav. ${tavolo || "-"} · ${oraNow} · ARRIVATO`;
    await notifyTelegram(tMsg);

    mountExitButtonIfManager();
    showManagerBadge();

  } catch (err) {
    console.error("Errore check-in manager:", err);
    msgBox.innerHTML = `<p class="warn">❌ Errore durante il check-in</p>`;
    mountExitButtonIfManager();
    showManagerBadge();
  }
}

document.addEventListener("DOMContentLoaded", initCheckin);
