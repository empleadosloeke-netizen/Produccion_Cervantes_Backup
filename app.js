const GOOGLE_SHEET_WEBAPP_URL = "https://script.google.com/macros/s/AKfycbxePQlykqQQs6dBghov2p-AWmp2FQAFn9YJCIubB2uD688BD8Q3efOK08CN3DdKqoFV/exec";

// ELEMENTOS
const legajoScreen   = document.getElementById("legajoScreen");
const optionsScreen  = document.getElementById("optionsScreen");
const legajoInput    = document.getElementById("legajoInput");

const row1 = document.getElementById("row1");
const row2 = document.getElementById("row2");
const row3 = document.getElementById("row3");

const selectedArea = document.getElementById("selectedArea");
const selectedBox  = document.getElementById("selectedBox");
const selectedDesc = document.getElementById("selectedDesc");
const inputArea    = document.getElementById("inputArea");
const inputLabel   = document.getElementById("inputLabel");
const textInput    = document.getElementById("textInput");
const error        = document.getElementById("error");
const daySummary   = document.getElementById("daySummary");

const btnContinuar      = document.getElementById("btnContinuar");
const btnBackTop        = document.getElementById("btnBackTop");
const btnBackLabel      = document.getElementById("btnBackLabel");
const btnResetSelection = document.getElementById("btnResetSelection");
const btnEnviar         = document.getElementById("btnEnviar");

// OPCIONES
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

let selected = null;

/* =========================================================
   COOKIES DEL DÍA (por dispositivo)
   - ultima matriz del dia
   - ultimo cajon del dia
   - ultimos 2 mensajes del dia
   - ultimo tiempo muerto del dia + regla anti repetición
   - TInicio para C y para 2do tiempo muerto
   ========================================================= */

const COOKIE_NAME = "prod_day_state_v2";
const COOKIE_DAYS = 365;

// Códigos “permitidos” que NO se consideran tiempo muerto
const NON_DOWNTIME_CODES = new Set(["E", "C", "Perm", "RM", "RD"]);

function setCookie(name, value, days) {
  const d = new Date();
  d.setTime(d.getTime() + (days*24*60*60*1000));
  const expires = "expires=" + d.toUTCString();
  document.cookie = `${name}=${encodeURIComponent(value)}; ${expires}; path=/; SameSite=Lax`;
}
function getCookie(name) {
  const cookies = document.cookie ? document.cookie.split("; ") : [];
  for (const c of cookies) {
    const [k, ...rest] = c.split("=");
    if (k === name) return decodeURIComponent(rest.join("="));
  }
  return "";
}
function todayKeyAR() {
  return new Date().toLocaleDateString("es-AR", { timeZone: "America/Argentina/Buenos_Aires" }); // dd/mm/aaaa
}
function freshDayState_() {
  return {
    dayKey: todayKeyAR(),
    lastMatrix: null,     // {opcion, descripcion, texto, ts}
    lastCajon: null,      // {opcion, descripcion, texto, ts}
    last2: [],            // últimos 2 mensajes
    lastDowntime: null    // {opcion, descripcion, texto, ts} (pendiente)
  };
}
function readDayState() {
  try {
    const raw = getCookie(COOKIE_NAME);
    if (!raw) return freshDayState_();
    const obj = JSON.parse(raw);
    if (!obj || typeof obj !== "object") return freshDayState_();
    if (obj.dayKey !== todayKeyAR()) return freshDayState_();

    obj.last2 = Array.isArray(obj.last2) ? obj.last2 : [];
    obj.lastMatrix = obj.lastMatrix || null;
    obj.lastCajon = obj.lastCajon || null;
    obj.lastDowntime = obj.lastDowntime || null;
    return obj;
  } catch {
    return freshDayState_();
  }
}
function writeDayState(state) {
  setCookie(COOKIE_NAME, JSON.stringify(state), COOKIE_DAYS);
}
function formatDateTime(ts) {
  try {
    return new Date(ts).toLocaleString("es-AR", { timeZone: "America/Argentina/Buenos_Aires" });
  } catch {
    return "";
  }
}
function isDowntime(payload) {
  return !NON_DOWNTIME_CODES.has(payload.opcion);
}
function sameDowntime(a, b) {
  // “mismo tiempo muerto” = mismo opcion + mismo texto
  if (!a || !b) return false;
  return String(a.opcion) === String(b.opcion) && String(a.texto || "") === String(b.texto || "");
}

/**
 * Regla anti-repetición:
 * - si hay lastDowntime pendiente:
 *   - solo puedo enviar EL MISMO downtime, o enviar E/C/Perm/RM/RD
 * - al enviar por 2da vez el mismo downtime => se limpia cookie
 */
