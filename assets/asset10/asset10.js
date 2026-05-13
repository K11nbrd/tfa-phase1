import {loadJSON,money,num,trFold,todayStamp,renderCrossLinks,trackEvent} from '../../shared/js/config-loader.js';
async function ensureRobotoCanvasFonts() {
  if (!document.fonts || !document.fonts.load) return;
  await document.fonts.load('400 16px Roboto');
  await document.fonts.load('700 16px Roboto');
  await document.fonts.ready;
}
const dataPath='../../data/asset10.json', linksPath='../../data/portfolio-links.json';
let config,lastVerdict;
const qs=s=>document.querySelector(s);
const MONTH_ORDER=['01','02','03','04','05','06','07','08','09','10','11','12'];
function normalizeNumericInput(value){
  const raw=String(value??'').trim().replace(/\s/g,'').replace(/₺/g,'').replace(/TRY/gi,'');
  if(!raw) return '0';
  const comma=raw.lastIndexOf(','), dot=raw.lastIndexOf('.');
  if(comma>-1 && dot>-1){
    if(comma>dot) return raw.replace(/\./g,'').replace(',', '.');
    return raw.replace(/,/g,'');
  }
  if(comma>-1) return raw.replace(/\./g,'').replace(',', '.');
  const dots=(raw.match(/\./g)||[]).length;
  if(dots>1) return raw.replace(/\./g,'');
  if(dots===1){
    const [left,right]=raw.split('.');
    if(right.length===3 && left.length<=3) return left+right;
  }
  return raw;
}
function parseLocaleNumber(value){
  const parsed=Number(normalizeNumericInput(value));
  return Number.isFinite(parsed)?parsed:0;
}
const monthNames={'01':'Ocak','02':'Şubat','03':'Mart','04':'Nisan','05':'Mayıs','06':'Haziran','07':'Temmuz','08':'Ağustos','09':'Eylül','10':'Ekim','11':'Kasım','12':'Aralık'};
function taxInclusiveAmount(consumption,rate){
 const kdv=Number(config.pricing.kdv_rate)||0;
 const otv=Number(config.pricing.otv_per_sm3)||0;
 return consumption*((rate+otv)*(1+kdv));
}
function calculate(provinceSlug,month,consumption){
 const p=config.provinces.find(x=>x.slug===provinceSlug); if(!p) throw new Error('İl bulunamadı');
 const limit=Number(p.monthly_limits_sm3[month]); const k1=config.pricing.kademe_1_tl_per_sm3, k2=config.pricing.kademe_2_tl_per_sm3;
 const verdict=consumption>limit?'KADEME_2':'KADEME_1'; const rate=verdict==='KADEME_2'?k2:k1;
 const bill=consumption*rate;
 return {province:p,month,consumption,limit,verdict,nearLimit:verdict==='KADEME_1' && consumption>=limit*0.9 && consumption<=limit, bill, taxInclusiveBill:taxInclusiveAmount(consumption,rate), k1Bill:consumption*k1, difference:verdict==='KADEME_2'?consumption*(k2-k1):0, rate};
}
function tariffText(v){return v.verdict==='KADEME_2'?'Yüksek tarife uygulanır':'Standart tarife uygulanır'}
function verdictTitle(v){return v.verdict==='KADEME_2'?'Kademe-2’ye geçtiniz':(v.nearLimit?'Kademe-1 sınırındasınız':'Kademe-1’desiniz')}
function orderedMonthEntries(monthlyLimits){return MONTH_ORDER.map(m=>[m,monthlyLimits[m]]).filter(([,val])=>val!==undefined&&val!==null)}
const POPULAR_PROVINCE_SLUGS=['istanbul','ankara','izmir'];
function provinceOption(p){
  // Bind every dropdown entry to the canonical province slug. Popular duplicates and
  // A-Z duplicates must submit the same value so calculation and card data stay aligned.
  return `<option value="${p.slug}" data-province-slug="${p.slug}">${p.name_tr}</option>`;
}
function provinceOptions(){
  const bySlug=new Map(config.provinces.map(p=>[p.slug,p]));
  const popular=['istanbul','ankara','izmir'].map(slug=>bySlug.get(slug)).filter(Boolean);
  const all=[...config.provinces].sort((a,b)=>a.name_tr.localeCompare(b.name_tr,'tr'));
  const popularOptions=popular.map(provinceOption).join('');
  const allOptions=all.map(provinceOption).join('');
  return `<optgroup label="Sık seçilen iller">${popularOptions}</optgroup><optgroup label="Tüm iller (A-Z)">${allOptions}</optgroup>`;
}
function renderVerdict(v){lastVerdict=v; const out=qs('#result'); if(!out)return; const bad=v.verdict==='KADEME_2'; out.className='verdict '+(bad?'bad':v.nearLimit?'warn':'ok');
 out.innerHTML=`<h3>${verdictTitle(v)}</h3><div class="big">${tariffText(v)}</div><p>${v.province.name_tr} / ${monthNames[v.month]} limiti: <strong>${num(v.limit)} sm³</strong><br>Tüketiminiz: <strong>${num(v.consumption)} sm³</strong><br>Vergisiz tahmini tutar: <strong>${money(v.bill)}</strong><br>KDV ve ÖTV dahil tahmini fatura: <strong>${money(v.taxInclusiveBill)}</strong></p>${bad?`<p class="warning">${config.verdict_card_config.full_bill_flip_warning_tr}<br>Fatura farkı: <strong>+${money(v.difference)}</strong></p>`:''}${v.nearLimit?'<p class="warning">Limitin %90’ını aştınız; hâlâ Kademe-1’desiniz ama sonraki tüketim Kademe-2 riskini artırır.</p>':''}<p class="mini muted">${config.verdict_card_config.kdv_otv_disclaimer_tr}</p><div class="share-actions"><button class="btn" id="cardBtn">WhatsApp PNG kartı indir</button></div>`;
 qs('#cardBtn').addEventListener('click',()=>downloadCard(v));}
