document.addEventListener("DOMContentLoaded", () => {
  const GOOGLE_SHEET_WEBAPP_URL =
    "https://script.google.com/macros/s/AKfycbx2geVAhLh3h4wlDU9DqbKWqJ42OW1yI8cPP9c3kFfoiLRblqPZxm-8tgPSfJXKgps/exec";

  function isoNowSeconds() {
    const d = new Date();
    d.setMilliseconds(0);
    return d.toISOString();
  }

  // ====== ELEMENTOS (con chequeo) ======
  const $ = (id) => document.getElementById(id);

  const legajoScreen  = $("legajoScreen");
  const optionsScreen = $("optionsScreen");
  const legajoInput   = $("legajoInput");

  const btnContinuar = $("btnContinuar");
  const btnBackTop   = $("btnBackTop");
  const btnBackLabel = $("btnBackLabel");

  const row1 = $("row1");
  const row2 = $("row2");
  const row3 = $("row3");

  const selectedArea = $("selectedArea");
  const selectedBox  = $("selectedBox");
  const selectedDesc = $("selectedDesc");
  const inputArea    = $("inputArea");
  const inputLabel   = $("inputLabel");
  const textInput    = $("textInput");
  const error        = $("error");

  const btnResetSelection = $("btnResetSelection");
  const btnEnviar = $("btnEnviar");

  const daySummary = $("daySummary"); // si no existe, no pasa nada

  const required = {
    legajoScreen, optionsScreen, legajoInput,
    btnContinuar, btnBackTop, btnBackLabel,
    row1, row2, row3,
    selectedArea, selectedBox, selectedDesc,
    inputArea, inputLabel, textInput, error,
    btnResetSelection, btnEnviar
  };

  const missing = Object.entries(required).filter(([,v]) => !v).map(([k]) => k);
  if (missing.length) {
    console.error("FALTAN ELEMENTOS EN EL HTML (ids):", missing);
    alert("ERROR: faltan elementos en el HTML. Abrí consola (F12) para ver cuáles.");
    return; // si falta algo, no seguimos
  }

  // ====== OPCIONES ======
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

  // ====== NAVEGACIÓN ======
  function goToOptions(){
    const val = String(legajoInput.value || "").trim();
    console.log("CLICK CONTINUAR. legajo =", val);

    if(!val){
      alert("Ingresá el número de legajo");
      return;
    }
    legajoScreen.classList.add("hidden");
    optionsScreen.classList.remove("hidden");
  }

  function backToLegajo(){
    optionsScreen.classList.add("hidden");
    legajoScreen.classList.remove("hidden");
    if (daySummary) renderDaySummary();
  }

  // bind
  btnContinuar.addEventListener("click", goToOptions);
  btnBackTop.addEventListener("click", backToLegajo);
  btnBackLabel.addEventListener("click", backToLegajo);
  legajoInput.addEventListener("keydown", (e)=>{ if(e.key==="Enter") goToOptions(); });

  // ====== RENDER OPCIONES ======
  function render(){
    row1.innerHTML=""; row2.innerHTML=""; row3.innerHTML="";
    OPTIONS.forEach(o=>{
      const d=document.createElement("div");
      d.className="box";
      d.innerHTML=`<div class="box-title">${o.code}</div><div class="box-desc">${o.desc}</div>`;
      d.addEventListener("click", ()=>selectOption(o));
      (o.row===1?row1:o.row===2?row2:row3).appendChild(d);
    });
  }

  function selectOption(opt){
    selected = opt;
    selectedArea.classList.remove("hidden");
    selectedBox.innerText = opt.code;
    selectedDesc.innerText = opt.desc;
    error.innerText="";
    textInput.value="";

    if(opt.input?.show){
      inputArea.classList.remove("hidden");
      inputLabel.innerText = opt.input.label;
      textInput.placeholder = opt.input.placeholder;
    } else {
      inputArea.classList.add("hidden");
      textInput.placeholder = "";
    }
  }

  function resetSelection(){
    selected = null;
    selectedArea.classList.add("hidden");
    error.innerText="";
    textInput.value="";
  }

  btnResetSelection.addEventListener("click", resetSelection);

  // ====== (por ahora) envío simple para que pruebes navegación ======
  btnEnviar.addEventListener("click", async ()=>{
    if(!selected) return;

    const legajo = String(legajoInput.value||"").trim();
    if(!legajo){ alert("Ingresá el número de legajo"); return; }

    const texto = String(textInput.value||"").trim();
    if(selected.input?.show && !selected.input.validate.test(texto)){
      error.innerText="Solo se permiten números";
      return;
    }

    const ts = isoNowSeconds();

    const payload = {
      legajo,
      opcion: selected.code,
      descripcion: selected.desc,
      texto,
      tsEvent: ts,
      tInicio: ""
    };

    try{
      await fetch(GOOGLE_SHEET_WEBAPP_URL,{
        method:"POST",
        headers:{"Content-Type":"text/plain;charset=utf-8"},
        body:JSON.stringify(payload),
        mode:"no-cors"
      });
      alert("Registro enviado correctamente");
      resetSelection();
      backToLegajo();
    }catch(e){
      console.log("FETCH ERROR:", e);
      error.innerText="No se pudo enviar. Revisá WiFi.";
    }
  });

  // ====== Resumen (si existe el div) ======
  function renderDaySummary(){
    // placeholder: no rompe si no lo usás ahora
    daySummary.className = "history-empty";
    daySummary.innerText = "OK (JS cargó).";
  }

  // init
  render();
  if (daySummary) renderDaySummary();

  console.log("app.js cargado OK ✅");
});
