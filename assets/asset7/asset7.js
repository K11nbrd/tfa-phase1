
import {loadJSON,money,num,renderCrossLinks} from '../../shared/js/config-loader.js';
import {asset7Pdf} from '../../shared/js/pdf-generator.js';
const dataPath='../../data/asset7.json', linksPath='../../data/portfolio-links.json';
let config,lastResult;
const qs=s=>document.querySelector(s);
const EVLILIK_MALE_INELIGIBLE_TR='Evlilik istisnası yalnızca kadın işçi için uygulanır.';
const EVLILIK_FEMALE_DISCLOSURE_TR='Evlilik nedeniyle kıdem tazminatı yalnızca nikah tarihinden itibaren 1 yıl içinde ayrılan kadın işçiler için geçerlidir. Bu süre dolduktan sonra hak kaybedilir.';
function parseTrNumber(raw){const s=String(raw??'').trim(); if(!s)return 0; let n; if(s.includes(',')){n=Number(s.replace(/\./g,'').replace(',','.')); return Number.isNaN(n)?0:n;} if(s.includes('.')){n=/^\d{1,3}(\.\d{3})+$/.test(s)?Number(s.replace(/\./g,'')):Number(s); return Number.isNaN(n)?0:n;} n=Number(s); return Number.isNaN(n)?0:n;}
function formatTrDate(el){const d=el.value.replace(/\D/g,'').slice(0,8); el.value=d.length>4?`${d.slice(0,2)}/${d.slice(2,4)}/${d.slice(4)}`:d.length>2?`${d.slice(0,2)}/${d.slice(2)}`:d;}
function bindTrDateInputs(form){form.querySelectorAll('input[name="start"],input[name="end"]').forEach(el=>el.addEventListener('input',()=>formatTrDate(el)));}
function trDateToISO(str){const d=String(str??'').replace(/\D/g,''); if(d.length!==8)return ''; const day=d.slice(0,2), month=d.slice(2,4), year=d.slice(4); if(+day<1||+day>31||+month<1||+month>12||!/^\d{4}$/.test(year))return ''; const dt=new Date(+year,+month-1,+day); if(dt.getFullYear()!==+year||dt.getMonth()!==+month-1||dt.getDate()!==+day)return ''; return `${year}-${month}-${day}`;}
function renderDateError(){const out=qs('#result'); if(!out)return; out.className='verdict bad'; out.innerHTML='<p>Tarihleri gg/aa/yyyy biçiminde girin.</p>'; lastResult=null;}
function daysBetween(a,b){return Math.floor((new Date(b)-new Date(a))/(1000*60*60*24))}
function reasonById(id){return config.eligibility_rules.departure_reasons.find(r=>r.id===id)}
function evaluateEligibility(input){
  const rule=reasonById(input.reason); const tenureDays=daysBetween(input.start,input.end);
  if(!rule) return {eligible:false, reason:'Bilinmeyen ayrılış nedeni', tenureDays, rule:{statute_citation:''}};
  if(input.reason==='evlilik' && input.gender!==config.eligibility_rules.marriage_clause.applies_to) return {eligible:false, reason:EVLILIK_MALE_INELIGIBLE_TR, tenureDays, rule};
  if(!rule.eligible) return {eligible:false, reason:rule.verdict_text_tr, tenureDays, rule};
  if(rule.requires_minimum_tenure_days && tenureDays<rule.requires_minimum_tenure_days) return {eligible:false, reason:`En az ${rule.requires_minimum_tenure_days} gün kıdem şartı sağlanmadı.`, tenureDays, rule};
  return {eligible:true, reason:rule.verdict_text_tr, tenureDays, rule};
}
function calc(input){
  const gate=evaluateEligibility(input);
  // Eligibility gate: no downstream amount is computed for ineligible users.
  if(!gate.eligible) return {eligible:false, gate};
  const serviceMultiplier=gate.tenureDays/365;
  const monthlyDressed=input.base+input.food+input.transport+(input.fuelAnnual/12);
  const cappedMonthly=Math.min(monthlyDressed, config.tavan.current_tl_per_year);
  const gross=cappedMonthly*serviceMultiplier;
  const stamp=gross*config.damga_vergisi_rate;
  const net=gross-stamp;
  return {eligible:true, gate, serviceMultiplier, monthlyDressed, cappedMonthly, gross, stamp, net};
}
function renderResult(r,input){
  const out=qs('#result'); out.innerHTML=''; lastResult=null;
  if(!r.eligible){out.className='verdict bad';out.innerHTML=`<h3>Uygun değil</h3><p>${r.gate.reason}</p><p class="mini"><strong>Dayanak:</strong> ${r.gate.rule.statute_citation||'—'}</p>`;return;}
  out.className='verdict ok';
  const death=input.reason==='olum'?'<p class="warning">Ölüm halinde ödeme kanuni mirasçılara yapılır; veraset ilamı ile başvuru gerekir.</p>':'';
  out.innerHTML=`<h3>Kıdem tazminatı hesaplandı</h3><div class="big">${money(r.net)}</div><p>Giydirilmiş brüt ücret: <strong>${money(r.monthlyDressed)}</strong><br>Tavan uygulanan aylık tutar: <strong>${money(r.cappedMonthly)}</strong><br>Hizmet çarpanı: <strong>${num(r.serviceMultiplier,4)}</strong><br>Brüt kıdem: <strong>${money(r.gross)}</strong><br>Damga vergisi: <strong>${money(r.stamp)}</strong></p>${death}<div class="share-actions"><button class="btn" id="pdfBtn">PDF Hesap Tutanağı indir</button></div><p class="mini muted">${config.pdf_config.footer_disclaimer_tr}</p>`;
  lastResult={
    input:{
      departure_reason_label_tr:r.gate.rule.label_tr,
      departure_reason:input.reason,
      start_date:input.start,
      end_date:input.end,
      service_multiplier:r.serviceMultiplier,
      tenure_label_tr:`${num(r.serviceMultiplier,4)} yıl`,
      base_salary_tl:input.base,
      food_allowance_tl:input.food,
      transport_allowance_tl:input.transport,
      fuel_allowance_monthly_tl:input.fuelAnnual/12
    },
    result:{
      eligible:true,
      verdict_text_tr:r.gate.reason,
      statute_citation:r.gate.rule.statute_citation,
      giydirilmis_ucret_tl:r.monthlyDressed,
      capped_monthly_tl:r.cappedMonthly,
      service_multiplier:r.serviceMultiplier,
      gross_kidem_tl:r.gross,
      damga_vergisi_tl:r.stamp,
      net_kidem_tl:r.net,
      next_steps_tr:'Bordro, fesih bildirimi, SGK hizmet dökümü ve banka ödeme kayıtlarını saklayın. Uyuşmazlık halinde arabuluculuk başvurusu zorunlu dava şartıdır.',
      death_note_tr:input.reason==='olum'?'Ödeme kanuni mirasçılara yapılır; veraset ilamı ile başvuru gerekir.':''
    }
  };
  qs('#pdfBtn').addEventListener('click',async()=>{try{await asset7Pdf(lastResult,config)}catch(err){console.error(err);alert('PDF oluşturulamadı: '+err.message)}});
}
function resetResult(){const out=qs('#result'); if(!out)return; out.className='verdict'; out.innerHTML='<p class="muted">Uygunluk kararı verilmeden tutar gösterilmez.</p>'; lastResult=null;}
function setDownstreamEnabled(enabled){const box=qs('#asset7DownstreamFields'); if(!box)return; box.hidden=!enabled; box.querySelectorAll('input,select,button').forEach(el=>{el.disabled=!enabled;});}
function renderEvlilikMaleVerdict(){const out=qs('#result'); if(!out)return; out.className='verdict bad'; out.innerHTML=`<h3>Uygun değil</h3><p>${EVLILIK_MALE_INELIGIBLE_TR}</p>`; lastResult=null;}
function updateEvlilikGate({clearGender=false, reset=true}={}){const reason=qs('#reason'), genderField=qs('#genderField'), gender=qs('#gender'), disclosure=qs('#evlilikDisclosure'); if(!reason||!genderField||!gender)return; const isEvlilik=reason.value==='evlilik'; genderField.hidden=!isEvlilik; gender.required=isEvlilik; if(!isEvlilik){gender.value=''; disclosure&&(disclosure.hidden=true); setDownstreamEnabled(true); if(reset) resetResult(); return;} if(clearGender) gender.value=''; const selected=gender.value; const femaleValue=config.eligibility_rules.marriage_clause.applies_to; if(selected==='male'){disclosure&&(disclosure.hidden=true); setDownstreamEnabled(false); renderEvlilikMaleVerdict(); return;} setDownstreamEnabled(true); if(disclosure){disclosure.textContent=EVLILIK_FEMALE_DISCLOSURE_TR; disclosure.hidden=selected!==femaleValue;} if(reset) resetResult();}
function initCalc(){const form=qs('#asset7Calc'); if(!form) return; const reason=qs('#reason'), gender=qs('#gender'); reason?.addEventListener('change',()=>updateEvlilikGate({clearGender:true})); gender?.addEventListener('change',()=>updateEvlilikGate()); updateEvlilikGate({reset:false}); bindTrDateInputs(form); form.addEventListener('submit',e=>{e.preventDefault(); const fd=new FormData(form), start=trDateToISO(fd.get('start')), end=trDateToISO(fd.get('end')); if(!start||!end){renderDateError(); return;} const input={reason:fd.get('reason'), gender:fd.get('gender'), start, end, base:parseTrNumber(fd.get('base')), food:parseTrNumber(fd.get('food')), transport:parseTrNumber(fd.get('transport')), fuelAnnual:parseTrNumber(fd.get('fuelAnnual'))}; renderResult(calc(input),input);});}
function fillTavan(){const el=qs('#tavanTable'); if(!el)return; el.innerHTML=`<table class="table"><thead><tr><th>Dönem</th><th>Tutar</th><th>Geçerlilik</th></tr></thead><tbody>${config.tavan_history.map(h=>`<tr${h.tl_per_year===config.tavan.current_tl_per_year?' class="current"':''}><td>${h.period_label}</td><td>${money(h.tl_per_year)}</td><td>${h.effective_from} / ${h.effective_until}</td></tr>`).join('')}</tbody></table>`;}
function fillGeo(){const slug=document.body.dataset.city; if(!slug)return; const c=config.cities.find(x=>x.slug===slug); if(!c)return; qs('#cityName').textContent=c.name_tr; qs('#courtName').textContent=c.local_court_name_tr; qs('#mediationBox').innerHTML=c.mediation_office_address?c.mediation_office_address:`<a class="btn ghost" href="https://www.turkiye.gov.tr/adalet-arabuluculuk-basvurusu" rel="nofollow">e-Devlet arabuluculuk başvurusu</a>`;}
async function init(){config=await loadJSON(dataPath); const links=await loadJSON(linksPath); document.querySelectorAll('[data-current-tavan]').forEach(e=>e.textContent=money(config.tavan.current_tl_per_year)); const reason=qs('#reason'); if(reason) reason.innerHTML=config.eligibility_rules.departure_reasons.map(r=>`<option value="${r.id}">${r.label_tr}</option>`).join(''); initCalc(); fillTavan(); fillGeo(); ['labor','sme','inheritance'].forEach(c=>renderCrossLinks(qs('#cross-'+c),links,c));}
init().catch(err=>{console.error(err); document.body.insertAdjacentHTML('afterbegin',`<div class="nojs">Veri yüklenemedi: ${err.message}</div>`)});