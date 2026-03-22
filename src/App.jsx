import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";

// --- Constants ----------------------------------------------------------------
const DEFAULT_CATEGORIES = [
  { id:"work",     label:"Work",     color:"#E07A5F" },
  { id:"personal", label:"Personal", color:"#81B29A" },
  { id:"health",   label:"Health",   color:"#F2CC8F" },
  { id:"learning", label:"Learning", color:"#7B9EC9" },
  { id:"other",    label:"Other",    color:"#C9A7EB" },
];
const PRIORITY_ORDER = { high:0, medium:1, low:2 };
const PRIORITY_META  = {
  high:  { label:"High", color:"#E07A5F" },
  medium:{ label:"Med",  color:"#F2CC8F" },
  low:   { label:"Low",  color:"#81B29A" },
};
const BASE_SORT_OPTIONS = [
  { id:"priority", label:"Priority",  icon:"⚡" },
  { id:"manual",   label:"My Order",  icon:"✋" },
  { id:"workTime", label:"Work Time", icon:"🕐" },
  { id:"dueTime",  label:"Due Time",  icon:"⏰" },
  { id:"duration", label:"Duration",  icon:"⏱" },
  { id:"alpha",    label:"A → Z",     icon:"🔤" },
];
const RECUR_OPTIONS = [
  { id:"none",     label:"None",          icon:"--"  },
  { id:"daily",    label:"Daily",         icon:"☀️" },
  { id:"weekdays", label:"Weekdays",      icon:"💼" },
  { id:"weekends", label:"Weekends",      icon:"🌅" },
  { id:"weekly",   label:"Weekly",        icon:"📅" },
  { id:"monthly",  label:"Monthly",       icon:"🗓" },
  { id:"custom",   label:"Custom days",   icon:"⚙️" },
];
const DAY_LABELS = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
const AUDIO_OPTIONS = [
  { id:"none",    label:"None",       icon:"🔇" },
  { id:"chime",   label:"Chime",      icon:"🎵" },
  { id:"bell",    label:"Bell",       icon:"🔔" },
  { id:"beeps",   label:"3 Beeps",    icon:"📳" },
  { id:"fanfare", label:"Fanfare",    icon:"🎺" },
  { id:"zen",     label:"Zen Bowl",   icon:"🧘" },
  { id:"success", label:"Success",    icon:"✨" },
  { id:"radar",   label:"Radar Ping", icon:"📡" },
  { id:"marimba", label:"Marimba",    icon:"🎶" },
  { id:"piano",   label:"Piano",      icon:"🎹" },
  { id:"digital", label:"Digital",    icon:"💻" },
  { id:"nature",  label:"Nature",     icon:"🌿" },
];
const SWATCH_COLORS = ["#E07A5F","#81B29A","#F2CC8F","#7B9EC9","#C9A7EB","#F4A261","#E76F51","#2A9D8F","#E9C46A","#264653","#A8DADC","#E63946","#457B9D","#6A4C93"];
const ACCENT_OPTS   = ["#E07A5F","#81B29A","#7B9EC9","#C9A7EB","#F4A261","#E9C46A","#2A9D8F","#E63946"];

// --- Themes -------------------------------------------------------------------
const THEMES = {
  dark: {
    bg:"#0F0F14", surface:"#1A1A22", surface2:"#141418",
    border:"#1E1E28", border2:"#252530",
    text:"#F0EDE8", textMuted:"#555", textDim:"#444",
    navBg:"#0A0A0Ecc",
  },
  light: {
    bg:"#F5F3EF", surface:"#FFFFFF", surface2:"#F0EDE8",
    border:"#E8E4DC", border2:"#DDD8CE",
    text:"#1A1A22", textMuted:"#888", textDim:"#AAA",
    navBg:"#F5F3EFee",
  },
};

// --- Helpers ------------------------------------------------------------------
function daysFromNow(n){ const d=new Date(); d.setDate(d.getDate()+n); return d.toDateString(); }
function todayStr()    { return new Date().toDateString(); }
function tomorrowStr() { return daysFromNow(1); }
function yesterdayStr(){ return daysFromNow(-1); }
function getCat(id,cats){ return (cats||DEFAULT_CATEGORIES).find(c=>c.id===id)||DEFAULT_CATEGORIES[4]; }
function fmtTime(t){
  if(!t) return "";
  const[h,m]=t.split(":").map(Number);
  return `${h%12||12}:${String(m).padStart(2,"0")} ${h>=12?"PM":"AM"}`;
}
function nowTimeStr(){
  const n=new Date();
  return `${String(n.getHours()).padStart(2,"0")}:${String(n.getMinutes()).padStart(2,"0")}`;
}
function fmtDateLabel(d){
  if(d===todayStr()) return "Today";
  if(d===tomorrowStr()) return "Tomorrow";
  if(d===yesterdayStr()) return "Yesterday";
  return new Date(d).toLocaleDateString("en-US",{weekday:"long",month:"short",day:"numeric"});
}
function fmtDuration(mins){
  if(mins<60) return `${mins} min`;
  const h=Math.floor(mins/60), m=mins%60;
  return m>0 ? `${h}h ${m}m` : `${h} hour${h!==1?"s":""}`;
}
function calcEstFinish(workTime,minutes){
  const base=workTime
    ?(()=>{ const[h,m]=workTime.split(":").map(Number); const b=new Date(); b.setHours(h,m,0,0); return b; })()
    :new Date();
  const fin=new Date(base.getTime()+minutes*60000);
  const fh=fin.getHours(), fm=fin.getMinutes();
  return `${fh%12||12}:${String(fm).padStart(2,"0")} ${fh>=12?"PM":"AM"}${workTime?"":" (~if started now)"}`;
}
function shouldRecurToday(task,dateStr){
  if(!task.recur||task.recur==="none") return false;
  const d=new Date(dateStr), day=d.getDay(), orig=new Date(task.date);
  if(task.recur==="daily")    return true;
  if(task.recur==="weekdays") return day>=1&&day<=5;
  if(task.recur==="weekends") return day===0||day===6;
  if(task.recur==="weekly")   return day===orig.getDay();
  if(task.recur==="monthly")  return d.getDate()===orig.getDate();
  if(task.recur==="custom")   return Array.isArray(task.recurDays)&&task.recurDays.includes(day);
  return false;
}
// Next date a task should recur after a given date
function nextRecurDate(task, afterDateStr){
  const start=new Date(afterDateStr);
  const limit=task.recur==="monthly"?35:8; // monthly needs up to 31 days
  for(let i=1;i<=limit;i++){
    const d=new Date(start); d.setDate(start.getDate()+i);
    if(shouldRecurToday(task,d.toDateString())) return d.toDateString();
  }
  return null;
}
function taskAgeDays(task){
  if(task.done||!task.createdAt) return 0;
  return Math.floor((Date.now()-task.createdAt)/(1000*60*60*24));
}
function ageColor(days){
  if(days>=7)  return "#E07A5F"; // red -- week+
  if(days>=3)  return "#F2CC8F"; // yellow -- 3+ days
  return null;
}
function buildSortOptions(categories,hiddenSorts=[]){
  const base=BASE_SORT_OPTIONS.filter(s=>!hiddenSorts.includes(s.id));
  const cats=categories.map(c=>({id:"cat_"+c.id,label:c.label,icon:"●",color:c.color,isCat:true})).filter(s=>!hiddenSorts.includes(s.id));
  return [...base,...cats];
}

// --- Haptics (graceful - works on Android, silent on iOS/desktop) -------------
function haptic(type="light"){
  try{
    if(!("vibrate" in navigator)) return;
    if(type==="light")   navigator.vibrate(10);
    else if(type==="medium")  navigator.vibrate(25);
    else if(type==="heavy")   navigator.vibrate(60);
    else if(type==="success") navigator.vibrate([10,40,10]);
    else if(type==="error")   navigator.vibrate([40,20,40]);
    else if(type==="double")  navigator.vibrate([15,30,15]);
    else if(type==="triple")  navigator.vibrate([10,20,10,20,10]);
  }catch(e){}
}

// --- Audio ---------------------------------------------------------------------
function playTimerSound(type){
  try{
    const ctx=new(window.AudioContext||window.webkitAudioContext)();
    const play=(freq,start,dur,wave="sine",gain=0.38)=>{
      const o=ctx.createOscillator(), g=ctx.createGain();
      o.connect(g); g.connect(ctx.destination);
      o.type=wave; o.frequency.setValueAtTime(freq,ctx.currentTime+start);
      g.gain.setValueAtTime(0,ctx.currentTime+start);
      g.gain.linearRampToValueAtTime(gain,ctx.currentTime+start+0.02);
      g.gain.linearRampToValueAtTime(0,ctx.currentTime+start+dur);
      o.start(ctx.currentTime+start); o.stop(ctx.currentTime+start+dur+0.05);
    };
    if(type==="chime")   { play(880,0,0.6); play(1108,0.3,0.5); play(1320,0.6,0.8); }
    else if(type==="bell")    { play(1046,0,1.4,"sine",0.5); play(1318,0,1.2,"sine",0.3); play(523,0,1.4,"sine",0.15); }
    else if(type==="beeps")   { play(880,0,0.12); play(880,0.2,0.12); play(880,0.4,0.12); }
    else if(type==="fanfare") { [[523,0],[659,0.1],[784,0.2],[1046,0.3],[784,0.5],[1046,0.65]].forEach(([f,t])=>play(f,t,0.18)); }
    else if(type==="zen")     { play(432,0,2.0,"sine",0.28); play(648,0.05,1.8,"sine",0.14); play(324,0.1,2.2,"sine",0.09); }
    else if(type==="success") { play(523,0,0.15); play(659,0.15,0.15); play(784,0.3,0.15); play(1046,0.45,0.5); }
    else if(type==="radar")   { for(let i=0;i<4;i++) play(1200+i*30,i*0.35,0.08,"sine",0.22); }
    else if(type==="marimba") { [[784,0],[988,0.12],[1175,0.24],[1568,0.36],[1175,0.5],[1568,0.64]].forEach(([f,t])=>play(f,t,0.14,"sine",0.32)); }
    else if(type==="piano")   { [[262,0],[330,0.08],[392,0.16],[523,0.24],[659,0.36],[784,0.48]].forEach(([f,t])=>play(f,t,0.4,"sine",0.28)); }
    else if(type==="digital") { play(440,0,0.05,"square",0.2); play(880,0.1,0.05,"square",0.2); play(440,0.2,0.05,"square",0.2); play(1760,0.3,0.15,"square",0.2); }
    else if(type==="nature")  { play(440,0,0.8,"sine",0.15); play(550,0.1,0.7,"sine",0.12); play(660,0.2,0.9,"sine",0.1); play(440,0.5,0.6,"sine",0.08); }
  }catch(e){}
}

// --- Notifications -------------------------------------------------------------
async function requestNotificationPermission(){
  if(!("Notification" in window)) return false;
  if(Notification.permission==="granted") return true;
  if(Notification.permission==="denied") return false;
  const perm=await Notification.requestPermission();
  return perm==="granted";
}
function scheduleNotification(title,body,delayMs){
  if(!("Notification" in window)||Notification.permission!=="granted") return null;
  const id=setTimeout(()=>{
    try{ new Notification(title,{body,icon:"/icon.svg",badge:"/icon.svg"}); }catch(e){}
  },delayMs);
  return id;
}

// --- Initial data -------------------------------------------------------------
const now=Date.now();
const INITIAL_TASKS=[
  {id:1, title:"Review notes",      category:"learning",priority:"medium",minutes:30, workTime:"15:00",dueTime:"16:00",notes:"Chapter 4 & 5",            done:false,date:daysFromNow(0),createdAt:now-6e5, recur:"none",   subtasks:[],manualOrder:0,actualMinutes:0},
  {id:2, title:"Morning run",        category:"health",  priority:"high",  minutes:45, workTime:"07:00",dueTime:"",     notes:"",                          done:true, date:daysFromNow(0),createdAt:now-7e5, recur:"daily",  subtasks:[],manualOrder:1,actualMinutes:42,recurStreak:3},
  {id:3, title:"Read emails",        category:"work",    priority:"low",   minutes:15, workTime:"09:00",dueTime:"10:00",notes:"Reply to pending ones",     done:false,date:daysFromNow(0),createdAt:now-8e5, recur:"weekdays",recurStreak:2,subtasks:[{id:"s1",text:"Inbox zero",done:false},{id:"s2",text:"Reply to Alex",done:true}],manualOrder:2,actualMinutes:0},
  {id:4, title:"Study chapter 6",    category:"learning",priority:"high",  minutes:60, workTime:"16:00",dueTime:"18:00",notes:"Focus on practice problems",done:false,date:daysFromNow(1),createdAt:now-9e5, recur:"none",   subtasks:[],manualOrder:3,actualMinutes:0},
  {id:5, title:"Grocery run",        category:"personal",priority:"medium",minutes:30, workTime:"11:00",dueTime:"",     notes:"",                          done:false,date:daysFromNow(1),createdAt:now-1e6, recur:"none",   subtasks:[{id:"s3",text:"Milk & eggs",done:false},{id:"s4",text:"Veggies",done:false}],manualOrder:4,actualMinutes:0},
  {id:6, title:"Doctor appointment", category:"health",  priority:"high",  minutes:45, workTime:"14:00",dueTime:"14:00",notes:"Bring insurance card",      done:false,date:daysFromNow(3),createdAt:now-1.1e6,recur:"none",   subtasks:[],manualOrder:5,actualMinutes:0},
  {id:7, title:"Project proposal",   category:"work",    priority:"high",  minutes:90, workTime:"17:00",dueTime:"19:00",notes:"Draft & send to team",      done:false,date:daysFromNow(5),createdAt:now-1.2e6,recur:"none",   subtasks:[],manualOrder:6,actualMinutes:0},
  {id:8, title:"Meditate",           category:"health",  priority:"low",   minutes:10, workTime:"07:00",dueTime:"",     notes:"",                          done:true, date:daysFromNow(0),createdAt:now-1.3e6,recur:"daily",  subtasks:[],manualOrder:7,actualMinutes:10,recurStreak:5},
  {id:9, title:"Call mom",           category:"personal",priority:"medium",minutes:20, workTime:"18:00",dueTime:"20:00",notes:"",                          done:false,date:daysFromNow(0),createdAt:now-1.4e6,recur:"weekly", recurStreak:1,subtasks:[],manualOrder:8,actualMinutes:0},
  {id:10,title:"Prep lunch",         category:"personal",priority:"low",   minutes:15, workTime:"12:00",dueTime:"",     notes:"",                          done:false,date:daysFromNow(1),createdAt:now-1.5e6,recur:"daily",  recurStreak:0,subtasks:[],manualOrder:9,actualMinutes:0},
];
const INITIAL_TEMPLATES=[
  {id:"t1",name:"Study Session",  icon:"📚",task:{category:"learning",priority:"high",  minutes:60,workTime:"",dueTime:"",notes:"",recur:"none",subtasks:[]}},
  {id:"t2",name:"Quick Email",    icon:"📧",task:{category:"work",    priority:"low",   minutes:15,workTime:"",dueTime:"",notes:"",recur:"none",subtasks:[]}},
  {id:"t3",name:"Morning Workout",icon:"🏃",task:{category:"health",  priority:"high",  minutes:45,workTime:"07:00",dueTime:"",notes:"",recur:"daily",subtasks:[]}},
];
const DEFAULT_SETTINGS={
  sortBy:"priority",accentColor:"#E07A5F",compactView:false,
  showStreak:true,defaultMinutes:25,notificationsOn:false,
  hiddenSorts:[],timerSound:"chime",theme:"dark",countdownMode:"mm:ss",reducedMotion:false,
};

// --- Page Transition ----------------------------------------------------------
function PageTransition({children}){
  const[vis,setVis]=useState(false);
  useEffect(()=>{ requestAnimationFrame(()=>setVis(true)); },[]);
  return(
    <div style={{opacity:vis?1:0,transform:vis?"translateY(0) scale(1)":"translateY(16px) scale(0.985)",transition:"opacity 0.3s cubic-bezier(0.4,0,0.2,1),transform 0.3s cubic-bezier(0.4,0,0.2,1)",minHeight:"100vh",display:"flex",flexDirection:"column"}}>
      {children}
    </div>
  );
}

