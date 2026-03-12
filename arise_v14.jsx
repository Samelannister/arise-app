import { useState, useEffect, useRef, useCallback } from "react";

/* ARISE v10 — SHADOW HUNTER SYSTEM · UI OVERHAUL */

// ── SHOP ITEMS ────────────────────────────────────────────
const SHOP_ITEMS = [
  { id:"xp2",      name:"Boost XP ×2",         emoji:"⚡", desc:"Double l'XP de tes quêtes pendant 24h.",      cost:80,  color:"#FFD700", type:"boost"   },
  { id:"cdReset",  name:"Reset Cooldowns",      emoji:"🔄", desc:"Réinitialise tous les cooldowns d'attaque.",   cost:50,  color:"#00F5FF", type:"instant" },
  { id:"bossHeal", name:"Potion de Soin Boss",  emoji:"💉", desc:"Réduit les PV du boss de 20% immédiatement.", cost:60,  color:"#39FF14", type:"instant" },
  { id:"goldMult", name:"Amulette d'Or",        emoji:"💰", desc:"Gold gagné ×1.5 pendant 24h.",                cost:100, color:"#F59E0B", type:"boost"   },
  { id:"auraBlue", name:"Aura Bleue",           emoji:"🔵", desc:"Change l'aura du chasseur en bleu électrique.",cost:120, color:"#60A5FA", type:"cosme", auraColor:"#00F5FF" },
  { id:"auraRed",  name:"Aura Écarlate",        emoji:"🔴", desc:"Change l'aura du chasseur en rouge sang.",     cost:120, color:"#EF4444", type:"cosme", auraColor:"#EF4444" },
  { id:"auraGold", name:"Aura Dorée",           emoji:"🟡", desc:"Change l'aura du chasseur en or pur.",         cost:200, color:"#FFD700", type:"cosme", auraColor:"#FFD700" },
  { id:"streakSave",name:"Sceau du Survivant",  emoji:"🛡️", desc:"Protège ton streak une fois si tu rates une journée.", cost:150, color:"#A855F7", type:"shield" },
];
const PENALTY_GOLD_PER_MISS = 15;
const PENALTY_BOSS_REGEN    = 0.12;

const RANKS = [
  { rank:"E", min:0,     color:"#6B7280", title:"Chasseur Novice",     lore:"Tu viens de traverser ta première porte." },
  { rank:"D", min:2000,  color:"#60A5FA", title:"Chasseur Confirmé",   lore:"Les donjons simples ne te font plus peur." },
  { rank:"C", min:6000,  color:"#34D399", title:"Chasseur Aguerri",    lore:"Ta discipline commence à forger ton caractère." },
  { rank:"B", min:15000, color:"#F59E0B", title:"Chasseur d'Élite",    lore:"Les faibles ne peuvent même pas te voir évoluer." },
  { rank:"A", min:35000, color:"#EF4444", title:"Chasseur Légendaire", lore:"Tu es une menace pour les Monarques." },
  { rank:"S", min:75000, color:"#A855F7", title:"Monarque des Ombres", lore:"Tu as transcendé ta nature. Le Système te reconnaît." },
];
const RANK_XP  = { E:8,  D:15, C:25, B:40, A:60,  S:100 };
const RANK_DMG = { E:10, D:18, C:28, B:42, A:65,  S:110 };
const RANK_LABELS = { E:"Commun · 5-15min", D:"Peu commun · 15-30min", C:"Rare · 30-60min", B:"Épique · 1h+", A:"Légendaire · 1h30+", S:"Mythique · 2h+" };

// ── STREAK MULTIPLIER ──────────────────────────────────────
// Rewards sustained effort over time
function streakMultiplier(streak) {
  if(streak >= 60) return 1.6;
  if(streak >= 30) return 1.5;
  if(streak >= 14) return 1.35;
  if(streak >= 7)  return 1.2;
  if(streak >= 3)  return 1.1;
  return 1.0;
}
function streakMultLabel(streak) {
  const m = streakMultiplier(streak);
  if(m===1.0) return null;
  return `×${m.toFixed(1)}`;
}

// ── DYNAMIC BOSS DAMAGE ───────────────────────────────────
// Damage scales with quest rank difficulty, not fixed values
// Hard quests (B/A/S) hit harder. Easy quests barely scratch boss.
const DMG_BY_RANK = { E:4, D:9, C:18, B:32, A:55, S:90 };
function questDamage(quest, streak) {
  const base = DMG_BY_RANK[quest.rank] || 10;
  const mult = streakMultiplier(streak);
  return Math.round(base * mult);
}

// ── RANG S CONDITIONS ─────────────────────────────────────
function checkSConditions(state, totalXp, streak, activeDays) {
  const xpOk   = totalXp >= 75000;
  const streakOk = streak >= 30;
  const daysOk   = activeDays >= 100;
  const bossesOk = (state.defeatedBosses||[]).length >= 11;
  return { xpOk, streakOk, daysOk, bossesOk,
    all: xpOk && streakOk && daysOk && bossesOk };
}

const DEFAULT_QUESTS = [
  { id:1,  emoji:"🛏️", name:"Faire le lit",     xp:8,  dmg:10, color:"#00F5FF", rank:"E", time:"07:00", section:"AUBE", duration:5,  atkName:"Volonté de Fer",    cooldown:0 },
  { id:2,  emoji:"🦷", name:"Hygiène matinale",  xp:8,  dmg:10, color:"#39FF14", rank:"E", time:"07:05", section:"AUBE", duration:5,  atkName:"Purification",      cooldown:0 },
  { id:3,  emoji:"💪", name:"Pompes & Abdos",     xp:25, dmg:28, color:"#FF3864", rank:"C", time:"07:10", section:"AUBE", duration:30, atkName:"Frappe Titanesque", cooldown:15 },
  { id:4,  emoji:"🧠", name:"Gel King",           xp:25, dmg:28, color:"#BF5FFF", rank:"C", time:"07:30", section:"AUBE", duration:20, atkName:"Explosion Mentale", cooldown:12 },
  { id:5,  emoji:"📖", name:"Lecture",            xp:25, dmg:28, color:"#FFD700", rank:"C", time:"08:00", section:"AUBE", duration:30, atkName:"Lame du Savoir",    cooldown:12 },
  { id:6,  emoji:"📱", name:"Formation iPad",     xp:40, dmg:42, color:"#FF8C00", rank:"B", time:"10:00", section:"JOUR", duration:60, atkName:"Frappe Numérique",  cooldown:20 },
  { id:7,  emoji:"💻", name:"Formation PC Rendu", xp:40, dmg:42, color:"#FF8C00", rank:"B", time:"11:30", section:"JOUR", duration:60, atkName:"Render Strike",     cooldown:20 },
  { id:8,  emoji:"♟️", name:"Échecs",             xp:25, dmg:28, color:"#00F5FF", rank:"C", time:"14:00", section:"MIDI", duration:45, atkName:"Gambit Final",      cooldown:15 },
  { id:9,  emoji:"🎸", name:"Guitare",            xp:25, dmg:28, color:"#FF69B4", rank:"C", time:"15:00", section:"MIDI", duration:30, atkName:"Solo Dévastateur",  cooldown:12 },
  { id:10, emoji:"🌙", name:"Préparer demain",    xp:8,  dmg:10, color:"#8B5CF6", rank:"E", time:"20:00", section:"SOIR", duration:10, atkName:"Sceau du Lendemain",cooldown:0 },
];

const QUEST_LIBRARY = {
  "💪 PHYSIQUE": [
    { emoji:"🏃", name:"Course à pied",       duration:30, section:"AUBE", time:"07:00", color:"#FF3864", atkName:"Sprint Dévastateur" },
    { emoji:"🏋️", name:"Musculation",          duration:60, section:"AUBE", time:"07:00", color:"#FF8C00", atkName:"Levée Titanesque" },
    { emoji:"🧘", name:"Yoga / Stretching",   duration:20, section:"AUBE", time:"07:30", color:"#34D399", atkName:"Souplesse du Spectre" },
    { emoji:"🚴", name:"Vélo / Cardio",        duration:45, section:"JOUR", time:"10:00", color:"#60A5FA", atkName:"Pédalée Éclair" },
    { emoji:"🏊", name:"Natation",             duration:45, section:"MIDI", time:"13:00", color:"#00F5FF", atkName:"Vague de Maîtrise" },
    { emoji:"🥊", name:"Boxe / Combat",        duration:60, section:"MIDI", time:"14:00", color:"#EF4444", atkName:"Frappe du Chasseur" },
    { emoji:"💧", name:"Boire 2L d'eau",       duration:5,  section:"AUBE", time:"07:00", color:"#00F5FF", atkName:"Protocole Hydration" },
    { emoji:"🥗", name:"Repas équilibré",      duration:15, section:"MIDI", time:"12:00", color:"#39FF14", atkName:"Nourriture du Guerrier" },
  ],
  "🧠 MENTAL": [
    { emoji:"📝", name:"Écriture / Journal",   duration:15, section:"SOIR", time:"21:00", color:"#A855F7", atkName:"Ancrage Mental" },
    { emoji:"🧘", name:"Méditation",           duration:10, section:"AUBE", time:"07:00", color:"#34D399", atkName:"Esprit du Vide" },
    { emoji:"♟️", name:"Échecs",               duration:30, section:"MIDI", time:"14:00", color:"#00F5FF", atkName:"Gambit Final" },
    { emoji:"🔤", name:"Apprentissage langue", duration:20, section:"JOUR", time:"10:00", color:"#60A5FA", atkName:"Maîtrise Linguistique" },
    { emoji:"🎯", name:"Visualisation",        duration:10, section:"AUBE", time:"07:30", color:"#F59E0B", atkName:"Projection Mentale" },
    { emoji:"📵", name:"Jeûne numérique 1h",  duration:60, section:"MIDI", time:"12:00", color:"#FFD700", atkName:"Vide Numérique" },
    { emoji:"📰", name:"Veille / Culture",     duration:20, section:"SOIR", time:"19:00", color:"#8B5CF6", atkName:"Sagesse Accumulée" },
    { emoji:"🔬", name:"Étude approfondie",   duration:90, section:"JOUR", time:"10:00", color:"#60A5FA", atkName:"Analyse Profonde" },
  ],
  "⚙️ COMPÉTENCES": [
    { emoji:"💻", name:"Code / Dev",           duration:90, section:"JOUR", time:"10:00", color:"#39FF14", atkName:"Code Briseur" },
    { emoji:"🎨", name:"Dessin / Art",         duration:30, section:"MIDI", time:"14:00", color:"#FF69B4", atkName:"Trait du Créateur" },
    { emoji:"🎸", name:"Instrument musique",   duration:30, section:"MIDI", time:"15:00", color:"#FF8C00", atkName:"Solo Dévastateur" },
    { emoji:"📷", name:"Photo / Vidéo",        duration:30, section:"MIDI", time:"14:00", color:"#60A5FA", atkName:"Capture Parfaite" },
    { emoji:"✍️", name:"Écriture créative",    duration:30, section:"SOIR", time:"20:00", color:"#A855F7", atkName:"Plume du Monarque" },
    { emoji:"🔧", name:"Projet technique",     duration:60, section:"JOUR", time:"11:00", color:"#F59E0B", atkName:"Construction d'Élite" },
    { emoji:"📊", name:"Finance / Analyse",    duration:30, section:"JOUR", time:"10:00", color:"#FFD700", atkName:"Vision Stratégique" },
    { emoji:"🎤", name:"Prise de parole",      duration:20, section:"MIDI", time:"13:00", color:"#EF4444", atkName:"Voix du Commandant" },
  ],
  "🌱 HABITUDES": [
    { emoji:"🌅", name:"Lever avant 6h30",     duration:5,  section:"AUBE", time:"06:30", color:"#FF8C00", atkName:"Éveil de l'Aurore" },
    { emoji:"🌙", name:"Coucher avant 23h",    duration:5,  section:"SOIR", time:"22:45", color:"#8B5CF6", atkName:"Repos du Guerrier" },
    { emoji:"🌿", name:"Marche 30min",         duration:30, section:"MIDI", time:"13:00", color:"#39FF14", atkName:"Foulée du Vent" },
    { emoji:"☕", name:"Routine matinale",     duration:15, section:"AUBE", time:"07:00", color:"#F59E0B", atkName:"Rituel du Chasseur" },
    { emoji:"🌙", name:"Préparer demain",      duration:10, section:"SOIR", time:"21:00", color:"#A855F7", atkName:"Sceau du Lendemain" },
    { emoji:"🤝", name:"Contact social positif",duration:15,section:"JOUR", time:"12:00", color:"#FF69B4", atkName:"Lien d'Acier" },
    { emoji:"🧹", name:"Ménage / Rangement",   duration:20, section:"SOIR", time:"19:00", color:"#60A5FA", atkName:"Purification du Terrier" },
    { emoji:"🛏️", name:"Faire le lit",          duration:5,  section:"AUBE", time:"07:00", color:"#00F5FF", atkName:"Ordre du Chasseur" },
  ],
};

const BOSSES = [
  { id:"sloth",   name:"Belzébuth",    title:"Démon de la Paresse",        minRank:"E", color:"#6B7280", maxHp:150, lore:"Il vit sous ton lit. Chaque matin où tu restes allongé, il gagne.", atkMsg:["Tu mérites encore 5 minutes...","Demain c'est pareil.","La fatigue t'appartient."], death:"La paresse recule. Tu peux te lever." },
  { id:"procras", name:"Chronovore",   title:"Dévoreur de Temps",          minRank:"E", color:"#60A5FA", maxHp:200, lore:"Il se nourrit de tes 'plus tard'. Plus tu attends, plus il grossit.", atkMsg:["Il reste encore du temps...","Netflix d'abord.","Tu commenceras lundi."], death:"Le Chronovore est vaincu. Ton temps t'appartient." },
  { id:"screen",  name:"Vidya",        title:"Seigneur des Écrans",        minRank:"D", color:"#3B82F6", maxHp:250, lore:"Il vit dans ton téléphone. Chaque scroll inutile le nourrit.", atkMsg:["Juste une vidéo...","5 minutes de plus...","Tu mérites du repos."], death:"L'écran s'éteint. Tu reprends le contrôle." },
  { id:"doubt",   name:"Arachné",      title:"Tisseuse de Doutes",         minRank:"D", color:"#34D399", maxHp:300, lore:"Elle tisse ses toiles dans ton esprit. Chaque pensée négative la renforce.", atkMsg:["Tu n'es pas assez bon.","Les autres avancent plus vite.","Pourquoi continuer?"], death:"Ses toiles se déchirent. Tu avances malgré le doute." },
  { id:"sleep",   name:"Morphée Noir", title:"Voleur de Sommeil",          minRank:"C", color:"#7C3AED", maxHp:280, lore:"Il te vole tes nuits en t'offrant des distractions infinies.", atkMsg:["C'est pas grave de se coucher tard...","Une dernière vidéo...","Demain tu rattraperas."], death:"Le sommeil est restauré. Ton corps te remercie." },
  { id:"compare", name:"Mirrorak",     title:"Démon de la Comparaison",    minRank:"C", color:"#EC4899", maxHp:320, lore:"Il te montre les succès des autres pour détruire les tiens.", atkMsg:["Regarde comme ils réussissent mieux...","Tu ne les rattraperas jamais.","C'est inutile."], death:"Mirrorak tombe. Ta progression n'appartient qu'à toi." },
  { id:"chaos",   name:"Malakar",      title:"Seigneur du Désordre",       minRank:"B", color:"#F59E0B", maxHp:420, lore:"Il règne sur l'inconstance. Il prospère quand tu abandonnes tes routines.", atkMsg:["Aujourd'hui c'est exceptionnel...","Une exception ne brise rien...","Le chaos est naturel."], death:"L'ordre est restauré. Ta routine est ton armure." },
  { id:"perfect", name:"Paralyzus",    title:"Gardien du Perfectionnisme", minRank:"B", color:"#F472B6", maxHp:380, lore:"Il te convainc que si ce n'est pas parfait, ça ne vaut rien.", atkMsg:["Ce n'est pas encore assez bien...","Recommence depuis le début.","Tu dois être parfait."], death:"L'imparfait accompli vaut mieux que le parfait imaginé." },
  { id:"fear",    name:"Phobéos",      title:"Archidémon de la Peur",      minRank:"A", color:"#EF4444", maxHp:550, lore:"Il t'empêche de commencer. La peur de l'échec est son arme.", atkMsg:["Et si tu échoues?","Tout le monde va se moquer.","Tu n'es pas prêt."], death:"Phobéos recule. La peur n'est qu'un monstre de papier." },
  { id:"igris",   name:"Igris",        title:"Chevalier Spectre",          minRank:"A", color:"#DC2626", maxHp:600, lore:"Ancien champion qui a abandonné ses rêves. Il combat ceux qui veulent réussir.", atkMsg:["J'étais comme toi jadis.","Tes ambitions te briseront.","La médiocrité est confortable."], death:"Igris s'incline. Il reconnaît ta volonté." },
  { id:"shadow",  name:"Beru",         title:"Roi des Insectes Fantômes",  minRank:"S", color:"#A855F7", maxHp:900, lore:"Une entité de l'ombre pure. Il ne peut être affronté qu'au Rang S.", atkMsg:["Tu n'appartiens pas à ce niveau.","Retourne dans l'ombre.","INSECTE!"], death:"Beru s'incline devant toi. Sa loyauté t'est acquise." },
  { id:"antares", name:"Antares",      title:"Roi des Démons · Monarque",  minRank:"S", color:"#C026D3", maxHp:1500, lore:"Le Boss final. 30 jours de persévérance absolue sont nécessaires.", atkMsg:["Tu ne peux pas me vaincre seul.","30 jours? Impossible.","Ta détermination est pathétique."], death:"ANTARES EST VAINCU. Le Système grave ta victoire pour l'éternité.", isMonarch:true },
];

const SECRET_POOL = [
  { id:"s1", emoji:"🌊", name:"Protocole Hydratation", xp:50, dmg:45, desc:"Bois 2L d'eau aujourd'hui.",   color:"#00F5FF", atkName:"Vague Purificatrice",cooldown:30 },
  { id:"s2", emoji:"🧊", name:"Épreuve du Froid",       xp:55, dmg:50, desc:"Douche froide 2 minutes.",     color:"#60A5FA", atkName:"Souffle Arctique",   cooldown:30 },
  { id:"s3", emoji:"🌿", name:"Protocole Terrain",      xp:60, dmg:55, desc:"30min de marche dehors.",      color:"#39FF14", atkName:"Foulée du Vent",     cooldown:30 },
  { id:"s4", emoji:"📵", name:"Zone de Silence",        xp:70, dmg:65, desc:"1h sans réseaux sociaux.",     color:"#FFD700", atkName:"Vide Numérique",     cooldown:35 },
  { id:"s5", emoji:"🌅", name:"Éveil de l'Aurore",      xp:45, dmg:40, desc:"Lève-toi avant 6h30.",         color:"#FF8C00", atkName:"Frappe Aurore",      cooldown:25 },
  { id:"s6", emoji:"📝", name:"Gratitude du Chasseur",  xp:40, dmg:35, desc:"Écris 3 choses positives.",    color:"#A855F7", atkName:"Ancrage Mental",     cooldown:20 },
  { id:"s7", emoji:"🤝", name:"Mission Sociale",        xp:45, dmg:42, desc:"Contacte quelqu'un qui compte.",color:"#FF69B4", atkName:"Lien d'Acier",      cooldown:25 },
];

const TITLES = [
  { id:"t1",  name:"Celui qui se lève",      emoji:"🌅", cond:(s,xp,str)=>str>=3,              desc:"3 jours consécutifs" },
  { id:"t2",  name:"Résistant à la Paresse", emoji:"🛡️", cond:(s)=>s.defeatedBosses?.includes("sloth"), desc:"Vaincre Belzébuth" },
  { id:"t3",  name:"Maître du Temps",        emoji:"⏳", cond:(s,xp,str)=>str>=7,              desc:"7 jours consécutifs" },
  { id:"t4",  name:"Disciple de l'Ombre",    emoji:"🌑", cond:(s,xp,str)=>str>=14,             desc:"14 jours consécutifs" },
  { id:"t5",  name:"Chasseur Confirmé",      emoji:"⚔️", cond:(s,xp)=>xp>=500,                desc:"500 XP" },
  { id:"t6",  name:"Briseur de Doutes",      emoji:"🕷️", cond:(s)=>s.defeatedBosses?.includes("doubt"), desc:"Vaincre Arachné" },
  { id:"t7",  name:"Gardien de la Routine",  emoji:"🔒", cond:(s,xp,str)=>str>=21,             desc:"21 jours consécutifs" },
  { id:"t8",  name:"Élite de l'Élite",       emoji:"💎", cond:(s,xp)=>xp>=3500,               desc:"3500 XP" },
  { id:"t9",  name:"Inarrêtable",            emoji:"🔥", cond:(s,xp,str)=>str>=30,             desc:"30 jours consécutifs" },
  { id:"t10", name:"Monarque Naissant",      emoji:"👑", cond:(s,xp)=>xp>=12000,              desc:"Rang S atteint" },
];

const MORNING_MSGS = [
  "Une nouvelle porte s'est ouverte, Chasseur. Ta discipline t'attend.",
  "Le Système a enregistré ton absence cette nuit. Il est temps de te lever.",
  "Belzébuth s'affaiblit chaque matin où tu choisis de te lever.",
  "Les grands chasseurs ne se demandent pas s'ils ont envie. Ils agissent.",
  "Aujourd'hui, tu peux choisir de progresser. Ou de stagner.",
];

// ── HELPERS ──────────────────────────────────────────────
const todayKey = () => new Date().toISOString().slice(0,10);
const dseed = s => { let h=5381; for(const c of String(s)) h=((h<<5)+h)+c.charCodeAt(0); return Math.abs(h); };
const getRankData = xp => { let r=RANKS[0]; for(const v of RANKS) if(xp>=v.min) r=v; return r; };
const calcStreak = h => { let s=0,d=new Date(); while((h[d.toISOString().slice(0,10)]||[]).length){ s++; d.setDate(d.getDate()-1); } return s; };
const newId = () => Date.now()+Math.floor(Math.random()*9999);
const getDurationRank = dur => { if(dur>=120)return"S";if(dur>=90)return"A";if(dur>=60)return"B";if(dur>=30)return"C";if(dur>=15)return"D";return"E"; };
const getDailySecret = date => dseed(date)%2===0 ? SECRET_POOL[dseed(date+"s")%SECRET_POOL.length] : null;
const getDailyBoss = (date, rankChar) => {
  const ri = RANKS.findIndex(r=>r.rank===rankChar);
  const pool = BOSSES.filter(b=>!b.isMonarch && RANKS.findIndex(r=>r.rank===b.minRank)<=ri);
  return pool.length>0 ? pool[dseed(date)%pool.length] : BOSSES[0];
};

