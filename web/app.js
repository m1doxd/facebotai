// web/app.js
"use strict";

const MAX_FILE_SIZE = 15 * 1024 * 1024;
const REQUEST_TIMEOUT = 45_000;
const HEALTH_TIMEOUT = 8_000;
const ALLOWED_TYPES = new Set(["image/jpeg","image/png","image/webp"]);
const API_ENDPOINT =
  "https://facebot-gemini.snow4lyt.workers.dev/api/analyze";

const HEALTH_ENDPOINT =
  "https://facebot-gemini.snow4lyt.workers.dev/api/health";
const HISTORY_KEY = "facemetric_history_v2";
const tg = window.Telegram?.WebApp || null;
const $ = (s,r=document) => r.querySelector(s);
const $$ = (s,r=document) => [...r.querySelectorAll(s)];

const screens = $$(".screen");
const fileInput = $("#file-input");
const uploadButton = $("#upload-btn");
const uploadZone = $("#upload-zone");
const uploadName = $("#upload-name");
const analysisImage = $("#analysis-image");
const analysisFrame = $("#analysis-frame");
const landmarkCanvas = $("#landmark-canvas");
const analysisState = $("#analysis-state");
const analysisScore = $("#analysis-score");
const analysisScoreValue = analysisScore ? $("strong",analysisScore) : null;
const loadingContent = $("#loading-content");
const loadingTitle = $("#loading-title");
const loadingText = $("#loading-text");
const loadingProgressBar = $("#loading-progress-bar");
const loadingSteps = $$(".loading-step");
const resultScore = $("#result-score");
const scoreProgress = $("#score-progress");
const scoreStatus = $("#score-status");
const statsGrid = $("#stats-grid");
const overviewGrid = $("#overview-grid");
const harmonyContent = $("#harmony-content");
const metricsContent = $("#metrics-content");
const angularityContent = $("#angularity-content");
const symmetryContent = $("#symmetry-content");
const dimorphismContent = $("#dimorphism-content");
const healthContent = $("#health-content");
const reportTabs = $("#report-tabs");
const historyCount = $("#history-count");
const historyList = $("#history-list");
const newAnalysisButton = $("#new-analysis");
const toast = $("#toast");

let selectedFile = null;
let selectedObjectUrl = null;
let currentAnalysis = null;
let currentScreen = "home";
let analysisRequestId = 0;
let activeAbortController = null;
let toastTimer = null;
let resultAnimationTimer = null;

const LABELS = {
  face_geometry:"Геометрия лица",
  facial_width_height_balance:"Баланс ширины и высоты",
  face_aspect_ratio:"Соотношение лица",
  midface_proportion:"Пропорции средней трети",
  symmetry:"Симметрия",
  overall_symmetry:"Общая симметрия",
  left_right_balance:"Баланс левой и правой стороны",
  eyes:"Глаза",
  eye_spacing:"Расстояние между глазами",
  eye_aspect_ratio:"Форма глаз",
  eye_alignment:"Выравнивание глаз",
  eye_area_balance:"Баланс области глаз",
  eyebrows:"Брови",
  brow_position:"Положение бровей",
  brow_shape:"Форма бровей",
  brow_symmetry:"Симметрия бровей",
  nose:"Нос",
  nose_width:"Ширина носа",
  nose_length:"Длина носа",
  nose_proportion:"Пропорции носа",
  jaw:"Челюсть",
  jaw_width:"Ширина челюсти",
  jaw_definition:"Выраженность челюсти",
  jaw_shape:"Форма челюсти",
  chin:"Подбородок",
  chin_prominence:"Выраженность подбородка",
  chin_proportion:"Пропорции подбородка",
  cheeks:"Скулы",
  cheek_prominence:"Выраженность скул",
  cheek_definition:"Определённость скул",
  lips_mouth:"Губы и рот",
  mouth_width:"Ширина рта",
  lip_proportion:"Пропорции губ",
  mouth_symmetry:"Симметрия рта",
  midface:"Средняя треть",
  midface_balance:"Баланс средней трети",
  overall_harmony:"Общая гармония",
  frontal_harmony:"Гармония анфас",
  proportions:"Пропорции",
  facial_definition:"Выраженность черт",
  angularity:"Угловатость",
  confidence:"Уверенность анализа",
  dimorphism:"Визуальная выраженность черт"
};

function initTelegram(){
  if(!tg)return;
  try{
    tg.ready();
    tg.expand?.();
    tg.setHeaderColor?.("#07080a");
    tg.setBackgroundColor?.("#07080a");
  }catch(e){console.warn("Telegram:",e);}
}

