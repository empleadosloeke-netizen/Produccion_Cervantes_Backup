document.addEventListener("DOMContentLoaded", () => {

const GOOGLE_SHEET_WEBAPP_URL = "https://script.google.com/macros/s/AKfycbx2geVAhLh3h4wlDU9DqbKWqJ42OW1yI8cPP9c3kFfoiLRblqPZxm-8tgPSfJXKgps/exec";

/* ================= TIEMPO UNIFICADO ================= */
function isoNowSeconds(){
  const d = new Date();
  d.setMilliseconds(0);
  return d.toISOString();
}

/* ================= ELEMENTOS ================= */
const $ = id => document.getElementById(id);

const legajoScreen  = $("legajoScreen");
const optionsScreen = $("optionsScreen");
const legajoInput   = $("legajoInput");
const daySummary    = $("daySummary");
const error         = $("error");

const row1 = $("row1");
const row2 = $("row2");
const row3 = $("row3");

const selectedArea = $("selectedArea");
const selectedBox  = $("selectedBox");
const selectedDesc = $("selectedDesc");
const inputArea    = $("inputArea");
const inputLabel   = $("inputLabel");
const textInput    = $("textInput");

const btnContinuar = $("btnContinuar");
const btnBackTop   = $("btnBackTop");
const btnBackLabel = $("btnBackLabel");
const btnResetSelection = $("btnResetSelection");
const btnEnviar = $("btnEnviar");

/* ================= OPCIONES ================= */
const OPTIONS = [
  {code:"E",desc:"Empecé Matriz",row:1,input:true},
  {code:"C",desc:"Cajón",row:1,input:true},
  {code:"PB",desc:"Paré Baño",row:2},
  {code:"BC",desc:"Busqué Cajón",row:2},
  {code:"MOV",desc:"Movimiento",row:2},
  {code:"LIMP",desc:"Limpieza",row:2},
  {code:"Perm",desc:"Permiso",row:2},
  {code:"AL",desc:"Ayuda Logística",row:3},
  {code:"PR",desc:"Paré Carga Rollo",row:3},
  {code:"CM",desc:"Cambiar Matriz",row:3},
  {code:"RM",desc:"Rotura Matriz",row:3},
  {code:"PC",desc:"Paré Comida",row:3},
  {code:"RD",desc:"Rollo Fleje Doblado",row:3}
];

const NON_DOWNTIME = new Set(["E","C","Perm","RM","RD"]);

let selected=null;

/* ================= NAVEGACIÓN ================= */
function goToOptions(){
  if(!legajoInput.value.trim()){ alert("Ingresá el número de legajo"); return; }
  legajoScreen.classList.add("hidden");
  optionsScreen.classList.remove("hidden");
}
function backToLegajo(){
  optionsScreen.classList.add("hidden");
  legajoScreen.classList.remove("hidden");
  renderSummary();
}
btnContinuar.onclick=goToOptions;
btnBackTop.onclick=backToLegajo;
btnBackLabel.onclick=backToLegajo;
legajoInput.onkeydown=e=>{if(e.key==="Enter")goToOptions();};

/* ================= RENDER OPCIONES ================= */
function render(){
  row1.innerHTML=row2.innerHTML=row3.innerHTML="";
  OPTIONS.forEach(o=>{
    const d=document.createElement("div");
    d.className="box";
    d.innerHTML=`<div class="box-title">${o.code}</div><div class="box-desc">${o.desc}</div>`;
    d.onclick=()=>selectOption(o);
    (o.row===1?row1:o.row===2?row2:row3).appendChild(d);
  });
}
render();

/* ================= SELECCIÓN ================= */
function selectOption(o){
  selected=o;
  selectedArea.classList.remove("hidden");
  selectedBox.innerText=o.code;
  selectedDesc.innerText=o.desc;
  error.innerText="";
  textInput.value="";
  inputArea.classList.toggle("hidden",!o.input);
}
btnResetSelection.onclick=()=>selectedArea.classList.add("hidden");

/* ================= COOKIES POR DÍA ================= */
const COOKIE="prod_day_state_v4";
function today(){return new Date().toLocaleDateString("es-AR",{timeZone:"America/Argentina/Buenos_Aires"});}
function getState(){
  try{
    const s=JSON.parse(localStorage.getItem(COOKIE))||{};
    if(s.day!==today()) return {day:today()};
    return s;
  }catch{return {day:today()};}
}
function setState(s){localStorage.setItem(COOKIE,JSON.stringify(s));}

/* ================= RESUMEN ================= */
function renderSummary(){
  const s=getState();
  daySummary.innerHTML=`
  <div><b>Última Matriz:</b> ${s.lastMatrix?.texto||"-"}</div>
  <div><b>Último Cajón:</b> ${s.lastCajon?.texto||"-"}</div>
  <div><b>Último Tiempo Muerto:</b> ${s.lastDowntime?.opcion||"-"}</div>
  `;
}

/* ================= ENVÍO ================= */
btnEnviar.onclick=async()=>{
  if(!selected) return;

  const ts=isoNowSeconds();
  const payload={
    legajo:legajoInput.value.trim(),
    opcion:selected.code,
    descripcion:selected.desc,
    texto:textInput.value.trim(),
    tsEvent:ts,
    tInicio:""
  };

  await fetch(GOOGLE_SHEET_WEBAPP_URL,{
    method:"POST",
    headers:{"Content-Type":"text/plain;charset=utf-8"},
    body:JSON.stringify(payload),
    mode:"no-cors"
  });

  const s=getState();
  const item={...payload,ts};

  if(payload.opcion==="E"){s.lastMatrix=item;s.lastCajon=null;}
  if(payload.opcion==="C"){s.lastCajon=item;}
  if(!NON_DOWNTIME.has(payload.opcion)){s.lastDowntime=item;}
  else{s.lastDowntime=null;}

  setState(s);
  renderSummary();

  alert("Registro enviado");
  selectedArea.classList.add("hidden");
  optionsScreen.classList.add("hidden");
  legajoScreen.classList.remove("hidden");
};

renderSummary();

});
