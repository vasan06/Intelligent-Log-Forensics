(() => {
"use strict";
if(window.__ILF_LANDING_INITIALIZED__) return;
window.__ILF_LANDING_INITIALIZED__=true;
const init=()=>{
 const nav=document.querySelector(".site-nav");
 const update=()=>nav&&nav.classList.toggle("is-scrolled",(scrollY||0)>20);
 addEventListener("scroll",()=>requestAnimationFrame(update),{passive:true});update();
 document.querySelectorAll("[data-live-status],.status-dot,.pulse-dot").forEach(e=>e.classList.add("is-live"));
};
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init,{once:true});else init();
window.ILFLanding={initialize:init};
})();