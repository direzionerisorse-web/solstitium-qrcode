/* =========================================================
💎 Solstitium QR Manager — Check-in System 2025 FINAL
• Distinzione cliente / manager
• Aggiornamento Supabase checkin_at + stato + checkin_by
• Conferma visiva elegante + messaggio Telegram
========================================================= */

const SUPABASE_URL = "https://srnlpifcanveusghgqaa.supabase.co";
const SUPABASE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNybmxwaWZjYW52ZXVzZ2hncWFhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjExNjM0MjUsImV4cCI6MjA3NjczOTQyNX0.isY5dL5MIkL6tiIM3yKIkirpCYoOt9AliM1hs_nQEFs";

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// === Parametri URL ===
const params = new URLSearchParams(location.search);
const file = params.get("file");
const mgr = params.get("mgr");

// === Elementi DOM ===
const msgBox = document.getElementById("message");
const box = document.getElementById("checkin");

// === Codice Manager autorizzato ===
const MANAGER_CODE = "8008";

async function initCheckin() {
  if (!file) {
    msgBox.innerHTML = `<p class="warn">⚠️ Link QR non valido</p>`;
    return;
  }

  if (mgr !== MANAGER_CODE) {
    // — Cliente —
    msgBox.innerHTML = `
      <div class="locked">
        <p>🔒 QR riservato al sistema <strong>Solstitium</strong></p>
        <p>Nessuna azione richiesta.</p>
      </div>`;
    return;
  }

  // — Manager autenticato —
  msgBox.innerHTML = `<p class="loading">⏳ Verifica prenotazione...</p>`;

  try {
    // 1️⃣ Trova prenotazione dal QR_URL
    const qrUrl = `https://srnlpifcanveusghgqaa.supabase.co/storage/v1/object/public/qrcodes/${file}`;
    const { data, error } = await supabase
      .from("prenotazioni")
      .select("*")
      .eq("qr_url", qrUrl)
      .limit(1)
      .maybeSingle();

    if (error || !data) {
      msgBox.innerHTML = `<p class="warn">❌ Prenotazione non trovata</p>`;
      console.warn("Errore ricerca prenotazione:", error);
      return;
    }

    const { id, nome, data: dataPren, ora, tavolo, pax, checkin_at } = data;

    // 2️⃣ Se già fatto
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
      return;
    }

    // 3️⃣ Aggiorna check-in
    const now = new Date().toISOString();
    const update = {
      checkin_at: now,
      stato: "ARRIVATO",
      checkin_by: MANAGER_CODE,
    };

    const { error: updErr } = await supabase
      .from("prenotazioni")
      .update(update)
      .eq("id", id);

    if (updErr) throw updErr;

    // 4️⃣ Conferma visiva
    const oraNow = new Date().toLocaleTimeString("it-IT", {
      hour: "2-digit",
      minute: "2-digit",
    });
    box.innerHTML = `
      <div class="success">
        <div class="checkmark">✔️</div>
        <h1>Check-in registrato</h1>
        <p>${nome}</p>
        <p>${dataPren} — ${oraNow}</p>
        <p>Tavolo ${tavolo || "-"} · ${pax || 0} pax</p>
      </div>`;
    msgBox.innerHTML = "";

    // 5️⃣ Messaggio Telegram elegante e conciso
    const message = `💫 *${nome} — Tav. ${tavolo || "-"} · ${oraNow} · ARRIVATO*`;
    if (typeof sendTelegramMessage === "function") {
      await sendTelegramMessage(message);
      console.log("📩 Notifica Telegram inviata:", message);
    }
  } catch (err) {
    console.error("Errore check-in manager:", err);
    msgBox.innerHTML = `<p class="warn">❌ Errore durante il check-in</p>`;
  }
}

document.addEventListener("DOMContentLoaded", initCheckin);
