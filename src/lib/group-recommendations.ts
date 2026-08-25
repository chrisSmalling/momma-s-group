export type GroupChild = { ageMonths: number };
export type GroupMember = { id: string; children: GroupChild[]; homeLat?: number | null; homeLng?: number | null };
export type GroupConstraints = { memberIds?: string[]; budget?: "free" | "low" | "any"; maxMiles?: number; indoorOutdoor?: "indoor" | "outdoor" | "any"; groupSize?: number };
export type GroupCandidate = { id: string; name: string; isOutdoor: boolean | null; lat?: number | null; lng?: number | null; ageMinMonths?: number | null; ageMaxMonths?: number | null; priceText?: string | null; hasChangingTable?: boolean | null; restrooms?: boolean | null; strollerAccessible?: boolean | null; enclosed?: boolean | null };

function haversine(aLat:number,aLng:number,bLat:number,bLng:number){const r=3958.7613,dLat=(bLat-aLat)*Math.PI/180,dLng=(bLng-aLng)*Math.PI/180,x=Math.sin(dLat/2)**2+Math.cos(aLat*Math.PI/180)*Math.cos(bLat*Math.PI/180)*Math.sin(dLng/2)**2;return 2*r*Math.asin(Math.sqrt(x));}
function midpoint(members:GroupMember[]){const located=members.filter(m=>m.homeLat!=null&&m.homeLng!=null);if(!located.length)return null;return {lat:located.reduce((s,m)=>s+(m.homeLat??0),0)/located.length,lng:located.reduce((s,m)=>s+(m.homeLng??0),0)/located.length};}
function ageFit(candidate:GroupCandidate, children:GroupChild[]){if(!children.length)return 0;const lo=candidate.ageMinMonths??0,hi=candidate.ageMaxMonths??144;const fits=children.filter(c=>c.ageMonths>=lo&&c.ageMonths<=hi).length;return (fits/children.length)*42;}
function budgetFit(c:GroupCandidate,b:GroupConstraints["budget"]){if(b!=="free")return 0;return /free|\$0|no cost/i.test(c.priceText??"")?18:-12;}
export function scoreGroupCandidate(candidate:GroupCandidate,members:GroupMember[],constraints:GroupConstraints={}):number{
 const selected=constraints.memberIds?.length?members.filter(m=>constraints.memberIds!.includes(m.id)):members;
 const children=selected.flatMap(m=>m.children);let score=ageFit(candidate,children);
 if(constraints.indoorOutdoor&&constraints.indoorOutdoor!=="any") score+=(constraints.indoorOutdoor==="outdoor"?candidate.isOutdoor===true:candidate.isOutdoor===false)?28:-18;
 score+=budgetFit(candidate,constraints.budget);
 if(candidate.hasChangingTable)score+=5;if(candidate.restrooms)score+=4;if(candidate.strollerAccessible)score+=4;if(candidate.enclosed)score+=3;
 const center=midpoint(selected);if(center&&candidate.lat!=null&&candidate.lng!=null){const d=haversine(center.lat,center.lng,candidate.lat,candidate.lng);const max=constraints.maxMiles??30;if(d>max)return -999;score+=Math.max(0,24-d*0.9);}
 if(selected.length>=3&&candidate.restrooms)score+=4;
 return score;
}
export function rankGroupCandidates(candidates:GroupCandidate[],members:GroupMember[],constraints:GroupConstraints={}):GroupCandidate[]{return [...candidates].map(c=>({candidate:c,score:scoreGroupCandidate(c,members,constraints)})).filter(x=>x.score>-999).sort((a,b)=>b.score-a.score).map(x=>x.candidate);}

export function groupRecommendationReason(candidate:GroupCandidate,members:GroupMember[],constraints:GroupConstraints={}):string{
 const selected=constraints.memberIds?.length?members.filter(m=>constraints.memberIds!.includes(m.id)):members;const children=selected.flatMap(m=>m.children);const reasons:string[]=[];
 const lo=candidate.ageMinMonths??0,hi=candidate.ageMaxMonths??144;const fit=children.filter(c=>c.ageMonths>=lo&&c.ageMonths<=hi).length;
 if(children.length&&fit===children.length)reasons.push("works for all the kids");else if(fit)reasons.push(`works for ${fit} of ${children.length} kids");
 if(constraints.budget==="free"&&/free|\$0|no cost/i.test(candidate.priceText??""))reasons.push("fits a free-day budget");
 if(candidate.hasChangingTable||candidate.restrooms)reasons.push("has useful parent amenities");
 if(candidate.strollerAccessible)reasons.push("stroller-friendly");
 if(candidate.enclosed)reasons.push("easier to manage little runners");
 return reasons.length?reasons.join(" · "):"a strong fit for your group";
}
