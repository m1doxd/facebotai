const MAX_FILE_SIZE = 15 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg","image/png","image/webp"]);
const DEFAULT_MODEL = "gemini-3.6-flash";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === "OPTIONS") return new Response(null,{status:204,headers:corsHeaders()});

    if (url.pathname === "/api/analyze") {
      if (request.method !== "POST") return json({success:false,detail:"Method not allowed."},405);
      try { return await analyze(request,env); }
      catch (error) {
        console.error("FaceBot Gemini Worker error:",error);
        return json({success:false,detail:error?.message||"Internal analysis error."},500);
      }
    }

    if (url.pathname === "/api/health") {
      return json({success:true,service:"facebot-gemini",status:"ok",model:env.GEMINI_MODEL||DEFAULT_MODEL});
    }

    if (env.ASSETS) return env.ASSETS.fetch(request);

    return new Response("FaceBot Gemini Worker is running.",{status:200,headers:{...corsHeaders(),"content-type":"text/plain; charset=UTF-8"}});
  }
};

async function analyze(request,env) {
  const apiKey=env.GEMINI_API_KEY;
  if (!apiKey) return json({success:false,detail:"GEMINI_API_KEY is not configured in Worker secrets."},500);

  const contentType=request.headers.get("content-type")||"";
  if (!contentType.includes("multipart/form-data")) return json({success:false,detail:"Expected multipart/form-data."},400);

  const form=await request.formData();
  const file=form.get("file");
  if (!file || typeof file.arrayBuffer!=="function") return json({success:false,detail:"No image file was provided."},400);

  const mimeType=file.type||"application/octet-stream";
  if (!ALLOWED_TYPES.has(mimeType)) return json({success:false,detail:"Only JPG, PNG and WEBP images are supported."},400);
  if (file.size>MAX_FILE_SIZE) return json({success:false,detail:"Image is too large. Maximum size is 15 MB."},413);

  const base64=uint8ToBase64(new Uint8Array(await file.arrayBuffer()));
  const model=env.GEMINI_MODEL||DEFAULT_MODEL;

  const prompt=`You are the facial-analysis engine for FaceBot.
Analyze only what is visibly present in the supplied photograph.
Do not identify the person. Do not provide medical diagnosis.
Do not claim to have run MediaPipe or ExtraTrees.
Do not fabricate millimeter measurements.
Return ONLY valid JSON.
If there is no clearly usable face, return face_count=0 and score=null.
The score is a numeric value from 0 to 10 and should be internally consistent with visible facial-structure observations.
Use qualitative values such as low, medium, high, balanced, or uncertain when exact measurement is not justified.
Return approximately 20-35 useful feature values.

Return:
{
 "face_count": number,
 "score": number|null,
 "metrics": {
   "face_geometry": {},
   "symmetry": {},
   "eyes": {},
   "eyebrows": {},
   "nose": {},
   "jaw": {},
   "chin": {},
   "cheeks": {},
   "lips_mouth": {},
   "midface": {}
 },
 "production_features": {}
}`;

  const endpoint=`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
  const body={contents:[{role:"user",parts:[{inline_data:{mime_type:mimeType,data:base64}},{text:prompt}]}],generationConfig:{temperature:0.15,response_mime_type:"application/json"}};

  const r=await fetch(endpoint,{method:"POST",headers:{"Content-Type":"application/json","x-goog-api-key":apiKey},body:JSON.stringify(body)});
  const data=await r.json();
  if(!r.ok) throw new Error(data?.error?.message||`Gemini API error (${r.status})`);

  const text=extractGeminiText(data);
  if(!text) throw new Error("Gemini returned an empty response.");

  return json(normalizeAnalysis(parseJsonResponse(text),model),200);
}

function extractGeminiText(data) {
  const parts=data?.candidates?.[0]?.content?.parts;
  if(!Array.isArray(parts)) return "";
  return parts.filter(p=>typeof p?.text==="string").map(p=>p.text).join("\n").trim();
}

function parseJsonResponse(text) {
  let cleaned=String(text).trim().replace(/^```json\s*/i,"").replace(/^```\s*/i,"").replace(/\s*```$/i,"").trim();
  try{return JSON.parse(cleaned)}catch(_){}
  const s=cleaned.indexOf("{"),e=cleaned.lastIndexOf("}");
  if(s>=0&&e>s){try{return JSON.parse(cleaned.slice(s,e+1))}catch(_){}}
  throw new Error("Gemini returned invalid JSON.");
}

function normalizeAnalysis(data,model) {
  if(!data||typeof data!=="object"||Array.isArray(data)) throw new Error("Invalid analysis payload.");
  let faceCount=Number(data.face_count); if(!Number.isFinite(faceCount)) faceCount=1; faceCount=Math.max(0,Math.round(faceCount));
  let score=data.score;
  if(score!==null&&score!==undefined&&score!==""){score=Number(score);score=Number.isFinite(score)?Math.round(clamp(score,0,10)*100)/100:null}else score=null;
  const metrics=isPlainObject(data.metrics)?data.metrics:{};
  const production=isPlainObject(data.production_features)?data.production_features:{};
  return {success:true,score,face_count:faceCount,landmarks_count:null,detected_features:countLeaves(metrics),feature_count:countLeaves(production),model,metrics,production_features:production,generated_at:new Date().toISOString()};
}

function isPlainObject(v){return v!==null&&typeof v==="object"&&!Array.isArray(v)}
function countLeaves(o){if(!isPlainObject(o))return 0;return Object.values(o).reduce((n,v)=>n+(isPlainObject(v)?countLeaves(v):1),0)}
function clamp(v,min,max){return Math.min(max,Math.max(min,v))}
function uint8ToBase64(bytes){let b="";const size=0x8000;for(let i=0;i<bytes.length;i+=size)b+=String.fromCharCode(...bytes.subarray(i,Math.min(i+size,bytes.length)));return btoa(b)}
function corsHeaders(){return {"Access-Control-Allow-Origin":"*","Access-Control-Allow-Methods":"GET,POST,OPTIONS","Access-Control-Allow-Headers":"Content-Type","Cache-Control":"no-store"}}
function json(data,status=200){return new Response(JSON.stringify(data,null,2),{status,headers:{...corsHeaders(),"Content-Type":"application/json; charset=UTF-8"}})}