function fitText(ctx,text,x,y,maxWidth,startSize,minSize){
  let size=startSize;
  do{ctx.font=`bold ${size}px Roboto, Arial, sans-serif`; if(ctx.measureText(text).width<=maxWidth) break; size-=4;}while(size>minSize);
  ctx.fillText(text,x,y);
}
async function downloadCard(v){
  await ensureRobotoCanvasFonts();
  const c=document.createElement('canvas');c.width=1080;c.height=1350;
  const ctx=c.getContext('2d');const bad=v.verdict==='KADEME_2';
  ctx.fillStyle=bad?config.verdict_card_config.background_color_k2:config.verdict_card_config.background_color_k1;ctx.fillRect(0,0,c.width,c.height);
  ctx.fillStyle='white';ctx.font='bold 72px Roboto, Arial, sans-serif';ctx.fillText('Doğalgaz Kademe Dedektifi',70,120);
  fitText(ctx,tariffText(v),70,260,940,86,54);
  ctx.font='bold 52px Roboto, Arial, sans-serif';ctx.fillText(`${v.province.name_tr} — ${monthNames[v.month]}`,70,360);
  ctx.font='40px Roboto, Arial, sans-serif';let y=455;
  [[`Limitiniz: ${num(v.limit)} sm³`],[`Tüketiminiz: ${num(v.consumption)} sm³`],[`Vergisiz tahmini tutar: ${money(v.bill)}`],[`KDV ve ÖTV dahil tahmini fatura: ${money(v.taxInclusiveBill)}`],[bad?`Fatura farkı: +${money(v.difference)}`:'Kademe-1 fiyatındasınız']].forEach(a=>{ctx.fillText(a[0],70,y);y+=64});
  ctx.fillStyle='rgba(255,255,255,.18)';ctx.fillRect(60,805,960,260);
  ctx.fillStyle='white';ctx.font='bold 38px Roboto, Arial, sans-serif';wrap(ctx,bad?config.verdict_card_config.full_bill_flip_warning_tr:(v.nearLimit?'Limitin %90’ını aştınız; dikkatli tüketin.':'Limit altında kaldınız.'),90,875,900,52);
  ctx.font='30px Roboto, Arial, sans-serif';wrap(ctx,config.verdict_card_config.kdv_otv_disclaimer_tr,90,1145,900,42);
  trackEvent('png_share',{province:v.province.slug,month:v.month,verdict:v.verdict});
  c.toBlob(blob=>{const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`dogalgaz-kademe-verdict-${todayStamp()}.png`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)},'image/png');
}
function wrap(ctx,text,x,y,maxWidth,lineHeight){const words=String(text).split(' ');let line='';for(const w of words){const test=line+w+' ';if(ctx.measureText(test).width>maxWidth){ctx.fillText(line,x,y);line=w+' ';y+=lineHeight}else line=test}ctx.fillText(line,x,y)}
function initCalc(){const form=qs('#asset10Calc'); if(!form)return; const prov=qs('#province'), month=qs('#month'); prov.innerHTML=provinceOptions(); month.innerHTML=MONTH_ORDER.map(k=>`<option value="${k}">${monthNames[k]}</option>`).join(''); form.addEventListener('submit',e=>{e.preventDefault(); const fd=new FormData(form); const verdict=calculate(fd.get('province'),fd.get('month'),parseLocaleNumber(fd.get('consumption'))); renderVerdict(verdict); trackEvent('calculate_kademe',{province:verdict.province.slug,month:verdict.month,verdict:verdict.verdict});});}
function fillWarnings(){document.querySelectorAll('[data-full-warning]').forEach(e=>e.textContent=config.verdict_card_config.full_bill_flip_warning_tr)}
function fillLimits(){const holder=qs('#limitsTable'); if(!holder)return; const search=qs('#provinceSearch'); const render=()=>{const q=trFold(search?.value||''); holder.innerHTML=config.provinces.filter(p=>trFold(p.name_tr).includes(q)||trFold(p.slug).includes(q)).map(p=>`<div class="accordion-row"><button class="accordion-head" type="button"><span>${p.plate_code} — ${p.name_tr}</span><span>12 ay</span></button><div class="accordion-body"><div class="month-grid">${orderedMonthEntries(p.monthly_limits_sm3).map(([m,val])=>`<div class="month-item"><strong>${monthNames[m]}</strong><br>${num(val)} sm³</div>`).join('')}</div></div></div>`).join(''); holder.querySelectorAll('.accordion-head').forEach(b=>b.addEventListener('click',()=>b.parentElement.classList.toggle('open')))}; search?.addEventListener('input',render); render();}
function fillCity(){const slug=document.body.dataset.city; if(!slug)return; const p=config.provinces.find(x=>x.slug===slug); if(!p)return; qs('#cityName').textContent=p.name_tr; qs('#cityLimitCopy').textContent=`${p.name_tr} için her ay ayrı limit uygulanır. Sınırı 1 sm³ geçmek tüm ay tüketimini Kademe-2 fiyatına taşır.`;}
async function init(){config=await loadJSON(dataPath); const links=await loadJSON(linksPath); fillWarnings(); initCalc(); fillLimits(); fillCity(); renderCrossLinks(qs('#cross-energy'),links,'energy');}
init().catch(err=>document.body.insertAdjacentHTML('afterbegin',`<div class="nojs">Veri yüklenemedi: ${err.message}</div>`));
