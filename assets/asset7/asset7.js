import {loadJSON,money,num,renderCrossLinks,trackEvent} from '../../shared/js/config-loader.js';
import {asset7Pdf} from '../../shared/js/pdf-generator.js';

const dataPath='../../data/asset7.json', linksPath='../../data/portfolio-links.json';
const MONTHS_PER_YEAR=12;
let config,lastResult;
const qs=s=>document.querySelector(s);

function parseDateParts(value){
  const raw=String(value||'').trim();
  let m=raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if(m) return {year:+m[1],month:+m[2],day:+m[3],iso:raw};
  m=raw.match(/^(\d{2})(\d{2})(\d{4})$/);
  if(m){
    const day=+m[1], month=+m[2], year=+m[3];
    const d=new Date(Date.UTC(year,month-1,day));
    if(d.getUTCFullYear()!==year||d.getUTCMonth()!==month-1||d.getUTCDate()!==day) return null;
    return {year,month,day,iso:`${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`};
  }
  m=raw.match(/^(\d{1,2})[\/\.\-](\d{1,2})[\/\.\-](\d{4})$/);
  if(!m) return null;
  const day=+m[1], month=+m[2], year=+m[3];
  const d=new Date(Date.UTC(year,month-1,day));
  if(d.getUTCFullYear()!==year||d.getUTCMonth()!==month-1||d.getUTCDate()!==day) return null;
  return {year,month,day,iso:`${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`};
}
function parseTurkishDate(value){return parseDateParts(value)?.iso||'';}
function autoFormatTurkishDateInput(value){
  const raw=String(value||'').trim();
  if(/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const digits=raw.replace(/\D/g,'').slice(0,8);
  if(digits.length<=2) return digits;
  if(digits.length<=4) return `${digits.slice(0,2)}/${digits.slice(2)}`;
  return `${digits.slice(0,2)}/${digits.slice(2,4)}/${digits.slice(4)}`;
}
function syncDateInputMask(input){
  const formatted=autoFormatTurkishDateInput(input.value);
  if(input.value!==formatted) input.value=formatted;
  input.setCustomValidity('');
}
function daysBetween(a,b){
  const start=parseDateParts(a), end=parseDateParts(b);
  if(!start||!end) return 0;
  return Math.floor((Date.UTC(end.year,end.month-1,end.day)-Date.UTC(start.year,start.month-1,start.day))/(1000*60*60*24));
}
function computeTenure(startValue,endValue){
  const start=parseDateParts(startValue), end=parseDateParts(endValue);
  const tenureDays=daysBetween(startValue,endValue);
  const anniversaryMatched=Boolean(start&&end&&start.day===end.day&&start.month===end.month&&end.year>=start.year);
  const anniversaryYears=anniversaryMatched?Math.max(0,end.year-start.year):null;
  const serviceMultiplier=anniversaryMatched?anniversaryYears:tenureDays/365;
  return {tenureDays,serviceMultiplier,anniversaryMatched,anniversaryYears};
}
function reasonById(id){return config.eligibility_rules.departure_reasons.find(r=>r.id===id)}
function displayReasonLabel(rule){return rule?.id==='olum'?'İşçinin vefatı':rule?.label_tr||''}
function normalizePeriodLabel(label){return String(label||'').replace(/\bI\. Yarı\b/g,'1. Yarı').replace(/\bII\. Yarı\b/g,'2. Yarı')}
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
function humanizeServiceDuration(totalDays){
  const tenure=arguments[1];
  if(tenure?.anniversaryMatched) return `${tenure.anniversaryYears} yıl`;
  const days=Math.max(0,Number(totalDays)||0);
  let years=Math.floor(days/365.25);
  let remainder=Math.round(days-(years*365.25));
  if(remainder>=365){years+=1;remainder=0;}
  const parts=[`${years} yıl`];
  if(remainder===1) parts.push('1 gün');
  else if(remainder>1) parts.push(`${remainder} gün`);
  return parts.join(' ');
}
function findNoticeWeeks(tenureDays){
  const periods=config.ihbar_periods||[];
  const matched=periods.find(p=>tenureDays>=Number(p.tenure_min_days)&&tenureDays<=Number(p.tenure_max_days));
  return matched?Number(matched.notice_weeks):0;
}
function setCalcTavanVisible(visible){
  const note=qs('#calcTavanNote');
  if(note) note.hidden=!visible;
}
function showPdfError(message){
  const target=qs('#result')||document.body;
  target.querySelectorAll('.pdf-error').forEach(el=>el.remove());
  const box=document.createElement('div');
  box.setAttribute('role','alert');
  box.className='pdf-error';
  box.textContent=message;
  target.prepend(box);
}
function evaluateEligibility(input,tenure=computeTenure(input.start,input.end)){
  const rule=reasonById(input.reason); const tenureDays=tenure.tenureDays;
  if(!rule) return {eligible:false, reason:'Bilinmeyen ayrılış nedeni', tenureDays, rule:{statute_citation:''}};
  if(input.reason==='evlilik' && !input.gender) return {eligible:false, reason:'Evlilik istisnası için cinsiyet seçimi zorunludur.', tenureDays, rule};
  if(input.reason==='evlilik' && input.gender!=='female') return {eligible:false, reason:'Evlilik istisnası yalnızca kadın işçi için uygulanır.', tenureDays, rule};
  if(!rule.eligible) return {eligible:false, reason:rule.verdict_text_tr, tenureDays, rule};
  if(rule.requires_minimum_tenure_days && tenureDays<rule.requires_minimum_tenure_days) return {eligible:false, reason:`En az ${rule.requires_minimum_tenure_days} gün kıdem şartı sağlanmadı.`, tenureDays, rule};
  return {eligible:true, reason:rule.verdict_text_tr, tenureDays, rule};
}
function calc(input){
  const tenure=computeTenure(input.start,input.end);
  const gate=evaluateEligibility(input,tenure);
  // Eligibility gate: no downstream amount is computed for ineligible users.
  if(!gate.eligible) return {eligible:false, gate, tenure};
  const serviceMultiplier=tenure.serviceMultiplier;
  const fuelMonthly=input.fuelAnnual/MONTHS_PER_YEAR;
  const monthlyDressed=input.base+input.food+input.transport+fuelMonthly;
  const cappedMonthly=Math.min(monthlyDressed, config.tavan.current_tl_per_year);
  const gross=cappedMonthly*serviceMultiplier;
  const stamp=gross*config.damga_vergisi_rate;
  const net=gross-stamp;
  const noticeWeeks=gate.rule.notice_entitlement?findNoticeWeeks(gate.tenureDays):0;
  const noticeGross=noticeWeeks?(monthlyDressed/30)*noticeWeeks*7:0;
  return {eligible:true, gate, tenure, serviceMultiplier, fuelMonthly, monthlyDressed, cappedMonthly, gross, stamp, net, noticeWeeks, noticeGross};
}
function renderResult(r,input){
  const out=qs('#result'); out.innerHTML=''; lastResult=null;
  if(!r.eligible){setCalcTavanVisible(false);out.className='verdict bad';out.innerHTML=`<h3>Uygun değil</h3><p>${r.gate.reason}</p><p class="mini"><strong>Dayanak:</strong> ${r.gate.rule.statute_citation||'—'}</p>`;return;}
  setCalcTavanVisible(true);
  out.className='verdict ok';
  const death=input.reason==='olum'?'<p class="warning">Ölüm halinde ödeme kanuni mirasçılara yapılır; veraset ilamı ile başvuru gerekir.</p>':'';
  const notice=r.noticeWeeks?`<p class="warning">İhbar notu: ${num(r.noticeWeeks,0)} hafta — yaklaşık brüt ${money(r.noticeGross)}. Bu not yalnızca seçilen ayrılış nedeni ihbar hakkı doğurduğunda gösterilir.</p>`:'';
  out.innerHTML=`<h3>Kıdem tazminatı hesaplandı</h3><div class="big">${money(r.net)}</div><p>Giydirilmiş brüt ücret: <strong>${money(r.monthlyDressed)}</strong><br>Tavan uygulanan aylık tutar: <strong>${money(r.cappedMonthly)}</strong><br>Hizmet süresi: <strong>${humanizeServiceDuration(r.gate.tenureDays,r.tenure)}</strong><br>Hizmet çarpanı: <strong>${num(r.serviceMultiplier,4)}</strong><br>Brüt kıdem: <strong>${money(r.gross)}</strong><br>Damga vergisi: <strong>${money(r.stamp)}</strong></p>${death}${notice}<div class="share-actions"><button class="btn" id="pdfBtn">PDF Hesap Tutanağı indir</button></div><p class="mini muted">${config.pdf_config.footer_disclaimer_tr}</p>`;
  const tenureLabel=humanizeServiceDuration(r.gate.tenureDays,r.tenure);
  lastResult={
    input:{
      departure_reason_id:input.reason,
      departure_reason:input.reason,
      departure_reason_label_tr:r.gate.rule.label_tr,
      gender:input.gender,
      start_date:input.start,
      end_date:input.end,
      service_days:r.gate.tenureDays,
      service_years:r.serviceMultiplier,
      service_multiplier:r.serviceMultiplier,
      tenure_label_tr:tenureLabel,
      base_salary_tl:input.base,
      yemek_tl:input.food,
      food_allowance_tl:input.food,
      yol_tl:input.transport,
      transport_allowance_tl:input.transport,
      yakacak_yearly_tl:input.fuelAnnual,
      yakacak_monthly_tl:r.fuelMonthly,
      fuel_allowance_monthly_tl:r.fuelMonthly
    },
    result:{
      eligible:true,
      verdict_text_tr:r.gate.reason,
      statute_citation:r.gate.rule.statute_citation,
      giydirilmis_brut:r.monthlyDressed,
      giydirilmis_ucret_tl:r.monthlyDressed,
      capped_monthly:r.cappedMonthly,
      capped_monthly_tl:r.cappedMonthly,
      service_multiplier:r.serviceMultiplier,
      gross_kidem:r.gross,
      gross_kidem_tl:r.gross,
      damga_vergisi:r.stamp,
      damga_vergisi_tl:r.stamp,
      net_kidem:r.net,
      net_kidem_tl:r.net,
      notice_weeks:r.noticeWeeks,
      ihbar_gross:r.noticeGross,
      next_steps_tr:'Bordro, fesih bildirimi, SGK hizmet dökümü ve banka ödeme kayıtlarını saklayın. Uyuşmazlık halinde arabuluculuk başvurusu zorunlu dava şartıdır.',
      death_note_tr:input.reason==='olum'?'Ödeme kanuni mirasçılara yapılır; veraset ilamı ile başvuru gerekir.':''
    },
    eligibility:{
      eligible:true,
      verdict_text_tr:r.gate.reason,
      statute_citation:r.gate.rule.statute_citation
    }
  };
  qs('#pdfBtn').addEventListener('click',async()=>{
    const btn=qs('#pdfBtn'); const oldText=btn.textContent; btn.disabled=true; btn.textContent='PDF hazırlanıyor...';
    try{trackEvent('pdf_download',{departure_reason:input.reason});await asset7Pdf(lastResult,config)}catch(err){console.error(err);showPdfError('PDF oluşturulamadı. Font veya jsPDF dosyası eksik olabilir.')}finally{btn.disabled=false;btn.textContent=oldText;}
  });
}
function initZeroClearing(form){
  form.querySelectorAll('[data-number-input]').forEach(input=>{
    input.addEventListener('focus',()=>{if(input.value==='0') input.value='';});
    input.addEventListener('blur',()=>{if(input.value==='') input.value='0';});
  });
}
function setMarriageBlocked(blocked){
  const form=qs('#asset7Calc'); if(!form) return;
  form.querySelectorAll('[data-after-gender]').forEach(el=>{el.hidden=blocked;});
  const submit=form.querySelector('button[type="submit"],button.btn');
  if(submit) submit.hidden=blocked;
  form.classList.toggle('form-blocked',blocked);
}
function renderImmediateMarriageIneligible(){
  const rule=reasonById('evlilik')||{statute_citation:'1475 sayılı İş Kanunu Madde 14'};
  const out=qs('#result'); if(!out) return;
  setCalcTavanVisible(false); lastResult=null;
  out.className='verdict bad';
  out.innerHTML=`<h3>Uygun değil</h3><p>Evlilik istisnası yalnızca kadın işçi için uygulanır.</p><p class="mini"><strong>Dayanak:</strong> ${rule.statute_citation||'1475 sayılı İş Kanunu Madde 14'}</p>`;
}
function syncGenderField(){
  const reason=qs('#reason'); const field=qs('#genderField'); const gender=qs('#gender'); const disclosure=qs('#marriageDisclosure');
  if(!reason||!field||!gender) return;
  const needsGender=reason.value==='evlilik';
  field.hidden=!needsGender;
  gender.required=needsGender;
  if(!needsGender) gender.value='';
  const maleMarriage=needsGender&&gender.value==='male';
  setMarriageBlocked(maleMarriage);
  if(disclosure) disclosure.hidden=!(needsGender&&gender.value==='female');
  if(maleMarriage) renderImmediateMarriageIneligible();
}
function validateDateField(input){
  const iso=parseTurkishDate(input.value);
  input.setCustomValidity(iso?'':'Tarihi gg/aa/yyyy biçiminde girin.');
  return iso;
}
function initCalc(){
  const form=qs('#asset7Calc'); if(!form) return;
  initZeroClearing(form);
  const reason=qs('#reason'); const gender=qs('#gender');
  if(reason) reason.addEventListener('change',syncGenderField);
  if(gender) gender.addEventListener('change',syncGenderField);
  form.querySelectorAll('[data-date-input]').forEach(input=>{
    input.addEventListener('input',()=>syncDateInputMask(input));
    input.addEventListener('blur',()=>{
      syncDateInputMask(input);
      if(input.value) validateDateField(input);
    });
  });
  syncGenderField(); setCalcTavanVisible(false);
  form.addEventListener('submit',e=>{
    e.preventDefault();
    syncGenderField();
    const startField=form.elements.start, endField=form.elements.end;
    const startIso=validateDateField(startField), endIso=validateDateField(endField);
    if(startIso&&endIso&&daysBetween(startIso,endIso)<=0) endField.setCustomValidity('İşten ayrılış tarihi işe başlama tarihinden sonra olmalıdır.');
    if(!form.reportValidity()) return;
    const fd=new FormData(form);
    const input={reason:fd.get('reason'), gender:fd.get('gender'), start:startIso, end:endIso, base:parseLocaleNumber(fd.get('base')), food:parseLocaleNumber(fd.get('food')), transport:parseLocaleNumber(fd.get('transport')), fuelAnnual:parseLocaleNumber(fd.get('fuelAnnual'))};
    const result=calc(input);
    renderResult(result,input);
    trackEvent('calculate_kidem',{departure_reason:input.reason,eligible:Boolean(result.eligible)});
  });
}
function fillTavan(){const el=qs('#tavanTable'); if(!el)return; const history=[...(config.tavan_history||[])].reverse(); el.innerHTML=`<table class="table"><thead><tr><th>Dönem</th><th>Tutar</th><th>Geçerlilik</th></tr></thead><tbody>${history.map(h=>`<tr${h.tl_per_year===config.tavan.current_tl_per_year?' class="current"':''}><td>${normalizePeriodLabel(h.period_label)}</td><td>${money(h.tl_per_year)}</td><td>${h.effective_from} / ${h.effective_until}</td></tr>`).join('')}</tbody></table>`;}
function fillGeo(){const slug=document.body.dataset.city; if(!slug)return; const c=config.cities.find(x=>x.slug===slug); if(!c)return; qs('#cityName').textContent=c.name_tr; qs('#courtName').textContent=c.local_court_name_tr; qs('#mediationBox').innerHTML=c.mediation_office_address?c.mediation_office_address:`<a class="btn ghost" href="https://www.turkiye.gov.tr/adalet-arabuluculuk-basvurusu" rel="nofollow">e-Devlet arabuluculuk başvurusu</a>`;}
async function init(){config=await loadJSON(dataPath); const links=await loadJSON(linksPath); document.querySelectorAll('[data-current-tavan]').forEach(e=>e.textContent=money(config.tavan.current_tl_per_year)); const reason=qs('#reason'); if(reason) reason.innerHTML=config.eligibility_rules.departure_reasons.map(r=>`<option value="${r.id}">${displayReasonLabel(r)}</option>`).join(''); initCalc(); fillTavan(); fillGeo(); ['labor','sme','inheritance'].forEach(c=>renderCrossLinks(qs('#cross-'+c),links,c));}
init().catch(err=>{console.error(err); document.body.insertAdjacentHTML('afterbegin',`<div class="nojs">Veri yüklenemedi: ${err.message}</div>`) });