function validateBeforeSend(payload) {
  const state = readDayState();
  const ld = state.lastDowntime;

  if (!ld) return { ok: true };

  // si envío algo no-downtime (E/C/Perm/RM/RD) => permitido
  if (!isDowntime(payload)) return { ok: true };

  // si envío downtime => debe ser el mismo que el pendiente
  if (!sameDowntime(ld, payload)) {
    return {
      ok: false,
      msg:
        `Hay un "Tiempo Muerto" pendiente (${ld.opcion}${ld.texto ? " " + ld.texto : ""}).\n` +
        `Solo podés enviar el MISMO tiempo muerto, o enviar E / C / Perm / RM / RD.`
    };
  }

  // es el mismo => esto cuenta como “segunda vez”
  return { ok: true, isSecondSameDowntime: true, downtimeTs: ld.ts };
}

function clearDowntime(state) {
  state.lastDowntime = null;
}

/**
 * ✅ Nueva regla:
 * - Cuando envío E (Empecé Matriz) diferente al anterior => borrar lastCajon
 *   “diferente” = cambia el texto (nro matriz)
 */
function maybeClearCajonOnNewMatrix(state, payload, newItem) {
  if (payload.opcion !== "E") return;

  const prev = state.lastMatrix;
  if (!prev) return; // primera matriz del día

  const prevTxt = String(prev.texto || "");
  const newTxt  = String(newItem.texto || "");

  if (newTxt !== prevTxt) {
    // borramos “último cajón”
    state.lastCajon = null;
  }
}

/**
 * Calcula TInicio cuando se envía C:
 * - si lastCajon existe => su ts
 * - si no => ts de lastMatrix
 */
function computeTInicioForC(state) {
  if (state.lastCajon && state.lastCajon.ts) return state.lastCajon.ts;
  if (state.lastMatrix && state.lastMatrix.ts) return state.lastMatrix.ts;
  return ""; // si no hay nada aún
}

function renderDaySummary() {
  const container = daySummary;
  if (!container) return;

  const legajo = legajoInput.value.toString().trim();
  if (!legajo) {
    container.className = "history-empty";
    container.innerText = "Ingresá tu legajo para ver el resumen";
    return;
  }

  const state = readDayState();

  const blocks = [];
  blocks.push(renderBlock_("Última Matriz (E)", state.lastMatrix));
  blocks.push(renderBlock_("Último Cajón (C)", state.lastCajon));
  blocks.push(renderLast2_("Últimos 2 mensajes del día", state.last2));
  blocks.push(renderDowntime_("Último Tiempo Muerto", state.lastDowntime));

  container.className = "";
  container.innerHTML = blocks.join("");
}

function renderBlock_(title, item) {
  if (!item) {
    return `
      <div class="day-item">
        <div class="t1">${title}</div>
        <div class="t2">—</div>
      </div>
    `;
  }
  return `
    <div class="day-item">
      <div class="t1">${title}</div>
      <div class="t2">
        ${item.opcion} — ${item.descripcion}<br>
        ${item.texto ? `Dato: <b>${item.texto}</b><br>` : ""}
        ${item.ts ? `Fecha: ${formatDateTime(item.ts)}` : ""}
      </div>
    </div>
  `;
}

function renderLast2_(title, arr) {
  if (!arr || !arr.length) {
    return `
      <div class="day-item">
        <div class="t1">${title}</div>
        <div class="t2">—</div>
      </div>
    `;
  }

  const rows = arr.map(it => `
    <div style="margin-top:6px;">
      <b>${it.opcion}</b> — ${it.descripcion}
      ${it.texto ? ` | Dato: <b>${it.texto}</b>` : ""}
      ${it.ts ? `<br><span style="color:#555;">${formatDateTime(it.ts)}</span>` : ""}
    </div>
  `).join("");

  return `
    <div class="day-item">
      <div class="t1">${title}</div>
      <div class="t2">${rows}</div>
    </div>
  `;
}

function renderDowntime_(title, item) {
  if (!item) {
    return `
      <div class="day-item">
        <div class="t1">${title}</div>
        <div class="t2">—</div>
      </div>
    `;
  }
  return `
    <div class="day-item">
      <div class="t1">${title}<span class="badge-warn">pendiente</span></div>
      <div class="t2">
        ${item.opcion} — ${item.descripcion}<br>
        ${item.texto ? `Dato: <b>${item.texto}</b><br>` : ""}
        ${item.ts ? `Fecha: ${formatDateTime(item.ts)}` : ""}
        <div style="margin-top:6px;color:#a15c00;">
          Solo podés repetir el mismo tiempo muerto (2da vez) o enviar E/C/Perm/RM/RD.
        </div>
      </div>
    </div>
  `;
}

// refresco “suave” al tipear legajo
let legajoTimer = null;
legajoInput.addEventListener("input", () => {
  clearTimeout(legajoTimer);
  legajoTimer = setTimeout(() => renderDaySummary(), 150);
});

/* ========================================================= */

// RENDER OPCIONES
function render(){
  row1.innerHTML=""; row2.innerHTML=""; row3.innerHTML="";
  OPTIONS.forEach(o=>{
    const d=document.createElement("div");
    d.className="box";
    d.innerHTML=`<div class="box-title">${o.code}</div><div class="box-desc">${o.desc}</div>`;
    d.addEventListener("click",()=>selectOption(o));
    (o.row===1?row1:o.row===2?row2:row3).appendChild(d);
  });
}

