const GOOGLE_SHEET_WEBAPP_URL = "https://script.google.com/macros/s/AKfycbx2geVAhLh3h4wlDU9DqbKWqJ42OW1yI8cPP9c3kFfoiLRblqPZxm-8tgPSfJXKgps/exec";

/* ========= TIEMPO UNIFICADO ========= */
function isoNowSeconds() {
  const d = new Date();
  d.setMilliseconds(0);
  return d.toISOString();
}

/* ========= ELEMENTOS ========= */
const legajoScreen  = document.getElementById("legajoScreen");
const optionsScreen = document.getElementById("optionsScreen");
const legajoInput   = document.getElementById("legajoInput");
const daySummary    = document.getElementById("daySummary");
const error         = document.getElementById("error");

const row1 = document.getElementById("row1");
const row2 = document.getElementById("row2");
const row3 = document.getElementById("row3");

const selectedArea = document.getElementById("selectedArea");
const selectedBox  = document.getElementById("selectedBox");
const selectedDesc = document.getElementById("selectedDesc");
const inputArea    = document.getElementById("inputArea");
const inputLabel   = document.getElementById("inputLabel");
const textInput    = document.getElementById("textInput");

const btnContinuar = document.getElementById("btnContinuar");
const btnBackTop   = document.getElementById("btnBackTop");
const btnBackLabel = document.getElementById("btnBackLabel");
const btnResetSelection = document.getElementById("btnResetSelection");
const btnEnviar = document.getElementById("btnEnviar");

/* ========= OPCIONES ========= */
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

const NON_DOWNTIME_CODES = new Set(["E","C","Perm","RM","RD"]);

let selected = null;

/* ========= NAVEGACIÓN ========= */
function goToOptions(){
  if(!legajoInput.value.trim()){
    alert("Ingresá el número de legajo");
    return;
  }
  legajoScreen.classList.add("hidden");
  optionsScreen.classList.remove("hidden");
}

function backToLegajo(){
  optionsScreen.classList.add("hidden");
  legajoScreen.classList.remove("hidden");
}

btnContinuar.addEventListener("click",goToOptions);
btnBackTop.addEventListener("click",backToLegajo);
btnBackLabel.addEventListener("click",backToLegajo);
legajoInput.addEventListener("keydown",e=>{if(e.key==="Enter")goToOptions();});

/* ========= RENDER OPCIONES ========= */
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

/* ========= SELECCIÓN ========= */
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

/* ========= COOKIES ========= */
const COOKIE_NAME="prod_day_state_v3";
function getState(){try{return JSON.parse(localStorage.getItem(COOKIE_NAME))||{}}catch{return{}}}
function setState(s){localStorage.setItem(COOKIE_NAME,JSON.stringify(s))}

/* ========= ENVÍO ========= */
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

  alert("Registro enviado");
  selectedArea.classList.add("hidden");
  optionsScreen.classList.add("hidden");
  legajoScreen.classList.remove("hidden");
};
