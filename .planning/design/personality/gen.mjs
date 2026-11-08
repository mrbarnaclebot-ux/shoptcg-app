// Builds direction-a/b/c.html: self-contained (Archivo latin inlined as base64, no network).
import fs from "node:fs";
const ROOT = "C:/Users/Uzi/Documents/GitHub/shoptcg-app";
const OUT = ROOT + "/.planning/design/personality";
const font = fs.readFileSync(ROOT + "/.next/static/media/db545dba463279ae-s.p.1cp9-4nby68jc.woff2").toString("base64");

const ICON = {
  success: '<path d="M5 12.5l4.2 4.2L19 7"/>',
  error: '<path d="M12 7.5v6"/><path d="M12 17h.01"/><circle cx="12" cy="12" r="9.2"/>',
  loading: '<path d="M12 3a9 9 0 1 0 9 9"/>',
};

const BASE_CSS = `
@font-face{font-family:Archivo;font-weight:100 900;font-stretch:62% 125%;font-display:block;src:url(data:font/woff2;base64,${font}) format("woff2")}
:root{--bg:#090911;--surface:#11121C;--surface-2:#1C1C2C;--surface-3:#2D2E44;--border:#373B40;--border-strong:#646970;
--text:#F3F5F8;--muted:#B6BBC1;--subtle:#9A9FA6;--accent:#F77C10;--accent-hover:#FF9044;--on-accent:#090911;--accent-bg:#3D1D06;
--success:#61CB7C;--success-bg:#122D19;--danger:#F66C6D;--danger-bg:#3F1919;--warning:#F1CA47;--deal:#5CDDC4;--deal-bg:#062D26;
--ease-out:cubic-bezier(.25,1,.5,1);--ease-expo:cubic-bezier(.16,1,.3,1);color-scheme:dark}
*{box-sizing:border-box;margin:0}
html{background:var(--bg);color:var(--text);font-family:Archivo,ui-sans-serif,system-ui,sans-serif;-webkit-text-size-adjust:100%}
body{min-height:100vh;overflow-x:hidden;background:var(--bg)}
button{font:inherit;color:inherit;cursor:pointer}
:focus-visible{outline:2px solid var(--accent-hover);outline-offset:2px}
.num{font-variant-numeric:tabular-nums lining-nums;font-weight:700}
.wrap{max-width:1200px;margin:0 auto;padding:0 16px}
@media(min-width:768px){.wrap{padding:0 32px}}
header.top{display:flex;justify-content:space-between;align-items:center;height:64px}
.wordmark{font-weight:800;font-stretch:118%;font-size:19px;letter-spacing:-.01em}.wordmark span{color:var(--muted)}
.ghost{background:none;border:0;padding:12px 4px;font-weight:600;color:var(--text)}
.cta{display:inline-flex;align-items:center;justify-content:center;gap:8px;height:48px;padding:0 22px;border:0;border-radius:10px;background:var(--accent);color:var(--on-accent);font-weight:700;font-size:16px;transition:background .12s var(--ease-out),transform .12s var(--ease-out)}
.cta:hover{background:var(--accent-hover)}.cta:active{transform:translateY(1px)}
.slice-label{font-size:13px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:var(--subtle);margin:0 0 10px}
.dir-tag{position:fixed;left:12px;bottom:12px;z-index:5;font-size:12px;font-weight:600;color:var(--subtle);background:var(--surface);border:1px solid var(--border);border-radius:6px;padding:4px 8px}
.replay{position:fixed;right:12px;bottom:12px;z-index:5;font-size:12px;font-weight:600;color:var(--muted);background:var(--surface);border:1px solid var(--border);border-radius:6px;padding:6px 10px}
@media(max-width:767px){body{padding-top:36px}.dir-tag,.replay{top:6px;bottom:auto;position:absolute}.dir-tag{left:16px}.replay{right:16px}}

/* abstract card art, no IP */
.card{position:relative;aspect-ratio:63/88;border-radius:4.6%/3.3%;padding:7%;background:linear-gradient(160deg,#d9dbe4,#8d90a3 45%,#c9ccd8);box-shadow:0 18px 40px -16px rgb(0 0 0/.8);overflow:hidden;isolation:isolate}
.card .art{height:52%;border-radius:3px;position:relative;overflow:hidden}
.card .ln{height:5%;margin-top:6%;border-radius:2px;background:rgb(255 255 255/.28)}.card .ln.s{width:60%}
.card::after{content:"";position:absolute;inset:0;mix-blend-mode:color-dodge;opacity:.28;pointer-events:none;
 background:repeating-linear-gradient(115deg,oklch(.8 .12 30/.55) 0%,oklch(.85 .12 95/.55) 6%,oklch(.82 .11 165/.55) 12%,oklch(.78 .12 250/.55) 18%,oklch(.78 .13 320/.55) 24%,oklch(.8 .12 30/.55) 30%);background-size:300% 300%;background-position:20% 20%}
.c-moon{background:linear-gradient(160deg,#3b3560,#1d1b33)}.c-moon .art{background:radial-gradient(circle at 62% 42%,#f4efd8 0 15%,transparent 16%),radial-gradient(circle at 70% 36%,#2b2850 0 14%,transparent 15%),linear-gradient(#2a2752,#5a4f8f)}
.c-sun{background:linear-gradient(160deg,#6b3b22,#2e1a12)}.c-sun .art{background:linear-gradient(transparent 55%,#5a2a16 55%),radial-gradient(circle at 50% 52%,#ffd7a1 0 18%,transparent 19%),linear-gradient(#f39a52,#c4552a)}
.c-sun .art::after{content:"";position:absolute;inset:38% 0 0;background:#3d1e12;clip-path:polygon(0 100%,30% 20%,48% 55%,68% 0,100% 100%)}
.c-tide{background:linear-gradient(160deg,#4a3c6a,#22324f)}.c-tide .art{background:radial-gradient(circle at 30% 40%,rgb(255 255 255/.5) 0 14%,transparent 15%),radial-gradient(circle at 72% 30%,rgb(255 255 255/.35) 0 9%,transparent 10%),radial-gradient(circle at 66% 72%,rgb(255 255 255/.3) 0 7%,transparent 8%),linear-gradient(135deg,#e7a6d9,#8fc3ef)}
.c-leaf{background:linear-gradient(160deg,#1f4a3b,#11251f)}.c-leaf .art{background:radial-gradient(ellipse 22% 40% at 50% 50%,transparent 60%,rgb(255 255 255/.55) 62% 66%,transparent 68%),linear-gradient(135deg,#4fb08a,#1c5c48)}

/* inventory row */
.inv{margin-top:28px;max-width:720px}
.row{display:grid;grid-template-columns:44px 1fr auto;gap:14px;align-items:center;padding:12px 14px;border-radius:10px;background:var(--surface);box-shadow:inset 0 1px 0 rgb(255 255 255/.04)}
.row .card{width:44px;padding:4px;box-shadow:none}.row .card .ln{display:none}.row .card .art{height:70%}
.row .name{font-size:17px;font-weight:600;line-height:1.3}
.row .meta{font-size:14px;color:var(--muted);display:flex;flex-wrap:wrap;gap:6px 10px;align-items:center;margin-top:2px}
.badge{font-size:12px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;padding:2px 6px;border-radius:6px}
.b-deal{color:var(--deal);background:var(--deal-bg)}.b-cond{color:var(--text);background:var(--surface-3)}
.row .price{text-align:right}.row .price .num{font-size:18px;display:block}.row .price small{font-size:13px;color:var(--subtle)}

/* ---- toast engine (Sileo approximation: pill + body under one gooey filter) ---- */
.vp{position:fixed;z-index:50;display:flex;gap:12px;padding:16px;pointer-events:none;width:min(392px,100vw)}
.vp[data-pos="top-right"]{top:56px;right:16px;flex-direction:column}
.vp[data-pos="bottom-center"]{bottom:0;left:50%;transform:translateX(-50%);flex-direction:column-reverse;padding-bottom:20px}
.t{position:relative;width:100%;height:40px;pointer-events:auto;will-change:transform,opacity;--fill:var(--surface-2)}
.t svg{position:absolute;inset:0;width:100%;height:100%;overflow:visible}
.t rect{fill:var(--fill)}
.t-head{position:absolute;left:0;height:40px;display:flex;align-items:center;gap:8px;padding:0 14px 0 8px;white-space:nowrap;z-index:2}
.t[data-dir="down"] .t-head{top:0}.t[data-dir="up"] .t-head{bottom:0}
.t-badge{width:24px;height:24px;border-radius:999px;display:grid;place-items:center;color:var(--tone);background:color-mix(in oklch,var(--tone) 18%,transparent);flex:none}
.t-badge svg{position:static;width:15px;height:15px;fill:none;stroke:currentColor;stroke-width:2.4;stroke-linecap:round;stroke-linejoin:round}
.t[data-state="loading"] .t-badge svg{animation:spin 0.9s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}
.t-title{font-size:14px;font-weight:650;color:var(--tone)}
.t-body{position:absolute;left:0;right:0;padding:12px 16px 14px;z-index:2;opacity:0}
.t[data-dir="down"] .t-body{top:40px}.t[data-dir="up"] .t-body{bottom:40px}
.t-desc{font-size:14px;line-height:20px;color:var(--muted)}
.t-desc b{color:var(--text);font-weight:600}
.t-btn{margin-top:10px;height:32px;padding:0 12px;border:0;border-radius:999px;font-size:13px;font-weight:700;color:var(--tone);background:color-mix(in oklch,var(--tone) 16%,transparent)}
.t-btn:hover{background:color-mix(in oklch,var(--tone) 26%,transparent)}
.t[data-state="success"]{--tone:var(--success)}.t[data-state="error"]{--tone:var(--danger)}.t[data-state="loading"]{--tone:var(--muted)}
.sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
`;

