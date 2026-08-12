// Set this after deploying gemini-worker.js.
const API_BASE_URL = "https://YOUR-GEMINI-WORKER.workers.dev";
const MAX_FILE_SIZE = 15 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg","image/png","image/webp"]);
const HISTORY_KEY = "facebot_history_v1";

const tg = window.Telegram?.WebApp;
if (tg) { tg.ready(); tg.expand(); try { tg.setHeaderColor("#08090b"); tg.setBackgroundColor("#08090b"); } catch (_) {} }

const screens=[...document.querySelectorAll(".screen")],nav=[...document.querySelectorAll(".nav-item")];
const input=document.getElementById("fileInput"),preview=document.getElementById("previewImage"),analyzeBtn=document.getElementById("analyzeBtn"),toast=document.getElementById("toast");
let file=null,toastTimer;

document.querySelectorAll("[data-go]").forEach(b=>b.onclick=()=>show(b.dataset.go));
document.querySelectorAll("[data-back]").forEach(b=>b.onclick=()=>show("home"));
document.getElementById("choosePhotoBtn").onclick=pick;
document.getElementById("chooseAnotherBtn").onclick=pick;
document.getElementById("newAnalysisBtn").onclick=()=>{file=null;input.value="";preview.removeAttribute("src");show("home")};
input.onchange=e=>selectFile(e.target.files?.[0]);
analyzeBtn.onclick=analyze;
renderHistory();