function showScreen(name){
  const target=document.getElementById(`screen-${name}`);
  if(!target)return;

  screens.forEach(screen=>{
    const active=screen===target;
    screen.classList.toggle("active",active);
    if(active){
      screen.classList.remove("screen-enter");
      void screen.offsetWidth;
      screen.classList.add("screen-enter");
    }
  });

  currentScreen=name;
  updateNavigation(name);
  window.scrollTo({top:0,behavior:"smooth"});

  if(name==="history")renderHistory();
  if(name==="result")activateDefaultResultTab();
}

function updateNavigation(name){
  $$(".nav-item").forEach(item=>{
    const target=item.dataset.screen;
    item.classList.toggle(
      "active",
      target===name ||
      (target==="home" && (name==="analysis" || name==="result"))
    );
  });
}

function openFilePicker(){
  if(!fileInput){
    showToast("Не найден загрузчик фотографии.");
    return;
  }
  fileInput.value="";
  fileInput.click();
}

function validateFile(file){
  if(!file)return{valid:false,message:"Фотография не выбрана."};
  if(!ALLOWED_TYPES.has(file.type)){
    return{valid:false,message:"Поддерживаются только JPG, PNG и WEBP."};
  }
  if(file.size<=0){
    return{valid:false,message:"Файл фотографии пустой."};
  }
  if(file.size>MAX_FILE_SIZE){
    return{valid:false,message:"Фотография слишком большая. Максимум — 15 MB."};
  }
  return{valid:true};
}

function handleFileSelected(file){
  const validation=validateFile(file);
  if(!validation.valid){
    showToast(validation.message);
    return;
  }

  cancelActiveAnalysis();
  analysisRequestId++;
  selectedFile=file;
  revokeSelectedObjectUrl();
  selectedObjectUrl=URL.createObjectURL(file);

  if(uploadName){
    uploadName.textContent=`${file.name} · ${formatBytes(file.size)}`;
  }

  if(analysisImage){
    analysisImage.src=selectedObjectUrl;
    analysisImage.alt="Фотография для анализа";
  }

  clearAnalysisError();
  resetAnalysisPreview();
  showScreen("analysis");
  startAnalysis(file);
}

function resetAnalysisPreview(){
  analysisScore?.classList.remove("show","float","is-final");
  if(analysisScoreValue)analysisScoreValue.textContent="—";

  const small=analysisScore?.querySelector("small");
  if(small)small.textContent="/ 10";

  if(analysisState)analysisState.textContent="АНАЛИЗ";
  loadingContent?.classList.remove("is-hidden");

  if(loadingProgressBar)loadingProgressBar.style.width="0%";
  clearLandmarks();
  clearAnalysisError();
}

function setAnalysisState(text){
  if(analysisState)analysisState.textContent=text;
}

function showAnalysisPreviewScore(score){
  if(!Number.isFinite(Number(score)))return;

  const value=clamp(Number(score),0,10);

  if(analysisScoreValue)analysisScoreValue.textContent=formatScore(value);

  if(analysisScore){
    analysisScore.dataset.level=getMetricLevel(value);
    analysisScore.classList.add("show");

    setTimeout(()=>{
      if(currentScreen==="analysis")analysisScore.classList.add("float");
    },700);
  }
}

function clearLandmarks(){
  if(!landmarkCanvas)return;
  const ctx=landmarkCanvas.getContext("2d");
  if(!ctx)return;
  ctx.clearRect(0,0,landmarkCanvas.width,landmarkCanvas.height);
}

function resizeLandmarkCanvas(){
  if(!landmarkCanvas||!analysisFrame)return;
  const rect=analysisFrame.getBoundingClientRect();
  const ratio=window.devicePixelRatio||1;

  landmarkCanvas.width=Math.max(1,Math.round(rect.width*ratio));
  landmarkCanvas.height=Math.max(1,Math.round(rect.height*ratio));
  landmarkCanvas.style.width=`${rect.width}px`;
  landmarkCanvas.style.height=`${rect.height}px`;

  const ctx=landmarkCanvas.getContext("2d");
  ctx?.setTransform(ratio,0,0,ratio,0,0);
}

async function startAnalysis(file){
  cancelActiveAnalysis();

  const requestId=++analysisRequestId;
  activeAbortController=new AbortController();

  resetLoadingSteps();
  setAnalysisState("АНАЛИЗ");

  try{
    const analysisPromise=analyzePhoto(
      file,
      activeAbortController.signal
    );

    await runLoadingSequence(analysisPromise);
    const raw=await analysisPromise;

    if(requestId!==analysisRequestId)return;

    if(!raw||raw.success!==true){
      throw new Error(
        raw?.detail||
        raw?.error||
        "Анализ не выполнен."
      );
    }

    const result=normalizeClientResult(raw);

    if(result.face_count<=0||result.score===null){
      setAnalysisState("ЛИЦО НЕ НАЙДЕНО");
      completeLoadingSteps();
      showFaceNotFound();
      return;
    }

    currentAnalysis=result;
    completeLoadingSteps();
    setAnalysisState("ГОТОВО");
    showAnalysisPreviewScore(result.score);
    saveHistory(result);

    await sleep(900);

    if(requestId!==analysisRequestId)return;

    renderResult(result);
    showScreen("result");
    startResultScoreTransition();
  }catch(error){
    if(requestId!==analysisRequestId)return;
    if(isAbortError(error))return;

    console.error("FaceMetric:",error);
    setAnalysisState("ОШИБКА");
    showToast(getFriendlyErrorMessage(error));
    showScreen("home");
  }finally{
    if(requestId===analysisRequestId){
      activeAbortController=null;
    }
  }
}

