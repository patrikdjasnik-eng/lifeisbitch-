const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
(async()=>{
 fs.mkdirSync('ui-reports',{recursive:true});
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||undefined,args:['--no-sandbox','--disable-webgl']});
 const page=await browser.newPage({viewport:{width:1440,height:900}});page.setDefaultTimeout(90000);
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:8766/web/',{waitUntil:'load',timeout:120000});await page.evaluate(()=>document.fonts.ready);console.log('UI loaded (2D fallback for headless runner)');
 console.log('Capturing UI');await page.screenshot({path:'ui-reports/01-menu.png'});
 await page.fill('#characterName','Žižkov Tester');await page.click('#start');
 await page.evaluate(()=>{complete=true;player.xp=3000;updateHud();});await page.click('#careers');
 await page.getByRole('button',{name:'PRÁCE · Poctivá cesta · 0/20',exact:true}).click();
 await page.screenshot({path:'ui-reports/02-careers.png'});
 await page.getByRole('button',{name:'Přijmout · První výplata',exact:true}).click();
 await page.screenshot({path:'ui-reports/03-hud.png'});
 await page.evaluate(()=>{player.x=mission().x;player.y=mission().y;interact();});
 await page.getByRole('button',{name:'Převzít doporučení od Dany',exact:true}).click();
 await page.reload({waitUntil:'load'});assert.equal(await page.evaluate(()=>careerState.active.stage),1);
 await page.click('#start');await page.keyboard.press('Tab');await page.screenshot({path:'ui-reports/04-scoreboard.png'});await page.keyboard.press('Escape');
 await page.evaluate(()=>{if(!paused)togglePause();});await page.click('#accountButton');await page.screenshot({path:'ui-reports/05-account.png'});await page.click('#accountClose');
 await page.setViewportSize({width:844,height:390});await page.addStyleTag({path:'android/app/src/main/mobile/mobile.css'});await page.addScriptTag({path:'android/app/src/main/mobile/mobile.js'});
 await page.screenshot({path:'ui-reports/06-mobile-menu.png'});await page.click('#start');await page.screenshot({path:'ui-reports/07-mobile-hud.png'});
 
 const layout=await page.evaluate(()=>{
   const panel=document.querySelector('.touch').getBoundingClientRect(),map=minimapBounds();
   return {buttons:[...document.querySelectorAll('.touch button')].map(b=>{const r=b.getBoundingClientRect();return r.width>=44&&r.height>=44&&r.left>=0&&r.top>=0&&r.right<=innerWidth&&r.bottom<=innerHeight&&document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)===b;}),mapClear:map.y+map.width+8<=panel.top};
 });
 assert.ok(layout.buttons.every(Boolean),'Touch controls must be visible, large enough and unobstructed');
 assert.equal(layout.mapClear,true,'Minimap overlaps touch controls');
 const mapBefore=await page.evaluate(()=>mapExpanded);await page.click('#touchMap');assert.equal(await page.evaluate(()=>mapExpanded),!mapBefore);

 assert.equal(await page.locator('#betaBadge').isVisible(),true);
 assert.deepEqual(errors,[]);console.log('PASS: 2D fallback browser name/start, career menu, objective interaction, reload persistence, scoreboard, account, landscape mobile and BETA.');
 
 const launcher=await browser.newPage({viewport:{width:1000,height:700}});
 await launcher.addInitScript(()=>{window.launcher={onStatus:cb=>cb({text:'Hra je připravená.',progress:100,busy:false,version:'BETA'}),check:async()=>{},play:async()=>{}};});
 await launcher.goto('http://127.0.0.1:8766/desktop/launcher.html');
 await launcher.evaluate(()=>document.fonts.ready);
 assert.equal(await launcher.locator('#play').isEnabled(),true);
 await launcher.screenshot({path:'ui-reports/08-launcher.png'});

 await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
