const TZ = "America/New_York";

export type DateIntent = {
  start_at: string | null;
  end_at: string | null;
};

function isoLocal(y:number,m:number,d:number,h=0,min=0){
  const dt=new Date(Date.UTC(y,m-1,d,h,min));
  const fmt=new Intl.DateTimeFormat("en-US",{timeZone:TZ,timeZoneName:"longOffset",year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",hourCycle:"h23"});
  const parts=Object.fromEntries(fmt.formatToParts(dt).map(p=>[p.type,p.value]));
  const offset=parts.timeZoneName?.replace("GMT","")||"-04:00";
  return `${y}-${String(m).padStart(2,"0")}-${String(d).padStart(2,"0")}T${String(h).padStart(2,"0")}:${String(min).padStart(2,"0")}:00${offset}`;
}

function addDays(d:Date,n:number){const x=new Date(d);x.setUTCDate(x.getUTCDate()+n);return x;}
function localDate(d:Date){const p=new Intl.DateTimeFormat("en-US",{timeZone:TZ,year:"numeric",month:"numeric",day:"numeric"}).formatToParts(d);return {y:+p.find(x=>x.type==="year")!.value,m:+p.find(x=>x.type==="month")!.value,d:+p.find(x=>x.type==="day")!.value};}
function weekday(d:Date){return +new Intl.DateTimeFormat("en-US",{timeZone:TZ,weekday:"short"}).formatToParts(d)[0].valueOf() || 0;}

export function deterministicDateIntent(text:string, now=new Date()):DateIntent|null{
  const t=text.toLowerCase().replace(/\s+/g," ").trim();
  const {y,m,d}=localDate(now);
  const dayNames=["sunday","monday","tuesday","wednesday","thursday","friday","saturday"];
  const shortNames=["sun","mon","tue","wed","thu","fri","sat"];
  const currentDow=new Date(Date.UTC(y,m-1,d)).getUTCDay();
  const make=(offset:number,startHour:number,endHour:number)=>{const x=addDays(new Date(Date.UTC(y,m-1,d)),offset);const p=localDate(x);return {start_at:isoLocal(p.y,p.m,p.d,startHour),end_at:isoLocal(p.y,p.m,p.d,endHour)};};
  if(/\btoday\b/.test(t))return make(0,0,23,59);
  if(/\btomorrow\b/.test(t))return make(1,0,23,59);
  if(/\bthis weekend\b|\bthis weekend's\b/.test(t)){
    const satOffset=(6-currentDow+7)%7;
    return make(satOffset,0,0) && (()=>{const s=addDays(new Date(Date.UTC(y,m-1,d)),satOffset);const su=addDays(s,2);const sp=localDate(s),ep=localDate(su);return {start_at:isoLocal(sp.y,sp.m,sp.d,0),end_at:isoLocal(ep.y,ep.m,ep.d,0)}})();
  }
  for(let i=0;i<7;i++){
    if(t.includes(dayNames[i])||t.includes(shortNames[i])){
      let off=(i-currentDow+7)%7;if(/\bnext\s+(sun|mon|tue|wed|thu|fri|sat|sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/.test(t))off=off===0?7:off+7;
      return make(off,0,23,59);
    }
  }
  return null;
}
