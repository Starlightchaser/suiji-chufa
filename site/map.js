(function(root){
  "use strict";
  const WORLD=2048,MAX_LAT=85.0511287798066;
  function project(lon,lat){const clamped=Math.max(-MAX_LAT,Math.min(MAX_LAT,lat)),rad=clamped*Math.PI/180;return [(lon+180)/360*WORLD,(1-Math.log(Math.tan(Math.PI/4+rad/2))/Math.PI)/2*WORLD];}
  function inverse(x,y){return [x/WORLD*360-180,Math.atan(Math.sinh(Math.PI*(1-2*y/WORLD)))*180/Math.PI];}
  function fitBounds(bounds,width,height,padding){const p=padding||0,[x0,y0,x1,y1]=bounds,unit=Math.max((x1-x0)/Math.max(1,width-2*p),(y1-y0)/Math.max(1,height-2*p));return {x:(x0+x1-width*unit)/2,y:(y0+y1-height*unit)/2,width:width*unit,height:height*unit};}
  function metersPerUnit(lat){return 40075016.68557849/WORLD*Math.cos(lat*Math.PI/180);}
  function visibleLabels(points){const boxes=[],visible=new Set();for(const p of points.slice().reverse().sort((a,b)=>Number(b.selected)-Number(a.selected))){const font=p.selected?17:13,x=p.x+(p.selected?18:10),y=p.y-font+2,box={x,y,right:x+p.text.length*font+4,bottom:y+font+7};if(p.selected||!boxes.some(b=>box.x<b.right+5&&box.right>b.x-5&&box.y<b.bottom+5&&box.bottom>b.y-5)){visible.add(p.id);boxes.push(box);}}return visible;}
  const math={project,inverse,fitBounds,metersPerUnit,visibleLabels,WORLD};
  if(typeof module!=="undefined"&&module.exports)module.exports=math;
  if(!root.document)return;
  const NS="http://www.w3.org/2000/svg";
  function node(tag,attributes){const n=document.createElementNS(NS,tag);for(const [key,value]of Object.entries(attributes||{}))n.setAttribute(key,String(value));return n;}
  function ring(r){return r.map((p,i)=>(i?"L":"M")+project(p[0],p[1]).map(v=>v.toFixed(4)).join(",")).join(" ")+" Z";}
  function geometry(g){if(!g)return "";const polygons=g.type==="Polygon"?[g.coordinates]:g.type==="MultiPolygon"?g.coordinates:[];return polygons.map(p=>p.map(ring).join(" ")).join(" ");}
  class WorldMap{
    constructor(svg,data,onSelect){this.svg=svg;this.data=data;this.onSelect=onSelect;this.view=null;this.points=[];this.current=null;this.zoom=1;this.drawBase();this.resizeObserver=new ResizeObserver(()=>this.reset());this.resizeObserver.observe(svg);this.installPan();if(!data.map?.features?.length)this.loadBoundary();}
    drawBase(){
      const defs=node("defs"),blur=node("filter",{id:"world-soft",x:"-20%",y:"-20%",width:"140%",height:"140%"});blur.append(node("feGaussianBlur",{stdDeviation:"1.6"}));defs.append(blur);this.svg.append(defs);
      const land=node("g",{class:"world-land",filter:"url(#world-soft)"});for(const f of this.data.world?.features||[])land.append(node("path",{d:geometry(f.geometry)}));this.svg.append(land);
      const grid=node("g",{class:"map-graticule"});for(let lon=-180;lon<=180;lon+=15){const a=project(lon,-80),b=project(lon,80);grid.append(node("path",{d:`M${a} L${b}`}));}for(let lat=-75;lat<=75;lat+=15){const a=project(-180,lat),b=project(180,lat);grid.append(node("path",{d:`M${a} L${b}`}));}this.svg.append(grid);
      this.chinaLayer=node("g",{class:"china-land"});this.drawChina(this.data.map?.features||[]);this.svg.append(this.chinaLayer);
      this.pointLayer=node("g",{class:"map-markers"});this.svg.append(this.pointLayer);this.svg.setAttribute("preserveAspectRatio","xMidYMid meet");
    }
    drawChina(features){this.chinaLayer.replaceChildren();for(const f of features){const p=node("path",{d:geometry(f.geometry),"fill-rule":"evenodd"}),title=node("title");title.textContent=f.properties?.name||"中国地图";p.append(title);this.chinaLayer.append(p);}}
    async loadBoundary(){
      if(this.loadingBoundary)return;this.loadingBoundary=true;
      if(!this.mapNotice){this.mapNotice=document.createElement("div");this.mapNotice.className="map-load-status";this.mapNotice.setAttribute("role","status");this.svg.parentElement.append(this.mapNotice);}
      this.mapNotice.hidden=false;this.mapNotice.textContent="正在展开地图…";
      const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);
      try{
        const response=await fetch("https://geo.datav.aliyun.com/areas_v3/bound/100000_full.json",{signal:controller.signal,credentials:"omit",referrerPolicy:"no-referrer"});
        if(!response.ok)throw new Error("Map response "+response.status);
        const boundary=await response.json();
        if(boundary.type!=="FeatureCollection"||!Array.isArray(boundary.features)||!boundary.features.length)throw new Error("Invalid map data");
        this.drawChina(boundary.features);this.mapNotice.hidden=true;
      }catch(_){
        this.mapNotice.replaceChildren(document.createTextNode("地图暂时没展开，卡片可以继续看。 "));
        const retry=document.createElement("button");retry.type="button";retry.textContent="重试底图";retry.addEventListener("click",()=>this.loadBoundary());this.mapNotice.append(retry);
      }finally{clearTimeout(timer);this.loadingBoundary=false;}
    }
    reset(){const box=this.svg.getBoundingClientRect();if(!box.width||!box.height)return;const mobile=box.width<760,right=mobile?0:Math.min(420,box.width*.32),usableWidth=box.width-right,focusHeight=mobile?box.height*.64:box.height,a=project(72,56),b=project(137,2);let v=fitBounds([a[0],a[1],b[0],b[1]],usableWidth,focusHeight,Math.min(60,box.width*.045));const unit=v.width/usableWidth;v.width=box.width*unit;v.height=box.height*unit;v.x-=right*unit*.05;this.view=v;this.zoom=1;this.applyView();}
    applyView(){if(!this.view)return;const v=this.view;this.svg.setAttribute("viewBox",`${v.x} ${v.y} ${v.width} ${v.height}`);this.renderPoints();this.updateScale();}
    zoomBy(factor){if(!this.view)return;const scale=Math.max(.35,Math.min(5,this.zoom*factor))/this.zoom;this.zoom*=scale;const v=this.view;v.x+=v.width*(1-1/scale)/2;v.y+=v.height*(1-1/scale)/2;v.width/=scale;v.height/=scale;this.applyView();}
    setPoints(cards,current){this.points=cards;this.current=current;this.renderPoints();}
    renderPoints(){this.pointLayer.replaceChildren();if(!this.view)return;const unit=this.view.width/Math.max(1,this.svg.getBoundingClientRect().width),labels=visibleLabels(this.points.map(c=>{const [x,y]=project(...c.coordinates);return {id:c.adcode,text:c.name,x:x/unit,y:y/unit,selected:c.adcode===this.current};}));for(const c of this.points.slice().sort((a,b)=>Number(a.adcode===this.current)-Number(b.adcode===this.current))){const [x,y]=project(...c.coordinates),selected=c.adcode===this.current,g=node("g",{class:"map-marker"+(selected?" selected":""),transform:`translate(${x},${y})`,role:"button",tabindex:"0","aria-label":"查看"+c.name}),title=node("title");title.textContent=c.name;g.append(title,node("circle",{r:16*unit,class:"point-hit"}));if(selected)g.append(node("circle",{r:13*unit,class:"point-ring"}));g.append(node("circle",{r:(selected?6:4.2)*unit,class:"point-dot"}));if(labels.has(c.adcode)){const label=node("text",{x:(selected?18:10)*unit,y:5*unit,"font-size":(selected?17:13)*unit,"stroke-width":3*unit,class:"point-name"});label.textContent=c.name;g.append(label);}g.addEventListener("click",()=>this.onSelect(c));g.addEventListener("keydown",e=>{if(["Enter"," "].includes(e.key)){e.preventDefault();this.onSelect(c);}});this.pointLayer.append(g);}}
    updateScale(){const bar=document.getElementById("scale-bar"),label=document.getElementById("scale-label");if(!bar||!label||!this.view)return;const width=this.svg.getBoundingClientRect().width,lat=inverse(this.view.x+this.view.width/2,this.view.y+this.view.height/2)[1],mpp=this.view.width/width*metersPerUnit(lat),target=mpp*105,power=Math.pow(10,Math.floor(Math.log10(target))),nice=[1,2,5,10].map(n=>n*power).filter(n=>n<=target).pop()||power;bar.style.width=Math.round(nice/mpp)+"px";label.textContent=(nice>=1000?(nice/1000).toLocaleString("zh-CN")+" km":Math.round(nice)+" m");}
    installPan(){let drag=null;this.svg.addEventListener("pointerdown",e=>{if(e.target.closest(".map-marker"))return;drag={x:e.clientX,y:e.clientY,view:{...this.view},id:e.pointerId};this.svg.setPointerCapture(e.pointerId);});this.svg.addEventListener("pointermove",e=>{if(!drag||!drag.view)return;const unit=drag.view.width/this.svg.getBoundingClientRect().width;this.view={...drag.view,x:drag.view.x-(e.clientX-drag.x)*unit,y:drag.view.y-(e.clientY-drag.y)*unit};this.applyView();});const end=()=>{drag=null;};this.svg.addEventListener("pointerup",end);this.svg.addEventListener("pointercancel",end);}
  }
  root.TripMap={WorldMap,...math};
})(typeof window!=="undefined"?window:globalThis);
