const c="#185FA5";function p(t){try{return new Date().toLocaleDateString(t==="en"?"en-US":"ar-SA",{year:"numeric",month:"long",day:"numeric"})}catch{return new Date().toISOString().slice(0,10)}}function b(t,i={}){const n=i.showPageCounter!==!1,e=Number.isFinite(i.marginMm)?i.marginMm:t?10:12,a=n?Math.max(e+6,18):e;return`
@page {
  size: ${t?"A4 landscape":"A4"};
  margin: ${e}mm ${e}mm ${a}mm;
${n?`
  @bottom-center {
    content: "صفحة " counter(page) " من " counter(pages);
    font-family: 'Cairo', Arial, sans-serif;
    font-size: 10px;
    color: #555;
  }`:""}
}
*, *::before, *::after { box-sizing: border-box; }
body {
  font-family: 'Cairo', Arial, sans-serif;
  margin: 0;
  padding: ${t?"16px":"24px"};
  color: #1a1a1a;
  font-size: 13px;
  line-height: 1.6;
}
table { width: 100%; border-collapse: collapse; }
th, td { border: 1px solid #ddd; padding: 8px 12px; text-align: right; }
th { background: ${c}; color: #fff; font-weight: 700; }
tr:nth-child(even) td { background: #f8fafc; }
tfoot tr td { font-weight: 700; background: #f1f5f9; }
.print-header {
  text-align: center;
  border-bottom: 2px solid ${c};
  padding-bottom: 14px;
  margin-bottom: 20px;
}
.print-header img {
  max-height: 48px;
  margin-bottom: 6px;
  display: block;
  margin-inline: auto;
}
.print-header h1 { margin: 0 0 4px; font-size: 20px; font-weight: 800; color: #0f172a; }
.print-header .sub { font-size: 12px; color: #555; margin: 2px 0; }
.print-footer {
  margin-top: 24px;
  padding-top: 8px;
  border-top: 1px solid #ddd;
  text-align: center;
  font-size: 11px;
  color: #777;
}
@media print { body { padding: 0; } }
`.trim()}function r(t){return String(t??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")}function w({title:t="",body:i="",companyName:n="",subtitle:e="",logoUrl:a="",landscape:d=!1,extraCss:l="",showPageCounter:g=!0,pageMarginMm:m,htmlDir:f="rtl",htmlLang:s="ar"}={}){const h=n?`<div class="print-header">
        ${a?`<img src="${r(a)}" alt="" />`:""}
        <h1>${r(n)}</h1>
        ${e?`<div class="sub">${r(e)}</div>`:""}
      </div>`:"",u=s==="en"?`Printed on: ${p("en")}`:`طُبع بتاريخ: ${p("ar")}`,x=`<!DOCTYPE html>
<html dir="${r(f)}" lang="${r(s)}">
<head>
<meta charset="utf-8">
<title>${r(t||n)}</title>
<link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;500;600;700;800&family=Tajawal:wght@400;500;700;800&display=swap" rel="stylesheet">
<style>
${b(d,{showPageCounter:g,marginMm:m})}
${l?`
/* — CSS خاص بالوثيقة — */
${l}`:""}
</style>
</head>
<body>
${h}
${i}
<div class="print-footer">${u}</div>
</body>
</html>`,o=window.open("","_blank");o&&(o.document.write(x),o.document.close(),o.onafterprint=()=>{try{o.close()}catch{}},o.onload=()=>setTimeout(()=>o.print(),300))}export{w as o};