const ENGINE = (springs) => `
const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
const SPR = ${JSON.stringify(springs)};
const ICON = ${JSON.stringify(ICON)};
let uid = 0;
function spring(from, to, cfg, on, done){
  if (RM){ on(to); done && done(); return; }
  let x = from, v = 0, last = performance.now();
  (function step(now){
    const dt = Math.min(.032, (now - last) / 1000); last = now;
    for (let i = 0; i < 4; i++){ const h = dt / 4; v += (-cfg.k * (x - to) - cfg.c * v) * h; x += v * h; }
    on(x);
    if (Math.abs(x - to) < .0008 && Math.abs(v) < .002){ on(to); done && done(); return; }
    requestAnimationFrame(step);
  })(performance.now());
}
const mobile = () => innerWidth < 768;
function viewport(){
  const pos = mobile() ? 'bottom-center' : 'top-right';
  let vp = document.querySelector('.vp[data-pos="'+pos+'"]');
  if (!vp){ vp = document.createElement('section'); vp.className='vp'; vp.dataset.pos = pos; vp.setAttribute('aria-live','polite'); vp.setAttribute('aria-label','Notifications'); document.body.append(vp); }
  return vp;
}
const alertRegion = document.getElementById('sr-alert');
function toast(o){
  const vp = viewport(), id = 'g' + (++uid), dir = vp.dataset.pos.startsWith('top') ? 'down' : 'up';
  const el = document.createElement('div');
  el.className = 't'; el.dataset.dir = dir;
  el.innerHTML = '<svg aria-hidden="true"><defs><filter id="'+id+'" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur in="SourceGraphic" stdDeviation="'+SPR.goo+'" result="b"/><feColorMatrix in="b" values="1 0 0 0 0 0 1 0 0 0 0 0 1 0 0 0 0 0 24 -11" result="g"/><feComposite in="SourceGraphic" in2="g" operator="atop"/></filter></defs><g filter="url(#'+id+')"><rect class="p"/><rect class="b"/></g></svg>'
    + '<div class="t-head"></div><div class="t-body"></div>' + (window.DECOR ? DECOR : '');
  vp.append(el);
  fill(el, o);
  const st = { e: 0, p: 0 };
  el._st = st;
  const draw = () => {
    const W = el.clientWidth, pw = el._pw, bh = el._bh, e = st.e, H = 40 + Math.max(0, bh * e);
    el.style.height = H + 'px';
    const pr = el.querySelector('rect.p'), br = el.querySelector('rect.b');
    const py = dir === 'down' ? 0 : H - 40;
    pr.setAttribute('x', 0); pr.setAttribute('y', py); pr.setAttribute('width', pw); pr.setAttribute('height', 40); pr.setAttribute('rx', SPR.pillR);
    const bw = pw + (W - pw) * Math.min(1, Math.max(0, e)), bhh = Math.max(0, bh * e);
    br.setAttribute('x', 0); br.setAttribute('width', bw); br.setAttribute('rx', Math.min(SPR.bodyR, bhh / 2));
    br.setAttribute('height', bhh > 1 ? bhh + 12 : 0); br.setAttribute('y', dir === 'down' ? 28 : H - 40 - bhh);
    const body = el.querySelector('.t-body');
    body.style.opacity = Math.max(0, Math.min(1, (e - .5) / .45));
    body.style.transform = 'translateY(' + ((1 - Math.min(1, e)) * (dir === 'down' ? -6 : 6)) + 'px)';
    el.style.opacity = Math.min(1, st.p * 1.4);
    el.style.transform = 'translateY(' + ((1 - st.p) * (dir === 'down' ? -16 : 16)) + 'px) scale(' + (.92 + .08 * st.p) + ')';
    el.dataset.e = e.toFixed(2);
    window.onDraw && onDraw(el, st);
  };
  el._draw = draw; draw();
  spring(0, 1, SPR.enter, v => { st.p = v; draw(); });
  setTimeout(() => expand(el, 1), RM ? 0 : SPR.expandDelay);
  if (o.state === 'error') { alertRegion.textContent = ''; setTimeout(() => alertRegion.textContent = o.title + '. ' + o.descText, 50); }
  arm(el, o);
  return el;
}
function fill(el, o){
  el.dataset.state = o.state;
  el.querySelector('.t-head').innerHTML = '<span class="t-badge"><svg viewBox="0 0 24 24">' + ICON[o.state] + '</svg></span><span class="t-title">' + o.title + '</span>' + (o.stamp ? '<span class="t-stamp num">' + o.stamp + '</span>' : '');
  el.querySelector('.t-body').innerHTML = '<p class="t-desc">' + o.desc + '</p>' + (o.button ? '<button class="t-btn" type="button">' + o.button + '</button>' : '') + (o.extra || '');
  el._pw = el.querySelector('.t-head').offsetWidth;
  el._bh = el.querySelector('.t-body').offsetHeight;
  const b = el.querySelector('.t-btn'); if (b && o.onButton) b.onclick = () => o.onButton(el);
  window.onFill && onFill(el, o);
}
function expand(el, to, done){ spring(el._st.e, to, SPR.expand, v => { el._st.e = v; el._draw(); }, done); }
function arm(el, o){
  clearTimeout(el._t);
  if (o.duration == null) return;
  let left = o.duration, t0 = Date.now();
  const go = () => { el._t = setTimeout(() => dismiss(el), left); t0 = Date.now(); };
  el.onmouseenter = el.onfocusin = () => { clearTimeout(el._t); left -= Date.now() - t0; };
  el.onmouseleave = el.onfocusout = () => { if (!el.matches(':hover,:focus-within')) go(); };
  go();
}
function dismiss(el){ expand(el, 0, () => spring(el._st.p, 0, SPR.exit, v => { el._st.p = v; el._draw(); }, () => el.remove())); }
function morph(el, o){ expand(el, 0, () => { fill(el, o); el._draw(); expand(el, 1); arm(el, o); }); }
`;

