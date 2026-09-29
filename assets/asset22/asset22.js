(function initAsset22Page(global) {
  'use strict';

  const config = JSON.parse(document.getElementById('asset22-data').textContent);
  const registry = JSON.parse(document.getElementById('asset22-registry').textContent);
  const effectivityConfig = JSON.parse(document.getElementById('effectivity-guard-data').textContent);
  const E = global.Asset22Engine;
  const R = global.Asset22Render;
  const A = global.Asset22Artifacts;
  const renderAnchor = R.createRenderer(config);
  let lastResult = null;
  let effectivityState = { stale: false, warningTr: null };

  const $ = id => document.getElementById(id);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  function setText(id, text) { const el=$(id); if(el) el.textContent=text || ''; }
  function addOption(select, value, label) { const o=document.createElement('option');o.value=value;o.textContent=label;select.appendChild(o); }

  function initSelectors() {
    const institution=$('institutionType'); addOption(institution,'','Seçin');
    for(const x of config.institution_types||[]) addOption(institution,x.type_code,x.type_label_tr);
    const exceptions=$('exceptions');
    for(const x of config.full_refund_exceptions||[]) {
      const field=document.createElement('fieldset'); field.className='field exception';
      field.innerHTML=`<legend>${esc(x.exception_label_tr)}</legend><p class="muted">${esc(x.trigger_description_tr)}</p>`;
      const select=document.createElement('select');select.dataset.exceptionCode=x.exception_code;addOption(select,'','Belirtmek istemiyorum');addOption(select,'hayir','Hayır');addOption(select,'evet','Evet');field.appendChild(select);exceptions.appendChild(field);
    }
    addFeeRow();
  }

  function addFeeRow() {
    const row=document.createElement('div');row.className='fee-row';
    const select=document.createElement('select');select.className='fee-category';select.setAttribute('aria-label','Ücret kalemini seçin');
    addOption(select,'','Ücret kalemini seçin');
    for(const x of config.fee_classification||[]) addOption(select,x.category_code,x.category_label_tr);
    addOption(select,E.UNCERTAIN_CATEGORY_CODE,'Emin değilim');
    const amount=document.createElement('input');amount.className='fee-amount';amount.type='text';amount.inputMode='decimal';amount.autocomplete='off';amount.placeholder='Tutar (TL)';amount.setAttribute('aria-label','Tutar (TL)');
    const remove=document.createElement('button');remove.type='button';remove.className='remove';remove.textContent='Sil';remove.addEventListener('click',()=>row.remove());
    row.append(select,amount,remove);$('feeRows').appendChild(row);
  }

  // Turkish amount reader (input boundary only; the engine still receives canonical "40000.50" strings).
  // "40.000" -> 40000; "40.000,50" -> 40000.50; "40,5" -> 40.50; "40.5" -> 40.50; unreadable -> {ok:false}.
  const MSG_AMOUNT='Bu tutarı anlayamadık. Örnek: 40.000 veya 40.000,50';
  function parseTrAmount(raw) {
    const bad={ok:false,value:null};
    const s=String(raw==null?'':raw).trim().replace(/\s+/g,'').replace(/(tl|₺)$/i,'');
    if(s==='') return {ok:true,value:''};
    if(!/^[0-9.,]+$/.test(s)) return bad;
    const commas=(s.match(/,/g)||[]).length;
    let intPart, frac='';
    if(commas>1) return bad;
    if(commas===1) {
      const parts=s.split(','); if(!/^\d{1,2}$/.test(parts[1])) return bad;
      if(!/^(\d{1,3}(\.\d{3})+|\d+)$/.test(parts[0])) return bad;
      intPart=parts[0].replace(/\./g,''); frac=parts[1];
    } else if(s.indexOf('.')>=0) {
      if(/^\d{1,3}(\.\d{3})+$/.test(s)) intPart=s.replace(/\./g,'');
      else if(/^\d+\.\d{1,2}$/.test(s)) { const p=s.split('.'); intPart=p[0]; frac=p[1]; }
      else return bad;
    } else intPart=s;
    return {ok:true,value:frac?`${intPart}.${frac}`:intPart};
  }

  function collectInput() {
    const clientErrors=[];
    const readAmount=(el,anchor,required)=>{const p=parseTrAmount(el.value);let v=p.ok?p.value:'invalid';if(!p.ok||(required&&(v===''||!(Number(v)>0))))clientErrors.push({el,anchor,message:MSG_AMOUNT});return v;};
    const feeItems=[...document.querySelectorAll('.fee-row')].map(row=>{const el=row.querySelector('.fee-amount');return {category_code:row.querySelector('.fee-category').value,amount_tl:readAmount(el,row,true)};});
    const answers={}; document.querySelectorAll('[data-exception-code]').forEach(s=>answers[s.dataset.exceptionCode]=s.value);
    if(!$('departureDate').value)clientErrors.push({el:$('departureDate'),anchor:$('departureDate'),message:'Ayrılış tarihini girin.'});
    const annual=readAmount($('annualTuition'),$('annualTuition'),false);
    const returned=readAmount($('amountReturned'),$('amountReturned'),false);
    return {input:{
      institution_type_code:$('institutionType').value,
      fee_items_paid:feeItems,
      annual_tuition_tl:annual,
      cancellation_notice_date:$('departureDate').value,
      written_notice_method:$('writtenNoticeMethod').value,
      full_refund_exception_answers:answers,
      amount_returned_by_school_tl:returned
    },clientErrors};
  }

  // Inline field errors (E1 and the other input errors). Every string here is a hard-coded UI string.
  const ENGINE_ERROR_UI={
    'institution_type_code:required':{id:'institutionTypeError',field:'institutionType',message:'Kurum türünü seçin.'},
    'fee_items_paid:at_least_one_required':{id:'feeRowsError',field:null,message:'En az bir ücret kalemi ekleyin.'},
    'cancellation_notice_date:required':{id:'departureDateError',field:'departureDate',message:'Ayrılış tarihini girin.'},
    'cancellation_notice_date:future_date':{id:'departureDateError',field:'departureDate',message:'Ayrılış tarihi bugünden sonra olamaz.'},
    'amount_returned_by_school_tl:must_be_gte_zero':{id:'amountReturnedError',field:'amountReturned',message:MSG_AMOUNT}
  };
  const MSG_SUMMARY='Lütfen işaretli alanları kontrol edin.';
  function clearFieldErrors(){
    document.querySelectorAll('.field-error, .fee-error').forEach(el=>{if(el.classList.contains('fee-error'))el.remove();else el.textContent='';});
    document.querySelectorAll('[aria-invalid]').forEach(el=>el.removeAttribute('aria-invalid'));
  }
  function showFieldErrors(clientErrors,engineErrors){
    const focusables=[];
    for(const c of clientErrors){
      if(c.anchor!==c.el){const d=document.createElement('div');d.className='errors fee-error';d.setAttribute('role','alert');d.textContent=c.message;c.anchor.after(d);}
      else{const slot=$(c.el.id+'Error');if(slot)slot.textContent=c.message;}
      c.el.setAttribute('aria-invalid','true');focusables.push(c.el);
    }
    for(const e of engineErrors||[]){
      const ui=ENGINE_ERROR_UI[`${e.field}:${e.code}`]; if(!ui)continue;
      const slot=$(ui.id); if(slot&&!slot.textContent)slot.textContent=ui.message;
      const f=ui.field?$(ui.field):null; if(f){f.setAttribute('aria-invalid','true');focusables.push(f);}
    }
    return focusables.sort((a,b)=>(a.compareDocumentPosition(b)&Node.DOCUMENT_POSITION_FOLLOWING)?-1:1);
  }

  function context(result){return A.tokenContext(config,result);}
  function noticeHtml(text, cls=''){return text?`<div class="notice ${cls}">${esc(text)}</div>`:'';}
  function section(title, body, id=''){return `<section class="card result-section"${id?` id="${id}"`:''}><h2>${esc(title)}</h2>${body}</section>`;}

  function renderVerdict(result) {
    const lines=A.renderVerdictLines(config,result);
    let body=`<p class="branch-label">${esc(A.branchLabel(result))}</p>`;
    body+=lines.map(x=>noticeHtml(x,result.variant==='post_start'?'warn':'')).join('');
    if(result.variant==='post_start') {
      const considerations=(result.tuitionOutcome?.considerations||[]).map(x=>`<li><strong>${esc(x.consideration_label_tr)}</strong> — ${esc(x.explanation_tr)}</li>`).join('');
      const steps=(result.tuitionOutcome?.recommendedNextSteps||[]).map(x=>`<li><strong>${esc(x.step_label_tr)}</strong> — ${esc(x.step_description_tr)}</li>`).join('');
      if(considerations) body+=`<ul>${considerations}</ul>`; if(steps) body+=`<ol>${steps}</ol>`;
    }
    return section('Sonuç',body,'verdictSection');
  }

  function renderFeePanels(result) {
    const f=result.feeClassification;if(!f)return '';
    const rows=f.rows.map(row=>`<li>${esc(row.lookup?.category_label_tr||'Türü belli değil')}: ${row.amountKurus>0?esc(R.formatMoneyKurus(row.amountKurus)):'—'}</li>`).join('');
    let body=`<ul class="row-list">${rows}</ul>`;const ctx=context(result);
    if(f.tuitionBucketKurus>0)body+=`<div class="bucket"><strong>Öğrenim ücreti:</strong> ${esc(R.formatMoneyKurus(f.tuitionBucketKurus))}</div>`;
    if(f.ancillaryBucketKurus>0){body+=`<div class="bucket ancillary"><strong>Yan hizmet:</strong> ${esc(R.formatMoneyKurus(f.ancillaryBucketKurus))}</div>`;body+=noticeHtml(renderAnchor('ancillary_service_firewall_notice_tr',ctx));}
    if(f.prohibitedBucketKurus>0){body+=`<div class="bucket prohibited"><strong>İzin verilmeyen ücret:</strong> ${esc(R.formatMoneyKurus(f.prohibitedBucketKurus))}</div>`;body+=noticeHtml(renderAnchor('prohibited_fee_notice_tr',ctx),'danger');}
    if(f.hasPendingRows)body+=noticeHtml(renderAnchor('fee_item_classification_unknown_diagnostic_tr',ctx),'warn');
    return section('Ücret kalemleri',body,'feeClassificationSection');
  }

  function renderDeadline(result) {
    if(result.deadline?.status==='not_applicable')return '';
    const text=A.renderDeadlineText(config,result);return section('İade süresi',text?noticeHtml(text,result.deadline?.status==='late'?'warn':''):'');
  }

  function renderReconciliation(result) {
    const r=result.reconciliation;if(!r||!result.feeClassification)return '';
    let body=`<p class="branch-label">${esc(A.branchLabel(result))}</p><dl class="facts"><div><dt>Girdiğiniz toplam ödeme</dt><dd>${esc(R.formatMoneyKurus(result.feeClassification.totalPaidKurus))}</dd></div><div><dt>Girdiğiniz okul iadesi</dt><dd>${esc(R.formatMoneyKurus(r.amountReturnedKurus))}</dd></div></dl>`;
    for(const text of A.renderReconciliationText(config,result))body+=noticeHtml(text,r.overpayment?'warn':'');
    return section('Ödeme / iade mutabakatı',body,'reconciliationSection');
  }

  function renderEvidence(result) {
    const intro=renderAnchor('evidence_checklist_intro_tr',context(result));
    let body=intro?`<p>${esc(intro)}</p>`:'';
    body+=`<ul class="checklist">${(result.evidenceChecklist||[]).map(x=>`<li><strong>${x.required?'Gerekli':'Önerilen'}</strong> — ${esc(x.item_label_tr)}<br><span class="muted">${esc(x.why_it_matters_tr)}</span></li>`).join('')}</ul>`;
    if(result.weakEvidenceNotice)body+=noticeHtml(renderAnchor('weak_evidence_verbal_notice_only_tr',context(result)),'warn');
    return section('Belge kontrol listesi',body);
  }

  function renderEscalation(result) {
    const e=result.escalation;if(!e)return '';
    let body=`<p>${esc(renderAnchor('escalation_path_intro_tr',context(result))||'')}</p>`;
    body+=`<ol>${(e.preEscalationSteps||[]).map(x=>`<li><strong>${esc(x.step_label_tr)}</strong> — ${esc(x.step_description_tr)}</li>`).join('')}</ol>`;
    if(e.appliesWhenTr)body+=`<p>${esc(e.appliesWhenTr)}</p>`;
    if(!e.thresholdKnown)body+=noticeHtml(renderAnchor('thh_threshold_unknown_notice_tr',context(result)),'warn');
    if(e.canThhCta){const copy=renderAnchor('thh_referral_cta_tr',context(result));if(copy)body+=`<p><a class="btn inline-btn" href="${esc(e.crossLink.href)}">${esc(copy)}</a></p>`;}
    body+=`<ul>${(e.otherRecourse||[]).map(x=>`<li><strong>${esc(x.channel_label_tr)}</strong> — ${esc(x.routing_note_tr)}</li>`).join('')}</ul>`;
    return section('Sonraki adımlar',body);
  }

  function renderResult(result) {
    const box=$('resultBox');
    if(!result.ok){box.innerHTML=`<section class="card"><p class="errors" role="alert">${esc(MSG_SUMMARY)}</p></section>`;return;}
    let html=renderVerdict(result);
    if(result.variant!=='out_of_scope')html+=renderFeePanels(result)+renderDeadline(result)+renderReconciliation(result);
    html+=renderEvidence(result)+renderEscalation(result);
    box.innerHTML=html;
  }

  function updateStaleBanner() {
    const start=config.key_dates?.academic_year_start_date?.value;const until=E.computeAcademicYearEffectiveUntil(start);
    if(!start||!until)return;
    effectivityState=global.TFAEffectivityGuard.checkEffectivity({effectiveFrom:start,effectiveUntil:until,warningTemplate:effectivityConfig.default_stale_warning_tr});
    const el=$('staleBanner'); if(effectivityState.stale){const fake={feeClassification:{},tuitionOutcome:{},reconciliation:{},deadline:{},academicYearStartParts:E.parseIsoParts(start)};const text=renderAnchor('academic_year_stale_warning_tr',A.tokenContext(config,fake));el.textContent=text||effectivityState.warningTr||'';el.classList.remove('hidden');}
  }

  function updateNoDataBanner(result) {
    const el=$('noDataBanner');
    const show=Boolean(result?.ok && (result.branchDataUnavailable || result.tuitionOutcome?.kind==='no_data'));
    if(!show){el.textContent='';el.classList.add('hidden');return;}
    const text=renderAnchor('no_data_banner_tr',result?context(result):{});
    el.textContent=text||'';el.classList.toggle('hidden',!text);
  }

  function updateArtifactButtons(enabled){$('shareCardButton').disabled=!enabled;$('pdfButton').disabled=!enabled;}

  async function makeCard(){if(!lastResult)return;try{setText('artifactStatus','PNG hazırlanıyor…');const x=await A.generateShareCardPng(config,registry,lastResult);A.downloadBlob(x.blob,x.filename);setText('artifactStatus','PNG hazır.');}catch(err){console.error(err);setText('artifactStatus','PNG oluşturulamadı. Lütfen sayfayı yenileyip tekrar deneyin.');}}
  async function makePdf(){if(!lastResult)return;try{setText('artifactStatus','PDF hazırlanıyor…');const x=await A.generateAuditPdf(config,registry,lastResult,effectivityState);x.doc.save(x.filename);setText('artifactStatus','PDF hazır.');}catch(err){console.error(err);setText('artifactStatus','PDF oluşturulamadı. Lütfen sayfayı yenileyip tekrar deneyin.');}}

  $('addFeeButton').addEventListener('click',addFeeRow);
  $('todayChip').addEventListener('click',()=>{const n=new Date();const iso=`${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,'0')}-${String(n.getDate()).padStart(2,'0')}`;$('departureDate').value=iso;});
  $('auditForm').addEventListener('submit',ev=>{ev.preventDefault();clearFieldErrors();const collected=collectInput();const result=E.runAudit(config,collected.input,{registry});const blocked=collected.clientErrors.length>0||!result.ok;if(blocked){const focusables=showFieldErrors(collected.clientErrors,result.ok?[]:result.errors);lastResult={ok:false};updateNoDataBanner(lastResult);renderResult(lastResult);updateArtifactButtons(false);if(focusables[0]&&focusables[0].focus)focusables[0].focus();return;}lastResult=result;updateNoDataBanner(lastResult);renderResult(lastResult);updateArtifactButtons(true);});
  global.Asset22Page={parseTrAmount};
  $('shareCardButton').addEventListener('click',makeCard);$('pdfButton').addEventListener('click',makePdf);

  initSelectors(); updateStaleBanner(); updateArtifactButtons(false);
})(window);