// NAVEGACIÓN
function goToOptions(){
  if(!legajoInput.value.toString().trim()){
    alert("Ingresá el número de legajo");
    return;
  }
  legajoScreen.classList.add("hidden");
  optionsScreen.classList.remove("hidden");
}

function backToLegajo(){
  optionsScreen.classList.add("hidden");
  legajoScreen.classList.remove("hidden");
  renderDaySummary();
}

// SELECCIÓN
function selectOption(opt){
  selected = opt;
  selectedArea.classList.remove("hidden");
  selectedBox.innerText = opt.code;
  selectedDesc.innerText = opt.desc;
  error.innerText="";
  textInput.value="";

  if(opt.input.show){
    inputArea.classList.remove("hidden");
    inputLabel.innerText = opt.input.label;
    textInput.placeholder = opt.input.placeholder;
  } else {
    inputArea.classList.add("hidden");
    textInput.value = "";
  }
}

function resetSelection(){
  selected=null;
  selectedArea.classList.add("hidden");
  error.innerText="";
}

// ENVÍO A GOOGLE SHEET
async function send(){
  if(!selected) return;

  const legajo = legajoInput.value.toString().trim();
  if(!legajo){
    alert("Ingresá el número de legajo");
    return;
  }

  let texto = textInput.value.trim();
  if(selected.input.show && !selected.input.validate.test(texto)){
    error.innerText="Solo se permiten números";
    return;
  }

  const stateBefore = readDayState();

  // payload base
  const payload = {
    legajo,
    opcion: selected.code,
    descripcion: selected.desc,
    texto,
    // 👇 este campo lo usa el Apps Script para la columna "TInicio"
    tInicio: "" // ISO string
  };

  // ✅ Validación tiempo muerto (y detecta 2da vez)
  const v = validateBeforeSend(payload);
  if (!v.ok) {
    alert(v.msg);
    return;
  }

  // ✅ Reglas de TInicio
  // 1) Si es C: TInicio según último cajón o última matriz
  if (payload.opcion === "C") {
    payload.tInicio = computeTInicioForC(stateBefore);
  }

  // 2) Si es “segunda vez” de un tiempo muerto: TInicio = ts del cookie de tiempo muerto
  if (v.isSecondSameDowntime) {
    payload.tInicio = v.downtimeTs || "";
  }

  // Enviar
  try{
    await fetch(GOOGLE_SHEET_WEBAPP_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload),
      mode: "no-cors"
    });

    // ✅ Actualizar cookies del día
    const state = readDayState(); // re-lee por si algo
    const nowIso = new Date().toISOString();
    const newItem = {
      opcion: payload.opcion,
      descripcion: payload.descripcion,
      texto: payload.texto || "",
      ts: nowIso
    };

    // últimos 2 mensajes
    state.last2.unshift(newItem);
    state.last2 = state.last2.slice(0, 2);

    // Si envío E:
    if (payload.opcion === "E") {
      // borrar lastCajon si es matriz diferente a la anterior
      maybeClearCajonOnNewMatrix(state, payload, newItem);
      state.lastMatrix = newItem;

      // además, si mando E (no downtime) limpio downtime pendiente
      clearDowntime(state);
    }

    // Si envío C:
    if (payload.opcion === "C") {
      state.lastCajon = newItem;
      // C (no downtime) limpia downtime pendiente
      clearDowntime(state);
    }

    // Si envío Perm / RM / RD (no downtime) limpia downtime pendiente
    if (NON_DOWNTIME_CODES.has(payload.opcion) && payload.opcion !== "E" && payload.opcion !== "C") {
      clearDowntime(state);
    }

    // Si envío downtime:
    if (isDowntime(payload)) {
      if (!state.lastDowntime) {
        // primera vez del downtime => queda pendiente
        state.lastDowntime = newItem;
      } else if (sameDowntime(state.lastDowntime, payload)) {
        // segunda vez del mismo downtime => limpiar
        clearDowntime(state);
      } else {
        // por reglas no debería pasar, pero lo dejamos consistente
        state.lastDowntime = newItem;
      }
    }

    writeDayState(state);

    // refrescar resumen
    renderDaySummary();

    alert("Registro enviado correctamente");

    resetSelection();
    optionsScreen.classList.add("hidden");
    legajoScreen.classList.remove("hidden");

  }catch(e){
    error.innerText="No se pudo enviar. Revisá WiFi.";
    console.log("FETCH ERROR:", e);
  }
}

// EVENTOS
btnContinuar.addEventListener("click",goToOptions);
btnBackTop.addEventListener("click",backToLegajo);
btnBackLabel.addEventListener("click",backToLegajo);
btnResetSelection.addEventListener("click",resetSelection);
btnEnviar.addEventListener("click",send);
legajoInput.addEventListener("keydown",e=>{if(e.key==="Enter")goToOptions();});

// Inicial
render();
renderDaySummary();

