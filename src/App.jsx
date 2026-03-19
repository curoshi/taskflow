import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";

// ─── Constants ────────────────────────────────────────────────────────────────
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
  { id:"none",     label:"None" },
  { id:"daily",    label:"Daily" },
  { id:"weekdays", label:"Weekdays" },
  { id:"weekly",   label:"Weekly" },
  { id:"monthly",  label:"Monthly" },
];
const AUDIO_OPTIONS = [
  { id:"none",      label:"None",         icon:"🔇" },
  { id:"chime",     label:"Chime",        icon:"🎵" },
  { id:"bell",      label:"Bell",         icon:"🔔" },
  { id:"beeps",     label:"3 Beeps",      icon:"📳" },
  { id:"fanfare",   label:"Fanfare",      icon:"🎺" },
  { id:"zen",       label:"Zen Bowl",     icon:"🧘" },
  { id:"success",   label:"Success",      icon:"✨" },
  { id:"radar",     label:"Radar Ping",   icon:"📡" },
  { id:"marimba",   label:"Marimba",      icon:"🎶" },
];
const SWATCH_COLORS = ["#E07A5F","#81B29A","#F2CC8F","#7B9EC9","#C9A7EB","#F4A261","#E76F51","#2A9D8F","#E9C46A","#264653","#A8DADC","#E63946","#457B9D","#6A4C93"];
const ACCENT_OPTS   = ["#E07A5F","#81B29A","#7B9EC9","#C9A7EB","#F4A261","#E9C46A","#2A9D8F","#E63946"];

// ─── Themes ───────────────────────────────────────────────────────────────────
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

// ─── Helpers ──────────────────────────────────────────────────────────────────
function daysFromNow(n){ const d=new Date(); d.setDate(d.getDate()+n); return d.toDateString(); }
function todayStr()    { return new Date().toDateString(); }
function tomorrowStr() { return daysFromNow(1); }
function yesterdayStr(){ return daysFromNow(-1); }
function getCat(id,cats){ return (cats||DEFAULT_CATEGORIES).find(c=>c.id===id)||DEFAULT_CATEGORIES[4]; }
function fmtTime(t){
  if(!t)return"";
  const[h,m]=t.split(":").map(Number);
  return`${h%12||12}:${String(m).padStart(2,"0")} ${h>=12?"PM":"AM"}`;
}
function fmtDateLabel(d){
  if(d===todayStr())return"Today";
  if(d===tomorrowStr())return"Tomorrow";
  if(d===yesterdayStr())return"Yesterday";
  return new Date(d).toLocaleDateString("en-US",{weekday:"long",month:"short",day:"numeric"});
}
function calcEstFinish(workTime,minutes){
  const base=workTime?(()=>{const[h,m]=workTime.split(":").map(Number);const b=new Date();b.setHours(h,m,0,0);return b;})():new Date();
  const fin=new Date(base.getTime()+minutes*60000);
  const fh=fin.getHours(),fm=fin.getMinutes();
  const label=`${fh%12||12}:${String(fm).padStart(2,"0")} ${fh>=12?"PM":"AM"}`;
  return workTime?label:`~${label} (if started now)`;
}
function shouldRecurToday(task,dateStr){
  if(!task.recur||task.recur==="none")return false;
  const d=new Date(dateStr),orig=new Date(task.date);
  if(task.recur==="daily")return true;
  if(task.recur==="weekdays"){const day=d.getDay();return day>=1&&day<=5;}
  if(task.recur==="weekly")return d.getDay()===orig.getDay();
  if(task.recur==="monthly")return d.getDate()===orig.getDate();
  return false;
}
function buildSortOptions(categories,hiddenSorts=[]){
  const base=BASE_SORT_OPTIONS.filter(s=>!hiddenSorts.includes(s.id));
  const cats=categories.map(c=>({id:"cat_"+c.id,label:c.label,icon:"●",color:c.color,isCat:true,catId:c.id})).filter(s=>!hiddenSorts.includes(s.id));
  return[...base,...cats];
}

// ─── Haptics ──────────────────────────────────────────────────────────────────
function haptic(type="light"){
  if(!navigator.vibrate)return;
  if(type==="light")navigator.vibrate(10);
  else if(type==="medium")navigator.vibrate(25);
  else if(type==="heavy")navigator.vibrate(50);
  else if(type==="success")navigator.vibrate([10,50,10]);
  else if(type==="error")navigator.vibrate([30,20,30]);
  else if(type==="double")navigator.vibrate([15,30,15]);
}

// ─── Audio ────────────────────────────────────────────────────────────────────
function playTimerSound(type){
  try{
    const ctx=new(window.AudioContext||window.webkitAudioContext)();
    const play=(freq,start,dur,wave="sine",gain=0.4)=>{
      const o=ctx.createOscillator(),g=ctx.createGain();
      o.connect(g);g.connect(ctx.destination);
      o.type=wave;o.frequency.setValueAtTime(freq,ctx.currentTime+start);
      g.gain.setValueAtTime(0,ctx.currentTime+start);
      g.gain.linearRampToValueAtTime(gain,ctx.currentTime+start+0.02);
      g.gain.linearRampToValueAtTime(0,ctx.currentTime+start+dur);
      o.start(ctx.currentTime+start);o.stop(ctx.currentTime+start+dur+0.05);
    };
    if(type==="chime")    {play(880,0,0.6);play(1108,0.3,0.5);play(1320,0.6,0.8);}
    else if(type==="bell"){play(1046,0,1.4,"sine",0.5);play(1318,0,1.2,"sine",0.3);play(523,0,1.4,"sine",0.15);}
    else if(type==="beeps"){play(880,0,0.12);play(880,0.2,0.12);play(880,0.4,0.12);}
    else if(type==="fanfare"){[[523,0],[659,0.1],[784,0.2],[1046,0.3],[784,0.5],[1046,0.65]].forEach(([f,t])=>play(f,t,0.18));}
    else if(type==="zen"){play(432,0,2.0,"sine",0.3);play(648,0.05,1.8,"sine",0.15);play(324,0.1,2.2,"sine",0.1);}
    else if(type==="success"){play(523,0,0.15);play(659,0.15,0.15);play(784,0.3,0.15);play(1046,0.45,0.4);}
    else if(type==="radar"){
      for(let i=0;i<4;i++){play(1200+i*30,i*0.35,0.08,"sine",0.25);}
    }
    else if(type==="marimba"){
      [[784,0],[988,0.12],[1175,0.24],[1568,0.36],[1175,0.5],[1568,0.64]].forEach(([f,t])=>play(f,t,0.14,"sine",0.35));
    }
  }catch(e){}
}

// ─── Initial data ─────────────────────────────────────────────────────────────
const now=Date.now();
const INITIAL_TASKS=[
  {id:1,title:"Review notes",      category:"learning",priority:"medium",minutes:30,workTime:"15:00",dueTime:"16:00",notes:"Chapter 4 & 5",           done:false,date:daysFromNow(0),createdAt:now-6e5,recur:"none",  subtasks:[],manualOrder:0,actualMinutes:0},
  {id:2,title:"Morning run",        category:"health",  priority:"high",  minutes:45,workTime:"07:00",dueTime:"",     notes:"",                         done:true, date:daysFromNow(0),createdAt:now-7e5,recur:"daily",  subtasks:[],manualOrder:1,actualMinutes:42},
  {id:3,title:"Read emails",        category:"work",    priority:"low",   minutes:15,workTime:"09:00",dueTime:"10:00",notes:"Reply to pending ones",    done:false,date:daysFromNow(0),createdAt:now-8e5,recur:"weekdays",subtasks:[{id:"s1",text:"Inbox zero",done:false},{id:"s2",text:"Reply to Alex",done:true}],manualOrder:2,actualMinutes:0},
  {id:4,title:"Study chapter 6",    category:"learning",priority:"high",  minutes:60,workTime:"16:00",dueTime:"18:00",notes:"Focus on practice problems",done:false,date:daysFromNow(1),createdAt:now-9e5,recur:"none",subtasks:[],manualOrder:3,actualMinutes:0},
  {id:5,title:"Grocery run",        category:"personal",priority:"medium",minutes:30,workTime:"11:00",dueTime:"",     notes:"",                         done:false,date:daysFromNow(1),createdAt:now-1e6,recur:"none",subtasks:[{id:"s3",text:"Milk & eggs",done:false},{id:"s4",text:"Veggies",done:false}],manualOrder:4,actualMinutes:0},
  {id:6,title:"Doctor appointment", category:"health",  priority:"high",  minutes:45,workTime:"14:00",dueTime:"14:00",notes:"Bring insurance card",    done:false,date:daysFromNow(3),createdAt:now-1.1e6,recur:"none",subtasks:[],manualOrder:5,actualMinutes:0},
  {id:7,title:"Project proposal",   category:"work",    priority:"high",  minutes:90,workTime:"17:00",dueTime:"19:00",notes:"Draft & send to team",    done:false,date:daysFromNow(5),createdAt:now-1.2e6,recur:"none",subtasks:[],manualOrder:6,actualMinutes:0},
  {id:8,title:"Meditate",           category:"health",  priority:"low",   minutes:10,workTime:"07:00",dueTime:"",     notes:"",                         done:true, date:daysFromNow(0),createdAt:now-1.3e6,recur:"daily",subtasks:[],manualOrder:7,actualMinutes:10},
  {id:9,title:"Call mom",           category:"personal",priority:"medium",minutes:20,workTime:"18:00",dueTime:"20:00",notes:"",                         done:false,date:daysFromNow(0),createdAt:now-1.4e6,recur:"weekly",subtasks:[],manualOrder:8,actualMinutes:0},
  {id:10,title:"Prep lunch",        category:"personal",priority:"low",   minutes:15,workTime:"12:00",dueTime:"",     notes:"",                         done:false,date:daysFromNow(1),createdAt:now-1.5e6,recur:"daily",subtasks:[],manualOrder:9,actualMinutes:0},
];
const INITIAL_TEMPLATES=[
  {id:"t1",name:"Study Session",  icon:"📚",task:{category:"learning",priority:"high",  minutes:60,workTime:"",dueTime:"",notes:"",recur:"none",subtasks:[]}},
  {id:"t2",name:"Quick Email",    icon:"📧",task:{category:"work",    priority:"low",   minutes:15,workTime:"",dueTime:"",notes:"",recur:"none",subtasks:[]}},
  {id:"t3",name:"Morning Workout",icon:"🏃",task:{category:"health",  priority:"high",  minutes:45,workTime:"07:00",dueTime:"",notes:"",recur:"daily",subtasks:[]}},
];
const DEFAULT_SETTINGS={
  sortBy:"priority",accentColor:"#E07A5F",compactView:false,
  showStreak:true,defaultMinutes:25,notificationsOn:true,
  hiddenSorts:[],timerSound:"chime",theme:"dark",
};

// ─── Page Transition ──────────────────────────────────────────────────────────
function PageTransition({children}){
  const[vis,setVis]=useState(false);
  useEffect(()=>{requestAnimationFrame(()=>setVis(true));},[]);
  return(
    <div style={{opacity:vis?1:0,transform:vis?"translateY(0) scale(1)":"translateY(16px) scale(0.985)",transition:"opacity 0.3s cubic-bezier(0.4,0,0.2,1),transform 0.3s cubic-bezier(0.4,0,0.2,1)",minHeight:"100vh",display:"flex",flexDirection:"column"}}>
      {children}
    </div>
  );
}

