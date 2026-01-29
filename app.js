document.addEventListener("DOMContentLoaded", () => {

  // ✅ TU WEB APP (Apps Script)
  const GOOGLE_SHEET_WEBAPP_URL =
    "https://script.google.com/macros/s/AKfycbwbYx8fqFvG3MeKzLOSpbAJ0mZL1P2mVcKFIneXCOh6iqg8K_RbSwGofIJZMHJHITJy/exec";

  /* ================= TIEMPO (sin milisegundos) ================= */
  function isoNowSeconds() {
    const d = new Date();
    d.setMilliseconds(0);
    return d.toISOString();
  }

  function formatDateTimeAR(iso) {
    try {
      return new Date(iso).toLocaleString("es-AR", { timeZone: "America/Argentina/Buenos_Aires" });
    } catch {
      return "";
    }
  }

  function todayKeyAR() {
    return new Date().toLocaleDateString("es-AR", { timeZone: "America/Argentina/Buenos_Aires" });
  }

  /* ================= ELEMENTOS ================= */
  const $ = (id) => document.getElementById(id);

  const legajoScreen  = $("legajoScreen");
  const optionsScreen = $("optionsScreen");
  const legajoInput   = $("legajoInput");

  const btnContinuar      = $("btnContinuar");
  const btnBackTop        = $("btnBackTop");
  const btnBackLabel      = $("btnBackLabel");

  const row1 = $("row1");
  const row2 = $("row2");
  const row3 = $("row3");

  const selectedArea = $("selectedArea");
  const selectedBox  = $("selectedBox");
  const selectedDesc = $("selectedDesc");
  const inputArea    = $("inputArea");
  const inputLabel   = $("inputLabel");
  const textInput    = $("textInput");
  const btnResetSelection = $("btnResetSelection");
  const btnEnviar = $("btnEnviar");
  const error = $("error");

  const daySummary = $("daySummary");   // resumen del día (en este dispositivo)
  const matrizInfo = $("matrizInfo");   // cartel de matriz en uso al seleccionar C

  // Check ids
  const required = {
    legajoScreen, optionsScreen, legajoInput,
    btnContinuar, btnBackTop, btnBackLabel,
    row1, row2, row3,
    selectedArea, selectedBox, selectedDesc, inputArea, inputLabel, textInput,
    btnResetSelection, btnEnviar, error,
    daySummary, matrizInfo
  };
  const missing = Object.entries(required).filter(([,v]) => !v).map(([k]) => k);
  if (missing.length) {
    console.error("FALTAN ELEMENTOS EN EL HTML (ids):", missing);
    alert("Error: faltan elementos en el HTML. Mirá consola (F12).");
    return;
  }

  /* ================= OPCIONES ================= */
  const OPTIONS = [
    {code:"E",desc:"Empecé Matriz",row:1,input:{show:true,label:"Ingresar número",placeholder:"Ejemplo: 110",validate:/^[0-9]+$/}},
    {code:"C",desc:"Cajón",row:1,input:{show:true,label:"Ingresar número",placeholder:"Ejemplo: 1500",validate:/^[0-9]+$/}},
    {code:"PB",desc:"Paré Baño",row:2,input:{show:false}},
    {code:"BC",desc:"Busqué Cajón",row:2,input:{show:false}},
    {code:"MOV",desc:"Movimiento",row:2,input:{show:false}},
    {code:"LIMP",desc:"Limpieza",row:2,input:{show:false}},
    {code:"Perm",desc:"Permiso",row:2,input:{show:false}},
    {code:"AL",desc:"Ayuda Logística",row:3,input:{show:false}},
    {code:"PR",desc:"Paré Carga Rollo",row:3,input:{show:false}},
    {code:"CM",desc:"Cambiar Matriz",row:3,input:{show:false}},
    {code:"RM",desc:"Rotura Matriz",row:3,input:{show:false}},
    {code:"PC",desc:"Paré Comida",row:3,input:{show:false}},
    {code:"RD",desc:"Rollo Fleje Doblado",row:3,input:{show:false}}
  ];

  const NON_DOWNTIME_CODES = new Set(["E","C","Perm","RM","RD"]);

  function isDowntime(opcion) {
    return !NON_DOWNTIME_CODES.has(opcion);
  }

  function sameDowntime(a, b) {
    if (!a || !b) return false;
    return String(a.opcion) === String(b.opcion) && String(a.texto || "") === String(b.texto || "");
  }

  let selected = null;

  /* ================= STORAGE POR LEGAJO ================= */
  const LS_PREFIX = "prod_state_v1";      // estado por (dia + legajo)
  const LS_QUEUE  = "prod_queue_v1";      // cola global (contiene legajo en cada item)

  function legajoKey() {
    return String(legajoInput.value || "").trim();
  }

  function stateKeyFor(legajo) {
    return `${LS_PREFIX}::${todayKeyAR()}::${String(legajo).trim()}`;
  }

  function freshState() {
    return {
      lastMatrix: null,     // {opcion, descripcion, texto, ts}
      lastCajon: null,      // {opcion, descripcion, texto, ts}
      lastDowntime: null,   // {opcion, descripcion, texto, ts}
      last2: []             // array de items (max 2)
    };
  }

  function readStateForLegajo(legajo) {
    try {
      const raw = localStorage.getItem(stateKeyFor(legajo));
      if (!raw) return freshState();
      const s = JSON.parse(raw);
      if (!s || typeof s !== "object") return freshState();
      s.last2 = Array.isArray(s.last2) ? s.last2 : [];
      s.lastMatrix = s.lastMatrix || null;
      s.lastCajon = s.lastCajon || null;
      s.lastDowntime = s.lastDowntime || null;
      return s;
    } catch {
      return freshState();
    }
  }

  function writeStateForLegajo(legajo, state) {
    localStorage.setItem(stateKeyFor(legajo), JSON.stringify(state));
  }

  /* ================= COLA PENDIENTES (GLOBAL) ================= */
  function readQueue() {
    try {
      const raw = localStorage.getItem(LS_QUEUE);
      if (!raw) return [];
      const arr = JSON.parse(raw);
      return Array.isArray(arr) ? arr : [];
    } catch {
      return [];
    }
  }

  function writeQueue(arr) {
    // límite para que no crezca infinito
    localStorage.setItem(LS_QUEUE, JSON.stringify(arr.slice(-50)));
  }

  function enqueue(payload) {
    const q = readQueue();
    q.push(payload);
    writeQueue(q);
  }

  function dequeueOne() {
    const q = readQueue();
    const item = q.shift();
    writeQueue(q);
    return item;
  }

  function queueLength() {
    return readQueue().length;
  }

  /* ================= UI: RESUMEN POR LEGAJO ================= */
  function renderSummary() {
    const leg = legajoKey();

    if (!leg) {
      daySummary.className = "history-empty";
      daySummary.innerText = "Ingresá tu legajo para ver el resumen";
      return;
    }

    const s = readStateForLegajo(leg);
    const qLen = queueLength();

    const renderItem = (title, item) => {
      if (!item) {
        return `
          <div class="day-item">
            <div class="t1">${title}</div>
            <div class="t2">—</div>
          </div>`;
      }
      return `
        <div class="day-item">
          <div class="t1">${title}</div>
          <div class="t2">
            ${item.opcion} — ${item.descripcion}<br>
            ${item.texto ? `Dato: <b>${item.texto}</b><br>` : ""}
            ${item.ts ? `Fecha: ${formatDateTimeAR(item.ts)}` : ""}
          </div>
        </div>`;
    };

    const renderLast2 = (arr) => {
      if (!arr || !arr.length) {
        return `
          <div class="day-item">
            <div class="t1">Últimos 2 mensajes del día</div>
            <div class="t2">—</div>
          </div>`;
      }
      return `
        <div class="day-item">
          <div class="t1">Últimos 2 mensajes del día</div>
          <div class="t2">
            ${arr.map(it => `
              <div style="margin-top:6px;">
                <b>${it.opcion}</b> — ${it.descripcion}
                ${it.texto ? ` | Dato: <b>${it.texto}</b>` : ""}
                ${it.ts ? `<br><span style="color:#555;">${formatDateTimeAR(it.ts)}</span>` : ""}
              </div>
            `).join("")}
          </div>
        </div>`;
    };

    daySummary.className = "";
    daySummary.innerHTML = [
      qLen ? `
        <div class="day-item">
          <div class="t1">Pendientes de envío</div>
          <div class="t2"><b>${qLen}</b> (se reintentan)</div>
        </div>` : "",
      renderItem("Última Matriz (E)", s.lastMatrix),
      renderItem("Último Cajón (C)", s.lastCajon),
      renderLast2(s.last2),
      renderItem("Último Tiempo Muerto", s.lastDowntime)
    ].join("");
  }

  /* ================= UI: MATRIZ EN USO AL ENVIAR CAJÓN ================= */
  function renderMatrizInfoForCajon() {
    const leg = legajoKey();
    if (!leg) {
      matrizInfo.classList.add("hidden");
      matrizInfo.innerHTML = "";
      return;
    }

    if (!selected || selected.code !== "C") {
      matrizInfo.classList.add("hidden");
      matrizInfo.innerHTML = "";
      return;
    }

    const s = readStateForLegajo(leg);
    const lm = s.lastMatrix;

    matrizInfo.classList.remove("hidden");

    if (!lm || !lm.texto) {
      matrizInfo.innerHTML = `⚠️ No hay matriz registrada hoy.<br><small>Enviá primero "E (Empecé Matriz)"</small>`;
      return;
    }

    matrizInfo.innerHTML =
      `Matriz en uso: <span style="font-size:22px;">${lm.texto}</span>
       <small>Última matriz: ${lm.ts ? formatDateTimeAR(lm.ts) : ""}</small>`;
  }

  /* ================= RENDER BOTONES ================= */
  function renderOptions() {
    row1.innerHTML = ""; row2.innerHTML = ""; row3.innerHTML = "";
    OPTIONS.forEach(o => {
      const d = document.createElement("div");
      d.className = "box";
      d.innerHTML = `<div class="box-title">${o.code}</div><div class="box-desc">${o.desc}</div>`;
      d.addEventListener("click", () => selectOption(o));
      (o.row === 1 ? row1 : o.row === 2 ? row2 : row3).appendChild(d);
    });
  }

  /* ================= NAVEGACIÓN ================= */
  function goToOptions() {
    if (!legajoKey()) {
      alert("Ingresá el número de legajo");
      return;
    }
    legajoScreen.classList.add("hidden");
    optionsScreen.classList.remove("hidden");
    renderMatrizInfoForCajon();
  }

  function backToLegajo() {
    optionsScreen.classList.add("hidden");
    legajoScreen.classList.remove("hidden");
    renderSummary();
  }

  /* ================= SELECCIÓN ================= */
  function selectOption(opt) {
    selected = opt;
    selectedArea.classList.remove("hidden");
    selectedBox.innerText = opt.code;
    selectedDesc.innerText = opt.desc;
    error.innerText = "";
    textInput.value = "";

    if (opt.input.show) {
      inputArea.classList.remove("hidden");
      inputLabel.innerText = opt.input.label;
      textInput.placeholder = opt.input.placeholder;
    } else {
      inputArea.classList.add("hidden");
      textInput.placeholder = "";
    }

    renderMatrizInfoForCajon();
  }

  function resetSelection() {
    selected = null;
    selectedArea.classList.add("hidden");
    error.innerText = "";
    textInput.value = "";
    matrizInfo.classList.add("hidden");
    matrizInfo.innerHTML = "";
  }

  /* ================= REGLAS DE "Hs Inicio" ================= */
  function computeHsInicioForC(state) {
    // Si hay último cajón -> usar su ts, si no -> ts de matriz
    if (state.lastCajon && state.lastCajon.ts) return state.lastCajon.ts;
    if (state.lastMatrix && state.lastMatrix.ts) return state.lastMatrix.ts;
    return "";
  }

  /* ================= VALIDACIÓN TIEMPO MUERTO ================= */
  function validateBeforeSend(legajo, payload) {
    const s = readStateForLegajo(legajo);
    const ld = s.lastDowntime;

    if (!ld) return { ok: true };

    // si lo que se manda NO es tiempo muerto -> se permite
    if (!isDowntime(payload.opcion)) return { ok: true };

    // si hay TM pendiente y quieren mandar otro TM distinto -> bloquear
    if (!sameDowntime(ld, payload)) {
      return {
        ok: false,
        msg:
          `Hay un "Tiempo Muerto" pendiente (${ld.opcion}${ld.texto ? " " + ld.texto : ""}).\n` +
          `Solo podés enviar el MISMO tiempo muerto, o enviar E / C / Perm / RM / RD.`
      };
    }

    // si es el mismo TM, es "segunda vez" -> se limpia luego y Hs Inicio = ts del TM pendiente
    return { ok: true, isSecondSameDowntime: true, downtimeTs: ld.ts || "" };
  }

  /* ================= ACTUALIZAR ESTADO POR LEGAJO ================= */
  function updateStateAfterSend(legajo, payload) {
    const s = readStateForLegajo(legajo);
    const item = {
      opcion: payload.opcion,
      descripcion: payload.descripcion,
      texto: payload.texto || "",
      ts: payload.tsEvent
    };

    // últimos 2
    s.last2.unshift(item);
    s.last2 = s.last2.slice(0, 2);

    // E: si cambia respecto a anterior => borrar último cajón
    if (payload.opcion === "E") {
      if (s.lastMatrix && String(s.lastMatrix.texto || "") !== String(item.texto || "")) {
        s.lastCajon = null;
      }
      s.lastMatrix = item;
      s.lastDowntime = null;
      writeStateForLegajo(legajo, s);
      return;
    }

    // C: actualiza cajón y limpia downtime
    if (payload.opcion === "C") {
      s.lastCajon = item;
      s.lastDowntime = null;
      writeStateForLegajo(legajo, s);
      return;
    }

    // Perm/RM/RD limpian downtime
    if (NON_DOWNTIME_CODES.has(payload.opcion)) {
      s.lastDowntime = null;
      writeStateForLegajo(legajo, s);
      return;
    }

    // Downtime
    if (isDowntime(payload.opcion)) {
      if (!s.lastDowntime) {
        s.lastDowntime = item;                // primera vez
      } else if (sameDowntime(s.lastDowntime, payload)) {
        s.lastDowntime = null;                // segunda vez del mismo -> limpia
      } else {
        s.lastDowntime = item;                // distinto -> reemplaza (igual esto normalmente lo bloqueamos)
      }
      writeStateForLegajo(legajo, s);
      return;
    }

    writeStateForLegajo(legajo, s);
  }

  /* ================= ENVÍO (NO BLOQUEANTE) ================= */
  async function postToSheet(payload) {
    // no-cors: no podemos leer respuesta, pero el POST sale igual
    return fetch(GOOGLE_SHEET_WEBAPP_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload),
      mode: "no-cors",
      keepalive: true
    });
  }

  async function flushQueueOnce() {
    const q = readQueue();
    if (!q.length) return;
    const item = q[0];
    try {
      await postToSheet(item);
      dequeueOne();
      // no tocamos estados acá porque ya fueron actualizados en modo optimista
    } catch {
      // queda pendiente
    }
    renderSummary();
  }

  async function sendFast() {
    if (!selected) return;

    const legajo = legajoKey();
    if (!legajo) { alert("Ingresá el número de legajo"); return; }

    const texto = String(textInput.value || "").trim();
    if (selected.input.show && !selected.input.validate.test(texto)) {
      error.innerText = "Solo se permiten números";
      return;
    }

    const tsEvent = isoNowSeconds();

    // payload base
    const payload = {
      legajo,
      opcion: selected.code,
      descripcion: selected.desc,
      texto,
      tsEvent,
      "Hs Inicio": ""   // ✅ NUEVO NOMBRE
    };

    // reglas especiales
    const stateBefore = readStateForLegajo(legajo);

    // ✅ Bloqueo: no permitir C si no hay matriz
    if (payload.opcion === "C") {
      if (!stateBefore.lastMatrix || !stateBefore.lastMatrix.ts) {
        alert('Primero tenés que enviar "E (Empecé Matriz)" antes de registrar un Cajón.');
        return;
      }
      payload["Hs Inicio"] = computeHsInicioForC(stateBefore);
    }

    // ✅ Validación TM pendiente
    const v = validateBeforeSend(legajo, payload);
    if (!v.ok) {
      alert(v.msg);
      return;
    }

    // ✅ Si es 2da vez del mismo TM -> Hs Inicio = ts del TM pendiente
    if (v.isSecondSameDowntime) {
      payload["Hs Inicio"] = v.downtimeTs || "";
    }

    // UI rápida
    btnEnviar.disabled = true;
    const prevText = btnEnviar.innerText;
    btnEnviar.innerText = "Enviando...";

    // 1) Actualizo estado local por legajo YA
    updateStateAfterSend(legajo, payload);
    renderSummary();

    // 2) Vuelvo YA a pantalla inicial
    resetSelection();
    optionsScreen.classList.add("hidden");
    legajoScreen.classList.remove("hidden");

    // 3) Encolo + intento enviar 1
    enqueue(payload);
    flushQueueOnce();

    // 4) Reactivo botón
    setTimeout(() => {
      btnEnviar.disabled = false;
      btnEnviar.innerText = prevText;
    }, 250);
  }

  /* ================= EVENTOS ================= */
  btnContinuar.addEventListener("click", goToOptions);
  btnBackTop.addEventListener("click", backToLegajo);
  btnBackLabel.addEventListener("click", backToLegajo);
  btnResetSelection.addEventListener("click", resetSelection);
  btnEnviar.addEventListener("click", sendFast);
  legajoInput.addEventListener("keydown", (e) => { if (e.key === "Enter") goToOptions(); });

  // 🔁 cuando cambia el legajo, refrescar resumen (por legajo) y limpiar selección visual
  let legajoTimer = null;
  legajoInput.addEventListener("input", () => {
    clearTimeout(legajoTimer);
    legajoTimer = setTimeout(() => {
      renderSummary();
    }, 120);
  });

  // reintento al volver a la pestaña
  window.addEventListener("focus", () => flushQueueOnce());

  /* ================= INIT ================= */
  renderOptions();
  renderSummary();

  console.log("app.js OK ✅ (estado por legajo + Hs Inicio)");

});
