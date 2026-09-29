(function attachAsset22Artifacts(global) {
  'use strict';

  const APEX_HOST = 'https://dogrusonuc.com';
  const FONT_BASE_PATH = '/assets/fonts/';
  const FONT_FAMILY = 'Roboto';

  function renderer(config) { return global.Asset22Render.createRenderer(config); }
  function displayName(registry) { return registry?.assets?.asset_22_ozel_okul_iade?.display_name_tr || ''; }
  function yyyymmdd(now) { return `${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}`; }

  function tokenContext(config, result) {
    const f = result.feeClassification || {};
    const o = result.tuitionOutcome || {};
    const r = result.reconciliation || {};
    const d = result.deadline || {};
    return {
      kesinti_tl: o.kesintiKurus,
      refund_due_tuition_tl: o.refundDueTuitionKurus,
      tuition_bucket_tl: f.tuitionBucketKurus,
      annual_tuition_tl: o.annualTuitionKurus,
      ancillary_bucket_tl: f.ancillaryBucketKurus,
      prohibited_bucket_tl: f.prohibitedBucketKurus,
      amount_returned_by_school_tl: r.amountReturnedKurus ?? result.inputEcho?.amountReturnedKurus,
      total_paid_tl: f.totalPaidKurus,
      reconciliation_shortfall_tl: r.reconciliationShortfallKurus,
      difference_tl: r.differenceKurus,
      esik_tutar_tl: result.escalation?.thresholdKurus,
      kesinti_yuzdesi: Number(config.pre_start_cancellation?.kesinti_yuzdesi?.value || 0),
      iade_suresi: d.period,
      ayrilis_tarihi: result.departureDateParts,
      iade_son_tarihi: d.dueDateParts,
      academic_year_start_date: result.academicYearStartParts || global.Asset22Engine.parseIsoParts(config.key_dates?.academic_year_start_date?.value),
      gecen_gun: d.elapsedDays,
      kalan_gun: d.remainingDays,
      exception_label_tr: result.exception?.item?.exception_label_tr,
      institution_type_label_tr: result.institution?.type_label_tr,
      academic_year_label_tr: config.key_dates?.academic_year_start_date?.applies_to_academic_year_label_tr
    };
  }

  function verdictAnchor(config, result) {
    const kind = result.tuitionOutcome?.kind;
    if (result.variant === 'out_of_scope') return 'institution_out_of_scope_verdict_tr';
    if (kind === 'figures_withheld_pending') return 'fee_items_pending_figures_withheld_notice_tr';
    if (kind === 'full_refund_exception') return 'full_refund_exception_verdict_tr';
    if (kind === 'pre_start_deterministic') return 'pre_start_verdict_tr';
    if (kind === 'pre_start_e11_paid_below_kesinti') return 'pre_start_paid_below_kesinti_notice_tr';
    if (kind === 'pre_start_e10_annual_missing') return 'annual_tuition_missing_notice_tr';
    if (kind === 'pre_start_e12_annual_below_paid') return 'annual_tuition_below_paid_notice_tr';
    return null;
  }

  function branchLabel(result) {
    if (result.variant === 'full_refund_exception') return 'Tam iade istisnası';
    if (result.branch === 'pre_start') return 'Öğretim yılı başlamadan ayrılış';
    if (result.branch === 'post_start') return 'Öğretim yılı başladıktan sonra ayrılış';
    if (result.variant === 'out_of_scope') return 'Bu rehberin kapsamı dışında';
    return 'Uygulanacak kural belirlenemedi';
  }

  function renderVerdictLines(config, result) {
    const renderAnchor = renderer(config);
    const ctx = tokenContext(config, result);
    const kind = result.tuitionOutcome?.kind;
    const lines = [];
    const key = verdictAnchor(config, result);
    if (key) {
      const s = renderAnchor(key, ctx);
      if (s) lines.push(s);
    }
    if (result.variant === 'out_of_scope' && result.institution?.out_of_scope_reason_tr) lines.push(result.institution.out_of_scope_reason_tr);
    if (result.variant === 'post_start') {
      for (const key2 of ['post_start_state_label_tr','post_start_exact_calculation_unavailable_disclaimer_tr']) {
        const s = renderAnchor(key2, ctx); if (s) lines.push(s);
      }
    }
    if (result.feeClassification?.hasPendingRows && kind !== 'figures_withheld_pending') {
      const pending = renderAnchor('fee_items_pending_figures_withheld_notice_tr', ctx);
      if (pending) lines.push(pending);
    }
    return lines;
  }

  function renderDeadlineText(config, result) {
    const renderAnchor = renderer(config);
    const ctx = tokenContext(config, result);
    if (result.deadline?.status === 'within_window') return renderAnchor('statutory_deadline_within_window_notice_tr', ctx);
    if (result.deadline?.status === 'late') return renderAnchor('statutory_deadline_late_notice_tr', ctx);
    if (result.deadline?.status === 'boundary' || result.deadline?.status === 'unknown') return renderAnchor('statutory_deadline_unknown_notice_tr', ctx);
    return null;
  }

  function renderReconciliationText(config, result) {
    const renderAnchor = renderer(config);
    const ctx = tokenContext(config, result);
    const r = result.reconciliation;
    if (!r) return [];
    const lines = [];
    if (r.overpayment) {
      const s = renderAnchor('overpayment_return_notice_tr', ctx); if (s) lines.push(s);
    }
    if (r.kind === 'shortfall') {
      const s = renderAnchor('reconciliation_difference_notice_pre_start_tr', ctx); if (s) lines.push(s);
    } else if (r.kind === 'difference') {
      const s = renderAnchor('reconciliation_difference_notice_post_start_tr', ctx); if (s) lines.push(s);
    }
    return lines;
  }

  function citationTitle(config, citationId) {
    if (!citationId) return '';
    const hit = (config.citations || []).find(x => x.id === citationId);
    return hit?.title || citationId;
  }

  function governingCitationId(config, result) {
    if (result.variant === 'out_of_scope') return result.institution?.source_citation || '';
    if (result.exception?.matched) return result.exception.item?.source_citation || '';
    if (result.branch === 'pre_start') return config.pre_start_cancellation?.kesinti_yuzdesi?.source_citation || '';
    if (result.branch === 'post_start') return config.post_start_guidance?.considerations?.[0]?.source_citation || '';
    return '';
  }

  function noDataText(config, result) {
    if (result.tuitionOutcome?.kind !== 'no_data' && !result.branchDataUnavailable) return null;
    return renderer(config)('no_data_banner_tr', tokenContext(config, result));
  }

  function collectSurfaceText(config, registry, result, surface, effectivity = null) {
    const renderAnchor = renderer(config);
    const ctx = tokenContext(config, result);
    const out = [];
    if (surface === 'card') {
      const t = renderAnchor('share_card_title_tr', ctx); if (t) out.push(t);
      out.push(displayName(registry), branchLabel(result));
      out.push(...renderVerdictLines(config, result));
      if (result.deadline?.status === 'within_window') out.push('İade süresi devam ediyor.');
      if (result.deadline?.status === 'late') out.push('İade süresi doldu; paranın hesabınıza geçip geçmediğini kontrol edin.');
      out.push('Başvuru yolları ve belge listesi için:', 'dogrusonuc.com');
    } else if (surface === 'pdf') {
      const t = renderAnchor('pdf_report_title_tr', ctx); if (t) out.push(t);
      out.push(displayName(registry), branchLabel(result));
      out.push(...renderVerdictLines(config, result));
      const nd=noDataText(config,result); if(nd) out.push(nd);
      if (result.feeClassification?.ancillaryBucketKurus > 0) { const s=renderAnchor('ancillary_service_firewall_notice_tr',ctx); if(s) out.push(s); }
      if (result.feeClassification?.prohibitedBucketKurus > 0) { const s=renderAnchor('prohibited_fee_notice_tr',ctx); if(s) out.push(s); }
      if (result.feeClassification?.hasPendingRows) { const s=renderAnchor('fee_item_classification_unknown_diagnostic_tr',ctx); if(s) out.push(s); }
      const d=renderDeadlineText(config,result); if(d) out.push(d);
      out.push(...renderReconciliationText(config,result));
      for (const key of ['evidence_checklist_intro_tr','escalation_path_intro_tr']) { const s=renderAnchor(key,ctx); if(s) out.push(s); }
      if (result.weakEvidenceNotice) { const s=renderAnchor('weak_evidence_verbal_notice_only_tr',ctx); if(s) out.push(s); }
      if (!result.escalation?.thresholdKnown) { const s=renderAnchor('thh_threshold_unknown_notice_tr',ctx); if(s) out.push(s); }
      if (result.escalation?.canThhCta) { const s=renderAnchor('thh_referral_cta_tr',ctx); if(s) out.push(s); }
      const foot=renderAnchor('pdf_footer_disclaimer_tr',ctx); if(foot) out.push(foot);
      if (effectivity?.stale) { const s=renderAnchor('academic_year_stale_warning_tr',ctx); if(s) out.push(s); }
      out.push('dogrusonuc.com');
    } else {
      const nd=noDataText(config,result); if(nd) out.push(nd);
      out.push(...renderVerdictLines(config,result));
      if (result.feeClassification?.ancillaryBucketKurus > 0) { const s=renderAnchor('ancillary_service_firewall_notice_tr',ctx); if(s) out.push(s); }
      if (result.feeClassification?.prohibitedBucketKurus > 0) { const s=renderAnchor('prohibited_fee_notice_tr',ctx); if(s) out.push(s); }
      if (result.feeClassification?.hasPendingRows) { const s=renderAnchor('fee_item_classification_unknown_diagnostic_tr',ctx); if(s) out.push(s); }
      const d=renderDeadlineText(config,result); if(d) out.push(d);
      out.push(...renderReconciliationText(config,result));
      for (const key of ['evidence_checklist_intro_tr','escalation_path_intro_tr']) { const s=renderAnchor(key,ctx); if(s) out.push(s); }
      if (result.weakEvidenceNotice) { const s=renderAnchor('weak_evidence_verbal_notice_only_tr',ctx); if(s) out.push(s); }
      if (!result.escalation?.thresholdKnown) { const s=renderAnchor('thh_threshold_unknown_notice_tr',ctx); if(s) out.push(s); }
      if (result.escalation?.canThhCta) { const s=renderAnchor('thh_referral_cta_tr',ctx); if(s) out.push(s); }
      const foot=renderAnchor('footer_disclaimer_tr',ctx); if(foot) out.push(foot);
      if (effectivity?.stale) { const s=renderAnchor('academic_year_stale_warning_tr',ctx); if(s) out.push(s); }
    }
    return out.filter(Boolean);
  }

  async function ensureRobotoLoaded() {
    if (!document.fonts) return;
    await Promise.all([document.fonts.load('400 32px Roboto'), document.fonts.load('700 32px Roboto')]);
  }

  function wrapCanvasText(ctx, text, maxWidth) {
    const words = String(text).split(/\s+/); const lines=[]; let line='';
    for (const word of words) { const test=line?`${line} ${word}`:word; if (ctx.measureText(test).width>maxWidth && line) { lines.push(line); line=word; } else line=test; }
    if (line) lines.push(line); return lines;
  }

  async function generateShareCardPng(config, registry, result, now = new Date()) {
    await ensureRobotoLoaded();
    const dims=config.share_card_config?.dimensions_px||{}; const width=Number(dims.width), height=Number(dims.height);
    if (!(width>0&&height>0)) throw new Error('share_card_config.dimensions_px missing.');
    const canvas=document.createElement('canvas'); canvas.width=width; canvas.height=height; const ctx=canvas.getContext('2d');
    ctx.fillStyle='#f7faf9'; ctx.fillRect(0,0,width,height); const pad=72; let y=86;
    const lines=collectSurfaceText(config,registry,result,'card');
    for (let i=0;i<lines.length;i++) {
      const isTitle=i<2; ctx.font=`${isTitle?'700':'400'} ${isTitle?54:34}px Roboto`; ctx.fillStyle='#172033';
      const wrapped=wrapCanvasText(ctx,lines[i],width-pad*2); for(const line of wrapped){ if(y>height-pad-50) throw new Error('Share card copy crops at configured dimensions.'); ctx.fillText(line,pad,y); y+=isTitle?66:47; } y+=14;
    }
    const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png')); if(!blob) throw new Error('PNG generation failed.');
    const filename=config.share_card_config.filename_pattern.replace('{YYYYMMDD}',yyyymmdd(now)).replace('{ext}','png');
    return {blob,filename,canvas};
  }

  function abToBase64(buffer){const bytes=new Uint8Array(buffer);let binary='';for(let i=0;i<bytes.length;i+=0x8000)binary+=String.fromCharCode(...bytes.subarray(i,i+0x8000));return btoa(binary);}
  function fontFilename(entry){const s=String(entry||''); if(/bold/i.test(s))return 'Roboto-Bold.ttf'; if(/regular/i.test(s))return 'Roboto-Regular.ttf'; return null;}
  async function embedPdfFonts(doc,config){let reg=false,bold=false;for(const entry of config.pdf_report_config?.embedded_fonts||[]){const filename=fontFilename(entry);if(!filename)continue;const style=/Bold/.test(filename)?'bold':'normal';const res=await fetch(`${FONT_BASE_PATH}${filename}`);if(!res.ok)throw new Error(`Font load failed: ${filename}`);doc.addFileToVFS(filename,abToBase64(await res.arrayBuffer()));doc.addFont(filename,FONT_FAMILY,style);if(style==='bold')bold=true;else reg=true;}if(!reg||!bold)throw new Error('Both Roboto fonts are required.');}

  async function generateAuditPdf(config, registry, result, effectivity, now = new Date()) {
    const JsPDF=global.jspdf?.jsPDF; if(!JsPDF) throw new Error('Local jsPDF bundle is not loaded.');
    const dims=config.pdf_report_config?.page_dimensions_mm||{}; const width=Number(dims.width),height=Number(dims.height);
    const doc=new JsPDF({unit:'mm',format:[width,height],orientation:'portrait',compress:true}); await embedPdfFonts(doc,config);
    const renderAnchor=renderer(config), ctxTokens=tokenContext(config,result), margin=12,maxWidth=width-24; let y=12;
    const ensure=(mm=8)=>{if(y+mm>height-14){doc.addPage([width,height],'portrait');y=12;}};
    const para=(text,size=9.3,bold=false)=>{if(!text)return;doc.setFont(FONT_FAMILY,bold?'bold':'normal');doc.setFontSize(size);for(const line of doc.splitTextToSize(String(text),maxWidth)){ensure(5);doc.text(line,margin,y);y+=4.2;}y+=1;};
    const head=(text)=>{ensure(10);para(text,12,true);}; const list=(items)=>{for(const x of items||[])para(`• ${x}`);};
    const sections={
      header_block(){para(renderAnchor('pdf_report_title_tr',ctxTokens),15,true);para(displayName(registry),10.5,true);para(`Oluşturma tarihi: ${now.getDate()}.${String(now.getMonth()+1).padStart(2,'0')}.${now.getFullYear()}`);para(`Kurum türü: ${result.institution?.type_label_tr||'—'}`);},
      branch_verdict(){head('Durumunuz');para(branchLabel(result),10,true);const nd=noDataText(config,result);if(nd)para(nd);for(const s of renderVerdictLines(config,result))para(s);if(result.exception?.item?.legal_basis_tr)para(result.exception.item.legal_basis_tr);const citation=citationTitle(config,governingCitationId(config,result));if(citation)para(`Kaynak: ${citation}`);if(result.variant==='post_start'){list((result.tuitionOutcome?.considerations||[]).map(x=>`${x.consideration_label_tr}: ${x.explanation_tr}`));list((result.tuitionOutcome?.recommendedNextSteps||[]).map(x=>`${x.step_label_tr}: ${x.step_description_tr}`));}},
      fee_classification_breakdown(){if(!result.feeClassification)return;head('Ücret sınıflandırması');for(const row of result.feeClassification.rows){const label=row.lookup?.category_label_tr||'Türü belli değil';const bucket=row.bucket==='tuition'?'öğrenim ücreti':row.bucket==='ancillary'?'yan hizmet':row.bucket==='prohibited'?'izin verilmeyen ücret':'türü belli değil';para(row.lookup?`${label}: ${global.Asset22Render.formatMoneyKurus(row.amountKurus)} — ${bucket}`:`${label}: ${global.Asset22Render.formatMoneyKurus(row.amountKurus)}`);}if(result.feeClassification.ancillaryBucketKurus>0)para(renderAnchor('ancillary_service_firewall_notice_tr',ctxTokens));if(result.feeClassification.prohibitedBucketKurus>0)para(renderAnchor('prohibited_fee_notice_tr',ctxTokens));if(result.feeClassification.hasPendingRows)para(renderAnchor('fee_item_classification_unknown_diagnostic_tr',ctxTokens));},
      statutory_deadline_check(){head('İade süresi kontrolü');if(result.departureDateParts)para(`Ayrılış tarihi: ${global.Asset22Render.formatDateTr(result.departureDateParts)}`);if(result.deadline?.dueDateParts)para(`Hesaplanan iade son tarihi: ${global.Asset22Render.formatDateTr(result.deadline.dueDateParts)}`);para(renderDeadlineText(config,result));},
      reconciliation(){if(!result.reconciliation)return;head('Ödeme / iade mutabakatı');para(branchLabel(result),9.3,true);para(`Girdiğiniz toplam ödeme: ${global.Asset22Render.formatMoneyKurus(result.feeClassification.totalPaidKurus)}`);para(`Girdiğiniz okul iadesi: ${global.Asset22Render.formatMoneyKurus(result.reconciliation.amountReturnedKurus)}`);for(const s of renderReconciliationText(config,result))para(s);},
      evidence_checklist(){head('Belge kontrol listesi');para(renderAnchor('evidence_checklist_intro_tr',ctxTokens));list((result.evidenceChecklist||[]).map(x=>`${x.required?'Gerekli':'Önerilen'} — ${x.item_label_tr}: ${x.why_it_matters_tr}`));if(result.weakEvidenceNotice)para(renderAnchor('weak_evidence_verbal_notice_only_tr',ctxTokens));},
      escalation_path(){head('Sonraki adımlar');para(renderAnchor('escalation_path_intro_tr',ctxTokens));list((result.escalation?.preEscalationSteps||[]).map(x=>`${x.step_label_tr}: ${x.step_description_tr}`));if(result.escalation?.appliesWhenTr)para(result.escalation.appliesWhenTr);if(!result.escalation?.thresholdKnown)para(renderAnchor('thh_threshold_unknown_notice_tr',ctxTokens));if(result.escalation?.canThhCta){const c=renderAnchor('thh_referral_cta_tr',ctxTokens);if(c)para(c);}list((result.escalation?.otherRecourse||[]).map(x=>`${x.channel_label_tr}: ${x.routing_note_tr}`));},
      footer(){head('Not');para(renderAnchor('pdf_footer_disclaimer_tr',ctxTokens));if(effectivity?.stale)para(renderAnchor('academic_year_stale_warning_tr',ctxTokens));para('dogrusonuc.com');}
    };
    for(const code of config.pdf_report_config?.section_order||[]){if(sections[code])sections[code]();}
    return {doc,filename:config.pdf_report_config.filename_pattern.replace('{YYYYMMDD}',yyyymmdd(now))};
  }

  function downloadBlob(blob,filename){const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}

  global.Asset22Artifacts=Object.freeze({displayName,tokenContext,branchLabel,renderVerdictLines,renderDeadlineText,renderReconciliationText,collectSurfaceText,generateShareCardPng,generateAuditPdf,downloadBlob});
})(window);