function cancelActiveAnalysis(){
  if(activeAbortController){
    try{activeAbortController.abort();}catch{}
    activeAbortController=null;
  }
}

async function analyzePhoto(file,signal){
  const validation=validateFile(file);
  if(!validation.valid)throw new Error(validation.message);

  const formData=new FormData();
  formData.append("file",file,file.name||"photo.jpg");

  let response;

  try{
    response=await fetchWithTimeout(
      API_ENDPOINT,
      {
        method:"POST",
        body:formData,
        headers:{Accept:"application/json"},
        cache:"no-store",
        signal
      },
      REQUEST_TIMEOUT
    );
  }catch(error){
    if(isAbortError(error))throw error;
    throw new Error("Не удалось подключиться к серверу анализа.");
  }

  const text=await response.text();
  let data=null;

  if(text.trim()){
    try{data=JSON.parse(text);}
    catch{
      throw new Error(
        `Сервер вернул некорректный ответ (${response.status}).`
      );
    }
  }

  if(!response.ok){
    throw new Error(
      data?.detail||
      data?.error||
      getHttpErrorMessage(response.status)
    );
  }

  if(!data)throw new Error("Сервер вернул пустой ответ.");
  return data;
}

async function fetchWithTimeout(url,options={},timeout=30000){
  const controller=new AbortController();
  const externalSignal=options.signal;
  const forwardAbort=()=>controller.abort();

  if(externalSignal){
    if(externalSignal.aborted)controller.abort();
    else externalSignal.addEventListener(
      "abort",
      forwardAbort,
      {once:true}
    );
  }

  const timer=setTimeout(()=>controller.abort(),timeout);

  try{
    return await fetch(url,{
      ...options,
      signal:controller.signal
    });
  }finally{
    clearTimeout(timer);
    externalSignal?.removeEventListener("abort",forwardAbort);
  }
}

async function runLoadingSequence(analysisPromise){
  const steps=[
    ["Обрабатываем фотографию","Подготавливаем изображение"],
    ["Определяем лицо","Ищем основные точки и контуры лица"],
    ["Измеряем пропорции","Анализируем геометрию и черты"],
    ["Проверяем симметрию","Сравниваем левую и правую стороны"],
    ["Формируем результат","Собираем фактически полученные показатели"]
  ];

  for(let i=0;i<steps.length;i++){
    setLoadingStep(i,steps[i][0],steps[i][1]);

    if(loadingProgressBar){
      loadingProgressBar.style.width=
        `${Math.round(((i+1)/steps.length)*100)}%`;
    }

    if(i<steps.length-1){
      await Promise.race([
        sleep(430),
        analysisPromise.catch(()=>null)
      ]);
    }else{
      await Promise.race([
        analysisPromise.catch(()=>null),
        sleep(900)
      ]);
    }
  }
}

function resetLoadingSteps(){
  loadingSteps.forEach((step,index)=>{
    step.classList.toggle("active",index===0);
    step.classList.remove("done");
  });

  if(loadingTitle)loadingTitle.textContent="Анализируем";
  if(loadingText)loadingText.textContent="Подготавливаем изображение";
  if(loadingProgressBar)loadingProgressBar.style.width="0%";
}

function setLoadingStep(index,title,text){
  loadingSteps.forEach(step=>{
    const n=Number(step.dataset.step);
    step.classList.toggle("active",n===index);
    step.classList.toggle("done",n<index);
  });

  if(loadingTitle)loadingTitle.textContent=title;
  if(loadingText)loadingText.textContent=text;
}

function completeLoadingSteps(){
  loadingSteps.forEach(step=>{
    step.classList.remove("active");
    step.classList.add("done");
  });

  if(loadingProgressBar)loadingProgressBar.style.width="100%";
}

function normalizeClientResult(data){
  const source=isObject(data.analysis)
    ? {...data,...data.analysis}
    : data;

  return{
    success:true,
    score:normalizeScore(source.score),
    face_count:toNumberOrZero(source.face_count),
    landmarks_count:nullableNumber(source.landmarks_count),
    detected_features:toNumberOrZero(source.detected_features),
    feature_count:toNumberOrZero(source.feature_count),
    metrics:isObject(source.metrics)?source.metrics:{},
    production_features:
      isObject(source.production_features)
        ?source.production_features
        :{},
    generated_at:
      source.generated_at||
      new Date().toISOString()
  };
}

