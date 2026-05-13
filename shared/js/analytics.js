/* TFA shared GA4 loader — production Measurement ID. */
(function(){
  'use strict';
  var MEASUREMENT_ID = 'G-4XP4GMLKKS';
  window.dataLayer = window.dataLayer || [];
  window.gtag = window.gtag || function(){ window.dataLayer.push(arguments); };
  window.gtag('js', new Date());
  window.gtag('config', MEASUREMENT_ID);
  var tag = document.createElement('script');
  tag.async = true;
  tag.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(MEASUREMENT_ID);
  var first = document.getElementsByTagName('script')[0];
  if (first && first.parentNode) first.parentNode.insertBefore(tag, first);
  else document.head.appendChild(tag);
})();