const page = (d) => `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${d.title}</title>
<style>${BASE_CSS}${d.css}</style></head>
<body class="${d.cls}">
${d.body}
<div id="sr-alert" class="sr" role="alert"></div>
<p class="dir-tag">${d.tag}</p>
<button class="replay" type="button" onclick="play()">Replay toasts</button>
<script>
${ENGINE(d.springs)}
${d.js || ""}
const T = ${JSON.stringify(d.toasts)};
function play(){
  document.querySelectorAll('.vp').forEach(v => v.remove());
  setTimeout(() => toast(T.success), 350);
  setTimeout(() => toast(Object.assign({}, T.error, { onButton: el => {
    morph(el, T.retrying);
    setTimeout(() => morph(el, T.saved), 1300);
  }})), 1100);
}
play();
</script>
</body></html>`;

const row = (name, set, extra) => `
<section class="inv" aria-label="Inventory row sample">
  <p class="slice-label">Dashboard, inventory</p>
  <div class="row">
    <div class="card c-moon"><div class="art"></div></div>
    <div><p class="name">${name}</p><p class="meta"><span>${set}</span><span class="badge b-cond">NM</span>${extra}</p></div>
    <div class="price"><span class="num">$1,240.00</span><small class="num">Mkt $1,302.10</small></div>
  </div>
</section>`;