function renderResult(result){
  ensureResultFace(result);
  renderScore(result.score);
  renderStats(result);
  renderOverview(result.metrics,result.production_features);
  renderHarmony(result.metrics,result.production_features);
  renderMetrics(result.metrics);
  renderAngularity(result.metrics,result.production_features);
  renderSymmetry(result.metrics,result.production_features);
  renderDimorphism(result.metrics,result.production_features);
  renderHealth();
}

function ensureResultFace(result){
  const resultScreen=$("#screen-result");
  const resultHero=$(".result-hero",resultScreen);
  if(!resultScreen||!resultHero)return;

  let visual=$("#result-visual",resultScreen);

  if(!visual){
    visual=document.createElement("div");
    visual.id="result-visual";
    visual.className="result-visual";

    visual.innerHTML=`
      <div class="result-visual__media">
        <img class="result-visual__image" alt="Результат анализа">
        <div class="result-visual__shade"></div>
        <div class="result-visual__corners" aria-hidden="true">
          <i></i><i></i><i></i><i></i>
        </div>
        <div class="result-visual__top">
          <span>ANALYSIS COMPLETE</span>
          <span class="result-visual__status">READY</span>
        </div>
        <div class="result-visual__score">
          <small>MEASURED SCORE</small>
          <strong>—</strong>
          <span>/ 10</span>
        </div>
        <div class="result-visual__bottom">
          <span>FACE</span>
          <b class="result-visual__faces">—</b>
          <span>LANDMARKS</span>
          <b class="result-visual__landmarks">—</b>
        </div>
      </div>
    `;

    resultHero.parentNode.insertBefore(visual,resultHero);
  }

  const image=$(".result-visual__image",visual);
  const score=$(".result-visual__score strong",visual);
  const faces=$(".result-visual__faces",visual);
  const landmarks=$(".result-visual__landmarks",visual);

  if(image&&selectedObjectUrl)image.src=selectedObjectUrl;
  if(score)score.textContent=formatScore(result.score);
  if(faces)faces.textContent=String(result.face_count);

  if(landmarks){
    landmarks.textContent=
      result.landmarks_count===null
        ?"—"
        :formatValue(result.landmarks_count);
  }

  visual.dataset.level=getMetricLevel(result.score);
  visual.classList.remove("is-complete");
  resultHero.classList.remove("score-landed");
}

function startResultScoreTransition(){
  const resultScreen=$("#screen-result");
  const visual=$("#result-visual",resultScreen);
  const hero=$(".result-hero",resultScreen);
  if(!visual||!hero)return;

  clearTimeout(resultAnimationTimer);

  visual.classList.remove("is-complete");
  hero.classList.remove("score-landed");

  resultAnimationTimer=setTimeout(()=>{
    visual.classList.add("is-complete");
    hero.classList.add("score-landed");
  },1050);
}

function renderScore(score){
  if(!resultScore)return;

  const small=resultScore.parentElement?.querySelector("small");
  if(small)small.textContent="/ 10";

  if(!Number.isFinite(Number(score))){
    resultScore.textContent="—";
    resultScore.dataset.level="";
    if(scoreProgress)scoreProgress.style.width="0%";
    if(scoreStatus)scoreStatus.textContent="Оценка не получена";
    return;
  }

  const value=clamp(Number(score),0,10);
  resultScore.textContent=formatScore(value);
  resultScore.dataset.level=getMetricLevel(value);

  if(scoreProgress){
    scoreProgress.style.width=`${value*10}%`;
    scoreProgress.dataset.level=getMetricLevel(value);
  }

  if(scoreStatus)scoreStatus.textContent=getScoreStatus(value);
}

function getScoreStatus(score){
  if(score<4)return"Низкий измеренный результат";
  if(score<5.5)return"Средний измеренный результат";
  if(score<7)return"Сбалансированный результат";
  if(score<8.5)return"Высокий измеренный результат";
  if(score<9.5)return"Очень высокий измеренный результат";
  return"Исключительно высокий измеренный результат";
}

function renderStats(result){
  if(!statsGrid)return;

  const measurementCount=
    result.feature_count||
    result.detected_features||
    countLeaves(result.metrics);

  statsGrid.innerHTML="";

  [
    ["ЛИЦО",String(result.face_count),"обнаружено"],
    [
      "ТОЧКИ",
      result.landmarks_count===null
        ?"—"
        :formatValue(result.landmarks_count),
      "лицевой геометрии"
    ],
    ["ИЗМЕРЕНИЯ",String(measurementCount),"показателей"]
  ].forEach(([labelText,valueText,detailText])=>{
    const card=document.createElement("article");
    card.className="stat";

    const label=document.createElement("span");
    label.textContent=labelText;

    const value=document.createElement("strong");
    value.textContent=valueText;

    const detail=document.createElement("small");
    detail.textContent=detailText;

    card.append(label,value,detail);
    statsGrid.appendChild(card);
  });
}