function show(name){const s=document.querySelector(`[data-screen="${name}"]`);if(!s)return;screens.forEach(x=>x.classList.toggle("active",x===s));nav.forEach(x=>x.classList.toggle("active",x.dataset.go===(["home","history","about"].includes(name)?name:"home")));scrollTo({top:0,behavior:"smooth"})}
function pick(){input.value="";input.click()}
function selectFile(f){if(!f)return;if(!ALLOWED_TYPES.has(f.type))return msg("Only JPG, PNG and WEBP images are supported.");if(f.size>MAX_FILE_SIZE)return msg("Image is too large. Maximum size is 15 MB.");file=f;preview.src=URL.createObjectURL(f);document.getElementById("fileFormat").textContent=f.type.split("/")[1].toUpperCase();document.getElementById("fileSize").textContent=bytes(f.size);show("photo")}
async function analyze(){if(!file)return msg("Choose a photo first.");if(API_BASE_URL.includes("YOUR-GEMINI-WORKER"))return msg("Set API_BASE_URL in app.js first.");analyzeBtn.disabled=true;step(1,"Uploading image…");show("loading");try{step(2,"Inspecting visible face…");const fd=new FormData();fd.append("file",file,file.name);const r=await fetch(API_BASE_URL.replace(/\/$/,"")+"/api/analyze",{method:"POST",body:fd});step(3,"Reading feature values…");const text=await r.text();let d;try{d=JSON.parse(text)}catch(_){throw Error(`Server returned invalid JSON (${r.status}).`)}if(!r.ok||d.success===false)throw Error(d.detail||`Analysis failed (${r.status}).`);step(4,"Preparing report…");render(d);save(d);renderHistory();show("result")}catch(e){show("photo");msg(e.message||"Analysis failed.")}finally{analyzeBtn.disabled=false}}
function step(n,t){document.getElementById("loadingSubtitle").textContent=t;document.querySelectorAll(".loading-step").forEach(x=>{let i=+x.dataset.step;x.classList.toggle("active",i===n);x.classList.toggle("done",i<n)})}
function render(d){let score=Number(d.score),ok=Number.isFinite(score);document.getElementById("resultScore").textContent=ok?score.toFixed(2):"—";document.getElementById("resultProgress").style.width=ok?Math.max(0,Math.min(100,score*10))+"%":"0%";document.getElementById("resultCaption").textContent=ok?"Gemini visual analysis":"No usable face detected";document.getElementById("statFaces").textContent=v(d.face_count);document.getElementById("statLandmarks").textContent=v(d.landmarks_count);document.getElementById("statFeatures").textContent=v(d.feature_count);document.getElementById("statModel").textContent=v(d.model);let m=obj(d.metrics),p=obj(d.production_features);document.getElementById("metricCount").textContent=count(m);document.getElementById("analyzerCount").textContent=count(m);document.getElementById("featureCount").textContent=count(p);overview(m);metrics(m);features(p)}
function overview(m){let g=document.getElementById("overviewGrid");g.innerHTML="";let e=flat(m).slice(0,8);if(!e.length){g.innerHTML='<div class="history-empty">No structured metrics were returned.</div>';return}e.forEach(([k,val])=>{let c=document.createElement("div");c.className="overview-card";c.innerHTML=`<div class="overview-card__label">${esc(pretty(k))}</div><div class="overview-card__value">${esc(fmt(val))}</div><div class="overview-card__source">returned by analyzer</div>`;g.appendChild(c)})}
function metrics(m){let c=document.getElementById("metrics");c.innerHTML="";let e=flat(m);if(!e.length){c.innerHTML='<div class="history-empty">No measurements returned.</div>';return}e.forEach(([k,val])=>{let a=document.createElement("article");a.className="metric-card";a.innerHTML=`<button class="metric-header" type="button"><div class="metric-main"><div class="metric-name">${esc(pretty(k))}</div><div class="metric-key">${esc(k)}</div></div><div class="metric-value">${esc(fmt(val))}</div><div class="metric-arrow">+</div></button><div class="metric-content"><div class="metric-detail"><span>Returned value</span><strong>${esc(fmt(val))}</strong></div></div>`;a.querySelector("button").onclick=()=>a.classList.toggle("open");c.appendChild(a)})}
function features(p){let c=document.getElementById("featureGroups");c.innerHTML="";let groups=Object.entries(p);if(!groups.length){c.innerHTML='<div class="history-empty">No production features returned.</div>';return}groups.forEach(([name,val])=>{let a=document.createElement("article");a.className="feature-group";let e=obj(val)?flat(val):[[name,val]];a.innerHTML=`<button class="feature-group__header" type="button"><span class="feature-group__title">${esc(pretty(name))}</span><span class="feature-group__count">${e.length} VALUES</span><span class="feature-group__arrow">+</span></button><div class="feature-list"><div class="feature-list-inner">${e.map(([k,v])=>`<div class="feature-row"><span class="feature-row__name">${esc(pretty(k))}</span><span class="feature-row__value">${esc(fmt(v))}</span></div>`).join("")}</div></div>`;a.querySelector("button").onclick=()=>a.classList.toggle("open");c.appendChild(a)})}
function save(d){let h=history();h.unshift({createdAt:d.generated_at||new Date().toISOString(),score:d.score,faces:d.face_count,features:d.feature_count,model:d.model});localStorage.setItem(HISTORY_KEY,JSON.stringify(h.slice(0,30)))}
function history(){try{let h=JSON.parse(localStorage.getItem(HISTORY_KEY)||"[]");return Array.isArray(h)?h:[]}catch(_){return[]}}
function renderHistory(){let h=history();document.getElementById("historyCount").textContent=`${h.length} ${h.length===1?"analysis":"analyses"}`;document.getElementById("historySummaryCount").textContent=h.length;let l=document.getElementById("historyList");l.innerHTML="";if(!h.length){l.innerHTML='<div class="history-empty">No analyses yet.<br>Run your first photo analysis.</div>';return}h.forEach(x=>{let r=document.createElement("div");r.className="history-item";let dt=new Date(x.createdAt),ds=Number.isNaN(dt.getTime())?"Unknown date":dt.toLocaleString();r.innerHTML=`<div><div class="date">${esc(ds)}</div><div class="meta">${esc(x.faces??"—")} face · ${esc(x.features??"—")} features · ${esc(x.model??"AI")}</div></div><div class="score">${esc(Number.isFinite(Number(x.score))?Number(x.score).toFixed(2):"—")}</div>`;l.appendChild(r)})}
function count(x){return flat(x).length}
function flat(x,p=""){if(!obj(x))return[[p,x]];let a=[];Object.entries(x).forEach(([k,v])=>a.push(...(obj(v)?flat(v,p?`${p}.${k}`:k):[[p?`${p}.${k}`:k,v]])));return a}
function obj(x){return x!==null&&typeof x==="object"&&!Array.isArray(x)}
function pretty(x){return String(x).split(".").pop().replace(/[_-]+/g," ").replace(/\b\w/g,c=>c.toUpperCase())}
function fmt(x){if(x===null||x===undefined||x==="")return"—";if(typeof x==="number")return Number.isInteger(x)?String(x):x.toFixed(2);if(typeof x==="boolean")return x?"Yes":"No";return String(x)}
function v(x){return x===null||x===undefined||x===""?"—":String(x)}
function bytes(n){return n<1048576?(n/1024).toFixed(1)+" KB":(n/1048576).toFixed(2)+" MB"}
function esc(x){return String(x).replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;")}
function msg(t){toast.textContent=t;toast.classList.add("show");clearTimeout(toastTimer);toastTimer=setTimeout(()=>toast.classList.remove("show"),3200)}
