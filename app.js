(function () {
  "use strict";

  const DAYS = ["LUNES", "MARTES", "MIÉRCOLES", "JUEVES", "VIERNES", "SÁBADO", "DOMINGO"];
  // Paleta pastel "helado" para diferenciar personas
  const COLORS = ["#F3D1DC", "#F6A7C1", "#FDCF76", "#F0DDA0", "#E8B4C7", "#F5B94A", "#E3C0AE", "#F6DCE4"];

  const STORAGE_EMPLOYEES = "horarios_employees_v1";
  const STORAGE_WEEK = "horarios_week_v1";
  const STORAGE_ROLES = "horarios_roles_v1";
  const STORAGE_PRESETS = "horarios_presets_v1";

  const DEFAULT_ROLES = [
    { id: "r-cocina", name: "Cocina" },
    { id: "r-bacha", name: "Ayudante de bacha" }
  ];

  // Horarios predeterminados: independientes del rol
  const DEFAULT_PRESETS = [
    { start: "08:00", end: "16:00" },
    { start: "11:00", end: "15:00" },
    { start: "12:00", end: "16:00" },
    { start: "15:00", end: "19:00" },
    { start: "16:00", end: "00:00" },
    { start: "20:00", end: "00:00" }
  ];

  let employees = loadEmployees();
  let weekState = loadWeek();
  let roles = loadRoles();
  let presets = loadPresets();

  let activeCell = null; // { employeeId, dayIndex }
  let selectedPresetKey = null; // "start-end" del preset elegido, para resaltarlo

  // ---------- Persistencia ----------
  function loadEmployees() {
    try {
      const raw = localStorage.getItem(STORAGE_EMPLOYEES);
      return raw ? JSON.parse(raw) : [];
    } catch (e) { return []; }
  }
  function saveEmployees() {
    localStorage.setItem(STORAGE_EMPLOYEES, JSON.stringify(employees));
  }
  function loadWeek() {
    try {
      const raw = localStorage.getItem(STORAGE_WEEK);
      return raw ? JSON.parse(raw) : { weekStart: null, shifts: {} };
    } catch (e) { return { weekStart: null, shifts: {} }; }
  }
  function saveWeek() {
    localStorage.setItem(STORAGE_WEEK, JSON.stringify(weekState));
  }
  function loadRoles() {
    try {
      const raw = localStorage.getItem(STORAGE_ROLES);
      if (raw) return JSON.parse(raw);
      localStorage.setItem(STORAGE_ROLES, JSON.stringify(DEFAULT_ROLES));
      return JSON.parse(JSON.stringify(DEFAULT_ROLES));
    } catch (e) {
      return JSON.parse(JSON.stringify(DEFAULT_ROLES));
    }
  }
  function saveRoles() {
    localStorage.setItem(STORAGE_ROLES, JSON.stringify(roles));
  }
  function loadPresets() {
    try {
      const raw = localStorage.getItem(STORAGE_PRESETS);
      if (raw) return JSON.parse(raw);
      localStorage.setItem(STORAGE_PRESETS, JSON.stringify(DEFAULT_PRESETS));
      return JSON.parse(JSON.stringify(DEFAULT_PRESETS));
    } catch (e) {
      return JSON.parse(JSON.stringify(DEFAULT_PRESETS));
    }
  }
  function savePresets() {
    localStorage.setItem(STORAGE_PRESETS, JSON.stringify(presets));
  }

  function shiftKey(employeeId, dayIndex) {
    return employeeId + "_" + dayIndex;
  }
  function presetKey(p) {
    return p.start + "-" + p.end;
  }

  function nextColor() {
    const used = employees.map(e => e.color);
    for (const c of COLORS) if (!used.includes(c)) return c;
    return COLORS[employees.length % COLORS.length];
  }

  // ---------- Tabs ----------
  document.querySelectorAll(".tab-btn").forEach(btn => {
    btn.addEventListener("click", () => switchTab(btn.dataset.tab));
  });
  document.getElementById("btn-goto-personal").addEventListener("click", () => switchTab("personal"));

  function switchTab(tab) {
    document.querySelectorAll(".tab-btn").forEach(b => b.classList.toggle("active", b.dataset.tab === tab));
    document.querySelectorAll(".tab-content").forEach(c => c.classList.remove("active"));
    document.getElementById("tab-" + tab).classList.add("active");
  }

  // ---------- Personal ----------
  const employeeListEl = document.getElementById("employee-list");
  const newEmployeeInput = document.getElementById("new-employee-name");

  document.getElementById("btn-add-employee").addEventListener("click", addEmployee);
  newEmployeeInput.addEventListener("keydown", e => { if (e.key === "Enter") addEmployee(); });

  function addEmployee() {
    const name = newEmployeeInput.value.trim();
    if (!name) return;
    employees.push({ id: "e" + Date.now(), name, color: nextColor() });
    newEmployeeInput.value = "";
    saveEmployees();
    renderEmployeeList();
    renderTable();
  }

  function removeEmployee(id) {
    if (!confirm("¿Eliminar esta persona? También se van a borrar sus turnos de esta semana.")) return;
    employees = employees.filter(e => e.id !== id);
    Object.keys(weekState.shifts).forEach(k => {
      if (k.startsWith(id + "_")) delete weekState.shifts[k];
    });
    saveEmployees();
    saveWeek();
    renderEmployeeList();
    renderTable();
  }

  function renderEmployeeList() {
    employeeListEl.innerHTML = "";
    if (employees.length === 0) {
      employeeListEl.innerHTML = '<p class="hint">Todavía no agregaste a nadie.</p>';
      return;
    }
    employees.forEach(emp => {
      const li = document.createElement("li");
      li.innerHTML = `
        <span class="color-dot" style="background:${emp.color}"></span>
        <span class="name">${escapeHtml(emp.name)}</span>
        <button class="icon-btn danger" title="Eliminar">🗑️</button>
      `;
      li.querySelector(".icon-btn").addEventListener("click", () => removeEmployee(emp.id));
      employeeListEl.appendChild(li);
    });
  }

  function escapeHtml(str) {
    const d = document.createElement("div");
    d.textContent = str;
    return d.innerHTML;
  }

  // ---------- Roles ----------
  const roleListEl = document.getElementById("role-list");
  const newRoleInput = document.getElementById("new-role-name");

  document.getElementById("btn-add-role").addEventListener("click", addRole);
  newRoleInput.addEventListener("keydown", e => { if (e.key === "Enter") addRole(); });

  function addRole() {
    const name = newRoleInput.value.trim();
    if (!name) return;
    roles.push({ id: "role" + Date.now(), name });
    newRoleInput.value = "";
    saveRoles();
    renderRoleList();
    populateRoleSelect();
  }

  function removeRole(id) {
    if (!confirm("¿Eliminar este rol?")) return;
    roles = roles.filter(r => r.id !== id);
    saveRoles();
    renderRoleList();
    populateRoleSelect();
  }

  function renderRoleList() {
    roleListEl.innerHTML = "";
    if (roles.length === 0) {
      roleListEl.innerHTML = '<p class="hint">Todavía no agregaste roles.</p>';
      return;
    }
    roles.forEach(role => {
      const li = document.createElement("li");
      const header = document.createElement("div");
      header.className = "role-header";
      header.innerHTML = `<span class="name">${escapeHtml(role.name)}</span>`;
      const delBtn = document.createElement("button");
      delBtn.className = "icon-btn danger";
      delBtn.title = "Eliminar rol";
      delBtn.textContent = "🗑️";
      delBtn.addEventListener("click", () => removeRole(role.id));
      header.appendChild(delBtn);
      li.appendChild(header);
      roleListEl.appendChild(li);
    });
  }

  // ---------- Horarios predeterminados (globales) ----------
  const presetsManagerEl = document.getElementById("presets-manager");
  const newPresetStartInput = document.getElementById("new-preset-start");
  const newPresetEndInput = document.getElementById("new-preset-end");

  document.getElementById("btn-add-preset").addEventListener("click", () => {
    presets.push({ start: newPresetStartInput.value, end: newPresetEndInput.value });
    savePresets();
    renderPresetsManager();
    renderPresets();
  });

  function removePreset(idx) {
    presets.splice(idx, 1);
    savePresets();
    renderPresetsManager();
    renderPresets();
  }

  function renderPresetsManager() {
    presetsManagerEl.innerHTML = "";
    if (presets.length === 0) {
      presetsManagerEl.innerHTML = '<p class="hint">Todavía no agregaste horarios predeterminados.</p>';
      return;
    }
    presets.forEach((p, idx) => {
      const chip = document.createElement("span");
      chip.className = "preset-chip";
      chip.innerHTML = `<span>${p.start} - ${p.end}</span>`;
      const x = document.createElement("button");
      x.textContent = "✕";
      x.addEventListener("click", () => removePreset(idx));
      chip.appendChild(x);
      presetsManagerEl.appendChild(chip);
    });
  }

  // ---------- Semana ----------
  const weekStartInput = document.getElementById("week-start");

  function getMonday(dateStr) {
    const d = dateStr ? new Date(dateStr + "T00:00:00") : new Date();
    const day = d.getDay(); // 0 = domingo
    const diff = (day === 0 ? -6 : 1 - day);
    d.setDate(d.getDate() + diff);
    return d;
  }

  function ensureWeekStart() {
    if (!weekState.weekStart) {
      const monday = getMonday();
      weekState.weekStart = monday.toISOString().slice(0, 10);
      saveWeek();
    }
    weekStartInput.value = weekState.weekStart;
  }

  weekStartInput.addEventListener("change", () => {
    const monday = getMonday(weekStartInput.value);
    weekState.weekStart = monday.toISOString().slice(0, 10);
    weekStartInput.value = weekState.weekStart;
    saveWeek();
    renderTable();
  });

  function getDayDates() {
    const start = new Date(weekState.weekStart + "T00:00:00");
    const dates = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      dates.push(d);
    }
    return dates;
  }

  function formatDayDate(d) {
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    return `${dd}/${mm}`;
  }

  document.getElementById("btn-clear-week").addEventListener("click", () => {
    if (!confirm("¿Vaciar todos los turnos de esta semana? El personal no se borra.")) return;
    weekState.shifts = {};
    saveWeek();
    renderTable();
  });

  // ---------- Tabla ----------
  const tableEl = document.getElementById("schedule-table");
  const emptyStateEl = document.getElementById("empty-state");
  const gridWrapperEl = document.getElementById("grid-wrapper");

  const SLOTS = [
    { rest: true, label: "Descanso" },
    { start: "08:00", end: "16:00", label: "8 a 16" },
    { start: "12:00", end: "16:00", label: "12 a 16" },
    { start: "11:00", end: "15:00", label: "11 a 15" },
    { start: "15:00", end: "19:00", label: "15 a 19" },
    { start: "16:00", end: "00:00", label: "16 a 00" },
    { start: "19:00", end: "00:00", label: "19 a 00" },
    { start: "20:00", end: "00:00", label: "20 a 00" }
  ];
  const slotWrapperEl = document.getElementById("slot-wrapper");
  const slotTableEl = document.getElementById("slot-table");
  const viewToggleEl = document.querySelector(".view-toggle");
  let currentView = "slots";
  try { currentView = localStorage.getItem("horarios_view") || "slots"; } catch (e) {}

  document.querySelectorAll(".view-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      currentView = btn.dataset.view;
      try { localStorage.setItem("horarios_view", currentView); } catch (e) {}
      renderTable();
    });
  });

  function inSlot(shift, slot) {
    return slot.rest ? shift.type === "rest" : (shift.type !== "rest" && shift.start === slot.start && shift.end === slot.end);
  }
  function peopleInSlot(slot, day) {
    return employees.filter(emp => (weekState.shifts[shiftKey(emp.id, day)] || []).some(s => inSlot(s, slot)));
  }

  function renderSlotTable() {
    const dates = getDayDates();
    let html = "<thead><tr><th>Horario</th>";
    DAYS.forEach((day, i) => {
      html += `<th><div class="day-name">${day}</div><div class="day-date">${formatDayDate(dates[i])}</div></th>`;
    });
    html += "</tr></thead><tbody>";
    SLOTS.forEach((slot, si) => {
      html += `<tr><td class="slot-label${slot.rest ? " rest-label" : ""}">${slot.label}</td>`;
      for (let d = 0; d < 7; d++) {
        const people = peopleInSlot(slot, d);
        html += `<td class="slot-cell" data-slot="${si}" data-day="${d}">`;
        html += people.length
          ? people.map(p => `<div class="name-chip" style="background:${slot.rest ? "#B16E4B;color:white" : p.color}">${escapeHtml(p.name)}</div>`).join("")
          : `<div class="cell-plus">+</div>`;
        html += "</td>";
      }
      html += "</tr>";
    });
    slotTableEl.innerHTML = html + "</tbody>";
    slotTableEl.querySelectorAll(".slot-cell").forEach(cell => {
      cell.addEventListener("click", () => openSlotModal(+cell.dataset.slot, +cell.dataset.day));
    });
  }

  // ---------- Modal elegir personas ----------
  const modalSlot = document.getElementById("modal-slot");
  const slotPeopleEl = document.getElementById("slot-people");
  let activeSlot = null;

  function openSlotModal(slotIndex, day) {
    activeSlot = { slot: SLOTS[slotIndex], day };
    document.getElementById("slot-title").textContent = `${DAYS[day]} — ${SLOTS[slotIndex].label}`;
    renderSlotPeople();
    modalSlot.hidden = false;
  }

  function renderSlotPeople() {
    const { slot, day } = activeSlot;
    slotPeopleEl.innerHTML = "";
    employees.forEach(emp => {
      const key = shiftKey(emp.id, day);
      const on = (weekState.shifts[key] || []).some(s => inSlot(s, slot));
      const btn = document.createElement("button");
      btn.className = on ? "on" : "";
      btn.innerHTML = `<span class="color-dot" style="background:${emp.color}"></span>${escapeHtml(emp.name)}<span class="check">${on ? "✓" : ""}</span>`;
      btn.addEventListener("click", () => {
        let list = weekState.shifts[key] || [];
        if (on) {
          list = list.filter(s => !inSlot(s, slot));
        } else if (slot.rest) {
          list = [{ type: "rest" }];
        } else {
          list = list.filter(s => s.type !== "rest");
          list.push({ type: "work", start: slot.start, end: slot.end, roleId: null });
        }
        weekState.shifts[key] = list;
        saveWeek();
        renderSlotPeople();
        renderTable();
      });
      slotPeopleEl.appendChild(btn);
    });
  }

  document.getElementById("btn-close-slot").addEventListener("click", () => { modalSlot.hidden = true; });
  modalSlot.addEventListener("click", e => { if (e.target === modalSlot) modalSlot.hidden = true; });

  function renderTable() {
    document.querySelectorAll(".view-btn").forEach(b => b.classList.toggle("active", b.dataset.view === currentView));
    if (employees.length === 0) {
      emptyStateEl.hidden = false;
      gridWrapperEl.hidden = true;
      slotWrapperEl.hidden = true;
      viewToggleEl.hidden = true;
      return;
    }
    emptyStateEl.hidden = true;
    viewToggleEl.hidden = false;
    slotWrapperEl.hidden = currentView !== "slots";
    gridWrapperEl.hidden = currentView === "slots";
    if (currentView === "slots") { renderSlotTable(); return; }

    const dates = getDayDates();

    let html = "<thead><tr><th></th>";
    DAYS.forEach((day, i) => {
      html += `<th><div class="day-name">${day}</div><div class="day-date">${formatDayDate(dates[i])}</div></th>`;
    });
    html += "</tr></thead><tbody>";

    employees.forEach(emp => {
      html += `<tr><td class="employee-cell"><span class="color-dot" style="background:${emp.color}"></span>${escapeHtml(emp.name)}</td>`;
      for (let d = 0; d < 7; d++) {
        const shifts = weekState.shifts[shiftKey(emp.id, d)] || [];
        html += `<td class="shift-cell" data-emp="${emp.id}" data-day="${d}">`;
        if (shifts.length === 0) {
          html += `<div class="cell-plus">+</div>`;
        } else {
          shifts.forEach(s => {
            if (s.type === "rest") {
              html += `<div class="shift-chip rest">Descanso</div>`;
            } else {
              const role = roles.find(r => r.id === s.roleId);
              const roleLine = role ? `<div class="chip-role">${escapeHtml(role.name)}</div>` : "";
              html += `<div class="shift-chip" style="background:${emp.color}">${roleLine}<div class="chip-time">${s.start}-${s.end}</div></div>`;
            }
          });
        }
        html += `</td>`;
      }
      html += "</tr>";
    });
    html += "</tbody>";
    tableEl.innerHTML = html;

    tableEl.querySelectorAll(".shift-cell").forEach(cell => {
      cell.addEventListener("click", () => openShiftModal(cell.dataset.emp, parseInt(cell.dataset.day, 10)));
    });
  }

  // ---------- Modal turnos ----------
  const modalShift = document.getElementById("modal-shift");
  const modalTitle = document.getElementById("modal-title");
  const shiftListEl = document.getElementById("shift-list");
  const shiftStartInput = document.getElementById("shift-start");
  const shiftEndInput = document.getElementById("shift-end");
  const shiftRoleSelect = document.getElementById("shift-role");
  const presetRowEl = document.getElementById("preset-row");

  function populateRoleSelect() {
    const prev = shiftRoleSelect.value;
    shiftRoleSelect.innerHTML = '<option value="">Sin rol</option>' +
      roles.map(r => `<option value="${r.id}">${escapeHtml(r.name)}</option>`).join("");
    if (roles.some(r => r.id === prev)) shiftRoleSelect.value = prev;
  }

  // Los horarios predeterminados son independientes del rol elegido.
  function renderPresets() {
    presetRowEl.innerHTML = "";
    if (presets.length === 0) {
      presetRowEl.innerHTML = '<span class="empty-hint">Sin horarios predeterminados. Agregalos en la pestaña Roles.</span>';
      return;
    }
    presets.forEach(p => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = `${p.start} - ${p.end}`;
      if (selectedPresetKey === presetKey(p)) btn.classList.add("selected");
      btn.addEventListener("click", () => {
        shiftStartInput.value = p.start;
        shiftEndInput.value = p.end;
        selectedPresetKey = presetKey(p);
        renderPresets();
      });
      presetRowEl.appendChild(btn);
    });
  }

  // Si el usuario toca los horarios a mano, ya no corresponde a un preset "seleccionado"
  function clearPresetSelection() {
    if (selectedPresetKey === null) return;
    selectedPresetKey = null;
    renderPresets();
  }
  shiftStartInput.addEventListener("input", clearPresetSelection);
  shiftEndInput.addEventListener("input", clearPresetSelection);

  function openShiftModal(employeeId, dayIndex) {
    activeCell = { employeeId, dayIndex };
    selectedPresetKey = null;
    const emp = employees.find(e => e.id === employeeId);
    modalTitle.textContent = `${emp.name} — ${DAYS[dayIndex]}`;
    populateRoleSelect();
    renderPresets();
    renderShiftList();
    modalShift.hidden = false;
  }

  function renderShiftList() {
    const key = shiftKey(activeCell.employeeId, activeCell.dayIndex);
    const shifts = weekState.shifts[key] || [];
    const emp = employees.find(e => e.id === activeCell.employeeId);
    shiftListEl.innerHTML = "";
    if (shifts.length === 0) {
      shiftListEl.innerHTML = '<li style="background:none;font-weight:400;color:#8a7364;">Sin turnos cargados todavía.</li>';
    }
    shifts.forEach((s, idx) => {
      const li = document.createElement("li");
      if (s.type === "rest") {
        li.innerHTML = `<span class="swatch" style="background:#B16E4B"></span><span class="label">Descanso / libre</span>`;
      } else {
        const roleName = roles.find(r => r.id === s.roleId);
        const label = roleName ? `${roleName.name} · ${s.start} a ${s.end}` : `${s.start} a ${s.end}`;
        li.innerHTML = `<span class="swatch" style="background:${emp.color}"></span><span class="label">${escapeHtml(label)}</span>`;
      }
      const delBtn = document.createElement("button");
      delBtn.className = "icon-btn danger";
      delBtn.textContent = "✕";
      delBtn.addEventListener("click", () => {
        shifts.splice(idx, 1);
        weekState.shifts[key] = shifts;
        saveWeek();
        renderShiftList();
        renderTable();
      });
      li.appendChild(delBtn);
      shiftListEl.appendChild(li);
    });
  }

  document.getElementById("btn-add-shift").addEventListener("click", () => {
    const start = shiftStartInput.value;
    const end = shiftEndInput.value;
    if (!start || !end) { alert("Elegí hora de entrada y de salida."); return; }
    const key = shiftKey(activeCell.employeeId, activeCell.dayIndex);
    if (!weekState.shifts[key]) weekState.shifts[key] = [];
    const roleId = shiftRoleSelect.value || null;
    weekState.shifts[key].push({ type: "work", start, end, roleId });
    saveWeek();
    renderShiftList();
    renderTable();
  });

  document.getElementById("btn-add-rest").addEventListener("click", () => {
    const key = shiftKey(activeCell.employeeId, activeCell.dayIndex);
    weekState.shifts[key] = [{ type: "rest" }];
    saveWeek();
    renderShiftList();
    renderTable();
  });

  document.getElementById("btn-close-modal").addEventListener("click", () => { modalShift.hidden = true; });
  modalShift.addEventListener("click", e => { if (e.target === modalShift) modalShift.hidden = true; });

  // ---------- Exportar como imagen ----------
  document.getElementById("btn-share").addEventListener("click", exportImage);

  function exportImage() {
    if (employees.length === 0) { alert("Agregá personal antes de compartir."); return; }
    if (currentView === "slots") { exportSlotImage(); return; }
    const dates = getDayDates();

    const colEmpWidth = 150;
    const colDayWidth = 150;
    const headerHeight = 60;
    const rowMinHeight = 46;
    const chipHeight = 38;
    const padding = 20;

    // calcular altura de cada fila según cantidad de turnos
    const rowHeights = employees.map(emp => {
      let maxShifts = 1;
      for (let d = 0; d < 7; d++) {
        const shifts = weekState.shifts[shiftKey(emp.id, d)] || [];
        maxShifts = Math.max(maxShifts, shifts.length);
      }
      return Math.max(rowMinHeight, maxShifts * chipHeight + 12);
    });

    const totalWidth = colEmpWidth + colDayWidth * 7 + padding * 2;
    const totalHeight = headerHeight + rowHeights.reduce((a, b) => a + b, 0) + padding * 2 + 40;

    const canvas = document.createElement("canvas");
    const scale = 2;
    canvas.width = totalWidth * scale;
    canvas.height = totalHeight * scale;
    const ctx = canvas.getContext("2d");
    ctx.scale(scale, scale);

    // fondo
    ctx.fillStyle = "#FFF9EE";
    ctx.fillRect(0, 0, totalWidth, totalHeight);

    // titulo
    ctx.fillStyle = "#5a4436";
    ctx.font = "bold 20px Arial";
    ctx.textBaseline = "middle";
    ctx.fillText("Horario semanal", padding, padding + 10);

    let y = padding + 30;
    const x0 = padding;

    // header fila dias
    ctx.fillStyle = "#F6A7C1";
    ctx.fillRect(x0, y, colEmpWidth + colDayWidth * 7, headerHeight);
    ctx.strokeStyle = "#E8829F";
    ctx.strokeRect(x0, y, colEmpWidth + colDayWidth * 7, headerHeight);

    ctx.fillStyle = "#6b1f3d";
    for (let d = 0; d < 7; d++) {
      const cx = x0 + colEmpWidth + colDayWidth * d + colDayWidth / 2;
      ctx.font = "bold 14px Arial";
      ctx.textAlign = "center";
      ctx.fillText(DAYS[d], cx, y + headerHeight / 2 - 10);
      ctx.font = "12px Arial";
      ctx.fillText(formatDayDate(dates[d]), cx, y + headerHeight / 2 + 10);
    }
    ctx.textAlign = "left";

    y += headerHeight;

    employees.forEach((emp, i) => {
      const rh = rowHeights[i];

      // celda nombre
      ctx.fillStyle = "#FCF0CF";
      ctx.fillRect(x0, y, colEmpWidth, rh);
      ctx.strokeStyle = "#f0ddd0";
      ctx.strokeRect(x0, y, colEmpWidth, rh);

      ctx.fillStyle = emp.color;
      ctx.beginPath();
      ctx.arc(x0 + 16, y + rh / 2, 6, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "#5a4436";
      ctx.font = "bold 14px Arial";
      ctx.textAlign = "left";
      ctx.fillText(emp.name, x0 + 30, y + rh / 2);

      for (let d = 0; d < 7; d++) {
        const cx = x0 + colEmpWidth + colDayWidth * d;
        ctx.strokeStyle = "#f0ddd0";
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(cx, y, colDayWidth, rh);
        ctx.strokeRect(cx, y, colDayWidth, rh);

        const shifts = weekState.shifts[shiftKey(emp.id, d)] || [];
        shifts.forEach((s, idx) => {
          const chipY = y + 6 + idx * chipHeight;
          const chipX = cx + 6;
          const chipW = colDayWidth - 12;
          const chipH = chipHeight - 6;
          ctx.fillStyle = s.type === "rest" ? "#B16E4B" : emp.color;
          roundRect(ctx, chipX, chipY, chipW, chipH, 6);
          ctx.fill();
          ctx.textAlign = "center";
          if (s.type === "rest") {
            ctx.fillStyle = "#ffffff";
            ctx.font = "bold 12px Arial";
            ctx.fillText("Descanso", chipX + chipW / 2, chipY + chipH / 2 + 1);
          } else {
            const role = roles.find(r => r.id === s.roleId);
            ctx.fillStyle = "#5a4436";
            if (role) {
              ctx.font = "bold 9px Arial";
              ctx.globalAlpha = 0.8;
              ctx.fillText(role.name, chipX + chipW / 2, chipY + chipH / 2 - 8);
              ctx.globalAlpha = 1;
              ctx.font = "bold 12px Arial";
              ctx.fillText(`${s.start}-${s.end}`, chipX + chipW / 2, chipY + chipH / 2 + 6);
            } else {
              ctx.font = "bold 12px Arial";
              ctx.fillText(`${s.start}-${s.end}`, chipX + chipW / 2, chipY + chipH / 2 + 1);
            }
          }
          ctx.textAlign = "left";
        });
      }

      y += rh;
    });

    canvas.toBlob(blob => {
      showPreview(blob);
    }, "image/png");
  }

  function exportSlotImage() {
    const dates = getDayDates();
    const labelW = 110, colW = 140, headerH = 60, chipH = 28, pad = 20;
    const rowHeights = SLOTS.map(slot => {
      let max = 1;
      for (let d = 0; d < 7; d++) max = Math.max(max, peopleInSlot(slot, d).length);
      return Math.max(44, max * chipH + 12);
    });
    const tableW = labelW + colW * 7;
    const W = tableW + pad * 2;
    const H = pad * 2 + 30 + headerH + rowHeights.reduce((a, b) => a + b, 0);
    const canvas = document.createElement("canvas");
    canvas.width = W * 2; canvas.height = H * 2;
    const ctx = canvas.getContext("2d");
    ctx.scale(2, 2);
    ctx.fillStyle = "#FFF9EE"; ctx.fillRect(0, 0, W, H);
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#5a4436"; ctx.font = "bold 20px Arial";
    ctx.fillText("Horario semanal", pad, pad + 10);

    let y = pad + 30;
    ctx.fillStyle = "#F6A7C1"; ctx.fillRect(pad, y, tableW, headerH);
    ctx.fillStyle = "#6b1f3d"; ctx.textAlign = "center";
    for (let d = 0; d < 7; d++) {
      const cx = pad + labelW + colW * d + colW / 2;
      ctx.font = "bold 14px Arial"; ctx.fillText(DAYS[d], cx, y + headerH / 2 - 10);
      ctx.font = "12px Arial"; ctx.fillText(formatDayDate(dates[d]), cx, y + headerH / 2 + 10);
    }
    y += headerH;

    SLOTS.forEach((slot, i) => {
      const rh = rowHeights[i];
      ctx.fillStyle = slot.rest ? "#B16E4B" : "#FCF0CF";
      ctx.fillRect(pad, y, labelW, rh);
      ctx.strokeStyle = "#f0ddd0"; ctx.strokeRect(pad, y, labelW, rh);
      ctx.fillStyle = slot.rest ? "#ffffff" : "#5a4436";
      ctx.font = "bold 14px Arial";
      ctx.fillText(slot.label, pad + labelW / 2, y + rh / 2);
      for (let d = 0; d < 7; d++) {
        const cx = pad + labelW + colW * d;
        ctx.fillStyle = "#ffffff"; ctx.fillRect(cx, y, colW, rh);
        ctx.strokeRect(cx, y, colW, rh);
        peopleInSlot(slot, d).forEach((p, idx) => {
          const cy = y + 6 + idx * chipH;
          ctx.fillStyle = slot.rest ? "#B16E4B" : p.color;
          roundRect(ctx, cx + 6, cy, colW - 12, chipH - 5, 6); ctx.fill();
          ctx.fillStyle = slot.rest ? "#ffffff" : "#5a4436";
          ctx.font = "bold 13px Arial";
          ctx.fillText(p.name, cx + colW / 2, cy + (chipH - 5) / 2 + 1);
        });
      }
      y += rh;
    });
    canvas.toBlob(showPreview, "image/png");
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  // ---------- Preview / compartir ----------
  const modalPreview = document.getElementById("modal-preview");
  const previewImage = document.getElementById("preview-image");
  let currentBlob = null;

  function showPreview(blob) {
    currentBlob = blob;
    previewImage.src = URL.createObjectURL(blob);
    modalPreview.hidden = false;
  }

  document.getElementById("btn-close-preview").addEventListener("click", () => { modalPreview.hidden = true; });
  modalPreview.addEventListener("click", e => { if (e.target === modalPreview) modalPreview.hidden = true; });

  document.getElementById("btn-download-image").addEventListener("click", () => {
    if (!currentBlob) return;
    const a = document.createElement("a");
    a.href = URL.createObjectURL(currentBlob);
    a.download = `horario_${weekState.weekStart || "semana"}.png`;
    a.click();
  });

  document.getElementById("btn-share-native").addEventListener("click", async () => {
    if (!currentBlob) return;
    const file = new File([currentBlob], `horario_${weekState.weekStart || "semana"}.png`, { type: "image/png" });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: "Horario del personal" });
      } catch (e) { /* usuario canceló */ }
    } else {
      alert("Este navegador no permite compartir directamente. Usá 'Descargar' y compartí la imagen desde tu galería.");
    }
  });

  // ---------- Service worker ----------
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("sw.js").catch(() => {});
    });
  }

  // ---------- Init ----------
  ensureWeekStart();
  renderEmployeeList();
  renderRoleList();
  renderPresetsManager();
  populateRoleSelect();
  renderTable();
})();
