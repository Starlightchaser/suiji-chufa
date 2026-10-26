(function(root){
  "use strict";
  const unique=items=>[...new Set(items)];
  function chooseNext(cards,seenIds,region,rng){const seen=new Set(seenIds),pool=cards.filter(c=>(region==="all"||c.macro_region===region)&&!seen.has(c.adcode));return pool.length?pool[Math.min(pool.length-1,Math.floor((rng||Math.random)()*pool.length))]:null;}
  function safePublicUrl(value){try{const u=new URL(value);if(!/^https?:$/.test(u.protocol)||u.username||u.password)return null;if(/^(localhost|127\.|0\.|10\.|192\.168\.|\[::1\])/.test(u.hostname)||/^172\.(1[6-9]|2\d|3[01])\./.test(u.hostname))return null;return u.href;}catch(_){return null;}}
  function parseLinks(text){const urls=String(text).slice(0,20000).match(/https?:\/\/[^\s<>"，。；）)\]}]+/g)||[];return unique(urls.map(safePublicUrl).filter(Boolean)).slice(0,50);}
  function searchUrl(query){return "https://www.xiaohongshu.com/search_result?keyword="+encodeURIComponent(query)+"&source=web_explore_feed";}
  function mergeNotes(existing,urls,adcode,now){const result=existing.slice(),keys=new Set(existing.map(n=>n.adcode+"|"+n.url));for(const url of urls){const key=adcode+"|"+url;if(keys.has(key)||result.length>=500)continue;keys.add(key);result.push({id:"n-"+now+"-"+result.length,adcode,url,marked:false,importedAt:now});}return result;}
  function normalizeState(saved,cards,version){
    const ids=new Set(cards.map(c=>c.adcode)),valid=id=>typeof id==="string"&&ids.has(id),input=saved&&typeof saved==="object"?saved:{},feedback={};
    for(const [id,item]of Object.entries(input.feedback||{})){if(valid(id)&&item&&["liked","skipped"].includes(item.value))feedback[id]={value:item.value,at:typeof item.at==="string"?item.at:""};}
    const seenIds=unique((Array.isArray(input.seenIds)?input.seenIds:[]).filter(valid));
    const encounteredIds=unique([...(Array.isArray(input.encounteredIds)?input.encounteredIds:[]).filter(valid),...seenIds,...Object.keys(feedback)]);
    const notes=(Array.isArray(input.notes)?input.notes:[]).filter(n=>n&&valid(n.adcode)&&typeof n.id==="string"&&safePublicUrl(n.url)).slice(0,500).map(n=>({id:n.id,adcode:n.adcode,url:safePublicUrl(n.url),marked:Boolean(n.marked),importedAt:typeof n.importedAt==="string"?n.importedAt:""}));
    return {schemaVersion:2,version,seenIds,encounteredIds,feedback,notes,memoryDraft:typeof input.memoryDraft==="string"?input.memoryDraft.slice(0,2000):"",currentId:valid(input.currentId)?input.currentId:null};
  }
  function remember(state,id){if(!state.seenIds.includes(id))state.seenIds.push(id);if(!state.encounteredIds.includes(id))state.encounteredIds.push(id);state.currentId=id;}
  function resetRound(state){state.seenIds=[];return state;}
  function recordSkip(state,id,now){if(state.feedback[id]?.value!=="liked")state.feedback[id]={value:"skipped",at:now};return state;}
  function sheetState(distance,current){if(distance<-45)return current==="peek"?"half":"expanded";if(distance>45)return current==="expanded"?"half":"peek";return current;}
  const api={chooseNext,safePublicUrl,parseLinks,searchUrl,mergeNotes,normalizeState,remember,resetRound,recordSkip,sheetState};
  if(typeof module!=="undefined"&&module.exports)module.exports=api;root.TripCore=api;
})(typeof window!=="undefined"?window:globalThis);