// ── CSS ───────────────────────────────────────────────────
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Rajdhani:wght@400;500;600;700&family=Orbitron:wght@400;600;700;900&display=swap');
*{box-sizing:border-box;margin:0;padding:0;-webkit-tap-highlight-color:transparent;user-select:none;}
html,body,#root{background:#000;height:100%;overflow:hidden;}
::-webkit-scrollbar{width:2px;} ::-webkit-scrollbar-thumb{background:#A855F730;}
input,select,textarea{outline:none;-webkit-appearance:none;user-select:text;}
input[type=time]{color-scheme:dark;} input[type=range]{-webkit-appearance:slider-horizontal;height:4px;accent-color:#A855F7;}

@keyframes heroFloat{0%,100%{transform:translateY(0);}50%{transform:translateY(-10px);}}
@keyframes auraB{0%,100%{opacity:0.5;transform:scale(1);}50%{opacity:0.9;transform:scale(1.08);}}
@keyframes ringOut{0%{opacity:0.8;transform:scale(0.95);}100%{opacity:0;transform:scale(1.7);}}
@keyframes gridMove{from{transform:perspective(1000px) rotateX(72deg) translateY(0);}to{transform:perspective(1000px) rotateX(72deg) translateY(60px);}}
@keyframes slashR{0%{opacity:1;transform:translateX(-130px) scaleX(0);}55%{opacity:1;transform:translateX(10px) scaleX(1);}100%{opacity:0;transform:translateX(80px) scaleX(1.5);}}
@keyframes slashD{0%{opacity:1;transform:translate(-90px,50px) scale(0) rotate(-40deg);}55%{opacity:1;transform:translate(5px,-5px) scale(1) rotate(-40deg);}100%{opacity:0;transform:translate(60px,-35px) scale(1.3) rotate(-40deg);}}
@keyframes bossShake{0%,100%{transform:translate(0,0);}15%{transform:translate(-14px,5px);}35%{transform:translate(16px,-6px);}55%{transform:translate(-10px,4px);}75%{transform:translate(8px,-3px);}}
@keyframes bossDie{0%{opacity:1;}25%{filter:brightness(5);}100%{opacity:0;transform:scale(0.05) rotate(30deg);}}
@keyframes bossBreath{0%,100%{transform:scale(1);}50%{transform:scale(1.03);}}
@keyframes dmgPop{0%{opacity:1;transform:translateY(0) scale(1);}100%{opacity:0;transform:translateY(-90px) scale(2.2);}}
@keyframes xpPop{0%{opacity:1;transform:translateY(0) scale(1);}100%{opacity:0;transform:translateY(-65px) scale(1.3);}}
@keyframes sysIn{0%{opacity:0;transform:scale(0.9) translateY(15px);}100%{opacity:1;transform:scale(1) translateY(0);}}
@keyframes rankReveal{0%{opacity:0;transform:scale(0.3) rotate(-10deg);}65%{transform:scale(1.08);}100%{opacity:1;transform:scale(1);}}
@keyframes toastIn{0%{transform:translateX(110%);opacity:0;}8%,85%{transform:translateX(0);opacity:1;}100%{transform:translateX(110%);opacity:0;}}
@keyframes fadeIn{from{opacity:0;}to{opacity:1;}}
@keyframes slideUp{from{transform:translateY(18px);opacity:0;}to{transform:translateY(0);opacity:1;}}
@keyframes fireFlick{0%,100%{transform:scaleY(1) rotate(-2deg);}50%{transform:scaleY(1.15) rotate(2deg);}}
@keyframes pulseG{0%,100%{opacity:0.6;transform:scale(1);}50%{opacity:1;transform:scale(1.1);}}
@keyframes onboardIn{0%{opacity:0;transform:translateY(30px);}100%{opacity:1;transform:translateY(0);}}
@keyframes titleRevealAnim{0%{opacity:0;transform:scale(0.5) rotate(-5deg);}60%{transform:scale(1.1);}100%{opacity:1;transform:scale(1);}}
@keyframes critFlash{0%,100%{opacity:0;}40%{opacity:1;}}
@keyframes cdPulse{0%,100%{opacity:0.4;}50%{opacity:0.8;}}
@keyframes swordAura{0%,100%{filter:drop-shadow(0 0 6px var(--sc)) drop-shadow(0 0 12px var(--sc));}50%{filter:drop-shadow(0 0 18px var(--sc)) drop-shadow(0 0 40px var(--sc));}}
@keyframes gateSlide{0%{transform:scaleX(1);}100%{transform:scaleX(0);}}
@keyframes comboSlide{0%{width:100%;}100%{width:0%;}}
@keyframes penaltyIn{0%{opacity:0;transform:scale(1.1);}100%{opacity:1;transform:scale(1);}}
@keyframes penaltyShake{0%,100%{transform:translateX(0);}20%{transform:translateX(-12px);}40%{transform:translateX(12px);}60%{transform:translateX(-8px);}80%{transform:translateX(8px);}}
@keyframes countdownUrgent{0%,100%{opacity:1;transform:scale(1);}50%{opacity:0.6;transform:scale(1.06);}}
@keyframes comboFlash{0%,100%{background:transparent;}50%{background:rgba(255,215,0,0.15);}}
@keyframes bossCounter{0%{opacity:0;transform:scale(0.5) translateY(20px);}50%{transform:scale(1.1);}100%{opacity:1;transform:scale(1) translateY(0);}}
@keyframes awakenPulse{0%,100%{filter:drop-shadow(0 0 8px #FFD700) drop-shadow(0 0 20px #FFD700);}50%{filter:drop-shadow(0 0 20px #FFD700) drop-shadow(0 0 50px #FFD700) drop-shadow(0 0 80px #FF8C00);}}
@keyframes bilanReveal{0%{opacity:0;transform:translateY(30px);}100%{opacity:1;transform:translateY(0);}}

/* v7 NEW */
@keyframes questCheck{0%{transform:scale(1);}30%{transform:scale(1.04);}60%{transform:scale(0.98);}100%{transform:scale(1);}}
@keyframes questGlow{0%{box-shadow:none;}40%{box-shadow:0 0 20px var(--qc),0 4px 24px var(--qc);}100%{box-shadow:0 0 8px var(--qc)33,0 2px 12px var(--qc)22;}}
@keyframes xpBarFill{from{opacity:0.4;filter:brightness(1.5);}to{opacity:1;filter:brightness(1);}}
@keyframes particleDrift{0%{transform:translateY(0) translateX(0) scale(1);opacity:var(--po);}100%{transform:translateY(var(--py)) translateX(var(--px)) scale(0);opacity:0;}}
@keyframes navPop{0%{transform:scale(0.8);}60%{transform:scale(1.12);}100%{transform:scale(1);}}
@keyframes countUp{0%{transform:translateY(8px);opacity:0;}100%{transform:translateY(0);opacity:1;}}
@keyframes bossEnter{0%{opacity:0;transform:scale(0.7) translateY(20px);}60%{transform:scale(1.03);}100%{opacity:1;transform:scale(1) translateY(0);}}
@keyframes hpDrain{from{filter:brightness(2);}to{filter:brightness(1);}}
@keyframes pulseRing{0%{transform:scale(1);opacity:0.6;}100%{transform:scale(2.2);opacity:0;}}
@keyframes shadowOrb{0%,100%{transform:scale(1) rotate(0deg);}50%{transform:scale(1.15) rotate(180deg);}}
`;


// ── SOUND + BOSS AMBIENCE ─────────────────────────────────
// Each boss has a unique ambient soundscape profile
const BOSS_AMBIENCE = {
  sloth:    { base:55,  chord:[1,1.25,1.5],  type:"sine",    bpm:40,  vol:0.04, filter:800  },
  procras:  { base:80,  chord:[1,1.33,1.78], type:"triangle",bpm:52,  vol:0.04, filter:600  },
  screen:   { base:220, chord:[1,1.12,1.26], type:"sawtooth",bpm:110, vol:0.03, filter:1200 },
  doubt:    { base:110, chord:[1,1.19,1.41], type:"triangle",bpm:60,  vol:0.04, filter:500  },
  sleep:    { base:40,  chord:[1,1.5,2],     type:"sine",    bpm:30,  vol:0.05, filter:400  },
  compare:  { base:130, chord:[1,1.2,1.44],  type:"sine",    bpm:72,  vol:0.04, filter:700  },
  chaos:    { base:90,  chord:[1,1.31,1.78], type:"sawtooth",bpm:140, vol:0.04, filter:2000 },
  perfect:  { base:174, chord:[1,1.25,1.67], type:"triangle",bpm:80,  vol:0.03, filter:900  },
  fear:     { base:65,  chord:[1,1.18,1.41], type:"sawtooth",bpm:95,  vol:0.05, filter:1500 },
  igris:    { base:146, chord:[1,1.33,1.78], type:"triangle",bpm:88,  vol:0.04, filter:1100 },
  shadow:   { base:55,  chord:[1,1.5,2,2.67],type:"sine",    bpm:60,  vol:0.05, filter:600  },
  antares:  { base:32,  chord:[1,1.5,2,3],   type:"sawtooth",bpm:50,  vol:0.06, filter:400  },
};

function useBossAmbience() {
  const ctxRef  = useRef(null);
  const nodesRef= useRef([]);
  const activeRef=useRef(null);

  const stop = useCallback(()=>{
    nodesRef.current.forEach(n=>{try{n.stop?.();n.disconnect?.();}catch{}});
    nodesRef.current=[];
    activeRef.current=null;
  },[]);

  const play = useCallback((bossId, enabled)=>{
    if(!enabled) return;
    if(activeRef.current===bossId) return;
    stop();
    const prof=BOSS_AMBIENCE[bossId];
    if(!prof) return;
    try {
      if(!ctxRef.current) ctxRef.current=new(window.AudioContext||window.webkitAudioContext)();
      const ctx=ctxRef.current;
      if(ctx.state==="suspended") ctx.resume();
      activeRef.current=bossId;
      const master=ctx.createGain();
      master.gain.setValueAtTime(0,ctx.currentTime);
      master.gain.linearRampToValueAtTime(prof.vol,ctx.currentTime+2);
      master.connect(ctx.destination);
      nodesRef.current.push(master);

      // Layered oscillators for each chord tone
      prof.chord.forEach((ratio,i)=>{
        const osc=ctx.createOscillator();
        const g=ctx.createGain();
        const filt=ctx.createBiquadFilter();
        filt.type="lowpass";
        filt.frequency.value=prof.filter;
        osc.type=prof.type;
        osc.frequency.value=prof.base*ratio;
        // Slow LFO on frequency for movement
        const lfo=ctx.createOscillator();
        const lfoG=ctx.createGain();
        lfo.frequency.value=0.1+i*0.05;
        lfoG.gain.value=prof.base*ratio*0.01;
        lfo.connect(lfoG);
        lfoG.connect(osc.frequency);
        lfo.start();
        // Rhythmic amplitude envelope (pulse to bpm)
        const beatHz=prof.bpm/60;
        const lfo2=ctx.createOscillator();
        const lfo2G=ctx.createGain();
        lfo2.frequency.value=beatHz*(i===0?1:i===1?0.5:0.25);
        lfo2G.gain.value=0.3;
        lfo2.connect(lfo2G);
        lfo2G.connect(g.gain);
        g.gain.value=0.7;
        lfo2.start();
        osc.connect(filt);
        filt.connect(g);
        g.connect(master);
        osc.start();
        nodesRef.current.push(osc,lfo,lfo2,g,filt);
      });
    } catch(e){console.warn("Ambience err",e);}
  },[stop]);

  return {play,stop};
}

function useSound(on) {
  const ctx = useRef(null);
  const ac = () => { if(!ctx.current) ctx.current=new(window.AudioContext||window.webkitAudioContext)(); return ctx.current; };
  const pl = (notes,type="sine",v=0.1) => {
    if(!on) return;
    try{ const a=ac(); notes.forEach(([f,st,d=0.15])=>{const o=a.createOscillator(),g=a.createGain();o.connect(g);g.connect(a.destination);o.type=type;o.frequency.value=f;const T=a.currentTime+st;g.gain.setValueAtTime(0,T);g.gain.linearRampToValueAtTime(v,T+0.02);g.gain.exponentialRampToValueAtTime(0.001,T+d);o.start(T);o.stop(T+d+0.05);}); }catch{}
  };
  return {
    slash: ()=>pl([[900,0,0.05],[650,0.04,0.08],[400,0.1,0.1]],"sawtooth",0.2),
    hit:   ()=>pl([[120,0,0.12],[80,0.1,0.2]],"sawtooth",0.18),
    crit:  ()=>pl([[1400,0,0.04],[900,0.03,0.07],[1800,0.06,0.1]],"square",0.13),
    kill:  ()=>pl([[262,0],[392,0.1],[523,0.2],[784,0.3],[1047,0.4],[1568,0.5]],"triangle",0.18),
    quest: ()=>pl([[440,0],[554,0.08],[659,0.16]],"sine",0.12),
    rankUp:()=>pl([[330,0],[415,0.12],[523,0.24],[659,0.36],[880,0.5]],"sine",0.2),
    title: ()=>pl([[600,0,0.1],[800,0.1,0.1],[1000,0.2,0.15],[1200,0.35,0.25]],"sine",0.14),
    tap:   ()=>pl([[500,0,0.06]],"sine",0.04),
  };
}

// ── PWA NOTIFICATIONS ─────────────────────────────────────
async function requestNotifPermission() {
  if(!("Notification" in window)) return false;
  const p=await Notification.requestPermission();
  return p==="granted";
}
function scheduleNotif(title,body,delayMs) {
  if(Notification.permission!=="granted") return;
  setTimeout(()=>{ try{ new Notification(title,{body,icon:"data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>⚔️</text></svg>",tag:"arise-remind"}); }catch{} },delayMs);
}

// ── DRAG & DROP HOOK ──────────────────────────────────────
function useDragSort(items, onReorder) {
  const [dragging,setDragging]=useState(null); // index
  const [over,setOver]=useState(null);
  const [longPressId,setLongPressId]=useState(null);
  const timerRef=useRef(null);

  const onLongPressStart=(id,idx)=>{
    timerRef.current=setTimeout(()=>{
      if(navigator.vibrate) navigator.vibrate(40);
      setDragging(idx);
      setLongPressId(id);
    },420);
  };
  const onLongPressEnd=()=>{ clearTimeout(timerRef.current); };

  const onDragOver=(e,idx)=>{
    e.preventDefault();
    setOver(idx);
  };
  const onDrop=(e,idx)=>{
    e.preventDefault();
    if(dragging===null||dragging===idx) { setDragging(null);setOver(null);return; }
    const next=[...items];
    const [moved]=next.splice(dragging,1);
    next.splice(idx,0,moved);
    onReorder(next);
    setDragging(null);setOver(null);setLongPressId(null);
  };
  const onDragEnd=()=>{ setDragging(null);setOver(null);setLongPressId(null); };

  // Touch drag
  const touchData=useRef({});
  const onTouchStart=(e,id,idx)=>{
    onLongPressStart(id,idx);
    touchData.current={startY:e.touches[0].clientY,idx};
  };
  const onTouchMove=(e)=>{
    clearTimeout(timerRef.current);
    if(dragging===null) return;
    const y=e.touches[0].clientY;
    const el=document.elementFromPoint(e.touches[0].clientX,y);
    const card=el?.closest("[data-dragidx]");
    if(card) setOver(+card.dataset.dragidx);
  };
  const onTouchEnd=(e)=>{
    onLongPressEnd();
    if(dragging!==null&&over!==null&&over!==dragging){
      const next=[...items];
      const [moved]=next.splice(dragging,1);
      next.splice(over,0,moved);
      onReorder(next);
    }
    setDragging(null);setOver(null);setLongPressId(null);
  };

  return {dragging,over,longPressId,onLongPressStart,onLongPressEnd,onDragOver,onDrop,onDragEnd,onTouchStart,onTouchMove,onTouchEnd};
}

// ── NOTIFICATIONS SETTINGS PANEL ─────────────────────────
function NotifPanel({onClose}) {
  const [granted,setGranted]=useState(Notification?.permission==="granted");
  const [times,setTimes]=useState({morning:"07:30",noon:"12:30",evening:"20:00"});
  const [enabled,setEnabled]=useState({morning:true,noon:false,evening:true});

  const request=async()=>{
    const ok=await requestNotifPermission();
    setGranted(ok);
    if(ok) new Notification("ARISE — Système activé",{body:"Les rappels de mission sont actifs.",tag:"arise-setup"});
  };

  const testNotif=()=>scheduleNotif("ARISE","⚔️ Tes quêtes t'attendent, Chasseur.",500);

  return (
    <div style={{position:"fixed",inset:0,zIndex:9400,background:"rgba(0,0,0,0.94)",display:"flex",alignItems:"center",justifyContent:"center"}} onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div style={{background:"rgba(8,8,12,0.99)",border:"1px solid rgba(168,85,247,0.25)",borderRadius:18,padding:"20px 18px",width:"88%",maxWidth:340,animation:"sysIn 0.3s ease"}}>
        <div style={{fontSize:8,color:"#A855F766",fontFamily:"'Orbitron',monospace",letterSpacing:"0.3em",marginBottom:14,textAlign:"center"}}>🔔 RAPPELS DE MISSION</div>
        {!granted?(
          <div style={{textAlign:"center",marginBottom:16}}>
            <div style={{fontSize:11,color:"#7BA7CC",fontFamily:"'Rajdhani',sans-serif",marginBottom:12}}>Active les notifications pour recevoir des rappels quotidiens du Système.</div>
            <button onClick={request} style={{padding:"11px 24px",background:"rgba(168,85,247,0.12)",border:"1px solid rgba(168,85,247,0.4)",borderRadius:12,cursor:"pointer",fontSize:12,color:"#A855F7",fontFamily:"'Orbitron',monospace",fontWeight:700}}>ACTIVER LES NOTIFICATIONS</button>
          </div>
        ):(
          <div style={{marginBottom:14}}>
            <div style={{fontSize:10,color:"#39FF14",fontFamily:"'Orbitron',monospace",marginBottom:12,textAlign:"center"}}>✦ NOTIFICATIONS ACTIVES</div>
            {[{id:"morning",label:"🌅 Matin"},{id:"noon",label:"☀️ Midi"},{id:"evening",label:"🌙 Soir"}].map(r=>(
              <div key={r.id} style={{display:"flex",alignItems:"center",gap:10,marginBottom:10,background:"rgba(10,20,50,0.6)",borderRadius:10,padding:"9px 12px",border:"1px solid rgba(56,139,255,0.18)"}}>
                <div style={{flex:1}}>
                  <div style={{fontSize:12,color:"#C0C8E0",fontFamily:"'Rajdhani',sans-serif",fontWeight:700}}>{r.label}</div>
                  <input type="time" value={times[r.id]} onChange={e=>setTimes(p=>({...p,[r.id]:e.target.value}))}
                    style={{background:"transparent",border:"none",color:"#A855F7",fontFamily:"'Orbitron',monospace",fontSize:11,marginTop:2,width:80}}/>
                </div>
                <div onClick={()=>setEnabled(p=>({...p,[r.id]:!p[r.id]}))}
                  style={{width:36,height:20,borderRadius:10,background:enabled[r.id]?"rgba(168,85,247,0.3)":"rgba(56,139,255,0.15)",border:`1px solid ${enabled[r.id]?"#A855F7":"rgba(56,139,255,0.25)"}`,cursor:"pointer",position:"relative",transition:"all 0.2s"}}>
                  <div style={{position:"absolute",top:2,left:enabled[r.id]?16:2,width:14,height:14,borderRadius:"50%",background:enabled[r.id]?"#A855F7":"#333",transition:"left 0.2s"}}/>
                </div>
              </div>
            ))}
            <button onClick={testNotif} style={{width:"100%",marginTop:4,padding:"9px",background:"rgba(10,20,50,0.5)",border:"1px solid rgba(56,139,255,0.2)",borderRadius:10,cursor:"pointer",fontSize:10,color:"#8BADD4",fontFamily:"'Orbitron',monospace",fontWeight:700}}>TESTER UNE NOTIFICATION</button>
          </div>
        )}
        <button onClick={onClose} style={{width:"100%",padding:"10px",background:"rgba(168,85,247,0.08)",border:"1px solid rgba(168,85,247,0.2)",borderRadius:11,cursor:"pointer",fontSize:11,color:"#A855F7",fontFamily:"'Orbitron',monospace",fontWeight:700}}>FERMER</button>
      </div>
    </div>
  );
}


// ── SOLO LEVELING SVG ICONS ───────────────────────────────
// All icons are 24×24 viewBox unless specified
const SLIcon = {
  // ── Navigation
  quests: ({size=22,color="#fff",style={}})=>(
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={style}>
      <path d="M12 2L14.5 8H21L16 12.5L18 19L12 15.5L6 19L8 12.5L3 8H9.5L12 2Z" stroke={color} strokeWidth="1.4" strokeLinejoin="round" fill={color+"18"}/>
      <path d="M12 6L13.5 9.5H17.5L14.5 11.8L15.5 15.5L12 13.5L8.5 15.5L9.5 11.8L6.5 9.5H10.5L12 6Z" fill={color} opacity="0.4"/>
    </svg>
  ),
  dungeon: ({size=22,color="#fff",style={}})=>(
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={style}>
      <path d="M12 3L21 8V16L12 21L3 16V8L12 3Z" stroke={color} strokeWidth="1.4" fill={color+"0A"}/>
      <path d="M12 3L12 21M3 8L21 8M3 16L21 16" stroke={color} strokeWidth="0.6" opacity="0.3"/>
      <circle cx="12" cy="12" r="2.5" fill={color} opacity="0.7"/>
      <path d="M12 9.5V7M12 14.5V17M9.5 12H7M14.5 12H17" stroke={color} strokeWidth="1" strokeLinecap="round" opacity="0.5"/>
    </svg>
  ),
  weekly: ({size=22,color="#fff",style={}})=>(
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={style}>
      <rect x="3" y="4" width="18" height="17" rx="2" stroke={color} strokeWidth="1.4" fill={color+"08"}/>
      <path d="M3 9H21" stroke={color} strokeWidth="1" opacity="0.4"/>
      <path d="M8 2V6M16 2V6" stroke={color} strokeWidth="1.4" strokeLinecap="round"/>
      <path d="M7 13L10 16L17 12" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  stats: ({size=22,color="#fff",style={}})=>(
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={style}>
      <path d="M3 20H21" stroke={color} strokeWidth="1.4" strokeLinecap="round"/>
      <rect x="5" y="12" width="3" height="8" rx="0.5" fill={color} opacity="0.5"/>
      <rect x="10.5" y="7" width="3" height="13" rx="0.5" fill={color} opacity="0.7"/>
      <rect x="16" y="4" width="3" height="16" rx="0.5" fill={color}/>
      <path d="M6.5 11L12 6L17.5 3.5" stroke={color} strokeWidth="1" strokeLinecap="round" opacity="0.4"/>
    </svg>
  ),
  profile: ({size=22,color="#fff",style={}})=>(
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={style}>
      <path d="M12 2C14.8 2 17 4.2 17 7C17 9.8 14.8 12 12 12C9.2 12 7 9.8 7 7C7 4.2 9.2 2 12 2Z" stroke={color} strokeWidth="1.4" fill={color+"15"}/>
      <path d="M4 22C4 18 7.6 15 12 15C16.4 15 20 18 20 22" stroke={color} strokeWidth="1.4" strokeLinecap="round" fill="none"/>
      {/* Shadow Monarch crown */}
      <path d="M9 7L10.5 5L12 6.5L13.5 5L15 7" stroke={color} strokeWidth="0.8" opacity="0.5"/>
    </svg>
  ),

  // ── Section icons
  dawn: ({size=18,color="#fff",style={}})=>(
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={style}>
      <path d="M12 3V5M5.6 5.6L7 7M18.4 5.6L17 7M3 12H5M19 12H21" stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M12 8C14.2 8 16 9.8 16 12C16 14.2 14.2 16 12 16C9.8 16 8 14.2 8 12C8 9.8 9.8 8 12 8Z" fill={color} opacity="0.6"/>
      <path d="M4 19H20" stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M7 17C7 15 9.2 13.5 12 13.5C14.8 13.5 17 15 17 17" stroke={color} strokeWidth="1" strokeLinecap="round" opacity="0.5"/>
    </svg>
  ),
  day: ({size=18,color="#fff",style={}})=>(
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={style}>
      <circle cx="12" cy="12" r="4" fill={color} opacity="0.7"/>
      <path d="M12 2V4M12 20V22M2 12H4M20 12H22M5.6 5.6L7 7M17 17L18.4 18.4M5.6 18.4L7 17M17 7L18.4 5.6" stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  ),
  noon: ({size=18,color="#fff",style={}})=>(
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={style}>
      <path d="M12 2L13.8 8.5H20.5L15 12.5L17 19L12 15.5L7 19L9 12.5L3.5 8.5H10.2L12 2Z" stroke={color} strokeWidth="1.2" fill={color+"25"} strokeLinejoin="round"/>
      <circle cx="12" cy="12" r="3" fill={color} opacity="0.8"/>
    </svg>
  ),
  evening: ({size=18,color="#fff",style={}})=>(
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={style}>
      <path d="M21 12.8A9 9 0 1111.2 3 7 7 0 0021 12.8Z" stroke={color} strokeWidth="1.4" fill={color+"18"}/>
      <path d="M17 9C17 12.3 14.3 15 11 15C9 15 7.2 14 6 12.5" stroke={color} strokeWidth="0.8" opacity="0.5" strokeLinecap="round"/>
    </svg>
  ),

  // ── System / UI
  system: ({size=16,color="#fff",style={}})=>(
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={style}>
      <rect x="3" y="3" width="18" height="18" rx="2" stroke={color} strokeWidth="1.4" fill={color+"08"}/>
      <path d="M7 8H17M7 12H14M7 16H11" stroke={color} strokeWidth="1.2" strokeLinecap="round"/>
      <circle cx="18" cy="16" r="3" fill={color+"22"} stroke={color} strokeWidth="1"/>
      <path d="M18 14.5V16.5M17 15.5H19" stroke={color} strokeWidth="1" strokeLinecap="round"/>
    </svg>
  ),
  portal: ({size=20,color="#fff",style={}})=>(
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={style}>
      <ellipse cx="12" cy="12" rx="7" ry="9" stroke={color} strokeWidth="1.4" fill={color+"08"}/>
      <ellipse cx="12" cy="12" rx="4" ry="6" stroke={color} strokeWidth="0.8" opacity="0.4"/>
      <ellipse cx="12" cy="12" rx="1.5" ry="3" fill={color} opacity="0.6"/>
      <path d="M5 12C5 12 3 10 3 8M19 12C19 12 21 10 21 8" stroke={color} strokeWidth="1" strokeLinecap="round" opacity="0.4"/>
    </svg>
  ),
  sword: ({size=20,color="#fff",style={}})=>(
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={style}>
      <path d="M17 3L21 7L10 18L6 22L2 21L3 17L14 6L17 3Z" stroke={color} strokeWidth="1.4" fill={color+"12"} strokeLinejoin="round"/>
      <path d="M14 6L18 10" stroke={color} strokeWidth="1" opacity="0.5"/>
      <path d="M3 17L7 21" stroke={color} strokeWidth="1.4" strokeLinecap="round"/>
      <path d="M15 4L20 9" stroke={color} strokeWidth="1" strokeLinecap="round" opacity="0.6"/>
    </svg>
  ),
  crown: ({size=20,color="#fff",style={}})=>(
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={style}>
      <path d="M3 18L5 9L9 14L12 6L15 14L19 9L21 18H3Z" stroke={color} strokeWidth="1.4" fill={color+"15"} strokeLinejoin="round"/>
      <path d="M3 18H21" stroke={color} strokeWidth="1.4" strokeLinecap="round"/>
      <circle cx="12" cy="6" r="1.2" fill={color}/>
      <circle cx="5" cy="9" r="1" fill={color} opacity="0.7"/>
      <circle cx="19" cy="9" r="1" fill={color} opacity="0.7"/>
    </svg>
  ),
  mana: ({size=18,color="#fff",style={}})=>(
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={style}>
      <path d="M12 2L15 9H22L16.5 13.5L19 21L12 16.5L5 21L7.5 13.5L2 9H9L12 2Z" stroke={color} strokeWidth="1.2" fill={color+"10"} strokeLinejoin="round"/>
      <path d="M12 5L14 10H19L15 13L16.5 18L12 15L7.5 18L9 13L5 10H10L12 5Z" fill={color} opacity="0.25"/>
    </svg>
  ),
  skull: ({size=18,color="#fff",style={}})=>(
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={style}>
      <path d="M12 3C8.1 3 5 6.1 5 10C5 12.5 6.3 14.7 8 16V18H16V16C17.7 14.7 19 12.5 19 10C19 6.1 15.9 3 12 3Z" stroke={color} strokeWidth="1.4" fill={color+"12"}/>
      <path d="M8 18H16V20H8V18Z" stroke={color} strokeWidth="1" fill={color+"08"}/>
      <circle cx="9.5" cy="10.5" r="2" fill={color} opacity="0.6"/>
      <circle cx="14.5" cy="10.5" r="2" fill={color} opacity="0.6"/>
      <path d="M10 18V20M14 18V20" stroke={color} strokeWidth="1" strokeLinecap="round" opacity="0.5"/>
    </svg>
  ),
  shield: ({size=18,color="#fff",style={}})=>(
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={style}>
      <path d="M12 2L4 6V12C4 16.4 7.4 20.5 12 22C16.6 20.5 20 16.4 20 12V6L12 2Z" stroke={color} strokeWidth="1.4" fill={color+"10"} strokeLinejoin="round"/>
      <path d="M9 12L11 14L15 10" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  flame: ({size=18,color="#fff",style={}})=>(
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={style}>
      <path d="M12 2C12 2 17 7 17 12C17 14.8 15.2 17.2 12 18C8.8 17.2 7 14.8 7 12C7 10 8 8.5 8 8.5C8 8.5 8 11 10 12C10 9 11 6 12 2Z" stroke={color} strokeWidth="1.2" fill={color+"15"} strokeLinejoin="round"/>
      <path d="M12 14C13.1 14 14 13.1 14 12C14 11 13 10 13 10C13 10 13 11.5 12 12C11 11.5 11 10 11 10C11 10 10 11 10 12C10 13.1 10.9 14 12 14Z" fill={color} opacity="0.7"/>
    </svg>
  ),
  eye: ({size=18,color="#fff",style={}})=>(
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={style}>
      <path d="M2 12C2 12 6 5 12 5C18 5 22 12 22 12C22 12 18 19 12 19C6 19 2 12 2 12Z" stroke={color} strokeWidth="1.4" fill={color+"08"}/>
      <circle cx="12" cy="12" r="3.5" stroke={color} strokeWidth="1.2" fill={color+"15"}/>
      <circle cx="12" cy="12" r="1.5" fill={color} opacity="0.8"/>
      <path d="M10 10L11 11" stroke={color} strokeWidth="0.8" strokeLinecap="round" opacity="0.5"/>
    </svg>
  ),
  // Drag handle
  grip: ({size=16,color="#fff",style={}})=>(
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={style}>
      <circle cx="9" cy="7" r="1.2" fill={color} opacity="0.35"/>
      <circle cx="15" cy="7" r="1.2" fill={color} opacity="0.35"/>
      <circle cx="9" cy="12" r="1.2" fill={color} opacity="0.35"/>
      <circle cx="15" cy="12" r="1.2" fill={color} opacity="0.35"/>
      <circle cx="9" cy="17" r="1.2" fill={color} opacity="0.35"/>
      <circle cx="15" cy="17" r="1.2" fill={color} opacity="0.35"/>
    </svg>
  ),
  // Gold coin
  gold: ({size=16,color="#FFD700",style={}})=>(
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={style}>
      <circle cx="12" cy="12" r="9" stroke={color} strokeWidth="1.4" fill={color+"15"}/>
      <circle cx="12" cy="12" r="6" stroke={color} strokeWidth="0.8" opacity="0.4"/>
      <text x="12" y="16" textAnchor="middle" fontSize="9" fill={color} fontWeight="bold" fontFamily="serif">G</text>
    </svg>
  ),
  // XP crystal
  crystal: ({size=16,color="#A855F7",style={}})=>(
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={style}>
      <path d="M12 2L17 8L12 22L7 8L12 2Z" stroke={color} strokeWidth="1.3" fill={color+"18"} strokeLinejoin="round"/>
      <path d="M7 8L17 8" stroke={color} strokeWidth="0.8" opacity="0.5"/>
      <path d="M12 2L17 8L12 13" stroke={color} strokeWidth="0.6" opacity="0.3"/>
    </svg>
  ),
};

// Mapping section → SLIcon key
const SEC_ICON = { AUBE:"dawn", JOUR:"day", MIDI:"noon", SOIR:"evening" };

// ── RANK-REACTIVE SILHOUETTE BACKGROUND ──────────────────
// Rank index: E=0 D=1 C=2 B=3 A=4 S=5
const RANK_IDX = { E:0, D:1, C:2, B:3, A:4, S:5 };

function MangaHero({ color="#A855F7", rank="E", questsDoneToday=0, totalQuests=1 }) {
  const c = color;
  const ri = RANK_IDX[rank] || 0;
  const progress = Math.min(1, questsDoneToday / Math.max(totalQuests, 1));

  // Shadow soldiers count scales with rank: 0,0,2,4,7,12
  const soldierCounts = [0,0,2,4,7,12];
  const numSoldiers = soldierCounts[ri];

  // Aura intensity scales with rank
  const auraOpacity = 0.08 + ri * 0.07;         // 0.08 → 0.43
  const auraBlur    = 18 + ri * 10;              // 18px → 68px
  const auraSize    = 200 + ri * 50;             // 200 → 450
  const ringCount   = Math.min(ri + 1, 5);

  // Silhouette: at rank E it's just a faint outline; at S it's a crisp glowing form
  const silhouetteOpacity = 0.12 + ri * 0.13;   // 0.12 → 0.77
  const silhouetteBlur    = Math.max(0, 4 - ri); // 4 → 0 (sharper at high rank)
  const glowStrength      = ri * 6;              // 0 → 30px glow

  // Speed lines: appear from rank B+
  const speedLines = ri >= 3;

  // Halftone dots: appear from rank C+
  const halftone = ri >= 2;

  return (
    <div style={{position:"fixed",inset:0,zIndex:0,overflow:"hidden",pointerEvents:"none"}}>
      {/* Base gradient */}
      <div style={{position:"absolute",inset:0,background:`radial-gradient(ellipse at 50% 90%,${c}${Math.round(auraOpacity*255).toString(16).padStart(2,"0")} 0%,#000 60%)`}}/>

      {/* Perspective grid floor */}
      <div style={{position:"absolute",bottom:0,left:"-200%",right:"-200%",height:"48%",
        backgroundImage:`linear-gradient(${c}${ri>0?"18":"0A"} 1px,transparent 1px),linear-gradient(90deg,${c}${ri>0?"18":"0A"} 1px,transparent 1px)`,
        backgroundSize:"52px 52px",transformOrigin:"bottom center",
        animation:"gridMove 5s linear infinite",transform:"perspective(1000px) rotateX(72deg)"}}/>

      {/* Speed lines (rank B+) */}
      {speedLines && Array.from({length:14},(_,i)=>{
        const angle = (i/14)*360;
        const len = 120 + Math.random()*80;
        const x = 50 + Math.cos(angle*Math.PI/180)*30;
        const y = 62 + Math.sin(angle*Math.PI/180)*20;
        return (
          <div key={i} style={{
            position:"absolute",left:`${x}%`,top:`${y}%`,
            width:len,height:1,
            background:`linear-gradient(90deg,transparent,${c}${ri>=4?"55":"33"})`,
            transformOrigin:"left center",
            transform:`rotate(${angle}deg)`,
            opacity: 0.4+ri*0.08,
            animation:`auraB ${1.5+i*0.2}s ease-in-out infinite`,
            animationDelay:`${i*0.1}s`
          }}/>
        );
      })}

      {/* Halftone dot pattern overlay (rank C+) */}
      {halftone && (
        <div style={{
          position:"absolute",bottom:"10%",left:"50%",transform:"translateX(-50%)",
          width:260,height:360,
          backgroundImage:`radial-gradient(circle,${c}${ri>=4?"44":"22"} 1.5px,transparent 1.5px)`,
          backgroundSize:"14px 14px",
          maskImage:"radial-gradient(ellipse 55% 80% at 50% 60%,black 30%,transparent 80%)",
          WebkitMaskImage:"radial-gradient(ellipse 55% 80% at 50% 60%,black 30%,transparent 80%)",
          opacity: 0.5+ri*0.1,
        }}/>
      )}

      {/* Main aura glow behind silhouette */}
      <div style={{
        position:"absolute",bottom:"12%",left:"50%",transform:"translateX(-50%)",
        width:auraSize*0.7,height:auraSize*0.45,borderRadius:"50%",
        background:`radial-gradient(ellipse,${c} 0%,transparent 70%)`,
        filter:`blur(${auraBlur}px)`,
        opacity:auraOpacity*1.8,
        animation:"auraB 3.5s ease-in-out infinite"
      }}/>

      {/* Pulsing rings */}
      {Array.from({length:ringCount},(_,i)=>(
        <div key={i} style={{
          position:"absolute",bottom:"14%",left:"50%",transform:"translateX(-50%)",
          width:160+i*40,height:240+i*50,
          borderRadius:"40% 40% 50% 50%",
          border:`${ri>=4?2:1}px solid ${c}`,
          opacity:0,
          animation:`ringOut ${2.2+i*0.7}s ease-out infinite`,
          animationDelay:`${i*0.6}s`
        }}/>
      ))}

      {/* SHADOW SOLDIERS (rank C+) — small silhouettes flanking the hero */}
      {numSoldiers > 0 && Array.from({length:numSoldiers},(_,i)=>{
        const side = i % 2 === 0 ? -1 : 1;
        const row  = Math.floor(i/2);
        const xOff = (60 + row * 35) * side;
        const yOff = row * 18;
        const scale = 0.35 - row * 0.04;
        return (
          <div key={i} style={{
            position:"absolute",bottom: `${8 + yOff}%`,
            left:`calc(50% + ${xOff}px)`,
            transform:"translateX(-50%)",
            width:90*scale*3,height:200*scale*3,
            opacity: 0.18 + ri*0.06,
            filter:`blur(${Math.max(0,2-ri*0.3)}px)`,
            animation:`heroFloat ${3+i*0.3}s ease-in-out infinite`,
            animationDelay:`${i*0.2}s`
          }}>
            <svg viewBox="0 0 60 140" style={{width:"100%",height:"100%"}}>
              {/* Simple soldier silhouette */}
              <ellipse cx="30" cy="22" rx="10" ry="12" fill={c} opacity="0.9"/>
              {/* Spiky hair */}
              <path d="M20 18 L17 8 L22 15 M24 14 L22 4 L28 13 M30 13 L30 3 L34 12 M36 14 L38 4 L40 15 M40 18 L43 8 L43 18" stroke={c} strokeWidth="1.5" fill="none"/>
              {/* Body */}
              <path d="M20 34 L15 80 L20 130 L25 130 L28 85 L32 85 L35 130 L40 130 L45 80 L40 34Z" fill={c} opacity="0.85"/>
              {/* Shoulders */}
              <path d="M20 34 L8 45 L12 70 L18 65 L20 42Z" fill={c} opacity="0.8"/>
              <path d="M40 34 L52 45 L48 70 L42 65 L40 42Z" fill={c} opacity="0.8"/>
              {/* Sword glow */}
              {ri >= 4 && <line x1="10" y1="45" x2="3" y2="95" stroke={c} strokeWidth="2" opacity="0.9" style={{filter:`drop-shadow(0 0 4px ${c})`}}/>}
            </svg>
          </div>
        );
      })}

      {/* MAIN HERO SILHOUETTE */}
      <div style={{
        position:"absolute",bottom:20,left:"50%",transform:"translateX(-50%)",
        width:190,height:420,
        animation:"heroFloat 4.5s ease-in-out infinite",
      }}>
        <svg viewBox="0 0 100 220" style={{
          width:"100%",height:"100%",overflow:"visible",
          filter:`blur(${silhouetteBlur}px) drop-shadow(0 0 ${glowStrength}px ${c})`,
          opacity:silhouetteOpacity,
          transition:"filter 1.5s ease, opacity 1.5s ease"
        }}>
          <defs>
            <linearGradient id="sg" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={c} stopOpacity="1"/>
              <stop offset="85%" stopColor={c} stopOpacity={ri>=3?0.8:0.3}/>
              <stop offset="100%" stopColor={c} stopOpacity="0"/>
            </linearGradient>
            {ri >= 2 && (
              <filter id="silGlow">
                <feGaussianBlur in="SourceGraphic" stdDeviation={ri} result="b"/>
                <feMerge><feMergeNode in="b"/><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
              </filter>
            )}
          </defs>

          {/* Spiky hair — more spikes at higher rank */}
          {[[-16,0],[-10,-6],[-4,-9],[0,-11],[4,-9],[10,-6],[16,0]].slice(0, 3+ri).map(([dx,dy],i)=>(
            <path key={i} d={`M${50+dx} 28 L${50+dx*0.4+dy*0.3} ${12+dy} L${50+dx*0.7} 24`} fill="url(#sg)" filter={ri>=2?"url(#silGlow)":undefined}/>
          ))}

          {/* Head */}
          <ellipse cx="50" cy="32" rx="14" ry="16" fill="url(#sg)" filter={ri>=2?"url(#silGlow)":undefined}/>

          {/* Neck + torso */}
          <path d="M44 47 L38 50 L35 95 L38 155 L62 155 L65 95 L62 50 L56 47Z" fill="url(#sg)" filter={ri>=2?"url(#silGlow)":undefined}/>

          {/* Coat flaps — long coat at B+ */}
          {ri >= 3 && <>
            <path d="M38 95 Q25 130 22 180 L32 183 Q36 145 40 110Z" fill="url(#sg)" opacity="0.7"/>
            <path d="M62 95 Q75 130 78 180 L68 183 Q64 145 60 110Z" fill="url(#sg)" opacity="0.7"/>
          </>}

          {/* Left arm */}
          <path d="M38 52 L28 58 L24 95 L30 97 L32 65 L40 58Z" fill="url(#sg)" filter={ri>=2?"url(#silGlow)":undefined}/>

          {/* Right arm raised with sword */}
          <path d="M62 52 L72 56 L76 88 L70 90 L68 62 L60 58Z" fill="url(#sg)" filter={ri>=2?"url(#silGlow)":undefined}/>

          {/* Sword — visible from rank D+, glowing at A+ */}
          {ri >= 1 && (
            <g filter={ri>=4?"url(#silGlow)":undefined}>
              <path d="M76 88 L62 195 L66 196 L80 90Z" fill={ri>=4?c:"url(#sg)"} opacity={ri>=4?1:0.8}
                style={ri>=4?{filter:`drop-shadow(0 0 8px ${c})`}:{}}/>
              <path d="M68 88 L74 88 L72 96 L70 96Z" fill={c} opacity="0.9"/>
            </g>
          )}

          {/* Legs */}
          <path d="M42 155 L38 215 L44 216 L48 170 L52 170 L56 216 L62 215 L58 155Z" fill="url(#sg)" filter={ri>=2?"url(#silGlow)":undefined}/>

          {/* Shadow orb (rank S only) */}
          {ri >= 5 && (
            <circle cx="26" cy="92" r="10" fill={c} opacity="0.9"
              style={{filter:`drop-shadow(0 0 12px ${c}) drop-shadow(0 0 25px ${c})`,animation:"pulseG 2s ease-in-out infinite"}}/>
          )}

          {/* Aura outline at high rank */}
          {ri >= 4 && (
            <path d="M44 47 L38 50 L35 95 L38 155 L62 155 L65 95 L62 50 L56 47Z M50 16 Q34 28 36 48 Q46 44 54 44 Q66 28 50 16Z"
              fill="none" stroke={c} strokeWidth="0.8" opacity="0.5" style={{animation:"auraB 2s ease-in-out infinite"}}/>
          )}
        </svg>

        {/* Quest progress aura: flames/sparks rising as you complete quests */}
        {progress > 0 && Array.from({length:Math.ceil(progress*8)},(_,i)=>(
          <div key={i} style={{
            position:"absolute",
            bottom: `${5+Math.random()*20}%`,
            left: `${30+Math.random()*40}%`,
            width:2+Math.random()*2,
            height:8+Math.random()*16,
            background:`linear-gradient(0deg,${c},transparent)`,
            borderRadius:4,
            opacity:0.4+Math.random()*0.4,
            animation:`fireFlick ${0.6+Math.random()*0.8}s ease-in-out infinite`,
            animationDelay:`${Math.random()*1.5}s`,
            filter:`blur(${Math.random()*1.5}px)`
          }}/>
        ))}
      </div>

      {/* Shadow pool under feet */}
      <div style={{
        position:"absolute",bottom:"4%",left:"50%",transform:"translateX(-50%)",
        width:100+ri*30,height:8+ri*3,borderRadius:"50%",
        background:c,opacity:0.06+ri*0.04,
        filter:`blur(${8+ri*2}px)`,
        animation:"auraB 4s ease-in-out infinite"
      }}/>

      {/* Top & bottom vignette */}
      <div style={{position:"absolute",top:0,left:0,right:0,height:"28%",background:"linear-gradient(180deg,#000 0%,transparent 100%)"}}/>
      <div style={{position:"absolute",bottom:0,left:0,right:0,height:"15%",background:"linear-gradient(0deg,#000 0%,transparent 100%)"}}/>
    </div>
  );
}

// ── BOSS SVG ──────────────────────────────────────────────
// ── BOSS IMAGE MAP ────────────────────────────────────────
const BOSS_IMGS = {
  sloth:   "https://raw.githubusercontent.com/Samelannister/arise-app/main/public/bosses/3346886B-A7BD-484A-A7E1-F33F198B7F23.png",
  procras: "https://raw.githubusercontent.com/Samelannister/arise-app/main/public/bosses/A46A22F7-4201-4ADE-B7C5-CC22C2A53B19.png",
  screen:  "https://raw.githubusercontent.com/Samelannister/arise-app/main/public/bosses/871FA52C-6E9C-4144-8702-E0C27352AB24.png",
  doubt:   "https://raw.githubusercontent.com/Samelannister/arise-app/main/public/bosses/45547F41-C3AE-4E67-ACC7-BE6674A0F501.png",
  sleep:   "https://raw.githubusercontent.com/Samelannister/arise-app/main/public/bosses/A61B02A7-DC4F-4A2F-B637-934281A4C13D.png",
  compare: "https://raw.githubusercontent.com/Samelannister/arise-app/main/public/bosses/492B8130-61E8-47BD-A30C-B930C8095F40.png",
  chaos:   "https://raw.githubusercontent.com/Samelannister/arise-app/main/public/bosses/C4267998-3A78-4420-B740-0659129E5620.png",
  perfect: "https://raw.githubusercontent.com/Samelannister/arise-app/main/public/bosses/8AEBD3F2-F434-4720-8B0B-C835239A292F.png",
  fear:    "https://raw.githubusercontent.com/Samelannister/arise-app/main/public/bosses/BE209237-6AD6-4E94-9F9D-CD615E3F92C3.png",
  igris:   "https://raw.githubusercontent.com/Samelannister/arise-app/main/public/bosses/146E414E-C936-49AA-949C-FAFBFB44703A.png",
  shadow:  "https://raw.githubusercontent.com/Samelannister/arise-app/main/public/bosses/0531A505-CF21-46AF-9B15-22658866FC02.png",
  antares: "https://raw.githubusercontent.com/Samelannister/arise-app/main/public/bosses/AF204753-3646-476A-945D-25A1F08E268E.png",
};

function BossSVG({ bossId, color, size=80, isShaking, isDead }) {
  const c = color;
  const imgFile = BOSS_IMGS[bossId];
  const anim = isDead ? "bossDie 1.2s ease forwards" : isShaking ? "bossShake 0.5s ease" : "bossBreath 3s ease-in-out infinite";

  if (imgFile) {
    const imgSize = Math.max(size, 120);
    return (
      <div style={{
        width: imgSize, height: imgSize, flexShrink: 0,
        animation: anim,
        filter: isDead
          ? "drop-shadow(0 0 20px #39FF14) drop-shadow(0 0 40px #39FF1488) brightness(1.3)"
          : `drop-shadow(0 0 16px ${c}) drop-shadow(0 0 32px ${c}66)`,
        borderRadius: 12,
        overflow: "hidden",
        display: "flex", alignItems: "center", justifyContent: "center",
        background: "transparent",
      }}>
        <img
          src={imgFile}
          alt={bossId}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            display: "block",
          }}
        />
      </div>
    );
  }

  // ── SVG fallback pour les boss sans image ──
  const st = { width:size, height:size, filter:`drop-shadow(0 0 14px ${isDead?"#39FF14":c}) drop-shadow(0 0 28px ${c}55)`, animation:anim };


  if (bossId === "sloth") return (
    <svg viewBox="0 0 100 100" style={st}>
      <ellipse cx="50" cy="55" rx="40" ry="38" fill={`${c}22`} stroke={c} strokeWidth="2"/>
      <path d="M20 45 Q50 20 80 45 Q70 30 50 28 Q30 30 20 45Z" fill={`${c}33`} stroke={c} strokeWidth="1.5"/>
      <ellipse cx="36" cy="52" rx="10" ry="6" fill={`${c}44`} stroke={c} strokeWidth="1.5"/>
      <ellipse cx="64" cy="52" rx="10" ry="6" fill={`${c}44`} stroke={c} strokeWidth="1.5"/>
      <ellipse cx="36" cy="52" rx="7" ry="4" fill={c}/>
      <ellipse cx="64" cy="52" rx="7" ry="4" fill={c}/>
      <rect x="26" y="49" width="20" height="5" rx="2" fill="#000C"/>
      <rect x="54" y="49" width="20" height="5" rx="2" fill="#000C"/>
      <path d="M26 48 Q36 44 46 48" stroke={c} strokeWidth="2" fill="none"/>
      <path d="M54 48 Q64 44 74 48" stroke={c} strokeWidth="2" fill="none"/>
      <path d="M30 70 Q50 82 70 70 Q60 78 50 80 Q40 78 30 70Z" fill={`${c}44`} stroke={c} strokeWidth="1.5"/>
      <path d="M45 80 Q44 88 43 92" stroke={`${c}88`} strokeWidth="1.5" strokeLinecap="round" fill="none"/>
      <path d="M55 80 Q56 89 56 93" stroke={`${c}88`} strokeWidth="1.5" strokeLinecap="round" fill="none"/>
      <path d="M28 30 L22 14 L35 24Z" fill={c}/><path d="M72 30 L78 14 L65 24Z" fill={c}/>
      <path d="M28 58 Q36 62 44 58" stroke={`${c}66`} strokeWidth="1" fill="none"/>
      <path d="M56 58 Q64 62 72 58" stroke={`${c}66`} strokeWidth="1" fill="none"/>
    </svg>
  );

  if (bossId === "procras") return (
    <svg viewBox="0 0 100 100" style={st}>
      <ellipse cx="50" cy="54" rx="40" ry="38" fill={`${c}22`} stroke={c} strokeWidth="2"/>
      <path d="M18 44 Q50 18 82 44 Q72 28 50 26 Q28 28 18 44Z" fill={`${c}33`} stroke={c} strokeWidth="1.5"/>
      <circle cx="36" cy="52" r="11" fill={`${c}22`} stroke={c} strokeWidth="1.5"/>
      <circle cx="64" cy="52" r="11" fill={`${c}22`} stroke={c} strokeWidth="1.5"/>
      <circle cx="36" cy="52" r="8" fill={`${c}33`}/>
      <circle cx="64" cy="52" r="8" fill={`${c}33`}/>
      <line x1="36" y1="52" x2="36" y2="45" stroke={c} strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="36" y1="52" x2="42" y2="54" stroke={c} strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="64" y1="52" x2="64" y2="45" stroke={c} strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="64" y1="52" x2="70" y2="54" stroke={c} strokeWidth="1.5" strokeLinecap="round"/>
      <circle cx="36" cy="52" r="2" fill={c}/><circle cx="64" cy="52" r="2" fill={c}/>
      <ellipse cx="50" cy="74" rx="14" ry="10" fill="#000" stroke={c} strokeWidth="1.5"/>
      <path d="M38 69 L41 74 L44 69" stroke={c} strokeWidth="1" fill="none"/>
      <path d="M56 69 L59 74 L62 69" stroke={c} strokeWidth="1" fill="none"/>
      <path d="M30 26 Q25 15 30 10 Q35 15 32 22Z" fill={c}/><path d="M70 26 Q75 15 70 10 Q65 15 68 22Z" fill={c}/>
    </svg>
  );

  if (bossId === "screen") return (
    <svg viewBox="0 0 100 100" style={st}>
      <ellipse cx="50" cy="54" rx="40" ry="38" fill={`${c}22`} stroke={c} strokeWidth="2"/>
      <path d="M18 44 Q50 20 82 44" fill={`${c}33`} stroke={c} strokeWidth="1.5"/>
      <rect x="22" y="44" width="24" height="16" rx="3" fill={`${c}44`} stroke={c} strokeWidth="1.5"/>
      <rect x="54" y="44" width="24" height="16" rx="3" fill={`${c}44`} stroke={c} strokeWidth="1.5"/>
      <rect x="24" y="46" width="20" height="12" rx="2" fill={c} opacity="0.7"/>
      <rect x="56" y="46" width="20" height="12" rx="2" fill={c} opacity="0.7"/>
      <text x="25" y="55" fontSize="6" fill="white" opacity="0.8">▶▶</text>
      <text x="57" y="55" fontSize="6" fill="white" opacity="0.8">♪♪</text>
      <path d="M33 72 Q50 82 67 72" stroke={c} strokeWidth="2.5" fill="none" strokeLinecap="round"/>
      <path d="M18 54 Q10 50 6 55" stroke={`${c}88`} strokeWidth="2" fill="none"/>
      <path d="M82 54 Q90 50 94 55" stroke={`${c}88`} strokeWidth="2" fill="none"/>
      <circle cx="6" cy="55" r="3" fill={c} opacity="0.7"/>
      <circle cx="94" cy="55" r="3" fill={c} opacity="0.7"/>
    </svg>
  );

  if (bossId === "doubt") return (
    <svg viewBox="0 0 100 100" style={st}>
      <path d="M50 10 L10 40 L50 50 L90 40Z" stroke={`${c}33`} strokeWidth="0.8" fill="none"/>
      <path d="M50 10 L50 90" stroke={`${c}22`} strokeWidth="0.8" fill="none"/>
      <path d="M10 50 L90 50" stroke={`${c}22`} strokeWidth="0.8" fill="none"/>
      <path d="M20 20 L80 80" stroke={`${c}22`} strokeWidth="0.8" fill="none"/>
      <path d="M80 20 L20 80" stroke={`${c}22`} strokeWidth="0.8" fill="none"/>
      <ellipse cx="50" cy="54" rx="36" ry="34" fill={`${c}22`} stroke={c} strokeWidth="2"/>
      {[[-14,42],[0,38],[14,42],[22,50],[14,58],[0,62],[-14,58],[-22,50]].map(([dx,cy],i)=><circle key={i} cx={50+dx} cy={cy} r={i<2||i>5?3:2} fill={c} opacity={0.9}/>)}
      <ellipse cx="38" cy="50" rx="8" ry="7" fill={`${c}33`} stroke={c} strokeWidth="1.5"/>
      <ellipse cx="62" cy="50" rx="8" ry="7" fill={`${c}33`} stroke={c} strokeWidth="1.5"/>
      <ellipse cx="38" cy="50" rx="5" ry="5" fill={c}/>
      <ellipse cx="62" cy="50" rx="5" ry="5" fill={c}/>
      <circle cx="40" cy="48" r="1.5" fill="white" opacity="0.8"/>
      <circle cx="64" cy="48" r="1.5" fill="white" opacity="0.8"/>
      <path d="M38 72 L32 82 L36 84 L40 74Z" fill={c}/><path d="M62 72 L68 82 L64 84 L60 74Z" fill={c}/>
      <path d="M36 66 Q50 73 64 66" stroke={c} strokeWidth="1.5" fill="none" strokeLinecap="round"/>
      <path d="M14 40 Q8 30 4 22" stroke={c} strokeWidth="1.5" fill="none"/>
      <path d="M14 50 Q6 50 2 48" stroke={c} strokeWidth="1.5" fill="none"/>
      <path d="M86 40 Q92 30 96 22" stroke={c} strokeWidth="1.5" fill="none"/>
      <path d="M86 50 Q94 50 98 48" stroke={c} strokeWidth="1.5" fill="none"/>
    </svg>
  );

  if (bossId === "sleep") return (
    <svg viewBox="0 0 100 100" style={st}>
      <path d="M50 15 Q75 15 80 50 Q80 80 70 90 Q60 82 50 88 Q40 82 30 90 Q20 80 20 50 Q25 15 50 15Z" fill={`${c}22`} stroke={c} strokeWidth="2"/>
      <path d="M20 90 Q26 82 32 90 Q38 98 44 90 Q50 82 56 90 Q62 98 68 90 Q74 82 80 90" stroke={c} strokeWidth="1.5" fill="none"/>
      <path d="M34 48 Q40 44 46 48" stroke={c} strokeWidth="2.5" fill="none" strokeLinecap="round"/>
      <path d="M54 48 Q60 44 66 48" stroke={c} strokeWidth="2.5" fill="none" strokeLinecap="round"/>
      <path d="M42 62 Q50 66 58 62" stroke={c} strokeWidth="1.5" fill="none" strokeLinecap="round"/>
      <text x="66" y="40" fontSize="10" fill={c} fontWeight="bold" opacity="0.9">Z</text>
      <text x="74" y="28" fontSize="8" fill={c} fontWeight="bold" opacity="0.7">Z</text>
      <text x="80" y="18" fontSize="6" fill={c} fontWeight="bold" opacity="0.5">Z</text>
      <path d="M34 22 Q40 14 50 18 Q45 12 42 8 Q50 6 56 12 Q60 14 66 22" stroke={c} strokeWidth="1.5" fill={`${c}33`}/>
    </svg>
  );

  if (bossId === "compare") return (
    <svg viewBox="0 0 100 100" style={st}>
      <ellipse cx="50" cy="54" rx="40" ry="38" fill={`${c}22`} stroke={c} strokeWidth="2"/>
      <line x1="50" y1="16" x2="50" y2="92" stroke={c} strokeWidth="1.5" strokeDasharray="3,2" opacity="0.6"/>
      <ellipse cx="38" cy="48" rx="5" ry="4" fill={`${c}44`} stroke={c} strokeWidth="1"/>
      <ellipse cx="38" cy="48" rx="3" ry="3" fill={c}/>
      <path d="M30 66 Q37 60 44 66" stroke={c} strokeWidth="2" fill="none" strokeLinecap="round"/>
      <path d="M35 52 Q34 57 35 60" stroke={`${c}BB`} strokeWidth="1.5" fill="none"/>
      <ellipse cx="62" cy="48" rx="5" ry="4" fill={`${c}44`} stroke={c} strokeWidth="1"/>
      <ellipse cx="62" cy="48" rx="3" ry="3" fill={c}/>
      <circle cx="63" cy="46" r="1" fill="white" opacity="0.8"/>
      <path d="M54 67 Q62 75 70 67 Q62 73 54 67Z" fill={`${c}44`} stroke={c} strokeWidth="1.5"/>
      <path d="M54 28 L56 22 L60 26 L64 20 L68 26 L72 22 L74 28Z" fill={c} stroke={c} strokeWidth="0.8"/>
      <path d="M26 30 L22 18 L32 26Z" fill={`${c}77`}/>
    </svg>
  );

  if (bossId === "chaos") return (
    <svg viewBox="0 0 100 100" style={st}>
      <ellipse cx="50" cy="54" rx="40" ry="38" fill={`${c}22`} stroke={c} strokeWidth="2"/>
      {[-35,-22,-8,8,22,35].map((dx,i)=><path key={i} d={`M${50+dx} 18 Q${50+dx+dx*0.5} 8 ${50+dx+dx*0.8} 2`} stroke={c} strokeWidth="2" fill="none" strokeLinecap="round"/>)}
      <path d="M36 50 Q36 44 42 44 Q48 44 48 50 Q48 56 42 56 Q36 56 36 50Z" stroke={c} strokeWidth="1.5" fill={`${c}22`}/>
      <path d="M38 50 Q38 46 42 46 Q46 46 46 50" stroke={c} strokeWidth="1" fill="none"/>
      <circle cx="42" cy="50" r="2.5" fill={c}/>
      <path d="M52 50 Q52 44 58 44 Q64 44 64 50 Q64 56 58 56 Q52 56 52 50Z" stroke={c} strokeWidth="1.5" fill={`${c}22`}/>
      <circle cx="58" cy="50" r="2.5" fill={c}/>
      <path d="M30 70 L36 64 L42 70 L48 64 L54 70 L60 64 L66 70 L70 64" stroke={c} strokeWidth="2" fill="none" strokeLinecap="round"/>
      <text x="12" y="55" fontSize="10" fill={c} opacity="0.7">?</text>
      <text x="82" y="48" fontSize="10" fill={c} opacity="0.7">!</text>
    </svg>
  );

  if (bossId === "perfect") return (
    <svg viewBox="0 0 100 100" style={st}>
      <ellipse cx="50" cy="54" rx="40" ry="38" fill={`${c}22`} stroke={c} strokeWidth="2"/>
      <path d="M50 16 L48 30 L52 40 L46 50 L50 60 L48 75 L50 92" stroke={`${c}88`} strokeWidth="1.2" fill="none"/>
      <path d="M30 30 L40 38 L34 46 L42 55" stroke={`${c}55`} strokeWidth="0.8" fill="none"/>
      <path d="M70 30 L60 38 L66 46 L58 55" stroke={`${c}55`} strokeWidth="0.8" fill="none"/>
      <rect x="28" y="44" width="18" height="12" rx="2" fill={`${c}33`} stroke={c} strokeWidth="1.5"/>
      <rect x="54" y="44" width="18" height="12" rx="2" fill={`${c}33`} stroke={c} strokeWidth="1.5"/>
      <rect x="30" y="46" width="14" height="8" rx="1" fill={c} opacity="0.8"/>
      <rect x="56" y="46" width="14" height="8" rx="1" fill={c} opacity="0.8"/>
      <rect x="33" y="47" width="8" height="6" fill="#000"/>
      <rect x="59" y="47" width="8" height="6" fill="#000"/>
      <circle cx="36" cy="50" r="2" fill={c}/><circle cx="62" cy="50" r="2" fill={c}/>
      <rect x="26" y="40" width="22" height="3" rx="1" fill={c} transform="rotate(-5 37 42)"/>
      <rect x="52" y="40" width="22" height="3" rx="1" fill={c} transform="rotate(5 63 42)"/>
      <rect x="34" y="67" width="32" height="3" rx="1.5" fill={c}/>
      <path d="M28 22 L32 14 L38 20 L44 12 L50 18 L56 12 L62 20 L68 14 L72 22Z" fill={`${c}55`} stroke={c} strokeWidth="1.2"/>
    </svg>
  );

  if (bossId === "fear") return (
    <svg viewBox="0 0 100 100" style={st}>
      <ellipse cx="50" cy="54" rx="40" ry="38" fill={`${c}22`} stroke={c} strokeWidth="2.5"/>
      {[0,30,60,90,120,150,210,240,270,300,330].map((a,i)=><line key={i} x1={50+20*Math.cos(a*Math.PI/180)} y1={54+20*Math.sin(a*Math.PI/180)} x2={50+42*Math.cos(a*Math.PI/180)} y2={54+42*Math.sin(a*Math.PI/180)} stroke={`${c}44`} strokeWidth="0.8"/>)}
      <circle cx="36" cy="48" r="11" fill={`${c}22`} stroke={c} strokeWidth="2"/>
      <circle cx="64" cy="48" r="11" fill={`${c}22`} stroke={c} strokeWidth="2"/>
      <circle cx="36" cy="48" r="5" fill={c}/><circle cx="64" cy="48" r="5" fill={c}/>
      <circle cx="36" cy="48" r="2.5" fill="#000"/><circle cx="64" cy="48" r="2.5" fill="#000"/>
      <circle cx="37.5" cy="46" r="1.5" fill="white" opacity="0.9"/>
      <circle cx="65.5" cy="46" r="1.5" fill="white" opacity="0.9"/>
      <ellipse cx="50" cy="74" rx="16" ry="12" fill="#000" stroke={c} strokeWidth="2"/>
      <path d="M36 68 L40 74 L44 68" fill="none" stroke={c} strokeWidth="1.2"/>
      <path d="M56 68 L60 74 L64 68" fill="none" stroke={c} strokeWidth="1.2"/>
      <path d="M24 28 Q18 16 26 10 Q30 18 28 26Z" fill={c}/>
      <path d="M76 28 Q82 16 74 10 Q70 18 72 26Z" fill={c}/>
    </svg>
  );

  if (bossId === "igris") return (
    <svg viewBox="0 0 100 100" style={st}>
      <path d="M20 55 Q20 20 50 16 Q80 20 80 55 L78 64 L22 64Z" fill={`${c}33`} stroke={c} strokeWidth="2"/>
      <path d="M24 52 L76 52 L74 64 L26 64Z" fill={`${c}22`} stroke={c} strokeWidth="1.5"/>
      <ellipse cx="37" cy="57" rx="9" ry="7" fill="#000" stroke={c} strokeWidth="1.5"/>
      <ellipse cx="63" cy="57" rx="9" ry="7" fill="#000" stroke={c} strokeWidth="1.5"/>
      <ellipse cx="37" cy="57" rx="6" ry="5" fill={c}/>
      <ellipse cx="63" cy="57" rx="6" ry="5" fill={c}/>
      <path d="M28 28 Q50 22 72 28" stroke="white" strokeWidth="1.5" opacity="0.15" fill="none"/>
      <path d="M50 16 Q46 6 50 2 Q54 6 50 16Z" fill={c}/>
      <path d="M42 18 Q36 10 40 6 Q44 10 42 18Z" fill={`${c}99`}/>
      <path d="M58 18 Q64 10 60 6 Q56 10 58 18Z" fill={`${c}99`}/>
      <path d="M26 64 L30 80 L42 76 L50 82 L58 76 L70 80 L74 64" fill={`${c}22`} stroke={c} strokeWidth="1.5"/>
      <path d="M36 68 L36 75" stroke={c} strokeWidth="1.2"/>
      <path d="M50 70 L50 78" stroke={c} strokeWidth="1.2"/>
      <path d="M64 68 L64 75" stroke={c} strokeWidth="1.2"/>
    </svg>
  );

  if (bossId === "shadow") return (
    <svg viewBox="0 0 100 100" style={st}>
      <ellipse cx="50" cy="52" rx="36" ry="40" fill={`${c}22`} stroke={c} strokeWidth="2"/>
      <path d="M36 14 Q28 4 22 2" stroke={c} strokeWidth="2" fill="none" strokeLinecap="round"/>
      <circle cx="22" cy="2" r="3" fill={c}/>
      <path d="M64 14 Q72 4 78 2" stroke={c} strokeWidth="2" fill="none" strokeLinecap="round"/>
      <circle cx="78" cy="2" r="3" fill={c}/>
      {[[32,42],[42,40],[58,40],[68,42]].map(([cx,cy],i)=><g key={i}><ellipse cx={cx} cy={cy} rx={i===1||i===2?8:6} ry={i===1||i===2?7:5} fill={`${c}33`} stroke={c} strokeWidth="1.2"/><ellipse cx={cx} cy={cy} rx={i===1||i===2?5:4} ry={i===1||i===2?5:4} fill={c}/><circle cx={cx-1} cy={cy-1} r="1.2" fill="white" opacity="0.7"/></g>)}
      <path d="M30 68 L20 82 L28 86 L36 72Z" fill={`${c}55`} stroke={c} strokeWidth="1.2"/>
      <path d="M70 68 L80 82 L72 86 L64 72Z" fill={`${c}55`} stroke={c} strokeWidth="1.2"/>
      <path d="M36 64 Q50 72 64 64 Q55 70 50 72 Q45 70 36 64Z" fill={`${c}44`} stroke={c} strokeWidth="1.5"/>
      <path d="M14 44 Q8 38 4 32" stroke={c} strokeWidth="1.5" fill="none"/>
      <path d="M14 54 Q6 54 2 52" stroke={c} strokeWidth="1.5" fill="none"/>
      <path d="M86 44 Q92 38 96 32" stroke={c} strokeWidth="1.5" fill="none"/>
      <path d="M86 54 Q94 54 98 52" stroke={c} strokeWidth="1.5" fill="none"/>
    </svg>
  );

  // antares (default)
  return (
    <svg viewBox="0 0 100 100" style={st}>
      <circle cx="50" cy="50" r="48" fill="none" stroke={c} strokeWidth="0.5" opacity="0.3"/>
      <ellipse cx="50" cy="56" rx="38" ry="36" fill={`${c}22`} stroke={c} strokeWidth="2.5"/>
      <path d="M18 32 L22 20 L28 28 L34 16 L40 24 L50 12 L60 24 L66 16 L72 28 L78 20 L82 32Z" fill={`${c}55`} stroke={c} strokeWidth="1.5"/>
      <circle cx="34" cy="16" r="3" fill={c}/><circle cx="50" cy="12" r="4" fill={c}/><circle cx="66" cy="16" r="3" fill={c}/>
      <ellipse cx="36" cy="52" rx="11" ry="9" fill={`${c}33`} stroke={c} strokeWidth="2"/>
      <ellipse cx="64" cy="52" rx="11" ry="9" fill={`${c}33`} stroke={c} strokeWidth="2"/>
      <ellipse cx="36" cy="52" rx="8" ry="7" fill={c}/>
      <ellipse cx="64" cy="52" rx="8" ry="7" fill={c}/>
      <ellipse cx="36" cy="52" rx="4" ry="5" fill="#000"/><ellipse cx="64" cy="52" rx="4" ry="5" fill="#000"/>
      <circle cx="38" cy="49" r="2.5" fill="white" opacity="0.9"/><circle cx="66" cy="49" r="2.5" fill="white" opacity="0.9"/>
      <path d="M24 42 Q36 37 48 42" stroke={c} strokeWidth="2.5" fill="none" strokeLinecap="round"/>
      <path d="M52 42 Q64 37 76 42" stroke={c} strokeWidth="2.5" fill="none" strokeLinecap="round"/>
      <path d="M30 74 Q50 84 70 74 Q60 82 50 84 Q40 82 30 74Z" fill={`${c}44`} stroke={c} strokeWidth="1.5"/>
      <path d="M22 36 Q12 20 18 10 Q24 20 26 34Z" fill={c}/>
      <path d="M78 36 Q88 20 82 10 Q76 20 74 34Z" fill={c}/>
    </svg>
  );
}

// ── UI PRIMITIVES ─────────────────────────────────────────
function Bar({v,max,color,h=5}) {
  return (
    <div style={{background:"rgba(0,0,0,0.5)",borderRadius:h,height:h,overflow:"hidden",border:`1px solid ${color}22`}}>
      <div style={{width:`${Math.min(100,(v/Math.max(max,1))*100)}%`,height:"100%",background:`linear-gradient(90deg,${color}66,${color})`,borderRadius:h,transition:"width 0.8s cubic-bezier(.23,1.4,.42,1)",boxShadow:`0 0 ${h*1.5}px ${color}77`}}/>
    </div>
  );
}

function Toasts({list}) {
  return (
    <div style={{position:"fixed",top:14,right:12,zIndex:9500,display:"flex",flexDirection:"column",gap:6,maxWidth:270}}>
      {list.map(t=>(
        <div key={t.id} style={{background:"rgba(2,0,6,0.97)",border:`1px solid ${t.color||"#A855F7"}77`,borderRadius:12,padding:"9px 12px",boxShadow:`0 0 18px ${t.color||"#A855F7"}44`,animation:"toastIn 3.5s ease forwards",backdropFilter:"blur(10px)"}}>
          <div style={{display:"flex",gap:8,alignItems:"center"}}>
            <span style={{fontSize:17}}>{t.icon}</span>
            <div>
              <div style={{fontSize:11,fontFamily:"'Orbitron',monospace",color:t.color||"#A855F7",fontWeight:700}}>{t.title}</div>
              {t.desc&&<div style={{fontSize:10,color:"#7BA7CC",fontFamily:"'Rajdhani',sans-serif",marginTop:1}}>{t.desc}</div>}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function SysDialog({title,body,btn,onClose,color="#A855F7"}) {
  return (
    <div style={{position:"fixed",inset:0,zIndex:9200,display:"flex",alignItems:"center",justifyContent:"center",background:"rgba(0,0,0,0.9)",backdropFilter:"blur(8px)"}} onClick={onClose}>
      <div style={{maxWidth:295,width:"90%",animation:"sysIn 0.4s ease"}} onClick={e=>e.stopPropagation()}>
        <div style={{height:1,background:`linear-gradient(90deg,transparent,${color},transparent)`,marginBottom:18}}/>
        <div style={{background:"rgba(2,0,5,0.99)",border:`1px solid ${color}44`,borderRadius:4,padding:"20px 18px"}}>
          <div style={{fontSize:8,color:"#2A2A3A",fontFamily:"'Orbitron',monospace",letterSpacing:"0.4em",marginBottom:10}}>[ SYSTÈME ]</div>
          <div style={{fontSize:14,fontFamily:"'Orbitron',monospace",fontWeight:700,color,marginBottom:10,lineHeight:1.4}}>{title}</div>
          <div style={{fontSize:12,color:"#8BADD4",fontFamily:"'Rajdhani',sans-serif",lineHeight:1.75,whiteSpace:"pre-line",marginBottom:18}}>{body}</div>
          <button onClick={onClose} style={{width:"100%",padding:"10px",background:`${color}12`,border:`1px solid ${color}55`,borderRadius:6,cursor:"pointer",fontSize:11,fontFamily:"'Orbitron',monospace",color,letterSpacing:"0.1em"}}>{btn} ›</button>
        </div>
        <div style={{height:1,background:`linear-gradient(90deg,transparent,${color},transparent)`,marginTop:18}}/>
      </div>
    </div>
  );
}

function RankUpScreen({rankData,onClose}) {
  return (
    <div style={{position:"fixed",inset:0,zIndex:9100,display:"flex",alignItems:"center",justifyContent:"center",background:"rgba(0,0,0,0.97)"}}>
      <div style={{textAlign:"center",animation:"rankReveal 0.8s cubic-bezier(.23,1.4,.42,1)"}}>
        <div style={{fontSize:8,color:"#2A2A3A",fontFamily:"'Orbitron',monospace",letterSpacing:"0.4em",marginBottom:14}}>⬛ SYSTÈME : ÉVOLUTION</div>
        <div style={{fontSize:63,marginBottom:12,filter:`drop-shadow(0 0 30px ${rankData.color})`}}>🚪</div>
        <div style={{fontSize:9,color:"#8BADD4",fontFamily:"'Orbitron',monospace",letterSpacing:"0.3em",marginBottom:8}}>UNE NOUVELLE PORTE S'OUVRE</div>
        <div style={{fontSize:47,fontFamily:"'Orbitron',monospace",fontWeight:900,color:rankData.color,textShadow:`0 0 20px ${rankData.color}`,letterSpacing:"0.1em",marginBottom:6}}>RANG {rankData.rank}</div>
        <div style={{fontSize:15,color:"#777",fontFamily:"'Rajdhani',sans-serif",marginBottom:4}}>{rankData.title}</div>
        <div style={{fontSize:11,color:"#8BADD4",fontFamily:"monospace",marginBottom:26,fontStyle:"italic"}}>"{rankData.lore}"</div>
        <button onClick={onClose} style={{padding:"12px 30px",background:`${rankData.color}18`,border:`1px solid ${rankData.color}`,borderRadius:12,cursor:"pointer",fontSize:13,fontFamily:"'Orbitron',monospace",fontWeight:700,color:rankData.color,letterSpacing:"0.1em"}}>ACCEPTER ›</button>
      </div>
    </div>
  );
}

function TitleRevealScreen({t,onClose}) {
  return (
    <div style={{position:"fixed",inset:0,zIndex:9050,display:"flex",alignItems:"center",justifyContent:"center",background:"rgba(0,0,0,0.92)",backdropFilter:"blur(8px)"}}>
      <div style={{textAlign:"center",maxWidth:270,width:"88%",animation:"titleRevealAnim 0.7s cubic-bezier(.23,1.4,.42,1)"}}>
        <div style={{fontSize:8,color:"#FFD70088",fontFamily:"'Orbitron',monospace",letterSpacing:"0.35em",marginBottom:12}}>⬛ SYSTÈME : TITRE DÉBLOQUÉ</div>
        <div style={{fontSize:53,marginBottom:10,filter:"drop-shadow(0 0 20px #FFD700)"}}>{t.emoji}</div>
        <div style={{fontSize:15,fontFamily:"'Orbitron',monospace",fontWeight:700,color:"#FFD700",marginBottom:5}}>{t.name}</div>
        <div style={{fontSize:10,color:"#7BA7CC",fontFamily:"monospace",marginBottom:20}}>{t.desc}</div>
        <button onClick={onClose} style={{padding:"10px 26px",background:"rgba(255,215,0,0.1)",border:"1px solid #FFD700",borderRadius:11,cursor:"pointer",fontSize:12,fontFamily:"'Orbitron',monospace",fontWeight:700,color:"#FFD700"}}>ACCEPTER ›</button>
      </div>
    </div>
  );
}

function VictoryScreen({boss,gold,xp,onClose}) {
  return (
    <div style={{position:"fixed",inset:0,zIndex:8900,display:"flex",alignItems:"center",justifyContent:"center",background:"rgba(0,0,0,0.93)"}}>
      <div style={{textAlign:"center",maxWidth:285,width:"88%",animation:"rankReveal 0.6s ease"}}>
        <div style={{fontSize:8,color:"#39FF14",fontFamily:"'Orbitron',monospace",letterSpacing:"0.3em",marginBottom:12}}>⬛ SYSTÈME : VICTOIRE</div>
        <div style={{display:"flex",justifyContent:"center",marginBottom:10}}>
          <BossSVG bossId={boss.id} color="#39FF14" size={70} isDead/>
        </div>
        <div style={{fontSize:17,fontFamily:"'Orbitron',monospace",fontWeight:900,color:"#FFD700",marginBottom:3}}>{boss.name}</div>
        <div style={{fontSize:10,color:"#8BADD4",fontFamily:"monospace",marginBottom:7}}>a été vaincu</div>
        <div style={{fontSize:11,color:"#7BA7CC",fontFamily:"'Rajdhani',sans-serif",marginBottom:18,fontStyle:"italic",lineHeight:1.6}}>"{boss.death}"</div>
        <div style={{background:"rgba(255,215,0,0.05)",border:"1px solid rgba(255,215,0,0.2)",borderRadius:12,padding:"12px",marginBottom:16}}>
          <div style={{display:"flex",justifyContent:"center",gap:22}}>
            <div><div style={{fontSize:18,fontFamily:"'Orbitron',monospace",fontWeight:900,color:"#FFD700"}}>+{gold}</div><div style={{fontSize:8,color:"#8BADD4",fontFamily:"monospace"}}>GOLD</div></div>
            <div><div style={{fontSize:18,fontFamily:"'Orbitron',monospace",fontWeight:900,color:"#A855F7"}}>+{xp}</div><div style={{fontSize:8,color:"#8BADD4",fontFamily:"monospace"}}>XP BONUS</div></div>
          </div>
        </div>
        <button onClick={onClose} style={{padding:"11px 26px",background:"rgba(255,215,0,0.14)",border:"1px solid #FFD700",borderRadius:11,cursor:"pointer",fontSize:13,fontFamily:"'Orbitron',monospace",fontWeight:700,color:"#FFD700"}}>CONTINUER ›</button>
      </div>
    </div>
  );
}

// ── ONBOARDING ────────────────────────────────────────────
function Onboarding({ onComplete }) {
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [input, setInput] = useState("");
  const STEPS = [
    { title:"LE SYSTÈME T'A DÉTECTÉ", body:"Une anomalie dimensionnelle a été localisée.\n\nTu as été sélectionné parmi des millions.\n\nIl est temps de t'éveiller.", btn:"Je suis prêt", icon:"🚪" },
    { title:"IDENTIFICATION REQUISE", body:"Le Système doit enregistrer ton identité.", btn:null, icon:"📋", isName:true },
    { title:`BIENVENUE, ${name||"CHASSEUR"}`, body:`Tu débutes au Rang E.\n\nChaque quête complétée forge ta discipline.\nChaque boss vaincu te rapproche de ta meilleure version.\n\nLe Système t'observe.`, btn:"ARISE", icon:"⚔️" },
  ];
  const s = STEPS[step];
  return (
    <div style={{position:"fixed",inset:0,zIndex:9999,background:"#020B18",display:"flex",alignItems:"center",justifyContent:"center"}}>
      <MangaHero color="#A855F7" rank="E" questsDoneToday={0} totalQuests={1}/>
      <div style={{position:"relative",zIndex:10,maxWidth:310,width:"90%",textAlign:"center",animation:"onboardIn 0.6s ease"}}>
        <div style={{height:1,background:"linear-gradient(90deg,transparent,#A855F7,transparent)",marginBottom:26}}/>
        <div style={{fontSize:51,marginBottom:14,filter:"drop-shadow(0 0 20px #A855F7)"}}>{s.icon}</div>
        <div style={{fontSize:8,color:"#3A3A5A",fontFamily:"'Orbitron',monospace",letterSpacing:"0.4em",marginBottom:10}}>[ SYSTÈME ]</div>
        <div style={{fontSize:14,fontFamily:"'Orbitron',monospace",fontWeight:700,color:"#A855F7",marginBottom:14,lineHeight:1.4}}>{s.title}</div>
        <div style={{fontSize:12,color:"#8BADD4",fontFamily:"'Rajdhani',sans-serif",lineHeight:1.85,whiteSpace:"pre-line",marginBottom:22}}>{s.body}</div>
        {s.isName&&(
          <div style={{marginBottom:18}}>
            <input value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&input.trim()){setName(input.trim());setStep(2);}}} placeholder="Ton nom de chasseur..." autoFocus
              style={{width:"100%",background:"rgba(168,85,247,0.06)",border:"1px solid rgba(168,85,247,0.4)",borderRadius:12,padding:"12px 16px",color:"#D0EAFF",fontFamily:"'Orbitron',monospace",fontSize:14,fontWeight:700,textAlign:"center",marginBottom:10}}/>
            <button onClick={()=>{if(input.trim()){setName(input.trim());setStep(2);}}} style={{width:"100%",padding:"12px",background:"rgba(168,85,247,0.14)",border:"1px solid #A855F7",borderRadius:12,cursor:"pointer",fontSize:12,fontFamily:"'Orbitron',monospace",fontWeight:700,color:"#A855F7",letterSpacing:"0.1em"}}>CONFIRMER ›</button>
          </div>
        )}
        {s.btn&&<button onClick={()=>{if(step===2)onComplete(name);else setStep(p=>p+1);}} style={{width:"100%",padding:"14px",background:step===2?"linear-gradient(135deg,#A855F7,#7C3AED)":"rgba(168,85,247,0.12)",border:"1px solid #A855F7",borderRadius:12,cursor:"pointer",fontSize:14,fontFamily:"'Orbitron',monospace",fontWeight:900,color:step===2?"#fff":"#A855F7",letterSpacing:"0.12em"}}>{s.btn}</button>}
        <div style={{height:1,background:"linear-gradient(90deg,transparent,#A855F7,transparent)",marginTop:26}}/>
        <div style={{display:"flex",justifyContent:"center",gap:6,marginTop:12}}>
          {[0,1,2].map(i=><div key={i} style={{width:i===step?16:4,height:4,borderRadius:2,background:i===step?"#A855F7":"#1A1A2A",transition:"all 0.3s"}}/>)}
        </div>
      </div>
    </div>
  );
}

// ── DUNGEON ENTRY ─────────────────────────────────────────
function DungeonEntry({ boss, rankData, onEnter }) {
  const [phase, setPhase] = useState(0);
  const c = rankData.color;
  useEffect(()=>{
    const t=[600,1500,2700].map((ms,i)=>setTimeout(()=>setPhase(i+1),ms));
    return ()=>t.forEach(clearTimeout);
  },[]);
  const lines = [
    `[ SYSTÈME ] PORTE DE RANG ${rankData.rank} DÉTECTÉE`,
    `BOSS IDENTIFIÉ : ${boss.name.toUpperCase()} — ${boss.title.toUpperCase()}`,
    `POINTS DE VIE : ${boss.maxHp} / ${boss.maxHp}`,
    `▶ ACCÈS AUTORISÉ — ENTRÉE DU CHASSEUR`,
  ];
  return (
    <div style={{position:"fixed",inset:0,zIndex:9800,background:"#020B18",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center"}}>
      <div style={{position:"absolute",inset:0,backgroundImage:"repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(168,85,247,0.03) 2px,rgba(168,85,247,0.03) 4px)",pointerEvents:"none"}}/>
      <div style={{position:"relative",marginBottom:28}}>
        <div style={{width:110,height:150,borderRadius:55,border:`2px solid ${c}`,background:`radial-gradient(ellipse,${c}22 0%,transparent 70%)`,display:"flex",alignItems:"center",justifyContent:"center",animation:"auraB 1.5s ease-in-out infinite",boxShadow:`0 0 40px ${c}55,inset 0 0 30px ${c}18`}}>
          {phase>=2&&<BossSVG bossId={boss.id} color={c} size={75}/>}
        </div>
      </div>
      <div style={{maxWidth:320,width:"90%",fontFamily:"'Orbitron',monospace",display:"flex",flexDirection:"column",gap:7}}>
        {lines.map((line,i)=>(
          <div key={i} style={{fontSize:10,color:i===3?c:"#555",letterSpacing:"0.07em",padding:"6px 10px",border:`1px solid ${i===3?c+"44":"rgba(56,139,255,0.15)"}`,borderRadius:4,background:i===3?`${c}08`:"rgba(0,0,0,0.5)",opacity:phase>i?1:0,transition:"opacity 0.4s",lineHeight:1.5}}>
            {line}
          </div>
        ))}
      </div>
      {phase>=3&&(
        <button onClick={onEnter} style={{marginTop:26,padding:"13px 36px",background:`${c}18`,border:`1px solid ${c}`,borderRadius:12,cursor:"pointer",fontSize:13,fontFamily:"'Orbitron',monospace",fontWeight:700,color:c,letterSpacing:"0.14em",boxShadow:`0 0 20px ${c}44`,animation:"slideUp 0.4s ease"}}>
          ENTRER DANS LE DONJON ›
        </button>
      )}
    </div>
  );
}

// ── QUEST MANAGER ─────────────────────────────────────────
const EMOJIS_LIST=["🛏️","🦷","💪","🧠","📖","📱","💻","♟️","🎸","🌙","🏃","🧘","💧","📝","🎯","🎨","🔧","📚","🏋️","🚿","☕","🎵","🏊","🚴","❤️","⭐","🔥","🌿","🧊","📵","🌅","🌊","⚔️","🛡️","🎤","🎲","🔬","🥊","🥗","✍️","🔤","📰","🚀","🏆","💤","🎪"];
const COLORS_LIST=["#00F5FF","#FF3864","#FFD700","#39FF14","#A855F7","#FF8C00","#FF69B4","#60A5FA","#34D399","#F87171","#8B5CF6","#FBBF24","#EF4444","#6EE7B7"];

function QuestForm({quest,onSave,onCancel}) {
  const isNew=!quest?.id;
  const [f,setF]=useState({emoji:quest?.emoji||"⭐",name:quest?.name||"",atkName:quest?.atkName||"",color:quest?.color||"#A855F7",section:quest?.section||"AUBE",duration:quest?.duration||15,time:quest?.time||"08:00"});
  const [emojiOpen,setEmojiOpen]=useState(false);
  const [err,setErr]=useState("");
  const autoRank=getDurationRank(f.duration);
  const rc=RANKS.find(r=>r.rank===autoRank)||RANKS[0];
  const save=()=>{if(!f.name.trim()){setErr("Nomme ta quête !");return;}onSave({...f,duration:+f.duration,xp:RANK_XP[autoRank],dmg:RANK_DMG[autoRank],rank:autoRank,cooldown:Math.max(0,(f.duration/3)|0),id:quest?.id||newId()});};
  return (
    <div style={{background:"rgba(5,0,10,0.98)",border:"1px solid rgba(168,85,247,0.15)",borderRadius:13,overflow:"hidden"}}>
      <div style={{display:"flex",alignItems:"center",gap:8,padding:"9px 11px",borderBottom:"1px solid rgba(56,139,255,0.15)",background:`${f.color}08`}}>
        <div onClick={()=>setEmojiOpen(p=>!p)} style={{fontSize:24,cursor:"pointer",padding:"3px 5px",background:"rgba(56,139,255,0.15)",borderRadius:7}}>{f.emoji}</div>
        <div style={{flex:1}}>
          <div style={{fontSize:13,fontFamily:"'Rajdhani',sans-serif",fontWeight:700,color:f.color||"#888"}}>{f.name||"..."}</div>
          <div style={{fontSize:8,color:"#8BADD4",fontFamily:"monospace"}}>Rang {autoRank} · +{RANK_XP[autoRank]}XP · CD:{Math.max(0,(f.duration/3)|0)}s</div>
        </div>
        <button onClick={onCancel} style={{background:"none",border:"none",cursor:"pointer",color:"#8BADD4",fontSize:17}}>✕</button>
      </div>
      {emojiOpen&&<div style={{padding:"7px",borderBottom:"1px solid rgba(56,139,255,0.15)",background:"rgba(0,0,0,0.6)"}}>
        <div style={{display:"flex",flexWrap:"wrap",gap:3,maxHeight:90,overflowY:"auto"}}>
          {EMOJIS_LIST.map(em=><div key={em} onClick={()=>{setF(p=>({...p,emoji:em}));setEmojiOpen(false);}} style={{fontSize:19,cursor:"pointer",padding:4,borderRadius:5,background:f.emoji===em?"rgba(168,85,247,0.25)":"transparent"}}>{em}</div>)}
        </div>
      </div>}
      <div style={{padding:"9px 11px",display:"flex",flexDirection:"column",gap:8}}>
        <div><div style={{fontSize:8,color:"#8BADD4",fontFamily:"'Orbitron',monospace",letterSpacing:"0.1em",marginBottom:3}}>NOM</div>
          <input value={f.name} onChange={e=>setF(p=>({...p,name:e.target.value}))} placeholder="Ex: Pompes matinales..." style={{width:"100%",background:"rgba(10,20,50,0.5)",border:"1px solid rgba(168,85,247,0.18)",borderRadius:8,padding:"8px 10px",color:"#D0EAFF",fontFamily:"'Rajdhani',sans-serif",fontSize:14}}/></div>
        <div><div style={{fontSize:8,color:"#8BADD4",fontFamily:"'Orbitron',monospace",letterSpacing:"0.1em",marginBottom:3}}>NOM D'ATTAQUE</div>
          <input value={f.atkName} onChange={e=>setF(p=>({...p,atkName:e.target.value}))} placeholder="Ex: Frappe Titanesque" style={{width:"100%",background:"rgba(10,20,50,0.5)",border:"1px solid rgba(168,85,247,0.12)",borderRadius:8,padding:"7px 10px",color:"#D0EAFF",fontFamily:"'Rajdhani',sans-serif",fontSize:13}}/></div>
        <div>
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}>
            <div style={{fontSize:8,color:"#8BADD4",fontFamily:"'Orbitron',monospace",letterSpacing:"0.1em"}}>DURÉE → RANG AUTO</div>
            <div style={{fontSize:10,fontFamily:"'Orbitron',monospace",fontWeight:700,color:rc.color}}>{f.duration}min · Rang {autoRank}</div>
          </div>
          <input type="range" min="5" max="150" step="5" value={f.duration} onChange={e=>setF(p=>({...p,duration:+e.target.value}))} style={{width:"100%",cursor:"pointer"}}/>
          <div style={{fontSize:8,color:"#8BADD4",fontFamily:"monospace",marginTop:2}}>{RANK_LABELS[autoRank]}</div>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"3fr 2fr",gap:7}}>
          <div><div style={{fontSize:8,color:"#8BADD4",fontFamily:"'Orbitron',monospace",letterSpacing:"0.1em",marginBottom:3}}>SECTION</div>
            <div style={{display:"flex",gap:2}}>{["AUBE","JOUR","MIDI","SOIR"].map(s=><div key={s} onClick={()=>setF(p=>({...p,section:s}))} style={{flex:1,textAlign:"center",padding:"5px 1px",borderRadius:5,background:f.section===s?"rgba(168,85,247,0.15)":"rgba(10,20,50,0.6)",border:`1px solid ${f.section===s?"#A855F744":"rgba(56,139,255,0.18)"}`,cursor:"pointer",fontSize:8,color:f.section===s?"#A855F7":"#222",fontFamily:"'Orbitron',monospace"}}>{s}</div>)}</div>
          </div>
          <div><div style={{fontSize:8,color:"#8BADD4",fontFamily:"'Orbitron',monospace",letterSpacing:"0.1em",marginBottom:3}}>HEURE</div>
            <input type="time" value={f.time} onChange={e=>setF(p=>({...p,time:e.target.value}))} style={{width:"100%",background:"rgba(10,20,50,0.5)",border:"1px solid rgba(168,85,247,0.12)",borderRadius:8,padding:"7px",color:"#D0EAFF",fontFamily:"'Rajdhani',sans-serif",fontSize:13}}/></div>
        </div>
        <div><div style={{fontSize:8,color:"#8BADD4",fontFamily:"'Orbitron',monospace",letterSpacing:"0.1em",marginBottom:4}}>COULEUR</div>
          <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>{COLORS_LIST.map(c=><div key={c} onClick={()=>setF(p=>({...p,color:c}))} style={{width:21,height:21,borderRadius:6,background:c,cursor:"pointer",border:`2px solid ${f.color===c?"#fff":"transparent"}`,boxShadow:f.color===c?`0 0 8px ${c}`:"none"}}/>)}</div>
        </div>
        {err&&<div style={{fontSize:11,color:"#EF4444",textAlign:"center"}}>{err}</div>}
        <button onClick={save} style={{padding:"10px",background:"rgba(168,85,247,0.18)",border:"1px solid #A855F7",borderRadius:10,cursor:"pointer",fontSize:11,fontFamily:"'Orbitron',monospace",fontWeight:700,color:"#A855F7",letterSpacing:"0.1em"}}>{isNew?"✦ CRÉER":"✦ SAUVEGARDER"}</button>
      </div>
    </div>
  );
}

function QuestManager({quests,onSave,onDelete,onBack}) {
  const [editing,setEditing]=useState(null);
  const [activeTab,setActiveTab]=useState("list");
  const [libCat,setLibCat]=useState(Object.keys(QUEST_LIBRARY)[0]);
  const SC={AUBE:"#00F5FF",JOUR:"#FF8C00",MIDI:"#A855F7",SOIR:"#FF3864"};
  const addLib=t=>{const r=getDurationRank(t.duration);onSave({...t,id:newId(),xp:RANK_XP[r],dmg:RANK_DMG[r],rank:r,cooldown:Math.max(0,(t.duration/3)|0)});};
  return (
    <div style={{position:"fixed",inset:0,zIndex:8000,background:"rgba(0,0,0,0.97)",backdropFilter:"blur(6px)",display:"flex",flexDirection:"column"}}>
      <div style={{display:"flex",alignItems:"center",gap:10,padding:"13px 14px",borderBottom:"1px solid rgba(168,85,247,0.1)",flexShrink:0,background:"rgba(0,0,0,0.8)"}}>
        <button onClick={onBack} style={{background:"rgba(56,139,255,0.15)",border:"1px solid rgba(56,139,255,0.25)",borderRadius:8,padding:"6px 10px",cursor:"pointer",fontSize:12,color:"#8BADD4",fontFamily:"'Orbitron',monospace"}}>← RET.</button>
        <div>
          <div style={{fontSize:8,color:"#8BADD4",fontFamily:"'Orbitron',monospace",letterSpacing:"0.2em"}}>GESTION</div>
          <div style={{fontSize:14,fontFamily:"'Orbitron',monospace",fontWeight:700,color:"#A855F7"}}>MES QUÊTES</div>
        </div>
        {activeTab==="list"&&<button onClick={()=>setEditing({})} style={{marginLeft:"auto",padding:"6px 11px",background:"rgba(168,85,247,0.1)",border:"1px solid rgba(168,85,247,0.3)",borderRadius:8,cursor:"pointer",fontSize:10,fontFamily:"'Orbitron',monospace",color:"#A855F7",fontWeight:700}}>+ NOUVELLE</button>}
      </div>
      <div style={{display:"flex",borderBottom:"1px solid rgba(56,139,255,0.15)",flexShrink:0}}>
        {[{id:"list",label:"MES QUÊTES"},{id:"library",label:"📚 BIBLIOTHÈQUE"}].map(t=>(
          <button key={t.id} onClick={()=>setActiveTab(t.id)} style={{flex:1,padding:"8px",background:"none",border:"none",cursor:"pointer",fontSize:10,fontFamily:"'Orbitron',monospace",color:activeTab===t.id?"#A855F7":"#222",borderBottom:activeTab===t.id?"2px solid #A855F7":"2px solid transparent"}}>
            {t.label}
          </button>
        ))}
      </div>
      <div style={{flex:1,overflowY:"auto",padding:"10px"}}>
        {activeTab==="list"&&(
          <>
            {editing!==null&&<div style={{marginBottom:11,animation:"slideUp 0.22s ease"}}><QuestForm quest={editing} onSave={f=>{onSave(f);setEditing(null);}} onCancel={()=>setEditing(null)}/></div>}
            {["AUBE","JOUR","MIDI","SOIR"].map(sec=>{
              const sq=quests.filter(q=>q.section===sec);if(!sq.length)return null;
              const sc=SC[sec]||"#9CA3AF";
              return (
                <div key={sec} style={{marginBottom:12}}>
                  <div style={{display:"flex",alignItems:"center",gap:4,marginBottom:5}}>
                    <div style={{width:2,height:10,background:sc,borderRadius:1}}/>
                    <span style={{fontSize:8,fontFamily:"'Orbitron',monospace",color:sc,letterSpacing:"0.1em"}}>{sec}</span>
                    <span style={{fontSize:8,color:"#111",fontFamily:"monospace",marginLeft:"auto"}}>{sq.length}</span>
                  </div>
                  {sq.map(q=>{
                    const rc2=RANKS.find(r=>r.rank===q.rank)||RANKS[0];
                    const isEd=editing?.id===q.id;
                    return (
                      <div key={q.id} style={{marginBottom:5}}>
                        {isEd?<div style={{animation:"slideUp 0.2s ease"}}><QuestForm quest={q} onSave={f=>{onSave(f);setEditing(null);}} onCancel={()=>setEditing(null)}/></div>:(
                          <div style={{display:"flex",alignItems:"center",gap:8,background:"rgba(0,0,0,0.65)",border:`1px solid ${q.color}18`,borderRadius:10,padding:"7px 9px"}}>
                            <span style={{fontSize:18,flexShrink:0}}>{q.emoji}</span>
                            <div style={{flex:1,minWidth:0}}>
                              <div style={{fontSize:12,fontFamily:"'Rajdhani',sans-serif",fontWeight:600,color:"#B0B8D0",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{q.name}</div>
                              <div style={{display:"flex",gap:3,marginTop:1}}>
                                <span style={{fontSize:7,color:rc2.color,fontFamily:"'Orbitron',monospace",border:`1px solid ${rc2.color}33`,borderRadius:2,padding:"0 2px"}}>{q.rank}</span>
                                <span style={{fontSize:8,color:"#111",fontFamily:"monospace"}}>{q.duration}min · +{q.xp}XP</span>
                              </div>
                            </div>
                            <div style={{display:"flex",gap:4,flexShrink:0}}>
                              <button onClick={()=>setEditing(isEd?null:q)} style={{background:"rgba(168,85,247,0.08)",border:"1px solid rgba(168,85,247,0.18)",borderRadius:6,padding:"4px 7px",cursor:"pointer",fontSize:12,color:"#A855F7"}}>✏️</button>
                              <button onClick={()=>onDelete(q.id)} style={{background:"rgba(239,68,68,0.08)",border:"1px solid rgba(239,68,68,0.18)",borderRadius:6,padding:"4px 7px",cursor:"pointer",fontSize:12,color:"#EF4444"}}>🗑️</button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </>
        )}
        {activeTab==="library"&&(
          <div>
            <div style={{fontSize:10,color:"#A855F7",fontFamily:"'Orbitron',monospace",letterSpacing:"0.15em",marginBottom:3}}>BIBLIOTHÈQUE DU SYSTÈME</div>
            <div style={{fontSize:11,color:"#2A2A3A",fontFamily:"'Rajdhani',sans-serif",marginBottom:11}}>Ajoute des quêtes prédéfinies en 1 tap.</div>
            <div style={{display:"flex",gap:4,marginBottom:11,overflowX:"auto",paddingBottom:4}}>
              {Object.keys(QUEST_LIBRARY).map(cat=>(
                <button key={cat} onClick={()=>setLibCat(cat)} style={{padding:"5px 10px",background:libCat===cat?"rgba(168,85,247,0.15)":"rgba(10,20,50,0.6)",border:`1px solid ${libCat===cat?"rgba(168,85,247,0.4)":"rgba(56,139,255,0.18)"}`,borderRadius:8,cursor:"pointer",fontSize:9,fontFamily:"'Orbitron',monospace",color:libCat===cat?"#A855F7":"#333",whiteSpace:"nowrap",flexShrink:0}}>
                  {cat}
                </button>
              ))}
            </div>
            {QUEST_LIBRARY[libCat].map((t,i)=>{
              const r=getDurationRank(t.duration);const rc2=RANKS.find(rv=>rv.rank===r)||RANKS[0];
              const has=quests.some(q=>q.name===t.name);
              return (
                <div key={i} style={{display:"flex",alignItems:"center",gap:8,background:"rgba(0,0,0,0.6)",border:`1px solid ${has?"rgba(57,255,20,0.12)":t.color+"15"}`,borderRadius:10,padding:"7px 9px",marginBottom:5,opacity:has?0.5:1}}>
                  <span style={{fontSize:18,flexShrink:0}}>{t.emoji}</span>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:12,fontFamily:"'Rajdhani',sans-serif",fontWeight:600,color:"#B0B8D0"}}>{t.name}</div>
                    <div style={{display:"flex",gap:3,marginTop:1}}>
                      <span style={{fontSize:7,color:rc2.color,fontFamily:"'Orbitron',monospace",border:`1px solid ${rc2.color}33`,borderRadius:2,padding:"0 2px"}}>{r}</span>
                      <span style={{fontSize:8,color:"#8BADD4",fontFamily:"monospace"}}>{t.duration}min · +{RANK_XP[r]}XP · {t.section}</span>
                    </div>
                  </div>
                  <button onClick={()=>!has&&addLib(t)} style={{padding:"4px 9px",background:has?"rgba(57,255,20,0.08)":"rgba(168,85,247,0.1)",border:`1px solid ${has?"rgba(57,255,20,0.25)":"rgba(168,85,247,0.25)"}`,borderRadius:7,cursor:has?"default":"pointer",fontSize:10,fontFamily:"'Orbitron',monospace",fontWeight:700,color:has?"#39FF14":"#A855F7",flexShrink:0}}>
                    {has?"✓":"AJOUTER"}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ── HEADER ────────────────────────────────────────────────
// ── AMBIENT PARTICLES ────────────────────────────────────
function AmbientParticles({rank,color}) {
  const ri={E:0,D:1,C:2,B:3,A:4,S:5}[rank]||0;
  const count=[2,3,5,7,10,14][ri];
  const particles=useRef(Array.from({length:count},(_,i)=>({
    id:i,
    x:Math.random()*100,
    y:20+Math.random()*70,
    size:ri>=4?4:ri>=2?3:2,
    dur:4+Math.random()*6,
    delay:Math.random()*5,
    px:(Math.random()-0.5)*60,
    py:-(30+Math.random()*80),
    opacity:0.08+ri*0.04,
  }))).current;
  if(ri===0) return null;
  return (
    <div style={{position:"absolute",inset:0,pointerEvents:"none",zIndex:1,overflow:"hidden"}}>
      {particles.map(p=>(
        <div key={p.id} style={{
          position:"absolute",left:`${p.x}%`,top:`${p.y}%`,
          width:p.size,height:p.size,borderRadius:"50%",
          background:ri>=4?color:ri>=2?`${color}88`:`${color}55`,
          boxShadow:ri>=3?`0 0 ${p.size*2}px ${color}`:"none",
          animation:`particleDrift ${p.dur}s ${p.delay}s ease-in infinite`,
          "--py":`${p.py}px`,"--px":`${p.px}px`,"--po":p.opacity,
        }}/>
      ))}
    </div>
  );
}

// ── HERO HEADER v7 ────────────────────────────────────────
function HeroHeader({totalXp,xpToday,maxXpDay,done,total,streak,rankData,name,activeTitle}) {
  const nextRank=RANKS[RANKS.findIndex(r=>r.rank===rankData.rank)+1];
  const xpInRank=totalXp-rankData.min;
  const xpForNext=nextRank?nextRank.min-rankData.min:1;
  const xpPct=Math.min(1,xpInRank/xpForNext);
  const dayPct=Math.min(1,xpToday/Math.max(maxXpDay,1));
  const c=rankData.color;
  return (
    <div style={{padding:"10px 14px 10px",background:`linear-gradient(180deg,${c}0C 0%,rgba(0,0,0,0.7) 100%)`,borderBottom:`1px solid ${c}18`,position:"relative",zIndex:10}}>
      <div style={{display:"flex",gap:11,alignItems:"center"}}>
        {/* Rank badge */}
        <div style={{flexShrink:0,width:52,height:52,borderRadius:14,background:`linear-gradient(135deg,${c}22,${c}0A)`,border:`2px solid ${c}66`,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",boxShadow:`0 0 20px ${c}44,inset 0 1px 0 ${c}33`,position:"relative"}}>
          <div style={{fontSize:7,color:`${c}99`,fontFamily:"'Orbitron',monospace",fontWeight:700,letterSpacing:"0.1em"}}>RANG</div>
          <div style={{fontSize:23,fontFamily:"'Orbitron',monospace",fontWeight:900,color:c,textShadow:`0 0 12px ${c}`,lineHeight:1}}>{rankData.rank}</div>
          {/* Pulse ring on S rank */}
          {rankData.rank==="S"&&<div style={{position:"absolute",inset:-4,borderRadius:18,border:`1px solid ${c}44`,animation:"pulseRing 2s ease-out infinite"}}/>}
        </div>
        {/* Center info */}
        <div style={{flex:1,minWidth:0}}>
          <div style={{display:"flex",alignItems:"baseline",gap:6,marginBottom:1}}>
            <div style={{fontSize:15,fontFamily:"'Orbitron',monospace",fontWeight:900,color:c,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",textShadow:`0 0 8px ${c}55`}}>{name||"CHASSEUR"}</div>
            {activeTitle&&<div style={{fontSize:8,color:"#FFD70066",fontFamily:"monospace",fontStyle:"italic",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>✦ {activeTitle.name}</div>}
          </div>
          {/* Big XP rank bar */}
          <div style={{position:"relative",height:7,background:"rgba(56,139,255,0.15)",borderRadius:4,overflow:"hidden",marginBottom:3,boxShadow:`inset 0 1px 0 rgba(0,0,0,0.4)`}}>
            <div style={{position:"absolute",inset:0,width:`${xpPct*100}%`,background:`linear-gradient(90deg,${c}88,${c})`,borderRadius:4,transition:"width 1s cubic-bezier(.23,1.4,.42,1)",boxShadow:`0 0 8px ${c}`,animation:xpPct>0?"xpBarFill 0.6s ease":"none"}}/>
          </div>
          <div style={{display:"flex",justifyContent:"space-between"}}>
            <span style={{fontSize:7,color:`${c}66`,fontFamily:"monospace"}}>{xpInRank.toLocaleString()} / {xpForNext.toLocaleString()} XP</span>
            {nextRank&&<span style={{fontSize:7,color:"#8BADD4",fontFamily:"monospace"}}>→ {nextRank.rank} dans {(nextRank.min-totalXp).toLocaleString()} XP</span>}
          </div>
        </div>
        {/* Streak */}
        <div style={{flexShrink:0,display:"flex",flexDirection:"column",alignItems:"center",gap:3}}>
          <div style={{position:"relative",width:42,height:42}}>
            <svg width={42} height={42} style={{position:"absolute",inset:0}}>
              <circle cx={21} cy={21} r={17} fill="none" stroke={`${c}18`} strokeWidth={3}/>
              <circle cx={21} cy={21} r={17} fill="none" stroke={c} strokeWidth={3}
                strokeDasharray={`${2*Math.PI*17}`}
                strokeDashoffset={`${2*Math.PI*17*(1-dayPct)}`}
                strokeLinecap="round" transform="rotate(-90 21 21)"
                style={{transition:"stroke-dashoffset 1s cubic-bezier(.23,1.4,.42,1)",filter:`drop-shadow(0 0 4px ${c})`}}/>
            </svg>
            <div style={{position:"absolute",inset:0,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center"}}>
              <span style={{fontSize:10,fontWeight:900,color:c,fontFamily:"'Orbitron',monospace",lineHeight:1}}>{xpToday}</span>
              <span style={{fontSize:6,color:"#8BADD4",fontFamily:"monospace"}}>XP</span>
            </div>
          </div>
          <div style={{background:streak>0?"rgba(239,68,68,0.1)":"rgba(0,0,0,0.4)",border:`1px solid ${streak>0?"rgba(239,68,68,0.25)":"rgba(56,139,255,0.15)"}`,borderRadius:8,padding:"2px 6px",textAlign:"center",minWidth:32}}>
            <div style={{animation:streak>0?"fireFlick 1s ease-in-out infinite":"none"}}>
              <SLIcon.flame size={18} color={streak>0?"#EF4444":"#1A1A2A"}/>
            </div>
            <div style={{fontSize:9,fontWeight:900,color:streak>0?"#EF4444":"#111",fontFamily:"'Orbitron',monospace",lineHeight:1}}>{streak}</div>
          </div>
        </div>
      </div>
      {/* Quest progress dots — redesigned */}
      {total>0&&(
        <div style={{marginTop:8,display:"flex",gap:2,alignItems:"center"}}>
          <div style={{flex:1,height:3,background:"rgba(56,139,255,0.15)",borderRadius:2,overflow:"hidden",position:"relative"}}>
            <div style={{position:"absolute",left:0,top:0,height:"100%",width:`${(done/total)*100}%`,background:`linear-gradient(90deg,${c}66,${c})`,borderRadius:2,transition:"width 0.5s ease",boxShadow:done===total?`0 0 6px ${c}`:"none"}}/>
          </div>
          <span style={{fontSize:8,color:done===total?"#39FF14":c,fontFamily:"'Orbitron',monospace",fontWeight:700,flexShrink:0,marginLeft:4}}>{done}/{total}</span>
          {done===total&&<span style={{fontSize:8,color:"#39FF14",fontFamily:"monospace",flexShrink:0}}>✦</span>}
        </div>
      )}
    </div>
  );
}


// ── TITLES TAB ────────────────────────────────────────────
function TitlesTab({state,totalXp,streak,onActivate,activeTitle}) {
  const unlocked=TITLES.filter(t=>t.cond(state,totalXp,streak));
  const locked=TITLES.filter(t=>!t.cond(state,totalXp,streak));
  return (
    <div style={{padding:"13px 12px 80px"}}>
      <div style={{fontSize:9,color:"#A855F7",fontFamily:"'Orbitron',monospace",letterSpacing:"0.2em",marginBottom:3}}>TITRES DU CHASSEUR</div>
      <div style={{fontSize:10,color:"#1A1A2A",fontFamily:"'Rajdhani',sans-serif",marginBottom:12}}>Débloque des titres et équipe-en un.</div>
      {unlocked.length===0&&<div style={{textAlign:"center",padding:"18px",color:"#111",fontSize:11,fontFamily:"'Rajdhani',sans-serif"}}>Aucun titre débloqué. Continue.</div>}
      {unlocked.map(t=>(
        <div key={t.id} style={{display:"flex",alignItems:"center",gap:11,background:activeTitle?.id===t.id?"rgba(255,215,0,0.06)":"rgba(0,0,0,0.65)",border:`1px solid ${activeTitle?.id===t.id?"rgba(255,215,0,0.28)":"rgba(255,215,0,0.1)"}`,borderRadius:13,padding:"10px 12px",marginBottom:7,backdropFilter:"blur(6px)"}}>
          <div style={{fontSize:29,flexShrink:0,filter:"drop-shadow(0 0 8px #FFD700)"}}>{t.emoji}</div>
          <div style={{flex:1}}>
            <div style={{fontSize:12,fontFamily:"'Rajdhani',sans-serif",fontWeight:700,color:"#FFD700"}}>{t.name}</div>
            <div style={{fontSize:8,color:"#8BADD4",fontFamily:"monospace"}}>{t.desc}</div>
          </div>
          <button onClick={()=>onActivate(activeTitle?.id===t.id?null:t)} style={{padding:"5px 9px",background:activeTitle?.id===t.id?"rgba(255,215,0,0.15)":"rgba(10,20,50,0.5)",border:`1px solid ${activeTitle?.id===t.id?"#FFD70066":"rgba(56,139,255,0.22)"}`,borderRadius:7,cursor:"pointer",fontSize:9,color:activeTitle?.id===t.id?"#FFD700":"#222",fontFamily:"'Orbitron',monospace",fontWeight:700}}>
            {activeTitle?.id===t.id?"ÉQUIPÉ":"ÉQUIPER"}
          </button>
        </div>
      ))}
      {locked.length>0&&(
        <>
          <div style={{fontSize:7,color:"#111",fontFamily:"'Orbitron',monospace",letterSpacing:"0.12em",margin:"12px 0 7px"}}>À DÉBLOQUER</div>
          {locked.map(t=>(
            <div key={t.id} style={{display:"flex",alignItems:"center",gap:11,background:"rgba(0,0,0,0.4)",border:"1px solid rgba(10,20,50,0.5)",borderRadius:13,padding:"9px 12px",marginBottom:5,opacity:0.35}}>
              <div style={{fontSize:25,flexShrink:0,filter:"grayscale(1)"}}>🔒</div>
              <div style={{flex:1}}>
                <div style={{fontSize:12,fontFamily:"'Rajdhani',sans-serif",fontWeight:700,color:"#1A1A2A"}}>{t.name}</div>
                <div style={{fontSize:8,color:"#111",fontFamily:"monospace"}}>{t.desc}</div>
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  );
}

// ── COUNTDOWN TO MIDNIGHT ─────────────────────────────────
function Countdown() {
  const [secs, setSecs] = useState(0);
  useEffect(()=>{
    const update=()=>{
      const now=new Date(), midnight=new Date();
      midnight.setHours(24,0,0,0);
      setSecs(Math.max(0,Math.floor((midnight-now)/1000)));
    };
    update();
    const t=setInterval(update,1000);
    return()=>clearInterval(t);
  },[]);
  const h=Math.floor(secs/3600);
  const m=Math.floor((secs%3600)/60);
  const s=secs%60;
  const urgent=secs<7200; // < 2h
  const critical=secs<3600; // < 1h
  const color=critical?"#EF4444":urgent?"#F59E0B":"#1A1A2A";
  const fmt=n=>String(n).padStart(2,"0");
  return (
    <div style={{display:"flex",alignItems:"center",gap:5,padding:"3px 8px",background:critical?"rgba(239,68,68,0.08)":urgent?"rgba(245,158,11,0.06)":"transparent",border:`1px solid ${critical?"rgba(239,68,68,0.25)":urgent?"rgba(245,158,11,0.2)":"rgba(56,139,255,0.15)"}`,borderRadius:8,animation:urgent?"countdownUrgent 1.5s ease-in-out infinite":"none"}}>
      <span style={{fontSize:10,animation:critical?"fireFlick 0.8s ease-in-out infinite":"none"}}>{critical?"🔥":urgent?"⏳":"🕐"}</span>
      <span style={{fontSize:10,fontFamily:"'Orbitron',monospace",fontWeight:700,color,letterSpacing:"0.05em"}}>{fmt(h)}:{fmt(m)}:{fmt(s)}</span>
    </div>
  );
}

// ── PENALTY SCREEN ────────────────────────────────────────
function PenaltyScreen({ missed, goldLost, streakLost, bossRegen, onClose }) {
  return (
    <div style={{position:"fixed",inset:0,zIndex:9600,background:"rgba(0,0,0,0.97)",display:"flex",alignItems:"center",justifyContent:"center",animation:"penaltyIn 0.5s ease"}}>
      <div style={{position:"absolute",inset:0,backgroundImage:"repeating-linear-gradient(0deg,transparent,transparent 3px,rgba(239,68,68,0.03) 3px,rgba(239,68,68,0.03) 6px)",pointerEvents:"none"}}/>
      <div style={{textAlign:"center",maxWidth:300,width:"90%",animation:"penaltyShake 0.6s ease"}}>
        <div style={{fontSize:8,color:"#EF444488",fontFamily:"'Orbitron',monospace",letterSpacing:"0.4em",marginBottom:16}}>[ SYSTÈME ] AVERTISSEMENT</div>
        <div style={{fontSize:57,marginBottom:12,filter:"drop-shadow(0 0 20px #EF4444)"}}>💀</div>
        <div style={{fontSize:16,fontFamily:"'Orbitron',monospace",fontWeight:900,color:"#EF4444",marginBottom:6,lineHeight:1.3}}>MISSION ÉCHOUÉE</div>
        <div style={{fontSize:11,color:"#7BA7CC",fontFamily:"'Rajdhani',sans-serif",lineHeight:1.8,marginBottom:20}}>
          Tu n'as pas complété tes quêtes hier.<br/>Le Système t'a puni.
        </div>
        <div style={{background:"rgba(239,68,68,0.05)",border:"1px solid rgba(239,68,68,0.2)",borderRadius:14,padding:"14px",marginBottom:18,display:"flex",flexDirection:"column",gap:8}}>
          {goldLost>0&&<div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <span style={{fontSize:11,color:"#A0C0E0",fontFamily:"'Rajdhani',sans-serif"}}>Gold perdu</span>
            <span style={{fontSize:14,fontFamily:"'Orbitron',monospace",fontWeight:700,color:"#EF4444"}}>-{goldLost} 💰</span>
          </div>}
          {streakLost&&<div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <span style={{fontSize:11,color:"#A0C0E0",fontFamily:"'Rajdhani',sans-serif"}}>Streak brisé</span>
            <span style={{fontSize:14,fontFamily:"'Orbitron',monospace",fontWeight:700,color:"#EF4444"}}>🔥 → 0</span>
          </div>}
          {bossRegen>0&&<div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <span style={{fontSize:11,color:"#A0C0E0",fontFamily:"'Rajdhani',sans-serif"}}>Boss régénéré</span>
            <span style={{fontSize:14,fontFamily:"'Orbitron',monospace",fontWeight:700,color:"#EF4444"}}>+{bossRegen} PV</span>
          </div>}
          {missed>0&&<div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <span style={{fontSize:11,color:"#A0C0E0",fontFamily:"'Rajdhani',sans-serif"}}>Quêtes manquées</span>
            <span style={{fontSize:14,fontFamily:"'Orbitron',monospace",fontWeight:700,color:"#EF4444"}}>{missed}</span>
          </div>}
        </div>
        <div style={{fontSize:10,color:"#8BADD4",fontFamily:"monospace",fontStyle:"italic",marginBottom:18,lineHeight:1.7}}>
          "La faiblesse n'est pas un péché.<br/>La capitulation, si."
        </div>
        <button onClick={onClose} style={{width:"100%",padding:"13px",background:"rgba(239,68,68,0.1)",border:"1px solid #EF4444",borderRadius:12,cursor:"pointer",fontSize:13,fontFamily:"'Orbitron',monospace",fontWeight:700,color:"#EF4444",letterSpacing:"0.1em"}}>
          ACCEPTER LA PUNITION ›
        </button>
      </div>
    </div>
  );
}

// ── SHOP ──────────────────────────────────────────────────
function Shop({ gold, purchases, activeBoosts, onBuy, onClose }) {
  const [confirm, setConfirm] = useState(null);
  const now = Date.now();
  const buy = item => {
    if(gold < item.cost) return;
    onBuy(item);
    setConfirm(null);
  };
  return (
    <div style={{position:"fixed",inset:0,zIndex:8000,background:"rgba(0,0,0,0.97)",backdropFilter:"blur(6px)",display:"flex",flexDirection:"column"}}>
      <div style={{display:"flex",alignItems:"center",gap:10,padding:"13px 14px",borderBottom:"1px solid rgba(255,215,0,0.1)",flexShrink:0,background:"rgba(0,0,0,0.8)"}}>
        <button onClick={onClose} style={{background:"rgba(56,139,255,0.15)",border:"1px solid rgba(56,139,255,0.25)",borderRadius:8,padding:"6px 10px",cursor:"pointer",fontSize:12,color:"#8BADD4",fontFamily:"'Orbitron',monospace"}}>← RET.</button>
        <div>
          <div style={{fontSize:8,color:"#8BADD4",fontFamily:"'Orbitron',monospace",letterSpacing:"0.2em"}}>MARCHÉ</div>
          <div style={{fontSize:14,fontFamily:"'Orbitron',monospace",fontWeight:700,color:"#FFD700"}}>BOUTIQUE DU SYSTÈME</div>
        </div>
        <div style={{marginLeft:"auto",display:"flex",alignItems:"center",gap:5,background:"rgba(255,215,0,0.08)",border:"1px solid rgba(255,215,0,0.2)",borderRadius:10,padding:"5px 10px"}}>
          <span style={{fontSize:15}}>💰</span>
          <span style={{fontSize:15,fontFamily:"'Orbitron',monospace",fontWeight:700,color:"#FFD700"}}>{gold}</span>
        </div>
      </div>

      {/* Active boosts banner */}
      {Object.keys(activeBoosts).some(k=>activeBoosts[k]>now) && (
        <div style={{padding:"8px 14px",borderBottom:"1px solid rgba(255,215,0,0.08)",background:"rgba(255,215,0,0.03)"}}>
          <div style={{fontSize:8,color:"#FFD70088",fontFamily:"'Orbitron',monospace",letterSpacing:"0.15em",marginBottom:5}}>BOOSTS ACTIFS</div>
          <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
            {Object.entries(activeBoosts).map(([id,until])=>{
              if(until<=now) return null;
              const item=SHOP_ITEMS.find(i=>i.id===id);
              const left=Math.ceil((until-now)/60000);
              return item?<div key={id} style={{fontSize:10,fontFamily:"'Orbitron',monospace",color:"#FFD700",background:"rgba(255,215,0,0.1)",border:"1px solid rgba(255,215,0,0.25)",borderRadius:6,padding:"3px 7px"}}>
                {item.emoji} {item.name.split(" ")[0]} · {left}min
              </div>:null;
            })}
          </div>
        </div>
      )}

      <div style={{flex:1,overflowY:"auto",padding:"12px"}}>
        {/* Category: Boosts */}
        {[{label:"⚡ BOOSTS",types:["boost"]},{label:"⚔️ COMBAT",types:["instant","shield"]},{label:"🎨 COSMÉTIQUES",types:["cosme"]}].map(cat=>(
          <div key={cat.label} style={{marginBottom:18}}>
            <div style={{fontSize:8,color:"#7BA7CC",fontFamily:"'Orbitron',monospace",letterSpacing:"0.18em",marginBottom:8}}>{cat.label}</div>
            {SHOP_ITEMS.filter(i=>cat.types.includes(i.type)).map(item=>{
              const owned = purchases.includes(item.id) && item.type==="cosme";
              const boosted = item.type==="boost" && (activeBoosts[item.id]||0)>now;
              const canAfford = gold >= item.cost;
              const isConfirming = confirm===item.id;
              return (
                <div key={item.id} style={{background:"rgba(0,0,0,0.7)",border:`1px solid ${item.color}22`,borderRadius:13,padding:"11px 12px",marginBottom:8,backdropFilter:"blur(6px)",animation:isConfirming?"comboFlash 0.5s ease":undefined}}>
                  <div style={{display:"flex",alignItems:"center",gap:10}}>
                    <div style={{width:40,height:40,borderRadius:10,background:`${item.color}15`,border:`1px solid ${item.color}33`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:21,flexShrink:0}}>{item.emoji}</div>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:13,fontFamily:"'Rajdhani',sans-serif",fontWeight:700,color:item.color}}>{item.name}</div>
                      <div style={{fontSize:10,color:"#8BADD4",fontFamily:"'Rajdhani',sans-serif",lineHeight:1.4}}>{item.desc}</div>
                      {boosted&&<div style={{fontSize:8,color:"#39FF14",fontFamily:"monospace",marginTop:2}}>✦ ACTIF · {Math.ceil(((activeBoosts[item.id]||0)-now)/60000)}min restantes</div>}
                    </div>
                    <div style={{flexShrink:0,textAlign:"center"}}>
                      {isConfirming?(
                        <div style={{display:"flex",flexDirection:"column",gap:4}}>
                          <button onClick={()=>buy(item)} style={{padding:"5px 10px",background:`${item.color}22`,border:`1px solid ${item.color}`,borderRadius:7,cursor:"pointer",fontSize:10,fontFamily:"'Orbitron',monospace",color:item.color,fontWeight:700}}>OK</button>
                          <button onClick={()=>setConfirm(null)} style={{padding:"5px 10px",background:"transparent",border:"1px solid #333",borderRadius:7,cursor:"pointer",fontSize:10,fontFamily:"'Orbitron',monospace",color:"#8BADD4"}}>NON</button>
                        </div>
                      ):(
                        <button onClick={()=>canAfford&&!owned&&setConfirm(item.id)} style={{padding:"6px 10px",background:owned?"rgba(57,255,20,0.1)":canAfford?`${item.color}15`:"rgba(10,20,50,0.5)",border:`1px solid ${owned?"rgba(57,255,20,0.3)":canAfford?item.color+"44":"rgba(56,139,255,0.22)"}`,borderRadius:8,cursor:canAfford&&!owned?"pointer":"default",minWidth:56,opacity:canAfford||owned?1:0.4}}>
                          {owned?<span style={{fontSize:10,color:"#39FF14",fontFamily:"'Orbitron',monospace"}}>✓</span>:(
                            <><div style={{fontSize:12,fontFamily:"'Orbitron',monospace",fontWeight:700,color:canAfford?item.color:"#8BADD4"}}>{item.cost}</div>
                            <div style={{fontSize:8,color:"#8BADD4",fontFamily:"monospace"}}>💰</div></>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── COMBO TIMING COMBAT (replaces old Combat) ─────────────
// ══════════════════════════════════════════════════════════
// COMBAT v2 — Tour par tour, boss riposte, effets de statut
// ══════════════════════════════════════════════════════════

// Effet spécial selon rang de la quête-attaque
const ATK_FX = {
  E:{type:"none",   tag:"",          col:"#6B7280"},
  D:{type:"bleed",  tag:"🩸 SAIGN.", col:"#EF4444"},
  C:{type:"stun",   tag:"⚡ STUN",   col:"#F59E0B"},
  B:{type:"shield", tag:"🛡 BOUCLIER",col:"#60A5FA"},
  A:{type:"burn",   tag:"🔥 BRÛLURE",col:"#FF3864"},
  S:{type:"shadow", tag:"🌑 OMBRE",  col:"#A855F7"},
};

// IA du boss — chaque boss a 2-3 patterns d'attaque distincts
const BOSS_AI = {
  sloth:   [{dmg:8, msg:"L'apathie te ronge...",        fx:"slow"},  {dmg:6, msg:"Tu veux t'allonger...",         fx:"skip"}],
  procras: [{dmg:12,msg:"Plus tard, toujours plus tard.",fx:"cd+"},  {dmg:16,msg:"Le temps perdu ne revient pas.",fx:"none"}],
  screen:  [{dmg:10,msg:"Tes yeux brûlent.",            fx:"weaken"},{dmg:8, msg:"Encore 5 minutes...",           fx:"slow"}],
  doubt:   [{dmg:18,msg:"Tu n'es pas assez bon.",       fx:"weaken"},{dmg:12,msg:"Le doute s'infiltre...",        fx:"bleed"}],
  sleep:   [{dmg:8, msg:"Tes paupières sont lourdes...",fx:"skip"},  {dmg:22,msg:"Tu es piégé dans le rêve.",     fx:"none"}],
  compare: [{dmg:16,msg:"Les autres sont meilleurs.",   fx:"weaken"},{dmg:24,msg:"Tu n'es rien.",                fx:"none"}],
  chaos:   [{dmg:28,msg:"CHAOS TOTAL !",                fx:"random"},{dmg:20,msg:"Tout s'effondre.",             fx:"bleed"}],
  perfect: [{dmg:22,msg:"Pas assez parfait !",          fx:"weaken"},{dmg:32,msg:"L'excellence exige le sang.",  fx:"bleed"}],
  fear:    [{dmg:38,msg:"La peur te paralyse.",         fx:"skip"},  {dmg:26,msg:"Tes pires cauchemars...",       fx:"weaken"}],
  igris:   [{dmg:42,msg:"Igris : Viens te battre !",    fx:"bleed"}, {dmg:32,msg:"Igris : Tu es encore trop faible.",fx:"none"}],
  shadow:  [{dmg:48,msg:"L'armée des ombres avance.",   fx:"weaken"},{dmg:36,msg:"Beru : Je vais te dévorer.",   fx:"bleed"}],
  antares: [{dmg:65,msg:"ANTARES : Je suis le Monarque !",fx:"none"},{dmg:52,msg:"ANTARES : Tu ne peux pas gagner.",fx:"weaken"}],
};
function pickBossAtk(bossId) {
  const pool = BOSS_AI[bossId] || [{dmg:15,msg:"Le boss attaque !",fx:"none"}];
  return pool[Math.floor(Math.random()*pool.length)];
}

function CombatV2({boss, bossHp, bossMaxHp, playerHp, playerMaxHp,
  attacks, turnPhase, statusFx, lastBossAtk, lastPlayerAtk,
  bossWon, onChoose}) {

  const bPct = bossHp/bossMaxHp;
  const pPct = Math.max(0,playerHp)/playerMaxHp;
  const bCol = bPct>0.5?"#EF4444":bPct>0.25?"#F59E0B":"#FF3864";
  const pCol = pPct>0.5?"#39FF14":pPct>0.25?"#F59E0B":"#EF4444";
  const isMyTurn = turnPhase==="player";
  const [bossShake,setBossShake]=useState(false);
  const [playerShake,setPlayerShake]=useState(false);

  // Ambiance couleur par boss
  const glow={sloth:"#6B728020",procras:"#60A5FA18",screen:"#8B5CF625",doubt:"#37415128",
    sleep:"#1E40AF22",compare:"#7C3AED25",chaos:"#DC262628",perfect:"#F59E0B22",
    fear:"#7F1D1D30",igris:"#99181820",shadow:"#854D0E20",antares:"#A855F730"};

  useEffect(()=>{
    if(lastPlayerAtk){setBossShake(true);setTimeout(()=>setBossShake(false),400);}
  },[lastPlayerAtk]);
  useEffect(()=>{
    if(lastBossAtk&&lastBossAtk.dmg>0){setPlayerShake(true);setTimeout(()=>setPlayerShake(false),400);}
  },[lastBossAtk]);

  return (
    <div>
      {/* ── BOSS CARD ── */}
      <div style={{background:`linear-gradient(150deg,${glow[boss.id]||"#A855F715"},rgba(0,0,0,0.75))`,
        border:`1.5px solid ${bossWon?"#39FF14":boss.color}30`,borderRadius:16,padding:"14px 12px",
        marginBottom:8,position:"relative",overflow:"hidden",
        animation:bossShake?"bossHit 0.35s ease":"none"}}>
        <style>{`@keyframes bossHit{0%,100%{transform:translateX(0)}20%{transform:translateX(-6px)}50%{transform:translateX(5px)}70%{transform:translateX(-3px)}}
        @keyframes playerHit{0%,100%{transform:translateX(0)}25%{transform:translateX(4px)}60%{transform:translateX(-4px)}}
        @keyframes fadeUp{0%{opacity:0;transform:translateY(8px)}100%{opacity:1;transform:translateY(0)}}
        @keyframes turnPulse{0%,100%{opacity:1}50%{opacity:0.5}}`}</style>

        {/* Radial glow */}
        <div style={{position:"absolute",inset:0,background:`radial-gradient(ellipse at 50% 30%,${boss.color}12 0%,transparent 65%)`,pointerEvents:"none"}}/>

        {/* Boss attack flash overlay */}
        {playerShake&&lastBossAtk&&(
          <div style={{position:"absolute",inset:0,background:`${boss.color}18`,borderRadius:16,pointerEvents:"none",zIndex:10}}/>
        )}

        <div style={{display:"flex",gap:12,alignItems:"center",marginBottom:10}}>
          <div style={{position:"relative"}}>
            <BossSVG bossId={boss.id} color={bossWon?"#39FF14":boss.color} size={160} isShaking={bossShake} isDead={bossWon}/>
          </div>
          <div style={{flex:1}}>
            <div style={{fontSize:8,color:"#8BADD4",fontFamily:"'Orbitron',monospace",letterSpacing:"0.18em"}}>{boss.title}</div>
            <div style={{fontSize:14,fontFamily:"'Orbitron',monospace",fontWeight:700,color:bossWon?"#39FF14":boss.color}}>{boss.name}</div>
            {!bossWon&&<div style={{fontSize:8,color:"#1A1A2A",fontFamily:"monospace",fontStyle:"italic",marginTop:2,lineHeight:1.4}}>"{boss.lore}"</div>}
          </div>
        </div>
        <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}>
          <span style={{fontSize:8,color:"#111",fontFamily:"monospace"}}>PV BOSS</span>
          <span style={{fontSize:9,fontFamily:"'Orbitron',monospace",fontWeight:700,color:bossWon?"#39FF14":bCol}}>{bossWon?"✦ VAINCU":Math.max(0,bossHp)+" / "+bossMaxHp}</span>
        </div>
        <Bar v={bossWon?0:bossHp} max={bossMaxHp} color={bossWon?"#39FF14":bCol} h={8}/>
      </div>

      {/* ── PLAYER STATUS ── */}
      {!bossWon&&(
        <div style={{background:"rgba(0,0,0,0.6)",border:`1px solid ${pCol}18`,borderRadius:12,
          padding:"10px 12px",marginBottom:8,animation:playerShake?"playerHit 0.35s ease":"none"}}>
          <div style={{display:"flex",gap:10,alignItems:"center",marginBottom:6}}>
            <div style={{flex:1}}>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}>
                <span style={{fontSize:8,color:"#8BADD4",fontFamily:"monospace"}}>TES PV</span>
                <span style={{fontSize:9,fontFamily:"'Orbitron',monospace",fontWeight:700,color:pCol}}>{Math.max(0,playerHp)} / {playerMaxHp}</span>
              </div>
              <Bar v={Math.max(0,playerHp)} max={playerMaxHp} color={pCol} h={6}/>
            </div>
            {(statusFx||[]).length>0&&(
              <div style={{display:"flex",gap:4,flexShrink:0}}>
                {statusFx.map((ef,i)=>(
                  <div key={i} style={{padding:"2px 6px",borderRadius:6,background:`${ef.col}20`,border:`1px solid ${ef.col}40`,fontSize:7,color:ef.col,fontFamily:"monospace"}}>
                    {ef.tag} {ef.turns}t
                  </div>
                ))}
              </div>
            )}
          </div>
          {/* Turn banner */}
          <div style={{textAlign:"center",padding:"5px 0",borderTop:"1px solid rgba(56,139,255,0.15)"}}>
            <span style={{fontSize:9,fontFamily:"'Orbitron',monospace",fontWeight:700,letterSpacing:"0.08em",
              color:isMyTurn?"#39FF14":"#EF4444",
              textShadow:isMyTurn?"0 0 10px #39FF14":"0 0 10px #EF4444",
              animation:isMyTurn?"none":"turnPulse 1s ease infinite"}}>
              {isMyTurn?"⚔️  TON TOUR — CHOISIS UNE ATTAQUE":"⏳  LE BOSS SE PRÉPARE..."}
            </span>
          </div>
        </div>
      )}

      {/* ── COMBAT LOG (last round) ── */}
      {(lastPlayerAtk||lastBossAtk)&&!bossWon&&(
        <div style={{display:"flex",gap:6,marginBottom:8,animation:"fadeUp 0.3s ease"}}>
          {lastPlayerAtk&&(
            <div style={{flex:1,background:"rgba(57,255,20,0.04)",border:"1px solid rgba(57,255,20,0.12)",borderRadius:9,padding:"6px 9px"}}>
              <div style={{fontSize:8,color:"#39FF14",fontFamily:"'Orbitron',monospace",marginBottom:1}}>TOI</div>
              <div style={{fontSize:9,color:"#C0C8E8",fontFamily:"monospace"}}>
                {lastPlayerAtk.name} <span style={{color:"#EF4444",fontWeight:700}}>-{lastPlayerAtk.dmg}</span>
                {lastPlayerAtk.crit&&<span style={{color:"#FFD700"}}> 💥CRIT</span>}
                {lastPlayerAtk.fxTag&&<span style={{color:lastPlayerAtk.fxCol}}> {lastPlayerAtk.fxTag}</span>}
              </div>
            </div>
          )}
          {lastBossAtk&&(
            <div style={{flex:1,background:`${boss.color}08`,border:`1px solid ${boss.color}18`,borderRadius:9,padding:"6px 9px"}}>
              <div style={{fontSize:8,color:boss.color,fontFamily:"'Orbitron',monospace",marginBottom:1}}>BOSS</div>
              <div style={{fontSize:9,color:"#C0C8E8",fontFamily:"monospace"}}>
                {lastBossAtk.msg.slice(0,28)}{lastBossAtk.msg.length>28?"…":""} <span style={{color:"#EF4444",fontWeight:700}}>{lastBossAtk.skipped?"STUN!":"-"+lastBossAtk.dmg}</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── ATTACK GRID ── */}
      {!bossWon&&(
        <div>
          <div style={{fontSize:8,color:"#1A1A2A",fontFamily:"'Orbitron',monospace",letterSpacing:"0.12em",marginBottom:7}}>
            ⚔️ ATTAQUES{attacks.length===0?" — complète des quêtes pour débloquer":` (${attacks.length})`}
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6}}>
            {attacks.map(a=>{
              const fx=ATK_FX[a.rank]||ATK_FX.E;
              const disabled=!isMyTurn;
              return (
                <button key={a.id} onClick={()=>!disabled&&onChoose(a)} disabled={disabled}
                  style={{display:"flex",flexDirection:"column",gap:4,textAlign:"left",
                    background:disabled?"rgba(0,0,0,0.3)":`${a.color}0D`,
                    border:`1px solid ${disabled?"rgba(56,139,255,0.15)":a.color+"35"}`,
                    borderRadius:12,padding:"10px",cursor:disabled?"default":"pointer",
                    opacity:disabled?0.45:1,transition:"all 0.15s",
                    boxShadow:!disabled?`0 0 8px ${a.color}14`:"none"}}>
                  <div style={{display:"flex",alignItems:"center",gap:6}}>
                    <span style={{fontSize:19}}>{a.emoji}</span>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:10,fontFamily:"'Orbitron',monospace",fontWeight:700,color:disabled?"#222":a.color,
                        whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{a.atkName}</div>
                      <div style={{fontSize:8,color:"#2A2A3A",fontFamily:"monospace"}}>{a.name}</div>
                    </div>
                  </div>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                    <span style={{fontSize:13,fontFamily:"'Orbitron',monospace",fontWeight:900,color:"#EF4444"}}>-{a.dmg}</span>
                    {fx.type!=="none"&&(
                      <span style={{fontSize:7,padding:"2px 5px",borderRadius:4,
                        background:`${fx.col}18`,border:`1px solid ${fx.col}35`,
                        color:fx.col,fontFamily:"monospace"}}>{fx.tag}</span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
          {attacks.length>0&&isMyTurn&&(
            <button onClick={()=>onChoose(attacks[Math.floor(Math.random()*attacks.length)])}
              style={{width:"100%",marginTop:8,padding:"11px",background:"rgba(168,85,247,0.1)",
                border:"1px solid #A855F744",borderRadius:12,cursor:"pointer",fontSize:11,
                fontFamily:"'Orbitron',monospace",fontWeight:700,color:"#A855F7",letterSpacing:"0.08em"}}>
              ⚔️ FRAPPE AU HASARD
            </button>
          )}
        </div>
      )}
      {bossWon&&(
        <div style={{textAlign:"center",padding:"16px",background:"rgba(57,255,20,0.04)",
          border:"1px solid rgba(57,255,20,0.15)",borderRadius:14}}>
          <div style={{fontSize:12,fontFamily:"'Orbitron',monospace",color:"#39FF14",fontWeight:700}}>✦ DONJON TERMINÉ</div>
          <div style={{fontSize:9,color:"#8BADD4",fontFamily:"monospace",marginTop:3}}>Reviens demain pour un nouveau boss</div>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════
// POMODORO v2 — Configurable, pausable, alarme, autocomplete
// ══════════════════════════════════════════════════════════
function usePomodoroV2({onWorkDone, onSessionEnd}) {
  const [sess, setSess] = useState(null);
  // sess: {questId,questName,workMins,breakMins,phase,secsLeft,rounds,paused,focusSecs}
  const timerRef = useRef(null);

  const playBeep = (freq=880, count=3) => {
    try {
      const ac = new (window.AudioContext||window.webkitAudioContext)();
      for(let i=0;i<count;i++){
        const o=ac.createOscillator(), g=ac.createGain();
        o.connect(g); g.connect(ac.destination);
        o.frequency.value = i===1?freq*1.25:freq;
        o.type = "sine";
        g.gain.setValueAtTime(0,ac.currentTime+i*0.2);
        g.gain.linearRampToValueAtTime(0.3,ac.currentTime+i*0.2+0.05);
        g.gain.exponentialRampToValueAtTime(0.001,ac.currentTime+i*0.2+0.35);
        o.start(ac.currentTime+i*0.2);
        o.stop(ac.currentTime+i*0.2+0.4);
      }
    } catch(e){}
  };

  useEffect(()=>{
    timerRef.current = setInterval(()=>{
      setSess(p=>{
        if(!p||p.paused) return p;
        if(p.secsLeft>1) return{...p,secsLeft:p.secsLeft-1};
        // Phase transition
        if(p.phase==="work"){
          playBeep(880,3);
          if(onWorkDone) onWorkDone(p.questId, p.workMins*60);
          return{...p,phase:"break",secsLeft:p.breakMins*60,rounds:p.rounds+1,focusSecs:p.focusSecs+p.workMins*60};
        } else {
          playBeep(660,2);
          return{...p,phase:"work",secsLeft:p.workMins*60};
        }
      });
    },1000);
    return()=>clearInterval(timerRef.current);
  },[]);

  const start = (questId,questName,workMins,breakMins)=>{
    setSess({questId,questName,workMins,breakMins,phase:"work",secsLeft:workMins*60,rounds:0,paused:false,focusSecs:0});
  };
  const pause = ()=>setSess(p=>p?{...p,paused:!p.paused}:p);
  const finish = ()=>{
    setSess(p=>{
      if(p&&onSessionEnd) onSessionEnd(p.questId, p.focusSecs+(p.phase==="work"?p.workMins*60-p.secsLeft:0));
      return null;
    });
  };
  const cancel = ()=>setSess(null);

  return {sess, start, pause, finish, cancel};
}

// ── POMODORO CONFIG SHEET (bottom modal) ──────────────────
function PomodoroSheet({quest, onStart, onClose}) {
  const [workMins, setWork] = useState(quest?.duration||25);
  const [breakMins, setBreak] = useState(5);
  const WS=[5,10,15,20,25,30,45,60,90], BS=[3,5,10,15];
  return(
    <div style={{position:"fixed",inset:0,zIndex:400,background:"rgba(0,0,0,0.88)",display:"flex",
      alignItems:"flex-end",justifyContent:"center"}} onClick={onClose}>
      <div style={{width:"100%",maxWidth:480,background:"#060610",border:"1px solid rgba(239,68,68,0.3)",
        borderRadius:"22px 22px 0 0",padding:"20px 20px calc(28px + env(safe-area-inset-bottom))",
        boxShadow:"0 -10px 50px rgba(239,68,68,0.18)"}} onClick={e=>e.stopPropagation()}>
        <div style={{width:36,height:3,borderRadius:2,background:"rgba(255,255,255,0.1)",margin:"0 auto 18px"}}/>
        <div style={{fontSize:9,color:"#EF4444",fontFamily:"'Orbitron',monospace",letterSpacing:"0.15em",marginBottom:4}}>⏱  POMODORO</div>
        <div style={{fontSize:16,fontFamily:"'Rajdhani',sans-serif",fontWeight:700,color:"#D0EAFF",marginBottom:16}}>{quest?.name}</div>

        <div style={{marginBottom:14}}>
          <div style={{fontSize:8,color:"#8BADD4",fontFamily:"'Orbitron',monospace",marginBottom:8}}>DURÉE FOCUS</div>
          <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
            {WS.map(m=>(
              <button key={m} onClick={()=>setWork(m)} style={{padding:"7px 13px",borderRadius:9,
                background:workMins===m?"rgba(239,68,68,0.18)":"rgba(10,20,50,0.5)",
                border:`1px solid ${workMins===m?"#EF4444":"rgba(56,139,255,0.22)"}`,
                cursor:"pointer",fontSize:10,fontFamily:"'Orbitron',monospace",
                color:workMins===m?"#EF4444":"#444",fontWeight:workMins===m?700:400}}>
                {m}m
              </button>
            ))}
          </div>
        </div>

        <div style={{marginBottom:18}}>
          <div style={{fontSize:8,color:"#8BADD4",fontFamily:"'Orbitron',monospace",marginBottom:8}}>DURÉE PAUSE</div>
          <div style={{display:"flex",gap:6}}>
            {BS.map(m=>(
              <button key={m} onClick={()=>setBreak(m)} style={{padding:"7px 16px",borderRadius:9,
                background:breakMins===m?"rgba(52,211,153,0.15)":"rgba(10,20,50,0.5)",
                border:`1px solid ${breakMins===m?"#34D399":"rgba(56,139,255,0.22)"}`,
                cursor:"pointer",fontSize:10,fontFamily:"'Orbitron',monospace",
                color:breakMins===m?"#34D399":"#444",fontWeight:breakMins===m?700:400}}>
                {m}m
              </button>
            ))}
          </div>
        </div>

        <div style={{background:"rgba(239,68,68,0.04)",border:"1px solid rgba(239,68,68,0.1)",
          borderRadius:11,padding:"10px 12px",marginBottom:16,fontSize:9,color:"#8BADD4",fontFamily:"monospace",lineHeight:1.7}}>
          🔴 {workMins}min focus → 🟢 {breakMins}min pause → répète<br/>
          ⚔️ Boss subit ~{workMins*2} dégâts par session focus<br/>
          ✦ Quête auto-cochée à la fin
        </div>

        <button onClick={()=>onStart(workMins,breakMins)}
          style={{width:"100%",padding:"14px",background:"linear-gradient(135deg,rgba(239,68,68,0.25),rgba(239,68,68,0.08))",
            border:"1px solid #EF4444",borderRadius:13,cursor:"pointer",fontSize:12,
            fontFamily:"'Orbitron',monospace",fontWeight:700,color:"#EF4444",letterSpacing:"0.1em",
            boxShadow:"0 0 24px rgba(239,68,68,0.2)"}}>
          LANCER →
        </button>
      </div>
    </div>
  );
}

// ── POMODORO FLOATING WIDGET ──────────────────────────────
function PomodoroWidget({sess, onPause, onFinish, onCancel}) {
  if(!sess) return null;
  const isWork = sess.phase==="work";
  const col = isWork?"#EF4444":"#34D399";
  const total = isWork?sess.workMins*60:sess.breakMins*60;
  const pct = 1-(sess.secsLeft/total);
  const mins = Math.floor(sess.secsLeft/60), secs = sess.secsLeft%60;
  const R=20, CX=26;
  const circ=2*Math.PI*R;
  return(
    <div style={{position:"fixed",bottom:84,left:"50%",transform:"translateX(-50%)",zIndex:300,
      background:"rgba(4,4,14,0.98)",border:`1.5px solid ${col}45`,borderRadius:18,
      padding:"11px 14px",display:"flex",alignItems:"center",gap:12,
      boxShadow:`0 4px 36px ${col}22`,maxWidth:340,width:"92%",backdropFilter:"blur(20px)"}}>
      <svg width={CX*2} height={CX*2} viewBox={`0 0 ${CX*2} ${CX*2}`} style={{flexShrink:0}}>
        <circle cx={CX} cy={CX} r={R} fill="none" stroke="rgba(56,139,255,0.18)" strokeWidth={3}/>
        <circle cx={CX} cy={CX} r={R} fill="none" stroke={col} strokeWidth={3}
          strokeDasharray={circ} strokeDashoffset={circ*(1-pct)}
          strokeLinecap="round" transform={`rotate(-90 ${CX} ${CX})`}
          style={{transition:"stroke-dashoffset 0.9s linear"}}/>
        <text x={CX} y={CX+4} textAnchor="middle" fontSize={8}
          fontFamily="Orbitron,monospace" fill={col} fontWeight={700}>
          {String(mins).padStart(2,"0")}:{String(secs).padStart(2,"0")}
        </text>
      </svg>
      <div style={{flex:1,minWidth:0}}>
        <div style={{fontSize:9,fontFamily:"'Orbitron',monospace",fontWeight:700,color:col,marginBottom:2}}>
          {sess.paused?"⏸ PAUSE":isWork?"🔴 FOCUS":"🟢 REPOS"} · {sess.rounds} rnd
        </div>
        <div style={{fontSize:10,color:"#777",fontFamily:"monospace",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{sess.questName}</div>
      </div>
      <div style={{display:"flex",flexDirection:"column",gap:5,flexShrink:0}}>
        <button onClick={onPause} style={{padding:"5px 9px",background:"rgba(56,139,255,0.18)",
          border:"1px solid rgba(255,255,255,0.09)",borderRadius:7,cursor:"pointer",
          fontSize:11,color:"#A0C0E0",fontFamily:"monospace"}}>{sess.paused?"▶":"⏸"}</button>
        <button onClick={onFinish} style={{padding:"5px 9px",background:"rgba(57,255,20,0.08)",
          border:"1px solid rgba(57,255,20,0.25)",borderRadius:7,cursor:"pointer",
          fontSize:9,color:"#39FF14",fontFamily:"'Orbitron',monospace",fontWeight:700}}>FIN ✓</button>
      </div>
    </div>
  );
}

const TABS=[{id:"quests",icon:"📋",label:"QUÊTES"},{id:"dungeon",icon:"🚪",label:"DONJON"},{id:"weekly",icon:"📅",label:"DÉFIS"},{id:"stats",icon:"📊",label:"STATS"},{id:"profile",icon:"👤",label:"PROFIL"}];

const SEC={AUBE:{icon:"🌅",c:"#00F5FF"},JOUR:{icon:"⚡",c:"#FF8C00"},MIDI:{icon:"🎯",c:"#A855F7"},SOIR:{icon:"🌙",c:"#FF3864"}};
const defaultState=()=>({
  quests:DEFAULT_QUESTS, history:{}, name:"", gold:80, bonusXp:0,
  defeatedBosses:[], secretsDone:{}, bossHpMap:{}, wonToday:{},
  activeTitle:null, soundEnabled:true, onboarded:false,
  purchases:[], activeBoosts:{}, auraOverride:null,
  penaltyLog:{}, streakShield:false,
  weeklyProgress:{},
  antaresHp:1500,
  antaresMonth:"",
  generatedAtkNames:{},
  activeBet:null,
  pomodoroLog:{},  // {questId: totalFocusSecs}
});

// ── HELPERS ──────────────────────────────────────────────
const weekKey=()=>{const d=new Date();const day=d.getDay()||7;d.setDate(d.getDate()-day+1);return d.toISOString().slice(0,10);};
const monthKey=()=>new Date().toISOString().slice(0,7);



// ── WEEKLY QUESTS ─────────────────────────────────────────
const WEEKLY_POOL = [
  {id:"w1", name:"Semaine sans écran le matin",   emoji:"📵", xp:300, gold:60, desc:"Pas d'écran dans l'heure après le réveil, 5j/7"},
  {id:"w2", name:"7 jours de mouvement",           emoji:"🏃", xp:350, gold:70, desc:"Au moins 20min de sport chaque jour"},
  {id:"w3", name:"Lecture quotidienne",             emoji:"📖", xp:280, gold:55, desc:"30min de lecture chaque jour"},
  {id:"w4", name:"Hydratation absolue",             emoji:"💧", xp:200, gold:40, desc:"2L d'eau par jour pendant 7 jours"},
  {id:"w5", name:"Sommeil régulier",                emoji:"🌙", xp:320, gold:65, desc:"Même heure de coucher 6j/7"},
  {id:"w6", name:"Zéro fast-food",                  emoji:"🥗", xp:250, gold:50, desc:"Aucun fast-food de toute la semaine"},
  {id:"w7", name:"Méditation hebdomadaire",         emoji:"🧘", xp:270, gold:55, desc:"10min de méditation par jour"},
  {id:"w8", name:"Apprentissage continu",           emoji:"🧠", xp:300, gold:60, desc:"Apprendre quelque chose de nouveau chaque jour"},
  {id:"w9", name:"Discipline totale",               emoji:"⚔️", xp:400, gold:80, desc:"Toutes les quêtes quotidiennes complétées 5j/7"},
  {id:"w10",name:"Déconnexion digitale",            emoji:"📴", xp:350, gold:70, desc:"Pas de réseaux sociaux pendant 7 jours"},
];
const getWeeklyQuests=(wk)=>{const seed=dseed(wk);return[WEEKLY_POOL[seed%10],WEEKLY_POOL[(seed+3)%10],WEEKLY_POOL[(seed+7)%10]];};

// ── WEEKLY QUESTS PANEL ───────────────────────────────────
function WeeklyPanel({weeklyProgress,weeklyQuests,wk,onToggle,color}) {
  const done=weeklyProgress[wk]||{};
  return (
    <div style={{margin:"0 12px 14px",background:"rgba(0,0,0,0.7)",border:`1px solid ${color}22`,borderRadius:14,overflow:"hidden",backdropFilter:"blur(10px)"}}>
      <div style={{padding:"10px 14px 8px",borderBottom:`1px solid ${color}15`,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
        <div>
          <div style={{fontSize:8,color:`${color}88`,fontFamily:"'Orbitron',monospace",letterSpacing:"0.2em"}}>DÉFIS DE LA SEMAINE</div>
          <div style={{fontSize:10,color:"#2A2A3A",fontFamily:"'Rajdhani',sans-serif",marginTop:1}}>{Object.values(done).filter(Boolean).length} / {weeklyQuests.length} accomplis</div>
        </div>
        <div style={{fontSize:19}}>📅</div>
      </div>
      <div style={{padding:"10px 12px"}}>
        {weeklyQuests.map(q=>{
          const isDone=!!done[q.id];
          return (
            <div key={q.id} onClick={()=>onToggle(q.id)}
              style={{display:"flex",alignItems:"center",gap:10,padding:"9px 10px",borderRadius:11,marginBottom:5,cursor:"pointer",
                background:isDone?`${color}10`:"rgba(10,20,50,0.6)",
                border:`1px solid ${isDone?color+"35":"rgba(56,139,255,0.18)"}`,
                boxShadow:isDone?`0 2px 12px ${color}18`:"none",transition:"all 0.2s"}}>
              <div style={{width:22,height:22,borderRadius:7,flexShrink:0,background:isDone?`linear-gradient(135deg,${color},${color}88)`:"rgba(56,139,255,0.15)",border:`2px solid ${isDone?color:"rgba(56,139,255,0.25)"}`,display:"flex",alignItems:"center",justifyContent:"center",boxShadow:isDone?`0 0 8px ${color}55`:"none",transition:"all 0.2s"}}>
                {isDone&&<span style={{color:"#000",fontSize:11,fontWeight:900}}>✓</span>}
              </div>
              <span style={{fontSize:18,flexShrink:0}}>{q.emoji}</span>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:13,fontFamily:"'Rajdhani',sans-serif",fontWeight:700,color:isDone?color:"#C0C8E0"}}>{q.name}</div>
                <div style={{fontSize:9,color:"#2A2A3A",fontFamily:"monospace",marginTop:1}}>{q.desc}</div>
              </div>
              <div style={{textAlign:"center",flexShrink:0}}>
                <div style={{fontSize:11,color:isDone?color:"#2A2A3A",fontWeight:900,fontFamily:"'Orbitron',monospace"}}>+{q.xp}</div>
                <div style={{fontSize:7,color:"#1A1A2A",fontFamily:"monospace"}}>XP</div>
                <div style={{fontSize:9,color:isDone?"#FFD700":"#1A1A2A",fontFamily:"monospace"}}>💰{q.gold}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── ANTARES MONTHLY BOSS ──────────────────────────────────
function AntaresPanel({antaresHp,color,onAttack,alreadyHitToday}) {
  const maxHp=1500;
  const pct=Math.max(0,antaresHp/maxHp);
  const daysLeft=new Date(new Date().getFullYear(),new Date().getMonth()+1,0).getDate()-new Date().getDate();
  const defeated=antaresHp<=0;
  const hpCol=pct>0.6?"#A855F7":pct>0.3?"#EF4444":"#FF3864";
  return (
    <div style={{margin:"0 12px 14px",background:`linear-gradient(135deg,rgba(192,38,211,0.06),rgba(0,0,0,0.85))`,border:`1px solid ${defeated?"#39FF14":alreadyHitToday?"rgba(192,38,211,0.15)":"rgba(192,38,211,0.3)"}`,borderRadius:16,overflow:"hidden",backdropFilter:"blur(12px)",position:"relative"}}>
      {/* Ambient glow */}
      <div style={{position:"absolute",inset:0,background:"radial-gradient(ellipse at 50% 0%,rgba(192,38,211,0.08),transparent 60%)",pointerEvents:"none"}}/>
      <div style={{padding:"12px 14px",position:"relative",zIndex:1}}>
        <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:10}}>
          <div style={{flexShrink:0,filter:defeated?"drop-shadow(0 0 16px #39FF14)":"drop-shadow(0 0 12px #C026D3)",animation:defeated?"none":"bossBreath 3s ease-in-out infinite"}}>
            <BossSVG bossId="antares" color={defeated?"#39FF14":"#C026D3"} size={56}/>
          </div>
          <div style={{flex:1}}>
            <div style={{fontSize:7,color:"#C026D366",fontFamily:"'Orbitron',monospace",letterSpacing:"0.25em",marginBottom:2}}>⬛ BOSS MENSUEL</div>
            <div style={{fontSize:15,fontFamily:"'Orbitron',monospace",fontWeight:900,color:defeated?"#39FF14":"#C026D3",textShadow:`0 0 12px ${defeated?"#39FF14":"#C026D3"}`}}>ANTARES</div>
            <div style={{fontSize:9,color:"#8BADD4",fontFamily:"monospace",marginTop:1}}>{defeated?"✦ VAINCU CE MOIS":`Roi des Démons · ${daysLeft}j restants`}</div>
          </div>
          {!defeated&&<div style={{textAlign:"center",flexShrink:0}}>
            <div style={{fontSize:12,fontFamily:"'Orbitron',monospace",fontWeight:900,color:"#C026D3"}}>{antaresHp}</div>
            <div style={{fontSize:7,color:"#8BADD4",fontFamily:"monospace"}}>PV restants</div>
          </div>}
        </div>
        {/* HP bar */}
        {!defeated&&(
          <div style={{marginBottom:10}}>
            <div style={{height:8,background:"rgba(56,139,255,0.15)",borderRadius:4,overflow:"hidden",boxShadow:"inset 0 2px 4px rgba(0,0,0,0.5)"}}>
              <div style={{height:"100%",width:`${pct*100}%`,background:`linear-gradient(90deg,${hpCol}88,${hpCol})`,borderRadius:4,transition:"width 0.8s ease",boxShadow:`0 0 8px ${hpCol}`}}/>
            </div>
          </div>
        )}
        {/* Daily hit button */}
        {!defeated&&(
          <button onClick={onAttack} disabled={alreadyHitToday}
            style={{width:"100%",padding:"10px",background:alreadyHitToday?"rgba(10,20,50,0.6)":"rgba(192,38,211,0.12)",border:`1px solid ${alreadyHitToday?"rgba(56,139,255,0.15)":"rgba(192,38,211,0.4)"}`,borderRadius:11,cursor:alreadyHitToday?"default":"pointer",fontSize:11,fontFamily:"'Orbitron',monospace",fontWeight:700,color:alreadyHitToday?"#1A1A2A":"#C026D3",letterSpacing:"0.08em",boxShadow:alreadyHitToday?"none":"0 0 16px rgba(192,38,211,0.2)"}}>
            {alreadyHitToday?"⏳ FRAPPE JOURNALIÈRE EFFECTUÉE":"⚡ FRAPPER ANTARES (-50 PV)"}
          </button>
        )}
        {defeated&&<div style={{textAlign:"center",padding:"6px",color:"#39FF14",fontSize:11,fontFamily:"'Orbitron',monospace",fontWeight:700}}>✦ MONARQUE ABATTU — VICTOIRE MENSUELLE</div>}
      </div>
    </div>
  );
}

// ── DOUBLE MISE (BET) ─────────────────────────────────────
function BetModal({quest,gold,onBet,onClose}) {
  const [amount,setAmount]=useState(Math.min(20,gold));
  const max=Math.min(gold,Math.floor(quest.xp/2));
  return (
    <div style={{position:"fixed",inset:0,zIndex:9200,background:"rgba(0,0,0,0.92)",display:"flex",alignItems:"center",justifyContent:"center"}} onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div style={{background:"rgba(8,8,12,0.98)",border:"1px solid rgba(255,215,0,0.25)",borderRadius:18,padding:"20px 18px",width:"88%",maxWidth:320,animation:"sysIn 0.3s ease"}}>
        <div style={{textAlign:"center",marginBottom:14}}>
          <div style={{fontSize:8,color:"#FFD70066",fontFamily:"'Orbitron',monospace",letterSpacing:"0.3em",marginBottom:6}}>⚠️ DOUBLE MISE</div>
          <div style={{fontSize:23,marginBottom:4}}>{quest.emoji}</div>
          <div style={{fontSize:14,fontFamily:"'Rajdhani',sans-serif",fontWeight:700,color:"#D0D8F0"}}>{quest.name}</div>
          <div style={{fontSize:10,color:"#2A2A3A",fontFamily:"monospace",marginTop:3}}>Miser du gold avant de cocher cette quête</div>
        </div>
        <div style={{background:"rgba(255,215,0,0.04)",border:"1px solid rgba(255,215,0,0.12)",borderRadius:12,padding:"14px",marginBottom:14}}>
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:10}}>
            <span style={{fontSize:10,color:"#FFD70088",fontFamily:"'Orbitron',monospace"}}>MISE</span>
            <span style={{fontSize:13,color:"#FFD700",fontFamily:"'Orbitron',monospace",fontWeight:900}}>💰 {amount}g</span>
          </div>
          <input type="range" min={5} max={Math.max(5,max)} value={amount} onChange={e=>setAmount(+e.target.value)}
            style={{width:"100%",marginBottom:10,accentColor:"#FFD700"}}/>
          <div style={{display:"flex",gap:8}}>
            <div style={{flex:1,textAlign:"center",background:"rgba(57,255,20,0.06)",border:"1px solid rgba(57,255,20,0.15)",borderRadius:8,padding:"6px"}}>
              <div style={{fontSize:8,color:"#39FF1466",fontFamily:"monospace"}}>VICTOIRE</div>
              <div style={{fontSize:12,color:"#39FF14",fontFamily:"'Orbitron',monospace",fontWeight:700}}>+{amount*2}g</div>
            </div>
            <div style={{flex:1,textAlign:"center",background:"rgba(239,68,68,0.06)",border:"1px solid rgba(239,68,68,0.15)",borderRadius:8,padding:"6px"}}>
              <div style={{fontSize:8,color:"#EF444466",fontFamily:"monospace"}}>ÉCHEC (décoche)</div>
              <div style={{fontSize:12,color:"#EF4444",fontFamily:"'Orbitron',monospace",fontWeight:700}}>-{amount}g</div>
            </div>
          </div>
        </div>
        <div style={{display:"flex",gap:8}}>
          <button onClick={onClose} style={{flex:1,padding:"10px",background:"rgba(10,20,50,0.5)",border:"1px solid rgba(56,139,255,0.22)",borderRadius:11,cursor:"pointer",fontSize:11,color:"#8BADD4",fontFamily:"'Orbitron',monospace",fontWeight:700}}>ANNULER</button>
          <button onClick={()=>onBet(amount)} disabled={gold<5||max<5}
            style={{flex:2,padding:"10px",background:"rgba(255,215,0,0.1)",border:"1px solid rgba(255,215,0,0.3)",borderRadius:11,cursor:"pointer",fontSize:11,color:"#FFD700",fontFamily:"'Orbitron',monospace",fontWeight:700,boxShadow:"0 0 12px rgba(255,215,0,0.15)"}}>
            ⚡ MISER {amount}g
          </button>
        </div>
      </div>
    </div>
  );
}

// ── AI ATTACK NAME GENERATOR ──────────────────────────────
async function generateAtkName(questName,questEmoji) {
  try {
    const res=await fetch("https://api.anthropic.com/v1/messages",{
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({
        model:"claude-sonnet-4-20250514",
        max_tokens:60,
        system:"Tu es un générateur de noms d'attaques pour un jeu RPG de type Solo Leveling. Réponds UNIQUEMENT avec le nom de l'attaque — pas d'explication, pas de ponctuation superflue. Le nom doit être épique, court (2-5 mots), en français ou japonais romanisé. Exemples: 'Frappe de l'Aube', 'Kurogane Slash', 'Éclat du Vide', 'Domination Absolue'.",
        messages:[{role:"user",content:`Quête: "${questName}" ${questEmoji} — génère un nom d'attaque épique.`}]
      })
    });
    const d=await res.json();
    return d?.content?.[0]?.text?.trim()||null;
  } catch {return null;}
}

// ── BOSS COUNTER-ATTACK SCREEN ────────────────────────────
function BossCounterScreen({boss,goldLost,onClose}) {
  const [phase,setPhase]=useState(0);
  useEffect(()=>{
    const t=[600,1400].map((ms,i)=>setTimeout(()=>setPhase(i+1),ms));
    return()=>t.forEach(clearTimeout);
  },[]);
  return (
    <div style={{position:"fixed",inset:0,zIndex:9700,background:"rgba(0,0,0,0.97)",display:"flex",alignItems:"center",justifyContent:"center"}}>
      <div style={{position:"absolute",inset:0,backgroundImage:"repeating-linear-gradient(45deg,transparent,transparent 4px,rgba(239,68,68,0.04) 4px,rgba(239,68,68,0.04) 8px)",pointerEvents:"none"}}/>
      <div style={{textAlign:"center",maxWidth:300,width:"90%"}}>
        <div style={{fontSize:8,color:"#EF444466",fontFamily:"'Orbitron',monospace",letterSpacing:"0.4em",marginBottom:16}}>[ SYSTÈME ] CONTRE-ATTAQUE</div>
        <div style={{display:"flex",justifyContent:"center",marginBottom:14,animation:"bossCounter 0.5s ease"}}>
          <BossSVG bossId={boss.id} color="#EF4444" size={80} isShaking={phase===1}/>
        </div>
        {phase>=1&&<div style={{fontSize:17,fontFamily:"'Orbitron',monospace",fontWeight:900,color:"#EF4444",marginBottom:6,animation:"bossCounter 0.4s ease"}}>
          {boss.name.toUpperCase()} ATTAQUE !
        </div>}
        {phase>=1&&<div style={{fontSize:11,color:"#7BA7CC",fontFamily:"'Rajdhani',sans-serif",lineHeight:1.7,marginBottom:16,fontStyle:"italic",animation:"fadeIn 0.4s ease"}}>
          "{boss.atkMsg?.[0]||"Tu faiblis, Chasseur."}"
        </div>}
        {phase>=2&&(
          <div style={{background:"rgba(239,68,68,0.06)",border:"1px solid rgba(239,68,68,0.2)",borderRadius:14,padding:"14px",marginBottom:18,animation:"bossCounter 0.4s ease"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <span style={{fontSize:11,color:"#A0C0E0",fontFamily:"'Rajdhani',sans-serif"}}>Gold volé par le boss</span>
              <span style={{fontSize:17,fontFamily:"'Orbitron',monospace",fontWeight:900,color:"#EF4444"}}>-{goldLost} 💰</span>
            </div>
          </div>
        )}
        {phase>=2&&<button onClick={onClose} style={{width:"100%",padding:"12px",background:"rgba(239,68,68,0.1)",border:"1px solid #EF4444",borderRadius:12,cursor:"pointer",fontSize:12,fontFamily:"'Orbitron',monospace",fontWeight:700,color:"#EF4444",letterSpacing:"0.1em",animation:"slideUp 0.3s ease"}}>
          ENCAISSER ›
        </button>}
      </div>
    </div>
  );
}

// ── AWAKEN ATTACK ─────────────────────────────────────────
function AwakenAttack({streak,onAttack,used}) {
  const unlocked=streak>=7;
  if(!unlocked) return (
    <div style={{background:"rgba(0,0,0,0.5)",border:"1px solid rgba(255,215,0,0.06)",borderRadius:12,padding:"9px 12px",marginBottom:8,opacity:0.3}}>
      <div style={{display:"flex",alignItems:"center",gap:8}}>
        <span style={{fontSize:19}}>🔒</span>
        <div style={{flex:1}}>
          <div style={{fontSize:11,fontFamily:"'Orbitron',monospace",color:"#8BADD4",fontWeight:700}}>FORME ÉVEILLÉE</div>
          <div style={{fontSize:8,color:"#1A1A2A",fontFamily:"monospace"}}>Streak 7j requis · actuellement {streak}j</div>
        </div>
        <div style={{fontSize:9,fontFamily:"'Orbitron',monospace",color:"#8BADD4"}}>×3 DMG</div>
      </div>
    </div>
  );
  return (
    <button onClick={()=>!used&&onAttack()} disabled={used}
      style={{width:"100%",marginBottom:8,padding:"11px 12px",background:used?"rgba(0,0,0,0.4)":"rgba(255,215,0,0.06)",border:`2px solid ${used?"rgba(255,215,0,0.08)":"#FFD700"}`,borderRadius:12,cursor:used?"default":"pointer",display:"flex",alignItems:"center",gap:10,opacity:used?0.35:1,position:"relative",overflow:"hidden",textAlign:"left"}}>
      {!used&&<div style={{position:"absolute",inset:0,background:"radial-gradient(ellipse at 50% 50%,rgba(255,215,0,0.05) 0%,transparent 70%)",animation:"auraB 2s ease-in-out infinite"}}/>}
      <span style={{fontSize:23,animation:used?"none":"awakenPulse 2s ease-in-out infinite",flexShrink:0}}>⚡</span>
      <div style={{flex:1}}>
        <div style={{fontSize:12,fontFamily:"'Orbitron',monospace",fontWeight:900,color:used?"#444":"#FFD700",letterSpacing:"0.05em"}}>FORME ÉVEILLÉE</div>
        <div style={{fontSize:8,color:used?"#1A1A2A":"#6A5A20",fontFamily:"monospace"}}>{used?"Utilisée aujourd'hui":"Streak "+streak+"j · Une fois par jour"}</div>
      </div>
      <div style={{flexShrink:0,textAlign:"right"}}>
        <div style={{fontSize:15,fontFamily:"'Orbitron',monospace",fontWeight:900,color:used?"#444":"#FFD700"}}>×3</div>
        <div style={{fontSize:7,color:"#8BADD4",fontFamily:"monospace"}}>DMG</div>
      </div>
    </button>
  );
}

// ── BILAN FIN DE JOURNÉE ──────────────────────────────────
function BilanScreen({quests,done,totalXp,streak,boss,bossWon,onClose}) {
  const pct=done.length/Math.max(quests.length,1);
  const grade=pct>=1?"S":pct>=0.8?"A":pct>=0.6?"B":pct>=0.4?"C":pct>=0.2?"D":"F";
  const gradeColor={S:"#FFD700",A:"#A855F7",B:"#39FF14",C:"#60A5FA",D:"#F59E0B",F:"#EF4444"}[grade];
  const msgs={
    S:["Parfait. Le Système t'observe avec respect.","Sung Jin-Woo lui-même ne pourrait mieux faire.","La discipline absolue. Tu es inarrêtable."],
    A:["Presque parfait. Demain, vise le S.","Excellente journée. Une quête de plus et c'était parfait.","Tu progresses à une vitesse remarquable."],
    B:["Bonne journée. Mais tu peux mieux faire.","Correct. Les grands chasseurs ne se satisfont pas du B.","Continue. La constance forge les légendes."],
    C:["Moyen. Tu sais ce que tu dois faire demain.","La moitié accomplie, l'autre attendait.","Demain, repars plus fort."],
    D:["Peu de choses accomplies aujourd'hui.","Le Système a remarqué ton absence.","Un chasseur ne baisse pas les bras deux jours de suite."],
    F:["Rien. Le boss reprend des forces.","L'inaction est un choix aussi — mais pas le tien.","Demain est une nouvelle porte. Traverse-la."],
  };
  const msg=msgs[grade][Math.floor(Math.random()*3)];
  const xpToday=done.reduce((x,id)=>{const q=quests.find(q=>q.id===id);return x+(q?.xp||0);},0);
  return (
    <div style={{position:"fixed",inset:0,zIndex:9400,background:"rgba(0,0,0,0.97)",display:"flex",alignItems:"center",justifyContent:"center"}}>
      <div style={{maxWidth:300,width:"90%",textAlign:"center",animation:"bilanReveal 0.5s ease"}}>
        <div style={{fontSize:8,color:"#33334A",fontFamily:"'Orbitron',monospace",letterSpacing:"0.4em",marginBottom:18}}>[ SYSTÈME ] RAPPORT DE MISSION</div>
        <div style={{width:88,height:88,borderRadius:20,background:`${gradeColor}12`,border:`3px solid ${gradeColor}`,display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 14px",boxShadow:`0 0 30px ${gradeColor}44`}}>
          <span style={{fontSize:47,fontFamily:"'Orbitron',monospace",fontWeight:900,color:gradeColor,textShadow:`0 0 20px ${gradeColor}`}}>{grade}</span>
        </div>
        <div style={{fontSize:11,color:"#8BADD4",fontFamily:"monospace",fontStyle:"italic",marginBottom:18,lineHeight:1.7}}>"{msg}"</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:7,marginBottom:16}}>
          {[{l:"QUÊTES",v:`${done.length}/${quests.length}`,c:gradeColor},{l:"XP GAGNÉ",v:`+${xpToday}`,c:"#A855F7"},{l:"STREAK",v:`${streak}🔥`,c:"#EF4444"}].map(k=>(
            <div key={k.l} style={{background:"rgba(0,0,0,0.6)",border:`1px solid ${k.c}22`,borderRadius:10,padding:"8px 6px"}}>
              <div style={{fontSize:13,fontFamily:"'Orbitron',monospace",fontWeight:700,color:k.c}}>{k.v}</div>
              <div style={{fontSize:7,color:"#8BADD4",fontFamily:"monospace",marginTop:2}}>{k.l}</div>
            </div>
          ))}
        </div>
        <div style={{background:bossWon?"rgba(57,255,20,0.04)":"rgba(239,68,68,0.03)",border:`1px solid ${bossWon?"rgba(57,255,20,0.12)":"rgba(239,68,68,0.08)"}`,borderRadius:12,padding:"9px 12px",marginBottom:16,display:"flex",alignItems:"center",gap:9}}>
          <BossSVG bossId={boss.id} color={bossWon?"#39FF14":boss.color} size={32} isDead={bossWon}/>
          <div style={{textAlign:"left"}}>
            <div style={{fontSize:11,fontFamily:"'Orbitron',monospace",fontWeight:700,color:bossWon?"#39FF14":"#EF4444"}}>{boss.name} — {bossWon?"VAINCU":"EN VIE"}</div>
            <div style={{fontSize:9,color:"#8BADD4",fontFamily:"monospace"}}>{bossWon?"Boss éliminé. Bravo, Chasseur.":"Reviens demain pour l'affronter."}</div>
          </div>
        </div>
        <button onClick={onClose} style={{width:"100%",padding:"12px",background:`${gradeColor}12`,border:`1px solid ${gradeColor}`,borderRadius:12,cursor:"pointer",fontSize:13,fontFamily:"'Orbitron',monospace",fontWeight:700,color:gradeColor,letterSpacing:"0.1em"}}>
          FERMER LE RAPPORT ›
        </button>
      </div>
    </div>
  );
}

// ── CALENDAR ──────────────────────────────────────────────
function CalendarView({history,quests}) {
  const now=new Date();
  const [viewMonth,setViewMonth]=useState(now.getMonth());
  const [viewYear,setViewYear]=useState(now.getFullYear());
  const daysInMonth=new Date(viewYear,viewMonth+1,0).getDate();
  const firstDay=new Date(viewYear,viewMonth,1).getDay();
  const totalQ=quests.length||1;
  const monthNames=["Janvier","Février","Mars","Avril","Mai","Juin","Juillet","Août","Septembre","Octobre","Novembre","Décembre"];
  const getColor=pct=>{if(pct===0)return"rgba(56,139,255,0.15)";if(pct<0.4)return"rgba(239,68,68,0.4)";if(pct<0.7)return"rgba(245,158,11,0.5)";if(pct<1)return"rgba(96,165,250,0.55)";return"rgba(57,255,20,0.7)";};
  const cells=[];
  const offset=firstDay===0?6:firstDay-1; // Monday-first grid
  for(let i=0;i<offset;i++)cells.push(null);
  for(let d=1;d<=daysInMonth;d++){
    const k=`${viewYear}-${String(viewMonth+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
    const done=(history[k]||[]).length;
    cells.push({d,k,done,pct:done/totalQ,isToday:k===now.toISOString().slice(0,10)});
  }
  const totalActive=cells.filter(c=>c&&c.done>0).length;
  const totalPerfect=cells.filter(c=>c&&c.pct>=1).length;
  return (
    <div style={{background:"rgba(0,0,0,0.7)",border:"1px solid rgba(168,85,247,0.18)",borderRadius:16,padding:"16px",backdropFilter:"blur(8px)"}}>
      {/* Header */}
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
        <button onClick={()=>{if(viewMonth===0){setViewMonth(11);setViewYear(y=>y-1);}else setViewMonth(m=>m-1);}}
          style={{background:"rgba(56,139,255,0.18)",border:"1px solid rgba(255,255,255,0.09)",borderRadius:8,padding:"6px 12px",cursor:"pointer",color:"#A0C0E0",fontSize:17,lineHeight:1}}>‹</button>
        <div style={{textAlign:"center"}}>
          <div style={{fontSize:13,fontFamily:"'Orbitron',monospace",fontWeight:700,color:"#A855F7",letterSpacing:"0.05em"}}>{monthNames[viewMonth]} {viewYear}</div>
          <div style={{fontSize:9,color:"#8BADD4",fontFamily:"monospace",marginTop:2}}>{totalActive} jours actifs · {totalPerfect} parfaits</div>
        </div>
        <button onClick={()=>{if(viewMonth===11){setViewMonth(0);setViewYear(y=>y+1);}else setViewMonth(m=>m+1);}}
          style={{background:"rgba(56,139,255,0.18)",border:"1px solid rgba(255,255,255,0.09)",borderRadius:8,padding:"6px 12px",cursor:"pointer",color:"#A0C0E0",fontSize:17,lineHeight:1}}>›</button>
      </div>
      {/* Day labels */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:3,marginBottom:4}}>
        {["Lun","Mar","Mer","Jeu","Ven","Sam","Dim"].map((d,i)=>(
          <div key={i} style={{textAlign:"center",fontSize:9,color:"#8BADD4",fontFamily:"monospace",padding:"2px 0"}}>{d}</div>
        ))}
      </div>
      {/* Day cells */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:3}}>
        {cells.map((c,i)=>c===null
          ? <div key={i}/>
          : (
            <div key={c.k} style={{
              aspectRatio:"1",borderRadius:6,
              background:getColor(c.pct),
              border:c.isToday?"2px solid #A855F7":"1px solid rgba(56,139,255,0.15)",
              display:"flex",alignItems:"center",justifyContent:"center",
              position:"relative",
              boxShadow:c.isToday?"0 0 8px rgba(168,85,247,0.5)":c.pct>=1?"0 0 5px rgba(57,255,20,0.3)":"none",
            }}>
              <span style={{fontSize:10,color:c.pct>0.05?"rgba(0,0,0,0.8)":"#333",fontFamily:"'Orbitron',monospace",fontWeight:c.isToday?900:500,lineHeight:1}}>{c.d}</span>
              {c.pct>=1&&<div style={{position:"absolute",top:2,right:2,width:4,height:4,borderRadius:"50%",background:"#020B18",opacity:0.5}}/>}
            </div>
          )
        )}
      </div>
      {/* Legend */}
      <div style={{display:"flex",gap:8,marginTop:12,justifyContent:"center",flexWrap:"wrap"}}>
        {[{c:getColor(0),l:"Vide"},{c:getColor(0.3),l:"<40%"},{c:getColor(0.55),l:"<70%"},{c:getColor(0.85),l:"<100%"},{c:getColor(1),l:"100% ✦"}].map(({c,l})=>(
          <div key={l} style={{display:"flex",alignItems:"center",gap:4}}>
            <div style={{width:10,height:10,borderRadius:3,background:c,flexShrink:0}}/>
            <span style={{fontSize:9,color:"#8BADD4",fontFamily:"monospace"}}>{l}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── ENRICHED STATS TAB ────────────────────────────────────
function StatsTab({history,quests,totalXp,streak,gold,defeatedBosses}) {
  const last7=Array.from({length:7},(_,i)=>{const d=new Date();d.setDate(d.getDate()-i);const k=d.toISOString().slice(0,10);const ids=history[k]||[];const xp=ids.reduce((s,id)=>{const q=quests.find(q=>q.id===id);return s+(q?.xp||0);},0);return{k,xp,done:ids.length,day:d.toLocaleDateString("fr-FR",{weekday:"short"}),full:ids.length===quests.length&&quests.length>0};}).reverse();
  const maxXp=Math.max(...last7.map(d=>d.xp),1);
  const sectionColors={AUBE:"#00F5FF",JOUR:"#FF8C00",MIDI:"#A855F7",SOIR:"#FF3864"};
  const allDone=Object.values(history).flat();
  const totalDays=Math.max(Object.keys(history).filter(k=>(history[k]||[]).length>0).length,1);
  const sectionStats=["AUBE","JOUR","MIDI","SOIR"].map(sec=>{
    const sq=quests.filter(q=>q.section===sec);
    const possible=sq.length*totalDays;
    const done=sq.reduce((n,q)=>n+(allDone.filter(id=>id===q.id).length),0);
    return{sec,pct:possible>0?Math.min(1,done/possible):0,color:sectionColors[sec]};
  });
  const dayStats=[1,2,3,4,5,6,0].map(day=>{
    const dayDates=Object.keys(history).filter(k=>new Date(k+"T12:00:00").getDay()===day);
    const rates=dayDates.map(k=>(history[k]||[]).length/Math.max(quests.length,1));
    return{day:["Dim","Lun","Mar","Mer","Jeu","Ven","Sam"][day],rate:rates.length?rates.reduce((a,b)=>a+b,0)/rates.length:0};
  });
  const bestDayIdx=dayStats.reduce((bi,d,i)=>d.rate>dayStats[bi].rate?i:bi,0);
  return (
    <div style={{padding:"13px 12px 80px"}}>
      <div style={{background:"rgba(0,0,0,0.7)",border:"1px solid rgba(168,85,247,0.14)",borderRadius:14,padding:"13px",marginBottom:12,backdropFilter:"blur(8px)"}}>
        <div style={{fontSize:8,color:"#A855F7",fontFamily:"'Orbitron',monospace",letterSpacing:"0.18em",marginBottom:11}}>7 DERNIERS JOURS</div>
        <div style={{display:"flex",alignItems:"flex-end",gap:4,height:65,marginBottom:7}}>
          {last7.map(d=>{const h=Math.max(4,(d.xp/maxXp)*55);return(
            <div key={d.k} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:2}}>
              <div style={{fontSize:8,color:d.full?"#39FF14":d.xp>0?"#FFD700":"#1A1A2A",fontFamily:"monospace"}}>{d.xp||""}</div>
              <div style={{width:"100%",height:d.xp>0?h:4,borderRadius:"3px 3px 0 0",background:d.full?"linear-gradient(0deg,#39FF14,#39FF1455)":d.xp>0?"linear-gradient(0deg,#A855F7,#A855F744)":"rgba(10,20,50,0.5)",transition:"height 0.5s ease"}}/>
            </div>
          );})}
        </div>
        <div style={{display:"flex",gap:4}}>{last7.map((d,i)=><div key={d.k} style={{flex:1,textAlign:"center",fontSize:7,color:i===6?"#A855F7":"#111",fontFamily:"monospace"}}>{d.day}</div>)}</div>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:7,marginBottom:12}}>
        {[{l:"XP TOTAL",v:totalXp.toLocaleString(),c:"#FFD700"},{l:"STREAK",v:`${streak}🔥`,c:"#EF4444"},{l:"JOURS ACTIFS",v:totalDays,c:"#39FF14"},{l:"GOLD",v:`💰 ${gold}`,c:"#F59E0B"},{l:"BOSS VAINCUS",v:defeatedBosses.length,c:"#A855F7"},{l:"QUÊTES",v:quests.length,c:"#60A5FA"}].map(k=>(
          <div key={k.l} style={{background:"rgba(0,0,0,0.65)",border:`1px solid ${k.c}18`,borderRadius:11,padding:"9px 11px",backdropFilter:"blur(6px)"}}>
            <div style={{fontSize:7,color:"#111",fontFamily:"'Orbitron',monospace",letterSpacing:"0.08em",marginBottom:2}}>{k.l}</div>
            <div style={{fontSize:18,fontFamily:"'Orbitron',monospace",fontWeight:700,color:k.c}}>{k.v}</div>
          </div>
        ))}
      </div>
      <div style={{background:"rgba(0,0,0,0.7)",border:"1px solid rgba(56,139,255,0.25)",boxShadow:"0 0 12px rgba(56,139,255,0.08)",borderRadius:14,padding:"13px",marginBottom:12,backdropFilter:"blur(8px)"}}>
        <div style={{fontSize:8,color:"#7BA7CC",fontFamily:"'Orbitron',monospace",letterSpacing:"0.18em",marginBottom:10}}>PERFORMANCE PAR SECTION</div>
        {sectionStats.map(({sec,pct,color})=>(
          <div key={sec} style={{marginBottom:8}}>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}>
              <span style={{fontSize:10,fontFamily:"'Orbitron',monospace",color}}>{sec}</span>
              <span style={{fontSize:10,fontFamily:"'Orbitron',monospace",color,fontWeight:700}}>{Math.round(pct*100)}%</span>
            </div>
            <Bar v={pct*100} max={100} color={color} h={5}/>
          </div>
        ))}
      </div>
      <div style={{background:"rgba(0,0,0,0.7)",border:"1px solid rgba(56,139,255,0.25)",boxShadow:"0 0 12px rgba(56,139,255,0.08)",borderRadius:14,padding:"13px",marginBottom:12,backdropFilter:"blur(8px)"}}>
        <div style={{fontSize:8,color:"#7BA7CC",fontFamily:"'Orbitron',monospace",letterSpacing:"0.18em",marginBottom:10}}>TAUX PAR JOUR DE SEMAINE</div>
        <div style={{display:"flex",gap:3,alignItems:"flex-end",height:50}}>
          {dayStats.map(({day,rate},i)=>{
            const h=Math.max(4,rate*44);
            const best=i===bestDayIdx;
            return(
              <div key={day} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:2}}>
                <div style={{width:"100%",height:h,borderRadius:"3px 3px 0 0",background:best?"linear-gradient(0deg,#FFD700,#FFD70044)":"linear-gradient(0deg,#A855F766,#A855F722)",transition:"height 0.5s ease"}}/>
                <div style={{fontSize:7,color:best?"#FFD700":"#111",fontFamily:"monospace"}}>{day}</div>
              </div>
            );
          })}
        </div>
      </div>
      <div style={{marginBottom:12}}>
        <div style={{fontSize:8,color:"#7BA7CC",fontFamily:"'Orbitron',monospace",letterSpacing:"0.18em",marginBottom:8}}>CALENDRIER DE PROGRESSION</div>
        <CalendarView history={history} quests={quests}/>
      </div>
      <div style={{fontSize:8,color:"#8BADD4",fontFamily:"'Orbitron',monospace",letterSpacing:"0.15em",marginBottom:8}}>BOSS REGISTRY ({defeatedBosses.length}/{BOSSES.filter(b=>!b.isMonarch).length})</div>
      {BOSSES.filter(b=>!b.isMonarch).map(b=>{const k=defeatedBosses?.includes(b.id);return(
        <div key={b.id} style={{display:"flex",alignItems:"center",gap:10,background:k?"rgba(57,255,20,0.03)":"rgba(0,0,0,0.5)",border:`1px solid ${k?"rgba(57,255,20,0.15)":"rgba(10,20,50,0.5)"}`,borderRadius:10,padding:"7px 10px",marginBottom:5,opacity:k?1:0.3}}>
          <div style={{flexShrink:0}}><BossSVG bossId={b.id} color={k?"#39FF14":b.color} size={30}/></div>
          <div style={{flex:1}}><div style={{fontSize:12,fontFamily:"'Rajdhani',sans-serif",fontWeight:700,color:k?"#39FF14":"#1A1A2A"}}>{b.name}</div><div style={{fontSize:8,color:"#111",fontFamily:"monospace"}}>{b.title}</div></div>
          {k&&<span style={{fontSize:10,color:"#39FF14",fontFamily:"'Orbitron',monospace",fontWeight:700}}>✦</span>}
        </div>
      );})}
    </div>
  );
}

// ── IMPORT / EXPORT ───────────────────────────────────────
function ImportExport({state,onImport,onClose}) {
  const [mode,setMode]=useState("export");
  const [importText,setImportText]=useState("");
  const [err,setErr]=useState("");
  const [copied,setCopied]=useState(false);
  const exportData=JSON.stringify({...state,_arise_version:6,_exported:new Date().toISOString()},null,2);
  const copy=async()=>{try{await navigator.clipboard.writeText(exportData);setCopied(true);setTimeout(()=>setCopied(false),2200);}catch{setErr("Copie échouée — copie manuellement.");}};
  const doImport=()=>{try{const d=JSON.parse(importText);if(!d.quests||!d.history)throw new Error("Format invalide");onImport(d);onClose();}catch(e){setErr("JSON invalide : "+e.message);}};
  return (
    <div style={{position:"fixed",inset:0,zIndex:8500,background:"rgba(0,0,0,0.97)",backdropFilter:"blur(6px)",display:"flex",flexDirection:"column"}}>
      <div style={{display:"flex",alignItems:"center",gap:10,padding:"13px 14px",borderBottom:"1px solid rgba(168,85,247,0.1)",flexShrink:0}}>
        <button onClick={onClose} style={{background:"rgba(56,139,255,0.15)",border:"1px solid rgba(56,139,255,0.25)",borderRadius:8,padding:"6px 10px",cursor:"pointer",fontSize:12,color:"#8BADD4",fontFamily:"'Orbitron',monospace"}}>← RET.</button>
        <div><div style={{fontSize:8,color:"#8BADD4",fontFamily:"'Orbitron',monospace",letterSpacing:"0.2em"}}>DONNÉES</div><div style={{fontSize:14,fontFamily:"'Orbitron',monospace",fontWeight:700,color:"#A855F7"}}>IMPORT / EXPORT</div></div>
      </div>
      <div style={{display:"flex",borderBottom:"1px solid rgba(56,139,255,0.15)",flexShrink:0}}>
        {[{id:"export",label:"📤 EXPORTER"},{id:"import",label:"📥 IMPORTER"}].map(t=>(
          <button key={t.id} onClick={()=>{setMode(t.id);setErr("");}} style={{flex:1,padding:"8px",background:"none",border:"none",cursor:"pointer",fontSize:10,fontFamily:"'Orbitron',monospace",color:mode===t.id?"#A855F7":"#222",borderBottom:mode===t.id?"2px solid #A855F7":"2px solid transparent"}}>{t.label}</button>
        ))}
      </div>
      <div style={{flex:1,overflowY:"auto",padding:"14px"}}>
        {mode==="export"&&(<div>
          <div style={{fontSize:10,color:"#7BA7CC",fontFamily:"'Rajdhani',sans-serif",lineHeight:1.7,marginBottom:12}}>Copie ce JSON pour sauvegarder toutes tes données : quêtes, historique, XP, gold, boss vaincus.</div>
          <textarea readOnly value={exportData} style={{width:"100%",height:200,background:"rgba(0,0,0,0.7)",border:"1px solid rgba(168,85,247,0.2)",borderRadius:10,padding:"10px",color:"#7BA7CC",fontFamily:"monospace",fontSize:9,resize:"none"}}/>
          <button onClick={copy} style={{width:"100%",marginTop:10,padding:"12px",background:copied?"rgba(57,255,20,0.1)":"rgba(168,85,247,0.1)",border:`1px solid ${copied?"#39FF14":"#A855F7"}`,borderRadius:12,cursor:"pointer",fontSize:12,fontFamily:"'Orbitron',monospace",fontWeight:700,color:copied?"#39FF14":"#A855F7"}}>
            {copied?"✓ COPIÉ !":"📋 COPIER LE JSON"}
          </button>
        </div>)}
        {mode==="import"&&(<div>
          <div style={{fontSize:10,color:"#7BA7CC",fontFamily:"'Rajdhani',sans-serif",lineHeight:1.7,marginBottom:12}}>Colle ici un JSON exporté depuis ARISE.<br/><span style={{color:"#EF444466"}}>⚠️ Cela remplacera toutes tes données actuelles.</span></div>
          <textarea value={importText} onChange={e=>setImportText(e.target.value)} placeholder="Colle ton JSON ici..." style={{width:"100%",height:200,background:"rgba(0,0,0,0.7)",border:"1px solid rgba(168,85,247,0.2)",borderRadius:10,padding:"10px",color:"#D0EAFF",fontFamily:"monospace",fontSize:9,resize:"none",userSelect:"text"}}/>
          {err&&<div style={{fontSize:10,color:"#EF4444",marginTop:6,fontFamily:"monospace"}}>{err}</div>}
          <button onClick={doImport} style={{width:"100%",marginTop:10,padding:"12px",background:"rgba(168,85,247,0.1)",border:"1px solid #A855F7",borderRadius:12,cursor:"pointer",fontSize:12,fontFamily:"'Orbitron',monospace",fontWeight:700,color:"#A855F7"}}>
            📥 IMPORTER ET RESTAURER
          </button>
        </div>)}
      </div>
    </div>
  );
}

// ── QUEST SECTION (drag-sortable, pointer-based) ──────────
function QuestSection({sec,sm,nd,sq,done,activeBet,gold,generatedAtkNames,onToggle,onBet,onReorder,rankData,onPomodoro,pomodoroLog}) {
  const [dragIdx,setDragIdx]=useState(null);
  const [overIdx,setOverIdx]=useState(null);
  const pointerRef=useRef({active:false,startY:0,startX:0,idx:null,moved:false,isScroll:false});
  const timerRef=useRef(null);
  const listRef=useRef(null);

  const getCardHeight=()=>{ const cards=listRef.current?.querySelectorAll("[data-cardidx]"); return cards?.[0]?.getBoundingClientRect().height+6||60; };

  // Only the grip handle triggers drag — rest of card is scrollable tap
  const onGripPointerDown=(e,idx)=>{
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    if(navigator.vibrate) navigator.vibrate(25);
    setDragIdx(idx);
    pointerRef.current={active:true,startY:e.clientY,startX:e.clientX,idx,moved:false,isScroll:false};
  };
  const onGripPointerMove=(e)=>{
    if(dragIdx===null) return;
    const list=listRef.current;
    if(!list) return;
    const cardH=getCardHeight();
    const listTop=list.getBoundingClientRect().top;
    const newOver=Math.max(0,Math.min(sq.length-1,Math.floor((e.clientY-listTop)/cardH)));
    setOverIdx(newOver);
  };
  const onGripPointerUp=()=>{
    if(dragIdx!==null){
      if(overIdx!==null&&overIdx!==dragIdx){
        const next=[...sq];
        const [moved]=next.splice(dragIdx,1);
        next.splice(overIdx,0,moved);
        onReorder(next);
      }
      setDragIdx(null);setOverIdx(null);
    }
    pointerRef.current.active=false;
  };

  const SecIconComp=SLIcon[SEC_ICON[sec]];
  return (
    <div style={{marginBottom:13}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:7}}>
        <div style={{display:"flex",alignItems:"center",gap:6}}>
          <div style={{width:2,height:14,background:sm.c,borderRadius:1,boxShadow:`0 0 6px ${sm.c}`}}/>
          {SecIconComp&&<SecIconComp size={15} color={sm.c}/>}
          <span style={{fontSize:9,fontFamily:"'Orbitron',monospace",color:sm.c,letterSpacing:"0.12em",fontWeight:700}}>{sec}</span>
        </div>
        <span style={{fontSize:8,color:nd===sq.length&&sq.length>0?"#39FF14":"#1A1A2A",fontFamily:"monospace",fontWeight:nd===sq.length&&sq.length>0?700:400}}>
          {nd===sq.length&&sq.length>0?"✦ CLEAR":`${nd}/${sq.length}`}
        </span>
      </div>
      <div ref={listRef}>
        {sq.map((q,idx)=>{
          const isDone=done.includes(q.id);
          const rc2=RANKS.find(r=>r.rank===q.rank)||RANKS[0];
          const hasBet=activeBet?.questId===q.id;
          const isDragging=dragIdx===idx;
          const isOver=overIdx===idx&&dragIdx!==null&&dragIdx!==idx;
          return (
            <div key={q.id} data-cardidx={idx}
              style={{marginBottom:6,opacity:isDragging?0.35:1,transform:isOver?"translateY(-4px) scale(1.01)":"none",
                transition:"transform 0.12s,opacity 0.15s",
                borderTop:isOver?`2px solid ${sm.c}`:"2px solid transparent"}}>
              <div
                onClick={()=>{ if(dragIdx===null) onToggle(q.id); }}
                style={{
                  display:"flex",alignItems:"center",gap:9,
                  background:isDone?`linear-gradient(135deg,${q.color}14,${q.color}08)`:hasBet?"rgba(255,215,0,0.04)":isDragging?"rgba(168,85,247,0.06)":"rgba(8,8,12,0.85)",
                  border:`1px solid ${isDone?q.color+"50":hasBet?"rgba(255,215,0,0.3)":isDragging?"rgba(168,85,247,0.4)":"rgba(56,139,255,0.2)"}`,
                  borderRadius:14,padding:"10px 11px",cursor:"pointer",
                  backdropFilter:"blur(12px)",
                  boxShadow:isDone?`0 4px 20px ${q.color}22,inset 0 1px 0 ${q.color}20`:isDragging?"0 8px 24px rgba(168,85,247,0.2)":hasBet?"0 0 12px rgba(255,215,0,0.15)":"0 2px 8px rgba(0,0,0,0.4),inset 0 1px 0 rgba(10,20,50,0.5)",
                  transition:"box-shadow 0.2s,border 0.2s","--qc":q.color,
                  animation:isDone?"questGlow 0.5s ease forwards":"none",
                }}>
                {/* Grip handle — ONLY this part blocks scroll/drag */}
                <div
                  onPointerDown={e=>onGripPointerDown(e,idx)}
                  onPointerMove={onGripPointerMove}
                  onPointerUp={onGripPointerUp}
                  onPointerCancel={()=>{setDragIdx(null);setOverIdx(null);}}
                  onClick={e=>e.stopPropagation()}
                  style={{flexShrink:0,opacity:isDragging?0.9:0.22,transition:"opacity 0.2s",
                    cursor:"grab",touchAction:"none",padding:"4px 2px",margin:"-4px -2px"}}>
                  <SLIcon.grip size={14} color="#fff"/>
                </div>

                {/* Check badge — sceau carré Solo Leveling */}
                <div onClick={e=>{e.stopPropagation();onToggle(q.id);}}
                  style={{
                    width:26,height:26,borderRadius:6,flexShrink:0,
                    background:isDone?q.color:"transparent",
                    border:`1.5px solid ${isDone?q.color:"rgba(255,255,255,0.12)"}`,
                    display:"flex",alignItems:"center",justifyContent:"center",
                    boxShadow:isDone?`0 0 10px ${q.color}88`:"none",
                    transition:"all 0.18s ease",
                    animation:isDone?"questCheck 0.25s ease":"none",
                  }}>
                  {isDone
                    ? <svg width={14} height={14} viewBox="0 0 14 14" style={{display:"block",flexShrink:0}}>
                        <polyline points="2,7 6,11 12,3" fill="none" stroke="#000" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    : <div style={{width:7,height:7,borderRadius:1,border:"1px solid rgba(255,255,255,0.1)"}}/>
                  }
                </div>

                <span style={{fontSize:18,flexShrink:0,filter:isDone?`drop-shadow(0 0 5px ${q.color})`:"none",transition:"filter 0.2s",lineHeight:1}}>{q.emoji}</span>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:14,fontFamily:"'Rajdhani',sans-serif",fontWeight:700,color:isDone?q.color:"#D0D8F0",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{q.name}</div>
                  <div style={{display:"flex",gap:5,marginTop:2,alignItems:"center",flexWrap:"wrap"}}>
                    <span style={{fontSize:8,color:rc2.color,fontFamily:"'Orbitron',monospace",background:`${rc2.color}15`,border:`1px solid ${rc2.color}30`,borderRadius:4,padding:"1px 4px"}}>{q.rank}</span>
                    <span style={{fontSize:8,color:"#2A2A3A",fontFamily:"monospace"}}>⏱ {q.time} · {q.duration}min</span>
                    {hasBet&&<span style={{display:"flex",alignItems:"center",gap:2}}><SLIcon.gold size={11}/><span style={{fontSize:8,color:"#FFD700",fontFamily:"'Orbitron',monospace",fontWeight:700}}>{activeBet.amount}g</span></span>}
                  </div>
                </div>
                <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:3,flexShrink:0}}>
                  <div style={{display:"flex",alignItems:"center",gap:3,background:isDone?`${q.color}18`:"rgba(0,0,0,0.5)",border:`1px solid ${isDone?q.color+"44":"rgba(168,85,247,0.08)"}`,borderRadius:9,padding:"3px 6px"}}>
                    <SLIcon.crystal size={11} color={isDone?q.color:"#2A2A3A"}/>
                    <span style={{fontSize:11,color:isDone?q.color:"#2A2A3A",fontWeight:900,fontFamily:"'Orbitron',monospace"}}>{q.xp}</span>
                  </div>
                  {/* Pomodoro button */}
                  {onPomodoro&&(
                    <button onPointerDown={e=>e.stopPropagation()}
                      onClick={e=>{e.stopPropagation();onPomodoro(q);}}
                      style={{display:"flex",alignItems:"center",gap:2,background:"rgba(239,68,68,0.06)",border:"1px solid rgba(239,68,68,0.15)",borderRadius:6,padding:"2px 6px",cursor:"pointer",fontSize:10}}>
                      ⏱{pomodoroLog?.[q.id]?<span style={{fontSize:7,color:"#EF444488",fontFamily:"monospace"}}>{Math.round((pomodoroLog[q.id]||0)/60)}m</span>:null}
                    </button>
                  )}
                  {!isDone&&!hasBet&&gold>=5&&(
                    <button onPointerDown={e=>e.stopPropagation()}
                      onClick={e=>{e.stopPropagation();onBet(q);}}
                      style={{display:"flex",alignItems:"center",gap:2,background:"rgba(255,215,0,0.04)",border:"1px solid rgba(255,215,0,0.1)",borderRadius:6,padding:"2px 5px",cursor:"pointer"}}>
                      <SLIcon.gold size={11}/>
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function App() {
  const [s,setS]=useState(()=>{try{const v=localStorage.getItem("arise_v13");return v?{...defaultState(),...JSON.parse(v)}:defaultState();}catch{return defaultState();}});
  const [tab,setTab]=useState("quests");
  const [showNotif,setShowNotif]=useState(false);
  const [screenW,setScreenW]=useState(window.innerWidth);
  const isTablet=screenW>=680;
  useEffect(()=>{const h=()=>setScreenW(window.innerWidth);window.addEventListener("resize",h);return()=>window.removeEventListener("resize",h);},[]);
  const [toasts,setToasts]=useState([]);
  const [sysDlg,setSysDlg]=useState(null);
  const [rankUp,setRankUp]=useState(null);
  const [victory,setVictory]=useState(null);
  const [titleReveal,setTitleReveal]=useState(null);
  const [flashXp,setFlashXp]=useState(null);
  const [showMgr,setShowMgr]=useState(false);
  const [showShop,setShowShop]=useState(false);
  const [showBet,setShowBet]=useState(null); // quest object
  const [genLoading,setGenLoading]=useState({});
  const [delConfirm,setDelConfirm]=useState(null);
  // ── Combat v2 ──
  const [turnPhase,setTurnPhase]=useState("player");
  const [playerHp,setPlayerHp]=useState(null);
  const [statusFx,setStatusFx]=useState([]);
  const [lastBossAtk,setLastBossAtk]=useState(null);
  const [lastPlayerAtk,setLastPlayerAtk]=useState(null);
  const [lastHit,setLastHit]=useState(false);
  const [isCrit,setIsCrit]=useState(false);
  const [bossMsg,setBossMsg]=useState(null);
  const [bossDead,setBossDead]=useState(false);
  const [showEntry,setShowEntry]=useState(false);
  const [cooldowns,setCooldowns]=useState({});
  const [penalty,setPenalty]=useState(null);
  const [bossCounter,setBossCounter]=useState(null);
  const [showBilan,setShowBilan]=useState(false);
  const [showImportExport,setShowImportExport]=useState(false);
  const [showReset,setShowReset]=useState(false);
  // ── Pomodoro v2 ──
  const [pomodoroQuest,setPomodoroQuest]=useState(null);
  const [,tick]=useState(0);
  const prevRankRef=useRef(null);
  const prevTitlesRef=useRef([]);
  const lastDungeonDay=useRef(null);
  const snd=useSound(s.soundEnabled);
  const ambience=useBossAmbience();
  const today=todayKey();

  useEffect(()=>{try{localStorage.setItem("arise_v13",JSON.stringify(s));}catch{}},[s]);
  useEffect(()=>{const t=setInterval(()=>tick(p=>p+1),1000);return()=>clearInterval(t);},[]);

  const done=s.history[today]||[];
  const streak=calcStreak(s.history);
  const rawXp=Object.entries(s.history).reduce((sum,[,ids])=>sum+(ids||[]).reduce((x,id)=>{const q=s.quests.find(q=>q.id===id);return x+(q?.xp||0);},0),0);
  const totalXp=rawXp+s.bonusXp;
  const activeDays=Object.keys(s.history).filter(k=>(s.history[k]||[]).length>0).length;
  // Rang S lock: show "true" rank but gate S behind conditions
  const rawRankData=getRankData(totalXp);
  const sConditions=checkSConditions(s,totalXp,streak,activeDays);
  // If XP >= S threshold but conditions not met, display as A-locked
  const rankData = rawRankData.rank==="S" && !sConditions.all
    ? {...getRankData(34999), rank:"A✦", isLockedS:true}
    : rawRankData;
  const xpToday=done.reduce((x,id)=>{const q=s.quests.find(q=>q.id===id);return x+(q?.xp||0);},0);
  const maxXpDay=s.quests.reduce((x,q)=>x+q.xp,0)||1;
  const todayBoss=getDailyBoss(today,rankData.rank);
  const todaySecret=getDailySecret(today);
  const bossHp=s.bossHpMap[today]??todayBoss.maxHp;
  const bossWon=!!s.wonToday[today];
  const attacks=s.quests.filter(q=>done.includes(q.id));

  // Weekly
  const wk=weekKey();
  const curWeeklyQuests=getWeeklyQuests(wk);
  const weekDone=s.weeklyProgress[wk]||{};

  // Monthly Antares
  const mk=monthKey();
  const antaresHp=s.antaresMonth===mk?s.antaresHp:1500;
  const antaresHitKey="arise_v13_antares_"+today;
  const antaresHitToday=!!localStorage.getItem(antaresHitKey);

  const toggleWeekly=useCallback(qid=>{
    setS(p=>{
      const cur=p.weeklyProgress[wk]||{};
      const wasDone=!!cur[qid];
      const q=curWeeklyQuests.find(q=>q.id===qid);
      if(!q) return p;
      const nd={...cur,[qid]:!wasDone};
      if(!wasDone){
        snd.quest();
        const goldGained=q.gold||50;
        return{...p,weeklyProgress:{...p.weeklyProgress,[wk]:nd},bonusXp:p.bonusXp+q.xp,gold:p.gold+goldGained};
      }
      return{...p,weeklyProgress:{...p.weeklyProgress,[wk]:nd}};
    });
  },[wk,curWeeklyQuests]);

  const hitAntares=useCallback(()=>{
    if(antaresHitToday||antaresHp<=0) return;
    localStorage.setItem(antaresHitKey,"1");
    const dmg=50;
    const newHp=Math.max(0,antaresHp-dmg);
    const won=newHp<=0;
    setS(p=>({...p,antaresHp:newHp,antaresMonth:mk,...(won?{defeatedBosses:p.defeatedBosses.includes("antares")?p.defeatedBosses:[...p.defeatedBosses,"antares"]}:{})}));
    if(won){setTimeout(()=>toast({icon:"👑",title:"ANTARES VAINCU !",desc:"Roi des Démons abattu. Victoire mensuelle.",color:"#C026D3"}),400);}
    else toast({icon:"⚡",title:`-${dmg} PV sur Antares`,desc:`${newHp} PV restants.`,color:"#C026D3"});
  },[antaresHitToday,antaresHp,mk]);

  const placeBet=useCallback(amount=>{
    if(!showBet) return;
    setS(p=>({...p,activeBet:{questId:showBet.id,amount,multiplier:2}}));
    setShowBet(null);
    toast({icon:"💰",title:`Mise de ${amount}g`,desc:"Accomplis la quête pour doubler la mise !",color:"#FFD700"});
  },[showBet]);

  const genAtkName=useCallback(async(q)=>{
    if(s.generatedAtkNames?.[q.id]||genLoading[q.id]) return;
    setGenLoading(p=>({...p,[q.id]:true}));
    const name=await generateAtkName(q.name,q.emoji);
    if(name) setS(p=>({...p,generatedAtkNames:{...p.generatedAtkNames,[q.id]:name}}));
    setGenLoading(p=>({...p,[q.id]:false}));
  },[s.generatedAtkNames,genLoading]);

  // Rank-up detection
  useEffect(()=>{
    if(prevRankRef.current&&rankData.rank!==prevRankRef.current){
      if(rankData.isLockedS){
        toast({icon:"🔒",title:"RANG S — CONDITIONS REQUISES",desc:"Consulte ton profil pour débloquer le Monarque.",color:"#A855F7"});
      } else {
        setRankUp(rankData);snd.rankUp();
      }
    }
    prevRankRef.current=rankData.rank;
  },[rankData.rank]);

  // Boss ambience — play when dungeon tab active
  useEffect(()=>{
    if(tab==="dungeon"&&s.soundEnabled){
      ambience.play(todayBoss.id,s.soundEnabled);
    } else {
      ambience.stop();
    }
    return()=>{ if(tab!=="dungeon") ambience.stop(); };
  },[tab,todayBoss.id,s.soundEnabled]);

  // Title unlock detection
  useEffect(()=>{
    const st={...s,streak};
    const nowU=TITLES.filter(t=>t.cond(st,totalXp,streak)).map(t=>t.id);
    const newOnes=nowU.filter(id=>!prevTitlesRef.current.includes(id));
    if(newOnes.length){const t=TITLES.find(t=>t.id===newOnes[0]);if(t)setTimeout(()=>{setTitleReveal(t);snd.title();},500);}
    prevTitlesRef.current=nowU;
  },[totalXp,streak,s.defeatedBosses]);

  // Morning dialog
  useEffect(()=>{
    const h=new Date().getHours(),k="arise_v13_dlg_"+today;
    if(!localStorage.getItem(k)&&s.onboarded){
      const msg=h<12?MORNING_MSGS[dseed(today)%MORNING_MSGS.length]:"La journée touche à sa fin. Qu'as-tu accompli?";
      setTimeout(()=>setSysDlg({title:h<12?"NOUVEAU JOUR":"BILAN DU SOIR",body:msg,btn:h<12?"Commencer":"Voir mon bilan",color:"#A855F7"}),700);
      localStorage.setItem(k,"1");
    }
  },[s.onboarded]);

  // Penalty detection: check if yesterday was incomplete
  useEffect(()=>{
    if(!s.onboarded) return;
    const yesterday=new Date(); yesterday.setDate(yesterday.getDate()-1);
    const yKey=yesterday.toISOString().slice(0,10);
    const penaltyKey="arise_v13_penalty_"+yKey;
    if(localStorage.getItem(penaltyKey)) return;
    const ydone=(s.history[yKey]||[]).length;
    const total=s.quests.length;
    if(total>0 && ydone<total && ydone>=0 && Object.keys(s.history).length>0){
      localStorage.setItem(penaltyKey,"1");
      const missed=total-ydone;
      const goldLost=Math.min(s.gold, missed*PENALTY_GOLD_PER_MISS);
      const bossRegen=Math.round(todayBoss.maxHp*PENALTY_BOSS_REGEN);
      const streakLost=streak>0 && !s.streakShield;
      if(goldLost>0||streakLost||bossRegen>0){
        setTimeout(()=>{
          setPenalty({missed,goldLost,streakLost,bossRegen});
          setS(p=>{
            const newGold=Math.max(0,p.gold-goldLost);
            const curHp=p.bossHpMap[today]??todayBoss.maxHp;
            const newHp=Math.min(todayBoss.maxHp,curHp+bossRegen);
            return {...p,gold:newGold,bossHpMap:{...p.bossHpMap,[today]:newHp},streakShield:false};
          });
        },1200);
      }
    }
  },[s.onboarded]);

  // Boost helpers
  const now=Date.now();
  const hasBoost=id=>(s.activeBoosts||{})[id]>now;
  const xpMultiplier=hasBoost("xp2")?2:1;
  const goldMultiplier=hasBoost("goldMult")?1.5:1;

  // Boss counter-attack: triggers once per day if <50% quests done after entering dungeon
  const bossCounterKey="arise_v13_counter_"+today;
  const checkBossCounter=useCallback(()=>{
    if(localStorage.getItem(bossCounterKey)) return;
    if(bossWon) return;
    const pct=done.length/Math.max(s.quests.length,1);
    if(pct<0.5 && s.quests.length>0 && done.length>=0){
      localStorage.setItem(bossCounterKey,"1");
      const goldLost=Math.min(s.gold, 12+Math.floor(Math.random()*8));
      setBossCounter({goldLost});
      setS(p=>({...p,gold:Math.max(0,p.gold-goldLost)}));
    }
  },[today,done,bossWon,s.quests,s.gold]);

  // Awaken attack tracking (per day)
  const awakenKey="arise_v13_awaken_"+today;
  const awakenUsedToday=!!localStorage.getItem(awakenKey);
  const doAwakenAttack=useCallback(()=>{
    if(bossWon||bossHp<=0||awakenUsedToday)return;
    localStorage.setItem(awakenKey,"1");
    const dmg=Math.round(attacks.reduce((max,a)=>Math.max(max,a.dmg),20)*3*(0.9+Math.random()*0.2));
    snd.crit();setTimeout(()=>snd.kill(),300);
    setLastHit(true);setIsCrit(true);setTimeout(()=>{setLastHit(false);setIsCrit(false);},900);
    const pid=Date.now();
    setParticles(p=>[...p,{id:pid,dmg,x:25+Math.random()*50,y:10+Math.random()*30,crit:true,combo:true}]);
    setTimeout(()=>setParticles(p=>p.filter(x=>x.id!==pid)),1200);
    setFlashXp({xp:dmg,color:"#FFD700"});setTimeout(()=>setFlashXp(null),1200);
    toast({icon:"⚡",title:"FORME ÉVEILLÉE !",desc:`Dégâts ×3 — ${dmg} infligés !`,color:"#FFD700"});
    setS(p=>{
      const newHp=Math.max(0,(p.bossHpMap[today]??todayBoss.maxHp)-dmg);
      const won=newHp<=0&&!p.wonToday[today];
      if(won){setTimeout(()=>{setBossDead(true);snd.kill();setTimeout(()=>{setBossDead(false);setVictory({boss:todayBoss,gold:(todayBoss.maxHp/2)|0,xp:todayBoss.maxHp});},1100);},600);}
      return{...p,bossHpMap:{...p.bossHpMap,[today]:newHp},...(won?{wonToday:{...p.wonToday,[today]:true},defeatedBosses:p.defeatedBosses.includes(todayBoss.id)?p.defeatedBosses:[...p.defeatedBosses,todayBoss.id]}:{})};
    });
  },[bossWon,bossHp,awakenUsedToday,attacks,today,todayBoss]);

  const toast=t=>{const id=Date.now();setToasts(p=>[...p,{...t,id}]);setTimeout(()=>setToasts(p=>p.filter(x=>x.id!==id)),3600);};

  const reorderQuests=useCallback(newList=>{
    setS(p=>({...p,quests:newList}));
  },[]);

  const toggleQuest=useCallback(id=>{
    const q=s.quests.find(q=>q.id===id);if(!q)return;
    setS(p=>{
      const cur=p.history[today]||[];
      if(cur.includes(id)){
        // Unchecking — lose bet if active
        if(p.activeBet?.questId===id){
          const lost=p.activeBet.amount;
          setTimeout(()=>toast({icon:"💸",title:`Mise perdue : -${lost}g`,desc:"Tu as décoché la quête.",color:"#EF4444"}),50);
          return{...p,history:{...p.history,[today]:cur.filter(i=>i!==id)},gold:Math.max(0,p.gold-lost),activeBet:null};
        }
        return{...p,history:{...p.history,[today]:cur.filter(i=>i!==id)}};
      }
      snd.quest();
      const xpBoost=(p.activeBoosts?.xp2||0)>Date.now()?2:1;
      const gBoost=(p.activeBoosts?.goldMult||0)>Date.now()?1.5:1;
      const strk=streak; // captured from outer scope
      const strkMult=streakMultiplier(strk);
      const xpGained=Math.round(q.xp*xpBoost*strkMult);
      let goldGained=Math.max(1,Math.round((q.xp/5)*gBoost));
      // Resolve bet
      let newBet=p.activeBet;
      if(p.activeBet?.questId===id){
        const won=p.activeBet.amount*2;
        goldGained+=won;
        newBet=null;
        setTimeout(()=>toast({icon:"💰",title:`Mise gagnée +${won}g !`,desc:"Double mise réussie.",color:"#FFD700"}),100);
      }
      const multLabel=strkMult>1?` ×${strkMult.toFixed(1)}`:"";
      setFlashXp({xp:xpGained,color:q.color,label:`+${xpGained} XP${multLabel}`});setTimeout(()=>setFlashXp(null),1400);
      const nd=[...cur,id];
      if(nd.length===p.quests.length)toast({icon:"🏰",title:"DONJON DÉBLOQUÉ !",desc:"Affronte le boss maintenant.",color:"#39FF14"});
      // Show streak mult toast when newly activated
      if(strkMult>1&&cur.length===0&&strk>0){
        setTimeout(()=>toast({icon:"🔥",title:`Streak ×${strkMult.toFixed(1)}`,desc:`${strk} jours consécutifs → XP boostée`,color:"#EF4444"}),300);
      }
      // Auto-gen attack name if not done
      if(!p.generatedAtkNames?.[id]) setTimeout(()=>genAtkName(q),200);
      return{...p,history:{...p.history,[today]:nd},bonusXp:p.bonusXp+(xpGained-q.xp),gold:p.gold+goldGained,activeBet:newBet};
    });
  },[today,s.quests,genAtkName,streak]);

  const toggleSecret=useCallback(()=>{
    if(!todaySecret)return;
    setS(p=>({...p,secretsDone:{...p.secretsDone,[today]:!p.secretsDone[today]}}));
    if(!s.secretsDone[today]){snd.quest();setFlashXp({xp:todaySecret.xp,color:"#A855F7"});setTimeout(()=>setFlashXp(null),1200);}
  },[today,todaySecret,s.secretsDone]);

  // ── PLAYER MAX HP by rank ──
  const PLAYER_MAX_HP = 80 + RANKS.findIndex(r=>r.rank===rankData.rank)*20;

  // Init/reset player HP on new day
  useEffect(()=>{
    if(lastDungeonDay.current!==today){
      lastDungeonDay.current=today;
      setPlayerHp(PLAYER_MAX_HP);
      setStatusFx([]);
      setLastBossAtk(null);
      setLastPlayerAtk(null);
      setTurnPhase("player");
    } else if(playerHp===null){
      setPlayerHp(PLAYER_MAX_HP);
    }
  },[today, PLAYER_MAX_HP]);

  // ── TURN-BASED COMBAT ────────────────────────────────────
  const doAttack=useCallback(atk=>{
    if(bossWon||bossHp<=0||turnPhase!=="player") return;
    // 1) Player hits boss
    const crit=Math.random()<0.15;
    const variance=0.85+Math.random()*0.3;
    const dynBase=questDamage(atk,streak);
    const dmg=Math.round((crit?dynBase*1.8:dynBase)*variance);
    const fx=ATK_FX[atk.rank]||ATK_FX.E;
    const fxApplied=fx.type!=="none"&&Math.random()<0.4;
    crit?snd.crit():snd.slash();
    setTimeout(()=>snd.hit(),80);
    setLastHit(true); setIsCrit(crit);
    setTimeout(()=>{setLastHit(false);setIsCrit(false);},600);
    setLastPlayerAtk({name:atk.atkName||atk.name, dmg, crit, fxTag:fxApplied?fx.tag:"", fxCol:fx.col});
    setFlashXp({xp:dmg,color:crit?"#FFD700":"#EF4444"});
    setTimeout(()=>setFlashXp(null),900);
    if(fxApplied) setStatusFx(prev=>[...prev.filter(e=>e.type!==fx.type),{...fx,turns:2}]);
    setTurnPhase("boss_anim");

    setS(p=>{
      const newHp=Math.max(0,(p.bossHpMap[today]??todayBoss.maxHp)-dmg);
      if(newHp<=0&&!p.wonToday[today]){
        setTimeout(()=>{setBossDead(true);snd.kill();
          setTimeout(()=>{setBossDead(false);setVictory({boss:todayBoss,gold:(todayBoss.maxHp/2)|0,xp:todayBoss.maxHp});},1100);
        },400);
        return{...p,bossHpMap:{...p.bossHpMap,[today]:0},wonToday:{...p.wonToday,[today]:true},
          defeatedBosses:p.defeatedBosses.includes(todayBoss.id)?p.defeatedBosses:[...p.defeatedBosses,todayBoss.id]};
      }
      return{...p,bossHpMap:{...p.bossHpMap,[today]:newHp}};
    });

    // 2) Boss counter-attacks after animation delay
    setTimeout(()=>{
      if(bossHp-dmg>0&&!bossWon){
        const bAtk=pickBossAtk(todayBoss.id);
        const stunned=statusFx.some(e=>e.type==="stun");
        const shielded=statusFx.some(e=>e.type==="shield");
        let bDmg=stunned?0:Math.round(bAtk.dmg*(0.75+Math.random()*0.5));
        if(shielded) bDmg=Math.round(bDmg*0.5);
        setLastBossAtk({...bAtk,dmg:bDmg,skipped:stunned});
        if(bDmg>0){
          snd.hit();
          setPlayerHp(cur=>{
            const next=Math.max(0,(cur??PLAYER_MAX_HP)-bDmg);
            if(next<=0){
              // Player defeated — boss heals a bit, player respawns
              setTimeout(()=>toast({icon:"💀",title:"Tu es tombé au combat !",desc:"Le boss récupère 15% de PV. Tu te relèves.",color:"#EF4444"}),100);
              setS(p=>{
                const regen=Math.round(todayBoss.maxHp*0.15);
                return{...p,bossHpMap:{...p.bossHpMap,[today]:Math.min(todayBoss.maxHp,(p.bossHpMap[today]??todayBoss.maxHp)+regen)}};
              });
              return PLAYER_MAX_HP;
            }
            return next;
          });
        }
        setStatusFx(prev=>prev.map(e=>({...e,turns:e.turns-1})).filter(e=>e.turns>0));
      }
      setTurnPhase("player");
    },1600);
  },[today,todayBoss,bossHp,bossWon,turnPhase,streak,statusFx,PLAYER_MAX_HP]);

  const doComboTap=()=>{};// removed — kept for compat

  // ── POMODORO v2 ──────────────────────────────────────────
  const pomodoro = usePomodoroV2({
    onWorkDone:(questId, focusSecs)=>{
      // Deal progressive boss dmg each completed focus session
      setS(p=>{
        const cur=p.bossHpMap[today]??todayBoss.maxHp;
        const dmg=Math.round(focusSecs/30); // 1 dmg per 30s focus
        const newHp=Math.max(0,cur-dmg);
        if(newHp<=0&&!p.wonToday[today]){
          setTimeout(()=>toast({icon:"🎯",title:"Boss vaincu par le focus !",desc:"La persévérance l'a abattu.",color:"#39FF14"}),100);
          return{...p,bossHpMap:{...p.bossHpMap,[today]:0},wonToday:{...p.wonToday,[today]:true},
            defeatedBosses:p.defeatedBosses.includes(todayBoss.id)?p.defeatedBosses:[...p.defeatedBosses,todayBoss.id]};
        }
        return{...p,bossHpMap:{...p.bossHpMap,[today]:newHp}};
      });
    },
    onSessionEnd:(questId, totalSecs)=>{
      // Save to pomodoroLog
      setS(p=>({...p,pomodoroLog:{...(p.pomodoroLog||{}),[questId]:((p.pomodoroLog||{})[questId]||0)+totalSecs}}));
      // Auto-check quest
      const done2=s.history[today]||[];
      if(!done2.includes(questId)){
        toggleQuest(questId);
        toast({icon:"⏱",title:"Session terminée !",desc:"Quête auto-validée. Excellent travail.",color:"#EF4444"});
      } else {
        toast({icon:"⏱",title:"Session terminée !",desc:`+${Math.round(totalSecs/60)}min de focus enregistrées.`,color:"#EF4444"});
      }
    }
  });

  const handleBuy=item=>{
    if(s.gold<item.cost)return;
    setS(p=>{
      const newGold=p.gold-item.cost;
      if(item.type==="cosme"){
        return{...p,gold:newGold,purchases:[...(p.purchases||[]).filter(id=>!SHOP_ITEMS.find(i=>i.id===id&&i.type==="cosme")),item.id],auraOverride:item.auraColor};
      }
      if(item.type==="boost"){
        const until=Date.now()+24*60*60*1000;
        return{...p,gold:newGold,activeBoosts:{...(p.activeBoosts||{}),[item.id]:until}};
      }
      if(item.id==="cdReset"){
        setCooldowns({});
        toast({icon:"🔄",title:"Cooldowns réinitialisés",color:"#00F5FF"});
        return{...p,gold:newGold};
      }
      if(item.id==="bossHeal"){
        const curHp=p.bossHpMap[today]??todayBoss.maxHp;
        const newHp=Math.max(1,Math.round(curHp*0.8));
        toast({icon:"💉",title:"Boss affaibli !",desc:`-${curHp-newHp} PV`,color:"#39FF14"});
        return{...p,gold:newGold,bossHpMap:{...p.bossHpMap,[today]:newHp}};
      }
      if(item.id==="streakSave"){
        toast({icon:"🛡️",title:"Streak protégé !",desc:"Une journée ratée ne brisera pas ton streak.",color:"#A855F7"});
        return{...p,gold:newGold,streakShield:true};
      }
      return{...p,gold:newGold};
    });
    if(item.type!=="instant"&&item.id!=="streakSave")toast({icon:item.emoji,title:item.name+" acheté !",color:item.color});
  };
  const claimVictory=v=>{setS(p=>({...p,gold:p.gold+v.gold,bonusXp:p.bonusXp+v.xp}));setVictory(null);};
  const saveQuest=f=>{setS(p=>{const ex=p.quests.find(q=>q.id===f.id);return{...p,quests:ex?p.quests.map(q=>q.id===f.id?f:q):[...p.quests,f]};});toast({icon:f.emoji,title:"Quête sauvegardée",color:f.color});};
  const deleteQuest=id=>{setS(p=>({...p,quests:p.quests.filter(q=>q.id!==id)}));setDelConfirm(null);};

  // Effective aura color (cosmetic override or rank color)
  const effectiveColor=(()=>{
    const cosme=SHOP_ITEMS.find(i=>i.type==="cosme"&&(s.purchases||[]).includes(i.id));
    return cosme?cosme.auraColor:rankData.color;
  })();

  if(!s.onboarded)return <Onboarding onComplete={name=>setS(p=>({...p,name,onboarded:true}))}/>;
  if(showEntry)return <DungeonEntry boss={todayBoss} rankData={{...rankData,color:effectiveColor}} onEnter={()=>setShowEntry(false)}/>;

  return (
    <div style={{background:"#020B18",maxWidth:420,margin:"0 auto",fontFamily:"'Rajdhani',sans-serif",color:"#D0EAFF",position:"relative",overflow:"hidden",display:"flex",flexDirection:"column",height:"100vh"}}>
      <style>{CSS}</style>
      <MangaHero color={effectiveColor} rank={rankData.rank} questsDoneToday={done.length} totalQuests={s.quests.length}/>
      <AmbientParticles rank={rankData.rank} color={effectiveColor}/>
      <Toasts list={toasts}/>

      {/* Flash XP */}
      {flashXp&&<div style={{position:"fixed",top:"22%",left:"50%",transform:"translateX(-50%)",zIndex:8900,pointerEvents:"none",fontSize:23,fontWeight:900,color:flashXp.color,fontFamily:"'Orbitron',monospace",animation:"xpPop 1.1s ease forwards",textShadow:`0 0 20px ${flashXp.color}`,whiteSpace:"nowrap"}}>{flashXp.xp>0?`+${flashXp.xp} XP`:""}</div>}

      {/* OVERLAYS */}
      {penalty&&<PenaltyScreen {...penalty} onClose={()=>setPenalty(null)}/>}
      {bossCounter&&<BossCounterScreen boss={todayBoss} goldLost={bossCounter.goldLost} onClose={()=>setBossCounter(null)}/>}
      {showBilan&&<BilanScreen quests={s.quests} done={done} totalXp={totalXp} streak={streak} boss={todayBoss} bossWon={bossWon} onClose={()=>setShowBilan(false)}/>}
      {showImportExport&&<ImportExport state={s} onImport={d=>setS(p=>({...defaultState(),...d}))} onClose={()=>setShowImportExport(false)}/>}
      {showBet&&<BetModal quest={showBet} gold={s.gold} onBet={placeBet} onClose={()=>setShowBet(null)}/>}
      {showNotif&&<NotifPanel onClose={()=>setShowNotif(false)}/>}
      {showMgr&&<QuestManager quests={s.quests} onSave={saveQuest} onDelete={id=>setDelConfirm(id)} onBack={()=>setShowMgr(false)}/>}
      {showShop&&<Shop gold={s.gold} purchases={s.purchases||[]} activeBoosts={s.activeBoosts||{}} onBuy={handleBuy} onClose={()=>setShowShop(false)}/>}
      {delConfirm&&(
        <div style={{position:"fixed",inset:0,zIndex:9300,display:"flex",alignItems:"center",justifyContent:"center",background:"rgba(0,0,0,0.9)",backdropFilter:"blur(4px)"}}>
          <div style={{background:"#0D000F",border:"1px solid rgba(239,68,68,0.3)",borderRadius:16,padding:22,width:255,textAlign:"center"}}>
            <div style={{fontSize:25,marginBottom:7}}>⚠️</div>
            <div style={{fontSize:12,fontFamily:"'Orbitron',monospace",color:"#EF4444",fontWeight:700,marginBottom:5}}>SUPPRIMER ?</div>
            <div style={{fontSize:11,color:"#8BADD4",fontFamily:"'Rajdhani',sans-serif",marginBottom:16}}>Cette quête sera effacée définitivement.</div>
            <div style={{display:"flex",gap:8}}>
              <button onClick={()=>setDelConfirm(null)} style={{flex:1,padding:"9px",background:"rgba(10,20,50,0.5)",border:"1px solid rgba(56,139,255,0.22)",borderRadius:9,cursor:"pointer",fontSize:10,color:"#8BADD4",fontFamily:"'Orbitron',monospace"}}>ANNULER</button>
              <button onClick={()=>deleteQuest(delConfirm)} style={{flex:1,padding:"9px",background:"rgba(239,68,68,0.1)",border:"1px solid #EF4444",borderRadius:9,cursor:"pointer",fontSize:10,color:"#EF4444",fontFamily:"'Orbitron',monospace",fontWeight:700}}>SUPPRIMER</button>
            </div>
          </div>
        </div>
      )}
      {sysDlg&&<SysDialog {...sysDlg} onClose={()=>{if(sysDlg.btn==="Voir mon bilan")setShowBilan(true);setSysDlg(null);}}/>}
      {rankUp&&<RankUpScreen rankData={rankUp} onClose={()=>setRankUp(null)}/>}
      {victory&&<VictoryScreen boss={victory.boss} gold={victory.gold} xp={victory.xp} onClose={()=>claimVictory(victory)}/>}
      {titleReveal&&<TitleRevealScreen t={titleReveal} onClose={()=>setTitleReveal(null)}/>}

      {/* HEADER */}
      <div style={{position:"relative",zIndex:10,flexShrink:0}}>
        <HeroHeader totalXp={totalXp} xpToday={xpToday} maxXpDay={maxXpDay} done={done.length} total={s.quests.length} streak={streak} rankData={{...rankData,color:effectiveColor}} name={s.name} activeTitle={s.activeTitle}/>
        {/* Countdown bar */}
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"4px 13px 5px",borderBottom:`1px solid ${effectiveColor}10`,background:"rgba(0,0,0,0.4)"}}>
          <div style={{display:"flex",alignItems:"center",gap:6}}>
            <span style={{fontSize:8,color:"#111",fontFamily:"'Orbitron',monospace",letterSpacing:"0.12em"}}>RESET DANS</span>
            <Countdown/>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:5,background:"rgba(255,215,0,0.06)",border:"1px solid rgba(255,215,0,0.15)",borderRadius:8,padding:"3px 8px",cursor:"pointer"}} onClick={()=>setShowShop(true)}>
            <span style={{fontSize:12}}>💰</span>
            <span style={{fontSize:11,fontFamily:"'Orbitron',monospace",fontWeight:700,color:"#FFD700"}}>{s.gold}</span>
            <span style={{fontSize:8,color:"#8BADD4",fontFamily:"'Orbitron',monospace"}}>SHOP</span>
          </div>
        </div>
      </div>

      {/* CONTENT */}
      <div style={{flex:1,overflowY:"auto",position:"relative",zIndex:10,display:isTablet?"flex":"block"}}>
        {/* Tablet left panel */}
        {isTablet&&(
          <div style={{width:"48%",borderRight:"1px solid rgba(168,85,247,0.1)",overflowY:"auto",flexShrink:0}}>
            <div style={{padding:"10px 14px 80px"}}>
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:11}}>
                <div style={{flex:1,background:"rgba(0,0,0,0.7)",border:`1px solid ${rankData.color}22`,borderRadius:12,padding:"9px 12px",backdropFilter:"blur(8px)"}}>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                    <span style={{fontSize:9,color:rankData.color,fontFamily:"'Orbitron',monospace",letterSpacing:"0.08em"}}>JOURNÉE</span>
                    <span style={{fontSize:10,color:"#FFD700",fontFamily:"'Orbitron',monospace",fontWeight:700}}>{xpToday}/{maxXpDay} XP</span>
                  </div>
                  <Bar v={xpToday} max={maxXpDay} color={xpToday>=maxXpDay?"#39FF14":rankData.color} h={6}/>
                </div>
                <button onClick={()=>setShowNotif(true)} style={{flexShrink:0,padding:"10px",background:"rgba(168,85,247,0.07)",border:"1px solid rgba(168,85,247,0.18)",borderRadius:12,cursor:"pointer",fontSize:15}}>🔔</button>
                <button onClick={()=>setShowMgr(true)} style={{flexShrink:0,padding:"10px 12px",background:"rgba(168,85,247,0.1)",border:"1px solid rgba(168,85,247,0.25)",borderRadius:12,cursor:"pointer",fontSize:11,fontFamily:"'Orbitron',monospace",color:"#A855F7",fontWeight:700}}>✏️</button>
              </div>
              {["AUBE","JOUR","MIDI","SOIR"].map(sec=>{
                const sq=s.quests.filter(q=>q.section===sec);if(!sq.length)return null;
                const nd=sq.filter(q=>done.includes(q.id)).length;
                const sm=SEC[sec]||{icon:"✦",c:"#9CA3AF"};
                return <QuestSection key={sec} sec={sec} sm={sm} nd={nd} sq={sq} done={done} activeBet={s.activeBet} gold={s.gold} generatedAtkNames={s.generatedAtkNames} onToggle={toggleQuest} onBet={q=>setShowBet(q)} onReorder={newSec=>{const newAll=[...s.quests];let si=0;for(let i=0;i<newAll.length;i++){if(newAll[i].section===sec)newAll[i]=newSec[si++];}reorderQuests(newAll);}} rankData={rankData} onPomodoro={q=>setPomodoroQuest(q)} pomodoroLog={s.pomodoroLog||{}}/>;
              })}
            </div>
          </div>
        )}
        {/* Right panel (tablet) or full content (mobile) */}
        <div style={{flex:1,minWidth:0}}>

        {/* ── QUESTS ── */}
        {tab==="quests"&&(
          <div style={{padding:"10px 12px 80px"}}>
            {/* Daily bar */}
            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:11}}>
              <div style={{flex:1,background:"rgba(0,0,0,0.7)",border:`1px solid ${rankData.color}22`,borderRadius:12,padding:"9px 12px",backdropFilter:"blur(8px)"}}>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                  <span style={{fontSize:9,color:rankData.color,fontFamily:"'Orbitron',monospace",letterSpacing:"0.08em"}}>JOURNÉE</span>
                  <span style={{fontSize:10,color:"#FFD700",fontFamily:"'Orbitron',monospace",fontWeight:700}}>{xpToday}/{maxXpDay} XP</span>
                </div>
                <Bar v={xpToday} max={maxXpDay} color={xpToday>=maxXpDay?"#39FF14":rankData.color} h={6}/>
              </div>
              <button onClick={()=>setShowNotif(true)} style={{flexShrink:0,padding:"10px 10px",background:"rgba(168,85,247,0.07)",border:"1px solid rgba(168,85,247,0.18)",borderRadius:12,cursor:"pointer",fontSize:15,backdropFilter:"blur(8px)"}}>🔔</button>
              <button onClick={()=>setShowMgr(true)} style={{flexShrink:0,padding:"10px 12px",background:"rgba(168,85,247,0.1)",border:"1px solid rgba(168,85,247,0.25)",borderRadius:12,cursor:"pointer",fontSize:11,fontFamily:"'Orbitron',monospace",color:"#A855F7",fontWeight:700,backdropFilter:"blur(8px)"}}>
                ✏️ GÉRER
              </button>
            </div>

            {/* Secret quest */}
            {todaySecret&&(
              <div onClick={toggleSecret} style={{background:"rgba(0,0,0,0.7)",border:`1px solid ${s.secretsDone[today]?"#A855F7":"rgba(168,85,247,0.22)"}`,borderRadius:13,padding:"9px 12px",marginBottom:11,cursor:"pointer",backdropFilter:"blur(8px)"}}>
                <div style={{display:"flex",alignItems:"center",gap:9}}>
                  <div style={{width:21,height:21,borderRadius:6,background:s.secretsDone[today]?"#A855F7":"rgba(168,85,247,0.08)",border:"1.5px solid #A855F7",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                    {s.secretsDone[today]?<span style={{color:"#E8F4FF",fontSize:11}}>✓</span>:<span style={{color:"#A855F7",fontSize:10}}>?</span>}
                  </div>
                  <span style={{fontSize:17}}>{todaySecret.emoji}</span>
                  <div style={{flex:1}}>
                    <div style={{fontSize:8,color:"#A855F7",fontFamily:"'Orbitron',monospace",letterSpacing:"0.15em",marginBottom:1}}>⬛ QUÊTE SECRÈTE</div>
                    <div style={{fontSize:12,fontFamily:"'Rajdhani',sans-serif",fontWeight:600,color:s.secretsDone[today]?"#A855F7":"#D0D8F0"}}>{todaySecret.name}</div>
                    <div style={{fontSize:9,color:"#8BADD4",fontFamily:"monospace"}}>{todaySecret.desc}</div>
                  </div>
                  <div style={{textAlign:"center",flexShrink:0}}>
                    <div style={{fontSize:11,color:"#A855F7",fontFamily:"'Orbitron',monospace",fontWeight:700}}>+{todaySecret.xp}</div>
                    <div style={{fontSize:7,color:"#8BADD4",fontFamily:"monospace"}}>XP</div>
                  </div>
                </div>
              </div>
            )}

            {/* Quest sections with drag & drop */}
            {["AUBE","JOUR","MIDI","SOIR"].map(sec=>{
              const sq=s.quests.filter(q=>q.section===sec);if(!sq.length)return null;
              const nd=sq.filter(q=>done.includes(q.id)).length;
              const sm=SEC[sec]||{icon:"✦",c:"#9CA3AF"};
              const secQuests=s.quests.filter(q=>q.section===sec);
              return (
                <QuestSection key={sec} sec={sec} sm={sm} nd={nd} sq={sq}
                  done={done} activeBet={s.activeBet} gold={s.gold}
                  generatedAtkNames={s.generatedAtkNames}
                  onToggle={toggleQuest} onBet={q=>setShowBet(q)}
                  onReorder={newSec=>{
                    // Merge reordered section back into full quest list
                    const others=s.quests.filter(q=>q.section!==sec);
                    // Preserve global order: replace section quests in-place
                    const newAll=[...s.quests];
                    let si=0;
                    for(let i=0;i<newAll.length;i++){
                      if(newAll[i].section===sec){ newAll[i]=newSec[si++]; }
                    }
                    reorderQuests(newAll);
                  }}
                  rankData={rankData}/>
              );
            })}
          </div>
        )}

        {/* ── DUNGEON ── */}
        {tab==="dungeon"&&(
          <div style={{padding:"0 0 80px",display:"flex",flexDirection:"column"}}>
            {/* Cinematic boss arena */}
            <div style={{position:"relative",minHeight:180,background:`radial-gradient(ellipse at 50% 60%,${todayBoss.color}12 0%,rgba(0,0,0,0.95) 70%)`,borderBottom:`1px solid ${todayBoss.color}18`,overflow:"hidden",flexShrink:0}}>
              {/* Ambient rings behind boss */}
              {!bossWon&&[1,2].map(i=>(
                <div key={i} style={{position:"absolute",top:"50%",left:"50%",transform:"translate(-50%,-50%)",width:80+i*60,height:80+i*60,borderRadius:"50%",border:`1px solid ${todayBoss.color}${i===1?"22":"10"}`,pointerEvents:"none",animation:`pulseRing ${2+i}s ${i*0.7}s ease-out infinite`}}/>
              ))}
              {/* Boss SVG — large and centered */}
              <div style={{display:"flex",flexDirection:"column",alignItems:"center",paddingTop:18,paddingBottom:14,position:"relative",zIndex:2}}>
                <div style={{fontSize:8,color:`${todayBoss.color}66`,fontFamily:"'Orbitron',monospace",letterSpacing:"0.3em",marginBottom:6}}>
                  {bossWon?"✦ VAINCU":"⬛ PORTAIL ACTIF"}
                </div>
                <div style={{animation:bossWon?"none":"bossEnter 0.6s ease",filter:bossWon?`drop-shadow(0 0 20px #39FF14)`:`drop-shadow(0 0 15px ${todayBoss.color})`}}>
                  <BossSVG bossId={todayBoss.id} color={bossWon?"#39FF14":todayBoss.color} size={100} isShaking={lastHit} isDead={bossWon||bossDead}/>
                </div>
                <div style={{fontSize:9,color:`${bossWon?"#39FF14":todayBoss.color}99`,fontFamily:"'Orbitron',monospace",letterSpacing:"0.15em",marginTop:6}}>{todayBoss.title}</div>
                <div style={{fontSize:16,fontFamily:"'Orbitron',monospace",fontWeight:900,color:bossWon?"#39FF14":todayBoss.color,textShadow:`0 0 16px ${bossWon?"#39FF14":todayBoss.color}`,marginTop:2}}>{todayBoss.name}</div>
              </div>
              {/* HP bar full width */}
              {!bossWon&&(
                <div style={{padding:"0 16px 12px",position:"relative",zIndex:2}}>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                    <span style={{fontSize:8,color:"#2A2A3A",fontFamily:"monospace"}}>PV DU BOSS</span>
                    <span style={{fontSize:10,fontFamily:"'Orbitron',monospace",fontWeight:700,color:bossHp/todayBoss.maxHp>0.5?"#EF4444":bossHp/todayBoss.maxHp>0.25?"#F59E0B":"#FF3864"}}>{Math.max(0,bossHp)} / {todayBoss.maxHp}</span>
                  </div>
                  <div style={{height:10,background:"rgba(56,139,255,0.18)",borderRadius:5,overflow:"hidden",boxShadow:"inset 0 2px 4px rgba(0,0,0,0.5)"}}>
                    <div style={{height:"100%",width:`${(bossHp/todayBoss.maxHp)*100}%`,background:`linear-gradient(90deg,${bossHp/todayBoss.maxHp>0.5?"#EF4444":bossHp/todayBoss.maxHp>0.25?"#F59E0B":"#FF3864"},${todayBoss.color})`,borderRadius:5,transition:"width 0.6s cubic-bezier(.23,1.4,.42,1)",boxShadow:`0 0 8px ${todayBoss.color}`,animation:"hpDrain 0.3s ease"}}/>
                  </div>
                </div>
              )}
              {/* Hit flash overlays */}
              {lastHit&&<div style={{position:"absolute",inset:0,zIndex:20,pointerEvents:"none",overflow:"hidden"}}>
                <div style={{position:"absolute",top:"45%",left:"50%",width:"200%",height:3,background:`linear-gradient(90deg,transparent,${isCrit?"#FFD700":todayBoss.color},white,transparent)`,animation:"slashR 0.28s ease forwards",boxShadow:`0 0 16px ${isCrit?"#FFD700":todayBoss.color}`}}/>
                <div style={{position:"absolute",top:"35%",left:"50%",width:"150%",height:2,background:`linear-gradient(90deg,transparent,${todayBoss.color},transparent)`,animation:"slashD 0.28s ease forwards 0.03s"}}/>
                {isCrit&&<div style={{position:"absolute",inset:0,background:"rgba(255,215,0,0.07)",animation:"critFlash 0.35s ease"}}/>}
              </div>}
              {/* Entry button overlay */}
              {!bossWon&&bossHp===todayBoss.maxHp&&(
                <div style={{position:"absolute",inset:0,background:"rgba(0,0,0,0.7)",zIndex:30,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:12,backdropFilter:"blur(2px)"}}>
                  <button onClick={()=>{setShowEntry(true);setTimeout(checkBossCounter,800);}}
                    style={{padding:"13px 32px",background:`${effectiveColor}18`,border:`2px solid ${effectiveColor}`,borderRadius:14,cursor:"pointer",fontSize:14,fontFamily:"'Orbitron',monospace",fontWeight:900,color:effectiveColor,letterSpacing:"0.12em",boxShadow:`0 0 30px ${effectiveColor}44`,animation:"sysIn 0.4s ease"}}>
                    🚪 ENTRER DANS LE DONJON
                  </button>
                </div>
              )}
            </div>

            {/* Combat v2 */}
            <div style={{padding:"12px 12px 0"}}>
              {(bossWon||bossHp<todayBoss.maxHp)&&(
                <button onClick={()=>setShowBilan(true)} style={{width:"100%",marginBottom:8,padding:"8px",background:"rgba(168,85,247,0.07)",border:"1px solid rgba(168,85,247,0.18)",borderRadius:10,cursor:"pointer",fontSize:10,fontFamily:"'Orbitron',monospace",fontWeight:700,color:"#A855F766",letterSpacing:"0.08em"}}>
                  📋 RAPPORT DE MISSION
                </button>
              )}
              {!bossWon&&attacks.length>0&&<AwakenAttack streak={streak} onAttack={doAwakenAttack} used={awakenUsedToday}/>}
              <CombatV2
                boss={todayBoss}
                bossHp={bossHp}
                bossMaxHp={todayBoss.maxHp}
                playerHp={playerHp??PLAYER_MAX_HP}
                playerMaxHp={PLAYER_MAX_HP}
                attacks={attacks.map(a=>({...a,atkName:s.generatedAtkNames?.[a.id]||a.atkName}))}
                turnPhase={turnPhase}
                statusFx={statusFx}
                lastBossAtk={lastBossAtk}
                lastPlayerAtk={lastPlayerAtk}
                bossWon={bossWon}
                onChoose={doAttack}
              />
            </div>
          </div>
        )}

        {tab==="stats"&&<StatsTab history={s.history} quests={s.quests} totalXp={totalXp} streak={streak} gold={s.gold} defeatedBosses={s.defeatedBosses||[]}/>}

        {tab==="weekly"&&(
          <div style={{padding:"12px 0 80px"}}>
            <div style={{padding:"0 14px 10px"}}>
              <div style={{fontSize:9,color:"#A855F7",fontFamily:"'Orbitron',monospace",letterSpacing:"0.2em",marginBottom:2}}>DÉFIS HEBDOMADAIRES</div>
              <div style={{fontSize:10,color:"#2A2A3A",fontFamily:"'Rajdhani',sans-serif"}}>Reset chaque lundi. XP et gold massifs.</div>
            </div>
            <WeeklyPanel weeklyProgress={s.weeklyProgress} weeklyQuests={curWeeklyQuests} wk={wk} onToggle={toggleWeekly} color={effectiveColor}/>
            <div style={{padding:"0 14px 10px"}}>
              <div style={{fontSize:9,color:"#C026D3",fontFamily:"'Orbitron',monospace",letterSpacing:"0.2em",marginBottom:2}}>BOSS MENSUEL</div>
              <div style={{fontSize:10,color:"#2A2A3A",fontFamily:"'Rajdhani',sans-serif",marginBottom:8}}>Frappe Antares une fois par jour. Vaincs-le avant la fin du mois.</div>
            </div>
            <AntaresPanel antaresHp={antaresHp} color={effectiveColor} onAttack={hitAntares} alreadyHitToday={antaresHitToday}/>
          </div>
        )}

        {/* ── SHOP TAB ── */}
        {tab==="shop"&&(
          <div style={{padding:"14px 12px 80px"}}>
            <div style={{fontSize:8,color:"#FFD700",fontFamily:"'Orbitron',monospace",letterSpacing:"0.2em",marginBottom:3}}>MARCHÉ DU SYSTÈME</div>
            <div style={{fontSize:11,color:"#8BADD4",fontFamily:"'Rajdhani',sans-serif",marginBottom:14}}>Dépense ton gold pour te renforcer.</div>
            {/* Active boosts */}
            {Object.entries(s.activeBoosts||{}).some(([,v])=>v>Date.now())&&(
              <div style={{background:"rgba(255,215,0,0.04)",border:"1px solid rgba(255,215,0,0.12)",borderRadius:12,padding:"10px 12px",marginBottom:12}}>
                <div style={{fontSize:8,color:"#FFD70088",fontFamily:"'Orbitron',monospace",letterSpacing:"0.15em",marginBottom:6}}>⚡ BOOSTS ACTIFS</div>
                {Object.entries(s.activeBoosts||{}).map(([id,until])=>{
                  if(until<=Date.now())return null;
                  const item=SHOP_ITEMS.find(i=>i.id===id);
                  if(!item)return null;
                  const minLeft=Math.ceil((until-Date.now())/60000);
                  return <div key={id} style={{display:"flex",justifyContent:"space-between",marginBottom:3}}>
                    <span style={{fontSize:11,color:"#FFD700",fontFamily:"'Rajdhani',sans-serif"}}>{item.emoji} {item.name}</span>
                    <span style={{fontSize:9,color:"#7BA7CC",fontFamily:"monospace"}}>{minLeft}min</span>
                  </div>;
                })}
              </div>
            )}
            {/* Shield status */}
            {s.streakShield&&(
              <div style={{background:"rgba(168,85,247,0.05)",border:"1px solid rgba(168,85,247,0.2)",borderRadius:12,padding:"8px 12px",marginBottom:12,display:"flex",alignItems:"center",gap:8}}>
                <span style={{fontSize:17}}>🛡️</span>
                <div><div style={{fontSize:11,color:"#A855F7",fontFamily:"'Orbitron',monospace",fontWeight:700}}>SCEAU ACTIF</div>
                <div style={{fontSize:9,color:"#8BADD4",fontFamily:"monospace"}}>Ton streak est protégé pour 1 jour raté.</div></div>
              </div>
            )}
            {SHOP_ITEMS.map(item=>{
              const owned=item.type==="cosme"&&(s.purchases||[]).includes(item.id);
              const boosted=item.type==="boost"&&(s.activeBoosts||{})[item.id]>Date.now();
              const canAfford=s.gold>=item.cost;
              return (
                <div key={item.id} onClick={()=>canAfford&&!owned&&handleBuy(item)}
                  style={{display:"flex",alignItems:"center",gap:10,background:"rgba(0,0,0,0.65)",border:`1px solid ${item.color}22`,borderRadius:13,padding:"11px 12px",marginBottom:8,backdropFilter:"blur(6px)",cursor:canAfford&&!owned?"pointer":"default",opacity:canAfford||owned?1:0.4,transition:"opacity 0.2s"}}>
                  <div style={{width:38,height:38,borderRadius:10,background:`${item.color}12`,border:`1px solid ${item.color}33`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,flexShrink:0}}>{item.emoji}</div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:13,fontFamily:"'Rajdhani',sans-serif",fontWeight:700,color:owned?"#39FF14":boosted?"#FFD700":item.color}}>{item.name}</div>
                    <div style={{fontSize:9,color:"#8BADD4",fontFamily:"'Rajdhani',sans-serif",lineHeight:1.4}}>{item.desc}</div>
                    {boosted&&<div style={{fontSize:8,color:"#39FF14",fontFamily:"monospace",marginTop:1}}>✦ ACTIF</div>}
                  </div>
                  <div style={{flexShrink:0,textAlign:"center",minWidth:46}}>
                    {owned?<span style={{fontSize:11,color:"#39FF14",fontFamily:"'Orbitron',monospace",fontWeight:700}}>✓</span>:(
                      <><div style={{fontSize:13,fontFamily:"'Orbitron',monospace",fontWeight:700,color:canAfford?item.color:"#8BADD4"}}>{item.cost}</div>
                      <div style={{fontSize:8,color:"#8BADD4",fontFamily:"monospace"}}>💰</div></>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ── PROFILE ── */}
        {tab==="profile"&&(
          <div style={{padding:"14px 12px 80px"}}>
            <div style={{background:"rgba(0,0,0,0.7)",border:`1px solid ${effectiveColor}20`,borderRadius:16,padding:"14px",marginBottom:12,backdropFilter:"blur(8px)"}}>
              <div style={{fontSize:8,color:"#8BADD4",fontFamily:"'Orbitron',monospace",letterSpacing:"0.15em",marginBottom:8}}>IDENTITÉ</div>
              <div style={{fontSize:17,fontFamily:"'Orbitron',monospace",fontWeight:700,color:effectiveColor,marginBottom:2}}>{s.name||"CHASSEUR INCONNU"}</div>
              {s.activeTitle&&<div style={{fontSize:10,color:"#FFD70088",fontFamily:"monospace",fontStyle:"italic",marginBottom:4}}>✦ {s.activeTitle.name}</div>}
              <div style={{fontSize:10,color:"#8BADD4",fontFamily:"monospace",display:"flex",alignItems:"center",gap:4}}>{rankData.title} · {totalXp.toLocaleString()} XP · <SLIcon.gold size={13}/>{s.gold}</div>
              <button onClick={()=>setS(p=>({...p,name:""}))} style={{marginTop:10,padding:"6px 12px",background:"rgba(10,20,50,0.5)",border:"1px solid rgba(56,139,255,0.22)",borderRadius:8,cursor:"pointer",fontSize:9,color:"#8BADD4",fontFamily:"'Orbitron',monospace"}}>MODIFIER LE NOM →</button>
              {!s.name&&(
                <input autoFocus placeholder="Nouveau nom..." onKeyDown={e=>{if(e.key==="Enter"&&e.target.value.trim())setS(p=>({...p,name:e.target.value.trim()}));}}
                  style={{width:"100%",marginTop:8,background:"rgba(10,20,50,0.5)",border:`1px solid ${effectiveColor}44`,borderRadius:9,padding:"9px 11px",color:"#D0EAFF",fontFamily:"'Orbitron',monospace",fontSize:14}}/>
              )}
            </div>

            {/* ── Streak Multiplier card ── */}
            {(()=>{
              const m=streakMultiplier(streak);
              const steps=[{s:0,m:1.0,l:"Aucun bonus"},{s:3,m:1.1,l:"3j"},{s:7,m:1.2,l:"7j"},{s:14,m:1.35,l:"14j"},{s:30,m:1.5,l:"30j"},{s:60,m:1.6,l:"60j"}];
              const curIdx=steps.reduce((ci,st,i)=>streak>=st.s?i:ci,0);
              const nxt=steps[curIdx+1];
              return (
                <div style={{background:"rgba(0,0,0,0.7)",border:`1px solid #EF444430`,borderRadius:14,padding:"12px 14px",marginBottom:12,backdropFilter:"blur(8px)"}}>
                  <div style={{fontSize:8,color:"#EF4444",fontFamily:"'Orbitron',monospace",letterSpacing:"0.15em",marginBottom:8,display:"flex",alignItems:"center",gap:6}}>
                    <SLIcon.flame size={13} color="#EF4444"/> MULTIPLICATEUR DE STREAK
                  </div>
                  <div style={{display:"flex",alignItems:"baseline",gap:8,marginBottom:8}}>
                    <span style={{fontSize:29,fontFamily:"'Orbitron',monospace",fontWeight:900,color:m>1?"#EF4444":"#333"}}>×{m.toFixed(1)}</span>
                    <span style={{fontSize:10,color:"#8BADD4",fontFamily:"'Rajdhani',sans-serif"}}>{streak} jour{streak!==1?"s":""} consécutifs</span>
                  </div>
                  {nxt&&<div style={{fontSize:9,color:"#7BA7CC",fontFamily:"monospace",marginBottom:8}}>Prochain palier ×{nxt.m.toFixed(1)} à {nxt.s} jours → encore {nxt.s-streak}j</div>}
                  <div style={{display:"flex",gap:4}}>
                    {steps.map((st,i)=>(
                      <div key={i} style={{flex:1,textAlign:"center",padding:"4px 2px",borderRadius:6,background:i<=curIdx?"rgba(239,68,68,0.15)":"rgba(10,20,50,0.6)",border:`1px solid ${i<=curIdx?"#EF444430":"rgba(56,139,255,0.15)"}`}}>
                        <div style={{fontSize:10,fontFamily:"'Orbitron',monospace",fontWeight:700,color:i<=curIdx?"#EF4444":"#222"}}>×{st.m.toFixed(1)}</div>
                        <div style={{fontSize:7,color:"#8BADD4",fontFamily:"monospace"}}>{st.l}</div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}

            {/* ── Rang S conditions ── */}
            {(()=>{
              const sc=sConditions;
              const conds=[
                {ok:sc.xpOk,   label:"75 000 XP accumulés",          val:`${totalXp.toLocaleString()} / 75 000`,  color:"#A855F7"},
                {ok:sc.streakOk,label:"Streak de 30 jours",           val:`${streak} / 30 jours`,                  color:"#EF4444"},
                {ok:sc.daysOk,  label:"100 jours actifs",             val:`${activeDays} / 100 jours`,             color:"#39FF14"},
                {ok:sc.bossesOk,label:"11 boss vaincus au moins 1×",  val:`${(s.defeatedBosses||[]).length} / 11`, color:"#F59E0B"},
              ];
              return (
                <div style={{background:"rgba(0,0,0,0.7)",border:`1px solid rgba(168,85,247,${sc.all?"0.5":"0.15"})`,borderRadius:14,padding:"12px 14px",marginBottom:12,backdropFilter:"blur(8px)"}}>
                  <div style={{fontSize:8,color:"#A855F7",fontFamily:"'Orbitron',monospace",letterSpacing:"0.15em",marginBottom:10,display:"flex",alignItems:"center",gap:6}}>
                    <SLIcon.crown size={13} color="#A855F7"/>
                    {sc.all?"✦ RANG S DÉBLOQUÉ":"🔒 CONDITIONS RANG S — MONARQUE"}
                  </div>
                  {conds.map((c,i)=>(
                    <div key={i} style={{display:"flex",alignItems:"center",gap:10,marginBottom:i<3?8:0}}>
                      <div style={{width:18,height:18,borderRadius:5,flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",
                        background:c.ok?"rgba(57,255,20,0.1)":"rgba(10,20,50,0.5)",
                        border:`1px solid ${c.ok?"#39FF14":"rgba(56,139,255,0.22)"}`}}>
                        {c.ok
                          ? <svg width={10} height={10} viewBox="0 0 10 10"><polyline points="1.5,5 4,8 8.5,2" stroke="#39FF14" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>
                          : <div style={{width:5,height:5,borderRadius:1,background:"rgba(56,139,255,0.22)"}}/>}
                      </div>
                      <div style={{flex:1}}>
                        <div style={{fontSize:11,fontFamily:"'Rajdhani',sans-serif",fontWeight:600,color:c.ok?c.color:"#8BADD4"}}>{c.label}</div>
                        <div style={{fontSize:8,color:"#8BADD4",fontFamily:"monospace"}}>{c.val}</div>
                      </div>
                    </div>
                  ))}
                </div>
              );
            })()}

            <div style={{background:"rgba(0,0,0,0.65)",border:`1px solid ${effectiveColor}18`,borderRadius:14,padding:"14px",marginBottom:12,backdropFilter:"blur(6px)"}}>
              <div style={{fontSize:8,color:"#8BADD4",fontFamily:"'Orbitron',monospace",letterSpacing:"0.15em",marginBottom:10}}>CHEMIN DU CHASSEUR</div>
              {RANKS.map((r,i)=>{
                const active=rawRankData.rank===r.rank,passed=totalXp>=r.min;
                const nxt=RANKS[i+1];
                const isS=r.rank==="S";
                const sLocked=isS&&!sConditions.all&&totalXp>=35000;
                return (
                  <div key={r.rank} style={{display:"flex",alignItems:"center",gap:10,marginBottom:i<RANKS.length-1?7:0}}>
                    <div style={{width:30,height:30,borderRadius:8,background:passed?r.color:"rgba(56,139,255,0.15)",border:`1.5px solid ${passed?r.color:sLocked?"rgba(168,85,247,0.2)":"rgba(56,139,255,0.2)"}`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,boxShadow:active?`0 0 12px ${r.color}88`:passed?`0 0 5px ${r.color}44`:"none"}}>
                      <span style={{fontSize:10,fontFamily:"'Orbitron',monospace",fontWeight:900,color:passed?"#000":"#111"}}>{sLocked?"🔒":r.rank}</span>
                    </div>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:11,fontFamily:"'Rajdhani',sans-serif",fontWeight:600,color:passed?r.color:sLocked?"rgba(168,85,247,0.3)":"#222"}}>{r.title}{sLocked?" — VERROUILLÉ":""}</div>
                      {active&&nxt&&<Bar v={totalXp-r.min} max={nxt.min-r.min} color={r.color} h={3}/>}
                      {isS&&!passed&&<div style={{fontSize:8,color:"#8BADD4",fontFamily:"monospace"}}>75 000 XP + conditions spéciales</div>}
                    </div>
                    {active&&<span style={{fontSize:8,color:r.color,fontFamily:"'Orbitron',monospace",fontWeight:700}}>← ICI</span>}
                    {passed&&!active&&!sLocked&&<span style={{fontSize:11,color:"#39FF14"}}>✓</span>}
                  </div>
                );
              })}
            </div>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",background:"rgba(0,0,0,0.6)",border:"1px solid rgba(56,139,255,0.25)",boxShadow:"0 0 12px rgba(56,139,255,0.08)",borderRadius:12,padding:"11px 14px",marginBottom:8,backdropFilter:"blur(6px)"}}>
              <span style={{fontSize:11,fontFamily:"'Orbitron',monospace",color:"#8BADD4",letterSpacing:"0.08em"}}>🔊 SONS</span>
              <div onClick={()=>setS(p=>({...p,soundEnabled:!p.soundEnabled}))} style={{width:42,height:22,borderRadius:11,background:s.soundEnabled?"#A855F7":"rgba(56,139,255,0.18)",border:`1px solid ${s.soundEnabled?"#A855F7":"rgba(255,255,255,0.1)"}`,cursor:"pointer",position:"relative",transition:"all 0.2s"}}>
                <div style={{position:"absolute",top:2,left:s.soundEnabled?20:2,width:17,height:17,borderRadius:"50%",background:"#fff",transition:"left 0.2s ease"}}/>
              </div>
            </div>
            <button onClick={()=>{if(window.confirm("Réinitialiser l'identité?"))setS(p=>({...p,onboarded:false,name:""}));}} style={{width:"100%",padding:"9px",background:"rgba(239,68,68,0.04)",border:"1px solid rgba(239,68,68,0.1)",borderRadius:10,cursor:"pointer",fontSize:9,color:"#EF444455",fontFamily:"'Orbitron',monospace"}}>
              RÉINITIALISER L'IDENTITÉ
            </button>
            <button onClick={()=>setShowImportExport(true)} style={{width:"100%",marginTop:7,padding:"10px",background:"rgba(168,85,247,0.07)",border:"1px solid rgba(168,85,247,0.2)",borderRadius:10,cursor:"pointer",fontSize:10,fontFamily:"'Orbitron',monospace",fontWeight:700,color:"#A855F766",letterSpacing:"0.08em"}}>
              💾 IMPORT / EXPORT
            </button>
            {!showReset ? (
              <button onClick={()=>setShowReset(true)} style={{width:"100%",marginTop:7,padding:"11px",background:"rgba(239,68,68,0.08)",border:"1px solid rgba(239,68,68,0.25)",borderRadius:10,cursor:"pointer",fontSize:10,fontFamily:"'Orbitron',monospace",fontWeight:700,color:"#EF4444",letterSpacing:"0.08em"}}>
                🗑 RESET COMPLET — NOUVELLE PARTIE
              </button>
            ) : (
              <div style={{marginTop:7,background:"rgba(239,68,68,0.1)",border:"1px solid rgba(239,68,68,0.4)",borderRadius:12,padding:"14px 12px"}}>
                <div style={{fontSize:11,fontFamily:"'Orbitron',monospace",fontWeight:700,color:"#EF4444",textAlign:"center",marginBottom:4}}>⚠️ CONFIRMER LE RESET ?</div>
                <div style={{fontSize:10,color:"#A0C0E0",fontFamily:"monospace",textAlign:"center",marginBottom:12}}>Toute ta progression sera effacée.</div>
                <div style={{display:"flex",gap:8}}>
                  <button onClick={()=>setShowReset(false)} style={{flex:1,padding:"10px",background:"rgba(56,139,255,0.18)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:9,cursor:"pointer",fontSize:10,fontFamily:"'Orbitron',monospace",color:"#A0C0E0"}}>
                    ANNULER
                  </button>
                  <button onClick={()=>{localStorage.removeItem("arise_v13");window.location.reload();}} style={{flex:1,padding:"10px",background:"rgba(239,68,68,0.2)",border:"1px solid #EF4444",borderRadius:9,cursor:"pointer",fontSize:10,fontFamily:"'Orbitron',monospace",fontWeight:700,color:"#EF4444"}}>
                    CONFIRMER
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>{/* end right panel / flex wrapper */}
      </div>{/* end CONTENT */}

      {/* POMODORO CONFIG SHEET */}
      {pomodoroQuest&&!pomodoro.sess&&(
        <PomodoroSheet
          quest={pomodoroQuest}
          onStart={(wm,bm)=>{pomodoro.start(pomodoroQuest.id,pomodoroQuest.name,wm,bm);setPomodoroQuest(null);}}
          onClose={()=>setPomodoroQuest(null)}
        />
      )}

      {/* POMODORO FLOATING WIDGET */}
      <PomodoroWidget
        sess={pomodoro.sess}
        onPause={pomodoro.pause}
        onFinish={pomodoro.finish}
        onCancel={pomodoro.cancel}
      />

      {/* BOTTOM NAV */}
      <div style={{position:"relative",zIndex:10,flexShrink:0,background:"rgba(0,0,0,0.95)",borderTop:`1px solid ${effectiveColor}12`,backdropFilter:"blur(24px)",paddingBottom:"env(safe-area-inset-bottom,0px)",paddingTop:4,paddingLeft:6,paddingRight:6}}>
        <div style={{display:"flex",gap:3,alignItems:"center"}}>
          {TABS.map(t=>{
            const active=tab===t.id;
            const IconComp=SLIcon[t.id];
            return (
              <button key={t.id} onClick={()=>{setTab(t.id);snd.tap();}}
                style={{flex:1,padding:active?"7px 4px 9px":"9px 4px 11px",background:active?`${effectiveColor}14`:"none",border:active?`1px solid ${effectiveColor}30`:"1px solid transparent",borderRadius:12,cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",gap:active?3:2,transition:"all 0.2s ease",boxShadow:active?`0 0 12px ${effectiveColor}22`:"none"}}>
                {IconComp
                  ? <IconComp size={active?22:18} color={active?effectiveColor:"#2A2A3A"} style={{transition:"all 0.2s",filter:active?`drop-shadow(0 0 5px ${effectiveColor})`:"none",animation:active?"navPop 0.25s ease":"none"}}/>
                  : <span style={{fontSize:active?20:16}}>{t.icon}</span>
                }
                <span style={{fontSize:8,fontFamily:"'Orbitron',monospace",letterSpacing:"0.04em",color:active?effectiveColor:"transparent",fontWeight:700,transition:"color 0.2s"}}>{t.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
