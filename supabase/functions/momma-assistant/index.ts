import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const db=createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const MODEL=Deno.env.get("GEMINI_MODEL")??"gemini-3.5-flash-lite";
const URL=`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;
const key=async()=>{const {data,error}=await db.rpc("get_gemini_key");if(error||typeof data!=="string"||!data)throw new Error("gemini_key unavailable");return data};
const clean=(x:unknown,n=600)=>typeof x==="string"?x.trim().slice(0,n):"";
async function gemini(k:string,prompt:string){const r=await fetch(URL,{method:"POST",headers:{"Content-Type":"application/json","x-goog-api-key":k},body:JSON.stringify({contents:[{parts:[{text:prompt}]}],generationConfig:{temperature:0,responseMimeType:"application/json",thinkingConfig:{thinkingLevel:"minimal"}}}),signal:AbortSignal.timeout(30000)});if(!r.ok)throw new Error(`Gemini ${r.status}: ${(await r.text()).slice(0,300)}`);const j=await r.json();return JSON.parse(j?.candidates?.[0]?.content?.parts?.[0]?.text??"{}");}

Deno.serve(async req=>{
  if(req.method!=="POST")return Response.json({error:"POST required"},{status:405});
  let b:any;try{b=await req.json()}catch{return Response.json({error:"Invalid JSON"},{status:400});}
  const lat=Number(b?.latitude),lng=Number(b?.longitude),request=clean(b?.request,1200);
  if(!Number.isFinite(lat)||!Number.isFinite(lng)||!request)return Response.json({error:"request, latitude and longitude are required"},{status:400});

  const token=req.headers.get("Authorization")?.replace(/^Bearer\s+/i,"");
  if(!token)return Response.json({error:"Authentication required"},{status:401});
  const {data:userData,error:userError}=await db.auth.getUser(token);
  if(userError||!userData.user)return Response.json({error:"Invalid authentication"},{status:401});
  const {data:profile}=await db.from("profiles").select("child_age_months,child_interests,child_activity_preferences,preferred_categories,preferred_place_types,indoor_preference,family_budget_note,max_distance_miles").eq("id",userData.user.id).maybeSingle();

  let k:string;try{k=await key()}catch(e){return Response.json({error:String(e)},{status:500});}
  const now=new Date();
  const profileContext={
    child_age_months:profile?.child_age_months??null,
    child_interests:Array.isArray(profile?.child_interests)?profile.child_interests:[],
    child_activity_preferences:Array.isArray(profile?.child_activity_preferences)?profile.child_activity_preferences:[],
    preferred_categories:Array.isArray(profile?.preferred_categories)?profile.preferred_categories:[],
    preferred_place_types:Array.isArray(profile?.preferred_place_types)?profile.preferred_place_types:[],
    indoor_preference:profile?.indoor_preference??"any",
    family_budget_note:clean(profile?.family_budget_note,300),
    max_distance_miles:profile?.max_distance_miles??45
  };

  const intentPrompt=`You are the intent parser for Momma's Meetup. Convert the parent's natural-language request into strict search constraints. Current time: ${now.toISOString()}. Resolve relative dates such as today, tomorrow, Saturday, this weekend. Do not invent a location. Return ONLY JSON {start_at,end_at,max_distance_miles,child_age_months,indoor,budget_max,needs_changing_table,needs_nursing_friendly,needs_stroller_accessible,needs_quiet_or_sensory_friendly,request_summary}. If a constraint is not stated, use null except that child_age_months and max_distance_miles may use the member profile defaults supplied below. For budget: free means 0; cheap/budget/low-cost means 10 unless the parent gives another amount. Never turn an unspecified cost into a known price. For broad time requests choose a reasonable window but never fabricate a specific event. MEMBER PROFILE DEFAULTS: ${JSON.stringify(profileContext)} PARENT REQUEST: ${request}`;
  let intent:any;try{intent=await gemini(k,intentPrompt)}catch(e){return Response.json({error:String(e)},{status:502});}

  const start=new Date(intent?.start_at),end=new Date(intent?.end_at);
  if(!Number.isFinite(start.getTime())||!Number.isFinite(end.getTime())||end<=start)return Response.json({error:"Could not resolve a valid time window",intent},{status:422});
  const maxDistance=Math.min(Math.max(Number(intent?.max_distance_miles??profileContext.max_distance_miles??20),1),50);
  const age=intent?.child_age_months==null?null:Math.max(0,Math.round(Number(intent.child_age_months)));
  const indoor=intent?.indoor===true?true:intent?.indoor===false?false:null;
  const budgetMax=intent?.budget_max==null?null:Math.max(0,Number(intent.budget_max));
  const limit=30;

  const {data:candidates,error}=await db.rpc("get_recommendation_candidates",{p_lat:lat,p_lng:lng,p_start:start.toISOString(),p_end:end.toISOString(),p_max_distance_miles:maxDistance,p_child_age_months:age,p_indoor:indoor,p_needs_changing_table:intent?.needs_changing_table===true,p_needs_nursing_friendly:intent?.needs_nursing_friendly===true,p_needs_stroller_accessible:intent?.needs_stroller_accessible===true,p_needs_quiet_or_sensory_friendly:intent?.needs_quiet_or_sensory_friendly===true,p_budget_max:budgetMax,p_limit:limit});
  if(error)return Response.json({error:`candidate query failed: ${error.message}`,intent},{status:500});
  const list=(candidates??[]).slice(0,30);
  if(!list.length)return Response.json({ok:true,model:MODEL,intent,profile_used:profileContext,candidate_count:0,recommendations:[]});

  const rankPrompt=`You are Momma's Meetup assistant. Recommend ONLY from these database candidates. Never invent facts, prices, dates, distances, facilities or URLs. Distance and dates supplied by the database are authoritative. Treat the member profile as a ranking signal: prefer candidates that match the child's interests, activity preferences, preferred categories/place types and indoor preference when those preferences do not conflict with explicit request constraints. Do not claim a profile match unless the candidate data supports it. Return ONLY JSON {recommendations:[{id,fit,reason}]}, max 3. Make reasons specific to the parent's request and profile. PARENT REQUEST: ${request}\nPARSED INTENT: ${JSON.stringify(intent)}\nMEMBER PROFILE: ${JSON.stringify(profileContext)}\nCANDIDATES: ${JSON.stringify(list)}`;
  let ranked:any;try{ranked=await gemini(k,rankPrompt)}catch(e){return Response.json({error:String(e),intent,candidate_count:list.length},{status:502});}
  const allowed=new Map(list.map((x:any)=>[String(x.id),x]));
  const recommendations=Array.isArray(ranked?.recommendations)?ranked.recommendations.slice(0,3).map((r:any)=>{
    const c=allowed.get(String(r?.id));if(!c)return null;
    return{id:c.id,kind:c.kind,title:c.title,description:clean(c.description,800),venue_name:c.venue_name,reason:clean(r?.reason,300),fit:["excellent","good","possible"].includes(r?.fit)?r.fit:"possible",distance_miles:c.distance_miles,starts_at:c.starts_at,ends_at:c.ends_at,cost:c.cost,age_min_months:c.age_min_months,age_max_months:c.age_max_months,is_outdoor:c.is_outdoor,weather_fit:c.weather_fit,source_url:c.source_url};
  }).filter(Boolean):[];
  return Response.json({ok:true,model:MODEL,intent,profile_used:profileContext,candidate_count:list.length,recommendations});
});