function renderOverview(metrics,production){
  if(!overviewGrid)return;

  overviewGrid.innerHTML="";

  const groups=[
    {
      title:"Гармония",
      values:getProductionValues(
        production,
        ["overall_harmony","frontal_harmony","proportions"]
      )
    },
    {
      title:"Геометрия лица",
      values:getGroup(metrics,["face_geometry"])
    },
    {
      title:"Симметрия",
      values:getGroup(metrics,["symmetry"])
    }
  ];

  let rendered=0;

  groups.forEach(group=>{
    if(!group.values.length)return;

    const section=document.createElement("section");
    section.className="overview-section";

    const title=document.createElement("h3");
    title.textContent=group.title;
    section.appendChild(title);

    group.values.slice(0,6).forEach(([key,value])=>{
      section.appendChild(createMetricCard(key,value));
      rendered++;
    });

    overviewGrid.appendChild(section);
  });

  if(!rendered){
    overviewGrid.appendChild(
      createEmptyBlock("Измерения не были получены.")
    );
  }
}

function renderHarmony(metrics,production){
  renderFeaturePanel(
    harmonyContent,
    "Гармония лица",
    "Ключевые показатели, которые реально вернул сервер.",
    [
      ...getProductionValues(
        production,
        ["overall_harmony","frontal_harmony","proportions"]
      ),
      ...getGroup(metrics,["face_geometry"]),
      ...getGroup(metrics,["midface"])
    ]
  );
}

function renderMetrics(metrics){
  if(!metricsContent)return;

  metricsContent.innerHTML="";
  const entries=flattenObject(metrics);

  if(!entries.length){
    metricsContent.appendChild(
      createEmptyBlock("Подробные измерения не были получены.")
    );
    return;
  }

  entries.forEach(([path,value])=>{
    metricsContent.appendChild(createMetricCard(path,value));
  });
}

function renderAngularity(metrics,production){
  renderFeaturePanel(
    angularityContent,
    "Угловатость и выраженность",
    "Только фактически возвращённые числовые показатели.",
    [
      ...getGroup(metrics,["jaw"]),
      ...getGroup(metrics,["cheeks"]),
      ...getProductionValues(
        production,
        ["angularity","facial_definition"]
      )
    ]
  );
}

function renderSymmetry(metrics,production){
  renderFeaturePanel(
    symmetryContent,
    "Симметрия",
    "Баланс сторон лица по полученным измерениям.",
    [
      ...getGroup(metrics,["symmetry"]),
      ...getGroup(metrics,["eyes"]).filter(
        ([key])=>key==="eye_alignment"
      ),
      ...getProductionValues(production,["symmetry"])
    ]
  );
}

function renderDimorphism(metrics,production){
  renderFeaturePanel(
    dimorphismContent,
    "Визуальная выраженность черт",
    "Показывается только при наличии соответствующего поля.",
    getProductionValues(production,["dimorphism"])
  );
}

function renderFeaturePanel(container,titleText,description,values){
  if(!container)return;

  container.innerHTML="";

  const unique=[];
  const seen=new Set();

  values.forEach(([key,value])=>{
    const signature=`${key}:${String(value)}`;
    if(seen.has(signature))return;
    seen.add(signature);
    unique.push([key,value]);
  });

  if(!unique.length){
    container.appendChild(
      createEmptyBlock("Показатели этого раздела не были получены.")
    );
    return;
  }

  container.appendChild(
    createSectionIntro(titleText,description)
  );

  unique.forEach(([key,value])=>{
    container.appendChild(createMetricCard(key,value));
  });
}

function createMetricCard(key,value){
  const card=document.createElement("article");
  card.className="scale-card";

  const top=document.createElement("div");
  top.className="scale-card__top";

  const name=document.createElement("span");
  name.className="scale-card__name";
  name.textContent=getRussianLabel(key);

  const score=document.createElement("strong");
  score.className="scale-card__score";

  const numeric=normalizeMetricValue(value);
  const isScore=numeric!==null;

  score.textContent=isScore
    ?`${formatMetricScore(numeric)}/10`
    :formatValue(value);

  top.append(name,score);
  card.appendChild(top);

  if(isScore){
    const track=document.createElement("div");
    track.className="metric-scale";
    track.setAttribute("role","meter");
    track.setAttribute("aria-valuemin","0");
    track.setAttribute("aria-valuemax","10");
    track.setAttribute("aria-valuenow",String(numeric));

    const fill=document.createElement("div");
    fill.className="metric-scale__fill";
    fill.dataset.level=getMetricLevel(numeric);
    fill.style.width=`${numeric*10}%`;

    track.appendChild(fill);

    const labels=document.createElement("div");
    labels.className="metric-scale__labels";
    labels.innerHTML=`
      <span>слабее</span>
      <span>средне</span>
      <span>выражено</span>
    `;

    card.append(track,labels);
  }else{
    const raw=document.createElement("div");
    raw.className="metric-raw";
    raw.textContent="Фактическое значение";
    card.appendChild(raw);
  }

  return card;
}