// -----------------------------------------------------------------------------
// --- App ----------------------------------------------------------------------
// -----------------------------------------------------------------------------
export default function App(){
  const[tasks,          setTasks]         =useState(INITIAL_TASKS);
  const[categories,     setCategories]    =useState(DEFAULT_CATEGORIES);
  const[settings,       setSettings]      =useState(DEFAULT_SETTINGS);
  const[templates,      setTemplates]     =useState(INITIAL_TEMPLATES);
  const[tab,            setTab]           =useState("home");
  const[sheetOpen,      setSheetOpen]     =useState(false);
  const[taskForm,       setTaskForm]      =useState(null);
  const[timerTask,      setTimerTask]     =useState(null);
  const[actionMenu,     setActionMenu]    =useState(null);
  const[deleteConfirm,  setDeleteConfirm] =useState(null);
  const[justDone,       setJustDone]      =useState(null);
  const[justDeleted,    setJustDeleted]   =useState(null);
  const[undoDelete,     setUndoDelete]    =useState(null); // {task, timerId}
  const[justAppeared,   setJustAppeared]  =useState(null);
  const[streak,         setStreak]        =useState(0);
  const[streakLastDate, setStreakLastDate]=useState(null);
  const[streakPrev,     setStreakPrev]    =useState(0);    // streak count before today's increment
  const[streakPrevDate, setStreakPrevDate]=useState(null); // streakLastDate before today's increment
  const[loaded,         setLoaded]        =useState(false);
  const[expandedNote,   setExpandedNote]  =useState(null);
  const[quickAdd,       setQuickAdd]      =useState("");
  const[showSummary,    setShowSummary]   =useState(false);
  const[summaryData,    setSummaryData]   =useState(null);
  const[showTemplates,  setShowTemplates] =useState(false);
  const[showOnboarding, setShowOnboarding]=useState(false);
  const[showDevMenu,    setShowDevMenu]   =useState(false);
  const[listSearch,     setListSearch]    =useState("");
  const[notifGranted,   setNotifGranted]  =useState(false);
  const[focusLog,       setFocusLog]      =useState([]);
  const prevVisibleIds =useRef(new Set());
  const dragStart      =useRef(null);
  const summaryShownFor=useRef(null);
  const notifTimers    =useRef([]);

  const accent = settings.accentColor;
  const th     = THEMES[settings.theme||"dark"];

  // -- Storage helpers ---------------------------------------------------------
  const lsGet = k=>{ try{ return localStorage.getItem(k); }catch(e){ return null; } };
  const lsSet = (k,v)=>{ try{ localStorage.setItem(k,JSON.stringify(v)); }catch(e){} };

  // -- Load --------------------------------------------------------------------
  useEffect(()=>{
    try{
      const t=lsGet('tf_tasks'),c=lsGet('tf_categories'),s=lsGet('tf_settings');
      const st=lsGet('tf_streak'),tmpl=lsGet('tf_templates'),ob=lsGet('tf_onboarding_seen');
      if(t)   setTasks(JSON.parse(t));
      if(c)   setCategories(JSON.parse(c));
      if(s)   setSettings(p=>({...p,...JSON.parse(s)}));
      if(st)  { const{count,lastDate,prev,prevDate}=JSON.parse(st); setStreak(count||0); setStreakLastDate(lastDate||null); setStreakPrev(prev||0); setStreakPrevDate(prevDate||null); }
      if(tmpl) setTemplates(JSON.parse(tmpl));
      const fl=lsGet('tf_focuslog'); if(fl) setFocusLog(JSON.parse(fl));
      if(!ob)  setShowOnboarding(true);
      setNotifGranted(typeof Notification!=="undefined"&&Notification.permission==="granted");
    }catch(e){ setShowOnboarding(true); }
    setLoaded(true);
  },[]);

  useEffect(()=>{ if(!loaded)return; lsSet('tf_tasks',tasks); },[tasks,loaded]);
  useEffect(()=>{ if(!loaded)return; lsSet('tf_categories',categories); },[categories,loaded]);
  useEffect(()=>{ if(!loaded)return; lsSet('tf_settings',settings); },[settings,loaded]);
  useEffect(()=>{ if(!loaded)return; lsSet('tf_streak',{count:streak,lastDate:streakLastDate,prev:streakPrev,prevDate:streakPrevDate}); },[streak,streakLastDate,streakPrev,streakPrevDate,loaded]);
  useEffect(()=>{ if(!loaded)return; lsSet('tf_templates',templates); },[templates,loaded]);
  useEffect(()=>{ if(!loaded)return; lsSet('tf_focuslog',focusLog); },[focusLog,loaded]);

  // -- Midnight date-change detector ------------------------------------------
  useEffect(()=>{
    if(!loaded) return;
    let lastDate=todayStr();
    const id=setInterval(()=>{
      const now=todayStr();
      if(now!==lastDate){ lastDate=now; triggerRecur(); }
    },30000); // check every 30 seconds
    return()=>clearInterval(id);
  },[loaded]);

  // Reset summary gate on day change
  useEffect(()=>{
    if(!loaded) return;
    const today=todayStr();
    if(summaryShownFor.current&&summaryShownFor.current!==today){
      summaryShownFor.current=null;
    }
  },[loaded]);

  function triggerRecur(){
    if(!loaded) return; // don't run before initial storage load
    const today=todayStr();
    setTasks(prev=>{
      // Solidify recurStreak for completed old clones before removing them
      const completedOldClones=prev.filter(t=>t.recurSourceId&&t.date!==today&&t.done);
      const streakUpdates={};
      completedOldClones.forEach(t=>{ streakUpdates[t.recurSourceId]=(streakUpdates[t.recurSourceId]||0)+1; });
      let next=prev
        .map(t=>streakUpdates[t.id]?{...t,recurStreak:(t.recurStreak||0)+streakUpdates[t.id]}:t)
        .filter(t=>{
          if(!t.recurSourceId) return true;
          if(t.date===today)   return true;
          return false;
        });
      const existing=new Set(next.filter(t=>t.date===today).map(t=>t.recurSourceId||t.id));
      const toAdd=[];
      next.forEach(t=>{
        if(!t.recur||t.recur==="none"||t.date===today||existing.has(t.id)) return;
        if(shouldRecurToday(t,today)){
          toAdd.push({...t,id:Date.now()+Math.random(),date:today,done:false,actualMinutes:0,recurSourceId:t.id,createdAt:Date.now(),subtasks:(t.subtasks||[]).map(s=>({...s,done:false}))});
        }
      });
      return toAdd.length>0?[...next,...toAdd]:next;
    });
  }

  // -- Recur --------------------------------------------------------------------
  useEffect(()=>{
    if(!loaded) return;
    const today=todayStr();
    setTasks(prev=>{
      // Remove stale incomplete recurring clones from previous days
      // Before filtering, collect completed old clones to solidify their recurStreak
      const completedOldClones=prev.filter(t=>
        t.recurSourceId && t.date!==today && t.done
      );
      // Increment recurStreak on source for each completed old clone
      let streakUpdates={};
      completedOldClones.forEach(t=>{
        streakUpdates[t.recurSourceId]=(streakUpdates[t.recurSourceId]||0)+1;
      });
      let next=prev
        .map(t=> streakUpdates[t.id]
          ? {...t,recurStreak:(t.recurStreak||0)+streakUpdates[t.id]}
          : t
        )
        .filter(t=>{
          if(!t.recurSourceId) return true;   // keep source tasks & non-recurring
          if(t.date===today)   return true;   // keep today's clone
          return false;                       // remove all old clones (done or not)
        });
      // Generate today's clone if one doesn't exist yet
      const existing=new Set(next.filter(t=>t.date===today).map(t=>t.recurSourceId||t.id));
      const toAdd=[];
      next.forEach(t=>{
        if(!t.recur||t.recur==="none"||t.date===today||existing.has(t.id)) return;
        if(shouldRecurToday(t,today)){
          toAdd.push({...t,
            id:Date.now()+Math.random(),
            date:today,done:false,actualMinutes:0,
            recurSourceId:t.id,createdAt:Date.now(),
            subtasks:(t.subtasks||[]).map(s=>({...s,done:false})),
          });
        }
      });
      return toAdd.length>0?[...next,...toAdd]:next;
    });
  },[loaded]);

  // -- Derived -----------------------------------------------------------------
  const todayAll    = useMemo(()=>tasks.filter(t=>t.date===todayStr()&&!(t.recur&&t.recur!=="none"&&!t.recurSourceId)),[tasks]);
  const todayDone   = useMemo(()=>todayAll.filter(t=>t.done),[todayAll]);
  const todayInc    = useMemo(()=>todayAll.filter(t=>!t.done),[todayAll]);
  const tomorrowAll = useMemo(()=>tasks.filter(t=>t.date===tomorrowStr()&&!(t.recur&&t.recur!=="none"&&!t.recurSourceId)),[tasks]);
  const overdueAll  = useMemo(()=>tasks.filter(t=>{
    if(t.done) return false;
    if(new Date(t.date)>=new Date(todayStr())) return false;
    if(t.recur&&t.recur!=="none") return false; // recurring tasks (source OR clone) never show as overdue -- they regenerate
    return true;
  }),[tasks]);
  const progress    = todayAll.length>0?todayDone.length/todayAll.length:0;

  // -- Streak ------------------------------------------------------------------
  useEffect(()=>{
    if(!loaded) return;
    const today=todayStr();
    const yest=new Date(); yest.setDate(yest.getDate()-1);
    const yesterdayStr2=yest.toDateString();
    const allDoneToday=todayAll.length>0&&todayAll.every(t=>t.done);

    if(allDoneToday){
      if(streakLastDate===today) return; // already counted today
      const isConsecutive=streakLastDate===yesterdayStr2;
      // Use current state values (already available in effect closure since deps include tasks)
      setStreakPrev(streak);
      setStreakPrevDate(streakLastDate);
      setStreak(isConsecutive?streak+1:1);
      setStreakLastDate(today);
    } else {
      // Unchecked after all-done today -- roll back to exact previous state
      if(streakLastDate===today){
        setStreak(streakPrev);
        setStreakLastDate(streakPrevDate);
      }
      // Missed a day -- reset
      else if(streakLastDate&&streakLastDate!==today&&streakLastDate!==yesterdayStr2){
        setStreak(0);
        setStreakPrev(0);
        setStreakPrevDate(null);
        setStreakLastDate(null);
      }
    }
  },[tasks,loaded]);

  // -- Summary -----------------------------------------------------------------
  useEffect(()=>{
    if(!loaded) return;
    const today=todayStr();
    if(todayAll.length>0&&todayAll.every(t=>t.done)&&summaryShownFor.current!==today){
      summaryShownFor.current=today;
      // Capture values synchronously before setTimeout
      const doneFinal=todayDone.length;
      const focusFinal=todayDone.reduce((s,t)=>s+(t.actualMinutes||t.minutes),0);
      const streakFinal=streak;
      setTimeout(()=>{
        setSummaryData({done:doneFinal,totalFocus:focusFinal,streak:streakFinal});
        setShowSummary(true);
      },600);
    }
  },[tasks,loaded]);


  // -- Notification scheduling -------------------------------------------------
  useEffect(()=>{
    notifTimers.current.forEach(id=>clearTimeout(id));
    notifTimers.current=[];
    if(!settings.notificationsOn||!notifGranted) return;
    const now2=new Date();
    tasks.filter(t=>t.date===todayStr()&&!t.done&&t.workTime).forEach(t=>{
      const[h,m]=t.workTime.split(":").map(Number);
      const taskTime=new Date(); taskTime.setHours(h,m,0,0);
      const fiveMin=new Date(taskTime.getTime()-5*60000);
      const diff5=fiveMin.getTime()-now2.getTime();
      if(diff5>0){
        const id=scheduleNotification("TaskFlow -- Coming Up",`"${t.title}" starts in 5 minutes`,diff5);
        if(id) notifTimers.current.push(id);
      }
    });
  },[tasks,settings.notificationsOn,notifGranted]);

  // -- Sort ---------------------------------------------------------------------
  function sortList(list,by){
    return [...list].sort((a,b)=>{
      if(by==="priority") return PRIORITY_ORDER[a.priority]-PRIORITY_ORDER[b.priority];
      if(by==="manual")   return (a.manualOrder||0)-(b.manualOrder||0);
      if(by==="workTime") return (a.workTime||"").localeCompare(b.workTime||"");
      if(by==="dueTime")  return (a.dueTime||"").localeCompare(b.dueTime||"");
      if(by==="duration") return a.minutes-b.minutes;
      if(by==="alpha")    return a.title.localeCompare(b.title);
      if(by.startsWith("cat_")){
        const catId=by.replace("cat_","");
        const am=a.category===catId?0:1, bm=b.category===catId?0:1;
        return am!==bm?am-bm:PRIORITY_ORDER[a.priority]-PRIORITY_ORDER[b.priority];
      }
      return 0;
    });
  }

  const homeList      = useMemo(()=>sortList(todayInc,settings.sortBy),[tasks,settings.sortBy]);
  const allUpcoming   = useMemo(()=>tasks.filter(t=>new Date(t.date)>=new Date(todayStr())).sort((a,b)=>new Date(a.date)-new Date(b.date)||PRIORITY_ORDER[a.priority]-PRIORITY_ORDER[b.priority]),[tasks]);
  const allWithOverdue= useMemo(()=>tasks.filter(t=>new Date(t.date)>=new Date(todayStr())&&!(t.recur&&t.recur!=="none"&&!t.recurSourceId)).sort((a,b)=>new Date(a.date)-new Date(b.date)||PRIORITY_ORDER[a.priority]-PRIORITY_ORDER[b.priority]),[tasks]);
  const groupedByDate = useMemo(()=>{ const g={}; allWithOverdue.forEach(t=>{ if(!g[t.date])g[t.date]=[]; g[t.date].push(t); }); return g; },[allWithOverdue]);
  const sortedDates   = Object.keys(groupedByDate).sort((a,b)=>new Date(a)-new Date(b));
  const analytics     = useMemo(()=>{
    const done=tasks.filter(t=>t.done);
    return{total:tasks.length,done:done.length,totalMinutes:done.reduce((s,t)=>s+(t.actualMinutes||t.minutes),0),estimatedMinutes:done.reduce((s,t)=>s+t.minutes,0),highDone:done.filter(t=>t.priority==="high").length,highTotal:tasks.filter(t=>t.priority==="high").length,rate:tasks.length>0?Math.round((done.length/tasks.length)*100):0};
  },[tasks]);

  // -- Appear detection ---------------------------------------------------------
  useEffect(()=>{
    const visibleNow=homeList.slice(0,5).map(t=>t.id);
    const newId=visibleNow.find(id=>!prevVisibleIds.current.has(id));
    if(newId&&prevVisibleIds.current.size>0) setTimeout(()=>{ setJustAppeared(newId); setTimeout(()=>setJustAppeared(null),600); },30);
    prevVisibleIds.current=new Set(visibleNow);
  },[homeList]);

  // -- Actions ------------------------------------------------------------------
  function toggleDone(id){
    const t=tasks.find(t=>t.id===id); if(!t) return;
    if(!t.done){
      haptic("success");
      setJustDone(id);
      setTimeout(()=>{
        setTasks(prev=>{
          let next=prev.map(x=>x.id===id?{...x,done:true}:x);
          // If recurring clone is being completed and it's from a past date,
          // create the next occurrence so it doesn't get lost
          if(t.recurSourceId&&t.date!==todayStr()){
            const src=prev.find(x=>x.id===t.recurSourceId);
            const base=src||t;
            const nextDate=nextRecurDate(base,todayStr());
            if(nextDate){
              const alreadyExists=prev.some(x=>(x.recurSourceId===t.recurSourceId||x.id===t.recurSourceId)&&x.date===nextDate&&!x.done);
              if(!alreadyExists){
                next=[...next,{...base,id:Date.now()+Math.random(),date:nextDate,done:false,actualMinutes:0,
                  recurSourceId:t.recurSourceId,createdAt:Date.now(),
                  subtasks:(base.subtasks||[]).map(s=>({...s,done:false}))}];
              }
            }
          }
          return next;
        });
        setJustDone(null);
      },360);
    } else {
      haptic("light");
      setTasks(prev=>prev.map(x=>x.id===id?{...x,done:false}:x));
    }
  }
  function toggleSubtask(taskId,subId){
    haptic("light");
    setTasks(prev=>prev.map(t=>t.id===taskId?{...t,subtasks:(t.subtasks||[]).map(s=>s.id===subId?{...s,done:!s.done}:s)}:t));
  }
  function saveTask(f){
    if(!f.title.trim()) return;
    haptic("medium");
    if(taskForm.mode==="new"){
      const srcId=Date.now();
      const src={...f,id:srcId,done:false,createdAt:Date.now(),actualMinutes:0,manualOrder:tasks.length};
      const newTasks=[src];
      // If recurring, immediately create a visible clone for today (source stays hidden)
      if(f.recur&&f.recur!=="none"&&shouldRecurToday(f,todayStr())){
        newTasks.push({...src,id:srcId+0.1,date:todayStr(),done:false,actualMinutes:0,
          recurSourceId:srcId,createdAt:Date.now(),
          subtasks:(f.subtasks||[]).map(s=>({...s,done:false}))});
      }
      setTasks(prev=>[...prev,...newTasks]);
    } else {
      setTasks(prev=>prev.map(x=>x.id===f.id?{...f}:x));
    }
    setTaskForm(null);
  }
  function deleteTask(id){
    haptic("error");
    const task=tasks.find(t=>t.id===id);
    if(!task) return;
    setDeleteConfirm(null); setActionMenu(null);
    setJustDeleted(id);
    setExpandedNote(n=>n===id?null:n); // clear expanded note if it was this task
    // Cancel any existing undo timer
    if(undoDelete?.timerId) clearTimeout(undoDelete.timerId);
    // Slide-out animation plays, then actually remove after 4s (undo window)
    setTimeout(()=>setJustDeleted(null),420);
    const timerId=setTimeout(()=>{
      setTasks(prev=>prev.filter(t=>t.id!==id));
      setUndoDelete(null);
    },4000);
    setUndoDelete({task,timerId});
  }
  function undoDeleteTask(){
    if(!undoDelete) return;
    clearTimeout(undoDelete.timerId);
    // Task is still in state (we only remove after 4s), so just clear the undo
    setUndoDelete(null);
    haptic("success");
  }
  function moveToToday(id){
    haptic("medium");
    const today=todayStr();
    setTasks(prev=>{
      const t=prev.find(x=>x.id===id); if(!t) return prev;
      const alreadyToday=prev.some(x=>x.date===today&&x.title.trim().toLowerCase()===t.title.trim().toLowerCase()&&x.id!==id);
      if(alreadyToday){
        // A copy already exists today -- just delete the overdue one
        return prev.filter(x=>x.id!==id);
      }
      // Remove old, add fresh today copy
      return [...prev.filter(x=>x.id!==id),{...t,id:Date.now()+Math.random(),date:today,done:false,actualMinutes:0,createdAt:Date.now(),subtasks:(t.subtasks||[]).map(s=>({...s,done:false}))}];
    });
    setActionMenu(null);
  }
  function postponeTask(id){
    haptic("medium");
    setTasks(prev=>prev.map(t=>t.id===id?{...t,date:tomorrowStr()}:t));
    setActionMenu(null);
  }
  function moveOverdueToToday(){
    haptic("success");
    const today=todayStr();
    setTasks(prev=>{
      const todayTaskTitles=new Set(prev.filter(t=>t.date===today).map(t=>t.title.trim().toLowerCase()));
      const overdue=prev.filter(t=>!t.done&&new Date(t.date)<new Date(today)&&!(t.recur&&t.recur!=="none"&&!t.recurSourceId));
      // Remove all overdue tasks
      let next=prev.filter(t=>!overdue.find(o=>o.id===t.id));
      // Add fresh today copies only if no task with same title already exists today
      const toAdd=overdue
        .filter(t=>!todayTaskTitles.has(t.title.trim().toLowerCase()))
        .map(t=>({...t,id:Date.now()+Math.random(),date:today,done:false,actualMinutes:0,createdAt:Date.now(),subtasks:(t.subtasks||[]).map(s=>({...s,done:false}))}));
      return [...next,...toAdd];
    });
  }
  function deleteCategory(catId){
    setTasks(prev=>prev.map(t=>t.category===catId?{...t,category:"other"}:t));
    setCategories(prev=>prev.filter(c=>c.id!==catId));
    setSettings(p=>({...p,hiddenSorts:(p.hiddenSorts||[]).filter(s=>s!=="cat_"+catId),sortBy:p.sortBy==="cat_"+catId?"priority":p.sortBy}));
  }
  function quickAddTask(){
    if(!quickAdd.trim()) return;
    haptic("medium");
    setTasks(prev=>[...prev,{id:Date.now(),title:quickAdd.trim(),category:categories[0]?.id||"work",priority:"medium",minutes:settings.defaultMinutes,workTime:"",dueTime:"",notes:"",done:false,date:todayStr(),createdAt:Date.now(),recur:"none",subtasks:[],manualOrder:prev.length,actualMinutes:0}]);
    setQuickAdd("");
  }
  function moveTaskUp(id){
    setTasks(prev=>{
      const sorted=sortList(prev.filter(t=>t.date===todayStr()&&!t.done),"manual");
      const idx=sorted.findIndex(t=>t.id===id); if(idx<=0) return prev;
      const[a,b]=[sorted[idx-1],sorted[idx]];
      return prev.map(t=>t.id===a.id?{...t,manualOrder:b.manualOrder}:t.id===b.id?{...t,manualOrder:a.manualOrder}:t);
    });
  }
  function moveTaskDown(id){
    setTasks(prev=>{
      const sorted=sortList(prev.filter(t=>t.date===todayStr()&&!t.done),"manual");
      const idx=sorted.findIndex(t=>t.id===id); if(idx<0||idx>=sorted.length-1) return prev;
      const[a,b]=[sorted[idx],sorted[idx+1]];
      return prev.map(t=>t.id===a.id?{...t,manualOrder:b.manualOrder}:t.id===b.id?{...t,manualOrder:a.manualOrder}:t);
    });
  }
  function saveTemplate(task){
    setTemplates(prev=>[...prev,{id:"t"+Date.now(),name:task.title,icon:"📋",task:{category:task.category,priority:task.priority,minutes:task.minutes,workTime:task.workTime,dueTime:task.dueTime,notes:task.notes,recur:task.recur,subtasks:[]}}]);
  }
  function deleteTemplate(id){ setTemplates(prev=>prev.filter(t=>t.id!==id)); }
  function addFromTemplate(tmpl){ setTaskForm({mode:"new",task:{...tmpl.task,title:tmpl.name,date:todayStr()}}); setShowTemplates(false); }
  async function enableNotifications(){
    const granted=await requestNotificationPermission();
    setNotifGranted(granted);
    if(granted) setSettings(p=>({...p,notificationsOn:true}));
  }

  const radius=90, circ=2*Math.PI*radius, dash=circ*progress;
  const emptyTask={title:"",category:categories[0]?.id||"work",priority:"medium",minutes:settings.defaultMinutes,workTime:"",dueTime:"",notes:"",date:todayStr(),recur:"none",subtasks:[],manualOrder:0,actualMinutes:0};

  const sharedCardProps={categories,accent,th,expandedNote,onToggleNote:id=>setExpandedNote(n=>n===id?null:id),onToggle:toggleDone,onToggleSubtask:toggleSubtask,onStart:setTimerTask,onMenu:(t,e)=>{e.stopPropagation();haptic("light");setActionMenu(t);}};

  // Loading screen
  if(!loaded) return(
    <div style={{fontFamily:"'DM Sans',sans-serif",background:th.bg,minHeight:"100vh",color:th.text,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:16,maxWidth:430,margin:"0 auto"}}>
      <link href="https://fonts.googleapis.com/css2?family=Space+Mono:wght@700&display=swap" rel="stylesheet"/>
      <div style={{fontFamily:"'Space Mono',monospace",fontSize:22,fontWeight:700,letterSpacing:2,color:accent}}>TASKFLOW</div>
      <div style={{display:"flex",gap:8}}>{[0,1,2].map(i=><div key={i} style={{width:7,height:7,borderRadius:"50%",background:accent,opacity:0.3,animation:`dotPulse 1.2s ease ${i*0.2}s infinite`}}/>)}</div>
      <style>{`@keyframes dotPulse{0%,100%{opacity:0.2;transform:scale(0.8)}50%{opacity:1;transform:scale(1.2)}}`}</style>
    </div>
  );

  if(timerTask) return(
    <TimerPage task={timerTask} categories={categories} accent={accent} timerSound={settings.timerSound} countdownMode={settings.countdownMode||"mm:ss"} th={th}
      onBack={()=>setTimerTask(null)}
      onSavePartial={(actualMins)=>{
        const id=timerTask.id;
        const t=tasks.find(x=>x.id===id);
        if(t){
          setFocusLog(prev=>[{id:Date.now(),taskTitle:t.title,category:t.category,estimatedMins:t.minutes,actualMins,date:todayStr(),ts:Date.now(),partial:true},...prev].slice(0,200));
          setTasks(prev=>prev.map(x=>x.id===id?{...x,actualMinutes:(x.actualMinutes||0)+actualMins}:x));
        }
        setTimerTask(null);
      }}
      onDone={(actualMins)=>{
      const id=timerTask.id;
      const t=tasks.find(x=>x.id===id);
      if(t){
        setFocusLog(prev=>[{
          id:Date.now(),
          taskTitle:t.title,
          category:t.category,
          estimatedMins:t.minutes,
          actualMins,
          date:todayStr(),
          ts:Date.now(),
        },...prev].slice(0,200)); // keep last 200 sessions
      }
      setTasks(prev=>prev.map(x=>x.id===id?{...x,done:true,actualMinutes:(x.actualMinutes||0)+actualMins}:x));
      setTimerTask(null);
    }}/>
  );
  if(taskForm) return(
    <TaskFormPage mode={taskForm.mode} initialData={taskForm.task} categories={categories} setCategories={setCategories} settings={settings} onSave={saveTask} onClose={()=>setTaskForm(null)} accent={accent} th={th}/>
  );

  return(
    <div style={{fontFamily:"'DM Sans',sans-serif",background:th.bg,minHeight:"100vh",color:th.text,display:"flex",flexDirection:"column",maxWidth:430,margin:"0 auto",position:"relative",overflowX:"hidden"}}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=Space+Mono:wght@400;700&display=swap" rel="stylesheet"/>
      <style>{`
        ${settings.reducedMotion?`*,*::before,*::after{animation-duration:0.01ms!important;animation-iteration-count:1!important;transition-duration:0.01ms!important;transition-delay:0ms!important;}`:""}
        @keyframes slideUp    {from{transform:translateY(100%);opacity:0}to{transform:translateY(0);opacity:1}}
        @keyframes slideDown  {from{transform:translateY(0);opacity:1}to{transform:translateY(100%);opacity:0}}
        @keyframes fadeIn     {from{opacity:0;transform:scale(0.96)}to{opacity:1;transform:scale(1)}}
        @keyframes cardSlideIn  {0%{opacity:0;transform:translateY(16px) scale(0.98)}55%{opacity:1;transform:translateY(-2px) scale(1.003)}100%{opacity:1;transform:translateY(0) scale(1)}}
        @keyframes cardSlideOut {0%{opacity:1;transform:translateY(0) scale(1)}100%{opacity:0;transform:translateY(10px) scale(0.96)}}
        @keyframes wrapShrink   {0%{max-height:200px;margin-bottom:9px;opacity:1}30%{opacity:0}100%{max-height:0;margin-bottom:0;opacity:0}}
        @keyframes noteExpand   {from{opacity:0;transform:translateY(-4px)}to{opacity:1;transform:translateY(0)}}
        @keyframes pulse        {0%,100%{opacity:1}50%{opacity:0.5}}
        @keyframes burstRipple  {0%{transform:scale(0);opacity:0.9}100%{transform:scale(5);opacity:0}}
        @keyframes burstFade    {0%{opacity:1}100%{opacity:0}}
        @keyframes overduePulse {0%,100%{opacity:1}50%{opacity:0.6}}
        .task-card{transition:opacity 0.3s ease,transform 0.3s cubic-bezier(0.4,0,0.2,1);}
        .task-wrap{overflow:hidden;}
        .task-wrap.collapsing{animation:wrapShrink 0.38s cubic-bezier(0.55,0,0.1,1) forwards;pointer-events:none;}
        .task-wrap.collapsing .task-card{animation:cardSlideOut 0.2s cubic-bezier(0.4,0,1,1) forwards;}
        .task-card.appearing{animation:cardSlideIn 0.46s cubic-bezier(0.34,1.28,0.64,1) forwards;}
        .tab-btn{background:none;border:none;cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:3px;font-size:10px;font-family:'DM Sans',sans-serif;padding:8px 16px;transition:color 0.2s;color:${th.textDim};}
        .tab-btn.active{color:${th.text};}
        .tab-btn.active .tab-icon{transform:scale(1.12);}
        .tab-icon{font-size:19px;transition:transform 0.2s cubic-bezier(0.34,1.56,0.64,1);display:block;}
        .action-row:hover{background:${th.surface2} !important;}
        .toggle-track{cursor:pointer;}
        input,textarea,select{outline:none;font-family:'DM Sans',sans-serif;}
        ::-webkit-scrollbar{width:0;}
        *{-webkit-tap-highlight-color:transparent;}
      `}</style>

      {/* -- HOME -- */}
      {tab==="home"&&(
        <PageTransition>
          <div style={{flex:1,display:"flex",flexDirection:"column",paddingBottom:80,overflowY:"auto",overflowX:"hidden"}}>
            {/* Header */}
            <div style={{padding:"52px 22px 8px",display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
              <div>
                <div style={{fontSize:12,color:th.textDim,letterSpacing:1.5,textTransform:"uppercase",fontFamily:"'Space Mono',monospace"}}>Today</div>
                <div style={{fontSize:20,fontWeight:600,marginTop:4,letterSpacing:-0.3}}>{new Date().toLocaleDateString("en-US",{weekday:"long",month:"short",day:"numeric"})}</div>
              </div>
              <div style={{display:"flex",alignItems:"center",gap:8}}>
                {settings.showStreak&&streak>0&&(
                  <div style={{display:"flex",alignItems:"center",gap:5,background:streak>=7?accent+"22":th.surface,borderRadius:20,padding:"6px 12px",border:`1px solid ${streak>=7?accent+"55":th.border2}`,transition:"all 0.4s"}}>
                    <span style={{fontSize:14}}>🔥</span>
                    <span style={{fontFamily:"'Space Mono',monospace",fontSize:12,color:"#F2CC8F",fontWeight:700}}>{streak}</span>
                    {streak>=7&&<span style={{fontSize:9,color:"#F2CC8F88"}}>🏆</span>}
                  </div>
                )}
                <button onClick={()=>setShowDevMenu(true)} title="Dev Menu" style={{background:"none",border:"none",cursor:"pointer",fontSize:13,color:th.textDim,padding:"4px 6px",opacity:0.4}}>⚙️</button>
              </div>
            </div>



            {/* Progress Ring */}
            <div style={{display:"flex",flexDirection:"column",alignItems:"center",padding:"18px 0 12px"}}>
              <div style={{position:"relative",width:210,height:210}}>
                <svg width="210" height="210" style={{transform:"rotate(-90deg)"}}>
                  <circle cx="105" cy="105" r={radius} fill="none" stroke={th.surface} strokeWidth="13"/>
                  <circle cx="105" cy="105" r={radius} fill="none" stroke={progress===1?"#81B29A":accent} strokeWidth="13" strokeLinecap="round"
                    strokeDasharray={`${dash} ${circ}`}
                    style={{transition:"stroke-dasharray 0.9s cubic-bezier(0.4,0,0.2,1),stroke 0.6s ease",filter:`drop-shadow(0 0 14px ${progress===1?"#81B29A":accent}55)`}}/>
                </svg>
                <div style={{position:"absolute",inset:0,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center"}}>
                  <div style={{fontFamily:"'Space Mono',monospace",fontSize:46,fontWeight:700,lineHeight:1,color:progress===1?"#81B29A":th.text,transition:"color 0.4s"}}>{todayInc.length}</div>
                  <div style={{fontSize:10,color:th.textDim,marginTop:6,textTransform:"uppercase",letterSpacing:1.5}}>left today</div>
                  <div style={{marginTop:6,fontSize:11,color:th.textMuted}}>{todayDone.length}/{todayAll.length} done</div>
                </div>
              </div>
              {progress===1&&todayAll.length>0&&<div style={{marginTop:6,fontSize:13,color:"#81B29A",fontWeight:500,animation:"fadeIn 0.4s ease"}}>All done! 🎉</div>}
            </div>

            {/* Sort menu */}
            <SortMenu sortBy={settings.sortBy} hiddenSorts={settings.hiddenSorts||[]} categories={categories} accent={accent} th={th}
              onSelect={id=>{ haptic("light"); setSettings(p=>({...p,sortBy:id})); }}
              onToggleHide={id=>setSettings(p=>{ const h=p.hiddenSorts||[]; return{...p,hiddenSorts:h.includes(id)?h.filter(x=>x!==id):[...h,id]}; })}
              onDeleteCategory={deleteCategory} onAddCategory={cat=>setCategories(prev=>[...prev,cat])}/>

            {/* Quick add */}
            <div style={{padding:"0 22px 12px",display:"flex",gap:8}}>
              <div style={{flex:1,position:"relative"}}>
                <input value={quickAdd} onChange={e=>setQuickAdd(e.target.value)} onKeyDown={e=>{if(e.key==="Enter")quickAddTask();}}
                  placeholder="Quick add a task…"
                  style={{width:"100%",background:th.surface,border:`1px solid ${th.border2}`,borderRadius:12,padding:"11px 40px 11px 14px",color:th.text,fontSize:14,boxSizing:"border-box"}}
                  onFocus={e=>e.target.style.borderColor=accent} onBlur={e=>e.target.style.borderColor=th.border2}/>
                {quickAdd&&<button onClick={quickAddTask} style={{position:"absolute",right:8,top:"50%",transform:"translateY(-50%)",background:accent,border:"none",borderRadius:8,width:26,height:26,cursor:"pointer",color:"#fff",fontSize:15,display:"flex",alignItems:"center",justifyContent:"center"}}>+</button>}
              </div>
              <button onClick={()=>setShowTemplates(true)} style={{background:th.surface,border:`1px solid ${th.border2}`,borderRadius:12,padding:"11px 13px",color:th.textMuted,fontSize:16,cursor:"pointer",flexShrink:0}}>📋</button>
            </div>

            {/* Task list */}
            <div style={{padding:"0 22px"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
                <span style={{fontSize:11,color:th.textDim,textTransform:"uppercase",letterSpacing:1.5,fontFamily:"'Space Mono',monospace"}}>Up Next</span>
                <button onClick={()=>setSheetOpen(true)} style={{background:"none",border:"none",color:th.textMuted,fontSize:12,cursor:"pointer",padding:0}}>see all ↑</button>
              </div>
              <div style={{display:"flex",flexDirection:"column",gap:0}}>
                {homeList.slice(0,5).map(task=>(
                  <TaskCard key={task.id} task={task} {...sharedCardProps} compact={settings.compactView}
                    isSliding={justDone===task.id||justDeleted===task.id} isAppearing={justAppeared===task.id}
                    showMoveButtons={settings.sortBy==="manual"} onMoveUp={moveTaskUp} onMoveDown={moveTaskDown}/>
                ))}
                {homeList.length===0&&<div style={{textAlign:"center",color:th.textDim,padding:"28px 0",fontSize:14}}>{todayDone.length>0?"All tasks complete! 🎉":"Nothing scheduled today."}</div>}
              </div>
            </div>

            {/* Swipe hint bar */}
            <div onClick={()=>setSheetOpen(true)} style={{display:"flex",flexDirection:"column",alignItems:"center",padding:"14px 0 0",cursor:"pointer"}}>
              <div style={{width:34,height:3,background:th.border2,borderRadius:2,marginBottom:6}}/>
              {homeList.length>5
                ?<span style={{fontSize:11,color:accent,letterSpacing:1,fontWeight:600}}>+{homeList.length-5} more · tap to see all</span>
                :<span style={{fontSize:10,color:th.textDim,letterSpacing:1.5}}>SWIPE UP · TODAY & TOMORROW</span>}
            </div>
          </div>
        </PageTransition>
      )}

      {/* -- LIST -- */}
      {tab==="list"&&(
        <PageTransition>
          <div style={{flex:1,overflowY:"auto",overflowX:"hidden",padding:"52px 22px 80px"}}>
            <div style={{fontSize:11,color:th.textDim,letterSpacing:1.5,textTransform:"uppercase",fontFamily:"'Space Mono',monospace",marginBottom:4}}>All Tasks</div>
            <div style={{fontSize:21,fontWeight:600,marginBottom:16,letterSpacing:-0.3}}>Everything</div>

            {/* Search bar */}
            <div style={{position:"relative",marginBottom:20}}>
              <span style={{position:"absolute",left:14,top:"50%",transform:"translateY(-50%)",fontSize:14,color:th.textDim,pointerEvents:"none"}}>🔍</span>
              <input value={listSearch} onChange={e=>setListSearch(e.target.value)} placeholder="Search tasks…"
                style={{width:"100%",background:th.surface,border:`1px solid ${th.border2}`,borderRadius:12,padding:"11px 36px 11px 38px",color:th.text,fontSize:14,boxSizing:"border-box"}}
                onFocus={e=>e.target.style.borderColor=accent} onBlur={e=>e.target.style.borderColor=th.border2}/>
              {listSearch&&<button onClick={()=>setListSearch("")} style={{position:"absolute",right:12,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",color:th.textDim,fontSize:14,cursor:"pointer",padding:"4px",lineHeight:1}}>✕</button>}
            </div>

            {/* -- Overdue section -- always at top, visually distinct -- */}
            {overdueAll.length>0&&!listSearch&&(
              <div style={{marginBottom:28,background:"#E07A5F0D",border:"1px solid #E07A5F33",borderRadius:16,padding:"14px 14px 8px",borderLeft:"3px solid #E07A5F"}}>
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
                  <div style={{display:"flex",alignItems:"center",gap:8}}>
                    <span style={{fontSize:15,animation:"overduePulse 2s ease infinite"}}>⚠️</span>
                    <div>
                      <div style={{fontSize:14,fontWeight:700,color:"#E07A5F"}}>{overdueAll.length} Overdue</div>
                      <div style={{fontSize:11,color:"#E07A5F88",marginTop:1}}>These tasks were not completed</div>
                    </div>
                  </div>
                  <button onClick={moveOverdueToToday}
                    style={{background:"#E07A5F",border:"none",borderRadius:10,padding:"8px 14px",color:"#fff",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"'DM Sans',sans-serif",flexShrink:0}}>
                    Move all to today →
                  </button>
                </div>
                <div style={{display:"flex",flexDirection:"column",gap:0}}>
                  {sortList(overdueAll,settings.sortBy).map(task=>(
                    <TaskCard key={task.id} task={task} {...sharedCardProps} full overdue
                      isSliding={justDone===task.id||justDeleted===task.id}/>
                  ))}
                </div>
              </div>
            )}

            {/* -- Upcoming & today tasks -- */}
            {sortedDates.length===0&&!listSearch&&overdueAll.length===0&&<div style={{textAlign:"center",color:th.textDim,marginTop:60,fontSize:14}}>No tasks yet -- hit + to add one!</div>}
            {(() => {
              const q=listSearch.toLowerCase().trim();
              // Exclude overdue dates from the main list (they're shown above)
              const overdueIdSet=new Set(overdueAll.map(t=>t.id));
              const filteredDates=(q
                ? sortedDates.filter(date=>groupedByDate[date].some(t=>
                    !overdueIdSet.has(t.id)&&(
                      t.title.toLowerCase().includes(q)||
                      (t.notes||"").toLowerCase().includes(q)||
                      getCat(t.category,categories).label.toLowerCase().includes(q)
                    )
                  ))
                : sortedDates
              );
              if(q&&filteredDates.length===0&&overdueAll.length===0) return <div style={{textAlign:"center",color:th.textDim,marginTop:40,fontSize:14}}>No results for "{listSearch}"</div>;
              return filteredDates.map(date=>{
                const dayTasks=groupedByDate[date].filter(t=>!overdueIdSet.has(t.id));
                const isToday=date===todayStr();
                const q2=listSearch.toLowerCase().trim();
                const inc=sortList(dayTasks.filter(t=>!t.done&&(!q2||t.title.toLowerCase().includes(q2)||(t.notes||"").toLowerCase().includes(q2)||getCat(t.category,categories).label.toLowerCase().includes(q2))),settings.sortBy);
                const done=dayTasks.filter(t=>t.done&&(!q2||t.title.toLowerCase().includes(q2)||(t.notes||"").toLowerCase().includes(q2)||getCat(t.category,categories).label.toLowerCase().includes(q2)));
                if(!inc.length&&!done.length) return null;
                return(
                  <div key={date} style={{marginBottom:26}}>
                    <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}>
                      <div>
                        <div style={{fontSize:14,fontWeight:600,color:isToday?accent:th.text}}>{fmtDateLabel(date)}</div>
                        {!isToday&&<div style={{fontSize:11,color:th.textDim,fontFamily:"'Space Mono',monospace",marginTop:1}}>{new Date(date).toLocaleDateString("en-US",{month:"short",day:"numeric"})}</div>}
                      </div>
                      <div style={{flex:1,height:1,background:th.border}}/>
                      <div style={{fontSize:11,color:th.textDim,fontFamily:"'Space Mono',monospace"}}>{done.length}/{dayTasks.length}</div>
                    </div>
                    <div style={{display:"flex",flexDirection:"column",gap:0}}>
                      {inc.map(task=><TaskCard key={task.id} task={task} {...sharedCardProps} full isSliding={justDone===task.id||justDeleted===task.id}/>)}
                      {inc.length>0&&done.length>0&&(
                        <div style={{display:"flex",alignItems:"center",gap:10,margin:"8px 0 5px"}}>
                          <div style={{flex:1,height:1,background:`linear-gradient(to right,transparent,${th.border})`}}/>
                          <span style={{fontSize:10,color:th.textMuted,display:"flex",alignItems:"center",gap:4}}><span style={{color:"#81B29A"}}>✓</span>{done.length} done</span>
                          <div style={{flex:1,height:1,background:`linear-gradient(to left,transparent,${th.border})`}}/>
                        </div>
                      )}
                      {done.map(task=><TaskCard key={task.id} task={task} {...sharedCardProps} full isSliding={justDeleted===task.id}/>)}
                    </div>
                  </div>
                );
              });
            })()}
          </div>
        </PageTransition>
      )}

      {/* -- SETTINGS -- */}
      {tab==="settings"&&(
        <PageTransition>
          <SettingsPage settings={settings} setSettings={setSettings} analytics={analytics} categories={categories} tasks={tasks} accent={accent} th={th} streak={streak} templates={templates} focusLog={focusLog} notifGranted={notifGranted} onEnableNotifications={enableNotifications} onResetStreak={()=>{setStreak(0);setStreakLastDate(null);setStreakPrev(0);setStreakPrevDate(null);}} onDeleteTemplate={deleteTemplate} onAddFromTemplate={addFromTemplate}/>
        </PageTransition>
      )}

      {/* -- Bottom Nav -- */}
      <div style={{position:"fixed",bottom:0,left:"50%",transform:"translateX(-50%)",width:"100%",maxWidth:430,background:th.navBg,borderTop:`1px solid ${th.border}`,display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",alignItems:"end",padding:"0 0 20px",zIndex:50,backdropFilter:"blur(14px)",minHeight:64}}>
        {[{id:"home",icon:"⌂",label:"Home"},{id:"list",icon:"≡",label:"List"}].map(t=>(
          <button key={t.id} className={`tab-btn ${tab===t.id?"active":""}`} onClick={()=>{ setTab(t.id); if(t.id!=="list") setListSearch(""); }} style={{paddingTop:10,position:"relative"}}>
            <span className="tab-icon">{t.icon}</span>
            <span>{t.label}</span>
            {t.id==="list"&&overdueAll.length>0&&(
              <span style={{position:"absolute",top:6,right:"calc(50% - 14px)",background:"#E07A5F",color:"#fff",borderRadius:10,fontSize:9,fontWeight:700,padding:"1px 5px",lineHeight:"14px",minWidth:14,textAlign:"center"}}>
                {overdueAll.length}
              </span>
            )}
          </button>
        ))}
        <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"flex-end",paddingBottom:4}}>
          <button onClick={()=>setTaskForm({mode:"new",task:{...emptyTask}})}
            style={{background:accent,border:"none",width:50,height:50,borderRadius:"50%",cursor:"pointer",fontSize:26,color:"#fff",display:"flex",alignItems:"center",justifyContent:"center",boxShadow:`0 4px 22px ${accent}55`,transform:"translateY(-12px)",transition:"transform 0.18s cubic-bezier(0.34,1.56,0.64,1)"}}
            onMouseDown={e=>{e.currentTarget.style.transform="translateY(-10px) scale(0.92)";}}
            onMouseUp={e=>{e.currentTarget.style.transform="translateY(-12px) scale(1)";}}>+</button>
        </div>
        <button className={`tab-btn ${tab==="settings"?"active":""}`} onClick={()=>{ setTab("settings"); setListSearch(""); }} style={{paddingTop:10}}>
          <span className="tab-icon">⚙</span><span>Settings</span>
        </button>
      </div>

      {/* -- Sheet -- */}
      {sheetOpen&&(
        <Sheet todayInc={sortList(todayInc,settings.sortBy)} todayDone={todayDone} tomorrowTasks={sortList(tomorrowAll,settings.sortBy)}
          categories={categories} accent={accent} th={th} justDone={justDone} justDeleted={justDeleted}
          expandedNote={expandedNote} onToggleNote={id=>setExpandedNote(n=>n===id?null:id)}
          onToggle={toggleDone} onToggleSubtask={toggleSubtask}
          onStart={t=>{ setSheetOpen(false); setTimerTask(t); }}
          onMenu={(t,e)=>{ e.stopPropagation(); setSheetOpen(false); haptic("light"); setActionMenu(t); }}
          onClose={()=>setSheetOpen(false)}
          doneTodayCount={todayDone.length} totalTodayCount={todayAll.length}/>
      )}

      {/* -- Action Menu -- */}
      {actionMenu&&!deleteConfirm&&(
        <div style={{position:"fixed",inset:0,zIndex:200,display:"flex",alignItems:"center",justifyContent:"center"}} onClick={()=>setActionMenu(null)}>
          <div style={{position:"absolute",inset:0,background:"rgba(0,0,0,0.55)",backdropFilter:"blur(6px)"}}/>
          <div onClick={e=>e.stopPropagation()} style={{position:"relative",background:th.surface,borderRadius:20,padding:"6px",width:"min(268px,85vw)",animation:"fadeIn 0.2s ease",boxShadow:"0 24px 64px rgba(0,0,0,0.7)",border:`1px solid ${th.border2}`}}>
            <div style={{padding:"14px 16px 10px",borderBottom:`1px solid ${th.border}`,marginBottom:4}}>
              <div style={{fontSize:13,fontWeight:600,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{actionMenu.title}</div>
              <div style={{fontSize:11,color:th.textMuted,marginTop:2}}>{fmtDateLabel(actionMenu.date)}{actionMenu.workTime?` · 🕐 ${fmtTime(actionMenu.workTime)}`:""}</div>
            </div>
            {[
              {icon:"✏️",label:"Edit Task",      sub:"Modify all details",       action:()=>{ setTaskForm({mode:"edit",task:{...actionMenu}}); setActionMenu(null); }, color:th.text},
              ...(actionMenu.date!==todayStr()&&!actionMenu.recurSourceId?[{icon:"📥",label:"Move to Today", sub:"Pull into today's list",   action:()=>moveToToday(actionMenu.id), color:accent}]:[]),
              ...(actionMenu.date===todayStr()&&!actionMenu.recurSourceId?[{icon:"📅",label:"Postpone",      sub:"Move to tomorrow",         action:()=>postponeTask(actionMenu.id), color:"#7B9EC9"}]:[]),
              {icon:"📋",label:"Save as Template",sub:"Reuse this task config",   action:()=>{ saveTemplate(actionMenu); setActionMenu(null); },                      color:"#81B29A"},
              {icon:"🗑️",label:"Delete Task",    sub:"This can't be undone",     action:()=>setDeleteConfirm(actionMenu.id),                                         color:"#E07A5F"},
            ].map(item=>(
              <button key={item.label} className="action-row" onClick={item.action}
                style={{width:"100%",background:"none",border:"none",padding:"12px 14px",color:item.color,cursor:"pointer",display:"flex",alignItems:"center",gap:12,fontFamily:"'DM Sans',sans-serif",textAlign:"left",borderRadius:12,transition:"background 0.15s"}}>
                <span style={{fontSize:17,width:22,textAlign:"center"}}>{item.icon}</span>
                <div><div style={{fontWeight:500,fontSize:14}}>{item.label}</div><div style={{fontSize:11,color:th.textMuted,marginTop:1}}>{item.sub}</div></div>
              </button>
            ))}
            <button className="action-row" onClick={()=>setActionMenu(null)} style={{width:"100%",background:"none",border:"none",borderTop:`1px solid ${th.border}`,marginTop:4,padding:"12px 14px",color:th.textMuted,fontSize:13,cursor:"pointer",fontFamily:"'DM Sans',sans-serif",borderRadius:12}}>Cancel</button>
          </div>
        </div>
      )}

      {/* -- Delete Confirm -- */}
      {deleteConfirm&&(
        <div style={{position:"fixed",inset:0,zIndex:300,display:"flex",alignItems:"center",justifyContent:"center"}}>
          <div style={{position:"absolute",inset:0,background:"rgba(0,0,0,0.65)",backdropFilter:"blur(8px)"}} onClick={()=>{ setDeleteConfirm(null); setActionMenu(null); }}/>
          <div style={{position:"relative",background:th.surface,borderRadius:22,padding:"28px 24px",width:"min(288px,88vw)",animation:"fadeIn 0.22s ease",textAlign:"center",boxShadow:"0 24px 64px rgba(0,0,0,0.7)",border:`1px solid ${th.border2}`}}>
            <div style={{fontSize:34,marginBottom:12}}>🗑️</div>
            <div style={{fontSize:16,fontWeight:600,marginBottom:8}}>Delete Task?</div>
            <div style={{fontSize:13,color:th.textMuted,marginBottom:24,lineHeight:1.6}}>"{tasks.find(t=>t.id===deleteConfirm)?.title}" will be gone forever.</div>
            <div style={{display:"flex",gap:10}}>
              <button onClick={()=>{ setDeleteConfirm(null); setActionMenu(null); }} style={{flex:1,background:th.surface2,border:"none",borderRadius:12,padding:"14px",color:th.text,fontSize:14,cursor:"pointer",fontFamily:"'DM Sans',sans-serif",fontWeight:500}}>Cancel</button>
              <button onClick={()=>deleteTask(deleteConfirm)} style={{flex:1,background:"#E07A5F",border:"none",borderRadius:12,padding:"14px",color:"#fff",fontSize:14,cursor:"pointer",fontFamily:"'DM Sans',sans-serif",fontWeight:600,boxShadow:"0 4px 18px rgba(224,122,95,0.4)"}}>Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* -- Templates -- */}
      {showTemplates&&(
        <div style={{position:"fixed",inset:0,zIndex:200,display:"flex",alignItems:"flex-end",justifyContent:"center"}} onClick={()=>setShowTemplates(false)}>
          <div style={{position:"absolute",inset:0,background:"rgba(0,0,0,0.6)",backdropFilter:"blur(6px)"}}/>
          <div onClick={e=>e.stopPropagation()} style={{position:"relative",background:th.surface2,borderRadius:"22px 22px 0 0",width:"100%",maxWidth:430,padding:"16px 22px 44px",maxHeight:"70vh",overflowY:"auto",overflowX:"hidden",animation:"slideUp 0.3s cubic-bezier(0.34,1.08,0.64,1)",boxShadow:"0 -8px 40px rgba(0,0,0,0.5)"}}>
            <div style={{width:36,height:4,background:th.border2,borderRadius:2,margin:"0 auto 18px"}}/>
            <div style={{fontSize:15,fontWeight:600,marginBottom:16}}>Templates</div>
            {templates.length===0&&<div style={{textAlign:"center",color:th.textDim,padding:"24px 0",fontSize:13}}>No templates yet. Save one from the ⋯ menu on any task.</div>}
            <div style={{display:"flex",flexDirection:"column",gap:8}}>
              {templates.map(t=>(
                <div key={t.id} style={{display:"flex",alignItems:"center",gap:12,background:th.surface,borderRadius:14,padding:"14px 16px",border:`1px solid ${th.border}`}}>
                  <span style={{fontSize:20}}>{t.icon}</span>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:14,fontWeight:500,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{t.name}</div>
                    <div style={{fontSize:11,color:th.textMuted,marginTop:2}}>{fmtDuration(t.task.minutes)} · {t.task.priority} · {getCat(t.task.category,categories).label}</div>
                  </div>
                  <button onClick={()=>addFromTemplate(t)} style={{background:accent+"22",border:`1px solid ${accent}44`,borderRadius:8,padding:"6px 12px",color:accent,fontSize:12,cursor:"pointer",fontFamily:"'DM Sans',sans-serif",fontWeight:600,flexShrink:0}}>Use</button>
                  <button onClick={()=>deleteTemplate(t.id)} style={{background:"none",border:"none",color:th.textDim,fontSize:16,cursor:"pointer",padding:"4px",flexShrink:0}}>🗑</button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* -- Daily Summary -- */}
      {showSummary&&summaryData&&<DailySummary data={summaryData} accent={accent} onClose={()=>setShowSummary(false)}/>}

      {/* -- Dev Menu -- */}
      {showDevMenu&&<DevMenu accent={accent} th={th} onClose={()=>setShowDevMenu(false)}
        onResetOnboarding={()=>{ try{localStorage.removeItem('tf_onboarding_seen');}catch(e){} setShowDevMenu(false); setShowOnboarding(true); }}
        onResetStorage={()=>{ if(undoDelete?.timerId) clearTimeout(undoDelete.timerId); try{['tf_tasks','tf_categories','tf_settings','tf_streak','tf_templates','tf_onboarding_seen','tf_focuslog'].forEach(k=>localStorage.removeItem(k));}catch(e){} window.location.reload(); }}
        onForceOverdue={()=>{ setTasks(prev=>prev.map((t,i)=>i===0?{...t,date:yesterdayStr(),done:false}:t)); setShowDevMenu(false); }}
        onForceSummary={()=>{ setSummaryData({done:5,totalFocus:120,streak:streak||3}); setShowSummary(true); setShowDevMenu(false); }}
        onAddTestTask={()=>{ setTasks(prev=>[...prev,{id:Date.now(),title:"Test task "+Date.now()%1000,category:"work",priority:"high",minutes:30,workTime:"",dueTime:"",notes:"Added from dev menu",done:false,date:todayStr(),createdAt:Date.now(),recur:"none",subtasks:[],manualOrder:prev.length,actualMinutes:0}]); setShowDevMenu(false); }}
        onAddTestRecur={()=>{ setTasks(prev=>[...prev,{id:Date.now(),title:"Daily test task",category:"health",priority:"medium",minutes:20,workTime:"",dueTime:"",notes:"Dev test recurring",done:false,date:todayStr(),createdAt:Date.now(),recur:"daily",subtasks:[],manualOrder:prev.length,actualMinutes:0,recurStreak:0}]); setShowDevMenu(false); }}
        onSolidifyRecur={()=>{ triggerRecur(); setShowDevMenu(false); }}
      />}

      {/* -- Undo Delete Toast -- */}
      {undoDelete&&(
        <div style={{
          position:"fixed",bottom:90,left:"50%",transform:"translateX(-50%)",
          zIndex:600,display:"flex",alignItems:"center",gap:12,
          background:th.surface,border:`1px solid ${th.border2}`,
          borderRadius:16,padding:"12px 16px",
          boxShadow:"0 8px 32px rgba(0,0,0,0.4)",
          animation:"slideUp 0.3s cubic-bezier(0.34,1.08,0.64,1)",
          maxWidth:"calc(100vw - 44px)",
          fontFamily:"'DM Sans',sans-serif",
        }}>
          <span style={{fontSize:16}}>🗑️</span>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontSize:13,fontWeight:500,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>"{ undoDelete.task.title}" deleted</div>
          </div>
          <button onClick={undoDeleteTask}
            style={{background:accent+"22",border:`1px solid ${accent}44`,borderRadius:10,padding:"7px 14px",color:accent,fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"'DM Sans',sans-serif",flexShrink:0,whiteSpace:"nowrap"}}>
            Undo
          </button>
        </div>
      )}

      {/* -- Onboarding -- */}
      {showOnboarding&&<Onboarding accent={accent} th={th} onDone={()=>{ try{localStorage.setItem('tf_onboarding_seen','1');}catch(e){} setShowOnboarding(false); }}/>}
    </div>
  );
}

// --- Sort Menu ----------------------------------------------------------------
function SortMenu({sortBy,hiddenSorts,categories,accent,th,onSelect,onToggleHide,onDeleteCategory,onAddCategory}){
  const[open,setOpen]=useState(false);
  const[editMode,setEditMode]=useState(false);
  const[showNewCat,setShowNewCat]=useState(false);
  const[newCatName,setNewCatName]=useState("");
  const[newCatColor,setNewCatColor]=useState("#7B9EC9");
  const allOpts=[...BASE_SORT_OPTIONS,...categories.map(c=>({id:"cat_"+c.id,label:c.label,icon:"●",color:c.color,isCat:true}))];
  const current=allOpts.find(s=>s.id===sortBy)||allOpts[0];
  function addCat(){ if(!newCatName.trim())return; onAddCategory({id:"cust_"+Date.now(),label:newCatName.trim(),color:newCatColor}); setNewCatName(""); setShowNewCat(false); }
  return(
    <>
      <div style={{padding:"0 22px 12px"}}>
        <button onClick={()=>{ setOpen(true); setEditMode(false); setShowNewCat(false); }}
          style={{display:"flex",alignItems:"center",gap:8,background:th.surface,border:`1.5px solid ${accent}44`,borderRadius:20,padding:"8px 16px",cursor:"pointer",width:"100%"}}>
          {current.isCat?<span style={{width:8,height:8,borderRadius:"50%",background:current.color,display:"inline-block",flexShrink:0}}/>:<span style={{fontSize:13}}>{current.icon}</span>}
          <span style={{fontSize:13,color:th.text,fontFamily:"'DM Sans',sans-serif",fontWeight:500}}>Sort: {current.label}</span>
          <span style={{fontSize:10,color:th.textDim,marginLeft:"auto"}}>▾</span>
        </button>
      </div>
      {open&&(
        <div style={{position:"fixed",inset:0,zIndex:150,display:"flex",alignItems:"flex-end",justifyContent:"center"}} onClick={()=>{ setOpen(false); setEditMode(false); setShowNewCat(false); }}>
          <div style={{position:"absolute",inset:0,background:"rgba(0,0,0,0.6)",backdropFilter:"blur(6px)"}}/>
          <div onClick={e=>e.stopPropagation()} style={{position:"relative",background:th.surface2,borderRadius:"22px 22px 0 0",width:"100%",maxWidth:430,padding:"16px 20px 44px",maxHeight:"82vh",overflowY:"auto",overflowX:"hidden",boxShadow:"0 -8px 40px rgba(0,0,0,0.5)",animation:"slideUp 0.3s cubic-bezier(0.34,1.08,0.64,1)"}}>
            <div style={{width:36,height:4,background:th.border2,borderRadius:2,margin:"0 auto 18px"}}/>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
              <div style={{fontSize:15,fontWeight:600}}>{editMode?"Manage Sort & Categories":"Sort By"}</div>
              <button onClick={()=>{ setEditMode(p=>!p); setShowNewCat(false); }} style={{background:"none",border:"none",color:accent,fontSize:13,cursor:"pointer",fontFamily:"'DM Sans',sans-serif",fontWeight:600}}>{editMode?"Done":"Edit"}</button>
            </div>
            <div style={{fontSize:10,color:th.textDim,letterSpacing:1.2,textTransform:"uppercase",fontFamily:"'Space Mono',monospace",marginBottom:8}}>Sort by field</div>
            {BASE_SORT_OPTIONS.map(s=>{
              const hidden=hiddenSorts.includes(s.id), active=sortBy===s.id;
              return(
                <button key={s.id} onClick={()=>{ if(!editMode){ onSelect(s.id); setOpen(false); } }}
                  style={{width:"100%",display:"flex",alignItems:"center",gap:12,background:active&&!editMode?accent+"18":"none",border:"none",borderRadius:12,padding:"12px 14px",cursor:editMode?"default":"pointer",opacity:hidden&&!editMode?0.3:1,marginBottom:2}}>
                  <span style={{fontSize:16,width:24,textAlign:"center"}}>{s.icon}</span>
                  <span style={{fontSize:14,color:active&&!editMode?accent:th.text,fontFamily:"'DM Sans',sans-serif",fontWeight:active&&!editMode?600:400,flex:1,textAlign:"left"}}>{s.label}</span>
                  {active&&!editMode&&<span style={{fontSize:12,color:accent}}>✓</span>}
                  {editMode&&<button onClick={e=>{ e.stopPropagation(); onToggleHide(s.id); }} style={{background:hidden?th.surface:accent+"22",border:`1px solid ${hidden?th.border2:accent+"44"}`,borderRadius:8,padding:"5px 12px",cursor:"pointer",fontSize:12,color:hidden?th.textMuted:accent,fontFamily:"'DM Sans',sans-serif"}}>{hidden?"Show":"Hide"}</button>}
                </button>
              );
            })}
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",margin:"16px 0 8px"}}>
              <div style={{fontSize:10,color:th.textDim,letterSpacing:1.2,textTransform:"uppercase",fontFamily:"'Space Mono',monospace"}}>Categories</div>
              {editMode&&!showNewCat&&<button onClick={()=>setShowNewCat(true)} style={{background:"none",border:"none",color:accent,fontSize:12,cursor:"pointer",fontFamily:"'DM Sans',sans-serif",fontWeight:600}}>+ Add</button>}
            </div>
            {categories.map(cat=>{
              const id="cat_"+cat.id, hidden=hiddenSorts.includes(id), active=sortBy===id, isDefault=DEFAULT_CATEGORIES.some(d=>d.id===cat.id);
              return(
                <button key={id} onClick={()=>{ if(!editMode){ onSelect(id); setOpen(false); } }}
                  style={{width:"100%",display:"flex",alignItems:"center",gap:12,background:active&&!editMode?cat.color+"18":"none",border:"none",borderRadius:12,padding:"12px 14px",cursor:editMode?"default":"pointer",opacity:hidden&&!editMode?0.3:1,marginBottom:2}}>
                  <span style={{width:10,height:10,borderRadius:"50%",background:cat.color,display:"inline-block",flexShrink:0}}/>
                  <span style={{fontSize:14,color:active&&!editMode?cat.color:th.text,fontFamily:"'DM Sans',sans-serif",fontWeight:active&&!editMode?600:400,flex:1,textAlign:"left"}}>{cat.label}</span>
                  {active&&!editMode&&<span style={{fontSize:12,color:cat.color}}>✓</span>}
                  {editMode&&<div style={{display:"flex",gap:6}}>
                    <button onClick={e=>{ e.stopPropagation(); onToggleHide(id); }} style={{background:hidden?th.surface:accent+"22",border:`1px solid ${hidden?th.border2:accent+"44"}`,borderRadius:8,padding:"5px 12px",cursor:"pointer",fontSize:12,color:hidden?th.textMuted:accent,fontFamily:"'DM Sans',sans-serif"}}>{hidden?"Show":"Hide"}</button>
                    {!isDefault&&<button onClick={e=>{ e.stopPropagation(); onDeleteCategory(cat.id); }} style={{background:"#E07A5F22",border:"1px solid #E07A5F44",borderRadius:8,padding:"5px 10px",cursor:"pointer",fontSize:12,color:"#E07A5F",fontFamily:"'DM Sans',sans-serif"}}>🗑</button>}
                  </div>}
                </button>
              );
            })}
            {editMode&&showNewCat&&(
              <div style={{background:th.surface,borderRadius:14,padding:"14px",marginTop:8,border:`1px solid ${th.border2}`,animation:"fadeIn 0.2s ease"}}>
                <input value={newCatName} onChange={e=>setNewCatName(e.target.value)} placeholder="Category name..."
                  style={{width:"100%",background:th.bg,border:`1px solid ${th.border}`,borderRadius:10,padding:"11px 12px",color:th.text,fontSize:14,marginBottom:10,boxSizing:"border-box"}}/>
                <div style={{display:"flex",flexWrap:"wrap",gap:8,marginBottom:12}}>
                  {SWATCH_COLORS.map(c=><button key={c} onClick={()=>setNewCatColor(c)} style={{width:26,height:26,borderRadius:"50%",background:c,border:`3px solid ${newCatColor===c?"#F0EDE8":"transparent"}`,cursor:"pointer",padding:0,transform:newCatColor===c?"scale(1.18)":"scale(1)",transition:"transform 0.12s"}}/>)}
                </div>
                <div style={{display:"flex",gap:8}}>
                  <button onClick={()=>{ setShowNewCat(false); setNewCatName(""); }} style={{flex:1,background:th.bg,border:`1px solid ${th.border}`,borderRadius:10,padding:"10px",color:th.textMuted,fontSize:13,cursor:"pointer",fontFamily:"'DM Sans',sans-serif"}}>Cancel</button>
                  <button onClick={addCat} style={{flex:2,background:newCatColor,border:"none",borderRadius:10,padding:"10px",color:"#fff",fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:"'DM Sans',sans-serif"}}>Add "{newCatName||"Category"}"</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

// --- Sheet -- swipe up to open, swipe down to dismiss, scroll inside -----------
function Sheet({todayInc,todayDone,tomorrowTasks,categories,accent,th,justDone,justDeleted,expandedNote,onToggleNote,onToggle,onToggleSubtask,onStart,onMenu,onClose,doneTodayCount,totalTodayCount}){
  const[showDone,setShowDone]=useState(false);
  const[closing,setClosing]=useState(false);
  const startY=useRef(null);
  const startScrollY=useRef(null);
  const innerRef=useRef(null);
  const props={categories,accent,th,expandedNote,onToggleNote,onToggle,onToggleSubtask,onStart,onMenu};

  function close(){ setClosing(true); setTimeout(onClose,280); }

  function onTouchStart(e){
    startY.current=e.touches[0].clientY;
    startScrollY.current=innerRef.current?.scrollTop||0;
  }
  function onTouchEnd(e){
    if(startY.current===null) return;
    const dy=e.changedTouches[0].clientY-startY.current;
    const atTop=(innerRef.current?.scrollTop||0)===0;
    if(dy>60&&atTop){ close(); }
    startY.current=null; startScrollY.current=null;
  }

  return(
    <div style={{position:"fixed",inset:0,zIndex:100,display:"flex",flexDirection:"column",justifyContent:"flex-end"}}>
      <div style={{position:"absolute",inset:0,background:"rgba(0,0,0,0.65)",backdropFilter:"blur(6px)",animation:"fadeIn 0.2s ease",opacity:closing?0:1,transition:closing?"opacity 0.28s ease":"none"}} onClick={close}/>
      <div ref={innerRef} onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}
        style={{position:"relative",background:th.surface2,borderRadius:"22px 22px 0 0",padding:"14px 22px 52px",maxHeight:"88vh",overflowY:"auto",overflowX:"hidden",boxShadow:"0 -8px 40px rgba(0,0,0,0.5)",animation:closing?"slideDown 0.28s cubic-bezier(0.4,0,1,1) forwards":"slideUp 0.34s cubic-bezier(0.34,1.08,0.64,1)"}}>
        {/* Drag handle */}
        <div style={{width:38,height:4,background:th.border2,borderRadius:2,margin:"0 auto 18px",cursor:"grab"}}/>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
          <div>
            <div style={{fontSize:11,color:th.textDim,letterSpacing:1.5,textTransform:"uppercase",fontFamily:"'Space Mono',monospace"}}>Today & Tomorrow</div>
            <div style={{fontSize:16,fontWeight:600,marginTop:3}}>{new Date().toLocaleDateString("en-US",{weekday:"long",month:"short",day:"numeric"})}</div>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <div style={{fontFamily:"'Space Mono',monospace",fontSize:12,color:th.textDim}}>{doneTodayCount}/{totalTodayCount}</div>
            <button onClick={close} style={{background:"none",border:"none",color:th.textDim,fontSize:18,cursor:"pointer",padding:"4px",lineHeight:1}}>✕</button>
          </div>
        </div>



        {todayInc.length===0&&todayDone.length===0&&<div style={{textAlign:"center",color:th.textDim,padding:"28px 0",fontSize:14}}>Nothing scheduled today!</div>}
        {todayInc.length===0&&todayDone.length>0&&<div style={{textAlign:"center",color:"#81B29A",padding:"12px 0 18px",fontSize:13,fontWeight:500}}>All today's tasks complete! 🎉</div>}
        <div style={{display:"flex",flexDirection:"column",gap:0}}>
          {todayInc.map(task=><TaskCard key={task.id} task={task} {...props} full isSliding={justDone===task.id||justDeleted===task.id}/>)}
        </div>

        {todayDone.length>0&&todayInc.length>0&&(
          <div style={{margin:"18px 0 4px",display:"flex",alignItems:"center",gap:10}}>
            <div style={{flex:1,height:1,background:`linear-gradient(to right,transparent,${th.border})`}}/>
            <button onClick={()=>setShowDone(p=>!p)} style={{display:"flex",alignItems:"center",gap:6,background:showDone?th.border2:th.surface,border:`1px solid ${th.border2}`,borderRadius:20,padding:"5px 12px",cursor:"pointer"}}>
              <span style={{fontSize:10,color:"#81B29A"}}>✓</span>
              <span style={{fontSize:11,color:th.textMuted,fontFamily:"'Space Mono',monospace",letterSpacing:0.5}}>{todayDone.length} done</span>
              <span style={{fontSize:10,color:th.textDim}}>{showDone?"▾":"▸"}</span>
            </button>
            <div style={{flex:1,height:1,background:`linear-gradient(to left,transparent,${th.border})`}}/>
          </div>
        )}
        {todayDone.length>0&&(showDone||todayInc.length===0)&&(
          <div style={{display:"flex",flexDirection:"column",gap:0,animation:"fadeIn 0.22s ease"}}>
            {todayInc.length===0&&<div style={{display:"flex",alignItems:"center",gap:10,marginBottom:12}}><div style={{flex:1,height:1,background:th.border}}/><span style={{fontSize:11,color:"#81B29A",fontFamily:"'Space Mono',monospace"}}>{todayDone.length} COMPLETED</span><div style={{flex:1,height:1,background:th.border}}/></div>}
            {todayDone.map(task=><TaskCard key={task.id} task={task} {...props} full isSliding={justDeleted===task.id}/>)}
          </div>
        )}

        {tomorrowTasks.length>0&&(
          <div style={{marginTop:28}}>
            <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:12}}>
              <div style={{fontSize:13,fontWeight:600,color:"#7B9EC9"}}>Tomorrow</div>
              <div style={{flex:1,height:1,background:th.border}}/>
              <div style={{fontSize:11,color:th.textDim,fontFamily:"'Space Mono',monospace"}}>{tomorrowTasks.length} task{tomorrowTasks.length!==1?"s":""}</div>
            </div>
            {tomorrowTasks.map(task=><TaskCard key={task.id} task={task} {...props} full isSliding={justDeleted===task.id}/>)}
          </div>
        )}
        {tomorrowTasks.length===0&&<div style={{marginTop:28,textAlign:"center",color:th.textDim,fontSize:13}}>Nothing scheduled for tomorrow.</div>}
      </div>
    </div>
  );
}

// --- Task Card ----------------------------------------------------------------
function TaskCard({task,categories,accent,th,compact,full,overdue,isSliding,isAppearing,expandedNote,onToggleNote,showMoveButtons,onMoveUp,onMoveDown,onToggle,onToggleSubtask,onStart,onMenu}){
  const cat=getCat(task.category,categories);
  const pri=PRIORITY_META[task.priority]||PRIORITY_META.medium;
  const isExpanded=expandedNote===task.id;
  const hasNote=task.notes&&task.notes.trim().length>0;
  const subtasks=task.subtasks||[];
  const subDone=subtasks.filter(s=>s.done).length;
  const subPct=subtasks.length>0?subDone/subtasks.length:0;

  // Swipe
  const swipeStartX=useRef(null);
  const swipeStartY=useRef(null);
  const[swipeX,setSwipeX]=useState(0);
  const[swiping,setSwiping]=useState(false);
  const THRESHOLD=55;

  function onTS(e){ swipeStartX.current=e.touches?e.touches[0].clientX:e.clientX; swipeStartY.current=e.touches?e.touches[0].clientY:e.clientY; setSwiping(false); }
  function onTM(e){
    if(swipeStartX.current===null) return;
    const dx=(e.touches?e.touches[0].clientX:e.clientX)-swipeStartX.current;
    const dy=(e.touches?e.touches[0].clientY:e.clientY)-swipeStartY.current;
    if(Math.abs(dy)>Math.abs(dx)&&!swiping) return;
    setSwiping(true);
    setSwipeX(Math.max(-110,Math.min(70,dx)));
  }
  function onTE(){
    if(!swiping){ swipeStartX.current=null; return; }
    if(swipeX<-THRESHOLD){ haptic("error"); onMenu(task,{stopPropagation:()=>{}}); }
    else if(swipeX>THRESHOLD&&!task.done){ haptic("success"); onStart(task); }
    setSwipeX(0); setSwiping(false); swipeStartX.current=null;
  }

  const swipeAction=swipeX<-THRESHOLD?"menu":swipeX>THRESHOLD&&!task.done?"timer":null;

  return(
    <div className={`task-wrap${isSliding?" collapsing":""}`} style={{marginBottom:compact?6:9,position:"relative"}}>
      {swiping&&swipeAction==="timer"&&<div style={{position:"absolute",inset:0,borderRadius:compact?12:14,background:accent+"33",display:"flex",alignItems:"center",paddingLeft:16,zIndex:0,borderLeft:`3px solid ${cat.color}`}}><span style={{fontSize:20}}>▶</span></div>}
      {swiping&&swipeAction==="menu"&&<div style={{position:"absolute",inset:0,borderRadius:compact?12:14,background:"#E07A5F33",display:"flex",alignItems:"center",justifyContent:"flex-end",paddingRight:16,zIndex:0,borderLeft:`3px solid ${cat.color}`}}><span style={{fontSize:20}}>⋯</span></div>}

      <div className={`task-card${isAppearing?" appearing":""}`}
        style={{background:th.surface,borderRadius:compact?12:14,padding:compact?"11px 13px":"13px 14px",border:`1px solid ${overdue?"#E07A5F33":th.border}`,borderLeftWidth:3,borderLeftColor:overdue?"#E07A5F":cat.color,borderLeftStyle:"solid",opacity:task.done?0.45:1,position:"relative",zIndex:1,transform:`translateX(${swipeX}px)`,transition:swiping?"none":"transform 0.3s cubic-bezier(0.34,1.2,0.64,1)",touchAction:"pan-y"}}
        onTouchStart={onTS} onTouchMove={onTM} onTouchEnd={onTE}>

        <div style={{display:"flex",alignItems:"center",gap:10}}>
          {showMoveButtons&&(
            <div style={{display:"flex",flexDirection:"column",gap:2,marginRight:-4}}>
              <button onClick={()=>onMoveUp(task.id)} style={{background:"none",border:"none",color:th.textDim,cursor:"pointer",fontSize:10,padding:"2px 5px",lineHeight:1}}>▲</button>
              <button onClick={()=>onMoveDown(task.id)} style={{background:"none",border:"none",color:th.textDim,cursor:"pointer",fontSize:10,padding:"2px 5px",lineHeight:1}}>▼</button>
            </div>
          )}
          <button onClick={()=>onToggle(task.id)} style={{width:22,height:22,borderRadius:"50%",border:`2px solid ${task.done?"#81B29A":th.border2}`,background:task.done?"#81B29A":"transparent",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,transition:"all 0.28s cubic-bezier(0.34,1.56,0.64,1)"}}>
            {task.done&&<svg width="10" height="8" viewBox="0 0 10 8" fill="none"><path d="M1 4L3.5 6.5L9 1" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>}
          </button>
          <div style={{flex:1,minWidth:0}}>
            <div style={{display:"flex",alignItems:"center",gap:5}}>
              <div style={{fontSize:compact?13:14,fontWeight:500,textDecoration:task.done?"line-through":"none",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",color:task.done?th.textMuted:th.text,flex:1}}>{task.title}</div>
              {task.recur&&task.recur!=="none"&&(()=>{
                const streak=(task.recurStreak||0);
                const pendingToday=task.done&&task.date===todayStr();
                const displayStreak=streak;
                const color=streak>=10?"#F2CC8F":streak>=5?accent:th.textMuted;
                return(
                  <span style={{fontSize:9,color:pendingToday?"#81B29A":color,background:pendingToday?"#81B29A22":streak>=5?accent+"18":th.surface2,borderRadius:3,padding:"1px 5px",flexShrink:0,fontWeight:pendingToday||streak>=5?700:400,display:"flex",alignItems:"center",gap:2}}>
                    ↻{pendingToday?` ${displayStreak}x ✓`:displayStreak>0?` ${displayStreak}x`:""}
                  </span>
                );
              })()}
              {overdue&&<span style={{fontSize:9,color:"#E07A5F",background:"#E07A5F22",borderRadius:3,padding:"1px 4px",flexShrink:0,fontWeight:700}}>OVERDUE</span>}
              {(()=>{
                // Don't show age badge on recurring clones -- they're freshly created each day
                if(task.recurSourceId) return null;
                const d=taskAgeDays(task); const c=ageColor(d);
                return c&&!task.done?<span title={`${d} days old`} style={{fontSize:9,color:c,background:c+"22",borderRadius:3,padding:"1px 5px",flexShrink:0,fontWeight:600}}>{d}d</span>:null;
              })()}
            </div>
            <div style={{display:"flex",gap:6,marginTop:compact?2:4,flexWrap:"wrap",alignItems:"center"}}>
              {full&&<span style={{fontSize:10,color:th.textDim,display:"flex",alignItems:"center",gap:2}}><span style={{width:5,height:5,borderRadius:"50%",background:cat.color,display:"inline-block"}}/>{cat.label}</span>}
              {task.workTime&&<span style={{fontSize:10,color:"#7B9EC9"}}>🕐 {fmtTime(task.workTime)}</span>}
              {task.dueTime&&<span style={{fontSize:10,color:"#E07A5F88"}}>⏰ {fmtTime(task.dueTime)}</span>}
              <span style={{fontSize:10,color:th.textDim}}>⏱ {fmtDuration(task.minutes)}</span>
              <span style={{fontSize:9,background:pri.color+"1A",color:pri.color,borderRadius:3,padding:"2px 6px",fontWeight:700}}>{pri.label}</span>
              {hasNote&&<button onClick={e=>{ e.stopPropagation(); onToggleNote(task.id); }} style={{fontSize:9,background:isExpanded?accent+"22":th.surface2,color:isExpanded?accent:th.textMuted,border:`1px solid ${isExpanded?accent+"44":th.border2}`,borderRadius:3,padding:"2px 6px",cursor:"pointer",fontFamily:"'DM Sans',sans-serif"}}>{isExpanded?"▲":"▼"} note</button>}
            </div>
            {subtasks.length>0&&(
              <div style={{marginTop:6,display:"flex",alignItems:"center",gap:8}}>
                <div style={{flex:1,background:th.bg,borderRadius:3,height:3,overflow:"hidden"}}><div style={{height:"100%",background:cat.color,borderRadius:3,width:`${subPct*100}%`,transition:"width 0.4s ease"}}/></div>
                <span style={{fontSize:9,color:th.textMuted,fontFamily:"'Space Mono',monospace",flexShrink:0}}>{subDone}/{subtasks.length}</span>
              </div>
            )}
          </div>
          <div style={{display:"flex",gap:4,alignItems:"center",flexShrink:0}}>
            {!task.done&&<button onClick={()=>onStart(task)} style={{background:accent+"1A",border:"none",borderRadius:8,padding:"6px 9px",color:accent,fontSize:11,cursor:"pointer",fontWeight:700,fontFamily:"'DM Sans',sans-serif"}}>▶</button>}
            <button onClick={e=>onMenu(task,e)} style={{background:"none",border:"none",color:th.textDim,fontSize:17,cursor:"pointer",padding:"3px 5px",lineHeight:1,borderRadius:6}}>⋯</button>
          </div>
        </div>
        {hasNote&&isExpanded&&(
          <div style={{marginTop:9,paddingLeft:32,animation:"noteExpand 0.2s ease"}}>
            <div style={{fontSize:12,color:th.textMuted,lineHeight:1.6,background:th.surface2,borderRadius:8,padding:"8px 12px",border:`1px solid ${th.border}`}}>{task.notes}</div>
          </div>
        )}
        {subtasks.length>0&&isExpanded&&(
          <div style={{marginTop:7,paddingLeft:32,animation:"noteExpand 0.2s ease"}}>
            {subtasks.map(s=>(
              <div key={s.id} style={{display:"flex",alignItems:"center",gap:8,padding:"5px 0",borderBottom:`1px solid ${th.border}44`}}>
                <button onClick={e=>{ e.stopPropagation(); onToggleSubtask(task.id,s.id); }} style={{width:16,height:16,borderRadius:"50%",border:`2px solid ${s.done?"#81B29A":th.border2}`,background:s.done?"#81B29A":"transparent",cursor:"pointer",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center"}}>
                  {s.done&&<svg width="8" height="6" viewBox="0 0 8 6" fill="none"><path d="M1 3L3 5L7 1" stroke="#fff" strokeWidth="1.5" strokeLinecap="round"/></svg>}
                </button>
                <span style={{fontSize:12,color:s.done?th.textMuted:th.text,textDecoration:s.done?"line-through":"none"}}>{s.text}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// --- Daily Summary -------------------------------------------------------------
function DailySummary({data,accent,onClose}){
  const[vis,setVis]=useState(false);
  useEffect(()=>{ setTimeout(()=>setVis(true),50); },[]);
  const hrs=Math.floor(data.totalFocus/60), mins=data.totalFocus%60;
  return(
    <div style={{position:"fixed",inset:0,zIndex:400,display:"flex",alignItems:"center",justifyContent:"center",background:"rgba(8,8,16,0.95)"}}>
      {[0,0.25,0.5,0.75,1,1.25].map((delay,i)=>(
        <div key={i} style={{position:"absolute",width:200,height:200,borderRadius:"50%",border:`2px solid ${accent}`,opacity:0,animation:`burstRipple 2.4s cubic-bezier(0,0.6,0.4,1) ${delay}s forwards`,transform:"scale(0)",pointerEvents:"none"}}/>
      ))}
      <div style={{position:"relative",textAlign:"center",padding:"0 32px",opacity:vis?1:0,transform:vis?"translateY(0)":"translateY(40px)",transition:"all 0.7s cubic-bezier(0.34,1.3,0.64,1)"}}>
        <div style={{fontSize:68,marginBottom:16,filter:`drop-shadow(0 0 30px ${accent}88)`}}>🎉</div>
        <div style={{fontFamily:"'Space Mono',monospace",fontSize:12,color:accent,letterSpacing:2,marginBottom:8}}>DAY COMPLETE</div>
        <div style={{fontSize:26,fontWeight:700,marginBottom:22,letterSpacing:-0.5,color:"#F0EDE8"}}>{data.done} tasks done</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:26}}>
          {[{val:hrs>0?`${hrs}h ${mins}m`:`${mins}m`,label:"Focus time",color:accent},{val:`🔥 ${data.streak}`,label:"Day streak",color:"#F2CC8F"}].map(s=>(
            <div key={s.label} style={{background:"#1A1A22",borderRadius:16,padding:"16px",border:"1px solid #1E1E28"}}>
              <div style={{fontFamily:"'Space Mono',monospace",fontSize:20,fontWeight:700,color:s.color}}>{s.val}</div>
              <div style={{fontSize:11,color:"#555",marginTop:4}}>{s.label}</div>
            </div>
          ))}
        </div>
        {data.streak>=7&&<div style={{fontSize:13,color:"#F2CC8F",marginBottom:18,fontWeight:500}}>🏆 {data.streak} day streak -- incredible!</div>}
        <button onClick={onClose} style={{background:accent,border:"none",borderRadius:14,padding:"15px 36px",color:"#fff",fontSize:15,fontWeight:600,cursor:"pointer",fontFamily:"'DM Sans',sans-serif",boxShadow:`0 6px 28px ${accent}55`}}>Keep it up →</button>
      </div>
    </div>
  );
}

// --- Dev Menu -----------------------------------------------------------------
function DevMenu({accent,th,onClose,onResetOnboarding,onResetStorage,onForceOverdue,onForceSummary,onAddTestTask,onAddTestRecur,onSolidifyRecur}){
  const[hapticResult,setHapticResult]=useState("");
  const[soundPlaying,setSoundPlaying]=useState("");
  const[animKey,setAnimKey]=useState(0);
  const[animId,setAnimId]=useState("");
  const[notifStatus,setNotifStatus]=useState(
    typeof Notification!=="undefined"?Notification.permission:"unavailable"
  );

  const ANIMS=[
    {id:"slideIn",label:"Slide In", anim:"dev_slideIn 0.5s cubic-bezier(0.34,1.28,0.64,1) forwards"},
    {id:"shrink", label:"Card Exit",anim:"dev_shrink 0.45s cubic-bezier(0.55,0,0.1,1) forwards"},
    {id:"fadeIn", label:"Fade In",  anim:"dev_fadeIn 0.4s ease forwards"},
    {id:"bounce", label:"Bounce",   anim:"dev_bounce 0.5s cubic-bezier(0.34,1.56,0.64,1) forwards"},
  ];

  function testHaptic(type){
    if("vibrate" in navigator){
      haptic(type);
      setHapticResult("✓ "+type);
    } else {
      setHapticResult("✗ Not supported (works on Android Chrome)");
    }
    setTimeout(()=>setHapticResult(""),2500);
  }
  function testSound(id){ setSoundPlaying(id); playTimerSound(id); setTimeout(()=>setSoundPlaying(""),1500); }
  function testAnim(id){
    setAnimId(id); setAnimKey(k=>k+1);
    setTimeout(()=>setAnimId(""),700);
  }
  async function testNotif(){
    if(typeof Notification==="undefined"){ setNotifStatus("unavailable"); return; }
    const p=await Notification.requestPermission();
    setNotifStatus(p);
    if(p==="granted") new Notification("TaskFlow",{body:"Notifications working! 🎉"});
  }

  return(
    <div style={{position:"fixed",inset:0,zIndex:500,display:"flex",alignItems:"flex-end",justifyContent:"center"}} onClick={onClose}>
      <div style={{position:"absolute",inset:0,background:"rgba(0,0,0,0.75)",backdropFilter:"blur(8px)"}}/>
      <div onClick={e=>e.stopPropagation()} style={{position:"relative",background:th.surface2,borderRadius:"22px 22px 0 0",width:"100%",maxWidth:430,padding:"16px 20px 52px",maxHeight:"92vh",overflowY:"auto",overflowX:"hidden",animation:"slideUp 0.3s cubic-bezier(0.34,1.08,0.64,1)",boxShadow:"0 -8px 40px rgba(0,0,0,0.6)"}}>
        <style>{`
          @keyframes dev_slideIn{0%{opacity:0;transform:translateY(18px) scale(0.96)}60%{opacity:1;transform:translateY(-2px)}100%{opacity:1;transform:translateY(0) scale(1)}}
          @keyframes dev_shrink{0%{opacity:1;transform:scaleY(1)}40%{opacity:0}100%{opacity:0;transform:scaleY(0)}}
          @keyframes dev_fadeIn{from{opacity:0;transform:scale(0.94)}to{opacity:1;transform:scale(1)}}
          @keyframes dev_bounce{0%{transform:scale(1)}30%{transform:scale(0.9)}60%{transform:scale(1.08)}100%{transform:scale(1)}}
        `}</style>
        <div style={{width:36,height:4,background:th.border2,borderRadius:2,margin:"0 auto 16px"}}/>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:22}}>
          <div>
            <div style={{fontSize:16,fontWeight:700}}>🛠 Dev Menu</div>
            <div style={{fontSize:12,color:th.textMuted,marginTop:2}}>Testing tools</div>
          </div>
          <button onClick={onClose} style={{background:"none",border:"none",color:th.textMuted,fontSize:22,cursor:"pointer",padding:"4px",lineHeight:1}}>✕</button>
        </div>

        <DevSection label="🔊 Sounds" th={th}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
            {AUDIO_OPTIONS.filter(a=>a.id!=="none").map(a=>(
              <button key={a.id} onClick={()=>testSound(a.id)}
                style={{background:soundPlaying===a.id?accent+"22":th.surface,border:`1px solid ${soundPlaying===a.id?accent:th.border2}`,borderRadius:12,padding:"11px 12px",color:soundPlaying===a.id?accent:th.text,fontSize:13,cursor:"pointer",fontFamily:"'DM Sans',sans-serif",display:"flex",alignItems:"center",gap:8}}>
                <span style={{fontSize:15}}>{a.icon}</span><span>{a.label}</span>
              </button>
            ))}
          </div>
        </DevSection>

        <DevSection label="📳 Haptics" th={th}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:8}}>
            {["light","medium","heavy","success","error","double"].map(h=>(
              <button key={h} onClick={()=>testHaptic(h)}
                style={{background:th.surface,border:`1px solid ${th.border2}`,borderRadius:12,padding:"11px 6px",color:th.text,fontSize:12,cursor:"pointer",fontFamily:"'DM Sans',sans-serif",textTransform:"capitalize",textAlign:"center"}}>
                {h}
              </button>
            ))}
          </div>
          {hapticResult&&<div style={{fontSize:12,padding:"8px 12px",background:hapticResult.startsWith("✓")?"#81B29A22":"#E07A5F22",borderRadius:8,color:hapticResult.startsWith("✓")?"#81B29A":"#E07A5F",fontFamily:"'Space Mono',monospace"}}>{hapticResult}</div>}
        </DevSection>

        <DevSection label="🔔 Notifications" th={th}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",background:th.surface,borderRadius:12,padding:"14px 16px",border:`1px solid ${th.border}`}}>
            <div>
              <div style={{fontSize:13,fontWeight:500}}>Permission: <span style={{color:notifStatus==="granted"?"#81B29A":notifStatus==="denied"?"#E07A5F":"#F2CC8F"}}>{notifStatus}</span></div>
              <div style={{fontSize:11,color:th.textMuted,marginTop:3}}>Chrome/Edge/Firefox only (not iOS Safari)</div>
            </div>
            <button onClick={testNotif} style={{background:accent+"22",border:`1px solid ${accent}44`,borderRadius:8,padding:"8px 14px",color:accent,fontSize:12,cursor:"pointer",fontFamily:"'DM Sans',sans-serif",fontWeight:600,flexShrink:0,marginLeft:12}}>Test</button>
          </div>
        </DevSection>

        <DevSection label="✨ Animations" th={th}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:8,marginBottom:12}}>
            {ANIMS.map(a=>(
              <button key={a.id} onClick={()=>testAnim(a.id)}
                style={{background:animId===a.id?accent+"22":th.surface,border:`1px solid ${animId===a.id?accent:th.border2}`,borderRadius:12,padding:"11px 4px",color:animId===a.id?accent:th.text,fontSize:11,cursor:"pointer",fontFamily:"'DM Sans',sans-serif",textAlign:"center"}}>
                {a.label}
              </button>
            ))}
          </div>
          <div style={{overflow:"hidden",borderRadius:12}}>
            <div key={animKey} style={{background:th.surface,borderRadius:12,padding:"13px 16px",border:`1px solid ${th.border}`,borderLeft:`3px solid ${accent}`,animation:animId?(ANIMS.find(a=>a.id===animId)?.anim||"none"):"none"}}>
              <div style={{fontWeight:500,fontSize:13,color:th.text}}>Sample Task</div>
              <div style={{fontSize:11,color:th.textMuted,marginTop:4}}>🕐 3:00 PM · ⏱ 30m</div>
            </div>
          </div>
        </DevSection>

        <DevSection label="⚡ App Triggers" th={th}>
          {[
            {label:"Add test task",         sub:"Plain task for today",           fn:onAddTestTask,    color:"#7B9EC9"},
            {label:"Add recurring task",    sub:"Daily recurring test",           fn:onAddTestRecur,   color:"#7B9EC9"},
            {label:"Solidify recur counts", sub:"Runs next-day logic now",        fn:onSolidifyRecur,  color:"#C9A7EB"},
            {label:"Show onboarding",       sub:"Resets first-run flow",          fn:onResetOnboarding,color:"#81B29A"},
            {label:"Force overdue",         sub:"Makes first task overdue",       fn:onForceOverdue,   color:"#F2CC8F"},
            {label:"Show summary",          sub:"Fires completion modal",         fn:onForceSummary,   color:"#C9A7EB"},
            {label:"⚠️ Reset ALL storage", sub:"Wipes everything & reloads",     fn:onResetStorage,   color:"#E07A5F"},
          ].map(item=>(
            <button key={item.label} onClick={item.fn}
              style={{width:"100%",background:item.color+"14",border:`1px solid ${item.color}33`,borderRadius:12,padding:"12px 16px",cursor:"pointer",textAlign:"left",fontFamily:"'DM Sans',sans-serif",marginBottom:8}}>
              <div style={{fontSize:13,fontWeight:600,color:item.color}}>{item.label}</div>
              <div style={{fontSize:11,color:th.textMuted,marginTop:2}}>{item.sub}</div>
            </button>
          ))}
        </DevSection>

        <DevSection label="📱 System Info" th={th}>
          <div style={{background:th.surface,borderRadius:12,padding:"14px 16px",border:`1px solid ${th.border}`,fontFamily:"'Space Mono',monospace",fontSize:11,color:th.textMuted,lineHeight:1.9}}>
            <div>Vibration: <span style={{color:"vibrate" in navigator?"#81B29A":"#E07A5F"}}>{"vibrate" in navigator?"✓ supported":"✗ not supported"}</span></div>
            <div>Notifications: <span style={{color:typeof Notification!=="undefined"?"#81B29A":"#E07A5F"}}>{typeof Notification!=="undefined"?"✓ available":"✗ not available"}</span></div>
            <div>Wake Lock: <span style={{color:"wakeLock" in navigator?"#81B29A":"#E07A5F"}}>{"wakeLock" in navigator?"✓ supported":"✗ not supported"}</span></div>
            <div>Screen: <span style={{color:th.text}}>{typeof window!=="undefined"?`${window.innerWidth}×${window.innerHeight}`:"?"}</span></div>
          </div>
        </DevSection>
      </div>
    </div>
  );
}
function DevSection({label,children,th}){
  return(
    <div style={{marginBottom:24}}>
      <div style={{fontSize:11,color:th.textDim,letterSpacing:1.2,textTransform:"uppercase",fontFamily:"'Space Mono',monospace",marginBottom:10}}>{label}</div>
      {children}
    </div>
  );
}

// --- Settings -----------------------------------------------------------------
function SettingsPage({settings,setSettings,analytics,categories,tasks,accent,th,streak,templates,focusLog,notifGranted,onEnableNotifications,onResetStreak,onDeleteTemplate,onAddFromTemplate}){
  const[section,setSection]=useState("general");
  const SECTIONS=[{id:"general",label:"General",icon:"⚙️"},{id:"display",label:"Display",icon:"🎨"},{id:"analytics",label:"Stats",icon:"📊"},{id:"history",label:"History",icon:"⏱"},{id:"templates",label:"Templates",icon:"📋"}];
  function Toggle({val,onChange}){ return(<div className="toggle-track" onClick={()=>onChange(!val)} style={{width:44,height:26,borderRadius:13,background:val?accent:th.border2,position:"relative",transition:"background 0.25s",flexShrink:0}}><div style={{position:"absolute",top:3,left:val?22:3,width:20,height:20,borderRadius:"50%",background:"#fff",transition:"left 0.25s cubic-bezier(0.34,1.56,0.64,1)",boxShadow:"0 1px 4px rgba(0,0,0,0.3)"}}/></div>); }
  function Row({icon,label,sub,right}){ return(<div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"15px 16px",background:th.surface,borderRadius:14,marginBottom:8}}><div style={{display:"flex",alignItems:"center",gap:12,flex:1,minWidth:0}}><span style={{fontSize:18,width:24,textAlign:"center",flexShrink:0}}>{icon}</span><div style={{minWidth:0}}><div style={{fontSize:14,fontWeight:500}}>{label}</div>{sub&&<div style={{fontSize:11,color:th.textMuted,marginTop:2}}>{sub}</div>}</div></div><div style={{flexShrink:0,marginLeft:12}}>{right}</div></div>); }
  const hrs=Math.floor(analytics.totalMinutes/60), m2=analytics.totalMinutes%60;
  const eHrs=Math.floor(analytics.estimatedMinutes/60), eM=analytics.estimatedMinutes%60;
  const catData=categories.map(c=>({...c,count:tasks.filter(t=>t.category===c.id).length,done:tasks.filter(t=>t.category===c.id&&t.done).length})).filter(c=>c.count>0).sort((a,b)=>b.count-a.count);
  const maxCount=Math.max(...catData.map(c=>c.count),1);
  return(
    <div style={{flex:1,overflowY:"auto",overflowX:"hidden",paddingBottom:80}}>
      <div style={{padding:"52px 22px 16px"}}>
        <div style={{fontSize:11,color:th.textDim,letterSpacing:1.5,textTransform:"uppercase",fontFamily:"'Space Mono',monospace",marginBottom:4}}>Preferences</div>
        <div style={{fontSize:22,fontWeight:600,letterSpacing:-0.3}}>Settings</div>
      </div>
      <div style={{display:"flex",gap:8,padding:"0 22px 20px",overflowX:"auto",WebkitOverflowScrolling:"touch"}}>
        {SECTIONS.map(s=>(
          <button key={s.id} onClick={()=>setSection(s.id)} style={{flexShrink:0,background:section===s.id?accent+"22":th.surface,border:`1.5px solid ${section===s.id?accent:th.border}`,borderRadius:20,padding:"8px 16px",color:section===s.id?accent:th.textMuted,fontSize:12,fontFamily:"'DM Sans',sans-serif",fontWeight:section===s.id?600:400,cursor:"pointer",display:"flex",alignItems:"center",gap:6}}>
            <span style={{fontSize:13}}>{s.icon}</span>{s.label}
          </button>
        ))}
      </div>
      <div style={{padding:"0 22px"}}>
        {section==="general"&&<>
          <div style={{fontSize:11,color:th.textDim,letterSpacing:1.2,textTransform:"uppercase",fontFamily:"'Space Mono',monospace",marginBottom:10}}>Default Sort</div>
          <div style={{background:th.surface,borderRadius:14,padding:"6px",marginBottom:20}}>
            {buildSortOptions(categories,settings.hiddenSorts).map(s=>(
              <button key={s.id} onClick={()=>setSettings(p=>({...p,sortBy:s.id}))}
                style={{width:"100%",background:settings.sortBy===s.id?(s.color||accent)+"18":"transparent",border:"none",borderRadius:10,padding:"12px 14px",color:settings.sortBy===s.id?(s.color||accent):th.textMuted,fontSize:14,cursor:"pointer",display:"flex",alignItems:"center",gap:10,fontFamily:"'DM Sans',sans-serif"}}>
                {s.isCat?<span style={{width:10,height:10,borderRadius:"50%",background:s.color,display:"inline-block"}}/>:<span style={{fontSize:15}}>{s.icon}</span>}
                <span style={{fontWeight:settings.sortBy===s.id?600:400,flex:1,textAlign:"left"}}>{s.label}</span>
                {settings.sortBy===s.id&&<span style={{fontSize:12}}>✓</span>}
              </button>
            ))}
          </div>
          <div style={{fontSize:11,color:th.textDim,letterSpacing:1.2,textTransform:"uppercase",fontFamily:"'Space Mono',monospace",marginBottom:10}}>Timer Sound</div>
          <div style={{background:th.surface,borderRadius:14,padding:"6px",marginBottom:20}}>
            {AUDIO_OPTIONS.map(a=>(
              <button key={a.id} onClick={()=>{ setSettings(p=>({...p,timerSound:a.id})); if(a.id!=="none") playTimerSound(a.id); }}
                style={{width:"100%",background:settings.timerSound===a.id?accent+"18":"transparent",border:"none",borderRadius:10,padding:"12px 14px",color:settings.timerSound===a.id?accent:th.textMuted,fontSize:14,cursor:"pointer",display:"flex",alignItems:"center",gap:10,fontFamily:"'DM Sans',sans-serif"}}>
                <span style={{fontSize:15}}>{a.icon}</span>
                <span style={{fontWeight:settings.timerSound===a.id?600:400,flex:1,textAlign:"left"}}>{a.label}</span>
                {settings.timerSound===a.id&&<span style={{fontSize:11,color:accent}}>▶ preview</span>}
              </button>
            ))}
          </div>
          <div style={{fontSize:11,color:th.textDim,letterSpacing:1.2,textTransform:"uppercase",fontFamily:"'Space Mono',monospace",marginBottom:10,marginTop:4}}>Countdown Display</div>
          <div style={{background:th.surface,borderRadius:14,padding:"8px",marginBottom:20,display:"flex",gap:6}}>
            {[{id:"mm:ss",label:"MM:SS",sub:"2:30"},{id:"hh:mm:ss",label:"HH:MM:SS",sub:"0:02:30"},{id:"minutes",label:"Minutes",sub:"3m"}].map(m=>(
              <button key={m.id} onClick={()=>setSettings(p=>({...p,countdownMode:m.id}))}
                style={{flex:1,background:(settings.countdownMode||"mm:ss")===m.id?accent+"22":th.bg,border:`1.5px solid ${(settings.countdownMode||"mm:ss")===m.id?accent:th.border}`,borderRadius:10,padding:"12px 4px",cursor:"pointer",fontFamily:"'DM Sans',sans-serif",transition:"all 0.18s",textAlign:"center"}}>
                <div style={{fontFamily:"'Space Mono',monospace",fontSize:12,fontWeight:700,color:(settings.countdownMode||"mm:ss")===m.id?accent:th.text}}>{m.label}</div>
                <div style={{fontSize:10,color:th.textMuted,marginTop:4}}>{m.sub}</div>
              </button>
            ))}
          </div>
          <Row icon="🔥" label="Show Streak" sub="Streak counter on home screen" right={<Toggle val={settings.showStreak} onChange={v=>setSettings(p=>({...p,showStreak:v}))}/>}/>
          <Row icon="🔔" label="Notifications" sub={notifGranted?"5min reminder before each task":"Tap Enable to allow notifications"}
            right={settings.notificationsOn&&notifGranted
              ?<Toggle val={settings.notificationsOn} onChange={v=>setSettings(p=>({...p,notificationsOn:v}))}/>
              :<button onClick={onEnableNotifications} style={{background:accent+"22",border:`1px solid ${accent}44`,borderRadius:8,padding:"7px 14px",color:accent,fontSize:12,cursor:"pointer",fontFamily:"'DM Sans',sans-serif",fontWeight:600}}>Enable</button>}/>
          <div style={{marginTop:20,background:th.surface,borderRadius:14,padding:"16px 18px"}}>
            <div style={{fontSize:11,color:th.textDim,letterSpacing:1,textTransform:"uppercase",fontFamily:"'Space Mono',monospace",marginBottom:10}}>Default Focus: {fmtDuration(settings.defaultMinutes)}</div>
            <input type="range" min={5} max={240} step={5} value={settings.defaultMinutes} onChange={e=>setSettings(p=>({...p,defaultMinutes:Number(e.target.value)}))} style={{width:"100%",accentColor:accent}}/>
            <div style={{display:"flex",justifyContent:"space-between",fontSize:11,color:th.textDim,marginTop:4}}><span>5m</span><span>4h</span></div>
          </div>
        </>}

        {section==="display"&&<>
          <div style={{fontSize:11,color:th.textDim,letterSpacing:1.2,textTransform:"uppercase",fontFamily:"'Space Mono',monospace",marginBottom:10}}>Theme</div>
          <div style={{display:"flex",gap:10,marginBottom:20}}>
            {[{id:"dark",label:"Dark",icon:"🌙"},{id:"light",label:"Light",icon:"☀️"}].map(t=>(
              <button key={t.id} onClick={()=>setSettings(p=>({...p,theme:t.id}))}
                style={{flex:1,background:(settings.theme||"dark")===t.id?accent+"22":th.surface,border:`1.5px solid ${(settings.theme||"dark")===t.id?accent:th.border}`,borderRadius:14,padding:"14px",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:8,fontFamily:"'DM Sans',sans-serif",color:(settings.theme||"dark")===t.id?accent:th.textMuted,fontWeight:(settings.theme||"dark")===t.id?600:400,fontSize:14}}>
                <span style={{fontSize:18}}>{t.icon}</span>{t.label}
              </button>
            ))}
          </div>
          <div style={{fontSize:11,color:th.textDim,letterSpacing:1.2,textTransform:"uppercase",fontFamily:"'Space Mono',monospace",marginBottom:10}}>Accent Color</div>
          <div style={{background:th.surface,borderRadius:14,padding:"18px",marginBottom:20}}>
            <div style={{display:"flex",flexWrap:"wrap",gap:12}}>
              {ACCENT_OPTS.map(c=><button key={c} onClick={()=>setSettings(p=>({...p,accentColor:c}))} style={{width:38,height:38,borderRadius:"50%",background:c,border:`3px solid ${settings.accentColor===c?"#F0EDE8":"transparent"}`,cursor:"pointer",padding:0,transform:settings.accentColor===c?"scale(1.15)":"scale(1)",transition:"all 0.15s"}}/>)}
            </div>
          </div>
          <Row icon="📋" label="Compact View" sub="Smaller task cards on home" right={<Toggle val={settings.compactView} onChange={v=>setSettings(p=>({...p,compactView:v}))}/>}/>
          <Row icon="🧘" label="Reduce Motion" sub="Turns off all animations & transitions" right={<Toggle val={settings.reducedMotion||false} onChange={v=>setSettings(p=>({...p,reducedMotion:v}))}/>}/>
        </>}

        {section==="analytics"&&<>
          <div style={{background:th.surface,borderRadius:14,padding:"18px 20px",marginBottom:14,border:`1px solid ${th.border}`,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
            <div style={{display:"flex",alignItems:"center",gap:14}}><div style={{fontSize:30}}>🔥</div><div><div style={{fontFamily:"'Space Mono',monospace",fontSize:26,fontWeight:700,color:"#F2CC8F",lineHeight:1}}>{streak}</div><div style={{fontSize:12,color:th.textMuted,marginTop:4}}>day streak</div></div></div>
            <button onClick={onResetStreak} style={{background:"none",border:`1px solid ${th.border2}`,borderRadius:8,padding:"7px 14px",color:th.textMuted,fontSize:12,cursor:"pointer",fontFamily:"'DM Sans',sans-serif"}}>Reset</button>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:14}}>
            {[{label:"Total",val:analytics.total,icon:"📋",color:"#7B9EC9"},{label:"Done",val:analytics.done,icon:"✅",color:"#81B29A"},{label:"Focus",val:`${hrs}h ${m2}m`,icon:"⏱",color:accent},{label:"Rate",val:`${analytics.rate}%`,icon:"📈",color:"#C9A7EB"}].map(s=>(
              <div key={s.label} style={{background:th.surface,borderRadius:14,padding:"16px",border:`1px solid ${th.border}`}}>
                <div style={{fontSize:20,marginBottom:8}}>{s.icon}</div>
                <div style={{fontFamily:"'Space Mono',monospace",fontSize:22,fontWeight:700,color:s.color}}>{s.val}</div>
                <div style={{fontSize:11,color:th.textMuted,marginTop:3}}>{s.label}</div>
              </div>
            ))}
          </div>
          <div style={{background:th.surface,borderRadius:14,padding:"16px 18px",marginBottom:14,border:`1px solid ${th.border}`}}>
            <div style={{fontSize:11,color:th.textDim,letterSpacing:1.2,textTransform:"uppercase",fontFamily:"'Space Mono',monospace",marginBottom:10}}>Time Accuracy</div>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:8}}><span style={{fontSize:12,color:th.textMuted}}>Est: {eHrs>0?`${eHrs}h `:""}{ eM}m</span><span style={{fontSize:12,color:accent}}>Actual: {hrs>0?`${hrs}h `:""}{ m2}m</span></div>
            <div style={{background:th.bg,borderRadius:6,height:8,overflow:"hidden"}}><div style={{height:"100%",background:`linear-gradient(to right,${accent},#81B29A)`,borderRadius:6,width:`${Math.min((analytics.totalMinutes/Math.max(analytics.estimatedMinutes,1))*100,100)}%`,transition:"width 1s ease"}}/></div>
          </div>
          <div style={{background:th.surface,borderRadius:14,padding:"16px 18px",border:`1px solid ${th.border}`}}>
            <div style={{fontSize:11,color:th.textDim,letterSpacing:1.2,textTransform:"uppercase",fontFamily:"'Space Mono',monospace",marginBottom:14}}>By Category</div>
            {catData.map(cat=>(
              <div key={cat.id} style={{marginBottom:12}}>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:5}}><div style={{display:"flex",alignItems:"center",gap:7}}><span style={{width:7,height:7,borderRadius:"50%",background:cat.color,display:"inline-block"}}/><span style={{fontSize:13,fontWeight:500}}>{cat.label}</span></div><span style={{fontFamily:"'Space Mono',monospace",fontSize:11,color:th.textMuted}}>{cat.done}/{cat.count}</span></div>
                <div style={{background:th.bg,borderRadius:4,height:6,overflow:"hidden"}}><div style={{height:"100%",background:cat.color,borderRadius:4,width:`${(cat.count/maxCount)*100}%`,opacity:0.75,transition:"width 0.8s ease"}}/></div>
              </div>
            ))}
          </div>
          <div style={{marginTop:22,textAlign:"center",fontSize:11,color:th.textDim,fontFamily:"'Space Mono',monospace",letterSpacing:1}}>TASKFLOW v4.0</div>
        </>}

        {section==="history"&&<>
          <div style={{fontSize:11,color:th.textDim,letterSpacing:1.2,textTransform:"uppercase",fontFamily:"'Space Mono',monospace",marginBottom:14}}>Focus Session History</div>
          {(!focusLog||focusLog.length===0)&&(
            <div style={{textAlign:"center",color:th.textDim,padding:"48px 0",fontSize:14}}>
              <div style={{fontSize:36,marginBottom:12}}>⏱</div>
              <div>No sessions yet.</div>
              <div style={{fontSize:12,marginTop:6}}>Complete a timer session to see your history here.</div>
            </div>
          )}
          {focusLog&&focusLog.length>0&&(
            <>
              {/* Summary bar */}
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:16}}>
                {[
                  {label:"Total Sessions",val:focusLog.length,icon:"🎯",color:accent},
                  {label:"Total Focus",val:(()=>{ const m=focusLog.reduce((s,l)=>s+l.actualMins,0); return m>=60?`${Math.floor(m/60)}h ${m%60}m`:`${m}m`; })(),icon:"⏱",color:"#81B29A"},
                ].map(s=>(
                  <div key={s.label} style={{background:th.surface,borderRadius:14,padding:"14px",border:`1px solid ${th.border}`}}>
                    <div style={{fontSize:18,marginBottom:6}}>{s.icon}</div>
                    <div style={{fontFamily:"'Space Mono',monospace",fontSize:20,fontWeight:700,color:s.color}}>{s.val}</div>
                    <div style={{fontSize:11,color:th.textMuted,marginTop:3}}>{s.label}</div>
                  </div>
                ))}
              </div>
              {/* Session log */}
              <div style={{display:"flex",flexDirection:"column",gap:8}}>
                {focusLog.slice(0,50).map(log=>{
                  const cat=getCat(log.category,categories);
                  const accuracy=log.estimatedMins>0?Math.round((log.actualMins/log.estimatedMins)*100):100;
                  const accuracyColor=accuracy<=110?"#81B29A":accuracy<=130?"#F2CC8F":"#E07A5F";
                  return(
                    <div key={log.id} style={{background:th.surface,borderRadius:12,padding:"12px 14px",border:`1px solid ${th.border}`,borderLeft:`3px solid ${cat.color}`}}>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:6}}>
                        <div style={{fontSize:13,fontWeight:500,flex:1,minWidth:0,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",paddingRight:8}}>{log.taskTitle}</div>
                        <div style={{fontSize:11,color:th.textDim,fontFamily:"'Space Mono',monospace",flexShrink:0}}>{new Date(log.ts).toLocaleDateString("en-US",{month:"short",day:"numeric"})}</div>
                      </div>
                      <div style={{display:"flex",gap:10,alignItems:"center",flexWrap:"wrap"}}>
                        <span style={{display:"flex",alignItems:"center",gap:3,fontSize:10,color:th.textDim}}><span style={{width:6,height:6,borderRadius:"50%",background:cat.color,display:"inline-block"}}/>{cat.label}</span>
                        <span style={{fontSize:10,color:th.textMuted}}>⏱ {log.actualMins}m actual</span>
                        {log.estimatedMins!==log.actualMins&&<span style={{fontSize:10,color:th.textDim}}>({log.estimatedMins}m est)</span>}
                        {log.partial&&<span style={{fontSize:9,background:"#7B9EC922",color:"#7B9EC9",borderRadius:3,padding:"2px 6px",fontWeight:600}}>Partial</span>}
                      {!log.partial&&<span style={{fontSize:9,background:accuracyColor+"22",color:accuracyColor,borderRadius:3,padding:"2px 6px",fontWeight:600}}>{accuracy<=110?"On track":accuracy<=130?"A bit over":"Over"}</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
              {focusLog.length>50&&<div style={{textAlign:"center",fontSize:11,color:th.textDim,marginTop:12}}>Showing 50 most recent of {focusLog.length} sessions</div>}
            </>
          )}
        </>}

        {section==="templates"&&<>
          <div style={{fontSize:11,color:th.textDim,letterSpacing:1.2,textTransform:"uppercase",fontFamily:"'Space Mono',monospace",marginBottom:10}}>Saved Templates</div>
          {templates.length===0&&<div style={{textAlign:"center",color:th.textDim,padding:"40px 0",fontSize:13}}>No templates yet.<br/>Use ⋯ on any task to save as a template.</div>}
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            {templates.map(t=>(
              <div key={t.id} style={{display:"flex",alignItems:"center",gap:12,background:th.surface,borderRadius:14,padding:"14px 16px",border:`1px solid ${th.border}`}}>
                <span style={{fontSize:20}}>{t.icon}</span>
                <div style={{flex:1,minWidth:0}}><div style={{fontSize:14,fontWeight:500,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{t.name}</div><div style={{fontSize:11,color:th.textMuted,marginTop:2}}>{fmtDuration(t.task.minutes)} · {t.task.priority}</div></div>
                <button onClick={()=>onAddFromTemplate(t)} style={{background:accent+"22",border:`1px solid ${accent}44`,borderRadius:8,padding:"7px 14px",color:accent,fontSize:12,cursor:"pointer",fontFamily:"'DM Sans',sans-serif",fontWeight:600,flexShrink:0}}>Use</button>
                <button onClick={()=>onDeleteTemplate(t.id)} style={{background:"none",border:"none",color:th.textDim,fontSize:16,cursor:"pointer",padding:"4px",flexShrink:0}}>🗑</button>
              </div>
            ))}
          </div>
        </>}
      </div>
    </div>
  );
}

// --- Task Form ----------------------------------------------------------------
function TaskFormPage({mode,initialData,categories,setCategories,settings,onSave,onClose,accent,th}){
  const[form,setForm]=useState({subtasks:[],...initialData,recur:initialData?.recur||"none"});
  const[showNewCat,setShowNewCat]=useState(false);
  const[editingStreak,setEditingStreak]=useState(false);
  const[streakInput,setStreakInput]=useState("");
  const[newCatName,setNewCatName]=useState("");
  const[newCatColor,setNewCatColor]=useState("#7B9EC9");
  const[newSubtask,setNewSubtask]=useState("");

  function addCategory(){ if(!newCatName.trim())return; const id="cust_"+Date.now(); setCategories(prev=>[...prev,{id,label:newCatName.trim(),color:newCatColor}]); setForm(f=>({...f,category:id})); setNewCatName(""); setShowNewCat(false); }
  function addSubtask(){ if(!newSubtask.trim())return; setForm(f=>({...f,subtasks:[...(f.subtasks||[]),{id:"s"+Date.now(),text:newSubtask.trim(),done:false}]})); setNewSubtask(""); }
  function removeSubtask(id){ setForm(f=>({...f,subtasks:(f.subtasks||[]).filter(s=>s.id!==id)})); }

  const estFinish = calcEstFinish(form.workTime,form.minutes);
  const cs = settings.theme==="light"?"light":"dark"; // colorScheme for inputs

  // Duration label: show hours format above 60 min
  const durLabel = fmtDuration(form.minutes);

  // Work time is past current time?
  const workTimePast = form.workTime && (()=>{
    const[h,m]=form.workTime.split(":").map(Number);
    const t=new Date(); t.setHours(h,m,0,0);
    return t<new Date();
  })();

  return(
    <PageTransition>
      <div style={{fontFamily:"'DM Sans',sans-serif",background:th.bg,minHeight:"100vh",color:th.text,maxWidth:430,margin:"0 auto",display:"flex",flexDirection:"column"}}>
        <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=Space+Mono:wght@400;700&display=swap" rel="stylesheet"/>
        <style>{`input,textarea{outline:none;font-family:'DM Sans',sans-serif;}*{box-sizing:border-box;}`}</style>
        <div style={{padding:"52px 22px 0",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <button onClick={onClose} style={{background:"none",border:"none",color:th.textMuted,fontSize:14,cursor:"pointer",fontFamily:"'DM Sans',sans-serif",padding:"4px"}}>← Cancel</button>
          <div style={{fontFamily:"'Space Mono',monospace",fontSize:11,color:th.textMuted,letterSpacing:1.5,textTransform:"uppercase"}}>{mode==="edit"?"Edit Task":"New Task"}</div>
          <div style={{width:70}}/>
        </div>
        <div style={{flex:1,overflowY:"auto",overflowX:"hidden",padding:"22px 22px 40px"}}>
          <div style={{fontSize:22,fontWeight:600,marginBottom:22,letterSpacing:-0.3}}>{mode==="edit"?"Edit task":"What's the task?"}</div>

          <FF label="Title" th={th}>
            <input value={form.title} onChange={e=>setForm(f=>({...f,title:e.target.value}))} placeholder="e.g. Study for exam"
              style={{width:"100%",background:th.surface,border:`1px solid ${th.border}`,borderRadius:12,padding:"14px 16px",color:th.text,fontSize:15}}
              onFocus={e=>e.target.style.borderColor=accent} onBlur={e=>e.target.style.borderColor=th.border}/>
          </FF>

          <FF label="Notes" th={th}>
            <textarea value={form.notes} onChange={e=>setForm(f=>({...f,notes:e.target.value}))} placeholder="Any extra details..."
              style={{width:"100%",background:th.surface,border:`1px solid ${th.border}`,borderRadius:12,padding:"13px 16px",color:th.text,fontSize:14,resize:"none",height:72}}
              onFocus={e=>e.target.style.borderColor=accent} onBlur={e=>e.target.style.borderColor=th.border}/>
          </FF>

          <FF label="Subtasks" th={th}>
            <div style={{display:"flex",flexDirection:"column",gap:6,marginBottom:8}}>
              {(form.subtasks||[]).map(s=>(
                <div key={s.id} style={{display:"flex",alignItems:"center",gap:8,background:th.surface,borderRadius:10,padding:"10px 12px",border:`1px solid ${th.border}`}}>
                  <span style={{width:13,height:13,borderRadius:"50%",border:`2px solid ${th.border2}`,display:"inline-block",flexShrink:0}}/>
                  <span style={{flex:1,fontSize:13,color:th.textMuted}}>{s.text}</span>
                  <button onClick={()=>removeSubtask(s.id)} style={{background:"none",border:"none",color:th.textDim,fontSize:14,cursor:"pointer",padding:"2px"}}>✕</button>
                </div>
              ))}
            </div>
            <div style={{display:"flex",gap:8}}>
              <input value={newSubtask} onChange={e=>setNewSubtask(e.target.value)} onKeyDown={e=>{ if(e.key==="Enter")addSubtask(); }} placeholder="Add a subtask…"
                style={{flex:1,background:th.surface,border:`1px solid ${th.border}`,borderRadius:10,padding:"10px 12px",color:th.text,fontSize:13}}
                onFocus={e=>e.target.style.borderColor=accent} onBlur={e=>e.target.style.borderColor=th.border}/>
              {newSubtask&&<button onClick={addSubtask} style={{background:accent+"22",border:`1px solid ${accent}44`,borderRadius:10,padding:"10px 14px",color:accent,fontSize:13,cursor:"pointer",fontFamily:"'DM Sans',sans-serif",fontWeight:600}}>Add</button>}
            </div>
          </FF>

          <FF label="Category" th={th}>
            <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
              {categories.map(cat=>(
                <button key={cat.id} onClick={()=>setForm(f=>({...f,category:cat.id}))}
                  style={{background:form.category===cat.id?cat.color+"25":th.surface,border:`1.5px solid ${form.category===cat.id?cat.color:th.border}`,borderRadius:10,padding:"8px 13px",color:form.category===cat.id?cat.color:th.textMuted,fontSize:13,cursor:"pointer",fontFamily:"'DM Sans',sans-serif",fontWeight:500,transition:"all 0.15s",display:"flex",alignItems:"center",gap:6}}>
                  <span style={{width:6,height:6,borderRadius:"50%",background:cat.color,display:"inline-block"}}/>{cat.label}
                </button>
              ))}
              {!showNewCat&&<button onClick={()=>setShowNewCat(true)} style={{background:"none",border:`1.5px dashed ${th.border2}`,borderRadius:10,padding:"8px 13px",color:th.textDim,fontSize:13,cursor:"pointer",fontFamily:"'DM Sans',sans-serif"}}>+ New</button>}
            </div>
            {showNewCat&&(
              <div style={{marginTop:12,background:th.surface,borderRadius:14,padding:"16px",border:`1px solid ${th.border}`}}>
                <input value={newCatName} onChange={e=>setNewCatName(e.target.value)} placeholder="Name..."
                  style={{width:"100%",background:th.bg,border:`1px solid ${th.border}`,borderRadius:10,padding:"12px 14px",color:th.text,fontSize:14,marginBottom:12}}/>
                <div style={{display:"flex",flexWrap:"wrap",gap:8,marginBottom:14}}>{SWATCH_COLORS.map(c=><button key={c} onClick={()=>setNewCatColor(c)} style={{width:26,height:26,borderRadius:"50%",background:c,border:`3px solid ${newCatColor===c?"#F0EDE8":"transparent"}`,cursor:"pointer",padding:0,transform:newCatColor===c?"scale(1.18)":"scale(1)",transition:"transform 0.12s"}}/>)}</div>
                <div style={{display:"flex",gap:8}}>
                  <button onClick={()=>{ setShowNewCat(false); setNewCatName(""); }} style={{flex:1,background:th.bg,border:`1px solid ${th.border}`,borderRadius:10,padding:"11px",color:th.textMuted,fontSize:13,cursor:"pointer",fontFamily:"'DM Sans',sans-serif"}}>Cancel</button>
                  <button onClick={addCategory} style={{flex:2,background:newCatColor,border:"none",borderRadius:10,padding:"11px",color:"#fff",fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:"'DM Sans',sans-serif"}}>Add "{newCatName||"Category"}"</button>
                </div>
              </div>
            )}
          </FF>

          <FF label="Recurring" th={th}>
            <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:8}}>
              {RECUR_OPTIONS.map(r=>(
                <button key={r.id} onClick={()=>setForm(f=>({...f,recur:r.id,recurDays:r.id==="custom"?(f.recurDays||[1,2,3,4,5]):f.recurDays}))}
                  style={{background:(form.recur||"none")===r.id?accent+"25":th.surface,border:`1.5px solid ${(form.recur||"none")===r.id?accent:th.border}`,borderRadius:10,padding:"8px 12px",color:(form.recur||"none")===r.id?accent:th.textMuted,fontSize:12,cursor:"pointer",fontFamily:"'DM Sans',sans-serif",fontWeight:500,transition:"all 0.15s",display:"flex",alignItems:"center",gap:5}}>
                  <span>{r.icon}</span><span>{r.label}</span>
                </button>
              ))}
            </div>
            {(form.recur||"none")==="custom"&&(
              <div style={{background:th.surface,borderRadius:12,padding:"12px 14px",border:`1px solid ${th.border}`,marginBottom:4}}>
                <div style={{fontSize:11,color:th.textDim,marginBottom:8}}>Select days:</div>
                <div style={{display:"flex",gap:6}}>
                  {DAY_LABELS.map((label,i)=>{
                    const active=(form.recurDays||[]).includes(i);
                    return(
                      <button key={i} onClick={()=>setForm(f=>{
                        const days=f.recurDays||[1,2,3,4,5];
                        return{...f,recurDays:active?days.filter(d=>d!==i):[...days,i].sort()};
                      })}
                        style={{flex:1,background:active?accent+"25":th.bg,border:`1.5px solid ${active?accent:th.border}`,borderRadius:8,padding:"8px 0",color:active?accent:th.textDim,fontSize:11,cursor:"pointer",fontFamily:"'DM Sans',sans-serif",fontWeight:active?700:400,transition:"all 0.15s",textAlign:"center"}}>
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
            {form.recur&&form.recur!=="none"&&mode==="edit"&&(
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",background:th.surface,borderRadius:10,padding:"10px 14px",border:`1px solid ${th.border}`}}>
                <div style={{display:"flex",alignItems:"center",gap:8}}>
                  <span style={{fontSize:14}}>↻</span>
                  <div>
                    <div style={{fontSize:13,fontWeight:500}}>Completed {form.recurStreak||0} time{(form.recurStreak||0)!==1?"s":""}</div>
                    <div style={{fontSize:11,color:th.textMuted,marginTop:1}}>Across all occurrences</div>
                  </div>
                </div>
                <div style={{display:"flex",gap:6,alignItems:"center"}}>
                  {editingStreak?(
                    <>
                      <input autoFocus type="number" min="0" value={streakInput}
                        onChange={e=>setStreakInput(e.target.value)}
                        onKeyDown={e=>{ if(e.key==="Enter"){ const n=parseInt(streakInput,10); if(!isNaN(n)&&n>=0) setForm(f=>({...f,recurStreak:n})); setEditingStreak(false); } if(e.key==="Escape") setEditingStreak(false); }}
                        style={{width:52,background:th.bg,border:`1.5px solid ${accent}`,borderRadius:8,padding:"5px 8px",color:th.text,fontSize:13,fontFamily:"'Space Mono',monospace",textAlign:"center"}}/>
                      <button onClick={()=>{ const n=parseInt(streakInput,10); if(!isNaN(n)&&n>=0) setForm(f=>({...f,recurStreak:n})); setEditingStreak(false); }}
                        style={{background:accent,border:"none",borderRadius:8,padding:"5px 10px",color:"#fff",fontSize:12,cursor:"pointer",fontFamily:"'DM Sans',sans-serif",fontWeight:600}}>✓</button>
                      <button onClick={()=>setEditingStreak(false)}
                        style={{background:"none",border:`1px solid ${th.border2}`,borderRadius:8,padding:"5px 8px",color:th.textMuted,fontSize:12,cursor:"pointer",fontFamily:"'DM Sans',sans-serif"}}>✕</button>
                    </>
                  ):(
                    <>
                      <button onClick={()=>{ setStreakInput(String(form.recurStreak||0)); setEditingStreak(true); }}
                        style={{background:accent+"22",border:`1px solid ${accent}44`,borderRadius:8,padding:"5px 10px",color:accent,fontSize:12,cursor:"pointer",fontFamily:"'DM Sans',sans-serif",fontWeight:600}}>
                        Edit
                      </button>
                      <button onClick={()=>setForm(f=>({...f,recurStreak:0}))}
                        style={{background:"#E07A5F22",border:"1px solid #E07A5F44",borderRadius:8,padding:"5px 10px",color:"#E07A5F",fontSize:12,cursor:"pointer",fontFamily:"'DM Sans',sans-serif",fontWeight:600}}>
                        Reset
                      </button>
                    </>
                  )}
                </div>
              </div>
            )}
          </FF>

          <FF label="Priority" th={th}>
            <div style={{display:"flex",gap:8}}>
              {[{id:"low",label:"Low",color:"#81B29A"},{id:"medium",label:"Medium",color:"#F2CC8F"},{id:"high",label:"High",color:accent}].map(p=>(
                <button key={p.id} onClick={()=>setForm(f=>({...f,priority:p.id}))}
                  style={{flex:1,background:form.priority===p.id?p.color+"25":th.surface,border:`1.5px solid ${form.priority===p.id?p.color:th.border}`,borderRadius:10,padding:"11px 0",color:form.priority===p.id?p.color:th.textMuted,fontSize:13,cursor:"pointer",fontFamily:"'DM Sans',sans-serif",fontWeight:500,transition:"all 0.15s"}}>{p.label}</button>
              ))}
            </div>
          </FF>

          {/* Duration -- max 4h, label switches to hours above 60m */}
          <FF label={`Focus Duration: ${durLabel}`} th={th}>
            <input type="range" min={5} max={240} step={5} value={form.minutes} onChange={e=>setForm(f=>({...f,minutes:Number(e.target.value)}))} style={{width:"100%",accentColor:accent,height:4}}/>
            <div style={{display:"flex",marginTop:6}}>
              {["5m","1h","2h","3h","4h"].map((l,i,a)=>(
                <div key={l} style={{flex:i===0?"1.04":"1",textAlign:i===0?"left":i===a.length-1?"right":"center",fontSize:10,color:th.textDim}}>{l}</div>
              ))}
            </div>
          </FF>

          {/* Date -- no min restriction */}
          <FF label="Date" th={th}>
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              <input type="date" value={form.date?new Date(form.date).toLocaleDateString("en-CA"):new Date().toISOString().split("T")[0]}
                onChange={e=>{ if(!e.target.value)return; const d=new Date(e.target.value+"T12:00:00"); setForm(f=>({...f,date:d.toDateString()})); }}
                style={{flex:1,background:th.surface,border:`1px solid ${th.border}`,borderRadius:12,padding:"11px 12px",color:th.text,fontSize:13,colorScheme:cs,minWidth:0}}/>
              {form.date&&form.date!==todayStr()&&(
                <button onClick={()=>setForm(f=>({...f,date:todayStr()}))}
                  style={{background:th.surface,border:`1px solid ${th.border}`,borderRadius:10,padding:"10px 12px",color:th.textMuted,fontSize:12,cursor:"pointer",fontFamily:"'DM Sans',sans-serif",whiteSpace:"nowrap",flexShrink:0}}>
                  Today ↩
                </button>
              )}
            </div>
          </FF>

          {/* Work time -- full width stacked */}
          <FF label="🕐 Work Time" th={th}>
            <div style={{position:"relative"}}>
              <input type="time" value={form.workTime||""} onChange={e=>setForm(f=>({...f,workTime:e.target.value}))}
                style={{width:"100%",background:th.surface,border:`1px solid ${th.border}`,borderRadius:12,padding:"12px 42px 12px 14px",color:"#7B9EC9",fontSize:15,colorScheme:cs}}/>
              {form.workTime&&<button onClick={()=>setForm(f=>({...f,workTime:""}))} style={{position:"absolute",right:12,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",color:th.textDim,fontSize:16,cursor:"pointer",padding:"4px",lineHeight:1}}>✕</button>}
            </div>
            {workTimePast&&(
              <button onClick={()=>setForm(f=>({...f,workTime:nowTimeStr()}))}
                style={{marginTop:8,width:"100%",background:"#7B9EC922",border:"1px solid #7B9EC944",borderRadius:10,padding:"10px",color:"#7B9EC9",fontSize:13,cursor:"pointer",fontFamily:"'DM Sans',sans-serif",fontWeight:600,textAlign:"center"}}>
                ⚠️ Time has passed -- tap to update to now
              </button>
            )}
            <div style={{fontSize:10,color:th.textDim,marginTop:5}}>When you plan to start</div>
          </FF>

          {/* Due time -- full width stacked */}
          <FF label="⏰ Due Time" th={th}>
            <div style={{position:"relative"}}>
              <input type="time" value={form.dueTime||""} onChange={e=>setForm(f=>({...f,dueTime:e.target.value}))}
                style={{width:"100%",background:th.surface,border:`1px solid ${th.border}`,borderRadius:12,padding:"12px 42px 12px 14px",color:"#E07A5F",fontSize:15,colorScheme:cs}}/>
              {form.dueTime&&<button onClick={()=>setForm(f=>({...f,dueTime:""}))} style={{position:"absolute",right:12,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",color:th.textDim,fontSize:16,cursor:"pointer",padding:"4px",lineHeight:1}}>✕</button>}
            </div>
            <div style={{fontSize:10,color:th.textDim,marginTop:5}}>Hard deadline</div>
          </FF>

          {/* Est finish */}
          <div style={{display:"flex",alignItems:"center",gap:10,background:th.surface,border:`1px solid ${th.border}`,borderRadius:12,padding:"13px 16px",marginBottom:20}}>
            <span style={{fontSize:16}}>🏁</span>
            <div><div style={{fontSize:11,color:th.textDim,letterSpacing:1,textTransform:"uppercase",fontFamily:"'Space Mono',monospace",marginBottom:2}}>Est. Finish</div><div style={{fontSize:14,fontWeight:500,color:accent}}>{estFinish}</div></div>
          </div>

          <button onClick={()=>onSave(form)}
            style={{width:"100%",background:accent,border:"none",borderRadius:14,padding:"17px",color:"#fff",fontSize:16,fontWeight:600,cursor:"pointer",fontFamily:"'DM Sans',sans-serif",boxShadow:`0 6px 24px ${accent}40`}}
            onMouseDown={e=>{ e.currentTarget.style.opacity="0.85"; e.currentTarget.style.transform="scale(0.98)"; }}
            onMouseUp={e=>{ e.currentTarget.style.opacity="1"; e.currentTarget.style.transform="scale(1)"; }}>
            {mode==="edit"?"Save Changes":"Add Task"}
          </button>
          {mode==="edit"&&<button onClick={onClose} style={{width:"100%",background:"none",border:`1.5px solid ${accent}25`,borderRadius:14,padding:"15px",color:accent+"88",fontSize:14,cursor:"pointer",fontFamily:"'DM Sans',sans-serif",marginTop:10}}>Cancel without saving</button>}
        </div>
      </div>
    </PageTransition>
  );
}
function FF({label,children,th}){
  return(
    <div style={{marginBottom:20}}>
      <div style={{fontSize:11,color:th?.textDim||"#444",letterSpacing:1.2,textTransform:"uppercase",fontFamily:"'Space Mono',monospace",marginBottom:9}}>{label}</div>
      {children}
    </div>
  );
}

// --- Timer Page ---------------------------------------------------------------
function TimerPage({task,categories,accent,timerSound,countdownMode,th,onBack,onSavePartial,onDone}){
  const totalSecs = task.minutes*60;
  const[remaining,  setRemaining] =useState(totalSecs);
  const[running,    setRunning]   =useState(false);
  const[startedAt,  setStartedAt] =useState(null);
  const[focusLock,  setFocusLock] =useState(false);  // NOT auto-enabled on start
  const[finished,   setFinished]  =useState(false);
  const[showBurst,    setShowBurst]    =useState(false);
  const[localWorkTime,setLocalWorkTime]=useState(task.workTime||"");
  const sessionStart    =useRef(null);
  const wakeLockRef     =useRef(null);
  const[showExitPrompt, setShowExitPrompt]=useState(false);

  // -- Wake Lock -- keep screen on while timer is running ---------------------
  useEffect(()=>{
    async function acquireWakeLock(){
      if(!("wakeLock" in navigator)) return;
      try{
        wakeLockRef.current=await navigator.wakeLock.request("screen");
      }catch(e){}
    }
    function releaseWakeLock(){
      if(wakeLockRef.current){ wakeLockRef.current.release().catch(()=>{}); wakeLockRef.current=null; }
    }
    if(running){ acquireWakeLock(); }
    else { releaseWakeLock(); }
    return()=>releaseWakeLock();
  },[running]);
  const cat  = getCat(task.category,categories);
  const pct  = 1-remaining/totalSecs;
  const r=100, circ=2*Math.PI*r;
  const BURST_COLORS=[cat.color,accent,"#81B29A","#F2CC8F","#7B9EC9"];
  // countdownMode comes from settings prop

  useEffect(()=>{
    if(!running) return;
    if(!startedAt) setStartedAt(Date.now());
    if(!sessionStart.current) sessionStart.current=Date.now();
    // Auto-stamp work time if not set
    if(!localWorkTime) setLocalWorkTime(nowTimeStr());
    const id=setInterval(()=>setRemaining(p=>{
      if(p<=1){
        clearInterval(id); setRunning(false); setFinished(true);
        setShowBurst(true); haptic("success");
        if(timerSound&&timerSound!=="none") playTimerSound(timerSound);
        setTimeout(()=>setShowBurst(false),3500);
        return 0;
      }
      return p-1;
    }),1000);
    return()=>clearInterval(id);
  },[running]);

  // Format countdown based on mode
  function fmtCountdown(secs){
    if(countdownMode==="minutes"){
      return `${Math.ceil(secs/60)}m`;
    } else if(countdownMode==="hh:mm:ss"){
      const h=Math.floor(secs/3600), m=Math.floor((secs%3600)/60), s=secs%60;
      return `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`;
    } else {
      // default mm:ss
      return `${String(Math.floor(secs/60)).padStart(2,"0")}:${String(secs%60).padStart(2,"0")}`;
    }
  }

  const countdownStr = fmtCountdown(remaining);
  const elapsed = totalSecs-remaining;
  function getActualMins(){ if(!sessionStart.current) return task.minutes; return Math.max(1,Math.round((Date.now()-sessionStart.current)/60000)); }

  // estFinish recalculates live: uses localWorkTime (auto-set on start) + remaining
  const estFinishStr=(()=>{
    if(localWorkTime){
      const[h,m]=localWorkTime.split(":").map(Number);
      const b=new Date(); b.setHours(h,m,0,0);
      // base + full duration = when task will finish
      const f=new Date(b.getTime()+task.minutes*60000);
      return`${f.getHours()%12||12}:${String(f.getMinutes()).padStart(2,"0")} ${f.getHours()>=12?"PM":"AM"}`;
    }
    // fallback: now + remaining
    const f=new Date(Date.now()+remaining*1000);
    return`${f.getHours()%12||12}:${String(f.getMinutes()).padStart(2,"0")} ${f.getHours()>=12?"PM":"AM"}`;
  })();

  const timerFontSize = countdownMode==="hh:mm:ss" ? (focusLock&&running?36:32) : (focusLock&&running?52:42);

  // -- Alarm screen -- full replacement, no scroll, nothing underneath ----------
  if(showBurst||finished) return(
    <div style={{
      position:"fixed",top:0,left:0,right:0,bottom:0,
      width:"100vw",height:"100vh",
      background:`linear-gradient(160deg,#06060C 0%,${cat.color}28 45%,#06060C 100%)`,
      display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",
      overflow:"hidden",touchAction:"none",userSelect:"none",
      fontFamily:"'DM Sans',sans-serif",color:"#F0EDE8",
      zIndex:9999,
    }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;600;700&family=Space+Mono:wght@700&display=swap" rel="stylesheet"/>
      <style>{`
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.45}}
        @keyframes burstRipple{0%{transform:scale(0);opacity:0.85}100%{transform:scale(6);opacity:0}}
        @keyframes alarmIn{0%{opacity:0;transform:scale(0.88)}60%{transform:scale(1.04)}100%{opacity:1;transform:scale(1)}}
        @keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
      `}</style>

      {/* Radial glow */}
      <div style={{position:"absolute",inset:0,background:`radial-gradient(circle at 50% 42%,${cat.color}40 0%,transparent 60%)`,pointerEvents:"none"}}/>

      {/* Ripple rings */}
      {[0,0.4,0.8,1.2,1.6,2.0].map((delay,i)=>(
        <div key={i} style={{position:"absolute",width:"60vw",height:"60vw",maxWidth:280,maxHeight:280,borderRadius:"50%",border:`1.5px solid ${BURST_COLORS[i%BURST_COLORS.length]}55`,animation:`burstRipple 3s cubic-bezier(0,0.5,0.3,1) ${delay}s infinite`,opacity:0,pointerEvents:"none"}}/>
      ))}

      {/* Confetti dots */}
      {Array.from({length:30}).map((_,i)=>{
        const angle=(i/30)*360, dist=Math.min(window.innerWidth,window.innerHeight)*0.35+Math.random()*80;
        const x=Math.cos(angle*Math.PI/180)*dist, y=Math.sin(angle*Math.PI/180)*dist;
        return(<div key={i} style={{position:"absolute",width:10,height:10,borderRadius:"50%",background:BURST_COLORS[i%BURST_COLORS.length],transform:`translate(${x}px,${y}px)`,animation:`burstRipple 1.6s ease ${(i%8)*0.08}s forwards`,opacity:0,pointerEvents:"none"}}/>);
      })}

      {/* Main content -- vertically centered, fixed size, no scroll */}
      <div style={{position:"relative",zIndex:1,textAlign:"center",padding:"0 32px",width:"100%",maxWidth:400,animation:"alarmIn 0.5s cubic-bezier(0.34,1.2,0.64,1) forwards"}}>
        {/* Big checkmark */}
        <div style={{fontSize:"clamp(72px,20vw,100px)",lineHeight:1,marginBottom:"clamp(12px,3vh,20px)",filter:`drop-shadow(0 0 40px ${cat.color})`,animation:"pulse 1.4s ease infinite"}}>✓</div>

        {/* Label */}
        <div style={{fontFamily:"'Space Mono',monospace",fontSize:"clamp(10px,2.5vw,13px)",color:cat.color,letterSpacing:"0.2em",marginBottom:"clamp(8px,2vh,14px)"}}>SESSION COMPLETE</div>

        {/* Task name */}
        <div style={{fontSize:"clamp(20px,5vw,28px)",fontWeight:700,letterSpacing:-0.5,marginBottom:"clamp(6px,1.5vh,10px)",lineHeight:1.2,wordBreak:"break-word"}}>{task.title}</div>

        {/* Meta */}
        <div style={{fontSize:"clamp(12px,3vw,15px)",color:"#777",marginBottom:"clamp(28px,6vh,44px)"}}>
          {fmtDuration(task.minutes)} · <span style={{color:cat.color}}>{cat.label}</span>
        </div>

        {/* CTA */}
        <button onClick={()=>onDone(getActualMins())}
          style={{background:cat.color,border:"none",borderRadius:18,padding:"clamp(14px,3.5vh,20px) clamp(32px,10vw,56px)",color:"#fff",fontSize:"clamp(15px,4vw,18px)",fontWeight:700,cursor:"pointer",fontFamily:"'DM Sans',sans-serif",boxShadow:`0 8px 40px ${cat.color}70`,letterSpacing:0.3,width:"100%",maxWidth:300}}>
          ✓ Mark Complete
        </button>
      </div>
    </div>
  );

  // Ring size based on viewport -- scales to fill nicely
  const ringSize = Math.min(Math.round(Math.min(window.innerWidth,window.innerHeight)*0.52),300);
  const ringR    = ringSize/2 - 8;
  const ringCirc = 2*Math.PI*ringR;
  const ringDash = ringCirc*pct;

  return(
    <div style={{
      position:"fixed",top:0,left:0,right:0,bottom:0,
      width:"100vw",height:"100vh",
      fontFamily:"'DM Sans',sans-serif",
      background:focusLock&&running?"#080810":th.bg,
      color:th.text,
      display:"flex",flexDirection:"column",
      transition:"background 0.6s",
      overflow:"hidden",
      zIndex:1,
      animation:"timerEnter 0.55s cubic-bezier(0.22,1,0.36,1) forwards",
    }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=Space+Mono:wght@400;700&display=swap" rel="stylesheet"/>
      <style>{`
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.45}}
        @keyframes fadeIn{from{opacity:0}to{opacity:1}}
        @keyframes timerEnter{
          0%  { opacity:0; clip-path:circle(0% at 90% 85%); transform:scale(0.96); }
          40% { opacity:1; }
          100%{ opacity:1; clip-path:circle(150% at 50% 50%); transform:scale(1); }
        }
        @keyframes timerContentIn{
          0%  { opacity:0; transform:translateY(20px) scale(0.97); }
          100%{ opacity:1; transform:translateY(0) scale(1); }
        }
        .timer-content{ animation: timerContentIn 0.45s cubic-bezier(0.22,1,0.36,1) 0.25s both; }

        /* Edge glow -- slides in from off-screen when running */

      `}</style>



      {/* Header */}
      <div style={{
        padding:"env(safe-area-inset-top,52px) 22px 0",
        paddingTop:"max(env(safe-area-inset-top),52px)",
        display:"flex",alignItems:"center",justifyContent:"space-between",
        opacity:focusLock&&running?0:1,transition:"opacity 0.4s",
        pointerEvents:focusLock&&running?"none":"auto",
        flexShrink:0,
      }}>
        <button onClick={()=>{ if(elapsed>0) setShowExitPrompt(true); else onBack(); }} style={{background:"none",border:"none",color:th.textDim,fontSize:15,cursor:"pointer",fontFamily:"'DM Sans',sans-serif",padding:"8px"}}>← Back</button>
        <button onClick={()=>setFocusLock(p=>!p)}
          style={{background:focusLock?th.surface:"none",border:`1px solid ${focusLock?cat.color+"44":th.border2}`,borderRadius:20,padding:"8px 16px",color:focusLock?cat.color:th.textMuted,fontSize:13,cursor:"pointer",fontFamily:"'DM Sans',sans-serif",display:"flex",alignItems:"center",gap:6,transition:"all 0.2s"}}>
          {focusLock?"🔒":"🔓"}{focusLock?" Focus On":" Focus Lock"}
        </button>
      </div>

      {/* Focus lock overlay bar */}
      {focusLock&&running&&(
        <div style={{position:"absolute",top:0,left:0,right:0,padding:"max(env(safe-area-inset-top),16px) 22px 16px",display:"flex",justifyContent:"space-between",alignItems:"center",zIndex:10,animation:"fadeIn 0.3s ease"}}>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <span style={{fontSize:15,color:cat.color}}>🔒</span>
            <span style={{fontSize:12,color:th.textDim,fontFamily:"'Space Mono',monospace",letterSpacing:1}}>FOCUS MODE</span>
          </div>
          <button onClick={()=>setFocusLock(false)} style={{background:"none",border:`1px solid ${th.border2}`,borderRadius:12,padding:"6px 14px",color:th.textMuted,fontSize:13,cursor:"pointer",fontFamily:"'DM Sans',sans-serif"}}>Unlock</button>
        </div>
      )}

      {/* Main content -- fills remaining height */}
      <div className="timer-content" style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"0 24px 24px",gap:0,minHeight:0}}>

        {/* Category + title */}
        <div style={{opacity:focusLock&&running?0.2:1,transition:"opacity 0.4s",textAlign:"center",marginBottom:focusLock&&running?12:20,flexShrink:0}}>
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6,justifyContent:"center"}}>
            <span style={{width:8,height:8,borderRadius:"50%",background:cat.color,display:"inline-block"}}/>
            <span style={{fontSize:12,color:th.textDim,textTransform:"uppercase",letterSpacing:1.5,fontFamily:"'Space Mono',monospace"}}>{cat.label}</span>
          </div>
          <div style={{fontSize:"clamp(16px,4.5vw,22px)",fontWeight:600,letterSpacing:-0.3,maxWidth:"80vw",wordBreak:"break-word",lineHeight:1.3}}>{task.title}</div>
          {task.dueTime&&!(focusLock&&running)&&(
            <div style={{display:"inline-flex",alignItems:"center",gap:5,marginTop:10,background:"#E07A5F18",border:"1px solid #E07A5F33",borderRadius:20,padding:"5px 14px"}}>
              <span style={{fontSize:12}}>⏰</span>
              <span style={{fontSize:12,color:"#E07A5F",fontFamily:"'Space Mono',monospace"}}>Due {fmtTime(task.dueTime)}</span>
            </div>
          )}
        </div>

        {/* Ring -- scales to screen */}
        <div style={{position:"relative",width:ringSize,height:ringSize,marginBottom:16,flexShrink:0}}>
          <svg width={ringSize} height={ringSize} style={{transform:"rotate(-90deg)"}}>
            <circle cx={ringSize/2} cy={ringSize/2} r={ringR} fill="none" stroke={th.surface} strokeWidth="14"/>
            <circle cx={ringSize/2} cy={ringSize/2} r={ringR} fill="none" stroke={cat.color} strokeWidth="14" strokeLinecap="round"
              strokeDasharray={`${ringDash} ${ringCirc}`}
              style={{transition:"stroke-dasharray 1s linear",filter:`drop-shadow(0 0 ${focusLock&&running?24:16}px ${cat.color}${focusLock&&running?"99":"66"})`}}/>
          </svg>
          <div style={{position:"absolute",inset:0,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center"}}>
            <div style={{
              fontFamily:"'Space Mono',monospace",
              fontSize:countdownMode==="hh:mm:ss"?"clamp(22px,7vw,36px)":"clamp(36px,12vw,60px)",
              fontWeight:700,
              animation:running?"pulse 2s infinite":"none",
              letterSpacing:2,
              textAlign:"center",
              lineHeight:1,
            }}>{countdownStr}</div>
            <div style={{fontSize:"clamp(9px,2.5vw,12px)",color:th.textDim,marginTop:8,letterSpacing:1}}>{fmtDuration(task.minutes)} session</div>
          </div>
        </div>

        {/* Stats row */}
        {!(focusLock&&running)&&(
          <>
            <div style={{display:"flex",gap:0,marginBottom:10,background:th.surface,borderRadius:14,overflow:"hidden",border:`1px solid ${th.border}`,width:"100%",maxWidth:400,flexShrink:0}}>
              {[
                {label:"ELAPSED",    val:fmtCountdown(elapsed),     color:cat.color},
                {label:"DONE",       val:`${Math.round(pct*100)}%`, color:th.textMuted},
                {label:"EST. FINISH",val:estFinishStr,               color:accent},
              ].map((s,i)=>(
                <div key={s.label} style={{flex:1,textAlign:"center",padding:"12px 6px",borderRight:i<2?`1px solid ${th.border}`:"none"}}>
                  <div style={{fontFamily:"'Space Mono',monospace",fontSize:"clamp(10px,2.5vw,12px)",color:s.color,fontWeight:700}}>{s.val}</div>
                  <div style={{fontSize:"clamp(8px,2vw,10px)",color:th.textDim,letterSpacing:0.8,marginTop:3}}>{s.label}</div>
                </div>
              ))}
            </div>
            {/* Work time row -- shows current start time with update button */}
            <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:10,marginBottom:14,flexShrink:0}}>
              <span style={{fontSize:12,color:th.textMuted}}>
                🕐 Start: <span style={{color:"#7B9EC9",fontFamily:"'Space Mono',monospace"}}>{localWorkTime?fmtTime(localWorkTime):"not set"}</span>
              </span>
              <button onClick={()=>setLocalWorkTime(nowTimeStr())}
                style={{background:"#7B9EC922",border:"1px solid #7B9EC944",borderRadius:8,padding:"4px 10px",color:"#7B9EC9",fontSize:11,cursor:"pointer",fontFamily:"'DM Sans',sans-serif",fontWeight:600}}>
                {localWorkTime?"Started late? Update":"Set to now"}
              </button>
            </div>
          </>
        )}

        {/* Buttons */}
        <div style={{display:"flex",gap:12,width:"100%",maxWidth:400,flexShrink:0}}>
          {!finished&&(
            <button onClick={()=>setRunning(p=>!p)}
              style={{flex:1,background:running?th.surface:cat.color,border:running?`1.5px solid ${th.border}`:"none",borderRadius:14,padding:"17px",color:running?th.text:"#fff",fontSize:17,fontWeight:600,cursor:"pointer",fontFamily:"'DM Sans',sans-serif",transition:"all 0.22s",boxShadow:running?"none":`0 6px 24px ${cat.color}55`}}>
              {running?"Pause":remaining===totalSecs?"Start":"Resume"}
            </button>
          )}
          {remaining<totalSecs&&!finished&&!(focusLock&&running)&&(
            <button onClick={()=>{ setRemaining(totalSecs); setRunning(false); setStartedAt(null); sessionStart.current=null; }}
              style={{background:th.surface,border:`1.5px solid ${th.border}`,borderRadius:14,padding:"17px 20px",color:th.textDim,fontSize:15,cursor:"pointer",fontFamily:"'DM Sans',sans-serif"}}>↺</button>
          )}
        </div>
        {pct>0&&!finished&&!(focusLock&&running)&&(
          <button onClick={()=>onDone(getActualMins())}
            style={{marginTop:12,width:"100%",maxWidth:400,background:"none",border:"1.5px solid #81B29A33",borderRadius:14,padding:"15px",color:"#81B29A",fontSize:15,cursor:"pointer",fontFamily:"'DM Sans',sans-serif",fontWeight:600,flexShrink:0}}>
            ✓ Mark as Complete Early
          </button>
        )}
      </div>

      {/* Exit prompt -- shown when back is pressed and time has been spent */}
      {showExitPrompt&&(
        <div style={{position:"fixed",inset:0,zIndex:100,display:"flex",alignItems:"center",justifyContent:"center",background:"rgba(0,0,0,0.7)",backdropFilter:"blur(8px)"}}
          onClick={()=>setShowExitPrompt(false)}>
          <div onClick={e=>e.stopPropagation()}
            style={{background:th.surface,borderRadius:22,padding:"28px 24px",width:"min(300px,88vw)",textAlign:"center",boxShadow:"0 24px 64px rgba(0,0,0,0.7)",border:`1px solid ${th.border2}`,animation:"fadeIn 0.2s ease"}}>
            <div style={{fontSize:36,marginBottom:12}}>⏱</div>
            <div style={{fontSize:16,fontWeight:700,marginBottom:8}}>Save your progress?</div>
            <div style={{fontSize:13,color:th.textMuted,marginBottom:8,lineHeight:1.6}}>
              You've spent <span style={{color:cat.color,fontWeight:600}}>{fmtDuration(getActualMins())}</span> on this session.
            </div>
            <div style={{fontSize:12,color:th.textDim,marginBottom:24}}>Save it to your focus log or discard.</div>
            <div style={{display:"flex",flexDirection:"column",gap:10}}>
              <button onClick={()=>{ onDone(getActualMins()); }}
                style={{background:cat.color,border:"none",borderRadius:12,padding:"14px",color:"#fff",fontSize:14,cursor:"pointer",fontFamily:"'DM Sans',sans-serif",fontWeight:600,boxShadow:`0 4px 18px ${cat.color}55`}}>
                ✓ Save {fmtDuration(getActualMins())} & mark complete
              </button>
              <button onClick={()=>{ onSavePartial(getActualMins()); }}
                style={{background:th.surface2,border:`1px solid ${th.border2}`,borderRadius:12,padding:"14px",color:th.text,fontSize:14,cursor:"pointer",fontFamily:"'DM Sans',sans-serif",fontWeight:500}}>
                💾 Save time, keep task incomplete
              </button>
              <button onClick={onBack}
                style={{background:"none",border:"none",color:th.textMuted,fontSize:13,cursor:"pointer",fontFamily:"'DM Sans',sans-serif",padding:"6px"}}>
                Discard & exit
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// --- Onboarding ---------------------------------------------------------------
const SLIDES=[
  {icon:"🎯",title:"Welcome to TaskFlow",body:"Your personal task manager -- built to keep you focused, streaking, and on top of everything. Here's a quick tour.",color:"#E07A5F"},
  {icon:"⭕",title:"The Progress Ring",body:"The big circle fills as you complete today's tasks. The number is how many you have left. Get it to zero for a 🎉.",color:"#81B29A"},
  {icon:"✅",title:"Adding Tasks",body:"Tap + for a full task form. Or use the quick-add bar -- type a title and hit Enter. Your new task appears instantly.",color:"#7B9EC9"},
  {icon:"👆",title:"Swipe Gestures",body:"Swipe right on a task to instantly start the timer. Swipe left to open the action menu. Much faster than tapping ⋯.",color:"#F2CC8F"},
  {icon:"⚡",title:"Sort & Categories",body:"Tap the Sort pill to sort by Priority, Work Time, Duration, and more. Hit Edit inside to manage categories.",color:"#C9A7EB"},
  {icon:"↑",title:"Today Sheet",body:"Tap 'see all' or swipe up on the handle at the bottom to open the full today view -- overdue, incomplete, done, and tomorrow.",color:"#E07A5F"},
  {icon:"▶",title:"Focus Timer",body:"Tap ▶ on any task to start a countdown. Enable Focus Lock to go distraction-free. When it hits zero, a burst animation fires.",color:"#81B29A"},
  {icon:"↻",title:"Recurring Tasks",body:"Set tasks to repeat Daily, Weekdays, Weekly, or Monthly. They auto-appear each time so you never re-add habits.",color:"#7B9EC9"},
  {icon:"🔥",title:"Streaks & Stats",body:"Complete all today's tasks to grow your streak. Settings → Stats shows focus time, accuracy, and category breakdowns.",color:"#F2CC8F"},
  {icon:"🚀",title:"You're all set",body:"Everything saves automatically. Your tasks, streak, and settings will be here every time you open the app.",color:"#81B29A"},
];
function Onboarding({accent,th,onDone}){
  const[idx,setIdx]=useState(0);
  const[key,setKey]=useState(0);
  const slide=SLIDES[idx];
  const isLast=idx===SLIDES.length-1;
  function go(i){ setKey(k=>k+1); setIdx(i); }
  return(
    <div style={{position:"fixed",inset:0,zIndex:500,background:"#0A0A0E",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"0 32px",fontFamily:"'DM Sans',sans-serif",color:"#F0EDE8",overflowX:"hidden"}}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&family=Space+Mono:wght@700&display=swap" rel="stylesheet"/>
      <style>{`@keyframes sli{from{opacity:0;transform:translateX(24px)}to{opacity:1;transform:translateX(0)}}@keyframes oP{0%,100%{transform:scale(1)}50%{transform:scale(1.06)}}`}</style>
      <button onClick={onDone} style={{position:"absolute",top:52,right:24,background:"none",border:"none",color:"#444",fontSize:13,cursor:"pointer",fontFamily:"'DM Sans',sans-serif",padding:"4px"}}>Skip</button>
      <div style={{position:"absolute",top:58,left:"50%",transform:"translateX(-50%)",display:"flex",gap:6}}>
        {SLIDES.map((_,i)=>(
          <div key={i} onClick={()=>go(i)} style={{width:i===idx?20:6,height:6,borderRadius:3,background:i===idx?slide.color:"#252530",transition:"all 0.3s cubic-bezier(0.34,1.56,0.64,1)",cursor:"pointer"}}/>
        ))}
      </div>
      <div key={key} style={{display:"flex",flexDirection:"column",alignItems:"center",textAlign:"center",animation:"sli 0.35s cubic-bezier(0.34,1.2,0.64,1)"}}>
        <div style={{fontSize:76,marginBottom:26,filter:`drop-shadow(0 0 24px ${slide.color}66)`,animation:"oP 3s ease infinite"}}>{slide.icon}</div>
        <div style={{fontFamily:"'Space Mono',monospace",fontSize:11,color:"#444",letterSpacing:1.5,marginBottom:12}}>{idx+1} / {SLIDES.length}</div>
        <div style={{fontSize:23,fontWeight:700,letterSpacing:-0.5,marginBottom:14,color:"#F0EDE8",lineHeight:1.2}}>{slide.title}</div>
        <div style={{fontSize:15,color:"#888",lineHeight:1.7,maxWidth:310,marginBottom:44}}>{slide.body}</div>
      </div>
      <div style={{position:"absolute",bottom:52,left:0,right:0,padding:"0 32px",display:"flex",alignItems:"center",gap:12}}>
        {idx>0?<button onClick={()=>go(idx-1)} style={{background:"#1A1A22",border:"1px solid #252530",borderRadius:14,padding:"15px 22px",color:"#555",fontSize:14,cursor:"pointer",fontFamily:"'DM Sans',sans-serif"}}>← Back</button>:<div style={{width:80}}/>}
        <button onClick={()=>{ if(isLast)onDone(); else go(idx+1); }}
          style={{flex:1,background:isLast?slide.color:"#1A1A22",border:`1.5px solid ${isLast?slide.color:slide.color+"44"}`,borderRadius:14,padding:"16px",color:isLast?"#fff":slide.color,fontSize:15,fontWeight:600,cursor:"pointer",fontFamily:"'DM Sans',sans-serif",boxShadow:isLast?`0 6px 28px ${slide.color}55`:"none",transition:"all 0.25s"}}>
          {isLast?"Let's go! 🚀":"Next →"}
        </button>
      </div>
    </div>
  );
}