const ITEM = "Lunar Fox V-Star";
const SET = "Twilight Drift 189/203";

// ---------------- Direction A: Night market ----------------
const A = {
  title: "Night Market",
  tag: "Direction A: Card-shop night market",
  cls: "a",
  springs: { enter: { k: 170, c: 21 }, expand: { k: 150, c: 20 }, exit: { k: 220, c: 30 }, expandDelay: 220, goo: 6, pillR: 20, bodyR: 22 },
  css: `
.a{background:radial-gradient(120% 70% at 85% 10%,#2a1608 0%,transparent 55%),radial-gradient(90% 60% at 10% 100%,#1a0f14 0%,transparent 60%),var(--bg)}
.lights{position:absolute;inset:0 0 auto;height:120px;pointer-events:none;overflow:hidden}
.lights svg{width:100%;height:100%}
.bulb{fill:#ffb36b;filter:drop-shadow(0 0 6px #ff8a2a) drop-shadow(0 0 14px rgb(247 124 16/.55))}
@media(prefers-reduced-motion:no-preference){.bulb{animation:flicker 5s ease-in-out infinite}.bulb:nth-child(3n){animation-delay:-1.7s}.bulb:nth-child(4n){animation-delay:-3.1s}}
@keyframes flicker{0%,100%{opacity:1}50%{opacity:.72}}
.hero{position:relative;display:grid;gap:28px;padding:36px 0 8px}
@media(min-width:900px){.hero{grid-template-columns:1.15fr 1fr;align-items:center;padding:64px 0 16px}}
.hero h1{font-size:clamp(40px,7.4vw,76px);line-height:.98;font-weight:800;font-stretch:108%;letter-spacing:-.025em;text-wrap:balance}
.hero h1 em{font-style:normal;color:#ffb070}
.hero p.sub{margin-top:18px;font-size:18px;line-height:27px;color:var(--muted);max-width:34ch}
.hero .acts{margin-top:26px;display:flex;flex-wrap:wrap;gap:14px;align-items:center}
.hero .acts a{color:var(--accent-hover);font-weight:600;text-decoration:none}
.table-scene{position:relative;height:220px;display:flex;justify-content:center;align-items:flex-end}
@media(min-width:900px){.table-scene{height:380px}}
.table-scene::before{content:"";position:absolute;left:4%;right:4%;bottom:0;height:44%;border-radius:50% 50% 14px 14px/26% 26% 14px 14px;background:radial-gradient(80% 120% at 50% 0%,#3a2210,#170f0b 70%);box-shadow:inset 0 1px 0 rgb(255 196 140/.18)}
.table-scene::after{content:"";position:absolute;left:20%;right:20%;top:6%;height:60%;background:radial-gradient(closest-side,rgb(247 124 16/.28),transparent);filter:blur(6px)}
.fan{position:relative;z-index:1;display:flex;margin-bottom:9%}
.fan .card{width:clamp(84px,11vw,150px);margin:0 -14px}
.fan .card:nth-child(1){transform:rotate(-9deg) translateY(10px)}.fan .card:nth-child(2){transform:rotate(-3deg)}.fan .card:nth-child(3){transform:rotate(3deg)}.fan .card:nth-child(4){transform:rotate(9deg) translateY(10px)}
.tag{position:absolute;z-index:2;right:14%;bottom:30%;transform:rotate(6deg);background:#f6e7d2;color:#2a1608;border-radius:4px 10px 10px 4px;padding:6px 12px 6px 18px;font-weight:800;font-size:15px;box-shadow:0 8px 18px -6px rgb(0 0 0/.7)}
.tag::before{content:"";position:absolute;left:6px;top:50%;width:6px;height:6px;margin-top:-3px;border-radius:50%;background:#2a1608}
.a .row{background:linear-gradient(#17120f,#141018);box-shadow:inset 0 1px 0 rgb(255 196 140/.08)}
.a .t{--fill:#20160f}
.a .t-badge{box-shadow:0 0 14px color-mix(in oklch,var(--tone) 55%,transparent)}
.a .t-title{font-weight:700}
.a .t[data-state="error"]{--fill:#24130f}
`,
  body: `
<div class="lights" aria-hidden="true"><svg viewBox="0 0 1200 120" preserveAspectRatio="xMidYMin slice">
<path d="M0 18 Q300 92 600 40 T1200 30" fill="none" stroke="#4a3526" stroke-width="1.5"/>
${Array.from({ length: 16 }, (_, i) => { const x = 40 + i * 75; const y = x < 600 ? 18 + 74 * Math.sin((x / 600) * Math.PI) * 0.62 : 40 - 10 * ((x - 600) / 600) + 22 * Math.sin(((x - 600) / 600) * Math.PI); return `<circle class="bulb" cx="${x}" cy="${y.toFixed(1)}" r="4"/>`; }).join("")}
</svg></div>
<div class="wrap" style="position:relative">
<header class="top"><p class="wordmark">shoptcg<span>.app</span></p><button class="ghost">Vendor sign in</button></header>
<section class="hero">
  <div>
    <h1>Your table's open. <em>Prices are live.</em></h1>
    <p class="sub">Lay out cards, slabs and sealed at tonight's market price. Buyers scan your sign, pick what they like and give you a nudge. You shake on it at the table.</p>
    <div class="acts"><button class="cta">Open your table</button><a href="#">Walk a demo table</a></div>
  </div>
  <div class="table-scene" aria-hidden="true">
    <div class="fan"><div class="card c-tide"><div class="art"></div><div class="ln"></div><div class="ln s"></div></div><div class="card c-moon"><div class="art"></div><div class="ln"></div><div class="ln s"></div></div><div class="card c-sun"><div class="art"></div><div class="ln"></div><div class="ln s"></div></div><div class="card c-leaf"><div class="art"></div><div class="ln"></div><div class="ln s"></div></div></div>
    <div class="tag num">$42</div>
  </div>
</section>
${row(ITEM, SET, '<span class="badge b-deal">Good deal</span><span>3 on the table</span>')}
</div>`,
  toasts: {
    success: { state: "success", title: "On the table", desc: `<b>${ITEM}</b>, NM. 3 copies at <span class="num">$1,240.00</span>. Buyers can see it now.`, duration: 5000 },
    error: { state: "error", title: "That didn't save", desc: "The hall WiFi blinked. Your change is still here.", descText: "The hall WiFi blinked. Your change is still here.", button: "Try again", duration: null },
    retrying: { state: "loading", title: "Saving", desc: "One moment.", duration: null },
    saved: { state: "success", title: "Saved", desc: "All good. Price updated on your table.", duration: 4000 },
  },
};