function renderHealth(){
  if(!healthContent)return;

  healthContent.innerHTML="";

  const icon=document.createElement("div");
  icon.className="note-icon";
  icon.textContent="i";

  const text=document.createElement("p");
  text.textContent=
    "Этот раздел не является медицинской диагностикой. " +
    "Система отображает только визуальные характеристики, " +
    "которые реально удалось получить из изображения.";

  healthContent.append(icon,text);
}

function showFaceNotFound(){
  const analysisScreen=$("#screen-analysis");
  if(!analysisScreen)return;

  let card=$("#analysis-error-card",analysisScreen);

  if(!card){
    card=document.createElement("div");
    card.id="analysis-error-card";
    card.className="analysis-error-card";

    card.innerHTML=`
      <div class="analysis-error-card__icon">—</div>
      <div>
        <span class="eyebrow">ANALYSIS STOPPED</span>
        <h3>Лицо не найдено</h3>
        <p>
          На фотографии не удалось получить достаточно данных
          для корректного измерительного анализа.
        </p>
      </div>
      <button type="button" class="secondary-btn" data-retry-analysis>
        Выбрать другую фотографию <span>↗</span>
      </button>
    `;

    analysisScreen.appendChild(card);

    card
      .querySelector("[data-retry-analysis]")
      ?.addEventListener("click",openFilePicker);
  }

  card.classList.add("show");
  loadingContent?.classList.add("is-hidden");
}

function clearAnalysisError(){
  $("#analysis-error-card")?.remove();
}

function getHistory(){
  try{
    const raw=localStorage.getItem(HISTORY_KEY);
    if(!raw)return[];

    const parsed=JSON.parse(raw);
    return Array.isArray(parsed)?parsed:[];
  }catch{
    return[];
  }
}

function saveHistory(result){
  if(!Number.isFinite(Number(result.score)))return;

  try{
    const history=getHistory();

    history.unshift({
      id:`${Date.now()}_${Math.random().toString(36).slice(2,8)}`,
      created_at:
        result.generated_at||
        new Date().toISOString(),
      score:result.score,
      face_count:result.face_count,
      landmarks_count:result.landmarks_count,
      feature_count:result.feature_count,
      detected_features:result.detected_features
    });

    localStorage.setItem(
      HISTORY_KEY,
      JSON.stringify(history.slice(0,50))
    );

    updateHistoryCount();
  }catch(error){
    console.warn("History:",error);
  }
}

function renderHistory(){
  if(!historyList)return;

  const history=getHistory();
  updateHistoryCount(history.length);
  historyList.innerHTML="";

  if(!history.length){
    historyList.appendChild(
      createEmptyBlock("Пока нет сохранённых анализов.")
    );
    return;
  }

  history.forEach(entry=>{
    const item=document.createElement("article");
    item.className="history-item";

    const left=document.createElement("div");

    const date=document.createElement("div");
    date.className="date";
    date.textContent=formatDate(entry.created_at);

    const meta=document.createElement("div");
    meta.className="meta";
    meta.textContent=
      `${entry.face_count||0} лицо · `+
      `${entry.feature_count||entry.detected_features||0} измерений`;

    left.append(date,meta);

    const score=document.createElement("div");
    score.className="score";

    if(Number.isFinite(Number(entry.score))){
      score.dataset.level=getMetricLevel(Number(entry.score));
      score.textContent=formatScore(entry.score);
    }else{
      score.textContent="—";
    }

    item.append(left,score);
    historyList.appendChild(item);
  });
}

function updateHistoryCount(count=null){
  const value=count===null?getHistory().length:count;
  if(historyCount)historyCount.textContent=String(value);
}

function bindResultTabs(){
  if(!reportTabs)return;

  const tabs=$$(".tab",reportTabs);
  const panels=$$(".tab-panel");

  tabs.forEach((tab,index)=>{
    tab.addEventListener("click",()=>activateResultTab(tab));

    tab.addEventListener("keydown",event=>{
      if(event.key==="ArrowRight"){
        event.preventDefault();
        activateResultTab(
          tabs[(index+1)%tabs.length],
          true
        );
      }

      if(event.key==="ArrowLeft"){
        event.preventDefault();
        activateResultTab(
          tabs[(index-1+tabs.length)%tabs.length],
          true
        );
      }
    });
  });

  function activateResultTab(tab,focus=false){
    const target=tab.dataset.tab;
    if(!target)return;

    tabs.forEach(item=>{
      const active=item===tab;
      item.classList.toggle("active",active);
      item.setAttribute(
        "aria-selected",
        active?"true":"false"
      );
    });

    panels.forEach(panel=>{
      const active=panel.dataset.panel===target;
      panel.classList.toggle("active",active);
      panel.hidden=!active;
    });

    if(focus)tab.focus();
  }
}

