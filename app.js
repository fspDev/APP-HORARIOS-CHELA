(function () {
  "use strict";

  const DAYS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
  const MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
  const COLORS = ["#F6A7C1", "#FFD27A", "#E3C0AE", "#F2DFA0", "#E9B4C8", "#F5B94A", "#F3D1DC", "#D9A98C"];
  const DEFAULT_SLOTS = ["08:00-16:00", "11:00-15:00", "12:00-16:00", "15:00-19:00", "16:00-00:00", "19:00-00:00", "20:00-00:00"];
  const LIBRE = "libre";

  const K_EMP = "horarios_employees_v1";
  const K_SLOTS = "horarios_slots_v2";
  const K_WEEKS = "horarios_weeks_v2";

  function load(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) { return fallback; }
  }
  function save(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) {}
  }

  let employees = load(K_EMP, []);
  let slots = load(K_SLOTS, DEFAULT_SLOTS.slice());
  let weeks = load(K_WEEKS, {});

  // ---------- Fechas ----------
  const pad = n => String(n).padStart(2, "0");
  const iso = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  function addDays(d, n) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
  function mondayOf(d) {
    const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    x.setDate(x.getDate() - (x.getDay() + 6) % 7);
    return x;
  }
  function fromIso(s) { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); }

  let weekStart = mondayOf(new Date());
  try {
    const saved = sessionStorage.getItem("horarios_semana");
    if (saved) weekStart = fromIso(saved);
  } catch (e) {}
  function setWeek(d) {
    weekStart = d;
    try { sessionStorage.setItem("horarios_semana", iso(d)); } catch (e) {}
  }

  function weekLabel(ws) {
    const end = addDays(ws, 6);
    if (ws.getMonth() === end.getMonth()) return `${ws.getDate()} al ${end.getDate()} de ${MONTHS[end.getMonth()]}`;
    return `${ws.getDate()} de ${MONTHS[ws.getMonth()]} al ${end.getDate()} de ${MONTHS[end.getMonth()]}`;
  }
  const dateOf = day => addDays(weekStart, day);
  const fullDate = day => { const d = dateOf(day); return `${d.getDate()} de ${MONTHS[d.getMonth()]}`; };
  const isToday = day => iso(dateOf(day)) === iso(new Date());

  // ---------- Horarios ----------
  function hourText(t) {
    const [h, m] = t.split(":");
    const hh = h === "00" ? "00" : String(Number(h));
    return m === "00" ? hh : `${hh}:${m}`;
  }
  function slotText(key) {
    if (key === LIBRE) return "Libre";
    const [a, b] = key.split("-");
    return `${hourText(a)} a ${hourText(b)}`;
  }
  function slotMinutes(key) {
    if (key === LIBRE) return 99999;
    const [h, m] = key.split("-")[0].split(":").map(Number);
    return h * 60 + m;
  }

  // ---------- Datos de la semana ----------
  function dayData(ws, day) {
    const w = weeks[iso(ws)];
    return (w && w[day]) || {};
  }
  // Cada persona puede tener varios horarios por día; "libre" va solo.
  function valuesOf(data, empId) {
    const v = data[empId];
    if (!v) return [];
    return (Array.isArray(v) ? v : [v]).slice().sort((a, b) => slotMinutes(a) - slotMinutes(b));
  }
  function setAssignment(day, empId, values) {
    const k = iso(weekStart);
    weeks[k] = weeks[k] || {};
    weeks[k][day] = weeks[k][day] || {};
    if (values.length) weeks[k][day][empId] = values;
    else delete weeks[k][day][empId];
    save(K_WEEKS, weeks);
  }
  function dayStatus(day) {
    const data = dayData(weekStart, day);
    const assigned = employees.filter(e => data[e.id]).length;
    if (assigned === 0) return { kind: "none", missing: employees.length };
    if (assigned === employees.length) return { kind: "done", missing: 0 };
    return { kind: "partial", missing: employees.length - assigned };
  }

  // ---------- Utilidades ----------
  function esc(str) {
    return String(str).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }
  function nextColor() {
    const used = employees.map(e => e.color);
    return COLORS.find(c => !used.includes(c)) || COLORS[employees.length % COLORS.length];
  }
  const empById = id => employees.find(e => e.id === id);

  const ICON = {
    left: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>',
    right: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l6-6-6-6"/></svg>',
    arrow: '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
    check: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
    x: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>',
    person: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="8" r="4"/><path d="M2 21c0-3.9 3.1-7 7-7s7 3.1 7 7"/><path d="M19 8v6M16 11h6"/></svg>',
    send: '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4 20-7z"/></svg>',
    copy: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></svg>',
    download: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4v11M7 10l5 5 5-5M5 20h14"/></svg>',
    info: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><path d="M12 7v6M12 16.5v.5"/></svg>',
    warn: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3L2 21h20L12 3z"/><path d="M12 10v5M12 18v.5"/></svg>'
  };

  const app = document.getElementById("app");

  // ---------- Pantallas ----------
  function screenWeek() {
    let days = "";
    if (employees.length === 0) {
      days = `<div class="empty-card"><p>Primero agregá a las personas que trabajan.</p>
        <a class="btn-main btn-blue" href="#personas">${ICON.person} Agregar personas</a></div>`;
    } else {
      days = '<div class="list">' + DAYS.map((name, i) => {
        const st = dayStatus(i);
        const status = st.kind === "done" ? `<span class="status done">${ICON.check} Listo</span>`
          : st.kind === "partial" ? `<span class="status partial">Faltan ${st.missing}</span>`
          : `<span class="status none">Sin cargar</span>`;
        return `<a class="row${isToday(i) ? " today" : ""}" href="#dia-${i}">
          <span class="day"><b>${name}</b> ${dateOf(i).getDate()}</span>
          ${isToday(i) ? '<span class="badge">HOY</span>' : ""}
          ${status}</a>`;
      }).join("") + "</div>";
    }
    return `
      <header class="top">
        <h1>Horarios del personal</h1>
        <a class="btn-out" href="#personas">${ICON.person} Personas</a>
      </header>
      <div class="week-card">
        <button class="nav-btn" data-act="prev" aria-label="Semana anterior">${ICON.left}</button>
        <div class="label"><small>Semana del</small><strong>${weekLabel(weekStart)}</strong></div>
        <button class="nav-btn" data-act="next" aria-label="Semana siguiente">${ICON.right}</button>
      </div>
      <p class="hint">Tocá un día para cargar quién trabaja.</p>
      ${days}
      <div class="spacer"></div>
      ${employees.length ? `<a class="btn-main btn-green" href="#enviar">${ICON.send} Enviar por WhatsApp</a>` : ""}`;
  }

  function screenDay(day) {
    const data = dayData(weekStart, day);
    const rows = employees.map(e => {
      const vals = valuesOf(data, e.id);
      const pill = !vals.length ? '<span class="pill empty">+ Elegir</span>'
        : vals[0] === LIBRE ? '<span class="pill libre">Libre</span>'
        : `<span class="pills">${vals.map(v => `<span class="pill">${slotText(v)}</span>`).join("")}</span>`;
      return `<a class="row" href="#elegir-${day}-${e.id}">
        <span class="dot" style="background:${e.color}"></span>
        <span class="name">${esc(e.name)}</span>${pill}</a>`;
    }).join("");
    const next = day < 6
      ? `<a class="btn-main btn-blue" href="#dia-${day + 1}" data-replace>Listo, pasar al ${DAYS[day + 1].toLowerCase()} ${ICON.arrow}</a>`
      : `<a class="btn-main btn-blue" href="#">Listo, volver a la semana</a>`;
    return `
      <a class="btn-out btn-back" href="#">${ICON.left} Volver a la semana</a>
      <h1 class="big">${DAYS[day]}</h1>
      <p class="sub">${fullDate(day)}</p>
      <div class="info">Tocá un nombre para elegir su horario.</div>
      <div class="list">${rows || '<p class="hint">No hay personas cargadas.</p>'}</div>
      <div class="copy-row"><button class="btn-outline-blue" data-act="copy" data-day="${day}">${ICON.copy} Igual que el ${DAYS[day].toLowerCase()} pasado</button></div>
      <div class="spacer"></div>
      ${next}`;
  }

  function screenPick(day, empId) {
    const emp = empById(empId);
    if (!emp) return screenDay(day);
    const current = valuesOf(dayData(weekStart, day), empId);
    const isLibre = current[0] === LIBRE;
    const keys = slots.slice();
    current.forEach(v => { if (v !== LIBRE && !keys.includes(v)) keys.push(v); });
    const buttons = keys.map(k => {
      const on = current.includes(k);
      return `<button class="slot-btn${on ? " on" : ""}" data-act="toggle" data-v="${k}">${on ? ICON.check : ""}${slotText(k)}</button>`;
    }).join("");
    return `
      <button class="btn-out btn-back" data-act="cancel" data-day="${day}">${ICON.left} Volver al ${DAYS[day].toLowerCase()}</button>
      <h1 class="big"><span class="dot lg" style="background:${emp.color}"></span>${esc(emp.name)}</h1>
      <p class="sub">${DAYS[day]} ${fullDate(day)}</p>
      <h2 class="question">¿En qué horario trabaja?</h2>
      <p class="hint" style="margin-top:-6px">Si trabaja en dos horarios, tocá los dos.</p>
      <div class="slot-grid">
        ${buttons}
        <button class="slot-btn other" data-act="other">Otro horario</button>
      </div>
      <div class="other-box" id="other-box" hidden>
        <div class="time-pair">
          <label>Entra<input type="time" id="other-start" value="09:00"></label>
          <label>Sale<input type="time" id="other-end" value="17:00"></label>
        </div>
        <button class="btn-main btn-blue" data-act="pick-other" style="margin-top:0">Guardar este horario</button>
      </div>
      <button class="btn-libre${isLibre ? " on" : ""}" data-act="libre">${isLibre ? ICON.check : ""}Libre · no trabaja</button>
      ${current.length ? '<button class="link-clear" data-act="clear">Dejar sin cargar</button>' : ""}
      <div class="spacer"></div>
      <p class="foot">${ICON.info} Al tocar un horario, queda guardado.</p>
      <button class="btn-main btn-blue" data-act="cancel" data-day="${day}">${ICON.check} Listo</button>`;
  }

  // Agrupa por día: [{day, lines:[{key, names}]}]
  function weekSummary() {
    const out = [];
    for (let d = 0; d < 7; d++) {
      const data = dayData(weekStart, d);
      const groups = {};
      employees.forEach(e => {
        valuesOf(data, e.id).forEach(v => (groups[v] = groups[v] || []).push(e.name));
      });
      const keys = Object.keys(groups).filter(k => k !== LIBRE).sort((a, b) => slotMinutes(a) - slotMinutes(b));
      if (groups[LIBRE]) keys.push(LIBRE);
      if (keys.length) out.push({ day: d, lines: keys.map(k => ({ key: k, names: groups[k] })) });
    }
    return out;
  }

  function screenSend() {
    const summary = weekSummary();
    const body = summary.length ? summary.map(s => `
      <div class="pday">${DAYS[s.day].toUpperCase()} ${dateOf(s.day).getDate()}</div>
      ${s.lines.map(l => `<div class="pline${l.key === LIBRE ? " libre" : ""}"><b>${slotText(l.key)}</b><span>${esc(l.names.join(", "))}</span></div>`).join("")}
    `).join("") : '<p class="empty-msg">Todavía no cargaste ningún día.</p>';
    const missing = DAYS.filter((_, i) => dayStatus(i).kind !== "done").length;
    const warn = missing ? `<div class="warn">${ICON.warn}<span>${missing === 1 ? "Falta cargar 1 día" : `Faltan cargar ${missing} días`}. Igual se puede enviar.</span></div>` : "";
    return `
      <a class="btn-out btn-back" href="#">${ICON.left} Volver a la semana</a>
      <h1 class="big">Enviar el horario</h1>
      <p class="sub">Así lo van a ver en WhatsApp:</p>
      <div class="preview"><h3>Horario · ${weekLabel(weekStart)}</h3>${body}</div>
      ${warn}
      <div class="spacer"></div>
      <button class="btn-main btn-green" data-act="share">${ICON.send} Mandar por WhatsApp</button>
      <button class="btn-plain" data-act="download">${ICON.download} Guardar en el teléfono</button>`;
  }

  function screenPeople() {
    const rows = employees.map(e => `
      <div class="row">
        <span class="dot" style="background:${e.color}"></span>
        <span class="name">${esc(e.name)}</span>
        <button class="btn-quitar" data-act="remove-emp" data-id="${e.id}">Quitar</button>
      </div>`).join("");
    const preview = slots.slice(0, 3).map(slotText).join(", ") + (slots.length > 3 ? ` y ${slots.length - 3} más` : "");
    return `
      <a class="btn-out btn-back" href="#">${ICON.left} Volver a la semana</a>
      <h1 class="big">Personas</h1>
      <div class="list" style="margin-top:12px">${rows}</div>
      <form class="add-card" data-form="emp">
        <b>Agregar una persona</b>
        <div class="add-line">
          <input type="text" id="new-emp" placeholder="Nombre" maxlength="20" autocomplete="off">
          <button class="btn-add" type="submit">Agregar</button>
        </div>
      </form>
      <div class="spacer"></div>
      <a class="link-card" href="#horarios">
        <div><b>Horarios de trabajo</b><small>${preview || "Ninguno cargado"}</small></div>${ICON.right}
      </a>`;
  }

  function screenSlots() {
    const rows = slots.map((k, i) => `
      <div class="row">
        <span class="name">${slotText(k)}</span>
        <button class="btn-quitar" data-act="remove-slot" data-i="${i}">Quitar</button>
      </div>`).join("");
    return `
      <a class="btn-out btn-back" href="#personas">${ICON.left} Volver a personas</a>
      <h1 class="big">Horarios de trabajo</h1>
      <p class="sub">Son los botones que aparecen al elegir el horario de alguien.</p>
      <div class="list">${rows}</div>
      <form class="add-card" data-form="slot">
        <b>Agregar un horario</b>
        <div class="time-pair">
          <label>Entra<input type="time" id="new-slot-start" value="09:00"></label>
          <label>Sale<input type="time" id="new-slot-end" value="17:00"></label>
        </div>
        <button class="btn-main btn-blue" type="submit" style="margin-top:0">Agregar horario</button>
      </form>`;
  }

  // ---------- Router ----------
  function render() {
    const h = location.hash.replace("#", "");
    let m;
    if ((m = h.match(/^dia-(\d)$/))) app.innerHTML = screenDay(+m[1]);
    else if ((m = h.match(/^elegir-(\d)-(.+)$/))) app.innerHTML = screenPick(+m[1], m[2]);
    else if (h === "enviar") app.innerHTML = screenSend();
    else if (h === "personas") app.innerHTML = screenPeople();
    else if (h === "horarios") app.innerHTML = screenSlots();
    else app.innerHTML = screenWeek();
    if (h !== lastHash) window.scrollTo(0, 0);
    lastHash = h;
  }
  let lastHash = null;
  window.addEventListener("hashchange", render);

  function go(hash) { location.replace(hash || "#"); }

  // ---------- Acciones ----------
  app.addEventListener("click", e => {
    const link = e.target.closest("a[data-replace]");
    if (link) { e.preventDefault(); go(link.getAttribute("href")); return; }

    const el = e.target.closest("[data-act]");
    if (!el) return;
    const act = el.dataset.act;
    const m = location.hash.match(/^#elegir-(\d)-(.+)$/);

    if (act === "prev") { setWeek(addDays(weekStart, -7)); render(); }
    else if (act === "next") { setWeek(addDays(weekStart, 7)); render(); }
    else if (act === "cancel") { go("#dia-" + el.dataset.day); }
    else if (act === "toggle" && m) {
      const day = +m[1], v = el.dataset.v;
      let vals = valuesOf(dayData(weekStart, day), m[2]).filter(x => x !== LIBRE);
      vals = vals.includes(v) ? vals.filter(x => x !== v) : vals.concat(v);
      setAssignment(day, m[2], vals);
      render();
    }
    else if (act === "libre" && m) {
      setAssignment(+m[1], m[2], [LIBRE]);
      go("#dia-" + m[1]);
    }
    else if (act === "clear" && m) {
      setAssignment(+m[1], m[2], []);
      render();
    }
    else if (act === "other") {
      const box = document.getElementById("other-box");
      box.hidden = false;
      box.scrollIntoView({ behavior: "smooth", block: "center" });
    }
    else if (act === "pick-other" && m) {
      const a = document.getElementById("other-start").value;
      const b = document.getElementById("other-end").value;
      if (!a || !b) return;
      const day = +m[1], key = `${a}-${b}`;
      const vals = valuesOf(dayData(weekStart, day), m[2]).filter(x => x !== LIBRE && x !== key);
      setAssignment(day, m[2], vals.concat(key));
      render();
    }
    else if (act === "copy") {
      const day = +el.dataset.day;
      const prev = dayData(addDays(weekStart, -7), day);
      const ids = employees.map(x => x.id).filter(id => prev[id]);
      if (!ids.length) { alert(`No hay nada cargado el ${DAYS[day].toLowerCase()} pasado.`); return; }
      ids.forEach(id => setAssignment(day, id, valuesOf(prev, id)));
      render();
    }
    else if (act === "share") shareImage(false);
    else if (act === "download") shareImage(true);
    else if (act === "remove-emp") {
      const emp = empById(el.dataset.id);
      if (!emp || !confirm(`¿Quitar a ${emp.name}?`)) return;
      employees = employees.filter(x => x.id !== emp.id);
      save(K_EMP, employees);
      render();
    }
    else if (act === "remove-slot") {
      const i = +el.dataset.i;
      if (!confirm(`¿Quitar el horario ${slotText(slots[i])}?`)) return;
      slots.splice(i, 1);
      save(K_SLOTS, slots);
      render();
    }
  });

  app.addEventListener("submit", e => {
    e.preventDefault();
    const form = e.target.dataset.form;
    if (form === "emp") {
      const name = document.getElementById("new-emp").value.trim();
      if (!name) return;
      employees.push({ id: "e" + Date.now(), name, color: nextColor() });
      save(K_EMP, employees);
      render();
      document.getElementById("new-emp").focus();
    } else if (form === "slot") {
      const a = document.getElementById("new-slot-start").value;
      const b = document.getElementById("new-slot-end").value;
      if (!a || !b) return;
      const key = `${a}-${b}`;
      if (!slots.includes(key)) slots.push(key);
      slots.sort((x, y) => slotMinutes(x) - slotMinutes(y));
      save(K_SLOTS, slots);
      render();
    }
  });

  // ---------- Imagen para WhatsApp ----------
  function buildImage() {
    const summary = weekSummary();
    const W = 640, P = 36, lineH = 34, dayGap = 18, nameX = P + 120;
    const FONT = '"Atkinson Hyperlegible", Arial, sans-serif';
    let h = P + 44 + 20;
    summary.forEach(s => { h += dayGap + 30 + s.lines.length * lineH; });
    if (!summary.length) h += 40;
    h += P;

    const canvas = document.createElement("canvas");
    canvas.width = W * 2; canvas.height = h * 2;
    const ctx = canvas.getContext("2d");
    ctx.scale(2, 2);
    ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, W, h);
    ctx.textBaseline = "middle";

    let y = P + 18;
    ctx.fillStyle = "#1b1d21";
    ctx.font = `bold 28px ${FONT}`;
    ctx.fillText(`Horario · ${weekLabel(weekStart)}`, P, y);
    y += 26;
    ctx.fillRect(P, y, W - P * 2, 3);
    y += 20;

    if (!summary.length) {
      ctx.fillStyle = "#4b5059"; ctx.font = `22px ${FONT}`;
      ctx.fillText("Sin turnos cargados.", P, y + 16);
    }
    summary.forEach(s => {
      y += dayGap;
      ctx.fillStyle = "#1f4fa8"; ctx.font = `bold 21px ${FONT}`;
      ctx.fillText(`${DAYS[s.day].toUpperCase()} ${dateOf(s.day).getDate()}`, P, y + 12);
      y += 30;
      s.lines.forEach(l => {
        const libre = l.key === LIBRE;
        ctx.fillStyle = libre ? "#8a3a10" : "#1b1d21";
        ctx.font = `bold 22px ${FONT}`;
        ctx.fillText(slotText(l.key), P, y + lineH / 2);
        ctx.font = `22px ${FONT}`;
        ctx.fillText(l.names.join(", "), nameX, y + lineH / 2, W - nameX - P);
        y += lineH;
      });
    });
    return new Promise(resolve => canvas.toBlob(resolve, "image/png"));
  }

  async function shareImage(onlySave) {
    try { await document.fonts.ready; } catch (e) {}
    const blob = await buildImage();
    const name = `horario_${iso(weekStart)}.png`;
    const file = new File([blob], name, { type: "image/png" });
    if (!onlySave && navigator.canShare && navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file] }); } catch (e) {}
      return;
    }
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
    if (!onlySave) alert("Se guardó la imagen en el teléfono. Abrí WhatsApp y mandala desde la galería.");
  }

  // ---------- Service worker ----------
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => { navigator.serviceWorker.register("sw.js").catch(() => {}); });
  }

  render();
})();
