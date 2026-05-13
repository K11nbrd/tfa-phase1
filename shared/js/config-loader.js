
export async function loadJSON(path){
  const key='tfa:'+path;
  const cached=sessionStorage.getItem(key);
  if(cached) return JSON.parse(cached);
  const res=await fetch(path,{cache:'no-store'});
  if(!res.ok) throw new Error('JSON yüklenemedi: '+path);
  const data=await res.json();
  sessionStorage.setItem(key,JSON.stringify(data));
  return data;
}
export function trFold(s=''){
  return String(s).toLocaleLowerCase('tr-TR').replaceAll('ı','i').replaceAll('İ','i').normalize('NFD').replace(/[\u0300-\u036f]/g,'');
}
export function money(n){return new Intl.NumberFormat('tr-TR',{style:'currency',currency:'TRY',maximumFractionDigits:2}).format(Number(n)||0)}
export function num(n,d=2){return new Intl.NumberFormat('tr-TR',{maximumFractionDigits:d,minimumFractionDigits:d}).format(Number(n)||0)}
export function todayStamp(){const d=new Date();return d.getFullYear()+String(d.getMonth()+1).padStart(2,'0')+String(d.getDate()).padStart(2,'0')}
export function trackEvent(name, params={}){
  if(typeof window !== 'undefined' && typeof window.gtag === 'function'){
    window.gtag('event', name, params);
  }
}
export function renderCrossLinks(container, links, cluster){
  if(!container || !links?.clusters?.[cluster]) return;
  const keys=links.clusters[cluster].asset_keys||[];
  const cards=[];
  for(const key of keys){
    const a=links.assets?.[key];
    if(a?.live===true && a?.canonical_url && a?.display_name_tr && a?.cross_link_cta_tr){
      cards.push(`<a class="crosslink" href="${a.canonical_url}" data-cross-cluster="${cluster}" data-cross-asset="${key}"><strong>${a.display_name_tr}</strong><br><span>${a.cross_link_cta_tr}</span></a>`);
    } else if(a?.live===true && !a?.canonical_url){
      console.warn('Cross-link canlı ama canonical_url eksik:', key);
    }
  }
  container.innerHTML=cards.length?`<section class="card"><h2>İlgili araçlar</h2><div class="crosslinks">${cards.join('')}</div></section>`:'';
  container.querySelectorAll('.crosslink').forEach(link=>link.addEventListener('click',()=>trackEvent('cross_link_click',{cluster:link.dataset.crossCluster||cluster,target_asset:link.dataset.crossAsset||'',href:link.href})));
}