function activateDefaultResultTab(){
  if(!reportTabs)return;

  const first=$('.tab[data-tab="overview"]',reportTabs);
  if(!first)return;

  const tabs=$$(".tab",reportTabs);
  const panels=$$(".tab-panel");

  tabs.forEach(tab=>{
    const active=tab===first;
    tab.classList.toggle("active",active);
    tab.setAttribute(
      "aria-selected",
      active?"true":"false"
    );
  });

  panels.forEach(panel=>{
    const active=panel.dataset.panel==="overview";
    panel.classList.toggle("active",active);
    panel.hidden=!active;
  });
}

function startNewAnalysis(){
  analysisRequestId++;
  cancelActiveAnalysis();

  selectedFile=null;
  currentAnalysis=null;
  revokeSelectedObjectUrl();

  if(fileInput)fileInput.value="";
  if(uploadName){
    uploadName.textContent="JPG, PNG или WEBP · до 15 MB";
  }
  if(analysisImage)analysisImage.removeAttribute("src");

  $("#result-visual")?.remove();

  resetAnalysisPreview();
  showScreen("home");
}

function showToast(message){
  if(!toast)return;

  toast.textContent=String(message||"Произошла ошибка.");
  toast.classList.add("show");

  clearTimeout(toastTimer);
  toastTimer=setTimeout(()=>{
    toast.classList.remove("show");
  },4200);
}

function getFriendlyErrorMessage(error){
  const message=String(error?.message||"");

  if(!message){
    return"Анализ не выполнен. Попробуй ещё раз.";
  }

  if(
    message.includes("Failed to fetch")||
    message.includes("NetworkError")
  ){
    return"Не удалось подключиться к серверу анализа.";
  }

  if(message.includes("413"))return"Фотография слишком большая.";
  if(message.includes("429"))return"Слишком много запросов. Попробуй позже.";
  if(message.includes("401")||message.includes("403")){
    return"Сервер не смог выполнить авторизацию.";
  }

  if(message.toLowerCase().includes("timeout")){
    return"Сервер анализа отвечает слишком долго.";
  }

  return message;
}

function getHttpErrorMessage(status){
  if(status===400)return"Некорректный запрос к серверу анализа.";
  if(status===401)return"Ошибка авторизации сервера.";
  if(status===403)return"Доступ к серверу анализа запрещён.";
  if(status===413)return"Фотография слишком большая.";
  if(status===429)return"Слишком много запросов. Попробуй позже.";
  if(status>=500)return"Ошибка сервера анализа.";
  return`Ошибка сервера (${status}).`;
}

function isAbortError(error){
  return(
    error?.name==="AbortError"||
    String(error?.message||"")
      .toLowerCase()
      .includes("aborted")
  );
}

function formatBytes(bytes){
  if(!Number.isFinite(bytes))return"—";
  if(bytes<1024)return`${bytes} B`;
  if(bytes<1024*1024)return`${(bytes/1024).toFixed(1)} KB`;
  return`${(bytes/(1024*1024)).toFixed(2)} MB`;
}

function formatScore(score){
  const number=Number(score);
  if(!Number.isFinite(number))return"—";

  return String(
    Math.round(clamp(number,0,10)*10)/10
  ).replace(".",",");
}

function formatMetricScore(value){
  return String(
    Math.round(value*10)/10
  ).replace(".",",");
}

function formatValue(value){
  if(value===null||value===undefined||value==="")return"—";

  if(typeof value==="number"){
    if(!Number.isFinite(value))return"—";
    return String(
      Math.round(value*100)/100
    ).replace(".",",");
  }

  if(typeof value==="boolean")return value?"Да":"Нет";

  if(typeof value==="object"){
    try{return JSON.stringify(value);}
    catch{return"—";}
  }

  return String(value);
}

function formatDate(value){
  const date=new Date(value);
  if(Number.isNaN(date.getTime()))return"Неизвестная дата";

  return date.toLocaleString("ru-RU",{
    year:"numeric",
    month:"short",
    day:"numeric",
    hour:"2-digit",
    minute:"2-digit"
  });
}

function getRussianLabel(key){
  const raw=String(key||"");
  const lastPart=raw.includes(".")
    ?raw.split(".").pop()
    :raw;

  return LABELS[lastPart]||LABELS[raw]||prettifyKey(lastPart);
}

function prettifyKey(key){
  return String(key||"")
    .replace(/[\_-]+/g," ")
    .replace(/([a-z])([A-Z])/g,"$1 $2")
    .replace(/\s+/g," ")
    .trim()
    .replace(/^./,char=>char.toUpperCase());
}