// ---------------- Direction B: Grading lab ----------------
const B = {
  title: "Grading Lab",
  tag: "Direction B: Grading lab",
  cls: "b",
  springs: { enter: { k: 420, c: 41 }, expand: { k: 380, c: 39 }, exit: { k: 500, c: 45 }, expandDelay: 140, goo: 4, pillR: 7, bodyR: 8 },
  css: `
.b{background:
 linear-gradient(rgb(126 132 139/.06) 1px,transparent 1px) 0 0/100% 32px,
 linear-gradient(90deg,rgb(126 132 139/.06) 1px,transparent 1px) 0 0/32px 100%,var(--bg)}
.hero{display:grid;gap:28px;padding:36px 0 8px}
@media(min-width:900px){.hero{grid-template-columns:1.1fr 1fr;align-items:center;padding:56px 0 16px}}
.eyebrow{display:inline-flex;gap:10px;align-items:center;font-size:12px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:var(--subtle);border-top:1px solid var(--border-strong);border-bottom:1px solid var(--border-strong);padding:6px 0}
.eyebrow .dot{width:6px;height:6px;background:var(--success);border-radius:50%}
.hero h1{margin-top:18px;font-size:clamp(40px,7vw,74px);line-height:.96;font-weight:800;font-stretch:125%;letter-spacing:-.02em;text-wrap:balance}
.hero h1 .cond{display:block;font-stretch:72%;font-weight:600;color:var(--muted);letter-spacing:0}
.hero p.sub{margin-top:18px;font-size:17px;line-height:26px;color:var(--muted);max-width:40ch}
.hero .acts{margin-top:24px;display:flex;gap:16px;align-items:center;flex-wrap:wrap}
.hero .acts .meta{font-size:13px;color:var(--subtle)}
.cta{border-radius:6px}
.slab{justify-self:center;width:min(300px,62vw);aspect-ratio:3/5;border-radius:12px;padding:12px;background:linear-gradient(160deg,rgb(230 234 240/.16),rgb(230 234 240/.04));border:1px solid rgb(230 234 240/.22);box-shadow:inset 0 1px 0 rgb(255 255 255/.18),0 30px 60px -24px #000;position:relative}
.slab .label{display:grid;grid-template-columns:1fr auto;gap:2px 10px;align-items:end;background:#e9ecf1;color:#111;border-radius:5px;padding:8px 10px;font-size:11px;font-weight:600}
.slab .label b{font-size:13px;font-stretch:112%;font-weight:800}
.slab .label .g{grid-row:1/3;grid-column:2;font-size:30px;font-weight:800;font-stretch:80%;line-height:1}
.slab .well{margin-top:10px;height:calc(100% - 64px);border-radius:6px;background:rgb(0 0 0/.35);display:grid;place-items:center;box-shadow:inset 0 0 0 1px rgb(255 255 255/.06)}
.slab .card{width:76%}
.ruler{position:absolute;right:-26px;top:12px;bottom:12px;width:14px;background:repeating-linear-gradient(to bottom,var(--border-strong) 0 1px,transparent 1px 8px);mask:linear-gradient(90deg,#000 40%,transparent 41%,transparent 100%)}
@media(max-width:899px){.slab{width:min(190px,50vw)}.hero{grid-template-columns:1fr}.slab-wrap{display:flex;gap:20px;align-items:center}}
.b .row{border-radius:6px;background:var(--surface);box-shadow:inset 0 0 0 1px var(--border)}
.cert{font-size:12px;color:var(--subtle)}
.b .t{--fill:#151622}
.t-stamp{margin-left:6px;padding-left:10px;border-left:1px solid var(--border-strong);font-size:12px;color:var(--subtle);font-weight:600}
.b .t-title{font-stretch:112%;font-weight:750;letter-spacing:.01em}
.b .t-badge{border-radius:5px}
.ticks{margin-top:12px;height:6px;background:repeating-linear-gradient(90deg,var(--border-strong) 0 1px,transparent 1px 6px);opacity:.7;transform-origin:left;transform:scaleX(var(--tk,0))}
.spec{display:grid;grid-template-columns:auto 1fr;gap:2px 12px;margin-top:8px;font-size:13px}
.spec dt{color:var(--subtle)}.spec dd{color:var(--text);text-align:right}
`,
  body: `
<div class="wrap">
<header class="top"><p class="wordmark">shoptcg<span>.app</span></p><button class="ghost">Vendor sign in</button></header>
<section class="hero">
  <div>
    <p class="eyebrow"><span class="dot"></span>Market sync 02:00 nightly</p>
    <h1>Priced to the cent. <span class="cond">Raw, graded, sealed.</span></h1>
    <p class="sub">Every item on your table carries a live market price and your rule on top. Buyers scan, pick and request. You confirm; the receipt files itself.</p>
    <div class="acts"><button class="cta">Create your store</button><span class="meta num">50 items in under 15 min</span></div>
  </div>
  <div class="slab-wrap" aria-hidden="true" style="justify-self:center">
    <div class="slab"><div class="label"><b>LUNAR FOX V-STAR</b><span class="g num">10</span><span class="num">TWD 189 &middot; CERT 0004 2187</span></div><div class="well"><div class="card c-moon"><div class="art"></div><div class="ln"></div><div class="ln s"></div></div></div><div class="ruler"></div></div>
  </div>
</section>
${row(ITEM, SET, '<span class="badge b-deal">4.8% under mkt</span><span class="cert num">Qty 3</span>')}
</div>`,
  js: `window.onDraw=(el,st)=>{const t=el.querySelector('.ticks');if(t)t.style.setProperty('--tk',Math.max(0,Math.min(1,(st.e-.3)/.7)))};`,
  toasts: {
    success: { state: "success", title: "Logged", stamp: "#0187", desc: `<b>${ITEM}</b>`, extra: '<dl class="spec"><dt>Condition</dt><dd>NM</dd><dt>Qty</dt><dd class="num">3</dd><dt>Your price</dt><dd class="num">$1,240.00</dd><dt>Vs market</dt><dd class="num">-4.8%</dd></dl><div class="ticks"></div>', duration: 5000 },
    error: { state: "error", title: "Not saved", stamp: "ERR 504", desc: "No response after 8 s. Your edit is held on this device.", descText: "No response after 8 seconds. Your edit is held on this device.", button: "Retry", duration: null },
    retrying: { state: "loading", title: "Saving", desc: "Writing 1 change.", duration: null },
    saved: { state: "success", title: "Saved", stamp: "#0187", desc: "1 change written. Price live on your store.", duration: 4000 },
  },
};

