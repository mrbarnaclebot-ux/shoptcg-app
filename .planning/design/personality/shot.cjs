const { chromium } = require('C:/Users/Uzi/Documents/GitHub/shoptcg-app/node_modules/@playwright/test');
const D = 'C:/Users/Uzi/Documents/GitHub/shoptcg-app/.planning/design/personality/';
(async () => {
  const b = await chromium.launch();
  for (const d of ['a','b','c']) for (const w of [390,1280]) {
    const p = await b.newPage({ viewport: { width: w, height: w===390?844:800 } });
    const errs=[]; p.on('pageerror',e=>errs.push(e.message)); p.on('console',m=>m.type()==='error'&&errs.push(m.text()));
    await p.goto('file:///'+D+'direction-'+d+'.html');
    await p.waitForTimeout(2300);
    await p.screenshot({ path: D+'shots/direction-'+d+'-'+w+'.png' });
    if (errs.length) console.log(d,w,errs);
    await p.close();
  }
  await b.close();
})();