// ─── App ──────────────────────────────────────────────────────────────────────
export default function App(){
  const[tasks,          setTasks]          =useState(INITIAL_TASKS);
  const[categories,     setCategories]     =useState(DEFAULT_CATEGORIES);
  const[settings,       setSettings]       =useState(DEFAULT_SETTINGS);
  const[templates,      setTemplates]      =useState(INITIAL_TEMPLATES);
  const[tab,            setTab]            =useState("home");
  const[sheetOpen,      setSheetOpen]      =useState(false);
  const[taskForm,       setTaskForm]       =useState(null);
  const[timerTask,      setTimerTask]      =useState(null);
  const[actionMenu,     setActionMenu]     =useState(null);
  const[deleteConfirm,  setDeleteConfirm]  =useState(null);
  const[justDone,       setJustDone]       =useState(null);
  const[justDeleted,    setJustDeleted]    =useState(null);
  const[justEdited,     setJustEdited]     =useState(null);
  const[justAppeared,   setJustAppeared]   =useState(null);
  const[streak,         setStreak]         =useState(0);
  const[streakLastDate, setStreakLastDate]  =useState(null);
  const[loaded,         setLoaded]         =useState(false);
  const[expandedNote,   setExpandedNote]   =useState(null);
  const[quickAdd,       setQuickAdd]       =useState("");
  const[showSummary,    setShowSummary]    =useState(false);
  const[summaryData,    setSummaryData]    =useState(null);
  const[showTemplates,  setShowTemplates]  =useState(false);
  const[showOnboarding, setShowOnboarding] =useState(false);
  const[showDevMenu,    setShowDevMenu]    =useState(false);
  const prevVisibleIds =useRef(new Set());
  const dragStart      =useRef(null);
  const summaryShownFor=useRef(null);

  const accent=settings.accentColor;
  const th=THEMES[settings.theme||"dark"];

  // ── Load ────────────────────────────────────────────────────────────────────
  useEffect(()=>{
    try{
      const raw=k=>{ try{return localStorage.getItem(k);}catch(e){return null;} };
      const t2=raw('tf_tasks'),c2=raw('tf_categories'),s2=raw('tf_settings'),st2=raw('tf_streak'),tmpl2=raw('tf_templates'),ob2=raw('tf_onboarding_seen');
      if(t2)setTasks(JSON.parse(t2));
      if(c2)setCategories(JSON.parse(c2));
      if(s2)setSettings(p=>({...p,...JSON.parse(s2)}));
      if(st2){const{count,lastDate}=JSON.parse(st2);setStreak(count||0);setStreakLastDate(lastDate||null);}
      if(tmpl2)setTemplates(JSON.parse(tmpl2));
      if(!ob2)setShowOnboarding(true);
    }catch(e){setShowOnboarding(true);}
    setLoaded(true);
  },[]);

  const save=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v));}catch(e){}};
  useEffect(()=>{if(!loaded)return;save('tf_tasks',tasks);},[tasks,loaded]);
  useEffect(()=>{if(!loaded)return;save('tf_categories',categories);},[categories,loaded]);
  useEffect(()=>{if(!loaded)return;save('tf_settings',settings);},[settings,loaded]);
  useEffect(()=>{if(!loaded)return;save('tf_streak',{count:streak,lastDate:streakLastDate});},[streak,streakLastDate,loaded]);
  useEffect(()=>{if(!loaded)return;save('tf_templates',templates);},[templates,loaded]);

  // ── Recur ───────────────────────────────────────────────────────────────────
  useEffect(()=>{
    if(!loaded)return;
    const today=todayStr();
    setTasks(prev=>{
      const existing=new Set(prev.filter(t=>t.date===today).map(t=>t.recurSourceId||t.id));
      const toAdd=[];
      prev.forEach(t=>{
        if(!t.recur||t.recur==="none"||t.date===today||existing.has(t.id))return;
        if(shouldRecurToday(t,today))toAdd.push({...t,id:Date.now()+Math.random(),date:today,done:false,actualMinutes:0,recurSourceId:t.id,createdAt:Date.now()});
      });
      return toAdd.length>0?[...prev,...toAdd]:prev;
    });
  },[loaded]);

  // ── Derived ─────────────────────────────────────────────────────────────────
  const todayAll   =useMemo(()=>tasks.filter(t=>t.date===todayStr()),[tasks]);
  const todayDone  =useMemo(()=>todayAll.filter(t=>t.done),[todayAll]);
  const todayInc   =useMemo(()=>todayAll.filter(t=>!t.done),[todayAll]);
  const tomorrowAll=useMemo(()=>tasks.filter(t=>t.date===tomorrowStr()),[tasks]);
  const overdueAll =useMemo(()=>tasks.filter(t=>t.date===yesterdayStr()&&!t.done),[tasks]);
  const progress   =todayAll.length>0?todayDone.length/todayAll.length:0;

  // ── Streak ──────────────────────────────────────────────────────────────────
  useEffect(()=>{
    if(!loaded)return;
    const today=todayStr();
    if(todayAll.length>0&&todayAll.every(t=>t.done)){
      if(streakLastDate===today)return;
      const yest=new Date();yest.setDate(yest.getDate()-1);
      setStreak(streakLastDate===yest.toDateString()?streak+1:1);
      setStreakLastDate(today);
    }
  },[tasks,loaded]);

  // ── Summary ─────────────────────────────────────────────────────────────────
  useEffect(()=>{
    if(!loaded)return;
    const today=todayStr();
    if(todayAll.length>0&&todayAll.every(t=>t.done)&&summaryShownFor.current!==today){
      summaryShownFor.current=today;
      setTimeout(()=>{
        setSummaryData({done:todayDone.length,totalFocus:todayDone.reduce((s,t)=>s+(t.actualMinutes||t.minutes),0),streak});
        setShowSummary(true);
      },600);
    }
  },[tasks,loaded]);

  // ── Sort ─────────────────────────────────────────────────────────────────────
  function sortList(list,by){
    return[...list].sort((a,b)=>{
      if(by==="priority")return PRIORITY_ORDER[a.priority]-PRIORITY_ORDER[b.priority];
      if(by==="manual")  return(a.manualOrder||0)-(b.manualOrder||0);
      if(by==="workTime")return(a.workTime||"").localeCompare(b.workTime||"");
      if(by==="dueTime") return(a.dueTime||"").localeCompare(b.dueTime||"");
      if(by==="duration")return a.minutes-b.minutes;
      if(by==="alpha")   return a.title.localeCompare(b.title);
      if(by.startsWith("cat_")){const catId=by.replace("cat_","");const am=a.category===catId?0:1,bm=b.category===catId?0:1;return am!==bm?am-bm:PRIORITY_ORDER[a.priority]-PRIORITY_ORDER[b.priority];}
      return 0;
    });
  }

  const homeList=useMemo(()=>sortList(todayInc,settings.sortBy),[tasks,settings.sortBy]);
  const allUpcoming=useMemo(()=>tasks.filter(t=>new Date(t.date)>=new Date(todayStr())).sort((a,b)=>new Date(a.date)-new Date(b.date)||PRIORITY_ORDER[a.priority]-PRIORITY_ORDER[b.priority]),[tasks]);
  const groupedByDate=useMemo(()=>{const g={};allUpcoming.forEach(t=>{if(!g[t.date])g[t.date]=[];g[t.date].push(t);});return g;},[allUpcoming]);
  const sortedDates=Object.keys(groupedByDate).sort((a,b)=>new Date(a)-new Date(b));
  const analytics=useMemo(()=>{
    const done=tasks.filter(t=>t.done);
    return{total:tasks.length,done:done.length,totalMinutes:done.reduce((s,t)=>s+(t.actualMinutes||t.minutes),0),estimatedMinutes:done.reduce((s,t)=>s+t.minutes,0),highDone:done.filter(t=>t.priority==="high").length,highTotal:tasks.filter(t=>t.priority==="high").length,rate:tasks.length>0?Math.round((done.length/tasks.length)*100):0};
  },[tasks]);

  // ── Appear detection ─────────────────────────────────────────────────────────
  useEffect(()=>{
    const visibleNow=homeList.slice(0,5).map(t=>t.id);
    const newId=visibleNow.find(id=>!prevVisibleIds.current.has(id));
    if(newId&&prevVisibleIds.current.size>0)setTimeout(()=>{setJustAppeared(newId);setTimeout(()=>setJustAppeared(null),600);},30);
    prevVisibleIds.current=new Set(visibleNow);
  },[homeList]);

  // ── Actions ──────────────────────────────────────────────────────────────────
  function toggleDone(id){
    const t=tasks.find(t=>t.id===id);if(!t)return;
    if(!t.done){
      haptic("success");
      setJustDone(id);
      setTimeout(()=>{setTasks(prev=>prev.map(x=>x.id===id?{...x,done:true}:x));setJustDone(null);},360);
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
    if(!f.title.trim())return;
    haptic("medium");
    if(taskForm.mode==="new"){
      setTasks(prev=>[...prev,{...f,id:Date.now(),done:false,createdAt:Date.now(),actualMinutes:0,manualOrder:prev.length}]);
    } else {
      setTasks(prev=>prev.map(x=>x.id===f.id?{...f}:x));
      setJustEdited(f.id);setTimeout(()=>setJustEdited(null),900);
    }
    setTaskForm(null);
  }
  function deleteTask(id){
    haptic("error");
    setDeleteConfirm(null);setActionMenu(null);
    setJustDeleted(id);
    setTimeout(()=>{setTasks(prev=>prev.filter(t=>t.id!==id));setJustDeleted(null);},420);
  }
  function postponeTask(id){
    haptic("medium");
    setTasks(prev=>prev.map(t=>t.id===id?{...t,date:tomorrowStr()}:t));
    setActionMenu(null);
  }
  function moveOverdueToToday(){
    haptic("success");
    setTasks(prev=>prev.map(t=>t.date===yesterdayStr()&&!t.done?{...t,date:todayStr()}:t));
  }
  function deleteCategory(catId){
    setTasks(prev=>prev.map(t=>t.category===catId?{...t,category:"other"}:t));
    setCategories(prev=>prev.filter(c=>c.id!==catId));
    setSettings(p=>({...p,hiddenSorts:(p.hiddenSorts||[]).filter(s=>s!=="cat_"+catId),sortBy:p.sortBy==="cat_"+catId?"priority":p.sortBy}));
  }
  function quickAddTask(){
    if(!quickAdd.trim())return;
    haptic("medium");
    setTasks(prev=>[...prev,{id:Date.now(),title:quickAdd.trim(),category:categories[0]?.id||"work",priority:"medium",minutes:settings.defaultMinutes,workTime:"",dueTime:"",notes:"",done:false,date:todayStr(),createdAt:Date.now(),recur:"none",subtasks:[],manualOrder:prev.length,actualMinutes:0}]);
    setQuickAdd("");
  }
  function moveTaskUp(id){
    setTasks(prev=>{
      const sorted=sortList(prev.filter(t=>t.date===todayStr()&&!t.done),"manual");
      const idx=sorted.findIndex(t=>t.id===id);if(idx<=0)return prev;
      const[a,b]=[sorted[idx-1],sorted[idx]];
      return prev.map(t=>t.id===a.id?{...t,manualOrder:b.manualOrder}:t.id===b.id?{...t,manualOrder:a.manualOrder}:t);
    });
  }
  function moveTaskDown(id){
    setTasks(prev=>{
      const sorted=sortList(prev.filter(t=>t.date===todayStr()&&!t.done),"manual");
      const idx=sorted.findIndex(t=>t.id===id);if(idx<0||idx>=sorted.length-1)return prev;
      const[a,b]=[sorted[idx],sorted[idx+1]];
      return prev.map(t=>t.id===a.id?{...t,manualOrder:b.manualOrder}:t.id===b.id?{...t,manualOrder:a.manualOrder}:t);
    });
  }
  function saveTemplate(task){
    setTemplates(prev=>[...prev,{id:"t"+Date.now(),name:task.title,icon:"📋",task:{category:task.category,priority:task.priority,minutes:task.minutes,workTime:task.workTime,dueTime:task.dueTime,notes:task.notes,recur:task.recur,subtasks:[]}}]);
  }
  function deleteTemplate(id){setTemplates(prev=>prev.filter(t=>t.id!==id));}
  function addFromTemplate(tmpl){setTaskForm({mode:"new",task:{...tmpl.task,title:tmpl.name,date:todayStr()}});setShowTemplates(false);}

  // ── Sheet drag ────────────────────────────────────────────────────────────────
  function dragS(e){dragStart.current=e.touches?e.touches[0].clientY:e.clientY;}
  function dragE(e){
    if(!dragStart.current)return;
    const end=e.changedTouches?e.changedTouches[0].clientY:e.clientY;
    if(end-dragStart.current>60)setSheetOpen(false);
    dragStart.current=null;
  }

  const radius=90,circ=2*Math.PI*radius,dash=circ*progress;
  const emptyTask={title:"",category:categories[0]?.id||"work",priority:"medium",minutes:settings.defaultMinutes,workTime:"",dueTime:"",notes:"",date:todayStr(),recur:"none",subtasks:[],manualOrder:0,actualMinutes:0};

  if(!loaded)return(
    <div style={{fontFamily:"'DM Sans',sans-serif",background:th.bg,minHeight:"100vh",color:th.text,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:16,maxWidth:430,margin:"0 auto"}}>
      <link href="https://fonts.googleapis.com/css2?family=Space+Mono:wght@700&display=swap" rel="stylesheet"/>
      <div style={{fontFamily:"'Space Mono',monospace",fontSize:22,fontWeight:700,letterSpacing:2,color:accent}}>TASKFLOW</div>
      <div style={{display:"flex",gap:8}}>{[0,1,2].map(i=><div key={i} style={{width:7,height:7,borderRadius:"50%",background:accent,opacity:0.3,animation:`dotPulse 1.2s ease ${i*0.2}s infinite`}}/>)}</div>
      <style>{`@keyframes dotPulse{0%,100%{opacity:0.2;transform:scale(0.8)}50%{opacity:1;transform:scale(1.2)}}`}</style>
    </div>
  );
  if(timerTask)return(<TimerPage task={timerTask} categories={categories} accent={accent} timerSound={settings.timerSound} th={th}
    onBack={()=>setTimerTask(null)}
    onDone={(actualMins)=>{const id=timerTask.id;setTasks(prev=>prev.map(t=>t.id===id?{...t,done:true,actualMinutes:(t.actualMinutes||0)+actualMins}:t));setTimerTask(null);}}/>);
  if(taskForm)return(<TaskFormPage mode={taskForm.mode} initialData={taskForm.task} categories={categories} setCategories={setCategories} settings={settings} onSave={saveTask} onClose={()=>setTaskForm(null)} accent={accent} th={th}/>);

  const sharedCardProps={categories,accent,th,expandedNote,onToggleNote:id=>setExpandedNote(n=>n===id?null:id),onToggle:toggleDone,onToggleSubtask:toggleSubtask,onStart:setTimerTask,onMenu:(t,e)=>{e.stopPropagation();haptic("light");setActionMenu(t);}};

  return(
    <div style={{fontFamily:"'DM Sans',sans-serif",background:th.bg,minHeight:"100vh",color:th.text,display:"flex",flexDirection:"column",maxWidth:430,margin:"0 auto",position:"relative",overflow:"hidden"}}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=Space+Mono:wght@400;700&display=swap" rel="stylesheet"/>
      <style>{`
        @keyframes slideUp    {from{transform:translateY(100%);opacity:0}to{transform:translateY(0);opacity:1}}
        @keyframes fadeIn     {from{opacity:0;transform:scale(0.96)}to{opacity:1;transform:scale(1)}}
        @keyframes editPulse  {0%{box-shadow:0 0 0 0 rgba(255,255,255,0.15)}40%{box-shadow:0 0 0 6px rgba(255,255,255,0.08)}100%{box-shadow:0 0 0 0 rgba(255,255,255,0)}}
        @keyframes cardSlideIn  {0%{opacity:0;transform:translateY(16px) scale(0.98)}55%{opacity:1;transform:translateY(-2px) scale(1.003)}100%{opacity:1;transform:translateY(0) scale(1)}}
        @keyframes cardSlideOut {0%{opacity:1;transform:translateY(0) scale(1)}100%{opacity:0;transform:translateY(10px) scale(0.96)}}
        @keyframes wrapShrink   {0%{max-height:var(--wrap-h,120px);margin-bottom:var(--wrap-mb,9px);opacity:1}28%{opacity:0}100%{max-height:0px;margin-bottom:0px;opacity:0}}
        @keyframes noteExpand   {from{opacity:0;transform:translateY(-4px)}to{opacity:1;transform:translateY(0)}}
        @keyframes pulse        {0%,100%{opacity:1}50%{opacity:0.5}}
        @keyframes burstRipple  {0%{transform:scale(0);opacity:0.9}100%{transform:scale(5);opacity:0}}
        @keyframes burstFade    {0%{opacity:1}70%{opacity:0.8}100%{opacity:0}}
        @keyframes summaryIn    {0%{opacity:0;transform:translateY(40px) scale(0.92)}60%{transform:translateY(-6px) scale(1.02)}100%{opacity:1;transform:translateY(0) scale(1)}}
        @keyframes overduePulse {0%,100%{opacity:1}50%{opacity:0.6}}
        @keyframes swipeHint    {0%,100%{transform:translateX(0)}50%{transform:translateX(-6px)}}
        .task-card{transition:opacity 0.3s ease,transform 0.3s cubic-bezier(0.4,0,0.2,1);}
        .task-card.edited{animation:editPulse 0.8s ease forwards;}
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
        input,textarea{outline:none;font-family:'DM Sans',sans-serif;}
        ::-webkit-scrollbar{width:0;}
        .swipe-card{user-select:none;touch-action:pan-y;}
      `}</style>

      {/* ══ HOME ══ */}
      {tab==="home"&&(
        <PageTransition>
          <div style={{flex:1,display:"flex",flexDirection:"column",paddingBottom:80,overflowY:"auto"}}>
            <div style={{padding:"52px 26px 8px",display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
              <div>
                <div style={{fontSize:12,color:th.textDim,letterSpacing:1.5,textTransform:"uppercase",fontFamily:"'Space Mono',monospace"}}>Today</div>
                <div style={{fontSize:21,fontWeight:600,marginTop:4,letterSpacing:-0.3}}>{new Date().toLocaleDateString("en-US",{weekday:"long",month:"short",day:"numeric"})}</div>
              </div>
              <div style={{display:"flex",alignItems:"center",gap:8}}>
                {settings.showStreak&&streak>0&&(
                  <div style={{display:"flex",alignItems:"center",gap:6,background:streak>=7?accent+"22":th.surface,borderRadius:20,padding:"7px 14px",border:`1px solid ${streak>=7?accent+"55":th.border2}`,transition:"all 0.4s"}}>
                    <span style={{fontSize:15}}>🔥</span>
                    <span style={{fontFamily:"'Space Mono',monospace",fontSize:13,color:"#F2CC8F",fontWeight:700}}>{streak}</span>
                    {streak>=7&&<span style={{fontSize:10,color:"#F2CC8F88"}}>🏆</span>}
                  </div>
                )}
                {/* Dev menu trigger — triple tap the date area */}
                <button onClick={()=>setShowDevMenu(true)} style={{background:"none",border:"none",cursor:"pointer",fontSize:14,color:th.textDim,padding:"4px 6px",opacity:0.5}}>⚙️</button>
              </div>
            </div>

            {/* Overdue banner */}
            {overdueAll.length>0&&(
              <div style={{margin:"8px 24px 0",background:"#E07A5F15",border:"1px solid #E07A5F44",borderRadius:14,padding:"10px 14px",display:"flex",alignItems:"center",gap:10}}>
                <span style={{fontSize:16,animation:"overduePulse 2s ease infinite"}}>⚠️</span>
                <div style={{flex:1}}>
                  <div style={{fontSize:12,fontWeight:600,color:"#E07A5F"}}>{overdueAll.length} overdue task{overdueAll.length!==1?"s":""} from yesterday</div>
                  <div style={{fontSize:11,color:"#E07A5F88",marginTop:2}}>Complete or reschedule them</div>
                </div>
                <button onClick={moveOverdueToToday} style={{background:"#E07A5F",border:"none",borderRadius:8,padding:"6px 12px",color:"#fff",fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:"'DM Sans',sans-serif",flexShrink:0}}>Move all →</button>
              </div>
            )}

            {/* Progress Ring */}
            <div style={{display:"flex",flexDirection:"column",alignItems:"center",padding:"20px 0 14px"}}>
              <div style={{position:"relative",width:220,height:220}}>
                <svg width="220" height="220" style={{transform:"rotate(-90deg)"}}>
                  <circle cx="110" cy="110" r={radius} fill="none" stroke={th.surface} strokeWidth="13"/>
                  <circle cx="110" cy="110" r={radius} fill="none" stroke={progress===1?"#81B29A":accent} strokeWidth="13" strokeLinecap="round" strokeDasharray={`${dash} ${circ}`}
                    style={{transition:"stroke-dasharray 0.9s cubic-bezier(0.4,0,0.2,1),stroke 0.6s ease",filter:`drop-shadow(0 0 14px ${progress===1?"#81B29A":accent}55)`}}/>
                </svg>
                <div style={{position:"absolute",inset:0,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center"}}>
                  <div style={{fontFamily:"'Space Mono',monospace",fontSize:50,fontWeight:700,lineHeight:1,color:progress===1?"#81B29A":th.text,transition:"color 0.4s"}}>{todayInc.length}</div>
                  <div style={{fontSize:11,color:th.textDim,marginTop:6,textTransform:"uppercase",letterSpacing:1.5}}>left</div>
                  <div style={{marginTop:8,fontSize:12,color:th.textMuted}}>{todayDone.length}/{todayAll.length} done</div>
                </div>
              </div>
              {progress===1&&todayAll.length>0&&<div style={{marginTop:8,fontSize:13,color:"#81B29A",fontWeight:500,animation:"fadeIn 0.4s ease"}}>All done! 🎉</div>}
            </div>

            {/* Sort menu */}
            <SortMenu sortBy={settings.sortBy} hiddenSorts={settings.hiddenSorts||[]} categories={categories} accent={accent} th={th}
              onSelect={id=>{haptic("light");setSettings(p=>({...p,sortBy:id}));}}
              onToggleHide={id=>setSettings(p=>{const h=p.hiddenSorts||[];return{...p,hiddenSorts:h.includes(id)?h.filter(x=>x!==id):[...h,id]};})}
              onDeleteCategory={deleteCategory} onAddCategory={cat=>setCategories(prev=>[...prev,cat])}/>

            {/* Quick add */}
            <div style={{padding:"0 24px 12px",display:"flex",gap:8}}>
              <div style={{flex:1,position:"relative"}}>
                <input value={quickAdd} onChange={e=>setQuickAdd(e.target.value)}
                  onKeyDown={e=>{if(e.key==="Enter")quickAddTask();}}
                  placeholder="Quick add a task…"
                  style={{width:"100%",background:th.surface,border:`1px solid ${th.border2}`,borderRadius:12,padding:"10px 40px 10px 14px",color:th.text,fontSize:13,boxSizing:"border-box"}}
                  onFocus={e=>e.target.style.borderColor=accent} onBlur={e=>e.target.style.borderColor=th.border2}/>
                {quickAdd&&<button onClick={quickAddTask} style={{position:"absolute",right:8,top:"50%",transform:"translateY(-50%)",background:accent,border:"none",borderRadius:8,width:24,height:24,cursor:"pointer",color:"#fff",fontSize:14,display:"flex",alignItems:"center",justifyContent:"center"}}>+</button>}
              </div>
              <button onClick={()=>setShowTemplates(true)} style={{background:th.surface,border:`1px solid ${th.border2}`,borderRadius:12,padding:"10px 12px",color:th.textMuted,fontSize:16,cursor:"pointer"}}>📋</button>
            </div>

            {/* Task list */}
            <div style={{padding:"0 24px"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:11}}>
                <span style={{fontSize:11,color:th.textDim,textTransform:"uppercase",letterSpacing:1.5,fontFamily:"'Space Mono',monospace"}}>Up Next</span>
                <button onClick={()=>setSheetOpen(true)} style={{background:"none",border:"none",color:th.textMuted,fontSize:12,cursor:"pointer",padding:0}}>see all ↑</button>
              </div>
              <div style={{display:"flex",flexDirection:"column",gap:0}}>
                {homeList.slice(0,5).map(task=>(
                  <TaskCard key={task.id} task={task} {...sharedCardProps} compact={settings.compactView}
                    isSliding={justDone===task.id||justDeleted===task.id} isEdited={justEdited===task.id} isAppearing={justAppeared===task.id}
                    showMoveButtons={settings.sortBy==="manual"} onMoveUp={moveTaskUp} onMoveDown={moveTaskDown}/>
                ))}
                {homeList.length===0&&(
                  <div style={{textAlign:"center",color:th.textDim,padding:"32px 0",fontSize:14}}>{todayDone.length>0?"All tasks complete! 🎉":"Nothing scheduled today."}</div>
                )}
              </div>
            </div>

            {/* Swipe hint */}
            <div onClick={()=>setSheetOpen(true)} style={{display:"flex",flexDirection:"column",alignItems:"center",padding:"16px 0 0",cursor:"pointer"}}>
              <div style={{width:34,height:3,background:th.border2,borderRadius:2,marginBottom:7}}/>
              {homeList.length>5
                ?<span style={{fontSize:11,color:accent,letterSpacing:1,fontWeight:600}}>+{homeList.length-5} more · tap to see all</span>
                :<span style={{fontSize:10,color:th.textDim,letterSpacing:1.5}}>SWIPE UP · TODAY & TOMORROW</span>}
            </div>
          </div>
        </PageTransition>
      )}

      {/* ══ LIST ══ */}
      {tab==="list"&&(
        <PageTransition>
          <div style={{flex:1,overflowY:"auto",padding:"52px 24px 80px"}}>
            <div style={{fontSize:11,color:th.textDim,letterSpacing:1.5,textTransform:"uppercase",fontFamily:"'Space Mono',monospace",marginBottom:5}}>Everything ahead</div>
            <div style={{fontSize:22,fontWeight:600,marginBottom:24,letterSpacing:-0.3}}>All Tasks</div>
            {sortedDates.length===0&&<div style={{textAlign:"center",color:th.textDim,marginTop:60,fontSize:14}}>No upcoming tasks — hit + to add one!</div>}
            {sortedDates.map(date=>{
              const dayTasks=groupedByDate[date];
              const inc=sortList(dayTasks.filter(t=>!t.done),settings.sortBy);
              const done=dayTasks.filter(t=>t.done);
              return(
                <div key={date} style={{marginBottom:28}}>
                  <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}>
                    <div>
                      <div style={{fontSize:14,fontWeight:600,color:date===todayStr()?accent:th.text}}>{fmtDateLabel(date)}</div>
                      {date!==todayStr()&&<div style={{fontSize:11,color:th.textDim,fontFamily:"'Space Mono',monospace",marginTop:1}}>{new Date(date).toLocaleDateString("en-US",{month:"short",day:"numeric"})}</div>}
                    </div>
                    <div style={{flex:1,height:1,background:th.border}}/>
                    <div style={{fontSize:11,color:th.textDim,fontFamily:"'Space Mono',monospace"}}>{done.length}/{dayTasks.length}</div>
                  </div>
                  <div style={{display:"flex",flexDirection:"column",gap:0}}>
                    {inc.map(task=><TaskCard key={task.id} task={task} {...sharedCardProps} full isSliding={justDone===task.id||justDeleted===task.id} isEdited={justEdited===task.id}/>)}
                    {inc.length>0&&done.length>0&&(
                      <div style={{display:"flex",alignItems:"center",gap:10,margin:"10px 0 6px"}}>
                        <div style={{flex:1,height:1,background:`linear-gradient(to right,transparent,${th.border})`}}/>
                        <span style={{fontSize:10,color:th.textMuted,display:"flex",alignItems:"center",gap:4}}><span style={{color:"#81B29A"}}>✓</span>{done.length} done</span>
                        <div style={{flex:1,height:1,background:`linear-gradient(to left,transparent,${th.border})`}}/>
                      </div>
                    )}
                    {done.map(task=><TaskCard key={task.id} task={task} {...sharedCardProps} full isSliding={justDeleted===task.id} isEdited={justEdited===task.id}/>)}
                  </div>
                </div>
              );
            })}
          </div>
        </PageTransition>
      )}

      {/* ══ SETTINGS ══ */}
      {tab==="settings"&&(
        <PageTransition>
          <SettingsPage settings={settings} setSettings={setSettings} analytics={analytics} categories={categories} tasks={tasks} accent={accent} th={th} streak={streak} templates={templates} onResetStreak={()=>{setStreak(0);setStreakLastDate(null);}} onDeleteTemplate={deleteTemplate} onAddFromTemplate={addFromTemplate}/>
        </PageTransition>
      )}

      {/* ══ Bottom Nav ══ */}
      <div style={{position:"fixed",bottom:0,left:"50%",transform:"translateX(-50%)",width:"100%",maxWidth:430,background:th.navBg,borderTop:`1px solid ${th.border}`,display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",alignItems:"end",padding:"0 0 20px",zIndex:50,backdropFilter:"blur(14px)",minHeight:64}}>
        <button className={`tab-btn ${tab==="home"?"active":""}`} onClick={()=>setTab("home")} style={{paddingTop:10}}>
          <span className="tab-icon">⌂</span><span>Home</span>
        </button>
        <button className={`tab-btn ${tab==="list"?"active":""}`} onClick={()=>setTab("list")} style={{paddingTop:10}}>
          <span className="tab-icon">≡</span><span>List</span>
        </button>
        <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"flex-end",paddingBottom:4}}>
          <button onClick={()=>setTaskForm({mode:"new",task:{...emptyTask}})}
            style={{background:accent,border:"none",width:50,height:50,borderRadius:"50%",cursor:"pointer",fontSize:26,color:"#fff",display:"flex",alignItems:"center",justifyContent:"center",boxShadow:`0 4px 22px ${accent}55`,transform:"translateY(-12px)",transition:"transform 0.18s cubic-bezier(0.34,1.56,0.64,1)"}}
            onMouseDown={e=>{e.currentTarget.style.transform="translateY(-10px) scale(0.92)";}}
            onMouseUp={e=>{e.currentTarget.style.transform="translateY(-12px) scale(1)";}}>+</button>
        </div>
        <button className={`tab-btn ${tab==="settings"?"active":""}`} onClick={()=>setTab("settings")} style={{paddingTop:10}}>
          <span className="tab-icon">⚙</span><span>Settings</span>
        </button>
      </div>

      {/* ══ Sheet ══ */}
      {sheetOpen&&<Sheet todayInc={sortList(todayInc,settings.sortBy)} todayDone={todayDone} tomorrowTasks={sortList(tomorrowAll,settings.sortBy)} overdueAll={overdueAll}
        categories={categories} accent={accent} th={th} justDone={justDone} justDeleted={justDeleted} justEdited={justEdited}
        expandedNote={expandedNote} onToggleNote={id=>setExpandedNote(n=>n===id?null:id)}
        onToggle={toggleDone} onToggleSubtask={toggleSubtask}
        onStart={t=>{setSheetOpen(false);setTimerTask(t);}}
        onMenu={(t,e)=>{e.stopPropagation();setSheetOpen(false);haptic("light");setActionMenu(t);}}
        onClose={()=>setSheetOpen(false)} onMoveAllOverdue={moveOverdueToToday}
        dragS={dragS} dragE={dragE} doneTodayCount={todayDone.length} totalTodayCount={todayAll.length}/>}

      {/* ══ Action Menu ══ */}
      {actionMenu&&!deleteConfirm&&(
        <div style={{position:"fixed",inset:0,zIndex:200,display:"flex",alignItems:"center",justifyContent:"center"}} onClick={()=>setActionMenu(null)}>
          <div style={{position:"absolute",inset:0,background:"rgba(0,0,0,0.55)",backdropFilter:"blur(6px)"}}/>
          <div onClick={e=>e.stopPropagation()} style={{position:"relative",background:th.surface,borderRadius:20,padding:"6px",width:268,animation:"fadeIn 0.2s ease",boxShadow:"0 24px 64px rgba(0,0,0,0.7)",border:`1px solid ${th.border2}`}}>
            <div style={{padding:"14px 16px 10px",borderBottom:`1px solid ${th.border}`,marginBottom:4}}>
              <div style={{fontSize:13,fontWeight:600,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{actionMenu.title}</div>
              <div style={{fontSize:11,color:th.textMuted,marginTop:2}}>{fmtDateLabel(actionMenu.date)}{actionMenu.workTime?` · 🕐 ${fmtTime(actionMenu.workTime)}`:""}{actionMenu.dueTime?` · ⏰ ${fmtTime(actionMenu.dueTime)}`:""}</div>
            </div>
            {[
              {icon:"✏️",label:"Edit Task",     sub:"Modify all task details",  action:()=>{setTaskForm({mode:"edit",task:{...actionMenu}});setActionMenu(null);},color:th.text},
              {icon:"📅",label:"Postpone",       sub:"Move to tomorrow",         action:()=>postponeTask(actionMenu.id),                                          color:"#7B9EC9"},
              {icon:"📋",label:"Save as Template",sub:"Reuse this task config",  action:()=>{saveTemplate(actionMenu);setActionMenu(null);},                      color:"#81B29A"},
              {icon:"🗑️",label:"Delete Task",   sub:"This can't be undone",     action:()=>setDeleteConfirm(actionMenu.id),                                      color:"#E07A5F"},
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

      {/* ══ Delete Confirm ══ */}
      {deleteConfirm&&(
        <div style={{position:"fixed",inset:0,zIndex:300,display:"flex",alignItems:"center",justifyContent:"center"}}>
          <div style={{position:"absolute",inset:0,background:"rgba(0,0,0,0.65)",backdropFilter:"blur(8px)"}} onClick={()=>{setDeleteConfirm(null);setActionMenu(null);}}/>
          <div style={{position:"relative",background:th.surface,borderRadius:22,padding:"28px 24px",width:288,animation:"fadeIn 0.22s ease",textAlign:"center",boxShadow:"0 24px 64px rgba(0,0,0,0.7)",border:`1px solid ${th.border2}`}}>
            <div style={{fontSize:34,marginBottom:12}}>🗑️</div>
            <div style={{fontSize:16,fontWeight:600,marginBottom:8}}>Delete Task?</div>
            <div style={{fontSize:13,color:th.textMuted,marginBottom:24,lineHeight:1.6}}>"{tasks.find(t=>t.id===deleteConfirm)?.title}" will be gone for good.</div>
            <div style={{display:"flex",gap:10}}>
              <button onClick={()=>{setDeleteConfirm(null);setActionMenu(null);}} style={{flex:1,background:th.surface2,border:"none",borderRadius:12,padding:"14px",color:th.text,fontSize:14,cursor:"pointer",fontFamily:"'DM Sans',sans-serif",fontWeight:500}}>Cancel</button>
              <button onClick={()=>deleteTask(deleteConfirm)} style={{flex:1,background:"#E07A5F",border:"none",borderRadius:12,padding:"14px",color:"#fff",fontSize:14,cursor:"pointer",fontFamily:"'DM Sans',sans-serif",fontWeight:600,boxShadow:"0 4px 18px rgba(224,122,95,0.4)"}}>Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* ══ Templates ══ */}
      {showTemplates&&(
        <div style={{position:"fixed",inset:0,zIndex:200,display:"flex",alignItems:"flex-end",justifyContent:"center"}} onClick={()=>setShowTemplates(false)}>
          <div style={{position:"absolute",inset:0,background:"rgba(0,0,0,0.6)",backdropFilter:"blur(6px)"}}/>
          <div onClick={e=>e.stopPropagation()} style={{position:"relative",background:th.surface2,borderRadius:"22px 22px 0 0",width:"100%",maxWidth:430,padding:"16px 22px 44px",maxHeight:"70vh",overflowY:"auto",animation:"slideUp 0.3s cubic-bezier(0.34,1.08,0.64,1)",boxShadow:"0 -8px 40px rgba(0,0,0,0.5)"}}>
            <div style={{width:36,height:4,background:th.border2,borderRadius:2,margin:"0 auto 18px"}}/>
            <div style={{fontSize:15,fontWeight:600,marginBottom:16}}>Templates</div>
            {templates.length===0&&<div style={{textAlign:"center",color:th.textDim,padding:"24px 0",fontSize:13}}>No templates yet. Save one from any task's ⋯ menu.</div>}
            <div style={{display:"flex",flexDirection:"column",gap:8}}>
              {templates.map(t=>(
                <div key={t.id} style={{display:"flex",alignItems:"center",gap:12,background:th.surface,borderRadius:14,padding:"14px 16px",border:`1px solid ${th.border}`}}>
                  <span style={{fontSize:20}}>{t.icon}</span>
                  <div style={{flex:1}}><div style={{fontSize:14,fontWeight:500}}>{t.name}</div><div style={{fontSize:11,color:th.textMuted,marginTop:2}}>{t.task.minutes}min · {t.task.priority} · {getCat(t.task.category,categories).label}</div></div>
                  <button onClick={()=>addFromTemplate(t)} style={{background:accent+"22",border:`1px solid ${accent}44`,borderRadius:8,padding:"6px 12px",color:accent,fontSize:12,cursor:"pointer",fontFamily:"'DM Sans',sans-serif",fontWeight:600}}>Use</button>
                  <button onClick={()=>deleteTemplate(t.id)} style={{background:"none",border:"none",color:th.textDim,fontSize:16,cursor:"pointer",padding:"4px"}}>🗑</button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ══ Daily Summary ══ */}
      {showSummary&&summaryData&&<DailySummary data={summaryData} accent={accent} onClose={()=>setShowSummary(false)}/>}

      {/* ══ Dev Menu ══ */}
      {showDevMenu&&<DevMenu accent={accent} th={th} onClose={()=>setShowDevMenu(false)}
        onResetOnboarding={()=>{try{localStorage.removeItem('tf_onboarding_seen');}catch(e){}setShowDevMenu(false);setShowOnboarding(true);}}
        onResetStorage={()=>{try{['tf_tasks','tf_categories','tf_settings','tf_streak','tf_templates','tf_onboarding_seen'].forEach(k=>localStorage.removeItem(k));}catch(e){}window.location.reload();}}
        onForceOverdue={()=>{setTasks(prev=>prev.map((t,i)=>i===0?{...t,date:yesterdayStr(),done:false}:t));setShowDevMenu(false);}}
        onForceSummary={()=>{setSummaryData({done:5,totalFocus:120,streak:7});setShowSummary(true);setShowDevMenu(false);}}
      />}

      {/* ══ Onboarding ══ */}
      {showOnboarding&&<Onboarding accent={accent} th={th} onDone={()=>{try{localStorage.setItem('tf_onboarding_seen','1');}catch(e){}setShowOnboarding(false);}}/>}
    </div>
  );
}

// ─── Sort Menu ────────────────────────────────────────────────────────────────
function SortMenu({sortBy,hiddenSorts,categories,accent,th,onSelect,onToggleHide,onDeleteCategory,onAddCategory}){
  const[open,setOpen]=useState(false);
  const[editMode,setEditMode]=useState(false);
  const[showNewCat,setShowNewCat]=useState(false);
  const[newCatName,setNewCatName]=useState("");
  const[newCatColor,setNewCatColor]=useState("#7B9EC9");
  const allOpts=[...BASE_SORT_OPTIONS,...categories.map(c=>({id:"cat_"+c.id,label:c.label,icon:"●",color:c.color,isCat:true,catId:c.id}))];
  const current=allOpts.find(s=>s.id===sortBy)||allOpts[0];
  function addCat(){if(!newCatName.trim())return;onAddCategory({id:"cust_"+Date.now(),label:newCatName.trim(),color:newCatColor});setNewCatName("");setShowNewCat(false);}
  return(
    <>
      <div style={{padding:"0 24px 12px"}}>
        <button onClick={()=>{setOpen(true);setEditMode(false);setShowNewCat(false);}}
          style={{display:"flex",alignItems:"center",gap:8,background:th.surface,border:`1.5px solid ${accent}44`,borderRadius:20,padding:"7px 16px",cursor:"pointer",width:"100%"}}>
          {current.isCat?<span style={{width:8,height:8,borderRadius:"50%",background:current.color,display:"inline-block",flexShrink:0}}/>:<span style={{fontSize:12}}>{current.icon}</span>}
          <span style={{fontSize:12,color:th.text,fontFamily:"'DM Sans',sans-serif",fontWeight:500}}>Sort: {current.label}</span>
          <span style={{fontSize:10,color:th.textDim,marginLeft:"auto"}}>▾</span>
        </button>
      </div>
      {open&&(
        <div style={{position:"fixed",inset:0,zIndex:150,display:"flex",alignItems:"flex-end",justifyContent:"center"}} onClick={()=>{setOpen(false);setEditMode(false);setShowNewCat(false);}}>
          <div style={{position:"absolute",inset:0,background:"rgba(0,0,0,0.6)",backdropFilter:"blur(6px)"}}/>
          <div onClick={e=>e.stopPropagation()} style={{position:"relative",background:th.surface2,borderRadius:"22px 22px 0 0",width:"100%",maxWidth:430,padding:"16px 20px 44px",maxHeight:"82vh",overflowY:"auto",boxShadow:"0 -8px 40px rgba(0,0,0,0.5)",animation:"slideUp 0.3s cubic-bezier(0.34,1.08,0.64,1)"}}>
            <div style={{width:36,height:4,background:th.border2,borderRadius:2,margin:"0 auto 18px"}}/>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
              <div style={{fontSize:15,fontWeight:600}}>{editMode?"Manage Sort & Categories":"Sort By"}</div>
              <button onClick={()=>{setEditMode(p=>!p);setShowNewCat(false);}} style={{background:"none",border:"none",color:accent,fontSize:12,cursor:"pointer",fontFamily:"'DM Sans',sans-serif",fontWeight:500}}>{editMode?"Done":"Edit"}</button>
            </div>
            <div style={{fontSize:10,color:th.textDim,letterSpacing:1.2,textTransform:"uppercase",fontFamily:"'Space Mono',monospace",marginBottom:8}}>Sort by field</div>
            {BASE_SORT_OPTIONS.map(s=>{
              const hidden=hiddenSorts.includes(s.id),active=sortBy===s.id;
              return(
                <button key={s.id} onClick={()=>{if(!editMode){onSelect(s.id);setOpen(false);}}}
                  style={{width:"100%",display:"flex",alignItems:"center",gap:12,background:active&&!editMode?accent+"18":"none",border:"none",borderRadius:12,padding:"11px 14px",cursor:editMode?"default":"pointer",opacity:hidden&&!editMode?0.3:1,marginBottom:2,transition:"all 0.15s"}}>
                  <span style={{fontSize:16,width:24,textAlign:"center"}}>{s.icon}</span>
                  <span style={{fontSize:14,color:active&&!editMode?accent:th.text,fontFamily:"'DM Sans',sans-serif",fontWeight:active&&!editMode?600:400,flex:1,textAlign:"left"}}>{s.label}</span>
                  {active&&!editMode&&<span style={{fontSize:12,color:accent}}>✓</span>}
                  {editMode&&<button onClick={e=>{e.stopPropagation();onToggleHide(s.id);}} style={{background:hidden?th.surface:accent+"22",border:`1px solid ${hidden?th.border2:accent+"44"}`,borderRadius:8,padding:"4px 10px",cursor:"pointer",fontSize:11,color:hidden?th.textMuted:accent,fontFamily:"'DM Sans',sans-serif"}}>{hidden?"Show":"Hide"}</button>}
                </button>
              );
            })}
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",margin:"16px 0 8px"}}>
              <div style={{fontSize:10,color:th.textDim,letterSpacing:1.2,textTransform:"uppercase",fontFamily:"'Space Mono',monospace"}}>Categories</div>
              {editMode&&!showNewCat&&<button onClick={()=>setShowNewCat(true)} style={{background:"none",border:"none",color:accent,fontSize:11,cursor:"pointer",fontFamily:"'DM Sans',sans-serif",fontWeight:500}}>+ Add</button>}
            </div>
            {categories.map(cat=>{
              const id="cat_"+cat.id,hidden=hiddenSorts.includes(id),active=sortBy===id,isDefault=DEFAULT_CATEGORIES.some(d=>d.id===cat.id);
              return(
                <button key={id} onClick={()=>{if(!editMode){onSelect(id);setOpen(false);}}}
                  style={{width:"100%",display:"flex",alignItems:"center",gap:12,background:active&&!editMode?cat.color+"18":"none",border:"none",borderRadius:12,padding:"11px 14px",cursor:editMode?"default":"pointer",opacity:hidden&&!editMode?0.3:1,marginBottom:2,transition:"all 0.15s"}}>
                  <span style={{width:10,height:10,borderRadius:"50%",background:cat.color,display:"inline-block",flexShrink:0}}/>
                  <span style={{fontSize:14,color:active&&!editMode?cat.color:th.text,fontFamily:"'DM Sans',sans-serif",fontWeight:active&&!editMode?600:400,flex:1,textAlign:"left"}}>{cat.label}</span>
                  {active&&!editMode&&<span style={{fontSize:12,color:cat.color}}>✓</span>}
                  {editMode&&<div style={{display:"flex",gap:6}}>
                    <button onClick={e=>{e.stopPropagation();onToggleHide(id);}} style={{background:hidden?th.surface:accent+"22",border:`1px solid ${hidden?th.border2:accent+"44"}`,borderRadius:8,padding:"4px 10px",cursor:"pointer",fontSize:11,color:hidden?th.textMuted:accent,fontFamily:"'DM Sans',sans-serif"}}>{hidden?"Show":"Hide"}</button>
                    {!isDefault&&<button onClick={e=>{e.stopPropagation();onDeleteCategory(cat.id);}} style={{background:"#E07A5F22",border:"1px solid #E07A5F44",borderRadius:8,padding:"4px 8px",cursor:"pointer",fontSize:11,color:"#E07A5F",fontFamily:"'DM Sans',sans-serif"}}>🗑</button>}
                  </div>}
                </button>
              );
            })}
            {editMode&&showNewCat&&(
              <div style={{background:th.surface,borderRadius:14,padding:"14px",marginTop:8,border:`1px solid ${th.border2}`,animation:"fadeIn 0.2s ease"}}>
                <input value={newCatName} onChange={e=>setNewCatName(e.target.value)} placeholder="Category name..."
                  style={{width:"100%",background:th.bg,border:`1px solid ${th.border}`,borderRadius:10,padding:"10px 12px",color:th.text,fontSize:13,marginBottom:10,boxSizing:"border-box"}}/>
                <div style={{display:"flex",flexWrap:"wrap",gap:7,marginBottom:12}}>{SWATCH_COLORS.map(c=><button key={c} onClick={()=>setNewCatColor(c)} style={{width:24,height:24,borderRadius:"50%",background:c,border:`3px solid ${newCatColor===c?"#F0EDE8":"transparent"}`,cursor:"pointer",padding:0,transform:newCatColor===c?"scale(1.18)":"scale(1)",transition:"transform 0.12s"}}/>)}</div>
                <div style={{display:"flex",gap:8}}>
                  <button onClick={()=>{setShowNewCat(false);setNewCatName("");}} style={{flex:1,background:th.bg,border:`1px solid ${th.border}`,borderRadius:10,padding:"9px",color:th.textMuted,fontSize:12,cursor:"pointer",fontFamily:"'DM Sans',sans-serif"}}>Cancel</button>
                  <button onClick={addCat} style={{flex:2,background:newCatColor,border:"none",borderRadius:10,padding:"9px",color:"#fff",fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"'DM Sans',sans-serif"}}>Add "{newCatName||"Category"}"</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

// ─── Sheet ────────────────────────────────────────────────────────────────────
function Sheet({todayInc,todayDone,tomorrowTasks,overdueAll,categories,accent,th,justDone,justDeleted,justEdited,expandedNote,onToggleNote,onToggle,onToggleSubtask,onStart,onMenu,onClose,onMoveAllOverdue,dragS,dragE,doneTodayCount,totalTodayCount}){
  const[showDone,setShowDone]=useState(false);
  const[showOverdue,setShowOverdue]=useState(true);
  const props={categories,accent,th,expandedNote,onToggleNote,onToggle,onToggleSubtask,onStart,onMenu};
  return(
    <div style={{position:"fixed",inset:0,zIndex:100,display:"flex",flexDirection:"column",justifyContent:"flex-end"}}>
      <div style={{position:"absolute",inset:0,background:"rgba(0,0,0,0.65)",backdropFilter:"blur(6px)",animation:"fadeIn 0.2s ease"}} onClick={onClose}/>
      <div onTouchStart={dragS} onTouchEnd={dragE} onMouseDown={dragS} onMouseUp={dragE}
        style={{position:"relative",background:th.surface2,borderRadius:"22px 22px 0 0",padding:"14px 22px 52px",maxHeight:"88vh",overflowY:"auto",animation:"slideUp 0.34s cubic-bezier(0.34,1.08,0.64,1)",boxShadow:"0 -8px 40px rgba(0,0,0,0.5)"}}>
        <div style={{width:38,height:4,background:th.border2,borderRadius:2,margin:"0 auto 18px"}}/>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
          <div>
            <div style={{fontSize:11,color:th.textDim,letterSpacing:1.5,textTransform:"uppercase",fontFamily:"'Space Mono',monospace"}}>Today & Tomorrow</div>
            <div style={{fontSize:16,fontWeight:600,marginTop:3}}>{new Date().toLocaleDateString("en-US",{weekday:"long",month:"short",day:"numeric"})}</div>
          </div>
          <div style={{fontFamily:"'Space Mono',monospace",fontSize:12,color:th.textDim}}>{doneTodayCount}/{totalTodayCount}</div>
        </div>

        {overdueAll.length>0&&(
          <div style={{marginBottom:16}}>
            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
              <button onClick={()=>setShowOverdue(p=>!p)} style={{display:"flex",alignItems:"center",gap:8,background:"none",border:"none",cursor:"pointer",padding:0}}>
                <span style={{fontSize:13,color:"#E07A5F",fontWeight:600}}>⚠️ {overdueAll.length} Overdue</span>
                <span style={{fontSize:10,color:"#E07A5F55"}}>{showOverdue?"▾":"▸"}</span>
              </button>
              <div style={{flex:1,height:1,background:"#E07A5F33"}}/>
              <button onClick={onMoveAllOverdue} style={{background:"#E07A5F22",border:"1px solid #E07A5F44",borderRadius:8,padding:"4px 10px",color:"#E07A5F",fontSize:11,cursor:"pointer",fontFamily:"'DM Sans',sans-serif",fontWeight:600}}>Move all →</button>
            </div>
            {showOverdue&&overdueAll.map(task=><TaskCard key={task.id} task={task} {...props} full overdue isSliding={justDeleted===task.id} isEdited={justEdited===task.id}/>)}
          </div>
        )}

        {todayInc.length===0&&todayDone.length===0&&<div style={{textAlign:"center",color:th.textDim,padding:"28px 0",fontSize:14}}>Nothing scheduled today!</div>}
        {todayInc.length===0&&todayDone.length>0&&<div style={{textAlign:"center",color:"#81B29A",padding:"12px 0 18px",fontSize:13,fontWeight:500}}>All today's tasks complete! 🎉</div>}
        <div style={{display:"flex",flexDirection:"column",gap:0}}>
          {todayInc.map(task=><TaskCard key={task.id} task={task} {...props} full isSliding={justDone===task.id||justDeleted===task.id} isEdited={justEdited===task.id}/>)}
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
            {todayDone.map(task=><TaskCard key={task.id} task={task} {...props} full isSliding={justDeleted===task.id} isEdited={justEdited===task.id}/>)}
          </div>
        )}

        {tomorrowTasks.length>0&&(
          <div style={{marginTop:28}}>
            <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:12}}>
              <div style={{fontSize:13,fontWeight:600,color:"#7B9EC9"}}>Tomorrow</div>
              <div style={{flex:1,height:1,background:th.border}}/>
              <div style={{fontSize:11,color:th.textDim,fontFamily:"'Space Mono',monospace"}}>{tomorrowTasks.length} task{tomorrowTasks.length!==1?"s":""}</div>
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:0}}>
              {tomorrowTasks.map(task=><TaskCard key={task.id} task={task} {...props} full isSliding={justDeleted===task.id} isEdited={justEdited===task.id}/>)}
            </div>
          </div>
        )}
        {tomorrowTasks.length===0&&<div style={{marginTop:28,textAlign:"center",color:th.textDim,fontSize:13}}>Nothing scheduled for tomorrow.</div>}
      </div>
    </div>
  );
}

// ─── Task Card with swipe gestures ───────────────────────────────────────────
function TaskCard({task,categories,accent,th,compact,full,overdue,isSliding,isEdited,isAppearing,expandedNote,onToggleNote,showMoveButtons,onMoveUp,onMoveDown,onToggle,onToggleSubtask,onStart,onMenu}){
  const cat=getCat(task.category,categories);
  const pri=PRIORITY_META[task.priority]||PRIORITY_META.medium;
  const isExpanded=expandedNote===task.id;
  const hasNote=task.notes&&task.notes.trim().length>0;
  const subtasks=task.subtasks||[];
  const subDone=subtasks.filter(s=>s.done).length;
  const subPct=subtasks.length>0?subDone/subtasks.length:0;

  // Swipe gesture state
  const swipeStart=useRef(null);
  const[swipeX,setSwipeX]=useState(0);
  const[swiping,setSwiping]=useState(false);
  const THRESHOLD=60;

  function onSwipeStart(e){
    swipeStart.current={x:e.touches?e.touches[0].clientX:e.clientX,y:e.touches?e.touches[0].clientY:e.clientY};
    setSwiping(false);
  }
  function onSwipeMove(e){
    if(!swipeStart.current)return;
    const dx=(e.touches?e.touches[0].clientX:e.clientX)-swipeStart.current.x;
    const dy=(e.touches?e.touches[0].clientY:e.clientY)-swipeStart.current.y;
    if(Math.abs(dy)>Math.abs(dx)&&!swiping)return; // vertical scroll wins
    e.preventDefault&&e.preventDefault();
    setSwiping(true);
    setSwipeX(Math.max(-120,Math.min(60,dx)));
  }
  function onSwipeEnd(){
    if(!swiping){swipeStart.current=null;return;}
    if(swipeX<-THRESHOLD){haptic("error");onMenu(task,{stopPropagation:()=>{}});} // swipe left → menu
    else if(swipeX>THRESHOLD&&!task.done){haptic("success");onStart(task);} // swipe right → timer
    setSwipeX(0);setSwiping(false);swipeStart.current=null;
  }

  const swipeAction=swipeX<-THRESHOLD?"delete":swipeX>THRESHOLD&&!task.done?"timer":null;

  return(
    <div className={`task-wrap${isSliding?" collapsing":""}`} style={{marginBottom:compact?6:9,"--wrap-mb":compact?"6px":"9px","--wrap-h":"200px",position:"relative"}}>
      {/* Swipe hint backgrounds */}
      {swiping&&swipeAction==="timer"&&<div style={{position:"absolute",inset:0,borderRadius:compact?12:14,background:accent+"33",display:"flex",alignItems:"center",paddingLeft:16,zIndex:0}}><span style={{fontSize:18}}>▶</span></div>}
      {swiping&&swipeAction==="delete"&&<div style={{position:"absolute",inset:0,borderRadius:compact?12:14,background:"#E07A5F33",display:"flex",alignItems:"center",justifyContent:"flex-end",paddingRight:16,zIndex:0}}><span style={{fontSize:18}}>⋯</span></div>}

      <div className={`task-card${isEdited?" edited":""}${isAppearing?" appearing":""} swipe-card`}
        style={{background:th.surface,borderRadius:compact?12:14,padding:compact?"11px 14px":"14px 16px",border:`1px solid ${overdue?"#E07A5F33":th.border}`,borderLeftWidth:3,borderLeftColor:overdue?"#E07A5F":cat.color,borderLeftStyle:"solid",opacity:task.done?0.45:1,position:"relative",zIndex:1,transform:`translateX(${swipeX}px)`,transition:swiping?"none":"transform 0.3s cubic-bezier(0.34,1.2,0.64,1)"}}
        onTouchStart={onSwipeStart} onTouchMove={onSwipeMove} onTouchEnd={onSwipeEnd}
        onMouseDown={onSwipeStart} onMouseMove={onSwipeMove} onMouseUp={onSwipeEnd}>

        <div style={{display:"flex",alignItems:"center",gap:11}}>
          {showMoveButtons&&(
            <div style={{display:"flex",flexDirection:"column",gap:2,marginRight:-4}}>
              <button onClick={()=>onMoveUp(task.id)} style={{background:"none",border:"none",color:th.textDim,cursor:"pointer",fontSize:10,padding:"1px 4px",lineHeight:1}}>▲</button>
              <button onClick={()=>onMoveDown(task.id)} style={{background:"none",border:"none",color:th.textDim,cursor:"pointer",fontSize:10,padding:"1px 4px",lineHeight:1}}>▼</button>
            </div>
          )}
          <button onClick={()=>onToggle(task.id)} style={{width:22,height:22,borderRadius:"50%",border:`2px solid ${task.done?"#81B29A":th.border2}`,background:task.done?"#81B29A":"transparent",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,transition:"all 0.28s cubic-bezier(0.34,1.56,0.64,1)"}}>
            {task.done&&<svg width="10" height="8" viewBox="0 0 10 8" fill="none"><path d="M1 4L3.5 6.5L9 1" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>}
          </button>
          <div style={{flex:1,minWidth:0}}>
            <div style={{display:"flex",alignItems:"center",gap:6}}>
              <div style={{fontSize:compact?13:14,fontWeight:500,textDecoration:task.done?"line-through":"none",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",color:task.done?th.textMuted:th.text,transition:"color 0.3s",flex:1}}>{task.title}</div>
              {task.recur&&task.recur!=="none"&&<span style={{fontSize:9,color:th.textDim,background:th.surface2,borderRadius:4,padding:"1px 5px",flexShrink:0}}>↻</span>}
              {overdue&&<span style={{fontSize:9,color:"#E07A5F",background:"#E07A5F22",borderRadius:4,padding:"1px 5px",flexShrink:0,fontWeight:700}}>OVERDUE</span>}
            </div>
            <div style={{display:"flex",gap:7,marginTop:compact?3:5,flexWrap:"wrap",alignItems:"center"}}>
              {full&&<span style={{fontSize:10,color:th.textDim,display:"flex",alignItems:"center",gap:3}}><span style={{width:5,height:5,borderRadius:"50%",background:cat.color,display:"inline-block"}}/>{cat.label}</span>}
              {task.workTime&&<span style={{fontSize:10,color:"#7B9EC9"}}>🕐 {fmtTime(task.workTime)}</span>}
              {task.dueTime&&<span style={{fontSize:10,color:"#E07A5F88"}}>⏰ {fmtTime(task.dueTime)}</span>}
              <span style={{fontSize:10,color:th.textDim}}>⏱ {task.minutes}m</span>
              {task.actualMinutes>0&&task.actualMinutes!==task.minutes&&<span style={{fontSize:10,color:th.textMuted}}>({task.actualMinutes}m actual)</span>}
              <span style={{fontSize:9,background:pri.color+"1A",color:pri.color,borderRadius:4,padding:"2px 7px",fontWeight:700,letterSpacing:0.3}}>{pri.label}</span>
              {hasNote&&<button onClick={e=>{e.stopPropagation();onToggleNote(task.id);}} style={{fontSize:9,background:isExpanded?accent+"22":th.surface2,color:isExpanded?accent:th.textMuted,border:`1px solid ${isExpanded?accent+"44":th.border2}`,borderRadius:4,padding:"2px 7px",cursor:"pointer",fontFamily:"'DM Sans',sans-serif",transition:"all 0.15s"}}>{isExpanded?"▲ note":"▼ note"}</button>}
            </div>
            {subtasks.length>0&&(
              <div style={{marginTop:7,display:"flex",alignItems:"center",gap:8}}>
                <div style={{flex:1,background:th.bg,borderRadius:4,height:4,overflow:"hidden"}}>
                  <div style={{height:"100%",background:cat.color,borderRadius:4,width:`${subPct*100}%`,transition:"width 0.4s ease"}}/>
                </div>
                <span style={{fontSize:9,color:th.textMuted,fontFamily:"'Space Mono',monospace",flexShrink:0}}>{subDone}/{subtasks.length}</span>
              </div>
            )}
          </div>
          <div style={{display:"flex",gap:5,alignItems:"center",flexShrink:0}}>
            {!task.done&&<button onClick={()=>onStart(task)} style={{background:accent+"1A",border:"none",borderRadius:8,padding:"6px 10px",color:accent,fontSize:11,cursor:"pointer",fontWeight:700,fontFamily:"'DM Sans',sans-serif"}}>▶</button>}
            <button onClick={e=>onMenu(task,e)} style={{background:"none",border:"none",color:th.textDim,fontSize:17,cursor:"pointer",padding:"3px 5px",lineHeight:1,borderRadius:6}}>⋯</button>
          </div>
        </div>
        {hasNote&&isExpanded&&(
          <div style={{marginTop:10,paddingLeft:33,animation:"noteExpand 0.2s ease"}}>
            <div style={{fontSize:12,color:th.textMuted,lineHeight:1.6,background:th.surface2,borderRadius:8,padding:"8px 12px",border:`1px solid ${th.border}`}}>{task.notes}</div>
          </div>
        )}
        {subtasks.length>0&&isExpanded&&(
          <div style={{marginTop:8,paddingLeft:33,animation:"noteExpand 0.2s ease"}}>
            {subtasks.map(s=>(
              <div key={s.id} style={{display:"flex",alignItems:"center",gap:8,padding:"5px 0",borderBottom:`1px solid ${th.border}44`}}>
                <button onClick={e=>{e.stopPropagation();onToggleSubtask(task.id,s.id);}} style={{width:16,height:16,borderRadius:"50%",border:`2px solid ${s.done?"#81B29A":th.border2}`,background:s.done?"#81B29A":"transparent",cursor:"pointer",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center"}}>
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

// ─── Daily Summary ─────────────────────────────────────────────────────────────
function DailySummary({data,accent,onClose}){
  const[phase,setPhase]=useState(0);
  const[ripples]=useState(()=>Array.from({length:6},(_,i)=>({id:i,delay:i*0.3})));
  useEffect(()=>{const t=setTimeout(()=>setPhase(1),200);return()=>clearTimeout(t);},[]);
  const hrs=Math.floor(data.totalFocus/60),mins=data.totalFocus%60;
  return(
    <div style={{position:"fixed",inset:0,zIndex:400,display:"flex",alignItems:"center",justifyContent:"center",background:"rgba(8,8,16,0.95)"}}>
      {ripples.map(r=>(
        <div key={r.id} style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",pointerEvents:"none"}}>
          <div style={{width:200,height:200,borderRadius:"50%",border:`2px solid ${accent}`,opacity:0,animation:`burstRipple 2.4s cubic-bezier(0,0.6,0.4,1) ${r.delay}s forwards`,transform:"scale(0)"}}/>
        </div>
      ))}
      <div style={{position:"relative",textAlign:"center",padding:"0 32px",opacity:phase===1?1:0,transform:phase===1?"translateY(0)":"translateY(40px)",transition:"all 0.7s cubic-bezier(0.34,1.3,0.64,1)"}}>
        <div style={{fontSize:72,marginBottom:16,filter:`drop-shadow(0 0 30px ${accent}88)`}}>🎉</div>
        <div style={{fontFamily:"'Space Mono',monospace",fontSize:13,color:accent,letterSpacing:2,marginBottom:8}}>DAY COMPLETE</div>
        <div style={{fontSize:28,fontWeight:700,marginBottom:24,letterSpacing:-0.5,color:"#F0EDE8"}}>{data.done} tasks done</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:28}}>
          {[{val:hrs>0?`${hrs}h ${mins}m`:`${mins}m`,label:"Focus time",color:accent},{val:`🔥 ${data.streak}`,label:"Day streak",color:"#F2CC8F"}].map(s=>(
            <div key={s.label} style={{background:"#1A1A22",borderRadius:16,padding:"16px",border:"1px solid #1E1E28"}}>
              <div style={{fontFamily:"'Space Mono',monospace",fontSize:22,fontWeight:700,color:s.color}}>{s.val}</div>
              <div style={{fontSize:11,color:"#555",marginTop:4}}>{s.label}</div>
            </div>
          ))}
        </div>
        {data.streak>=7&&<div style={{fontSize:13,color:"#F2CC8F",marginBottom:20,fontWeight:500}}>🏆 {data.streak} day streak — incredible!</div>}
        <button onClick={onClose} style={{background:accent,border:"none",borderRadius:14,padding:"16px 40px",color:"#fff",fontSize:15,fontWeight:600,cursor:"pointer",fontFamily:"'DM Sans',sans-serif",boxShadow:`0 6px 28px ${accent}55`}}>Keep it up →</button>
      </div>
    </div>
  );
}

// ─── Dev Menu ─────────────────────────────────────────────────────────────────
function DevMenu({accent,th,onClose,onResetOnboarding,onResetStorage,onForceOverdue,onForceSummary}){
  const[hapticResult,setHapticResult]=useState("");
  const[animPlaying,setAnimPlaying]=useState("");

  function testHaptic(type){
    haptic(type);
    setHapticResult(`✓ "${type}" fired`);
    setTimeout(()=>setHapticResult(""),1500);
  }
  function testSound(id){playTimerSound(id);}
  function testAnim(name){
    setAnimPlaying(name);
    setTimeout(()=>setAnimPlaying(""),1200);
  }

  return(
    <div style={{position:"fixed",inset:0,zIndex:500,display:"flex",alignItems:"flex-end",justifyContent:"center"}} onClick={onClose}>
      <div style={{position:"absolute",inset:0,background:"rgba(0,0,0,0.7)",backdropFilter:"blur(8px)"}}/>
      <div onClick={e=>e.stopPropagation()} style={{position:"relative",background:th.surface2,borderRadius:"22px 22px 0 0",width:"100%",maxWidth:430,padding:"16px 22px 48px",maxHeight:"88vh",overflowY:"auto",animation:"slideUp 0.3s cubic-bezier(0.34,1.08,0.64,1)",boxShadow:"0 -8px 40px rgba(0,0,0,0.6)"}}>
        <div style={{width:36,height:4,background:th.border2,borderRadius:2,margin:"0 auto 16px"}}/>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
          <div>
            <div style={{fontSize:15,fontWeight:700}}>🛠 Dev Menu</div>
            <div style={{fontSize:11,color:th.textMuted,marginTop:2}}>Testing tools — won't appear in production</div>
          </div>
          <button onClick={onClose} style={{background:"none",border:"none",color:th.textMuted,fontSize:18,cursor:"pointer"}}>✕</button>
        </div>

        {/* Sound tester */}
        <Section label="🔊 Timer Sounds">
          <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
            {AUDIO_OPTIONS.filter(a=>a.id!=="none").map(a=>(
              <button key={a.id} onClick={()=>testSound(a.id)} style={{background:th.surface,border:`1px solid ${th.border2}`,borderRadius:10,padding:"8px 14px",color:th.text,fontSize:12,cursor:"pointer",fontFamily:"'DM Sans',sans-serif",display:"flex",alignItems:"center",gap:6}}>
                <span>{a.icon}</span>{a.label}
              </button>
            ))}
          </div>
        </Section>

        {/* Haptic tester */}
        <Section label="📳 Haptic Feedback">
          <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
            {["light","medium","heavy","success","error","double"].map(h=>(
              <button key={h} onClick={()=>testHaptic(h)} style={{background:th.surface,border:`1px solid ${th.border2}`,borderRadius:10,padding:"8px 14px",color:th.text,fontSize:12,cursor:"pointer",fontFamily:"'DM Sans',sans-serif"}}>
                {h}
              </button>
            ))}
          </div>
          {hapticResult&&<div style={{marginTop:8,fontSize:12,color:"#81B29A",fontFamily:"'Space Mono',monospace"}}>{hapticResult}</div>}
          {!navigator.vibrate&&<div style={{marginTop:8,fontSize:11,color:"#E07A5F"}}>⚠️ Vibration API not available on this device/browser</div>}
        </Section>

        {/* Animation tester */}
        <Section label="✨ Animations">
          <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
            {[
              {id:"cardSlideIn",label:"Card Slide In"},
              {id:"editPulse",label:"Edit Pulse"},
              {id:"fadeIn",label:"Fade In"},
            ].map(a=>(
              <button key={a.id} onClick={()=>testAnim(a.id)} style={{background:th.surface,border:`1px solid ${animPlaying===a.id?accent:th.border2}`,borderRadius:10,padding:"8px 14px",color:animPlaying===a.id?accent:th.text,fontSize:12,cursor:"pointer",fontFamily:"'DM Sans',sans-serif",transition:"all 0.2s"}}>
                {a.label}
              </button>
            ))}
          </div>
          <div style={{marginTop:12,background:th.surface,borderRadius:12,padding:"14px 16px",border:`1px solid ${th.border}`}}>
            <div style={{fontSize:11,color:th.textDim,marginBottom:8}}>Preview card:</div>
            <div className={animPlaying?`task-card ${animPlaying}`:"task-card"} style={{background:th.surface2,borderRadius:12,padding:"12px 14px",borderLeft:`3px solid ${accent}`,border:`1px solid ${th.border}`}}>
              <div style={{fontWeight:500,fontSize:13}}>Sample Task</div>
              <div style={{fontSize:11,color:th.textMuted,marginTop:4}}>🕐 3:00 PM · ⏱ 30m · <span style={{background:accent+"1A",color:accent,borderRadius:4,padding:"1px 6px",fontSize:9,fontWeight:700}}>High</span></div>
            </div>
          </div>
        </Section>

        {/* State triggers */}
        <Section label="⚡ Trigger App States">
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            {[
              {label:"Show Onboarding again",   sub:"Resets the seen flag",         fn:onResetOnboarding, color:"#7B9EC9"},
              {label:"Force Overdue task",       sub:"Makes task 1 overdue",         fn:onForceOverdue,    color:"#F2CC8F"},
              {label:"Show Daily Summary",       sub:"Fires the completion modal",   fn:onForceSummary,    color:"#81B29A"},
              {label:"⚠️ Reset ALL storage",    sub:"Clears tasks, settings, etc.", fn:onResetStorage,    color:"#E07A5F"},
            ].map(item=>(
              <button key={item.label} onClick={item.fn} style={{background:item.color+"15",border:`1px solid ${item.color}33`,borderRadius:12,padding:"12px 16px",cursor:"pointer",textAlign:"left",fontFamily:"'DM Sans',sans-serif"}}>
                <div style={{fontSize:13,fontWeight:600,color:item.color}}>{item.label}</div>
                <div style={{fontSize:11,color:th.textMuted,marginTop:2}}>{item.sub}</div>
              </button>
            ))}
          </div>
        </Section>
      </div>
    </div>
  );
}
function Section({label,children}){
  return(
    <div style={{marginBottom:22}}>
      <div style={{fontSize:11,color:"#444",letterSpacing:1.2,textTransform:"uppercase",fontFamily:"'Space Mono',monospace",marginBottom:10}}>{label}</div>
      {children}
    </div>
  );
}

// ─── Settings Page ─────────────────────────────────────────────────────────────
function SettingsPage({settings,setSettings,analytics,categories,tasks,accent,th,streak,templates,onResetStreak,onDeleteTemplate,onAddFromTemplate}){
  const[section,setSection]=useState("general");
  const SECTIONS=[{id:"general",label:"General",icon:"⚙️"},{id:"display",label:"Display",icon:"🎨"},{id:"analytics",label:"Analytics",icon:"📊"},{id:"templates",label:"Templates",icon:"📋"}];
  function Toggle({val,onChange}){return(<div className="toggle-track" onClick={()=>onChange(!val)} style={{width:44,height:25,borderRadius:13,background:val?accent:th.border2,position:"relative",transition:"background 0.25s",flexShrink:0}}><div style={{position:"absolute",top:3,left:val?22:3,width:19,height:19,borderRadius:"50%",background:"#fff",transition:"left 0.25s cubic-bezier(0.34,1.56,0.64,1)",boxShadow:"0 1px 4px rgba(0,0,0,0.3)"}}/></div>);}
  function Row({icon,label,sub,right}){return(<div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"15px 18px",background:th.surface,borderRadius:14,marginBottom:8}}><div style={{display:"flex",alignItems:"center",gap:13}}><span style={{fontSize:18,width:24,textAlign:"center"}}>{icon}</span><div><div style={{fontSize:14,fontWeight:500}}>{label}</div>{sub&&<div style={{fontSize:11,color:th.textMuted,marginTop:2}}>{sub}</div>}</div></div>{right}</div>);}
  const hrs=Math.floor(analytics.totalMinutes/60),mins2=analytics.totalMinutes%60;
  const estHrs=Math.floor(analytics.estimatedMinutes/60),estMins=analytics.estimatedMinutes%60;
  const catData=categories.map(c=>({...c,count:tasks.filter(t=>t.category===c.id).length,done:tasks.filter(t=>t.category===c.id&&t.done).length})).filter(c=>c.count>0).sort((a,b)=>b.count-a.count);
  const maxCount=Math.max(...catData.map(c=>c.count),1);
  return(
    <div style={{flex:1,overflowY:"auto",paddingBottom:80}}>
      <div style={{padding:"52px 24px 18px"}}>
        <div style={{fontSize:11,color:th.textDim,letterSpacing:1.5,textTransform:"uppercase",fontFamily:"'Space Mono',monospace",marginBottom:5}}>Preferences</div>
        <div style={{fontSize:22,fontWeight:600,letterSpacing:-0.3}}>Settings</div>
      </div>
      <div style={{display:"flex",gap:8,padding:"0 24px 20px",overflowX:"auto"}}>
        {SECTIONS.map(s=>(
          <button key={s.id} onClick={()=>setSection(s.id)} style={{flexShrink:0,background:section===s.id?accent+"22":th.surface,border:`1.5px solid ${section===s.id?accent:th.border}`,borderRadius:20,padding:"8px 16px",color:section===s.id?accent:th.textMuted,fontSize:12,fontFamily:"'DM Sans',sans-serif",fontWeight:section===s.id?600:400,cursor:"pointer",display:"flex",alignItems:"center",gap:6,transition:"all 0.18s"}}>
            <span style={{fontSize:13}}>{s.icon}</span>{s.label}
          </button>
        ))}
      </div>
      <div style={{padding:"0 24px"}}>
        {section==="general"&&<>
          <div style={{fontSize:11,color:th.textDim,letterSpacing:1.2,textTransform:"uppercase",fontFamily:"'Space Mono',monospace",marginBottom:12}}>Default Sort</div>
          <div style={{background:th.surface,borderRadius:14,padding:"6px",marginBottom:20}}>
            {buildSortOptions(categories,settings.hiddenSorts).map(s=>(
              <button key={s.id} onClick={()=>setSettings(p=>({...p,sortBy:s.id}))} style={{width:"100%",background:settings.sortBy===s.id?(s.color||accent)+"18":"transparent",border:"none",borderRadius:10,padding:"12px 14px",color:settings.sortBy===s.id?(s.color||accent):th.textMuted,fontSize:14,cursor:"pointer",display:"flex",alignItems:"center",gap:10,fontFamily:"'DM Sans',sans-serif",transition:"all 0.15s"}}>
                {s.isCat?<span style={{width:10,height:10,borderRadius:"50%",background:s.color,display:"inline-block"}}/>:<span style={{fontSize:15}}>{s.icon}</span>}
                <span style={{fontWeight:settings.sortBy===s.id?600:400}}>{s.label}</span>
                {settings.sortBy===s.id&&<span style={{marginLeft:"auto",fontSize:12}}>✓</span>}
              </button>
            ))}
          </div>
          <div style={{fontSize:11,color:th.textDim,letterSpacing:1.2,textTransform:"uppercase",fontFamily:"'Space Mono',monospace",marginBottom:12}}>Timer Sound</div>
          <div style={{background:th.surface,borderRadius:14,padding:"6px",marginBottom:20}}>
            {AUDIO_OPTIONS.map(a=>(
              <button key={a.id} onClick={()=>{setSettings(p=>({...p,timerSound:a.id}));if(a.id!=="none")playTimerSound(a.id);}} style={{width:"100%",background:settings.timerSound===a.id?accent+"18":"transparent",border:"none",borderRadius:10,padding:"12px 14px",color:settings.timerSound===a.id?accent:th.textMuted,fontSize:14,cursor:"pointer",display:"flex",alignItems:"center",gap:10,fontFamily:"'DM Sans',sans-serif",transition:"all 0.15s"}}>
                <span style={{fontSize:15}}>{a.icon}</span>
                <span style={{fontWeight:settings.timerSound===a.id?600:400,flex:1,textAlign:"left"}}>{a.label}</span>
                {settings.timerSound===a.id&&<span style={{fontSize:11,color:accent}}>▶ preview</span>}
              </button>
            ))}
          </div>
          <Row icon="🔥" label="Show Streak" sub="Streak counter on home" right={<Toggle val={settings.showStreak} onChange={v=>setSettings(p=>({...p,showStreak:v}))}/>}/>
          <Row icon="🔔" label="Notifications" sub="Reminders before tasks" right={<Toggle val={settings.notificationsOn} onChange={v=>setSettings(p=>({...p,notificationsOn:v}))}/>}/>
          <div style={{marginTop:20,background:th.surface,borderRadius:14,padding:"16px 18px"}}>
            <div style={{fontSize:11,color:th.textDim,letterSpacing:1,textTransform:"uppercase",fontFamily:"'Space Mono',monospace",marginBottom:10}}>Default Focus: {settings.defaultMinutes} min</div>
            <input type="range" min={5} max={120} step={5} value={settings.defaultMinutes} onChange={e=>setSettings(p=>({...p,defaultMinutes:Number(e.target.value)}))} style={{width:"100%",accentColor:accent}}/>
            <div style={{display:"flex",justifyContent:"space-between",fontSize:11,color:th.textDim,marginTop:4}}><span>5m</span><span>2h</span></div>
          </div>
        </>}
        {section==="display"&&<>
          <div style={{fontSize:11,color:th.textDim,letterSpacing:1.2,textTransform:"uppercase",fontFamily:"'Space Mono',monospace",marginBottom:12}}>Theme</div>
          <div style={{display:"flex",gap:10,marginBottom:20}}>
            {[{id:"dark",label:"Dark",icon:"🌙"},{id:"light",label:"Light",icon:"☀️"}].map(t=>(
              <button key={t.id} onClick={()=>setSettings(p=>({...p,theme:t.id}))} style={{flex:1,background:(settings.theme||"dark")===t.id?accent+"22":th.surface,border:`1.5px solid ${(settings.theme||"dark")===t.id?accent:th.border}`,borderRadius:14,padding:"14px",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:8,fontFamily:"'DM Sans',sans-serif",color:(settings.theme||"dark")===t.id?accent:th.textMuted,fontWeight:(settings.theme||"dark")===t.id?600:400,fontSize:14,transition:"all 0.2s"}}>
                <span style={{fontSize:18}}>{t.icon}</span>{t.label}
              </button>
            ))}
          </div>
          <div style={{fontSize:11,color:th.textDim,letterSpacing:1.2,textTransform:"uppercase",fontFamily:"'Space Mono',monospace",marginBottom:12}}>Accent Color</div>
          <div style={{background:th.surface,borderRadius:14,padding:"18px",marginBottom:20}}>
            <div style={{display:"flex",flexWrap:"wrap",gap:12}}>{ACCENT_OPTS.map(c=><button key={c} onClick={()=>setSettings(p=>({...p,accentColor:c}))} style={{width:36,height:36,borderRadius:"50%",background:c,border:`3px solid ${settings.accentColor===c?"#F0EDE8":"transparent"}`,cursor:"pointer",padding:0,transition:"border 0.15s,transform 0.15s",transform:settings.accentColor===c?"scale(1.15)":"scale(1)"}}/>)}</div>
          </div>
          <Row icon="📋" label="Compact View" sub="Smaller task cards" right={<Toggle val={settings.compactView} onChange={v=>setSettings(p=>({...p,compactView:v}))}/>}/>
        </>}
        {section==="analytics"&&<>
          <div style={{background:th.surface,borderRadius:14,padding:"18px 20px",marginBottom:14,border:`1px solid ${th.border}`,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
            <div style={{display:"flex",alignItems:"center",gap:14}}><div style={{fontSize:32}}>🔥</div><div><div style={{fontFamily:"'Space Mono',monospace",fontSize:28,fontWeight:700,color:"#F2CC8F",lineHeight:1}}>{streak}</div><div style={{fontSize:12,color:th.textMuted,marginTop:4}}>day streak</div></div></div>
            <button onClick={onResetStreak} style={{background:"none",border:`1px solid ${th.border2}`,borderRadius:8,padding:"6px 12px",color:th.textMuted,fontSize:11,cursor:"pointer",fontFamily:"'DM Sans',sans-serif"}}>Reset</button>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:14}}>
            {[{label:"Total Tasks",val:analytics.total,icon:"📋",color:"#7B9EC9"},{label:"Completed",val:analytics.done,icon:"✅",color:"#81B29A"},{label:"Actual Focus",val:`${hrs}h ${mins2}m`,icon:"⏱",color:accent},{label:"Done Rate",val:`${analytics.rate}%`,icon:"📈",color:"#C9A7EB"}].map(s=>(
              <div key={s.label} style={{background:th.surface,borderRadius:14,padding:"16px",border:`1px solid ${th.border}`}}>
                <div style={{fontSize:20,marginBottom:8}}>{s.icon}</div>
                <div style={{fontFamily:"'Space Mono',monospace",fontSize:22,fontWeight:700,color:s.color}}>{s.val}</div>
                <div style={{fontSize:11,color:th.textMuted,marginTop:3}}>{s.label}</div>
              </div>
            ))}
          </div>
          <div style={{background:th.surface,borderRadius:14,padding:"16px 18px",marginBottom:14,border:`1px solid ${th.border}`}}>
            <div style={{fontSize:11,color:th.textDim,letterSpacing:1.2,textTransform:"uppercase",fontFamily:"'Space Mono',monospace",marginBottom:12}}>Estimation Accuracy</div>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:8}}><span style={{fontSize:13,color:th.textMuted}}>Est: {estHrs>0?`${estHrs}h `:""}{ estMins}m</span><span style={{fontSize:13,color:accent}}>Actual: {hrs>0?`${hrs}h `:""}{ mins2}m</span></div>
            <div style={{background:th.bg,borderRadius:8,height:8,overflow:"hidden"}}><div style={{height:"100%",background:`linear-gradient(to right,${accent},#81B29A)`,borderRadius:8,width:`${Math.min((analytics.totalMinutes/Math.max(analytics.estimatedMinutes,1))*100,100)}%`,transition:"width 1s ease"}}/></div>
          </div>
          <div style={{background:th.surface,borderRadius:14,padding:"16px 18px",border:`1px solid ${th.border}`}}>
            <div style={{fontSize:11,color:th.textDim,letterSpacing:1.2,textTransform:"uppercase",fontFamily:"'Space Mono',monospace",marginBottom:14}}>By Category</div>
            {catData.map(cat=>(
              <div key={cat.id} style={{marginBottom:12}}>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:5}}><div style={{display:"flex",alignItems:"center",gap:7}}><span style={{width:7,height:7,borderRadius:"50%",background:cat.color,display:"inline-block"}}/><span style={{fontSize:13,fontWeight:500}}>{cat.label}</span></div><span style={{fontFamily:"'Space Mono',monospace",fontSize:11,color:th.textMuted}}>{cat.done}/{cat.count}</span></div>
                <div style={{background:th.bg,borderRadius:6,height:6,overflow:"hidden"}}><div style={{height:"100%",background:cat.color,borderRadius:6,width:`${(cat.count/maxCount)*100}%`,opacity:0.7,transition:"width 0.8s ease"}}/></div>
              </div>
            ))}
          </div>
          <div style={{marginTop:24,textAlign:"center",fontSize:11,color:th.textDim,fontFamily:"'Space Mono',monospace",letterSpacing:1}}>TASKFLOW v3.0</div>
        </>}
        {section==="templates"&&<>
          <div style={{fontSize:11,color:th.textDim,letterSpacing:1.2,textTransform:"uppercase",fontFamily:"'Space Mono',monospace",marginBottom:12}}>Saved Templates</div>
          {templates.length===0&&<div style={{textAlign:"center",color:th.textDim,padding:"40px 0",fontSize:13}}>No templates yet.<br/>Use ⋯ on any task to save as template.</div>}
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            {templates.map(t=>(
              <div key={t.id} style={{display:"flex",alignItems:"center",gap:12,background:th.surface,borderRadius:14,padding:"14px 16px",border:`1px solid ${th.border}`}}>
                <span style={{fontSize:20}}>{t.icon}</span>
                <div style={{flex:1}}><div style={{fontSize:14,fontWeight:500}}>{t.name}</div><div style={{fontSize:11,color:th.textMuted,marginTop:2}}>{t.task.minutes}min · {t.task.priority} · {getCat(t.task.category,categories).label}</div></div>
                <button onClick={()=>onAddFromTemplate(t)} style={{background:accent+"22",border:`1px solid ${accent}44`,borderRadius:8,padding:"6px 12px",color:accent,fontSize:12,cursor:"pointer",fontFamily:"'DM Sans',sans-serif",fontWeight:600}}>Use</button>
                <button onClick={()=>onDeleteTemplate(t.id)} style={{background:"none",border:"none",color:th.textDim,fontSize:16,cursor:"pointer",padding:"4px"}}>🗑</button>
              </div>
            ))}
          </div>
        </>}
      </div>
    </div>
  );
}

// ─── Task Form ─────────────────────────────────────────────────────────────────
function TaskFormPage({mode,initialData,categories,setCategories,settings,onSave,onClose,accent,th}){
  const[form,setForm]=useState({subtasks:[],...initialData,recur:initialData?.recur||"none"});
  const[showNewCat,setShowNewCat]=useState(false);
  const[newCatName,setNewCatName]=useState("");
  const[newCatColor,setNewCatColor]=useState("#7B9EC9");
  const[newSubtask,setNewSubtask]=useState("");
  // No min date restriction — allow any date
  const todayISO=new Date().toISOString().split("T")[0];

  function addCategory(){if(!newCatName.trim())return;const id="cust_"+Date.now();setCategories(prev=>[...prev,{id,label:newCatName.trim(),color:newCatColor}]);setForm(f=>({...f,category:id}));setNewCatName("");setShowNewCat(false);}
  function addSubtask(){if(!newSubtask.trim())return;setForm(f=>({...f,subtasks:[...(f.subtasks||[]),{id:"s"+Date.now(),text:newSubtask.trim(),done:false}]}));setNewSubtask("");}
  function removeSubtask(id){setForm(f=>({...f,subtasks:(f.subtasks||[]).filter(s=>s.id!==id)}));}
  const estFinish=calcEstFinish(form.workTime,form.minutes);

  return(
    <PageTransition>
      <div style={{fontFamily:"'DM Sans',sans-serif",background:th.bg,minHeight:"100vh",color:th.text,maxWidth:430,margin:"0 auto",display:"flex",flexDirection:"column"}}>
        <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=Space+Mono:wght@400;700&display=swap" rel="stylesheet"/>
        <style>{`input,textarea{outline:none;font-family:'DM Sans',sans-serif;}*{box-sizing:border-box;}`}</style>
        <div style={{padding:"52px 24px 0",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <button onClick={onClose} style={{background:"none",border:"none",color:th.textMuted,fontSize:14,cursor:"pointer",fontFamily:"'DM Sans',sans-serif"}}>← Cancel</button>
          <div style={{fontFamily:"'Space Mono',monospace",fontSize:11,color:th.textMuted,letterSpacing:1.5,textTransform:"uppercase"}}>{mode==="edit"?"Edit Task":"New Task"}</div>
          <div style={{width:60}}/>
        </div>
        <div style={{flex:1,overflowY:"auto",padding:"24px 24px 40px"}}>
          <div style={{fontSize:23,fontWeight:600,marginBottom:24,letterSpacing:-0.3}}>{mode==="edit"?"Edit task":"What's the task?"}</div>

          <FField label="Title" th={th}>
            <input value={form.title} onChange={e=>setForm(f=>({...f,title:e.target.value}))} placeholder="e.g. Study for exam"
              style={{width:"100%",background:th.surface,border:`1px solid ${th.border}`,borderRadius:12,padding:"14px 16px",color:th.text,fontSize:15}}
              onFocus={e=>e.target.style.borderColor=accent} onBlur={e=>e.target.style.borderColor=th.border}/>
          </FField>

          <FField label="Notes" th={th}>
            <textarea value={form.notes} onChange={e=>setForm(f=>({...f,notes:e.target.value}))} placeholder="Any extra details..."
              style={{width:"100%",background:th.surface,border:`1px solid ${th.border}`,borderRadius:12,padding:"14px 16px",color:th.text,fontSize:14,resize:"none",height:76}}
              onFocus={e=>e.target.style.borderColor=accent} onBlur={e=>e.target.style.borderColor=th.border}/>
          </FField>

          <FField label="Subtasks" th={th}>
            <div style={{display:"flex",flexDirection:"column",gap:6,marginBottom:8}}>
              {(form.subtasks||[]).map(s=>(
                <div key={s.id} style={{display:"flex",alignItems:"center",gap:8,background:th.surface,borderRadius:10,padding:"10px 12px",border:`1px solid ${th.border}`}}>
                  <span style={{width:14,height:14,borderRadius:"50%",border:`2px solid ${th.border2}`,display:"inline-block",flexShrink:0}}/>
                  <span style={{flex:1,fontSize:13,color:th.textMuted}}>{s.text}</span>
                  <button onClick={()=>removeSubtask(s.id)} style={{background:"none",border:"none",color:th.textDim,fontSize:14,cursor:"pointer",padding:"2px"}}>✕</button>
                </div>
              ))}
            </div>
            <div style={{display:"flex",gap:8}}>
              <input value={newSubtask} onChange={e=>setNewSubtask(e.target.value)} onKeyDown={e=>{if(e.key==="Enter")addSubtask();}} placeholder="Add a subtask…"
                style={{flex:1,background:th.surface,border:`1px solid ${th.border}`,borderRadius:10,padding:"10px 12px",color:th.text,fontSize:13}}
                onFocus={e=>e.target.style.borderColor=accent} onBlur={e=>e.target.style.borderColor=th.border}/>
              {newSubtask&&<button onClick={addSubtask} style={{background:accent+"22",border:`1px solid ${accent}44`,borderRadius:10,padding:"10px 14px",color:accent,fontSize:13,cursor:"pointer",fontFamily:"'DM Sans',sans-serif",fontWeight:600}}>Add</button>}
            </div>
          </FField>

          <FField label="Category" th={th}>
            <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
              {categories.map(cat=>(
                <button key={cat.id} onClick={()=>setForm(f=>({...f,category:cat.id}))} style={{background:form.category===cat.id?cat.color+"25":th.surface,border:`1.5px solid ${form.category===cat.id?cat.color:th.border}`,borderRadius:10,padding:"8px 13px",color:form.category===cat.id?cat.color:th.textMuted,fontSize:13,cursor:"pointer",fontFamily:"'DM Sans',sans-serif",fontWeight:500,transition:"all 0.15s",display:"flex",alignItems:"center",gap:6}}>
                  <span style={{width:6,height:6,borderRadius:"50%",background:cat.color,display:"inline-block"}}/>{cat.label}
                </button>
              ))}
              {!showNewCat&&<button onClick={()=>setShowNewCat(true)} style={{background:"none",border:`1.5px dashed ${th.border2}`,borderRadius:10,padding:"8px 13px",color:th.textDim,fontSize:13,cursor:"pointer",fontFamily:"'DM Sans',sans-serif"}}>+ New</button>}
            </div>
            {showNewCat&&(
              <div style={{marginTop:12,background:th.surface,borderRadius:14,padding:"16px",border:`1px solid ${th.border}`}}>
                <input value={newCatName} onChange={e=>setNewCatName(e.target.value)} placeholder="Name..." style={{width:"100%",background:th.bg,border:`1px solid ${th.border}`,borderRadius:10,padding:"12px 14px",color:th.text,fontSize:14,marginBottom:12}}/>
                <div style={{display:"flex",flexWrap:"wrap",gap:8,marginBottom:14}}>{SWATCH_COLORS.map(c=><button key={c} onClick={()=>setNewCatColor(c)} style={{width:26,height:26,borderRadius:"50%",background:c,border:`3px solid ${newCatColor===c?"#F0EDE8":"transparent"}`,cursor:"pointer",padding:0,transform:newCatColor===c?"scale(1.18)":"scale(1)",transition:"transform 0.12s"}}/>)}</div>
                <div style={{display:"flex",gap:8}}>
                  <button onClick={()=>{setShowNewCat(false);setNewCatName("");}} style={{flex:1,background:th.bg,border:`1px solid ${th.border}`,borderRadius:10,padding:"11px",color:th.textMuted,fontSize:13,cursor:"pointer",fontFamily:"'DM Sans',sans-serif"}}>Cancel</button>
                  <button onClick={addCategory} style={{flex:2,background:newCatColor,border:"none",borderRadius:10,padding:"11px",color:"#fff",fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:"'DM Sans',sans-serif"}}>Add "{newCatName||"Category"}"</button>
                </div>
              </div>
            )}
          </FField>

          <FField label="Recurring" th={th}>
            <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
              {RECUR_OPTIONS.map(r=>(
                <button key={r.id} onClick={()=>setForm(f=>({...f,recur:r.id}))} style={{background:(form.recur||"none")===r.id?accent+"25":th.surface,border:`1.5px solid ${(form.recur||"none")===r.id?accent:th.border}`,borderRadius:10,padding:"8px 13px",color:(form.recur||"none")===r.id?accent:th.textMuted,fontSize:12,cursor:"pointer",fontFamily:"'DM Sans',sans-serif",fontWeight:500,transition:"all 0.15s"}}>{r.label}</button>
              ))}
            </div>
          </FField>

          <FField label="Priority" th={th}>
            <div style={{display:"flex",gap:8}}>
              {[{id:"low",label:"Low",color:"#81B29A"},{id:"medium",label:"Medium",color:"#F2CC8F"},{id:"high",label:"High",color:accent}].map(p=>(
                <button key={p.id} onClick={()=>setForm(f=>({...f,priority:p.id}))} style={{flex:1,background:form.priority===p.id?p.color+"25":th.surface,border:`1.5px solid ${form.priority===p.id?p.color:th.border}`,borderRadius:10,padding:"11px 0",color:form.priority===p.id?p.color:th.textMuted,fontSize:13,cursor:"pointer",fontFamily:"'DM Sans',sans-serif",fontWeight:500,transition:"all 0.15s"}}>{p.label}</button>
              ))}
            </div>
          </FField>

          <FField label={`Focus Duration: ${form.minutes} min`} th={th}>
            <input type="range" min={5} max={180} step={5} value={form.minutes} onChange={e=>setForm(f=>({...f,minutes:Number(e.target.value)}))} style={{width:"100%",accentColor:accent,height:4}}/>
            <div style={{display:"flex",justifyContent:"space-between",fontSize:11,color:th.textDim,marginTop:5}}><span>5m</span><span>3h</span></div>
          </FField>

          {/* Date — NO min restriction so past dates work */}
          <FField label="Date" th={th}>
            <div style={{position:"relative"}}>
              <input type="date" value={form.date?new Date(form.date).toLocaleDateString("en-CA"):todayISO}
                onChange={e=>{if(!e.target.value)return;const d=new Date(e.target.value+"T12:00:00");setForm(f=>({...f,date:d.toDateString()}));}}
                style={{width:"100%",background:th.surface,border:`1px solid ${th.border}`,borderRadius:12,padding:"13px 36px 13px 12px",color:th.text,fontSize:13,colorScheme:settings.theme==="light"?"light":"dark"}}/>
              {form.date&&form.date!==todayStr()&&<button onClick={()=>setForm(f=>({...f,date:todayStr()}))} style={{position:"absolute",right:10,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",color:th.textDim,fontSize:14,cursor:"pointer",padding:"4px",lineHeight:1}}>↩</button>}
            </div>
          </FField>

          <div style={{display:"flex",gap:12}}>
            <div style={{flex:1}}>
              <FField label="🕐 Work Time" th={th}>
                <div style={{position:"relative"}}>
                  <input type="time" value={form.workTime||""} onChange={e=>setForm(f=>({...f,workTime:e.target.value}))}
                    style={{width:"100%",background:th.surface,border:`1px solid ${th.border}`,borderRadius:12,padding:form.workTime?"13px 32px 13px 12px":"13px 12px",color:"#7B9EC9",fontSize:13,colorScheme:settings.theme==="light"?"light":"dark"}}/>
                  {form.workTime&&<button onClick={()=>setForm(f=>({...f,workTime:""}))} style={{position:"absolute",right:8,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",color:th.textDim,fontSize:13,cursor:"pointer",padding:"4px",lineHeight:1}}>✕</button>}
                </div>
                <div style={{fontSize:10,color:th.textDim,marginTop:4}}>When you'll start</div>
              </FField>
            </div>
            <div style={{flex:1}}>
              <FField label="⏰ Due Time" th={th}>
                <div style={{position:"relative"}}>
                  <input type="time" value={form.dueTime||""} onChange={e=>setForm(f=>({...f,dueTime:e.target.value}))}
                    style={{width:"100%",background:th.surface,border:`1px solid ${th.border}`,borderRadius:12,padding:form.dueTime?"13px 32px 13px 12px":"13px 12px",color:"#E07A5F88",fontSize:13,colorScheme:settings.theme==="light"?"light":"dark"}}/>
                  {form.dueTime&&<button onClick={()=>setForm(f=>({...f,dueTime:""}))} style={{position:"absolute",right:8,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",color:th.textDim,fontSize:13,cursor:"pointer",padding:"4px",lineHeight:1}}>✕</button>}
                </div>
                <div style={{fontSize:10,color:th.textDim,marginTop:4}}>Deadline</div>
              </FField>
            </div>
          </div>

          <div style={{display:"flex",alignItems:"center",gap:10,background:th.surface,border:`1px solid ${th.border}`,borderRadius:12,padding:"13px 16px",marginBottom:20}}>
            <span style={{fontSize:16}}>🏁</span>
            <div><div style={{fontSize:11,color:th.textDim,letterSpacing:1,textTransform:"uppercase",fontFamily:"'Space Mono',monospace",marginBottom:2}}>Est. Finish</div><div style={{fontSize:14,fontWeight:500,color:accent}}>{estFinish}</div></div>
          </div>

          <button onClick={()=>onSave(form)} style={{width:"100%",background:accent,border:"none",borderRadius:14,padding:"17px",color:"#fff",fontSize:16,fontWeight:600,cursor:"pointer",fontFamily:"'DM Sans',sans-serif",boxShadow:`0 6px 24px ${accent}40`,transition:"opacity 0.15s,transform 0.15s"}}
            onMouseDown={e=>{e.currentTarget.style.opacity="0.85";e.currentTarget.style.transform="scale(0.98)";}}
            onMouseUp={e=>{e.currentTarget.style.opacity="1";e.currentTarget.style.transform="scale(1)";}}>
            {mode==="edit"?"Save Changes":"Add Task"}
          </button>
          {mode==="edit"&&<button onClick={onClose} style={{width:"100%",background:"none",border:`1.5px solid ${accent}25`,borderRadius:14,padding:"15px",color:accent+"88",fontSize:14,cursor:"pointer",fontFamily:"'DM Sans',sans-serif",marginTop:10}}>Cancel without saving</button>}
        </div>
      </div>
    </PageTransition>
  );
}
function FField({label,children,th}){
  return(
    <div style={{marginBottom:20}}>
      <div style={{fontSize:11,color:th?.textDim||"#444",letterSpacing:1.2,textTransform:"uppercase",fontFamily:"'Space Mono',monospace",marginBottom:9}}>{label}</div>
      {children}
    </div>
  );
}

// ─── Timer Page ───────────────────────────────────────────────────────────────
function TimerPage({task,categories,accent,timerSound,th,onBack,onDone}){
  const totalSecs=task.minutes*60;
  const[remaining,setRemaining]=useState(totalSecs);
  const[running,setRunning]=useState(false);
  const[startedAt,setStartedAt]=useState(null);
  const[focusLock,setFocusLock]=useState(false);
  const[finished,setFinished]=useState(false);
  const[showBurst,setShowBurst]=useState(false);
  const sessionStart=useRef(null);
  const cat=getCat(task.category,categories);
  const pct=1-remaining/totalSecs;
  const r=100,circ=2*Math.PI*r;
  const BURST_COLORS=[cat.color,accent,"#81B29A","#F2CC8F","#7B9EC9"];

  useEffect(()=>{
    if(!running)return;
    if(!startedAt)setStartedAt(Date.now());
    if(!sessionStart.current)sessionStart.current=Date.now();
    const id=setInterval(()=>setRemaining(p=>{
      if(p<=1){
        clearInterval(id);setRunning(false);setFinished(true);
        setShowBurst(true);haptic("success");
        if(timerSound&&timerSound!=="none")playTimerSound(timerSound);
        setTimeout(()=>setShowBurst(false),3500);
        return 0;
      }
      return p-1;
    }),1000);
    return()=>clearInterval(id);
  },[running]);

  useEffect(()=>{if(running&&!focusLock)setFocusLock(true);},[running]);

  const mins=String(Math.floor(remaining/60)).padStart(2,"0");
  const secs=String(remaining%60).padStart(2,"0");
  const elapsed=totalSecs-remaining;
  function getActualMins(){if(!sessionStart.current)return task.minutes;return Math.max(1,Math.round((Date.now()-sessionStart.current)/60000));}

  const estFinishStr=(()=>{
    if(task.workTime){const[h,m]=task.workTime.split(":").map(Number);const b=new Date();b.setHours(h,m,0,0);const f=new Date(b.getTime()+task.minutes*60000);return`${f.getHours()%12||12}:${String(f.getMinutes()).padStart(2,"0")} ${f.getHours()>=12?"PM":"AM"}`;}
    const origin=startedAt||Date.now();const f=new Date(origin+remaining*1000);
    return`${f.getHours()%12||12}:${String(f.getMinutes()).padStart(2,"0")} ${f.getHours()>=12?"PM":"AM"}`;
  })();

  return(
    <PageTransition>
      <div style={{fontFamily:"'DM Sans',sans-serif",background:focusLock&&running?"#080810":th.bg,minHeight:"100vh",color:th.text,maxWidth:430,margin:"0 auto",display:"flex",flexDirection:"column",alignItems:"center",transition:"background 0.6s",position:"relative",overflow:"hidden"}}>
        <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=Space+Mono:wght@400;700&display=swap" rel="stylesheet"/>
        <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.5}}@keyframes burstRipple{0%{transform:scale(0);opacity:0.9}100%{transform:scale(5);opacity:0}}@keyframes burstFade{0%{opacity:1}100%{opacity:0}}@keyframes fadeIn{from{opacity:0}to{opacity:1}}`}</style>

        {showBurst&&(
          <div style={{position:"fixed",inset:0,zIndex:10,pointerEvents:"none",display:"flex",alignItems:"center",justifyContent:"center"}}>
            {[0,0.2,0.4,0.6,0.8,1.0].map((delay,i)=>(
              <div key={i} style={{position:"absolute",width:200,height:200,borderRadius:"50%",border:`3px solid ${BURST_COLORS[i%BURST_COLORS.length]}`,animation:`burstRipple 1.8s cubic-bezier(0,0.5,0.3,1) ${delay}s forwards`,opacity:0}}/>
            ))}
            <div style={{position:"absolute",inset:0,background:`radial-gradient(circle at center,${cat.color}22 0%,transparent 70%)`,animation:"burstFade 2s ease forwards"}}/>
            {Array.from({length:24}).map((_,i)=>{const angle=(i/24)*360,dist=80+Math.random()*120,x=Math.cos(angle*Math.PI/180)*dist,y=Math.sin(angle*Math.PI/180)*dist;return(<div key={i} style={{position:"absolute",width:8,height:8,borderRadius:"50%",background:BURST_COLORS[i%BURST_COLORS.length],transform:`translate(${x}px,${y}px)`,animation:`burstRipple 1.2s ease ${i*0.04}s forwards`,opacity:0}}/>);})}
            <div style={{position:"relative",fontSize:64,animation:"burstFade 2.5s ease forwards",filter:`drop-shadow(0 0 40px ${cat.color})`}}>✓</div>
          </div>
        )}

        <div style={{width:"100%",padding:"52px 24px 0",display:"flex",alignItems:"center",justifyContent:"space-between",opacity:focusLock&&running?0:1,transition:"opacity 0.4s",pointerEvents:focusLock&&running?"none":"auto"}}>
          <button onClick={onBack} style={{background:"none",border:"none",color:th.textDim,fontSize:14,cursor:"pointer",fontFamily:"'DM Sans',sans-serif"}}>← Back</button>
          <button onClick={()=>setFocusLock(p=>!p)} style={{background:focusLock?th.surface:"none",border:`1px solid ${focusLock?cat.color+"44":th.border2}`,borderRadius:20,padding:"6px 12px",color:focusLock?cat.color:th.textMuted,fontSize:11,cursor:"pointer",fontFamily:"'DM Sans',sans-serif",display:"flex",alignItems:"center",gap:6,transition:"all 0.2s"}}>
            <span style={{fontSize:12}}>{focusLock?"🔒":"🔓"}</span>{focusLock?"Focus Lock On":"Focus Lock"}
          </button>
        </div>

        {focusLock&&running&&(
          <div style={{position:"fixed",top:0,left:"50%",transform:"translateX(-50%)",width:"100%",maxWidth:430,padding:"16px 24px",display:"flex",justifyContent:"space-between",alignItems:"center",zIndex:10,animation:"fadeIn 0.3s ease"}}>
            <div style={{display:"flex",alignItems:"center",gap:8}}><span style={{fontSize:14,color:cat.color}}>🔒</span><span style={{fontSize:11,color:th.textDim,fontFamily:"'Space Mono',monospace",letterSpacing:1}}>FOCUS MODE</span></div>
            <button onClick={()=>setFocusLock(false)} style={{background:"none",border:`1px solid ${th.border2}`,borderRadius:12,padding:"5px 10px",color:th.textMuted,fontSize:11,cursor:"pointer",fontFamily:"'DM Sans',sans-serif"}}>Unlock</button>
          </div>
        )}

        <div style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"0 32px",width:"100%"}}>
          <div style={{opacity:focusLock&&running?0.25:1,transition:"opacity 0.4s",textAlign:"center"}}>
            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6,justifyContent:"center"}}>
              <span style={{width:7,height:7,borderRadius:"50%",background:cat.color,display:"inline-block"}}/>
              <span style={{fontSize:11,color:th.textDim,textTransform:"uppercase",letterSpacing:1.5,fontFamily:"'Space Mono',monospace"}}>{cat.label}</span>
            </div>
            <div style={{fontSize:21,fontWeight:600,marginBottom:focusLock&&running?20:24,letterSpacing:-0.3}}>{task.title}</div>
          </div>

          {task.dueTime&&!(focusLock&&running)&&(
            <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:20,background:"#E07A5F18",border:"1px solid #E07A5F33",borderRadius:20,padding:"5px 14px"}}>
              <span style={{fontSize:12}}>⏰</span>
              <span style={{fontSize:12,color:"#E07A5F",fontFamily:"'Space Mono',monospace"}}>Due {fmtTime(task.dueTime)}</span>
            </div>
          )}

          <div style={{position:"relative",width:230,height:230,marginBottom:14}}>
            <svg width="230" height="230" style={{transform:"rotate(-90deg)"}}>
              <circle cx="115" cy="115" r={r} fill="none" stroke={th.surface} strokeWidth="12"/>
              <circle cx="115" cy="115" r={r} fill="none" stroke={finished?"#81B29A":cat.color} strokeWidth="12" strokeLinecap="round"
                strokeDasharray={`${circ*pct} ${circ}`}
                style={{transition:"stroke-dasharray 1s linear,stroke 0.6s ease",filter:`drop-shadow(0 0 ${focusLock&&running?22:14}px ${finished?"#81B29A":cat.color}${focusLock&&running?"99":"66"})`}}/>
            </svg>
            <div style={{position:"absolute",inset:0,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center"}}>
              {finished?<div style={{fontSize:48,animation:"pulse 1.5s ease infinite"}}>✓</div>
                :<div style={{fontFamily:"'Space Mono',monospace",fontSize:focusLock&&running?52:44,fontWeight:700,animation:running?"pulse 2s infinite":"none",letterSpacing:2,transition:"font-size 0.3s"}}>{mins}:{secs}</div>}
              <div style={{fontSize:11,color:th.textDim,marginTop:5,letterSpacing:1}}>{task.minutes}m session</div>
            </div>
          </div>

          {!(focusLock&&running)&&(
            <div style={{display:"flex",gap:0,marginBottom:28,background:th.surface,borderRadius:14,overflow:"hidden",border:`1px solid ${th.border}`,width:"100%",animation:"fadeIn 0.3s ease"}}>
              {[{label:"ELAPSED",val:`${Math.floor(elapsed/60)}:${String(elapsed%60).padStart(2,"0")}`,color:cat.color},{label:"DONE",val:`${Math.round(pct*100)}%`,color:th.textMuted},{label:"EST. FINISH",val:estFinishStr,color:accent}].map((s,i)=>(
                <div key={s.label} style={{flex:1,textAlign:"center",padding:"12px 8px",borderRight:i<2?`1px solid ${th.border}`:"none"}}>
                  <div style={{fontFamily:"'Space Mono',monospace",fontSize:12,color:s.color,fontWeight:700}}>{s.val}</div>
                  <div style={{fontSize:9,color:th.textDim,letterSpacing:1,marginTop:3}}>{s.label}</div>
                </div>
              ))}
            </div>
          )}

          <div style={{display:"flex",gap:12,width:"100%"}}>
            {!finished&&<button onClick={()=>setRunning(p=>!p)} style={{flex:1,background:running?th.surface:cat.color,border:running?`1.5px solid ${th.border}`:"none",borderRadius:14,padding:"17px",color:running?th.text:"#fff",fontSize:16,fontWeight:600,cursor:"pointer",fontFamily:"'DM Sans',sans-serif",transition:"all 0.22s",boxShadow:running?"none":`0 6px 24px ${cat.color}55`}}>
              {running?"Pause":remaining===totalSecs?"Start":"Resume"}
            </button>}
            {remaining<totalSecs&&!finished&&!(focusLock&&running)&&(
              <button onClick={()=>{setRemaining(totalSecs);setRunning(false);setStartedAt(null);sessionStart.current=null;}} style={{background:th.surface,border:`1.5px solid ${th.border}`,borderRadius:14,padding:"17px 18px",color:th.textDim,fontSize:14,cursor:"pointer",fontFamily:"'DM Sans',sans-serif"}}>↺</button>
            )}
          </div>
          {(finished||pct>0)&&!(focusLock&&running)&&(
            <button onClick={()=>onDone(getActualMins())} style={{marginTop:12,width:"100%",background:finished?"#81B29A":"none",border:finished?"none":`1.5px solid #81B29A33`,borderRadius:14,padding:"15px",color:finished?"#fff":"#81B29A",fontSize:14,cursor:"pointer",fontFamily:"'DM Sans',sans-serif",fontWeight:600,boxShadow:finished?"0 4px 20px rgba(129,178,154,0.4)":"none",transition:"all 0.3s"}}>
              ✓ Mark as Complete
            </button>
          )}
        </div>
      </div>
    </PageTransition>
  );
}

// ─── Onboarding ───────────────────────────────────────────────────────────────
const ONBOARDING_SLIDES=[
  {icon:"🎯",title:"Welcome to TaskFlow",body:"Your personal task manager — built to keep you focused, streaking, and on top of everything. Here's a quick tour.",color:"#E07A5F"},
  {icon:"⭕",title:"The Progress Ring",body:"The big circle fills as you complete today's tasks. The number inside is how many you have left. Turn it green by finishing everything.",color:"#81B29A"},
  {icon:"✅",title:"Adding & Completing Tasks",body:"Tap + to add a full task, or use the quick-add bar to type a title and hit Enter. Check the circle on any task to mark it done — watch it slide away.",color:"#7B9EC9"},
  {icon:"👆",title:"Swipe Gestures",body:"Swipe right on a task to instantly start the timer. Swipe left to open the action menu (edit, postpone, delete). No need to tap ⋯ every time.",color:"#F2CC8F"},
  {icon:"⚡",title:"Sort & Categories",body:"Tap the Sort pill to sort by Priority, Work Time, Due Time, and more. Hit Edit to manage categories and hide sort options you don't need.",color:"#C9A7EB"},
  {icon:"↑",title:"Swipe Up Sheet",body:"Swipe up or tap 'see all' to open the full today sheet — overdue tasks, incomplete, completed, and tomorrow all in one place.",color:"#E07A5F"},
  {icon:"▶",title:"Focus Timer",body:"Tap ▶ on any task to open the timer. Hit Focus Lock to hide distractions. When time's up, a burst animation fires and you mark it complete.",color:"#81B29A"},
  {icon:"↻",title:"Recurring Tasks",body:"Set any task to repeat Daily, Weekdays, Weekly, or Monthly. It'll auto-appear each day so you never have to re-add habits.",color:"#7B9EC9"},
  {icon:"🔥",title:"Streaks & Analytics",body:"Complete all your tasks every day to build a streak. Settings → Analytics shows focus time, estimation accuracy, done rate, and more.",color:"#F2CC8F"},
  {icon:"🚀",title:"You're all set",body:"Everything saves automatically. Close the app and come back — your tasks, streak, and settings will all be right here waiting.",color:"#81B29A"},
];
function Onboarding({accent,th,onDone}){
  const[idx,setIdx]=useState(0);
  const[animKey,setAnimKey]=useState(0);
  const slide=ONBOARDING_SLIDES[idx];
  const isLast=idx===ONBOARDING_SLIDES.length-1;
  function next(){if(isLast){onDone();return;}setAnimKey(k=>k+1);setIdx(i=>i+1);}
  function prev(){if(idx===0)return;setAnimKey(k=>k+1);setIdx(i=>i-1);}
  return(
    <div style={{position:"fixed",inset:0,zIndex:500,background:"#0A0A0E",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"0 32px",fontFamily:"'DM Sans',sans-serif",color:"#F0EDE8"}}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=Space+Mono:wght@700&display=swap" rel="stylesheet"/>
      <style>{`@keyframes slideInRight{from{opacity:0;transform:translateX(28px)}to{opacity:1;transform:translateX(0)}}@keyframes onboardPulse{0%,100%{transform:scale(1)}50%{transform:scale(1.06)}}`}</style>
      <button onClick={onDone} style={{position:"absolute",top:52,right:24,background:"none",border:"none",color:"#444",fontSize:13,cursor:"pointer",fontFamily:"'DM Sans',sans-serif"}}>Skip</button>
      <div style={{position:"absolute",top:56,left:"50%",transform:"translateX(-50%)",display:"flex",gap:6}}>
        {ONBOARDING_SLIDES.map((_,i)=>(
          <div key={i} onClick={()=>{setAnimKey(k=>k+1);setIdx(i);}} style={{width:i===idx?20:6,height:6,borderRadius:3,background:i===idx?slide.color:"#252530",transition:"all 0.3s cubic-bezier(0.34,1.56,0.64,1)",cursor:"pointer"}}/>
        ))}
      </div>
      <div key={animKey} style={{display:"flex",flexDirection:"column",alignItems:"center",textAlign:"center",animation:"slideInRight 0.35s cubic-bezier(0.34,1.2,0.64,1)"}}>
        <div style={{fontSize:80,marginBottom:28,filter:`drop-shadow(0 0 24px ${slide.color}66)`,animation:"onboardPulse 3s ease infinite"}}>{slide.icon}</div>
        <div style={{fontFamily:"'Space Mono',monospace",fontSize:11,color:"#444",letterSpacing:1.5,marginBottom:14}}>{idx+1} / {ONBOARDING_SLIDES.length}</div>
        <div style={{fontSize:24,fontWeight:700,letterSpacing:-0.5,marginBottom:16,color:"#F0EDE8",lineHeight:1.2}}>{slide.title}</div>
        <div style={{fontSize:15,color:"#888",lineHeight:1.7,maxWidth:320,marginBottom:48}}>{slide.body}</div>
      </div>
      <div style={{position:"absolute",bottom:52,left:0,right:0,padding:"0 32px",display:"flex",alignItems:"center",gap:12}}>
        {idx>0?<button onClick={prev} style={{background:"#1A1A22",border:"1px solid #252530",borderRadius:14,padding:"15px 22px",color:"#555",fontSize:14,cursor:"pointer",fontFamily:"'DM Sans',sans-serif"}}>← Back</button>:<div style={{width:80}}/>}
        <button onClick={next} style={{flex:1,background:isLast?slide.color:"#1A1A22",border:`1.5px solid ${isLast?slide.color:slide.color+"44"}`,borderRadius:14,padding:"16px",color:isLast?"#fff":slide.color,fontSize:15,fontWeight:600,cursor:"pointer",fontFamily:"'DM Sans',sans-serif",boxShadow:isLast?`0 6px 28px ${slide.color}55`:"none",transition:"all 0.25s"}}>
          {isLast?"Let's go! 🚀":"Next →"}
        </button>
      </div>
    </div>
  );
}