function isObject(value){
  return(
    value!==null&&
    typeof value==="object"&&
    !Array.isArray(value)
  );
}

function flattenObject(object,prefix=""){
  const result=[];
  if(!isObject(object))return result;

  Object.entries(object).forEach(([key,value])=>{
    const path=prefix?`${prefix}.${key}`:key;

    if(isObject(value)){
      result.push(...flattenObject(value,path));
    }else{
      result.push([path,value]);
    }
  });

  return result;
}

function countLeaves(object){
  return flattenObject(object).length;
}

function toNumberOrZero(value){
  const number=Number(value);
  return Number.isFinite(number)?number:0;
}

function nullableNumber(value){
  if(value===null||value===undefined||value==="")return null;
  const number=Number(value);
  return Number.isFinite(number)?number:null;
}

function normalizeScore(value){
  if(value===null||value===undefined||value==="")return null;
  const number=Number(value);
  if(!Number.isFinite(number))return null;

  return Math.round(
    clamp(number,0,10)*100
  )/100;
}

function normalizeMetricValue(value){
  if(value===null||value===undefined||value==="")return null;
  const number=Number(value);
  if(!Number.isFinite(number))return null;
  return number>=0&&number<=10?number:null;
}

function getMetricLevel(value){
  if(value<4)return"low";
  if(value<7)return"medium";
  return"high";
}

function clamp(value,min,max){
  return Math.min(max,Math.max(min,value));
}

function getGroup(object,names){
  if(!isObject(object))return[];

  const result=[];

  names.forEach(name=>{
    const group=object[name];
    if(isObject(group)){
      result.push(...Object.entries(group));
    }
  });

  return result;
}

function getProductionValues(production,names){
  if(!isObject(production))return[];

  const result=[];

  names.forEach(name=>{
    if(production[name]!==undefined){
      result.push([name,production[name]]);
    }
  });

  return result;
}

function createEmptyBlock(message){
  const div=document.createElement("div");
  div.className="history-empty";
  div.textContent=message;
  return div;
}

function createSectionIntro(titleText,descriptionText){
  const heading=document.createElement("div");
  heading.className="section-intro";

  const title=document.createElement("strong");
  title.textContent=titleText;

  const description=document.createElement("span");
  description.textContent=descriptionText;

  heading.append(title,description);
  return heading;
}

function revokeSelectedObjectUrl(){
  if(!selectedObjectUrl)return;
  try{URL.revokeObjectURL(selectedObjectUrl);}catch{}
  selectedObjectUrl=null;
}

function checkWorkerHealth(){
  const controller=new AbortController();
  const timer=setTimeout(
    ()=>controller.abort(),
    HEALTH_TIMEOUT
  );

  return fetch(HEALTH_ENDPOINT,{
    method:"GET",
    cache:"no-store",
    headers:{Accept:"application/json"},
    signal:controller.signal
  })
    .then(response=>{
      if(!response.ok)return false;
      return response
        .json()
        .then(data=>data?.success===true)
        .catch(()=>false);
    })
    .catch(()=>false)
    .finally(()=>clearTimeout(timer));
}

function sleep(ms){
  return new Promise(resolve=>setTimeout(resolve,ms));
}

function bindEvents(){
  uploadButton?.addEventListener("click",event=>{
    event.preventDefault();
    openFilePicker();
  });

  fileInput?.addEventListener("change",event=>{
    handleFileSelected(event.target.files?.[0]);
  });

  uploadZone?.addEventListener("dragover",event=>{
    event.preventDefault();
    uploadZone.classList.add("dragover");
  });

  uploadZone?.addEventListener("dragleave",()=>{
    uploadZone.classList.remove("dragover");
  });

  uploadZone?.addEventListener("drop",event=>{
    event.preventDefault();
    uploadZone.classList.remove("dragover");
    handleFileSelected(event.dataTransfer?.files?.[0]);
  });

  $$("[data-screen]").forEach(element=>{
    element.addEventListener("click",()=>{
      const target=element.dataset.screen;
      if(target&&element!==uploadButton)showScreen(target);
    });
  });

  $$(".back-btn").forEach(button=>{
    button.addEventListener("click",()=>{
      showScreen(button.dataset.screen||"home");
    });
  });

  newAnalysisButton?.addEventListener(
    "click",
    startNewAnalysis
  );

  bindResultTabs();
  window.addEventListener("resize",resizeLandmarkCanvas);

  window.addEventListener("beforeunload",()=>{
    cancelActiveAnalysis();
    revokeSelectedObjectUrl();
  });
}

function init(){
  initTelegram();
  bindEvents();
  updateHistoryCount();
  activateDefaultResultTab();
  showScreen("home");

  setTimeout(()=>{
    checkWorkerHealth().then(healthy=>{
      document.body.dataset.system=healthy?"ready":"offline";
    });
  },300);
}

init();