// ---------------- Direction C: Booster rip ----------------
const C = {
  title: "Booster Rip",
  tag: "Direction C: Booster rip",
  cls: "c",
  springs: { enter: { k: 560, c: 30 }, expand: { k: 420, c: 30 }, exit: { k: 600, c: 50 }, expandDelay: 120, goo: 7, pillR: 20, bodyR: 20 },
  css: `
.c{background:radial-gradient(70% 50% at 70% 30%,#1a1430,transparent 70%),var(--bg)}
.crimp{height:14px;background:var(--surface-2);mask:conic-gradient(from -45deg at bottom,#0000,#000 1deg 89deg,#0000 90deg) 50%/14px 100%}
.hero{display:grid;gap:24px;padding:28px 0 8px}
@media(min-width:900px){.hero{grid-template-columns:1.2fr 1fr;align-items:center;padding:52px 0 16px}}
.hero h1{font-size:clamp(46px,9vw,96px);line-height:.9;font-weight:900;font-stretch:125%;letter-spacing:-.03em;text-transform:uppercase}
.hero h1 span{display:block}.hero h1 span:nth-child(2){color:var(--accent)}
@media(prefers-reduced-motion:no-preference){.hero h1 span{animation:slam .55s var(--ease-expo) both}.hero h1 span:nth-child(2){animation-delay:.08s}.hero h1 span:nth-child(3){animation-delay:.16s}}
@keyframes slam{from{opacity:0;transform:translateY(.25em) skewY(4deg)}}
.hero p.sub{margin-top:18px;font-size:18px;line-height:27px;color:var(--muted);max-width:36ch}
.hero .acts{margin-top:24px;display:flex;gap:14px;align-items:center;flex-wrap:wrap}
.pack{position:relative;justify-self:center;width:min(300px,64vw);height:clamp(190px,30vw,380px)}
.pack .wrapper{position:absolute;inset:auto 0 0;height:62%;border-radius:6px 6px 10px 10px;background:
 repeating-linear-gradient(115deg,oklch(.62 .14 30) 0 8%,oklch(.66 .14 95) 8% 16%,oklch(.62 .12 165) 16% 24%,oklch(.58 .13 250) 24% 32%,oklch(.58 .14 320) 32% 40%);background-size:240% 240%;box-shadow:0 30px 60px -24px #000}
.pack .wrapper::before{content:"";position:absolute;inset:0;border-radius:inherit;background:linear-gradient(180deg,rgb(9 9 17/.35),rgb(9 9 17/.85))}
.pack .wrapper::after{content:"";position:absolute;left:0;right:0;top:-10px;height:12px;background:inherit;background-size:240% 240%;mask:conic-gradient(from 135deg at top,#0000,#000 1deg 89deg,#0000 90deg) 50%/12px 100%}
.pack .wl{position:absolute;left:12%;bottom:14%;font-weight:900;font-stretch:125%;font-size:clamp(16px,2.2vw,24px);letter-spacing:.04em;color:var(--text);z-index:1}
.pack .card{position:absolute;width:44%;left:28%;bottom:28%;transform:rotate(-6deg)}
.pack .card.two{left:38%;bottom:34%;transform:rotate(8deg)}
@media(prefers-reduced-motion:no-preference){.pack .card{animation:rise .9s var(--ease-expo) .25s both}.pack .card.two{animation-delay:.38s}.pack .wrapper{animation:foil 6s linear infinite}}
@keyframes rise{from{transform:translateY(55%) rotate(0)}}
@keyframes foil{to{background-position:240% 0}}
.c .row{background:var(--surface);position:relative;overflow:hidden}
.c .t{--fill:#171427}
.c .t-title{font-weight:800;font-stretch:118%;text-transform:uppercase;letter-spacing:.03em;font-size:13px}
.t .foil{position:absolute;z-index:3;left:0;top:0;height:40px;border-radius:20px;pointer-events:none;mix-blend-mode:color-dodge;opacity:0;
 background:linear-gradient(105deg,transparent 30%,oklch(.85 .12 95/.8) 42%,oklch(.82 .11 165/.8) 50%,oklch(.78 .13 320/.8) 58%,transparent 70%);background-size:300% 100%}
.t[data-dir="up"] .foil{top:auto;bottom:0}
.t.sweep .foil{animation:sweep 900ms var(--ease-out) 1 both}
@keyframes sweep{0%{opacity:.9;background-position:100% 0}100%{opacity:0;background-position:0 0}}
@media(prefers-reduced-motion:reduce){.t.sweep .foil{animation:none}}
.t.nudge{animation:nudge .32s var(--ease-out) 1}
@keyframes nudge{30%{translate:-3px 0}60%{translate:2px 0}}
@media(prefers-reduced-motion:reduce){.t.nudge{animation:none}}
`,
  body: `
<div class="crimp" aria-hidden="true"></div>
<div class="wrap">
<header class="top"><p class="wordmark">shoptcg<span>.app</span></p><button class="ghost">Vendor sign in</button></header>
<section class="hero">
  <div>
    <h1><span>Rip.</span><span>List.</span><span>Sell out.</span></h1>
    <p class="sub">Your whole table, live-priced in minutes. Buyers scan, stack a list and ping you. You close it at the table.</p>
    <div class="acts"><button class="cta">Start your store</button></div>
  </div>
  <div class="pack" aria-hidden="true">
    <div class="card c-sun"><div class="art"></div><div class="ln"></div><div class="ln s"></div></div>
    <div class="card two c-tide"><div class="art"></div><div class="ln"></div><div class="ln s"></div></div>
    <div class="wrapper"></div><p class="wl">YOUR TABLE</p>
  </div>
</section>
${row(ITEM, SET, '<span class="badge b-deal">Below market</span><span>x3</span>')}
</div>`,
  js: `window.DECOR='<span class="foil" aria-hidden="true"></span>';
window.onFill=(el,o)=>{const f=el.querySelector('.foil');f.style.width=el._pw+'px';el.classList.remove('sweep','nudge');void el.offsetWidth;if(o.state==='success')el.classList.add('sweep');if(o.state==='error')el.classList.add('nudge')};`,
  toasts: {
    success: { state: "success", title: "Pulled to your table", desc: `<b>${ITEM}</b> x3, <span class="num">$1,240.00</span> each. Live for buyers now.`, duration: 5000 },
    error: { state: "error", title: "Snagged", desc: "That save didn't go through. Nothing's lost.", descText: "That save didn't go through. Nothing's lost.", button: "Retry", duration: null },
    retrying: { state: "loading", title: "Saving", desc: "Hang on.", duration: null },
    saved: { state: "success", title: "Locked in", desc: "Price is live on your table.", duration: 4000 },
  },
};

for (const [f, d] of [["direction-a.html", A], ["direction-b.html", B], ["direction-c.html", C]]) {
  fs.writeFileSync(`${OUT}/${f}`, page(d));
  console.log(f, (fs.statSync(`${OUT}/${f}`).size / 1024).toFixed(0) + "KB");
}
