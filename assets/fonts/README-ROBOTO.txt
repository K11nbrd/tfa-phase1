Roboto font source contract for Asset 7 PDF adapter
===================================================

The adapter is configured to use Roboto-Regular and Roboto-Bold through one of two static-client paths:

1) Base64 injection before js/asset7-pdf-adapter.js loads:
   window.ASSET7_ROBOTO_REGULAR_BASE64 = "...";
   window.ASSET7_ROBOTO_BOLD_BASE64 = "...";

2) Static TTF assets served locally from:
   /assets/fonts/Roboto-Regular.ttf
   /assets/fonts/Roboto-Bold.ttf

No external font CDN is required. Keep these files local in the deployed static bundle so jsPDF can embed them into VFS before writing text.