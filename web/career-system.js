/* Fictional story quests. No network; deterministic, validated local progress. */
(function(root){
'use strict';
const places={
 neon:[210,350,'Viktor · Neon'],service:[1065,350,'Pavel · autoservis'],butcher:[665,350,'Karel · řeznictví'],
 food:[665,1150,'Eliška · potraviny'],office:[465,1550,'Dana · úřad práce'],school:[1265,750,'Školník · Žižkov'],
 laundry:[1265,1550,'Irena · prádelna'],bank:[1465,1550,'Lenka · banka'],mall:[1665,1550,'Vedoucí · obchodní centrum'],
 park:[5265,7750,'Lucie · park Vinohrady'],cafe:[4465,7350,'Hana · kavárna'],vinyl:[1265,7750,'Roman · Karlín'],
 gallery:[7465,4350,'Nela · galerie'],courtyard:[2465,1950,'Marek · dvůr'],roof:[3265,2350,'Tereza · vyhlídka'],
 garage:[4465,1950,'Ondra · garáže'],club:[8865,8350,'Lea · klub Vinohrady'],hotel:[13265,4350,'Recepční · Nové Město'],
 docks:[5265,15150,'Boris · doky'],warehouse:[6465,15550,'Správce · sklad'],square:[8465,7550,'Sousedé · Vinohrady'],
 shelter:[2865,3550,'Petra · komunitní centrum'],press:[14665,5550,'David · redakce'],depot:[1265,14750,'Dispečer · depo']
};
// title, briefing, three places, three interactions. Every episode has an individual narrative.
const dealer=[
 ['Druhá noc','Viktor má další nabídku. Nejdřív zjisti, co od tebe čekají.',['neon','courtyard','neon'],['Vyslechnout Viktorovu nabídku','Promluvit s Markem o zásilce','Převzít odměnu za první pochůzku']],
 ['Cizí slib','Kontakt v Karlíně tvrdí, že mu Viktor něco slíbil.',['neon','vinyl','courtyard'],['Zjistit, proč Roman čeká','Vyslechnout Romanovu verzi','Předat Markovi zprávu bez dalších slibů']],
 ['Praskliny','Eliška si všimla, že chodíš domů pozdě.',['food','laundry','neon'],['Vyslechnout Eliščiny obavy','Svěřit se Ireně','Říct Viktorovi, že rodina není součást dohody']],
 ['Zásilka pro Leu','Lea očekává herní zásilku a vysvětlení zpoždění.',['courtyard','club','neon'],['Převzít herní zásilku','Předat zásilku Lee','Uzavřít zakázku s Viktorem']],
 ['Dluh na papíře','Marek nesouhlasí s tím, co mu bylo započítáno.',['courtyard','vinyl','neon'],['Přečíst Markovu stížnost','Ověřit Romanovo svědectví','Dohodnout opravu účtu']],
 ['Prázdné místo','Romanův kamarád se neozývá. Zakázka tentokrát počká.',['vinyl','shelter','cafe'],['Zjistit, koho Roman hledá','Zeptat se Petry na kamaráda','Předat zprávu, že je v pořádku']],
 ['Pozvánka za město','Boris chce osobní schůzku v docích.',['neon','docks','laundry'],['Převzít vzkaz od Borise','Vyslechnout podmínky spolupráce','Probrat nabídku s Irenou']],
 ['Hranice důvěry','Nela odmítá zatahovat galerii do Viktorových problémů.',['gallery','courtyard','gallery'],['Vyslechnout Nelino odmítnutí','Vrátit Markovi nevyřízenou žádost','Potvrdit Nele, že její rozhodnutí platí']],
 ['Drahá noc','Nová zakázka z Vinohrad přináší větší tlak.',['club','roof','club'],['Převzít herní zásilku od Ley','Předat zásilku dospělému kontaktu','Vyúčtovat večerní zakázku']],
 ['Starý kamarád','Ondra chce ven z dluhů, ale nechce další risk.',['garage','service','garage'],['Vyslechnout Ondrovu prosbu','Zjistit, zda Pavel hledá výpomoc','Předat Ondrovi nabídku práce']],
 ['Pověst','Po čtvrti koluje příběh, který se nestal.',['courtyard','cafe','neon'],['Zjistit, co Marek slyšel','Vyslechnout svědkyni Hanu','Vyjasnit s Viktorem nedorozumění']],
 ['Nesplněná dohoda','Boris tvrdí, že jeho zakázka zůstala nedokončená.',['docks','warehouse','docks'],['Vyslechnout Borisovu reklamaci','Zeptat se správce na chybějící zásilku','Dohodnout ukončení sporu']],
 ['Rodinný stůl','Eliška potřebuje pomoc, žádné velké řeči.',['food','butcher','food'],['Zjistit, co doma chybí','Vyzvednout předem zaplacený nákup','Doručit rodině nákup']],
 ['Za zavřeným klubem','Lea ruší večer. Je třeba uzavřít rozdělanou zakázku.',['club','courtyard','club'],['Převzít vrácenou herní zásilku','Vrátit ji Markovi','Potvrdit Lee uzavření zakázky']],
 ['Cena jména','Viktor si přisvojuje tvoji práci a kontakty.',['neon','roof','neon'],['Vyslechnout Viktorův plán','Probrat situaci s Terezou','Vymezit si vlastní podmínky']],
 ['Druhá šance','Roman se chce omluvit člověku, kterému ublížil.',['vinyl','shelter','vinyl'],['Převzít Romanův vzkaz','Předat vzkaz Petře','Přinést Romanovi odpověď']],
 ['Poslední velká noc','Lea nabízí závěrečnou zakázku celé série.',['club','hotel','club'],['Převzít herní zásilku','Předat zásilku dospělému kontaktu před hotelem','Uzavřít s Leou vyúčtování']],
 ['Ticho po dešti','Irena chce slyšet, co ti ulice skutečně dala.',['laundry','roof','food'],['Promluvit s Irenou o posledních nocích','Setkat se s Terezou na vyhlídce','Vrátit se za Eliškou']],
 ['Účet s Viktorem','Je čas uzavřít všechny staré dohody.',['neon','docks','neon'],['Sepsat s Viktorem otevřené závazky','Vyžádat od Borise potvrzení','Uzavřít poslední společný účet']],
 ['Vlastní jméno','Tahle kapitola končí. O dalším životě rozhoduješ ty.',['roof','shelter','neon'],['Promluvit s Terezou o budoucnosti','Vyslechnout nabídku komunitní práce','Ukončit Viktorovu kapitolu']]
];
const worker=[
 ['První výplata','Dana ti našla směnu v autoservisu.',['office','service','office'],['Převzít doporučení od Dany','Pomoci Pavlovi roztřídit nářadí','Potvrdit odpracovanou směnu']],
 ['Ranní zásobování','Karel potřebuje pomoc s objednávkou pro bistro.',['butcher','cafe','butcher'],['Vyzvednout připravenou objednávku','Předat objednávku Haně','Odevzdat potvrzení a převzít výplatu']],
 ['Čistý dvůr','Sousedé pořádají společný úklid.',['office','courtyard','office'],['Zapsat se na úklid','Pomoci sousedům uklidit dvůr','Odevzdat pracovní výkaz']],
 ['Knihy pro školu','Školník potřebuje odvézt darované učebnice.',['school','shelter','school'],['Zjistit seznam potřebných knih','Vyzvednout krabici učebnic','Předat knihy školníkovi']],
 ['Pneumatiky','Autoservis dokončuje větší objednávku.',['service','garage','service'],['Převzít Pavlův pracovní list','Pomoci Ondrovi připravit pneumatiky','Odevzdat dokončený pracovní list']],
 ['Směna v kavárně','Hana hledá spolehlivou výpomoc.',['cafe','food','cafe'],['Převzít seznam zásob','Vyzvednout zaplacené suroviny','Doplnit zásoby a dokončit směnu']],
 ['Ztracená peněženka','Při úklidu parku se našla peněženka.',['park','office','park'],['Převzít nalezenou peněženku','Odevzdat nález Daně','Vrátit Lucii potvrzení o odevzdání']],
 ['Prádlo na ráno','Irena má objednávku pro hotel.',['laundry','hotel','laundry'],['Vyzvednout čisté hotelové prádlo','Předat prádlo recepční','Odevzdat dodací list']],
 ['Světla výlohy','Centrum opravuje osvětlení před večerním otevřením.',['mall','service','mall'],['Převzít požadavek vedoucího','Vyzvednout připravené součástky','Pomoci údržbáři dokončit opravu']],
 ['Sobotní trh','Na Vinohradech se chystá sousedský trh.',['square','warehouse','square'],['Zjistit rozmístění stánků','Vyzvednout skládací stoly','Pomoci připravit tržiště']],
 ['Noční inventura','Správce skladu potřebuje přesný soupis.',['warehouse','docks','warehouse'],['Převzít inventurní seznam','Ověřit označenou dodávku u Borise','Odevzdat dokončený soupis']],
 ['Dopisy sousedům','Komunitní centrum zve obyvatele na setkání.',['shelter','courtyard','square'],['Vyzvednout sousedské pozvánky','Předat pozvánky Markovi','Pověsit oznámení na nástěnku']],
 ['Zahrada mezi domy','Lucie obnovuje zanedbaný záhon.',['park','warehouse','park'],['Převzít plán výsadby','Vyzvednout zahradnické potřeby','Pomoci Lucii osázet záhon']],
 ['Hudba do výlohy','Roman chystá novou vitrínu s deskami.',['vinyl','gallery','vinyl'],['Dohodnout s Romanem podobu výlohy','Vyzvednout zapůjčené stojany','Pomoci sestavit novou výlohu']],
 ['Před vernisáží','Nela připravuje výstavu místních autorů.',['gallery','cafe','gallery'],['Převzít seznam příprav','Vyzvednout občerstvení pro hosty','Pomoci dokončit přípravu sálu']],
 ['Ranní vydání','Redakce potřebuje dopravit výtisky na dvě místa.',['press','cafe','vinyl'],['Vyzvednout balík místních novin','Předat výtisky Haně','Doručit zbývající noviny Romanovi']],
 ['Pomoc v depu','Dispečer připravuje vybavení pro ranní směnu.',['depot','service','depot'],['Převzít požadavek dispečera','Vyzvednout opravenou servisní brašnu','Předat vybavení ranní směně']],
 ['Klíče od dílny','Pavel ti svěřuje samostatnou zakázku.',['service','garage','service'],['Převzít klíče a pracovní zadání','Pomoci dokončit zákaznickou objednávku','Vrátit klíče a předat výsledek']],
 ['Dobré reference','Dana shromažďuje doporučení pro stálé místo.',['office','service','cafe'],['Převzít žádost o reference','Získat Pavlovo doporučení','Získat Hanino doporučení']],
 ['Pevná půda','Po dvaceti zakázkách přichází nabídka stabilní práce.',['office','service','food'],['Převzít nabídku stálého místa','Potvrdit nástup do autoservisu','Podělit se s Eliškou o dobrou zprávu']]
];
const catalog={};
for(const [track,rows]of Object.entries({dealer,worker}))catalog[track]=rows.map((r,i)=>({
 id:track+'-'+(i+1),track,number:i+1,title:r[0],brief:r[1],level:1+Math.floor(i/4),
 reward:(track==='dealer'?1400:850)+i*(track==='dealer'?260:170),xp:85+i*12,rep:5+Math.floor(i/3),
 stages:r[2].map((key,j)=>({x:places[key][0],y:places[key][1],label:places[key][2],speaker:places[key][2].split(' · ')[0],action:r[3][j],text:r[1]+' '+r[3][j]+'.'}))
}));
function create(){return {version:1,done:{dealer:0,worker:0},active:null};}
function restore(raw){
 const state=create();if(!raw||raw.version!==1)return state;
 for(const track of Object.keys(catalog)){const n=raw.done?.[track];if(Number.isInteger(n)&&n>=0&&n<=20)state.done[track]=n;}
 const a=raw.active,q=a&&catalog[a.track]?.[state.done[a.track]];
 if(q&&a.id===q.id&&Number.isInteger(a.stage)&&a.stage>=0&&a.stage<q.stages.length)state.active={track:a.track,id:q.id,stage:a.stage};
 return state;
}
function current(s){const a=s.active;return a?catalog[a.track]?.[s.done[a.track]]||null:null;}
function target(s){const q=current(s);return q?{...q.stages[s.active.stage],title:q.title,text:q.stages[s.active.stage].text+' ('+(s.active.stage+1)+'/3)',questId:q.id}:null;}
function accept(s,track,level){const q=Object.hasOwn(catalog,track)&&catalog[track][s.done[track]];if(s.active||!q||!Number.isFinite(level)||level<q.level)return false;s.active={track,id:q.id,stage:0};return true;}
function advance(s,position,token){
 const q=current(s),t=target(s);if(!q||!t||token!==q.id+':'+s.active.stage||!position||!Number.isFinite(position.x)||!Number.isFinite(position.y)||Math.hypot(position.x-t.x,position.y-t.y)>=65)return null;
 s.active.stage++;if(s.active.stage<q.stages.length)return {finished:false};
 s.done[q.track]++;s.active=null;return {finished:true,reward:q.reward,xp:q.xp,rep:q.rep,title:q.title};
}
const api={catalog,create,restore,current,target,accept,advance};
if(typeof module==='object'&&module.exports)module.exports=api;else root.careerSystem=api;
})(typeof globalThis==='object'?globalThis:this);
