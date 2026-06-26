import{j as e}from"./query-E0EfJOrI.js";import{u as Ke,r as f}from"./vendor-CTsGBvEK.js";import{B as Z,A as Le,M as g,f as q,p as Ee,e as Re,j as L,l as ze,u as Me,i as pe,H as De,I as de}from"./index-BRA1eOXo.js";import{e as Ie}from"./excelExportImport-Buqm7sB3.js";import{a as Oe}from"./pdfTableExport-Fv_BkReT.js";import{o as ye}from"./printUtils-3TCIkmvz.js";import{u as Fe,a as Ge,b as _e}from"./useReports-DVNrU6EN.js";import{p as B,i as I,m as ce,t as He,g as Be,d as X,a as J,b as le,P as xe,c as Ne,e as he,f as ge,h as Ve,j as Ye,k as We,l as Je,E as me}from"./reportHelpers-B6VABpz0.js";import{b as qe,d as Xe}from"./reportDrillLinks-BvqN4lH2.js";import{S as Se}from"./ScreenTabs-CYcHmAjy.js";import{K as ue,a as ve}from"./kpiCardTheme-A-5qj155.js";import{R as Ze,B as Qe,b as Ue,X as et,Y as tt,T as rt,a as nt,C as ot,L as at}from"./charts-CAWZJBsV.js";import{S as lt}from"./ScreenShell-DgKC4IAB.js";import"./pdf-DIf3FHdJ.js";import"./moneyInput-C7oWq2vJ.js";import"./reports-DY-iOs9F.js";import"./reports-w63fbRDt.js";const be=15;function st({state:t,onClose:j,companyId:r,year:o,t:n,lang:p}){var re;const m=Ke(),[u,E]=f.useState(1),[P,C]=f.useState("summary"),{data:s,isLoading:a,error:y}=Fe({companyId:r,year:o,month:t==null?void 0:t.month,groupKey:t==null?void 0:t.groupKey,itemKey:(t==null?void 0:t.itemKey)||void 0,enabled:!!t}),{data:x,isLoading:w,isError:O,error:N}=Ge({companyId:r,year:o,groupKey:t==null?void 0:t.groupKey,itemKey:(t==null?void 0:t.itemKey)||void 0,enabled:!!(t!=null&&t.showTrend)}),A=f.useMemo(()=>!t||o==null?null:qe({year:o,month:t.month??null,groupKey:t.groupKey,itemKey:t.itemKey||void 0}),[t,o]),b=f.useMemo(()=>{var i;return(i=x==null?void 0:x.points)!=null&&i.length?x.points.map(d=>{const k=Number(d.amount||0);return{key:String(d.month),name:d.label,amount:Math.abs(k),rawAmount:k,pctStr:B(d.percentOfSales),isSelected:(t==null?void 0:t.month)===d.month}}):[]},[x==null?void 0:x.points,t==null?void 0:t.month]),T=f.useMemo(()=>{const i=(x==null?void 0:x.points)||[];return i.length?i.reduce((d,k)=>Number(k.amount||0)>Number(d.amount||0)?k:d,i[0]):null},[x]),S=f.useMemo(()=>{var i;return(t==null?void 0:t.month)==null||!((i=x==null?void 0:x.points)!=null&&i.length)?null:x.points.find(d=>d.month===t.month)??null},[t==null?void 0:t.month,x==null?void 0:x.points]),R=f.useMemo(()=>s?I(s.contextAmount)&&S!=null&&!I(S.amount)?String(S.amount):s.contextAmount:null,[s,S]),v=f.useMemo(()=>s?I(s.annualAmount)&&x!=null&&!I(x.total)?String(x.total):s.annualAmount:null,[s,x]),z=f.useMemo(()=>s?I(s.contextPercentOfSales)&&S!=null&&!I(S.percentOfSales)?String(S.percentOfSales):s.contextPercentOfSales:null,[s,S]),K=f.useMemo(()=>{const i=[{id:"summary",label:n("reportTabSummary")}];return t!=null&&t.showTrend&&i.push({id:"trend",label:n("reportTabTrend")}),(s==null?void 0:s.kind)==="invoices"&&i.push({id:"documents",label:n("reportTabDocuments")}),(s==null?void 0:s.kind)==="derived"&&i.push({id:"breakdown",label:n("reportTabBreakdown")}),i},[t==null?void 0:t.showTrend,s==null?void 0:s.kind,n]);f.useEffect(()=>{E(1),C("summary")},[t==null?void 0:t.groupKey,t==null?void 0:t.itemKey,t==null?void 0:t.month,o]),f.useEffect(()=>{new Set(K.map(d=>d.id)).has(P)||C("summary")},[K,P]);const V=(s==null?void 0:s.items)??[],M=V.length,_=f.useMemo(()=>{const i=(u-1)*be;return V.slice(i,i+be)},[V,u]),c=f.useMemo(()=>{const i=(x==null?void 0:x.points)||[];if(!i.length)return"0";const d=i.filter(ee=>!I(ee.amount)),k=d.length?d:i,D=k.reduce((ee,se)=>ee+Math.abs(Number(se.amount||0)),0);return String(D/k.length)},[x]),Q=s?`${n("reportDetails")} — ${p==="en"?s.titleEn:s.titleAr}${s.monthLabel?` • ${s.monthLabel}`:""}`:n("reportDetails"),U=A?e.jsx(Z,{variant:"primary",size:"md",onClick:()=>{const i=Xe(A.query);m(`${A.path}?${i}`),j()},children:A.path==="/sales"?n("reportOpenInSales"):n("reportOpenInInvoices")}):(re=t==null?void 0:t.itemKey)!=null&&re.startsWith("account:")||(t==null?void 0:t.groupKey)==="grossProfit"||(t==null?void 0:t.groupKey)==="netProfit"?e.jsx("span",{className:"text-[12px] text-noorix-muted",children:n("reportDrillNoLink")}):null;return e.jsxs(Le,{open:!!t,onClose:j,title:Q,size:"xl",side:"start",className:"reports-detail-drawer",footer:U,children:[a&&e.jsx("div",{className:"p-6 text-center text-noorix-muted",children:n("loading")}),y&&e.jsx("div",{className:"p-4 rounded-xl text-noorix-red bg-noorix-red/10",children:y.message}),!a&&!y&&s&&e.jsxs(Se,{items:K,value:P,onChange:C,contentClassName:"nx-tab-content px-0 pt-3 pb-1 min-h-[160px]",animateContent:!1,children:[P==="summary"&&e.jsxs("div",{className:"grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(170px,1fr))]",children:[e.jsxs(g,{color:"var(--color-nx-purchases)",children:[e.jsx(g.Header,{label:s.month?n("selectedMonth"):n("reportBreakdown")}),e.jsx(g.Value,{value:ce(R),currency:"SR"})]}),s.kind==="invoices"&&e.jsxs(e.Fragment,{children:[e.jsxs(g,{color:"var(--color-nx-sales)",children:[e.jsx(g.Header,{label:n("reportAnnualTotal")}),e.jsx(g.Value,{value:ce(v),currency:"SR"})]}),e.jsxs(g,{color:"var(--color-nx-net-profit)",children:[e.jsx(g.Header,{label:s.month?n("reportSalesShareMonth"):n("reportSalesShareYear")}),e.jsx(g.Value,{value:B(z)})]}),e.jsxs(g,{color:"var(--color-nx-purchases)",children:[e.jsx(g.Header,{label:n("reportInvoicesCount")}),e.jsx(g.Value,{value:Number(s.invoiceCount||0).toLocaleString("en")})]})]})]}),P==="trend"&&(t==null?void 0:t.showTrend)&&e.jsxs(e.Fragment,{children:[O&&e.jsx("div",{className:"p-4 mb-2 rounded-xl text-noorix-amber border border-noorix-amber/30 bg-noorix-amber/10 text-[13px]",children:(N==null?void 0:N.message)||n("reportTrendLoadError")}),w&&!x&&!O&&e.jsx("div",{className:"py-6 text-center text-noorix-muted text-[13px]",children:n("loading")}),x&&e.jsxs("div",{className:"noorix-surface-card p-4",children:[e.jsxs("div",{className:"flex flex-wrap items-center justify-between gap-3 mb-3",children:[e.jsxs("div",{children:[e.jsx("div",{className:"text-[14px] font-extrabold",children:n("reportTrend")}),e.jsx("div",{className:"mt-1 text-noorix-muted text-[12px]",children:n("reportTimeline")})]}),e.jsxs("div",{className:"text-[12px] text-noorix-muted",children:[n("reportSalesShareYear"),": ",e.jsx("strong",{className:"nx-font-numbers",children:B(x.percentOfSalesYear)})]})]}),e.jsxs("div",{className:"grid gap-2.5 mb-3 [grid-template-columns:repeat(auto-fit,minmax(160px,1fr))]",children:[e.jsxs(g,{color:"var(--color-nx-purchases)",children:[e.jsx(g.Header,{label:n("reportMonthlyAverage")}),e.jsx(g.Value,{value:ce(c),currency:"SR"})]}),e.jsxs(g,{color:"var(--color-nx-profit)",children:[e.jsx(g.Header,{label:n("reportTopMonth")}),e.jsx(g.Value,{value:(T==null?void 0:T.label)||"—"}),e.jsx(g.Section,{children:e.jsx("span",{className:"text-[12px] text-noorix-muted inline-flex items-baseline gap-x-1",children:I(T==null?void 0:T.amount)?"—":e.jsxs(e.Fragment,{children:[e.jsx("span",{className:"nx-font-numbers",children:q(Number(T.amount))}),e.jsx("span",{className:"nx-sar",children:"SR"})]})})})]}),e.jsxs(g,{color:"var(--color-nx-sales)",children:[e.jsx(g.Header,{label:n("selectedMonth")}),e.jsx(g.Value,{value:(s==null?void 0:s.monthLabel)||n("allMonths")}),e.jsx(g.Section,{children:e.jsx("span",{className:"text-[12px] text-noorix-muted inline-flex items-baseline gap-x-1",children:I(R)?"—":e.jsxs(e.Fragment,{children:[e.jsx("span",{className:"nx-font-numbers",children:q(Number(R))}),e.jsx("span",{className:"nx-sar",children:"SR"})]})})})]})]}),e.jsxs("div",{className:"mt-1 rounded-xl border border-noorix-border bg-noorix-bg-muted/40 p-2 sm:p-4",dir:"ltr",children:[e.jsx("div",{className:"mb-2 text-[11px] font-semibold text-noorix-muted sm:text-[12px]",children:n("reportTrendChartCaption")}),e.jsx(Ze,{width:"100%",height:300,children:e.jsxs(Qe,{data:b,margin:{top:24,right:6,left:0,bottom:4},children:[e.jsx(Ue,{strokeDasharray:"3 3",vertical:!1,stroke:"var(--noorix-border)"}),e.jsx(et,{dataKey:"name",tick:{fontSize:10,fill:"var(--noorix-text-muted)"},axisLine:{stroke:"var(--noorix-border)"},tickLine:!1,interval:0}),e.jsx(tt,{tick:{fontSize:10,fill:"var(--noorix-text-muted)"},tickFormatter:i=>q(i,0),width:44,axisLine:!1,tickLine:!1}),e.jsx(rt,{cursor:{fill:"color-mix(in srgb, var(--color-nx-sales) 8%, transparent)"},content:({active:i,payload:d})=>{var D;if(!i||!(d!=null&&d.length))return null;const k=(D=d[0])==null?void 0:D.payload;return e.jsxs("div",{className:"rounded-lg border border-noorix-border bg-noorix-surface px-3 py-2 shadow-md text-[12px]",children:[e.jsx("div",{className:"mb-1 font-bold text-noorix-text",children:k==null?void 0:k.name}),e.jsxs("div",{className:"nx-font-numbers font-semibold text-noorix-text",children:[q(k==null?void 0:k.rawAmount)," ",e.jsx("span",{className:"nx-sar",children:"SR"})]}),e.jsxs("div",{className:"mt-1 text-[11px] text-nx-profit",children:[n("reportSalesShare"),": ",k==null?void 0:k.pctStr]})]})}}),e.jsxs(nt,{dataKey:"amount",radius:[6,6,0,0],maxBarSize:52,children:[b.map(i=>e.jsx(ot,{fill:i.rawAmount>=0?ue.grossProfit:ue.expenses,stroke:i.isSelected?ue.sales:"transparent",strokeWidth:i.isSelected?2:0},i.key)),e.jsx(at,{dataKey:"pctStr",position:"top",style:{fontSize:10,fill:"var(--noorix-text-muted)",fontFamily:"var(--noorix-font-numbers)"}})]})]})})]})]})]}),P==="breakdown"&&s.kind==="derived"&&e.jsx("div",{className:"reports-detail-derived-list grid gap-2.5",children:(s.items||[]).map(i=>e.jsxs("div",{className:"reports-detail-derived-item flex items-center justify-between border border-noorix-border rounded-xl px-3 py-2",children:[e.jsx("div",{className:"font-bold",children:p==="en"?i.labelEn:i.labelAr}),e.jsxs("div",{className:"nx-font-numbers font-extrabold inline-flex items-baseline gap-x-1",children:[e.jsx("span",{children:q(Number(i.amount))}),e.jsx("span",{className:"nx-sar",children:"SR"})]})]},i.key))}),P==="documents"&&s.kind==="invoices"&&e.jsx("div",{className:"w-full max-w-[1200px] mx-auto",children:e.jsxs("div",{className:"noorix-surface-card overflow-hidden p-0",children:[e.jsxs("div",{className:"nx-section-header",children:[e.jsxs("div",{children:[e.jsx("div",{className:"text-[13px] font-extrabold",children:n("reportSmartSummary")}),e.jsx("div",{className:"mt-1 text-[12px] text-noorix-muted",children:n("reportDetailListSummary",{count:M})}),M>=500&&e.jsx("div",{className:"mt-1.5 text-[11px] text-noorix-amber leading-snug max-w-[52ch]",children:n("reportDetailListCapHint")})]}),e.jsxs("div",{className:"text-[12px] text-noorix-muted inline-flex flex-wrap items-baseline gap-x-1",children:[n("reportAnnualTotal"),":",e.jsxs("strong",{className:"nx-font-numbers inline-flex items-baseline gap-x-1",children:[e.jsx("span",{children:I(v)?"—":q(Number(v))}),!I(v)&&e.jsx("span",{className:"nx-sar",children:"SR"})]})]})]}),e.jsx(Ee,{total:M,page:u,pageSize:be,onPageChange:E,columns:[{key:"transactionDate",label:n("transactionDate"),render:i=>Re(i)},{key:"invoiceNumber",label:n("reportInvoiceNumber"),render:(i,d)=>e.jsx("span",{className:"font-bold",children:d.summaryNumber||d.invoiceNumber||"—"})},{key:"supplier",label:n("reportSourceOrSupplier"),render:(i,d)=>{var k;return e.jsxs("div",{children:[e.jsx("div",{className:"font-semibold truncate",title:(p==="en"?d.supplierNameEn:d.supplierNameAr)||d.supplierNameAr||d.supplierNameEn||(p==="en"?d.itemLabelEn:d.itemLabelAr)||"—",children:(p==="en"?d.supplierNameEn:d.supplierNameAr)||d.supplierNameAr||d.supplierNameEn||(p==="en"?d.itemLabelEn:d.itemLabelAr)||"—"}),((k=d.channelNames)==null?void 0:k.length)>0&&e.jsx("div",{className:"text-[11px] text-noorix-muted mt-1",children:d.channelNames.slice(0,2).map(D=>p==="en"?D.nameEn||D.nameAr:D.nameAr||D.nameEn).join(" | ")})]})}},{key:"totalAmount",label:n("reportAmountInclTax"),numeric:!0,render:i=>e.jsxs("span",{className:"nx-font-numbers font-bold inline-flex items-baseline gap-x-1",children:[e.jsx("span",{children:q(Number(i))}),e.jsx("span",{className:"nx-sar",children:"SR"})]})},{key:"percentOfSales",label:n("reportSalesShare"),render:(i,d)=>e.jsx("span",{className:"nx-font-numbers text-nx-profit",children:B(d.percentOfSales??d.percentOfTotal)})},{key:"notes",label:n("notes"),render:i=>e.jsx("span",{className:"text-noorix-muted truncate",children:He(i)})}],data:_,keyExtractor:i=>i.id,emptyMessage:n("noDataInPeriod")})]})})]})]})}function it({report:t,visibleRows:j,collapsedGroups:r,toggleGroup:o,lang:n,t:p,isMobile:m,selectedMonthNumber:u,monthNames:E,onOpenDetail:P}){const C=n==="en"?"left":"right",s=m?u?320:240:u?1120:1060;return e.jsx("div",{className:"overflow-x-auto",children:e.jsxs("table",{className:L("w-full border-collapse",!m&&"table-fixed"),style:{minWidth:s},children:[e.jsxs("colgroup",{children:[e.jsx("col",{className:m?"w-[130px]":"w-[220px]"}),u!=null&&e.jsx("col",{className:m?"":"w-[76px]"}),!m&&((t==null?void 0:t.months)??[]).map(a=>e.jsx("col",{className:"w-[66px]"},a.index)),e.jsx("col",{className:"w-[100px]"})]}),e.jsx("thead",{children:e.jsxs("tr",{children:[e.jsx("th",{className:L("border-b-2 border-noorix-border bg-noorix-bg-surface z-[2] font-primary text-noorix-text font-bold",m?"px-2 py-1.5 text-xs":"px-3 py-1.5 text-[13px]","sticky",C==="left"?"left-0":"right-0"),children:p("reportItem")}),u!=null&&e.jsx("th",{className:"border-b-2 border-noorix-border bg-[var(--noorix-blue-6)] px-1.5 py-1.5 text-center text-[13px] font-bold font-primary text-noorix-text",children:E[u-1]}),!m&&((t==null?void 0:t.months)??[]).map(a=>e.jsx("th",{className:L("whitespace-nowrap border-b-2 border-noorix-border px-1 py-1 text-center text-xs font-semibold font-primary text-noorix-text",u===a.index&&"bg-[var(--noorix-blue-10)]"),children:a.label},a.index)),e.jsx("th",{className:L("border-b-2 border-noorix-border bg-noorix-table-header-bg px-3 py-1.5 text-end text-[13px] font-extrabold font-primary text-noorix-text"),style:{borderInlineStart:"2px solid var(--noorix-navy-12)"},children:p("reportAnnualTotal")})]})}),e.jsx("tbody",{children:j.map(a=>{const y=a.rowType==="group",x=a.rowType==="category",w=a.rowType==="summary",O=a.rowType==="item",N=y?a.groupKey:a.collapseKey,A=!!N&&!!r[String(N)],b=y||x,T=(a.depth||0)*22,S=Be(a),R=y?"py-1.5":w||x?m?"py-1":"py-1.5":m?"py-0.5":"py-1";return e.jsxs("tr",{className:"report-table-row",style:{background:S.bg,borderTop:S.borderTop||void 0},children:[e.jsx("td",{className:L("border-b border-noorix-border font-primary leading-snug","sticky z-[1] max-w-[280px] min-w-[130px] overflow-hidden text-ellipsis",C==="left"?"left-0":"right-0",m?y?"text-[13px]":"text-xs":y?"text-sm":x?"text-[13px]":w?"text-sm":"text-[13px]",m?"px-2":"px-3",R),style:{background:S.stickyBg},children:b?e.jsxs(Z,{type:"button",onClick:()=>o(String(N)),className:L("flex w-full min-w-0 cursor-pointer items-center gap-1.5 border-0 bg-transparent p-0 font-primary",n==="en"?"text-left":"text-right",x?"font-bold":"font-extrabold",m?y?"text-[13px]":"text-xs":y?"text-sm":"text-[13px]"),style:{color:S.accent,paddingInlineStart:T},title:`${X(a,n)} — ${p(A?"expand":"collapse")}`,children:[e.jsx("span",{className:"w-3.5 shrink-0 text-center text-[11px] opacity-75",children:A?"▶":"▼"}),e.jsx("span",{className:"min-w-0 truncate",children:X(a,n)})]}):e.jsxs(Z,{type:"button",onClick:()=>O&&P({month:u,groupKey:a.groupKey,itemKey:a.itemKey,showTrend:!0}),className:L("flex w-full min-w-0 border-0 bg-transparent p-0 font-primary",n==="en"?"text-left":"text-right",w?"font-extrabold":"font-medium",m?"text-xs":w?"text-sm":"text-[13px]",O?"cursor-pointer":"cursor-default"),style:{color:w||a.groupKey==="purchases"||a.groupKey==="expenses"?S.accent:"var(--noorix-text)",paddingInlineStart:T+(a.rowType==="item"?20:0)},title:O?`${X(a,n)} — ${p("reportOpenTrend")}`:X(a,n),children:[a.rowType==="item"&&e.jsx("span",{className:"w-3 shrink-0 text-sm leading-none text-noorix-muted",children:"–"}),e.jsx("span",{className:"min-w-0 truncate",children:X(a,n)})]})}),u!=null&&e.jsx("td",{className:L("border-b border-noorix-border px-2 text-center font-bold nx-font-numbers",R),style:{background:a.groupKey==="purchases"?"var(--noorix-red-7)":a.groupKey==="expenses"?"var(--noorix-amber-7)":"var(--noorix-blue-4)",color:w?Number(le(a,u)||0)>=0?"var(--noorix-accent-blue)":"var(--noorix-accent-red)":a.groupKey==="purchases"||a.groupKey==="expenses"?S.accent:"inherit"},children:e.jsxs("button",{type:"button",className:"block w-full cursor-pointer border-0 bg-transparent p-0 text-inherit",onClick:()=>P({month:u,groupKey:a.groupKey,itemKey:a.itemKey,showTrend:a.rowType==="item"}),children:[e.jsx("div",{className:"text-[13px] leading-tight",children:J(le(a,u))}),e.jsx("div",{className:"mt-px text-[11px] leading-tight",style:{color:xe},children:B(Ne(a,u))})]})}),!m&&(a.months??[]).map((v,z)=>{var K;return e.jsx("td",{className:L("border-b border-noorix-border px-1 text-center nx-font-numbers",R,u===z+1&&"bg-[var(--noorix-blue-6)]"),children:e.jsxs("button",{type:"button",className:"block w-full cursor-pointer border-0 bg-transparent p-0",style:{color:w?Number(v||0)>=0?"var(--noorix-accent-blue)":"var(--noorix-accent-red)":Number(v||0)<0?"var(--noorix-accent-red)":a.groupKey==="purchases"||a.groupKey==="expenses"?S.accent:"var(--noorix-text)",fontWeight:w||y?800:x?700:600},onClick:()=>P({month:z+1,groupKey:a.groupKey,itemKey:a.itemKey,showTrend:a.rowType==="item"}),children:[e.jsx("div",{className:L("leading-tight",y||w?"text-[13px]":"text-xs"),children:J(v)}),e.jsx("div",{className:"mt-px text-[11px] leading-tight",style:{color:xe},children:B((K=a.percentOfSalesMonths)==null?void 0:K[z])})]})},`${a.groupKey}-${z}`)}),e.jsxs("td",{className:L("border-b border-noorix-border bg-noorix-table-header-bg px-3 text-end font-extrabold nx-font-numbers",R),style:{borderInlineStart:"2px solid var(--noorix-navy-12)",color:w?Number(a.total||0)>=0?"var(--noorix-accent-blue)":"var(--noorix-accent-red)":a.groupKey==="purchases"||a.groupKey==="expenses"?S.accent:"inherit"},children:[e.jsx("div",{className:L("leading-tight",y||w?"text-sm":"text-[13px]"),children:J(a.total)}),e.jsx("div",{className:"mt-px text-[11px] leading-tight",style:{color:xe},children:B(a.percentOfSalesYear)})]})]},`${a.groupKey}-${a.itemKey||a.rowType}-${a.depth??0}`)})})]})})}function $(t){return String(t??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")}function pt(t,j,r){return t("reportPlPeriodMonth").replace("{month}",j).replace("{year}",String(r))}function ke(t){return t-1}function fe(t,j,r){var n,p;const o=(n=t==null?void 0:t.groups)==null?void 0:n.find(m=>m.key===j);return((p=o==null?void 0:o.months)==null?void 0:p[ke(r)])??"0"}function je(t,j,r){var n,p;const o=(n=t==null?void 0:t.summaryRows)==null?void 0:n.find(m=>m.key===j);return((p=o==null?void 0:o.months)==null?void 0:p[ke(r)])??"0"}function ae(t,j){const r=Number(t),o=Number(j);return!Number.isFinite(r)||!Number.isFinite(o)||Math.abs(o)<1e-9?"—":`${(r/o*100).toFixed(1)}%`}function dt(t){return t<=20?1:t<=28?.94:t<=36?.88:t<=46?.82:t<=56?.77:.72}function ct(t){return t<=24?"pl-density-comfortable":t<=36?"pl-density-normal":"pl-density-dense"}function xt(t,j,r,o){const n=fe(t,"sales",j),p=fe(t,"purchases",j),m=fe(t,"expenses",j),u=je(t,"grossProfit",j),E=je(t,"netProfit",j),C=[{label:o("revenueGroup"),val:n,sub:o("reportPlKpiSalesBase")},{label:o("purchasesGroup"),val:p,sub:`${o("reportPlKpiOfSales")} ${ae(p,n)}`},{label:o("annualGrossProfit"),val:u,sub:`${o("reportPlKpiOfSales")} ${ae(u,n)}`},{label:o("expensesGroup"),val:m,sub:`${o("reportPlKpiOfSales")} ${ae(m,n)}`},{label:o("annualNetProfit"),val:E,sub:`${o("reportPlKpiOfSales")} ${ae(E,n)}`}].map(s=>{const a=s.sub?`<div class="pl-kpi-sub">${$(s.sub)}</div>`:"";return`<td class="pl-kpi-cell">
        <div class="pl-kpi-label">${$(s.label)}</div>
        <div class="pl-kpi-val">${$(J(s.val))} <span class="pl-sr">SR</span></div>
        ${a}
      </td>`}).join("");return`<section class="pl-exec-summary" aria-label="${$(o("reportPlExecutiveSummary"))}">
      <h3 class="pl-section-title">${$(o("reportPlExecutiveSummary"))}</h3>
      <table class="pl-kpi" role="presentation"><tr>${C}</tr></table>
      <p class="pl-formula-foot">${$(o("reportPlFormulaSmart"))}</p>
    </section>`}function mt(){return`
.pl-root { width: 100%; max-width: 190mm; margin: 0 auto; }
.pl-doc { margin: 0 auto; }
.pl-doc-title {
  margin: 0 0 4px;
  font-size: 17px;
  font-weight: 800;
  color: #0f172a;
  text-align: center;
  letter-spacing: -0.02em;
  line-height: 1.2;
}
.pl-doc-sub {
  margin: 0 0 2px;
  font-size: 12px;
  font-weight: 600;
  color: #334155;
  text-align: center;
  line-height: 1.25;
}
.pl-doc-period {
  margin: 0 0 8px;
  font-size: 11.5px;
  color: #475569;
  text-align: center;
}
.pl-doc-note {
  margin: 0 0 10px;
  font-size: 9.5px;
  color: #64748b;
  text-align: center;
  line-height: 1.35;
  padding: 5px 8px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 4px;
}
.pl-sr { font-size: 0.72em; font-weight: 500; color: #64748b; margin-inline-start: 1px; }

.pl-section-title {
  margin: 0 0 6px;
  font-size: 11px;
  font-weight: 800;
  color: #0f172a;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  border-bottom: 2px solid #185FA5;
  padding-bottom: 3px;
}
.pl-exec-summary { page-break-inside: avoid; margin-bottom: 10px; }
.pl-kpi { width: 100%; border-collapse: separate; border-spacing: 5px 0; margin: 0 0 6px; }
.pl-kpi-cell {
  vertical-align: top;
  width: 20%;
  background: linear-gradient(180deg, #f8fafc 0%, #fff 55%);
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  padding: 7px 6px 6px;
  text-align: center;
  box-shadow: 0 1px 2px rgba(15,23,42,0.04);
}
.pl-kpi-label {
  font-size: 8.5px;
  font-weight: 700;
  color: #475569;
  line-height: 1.2;
  margin-bottom: 4px;
  text-transform: uppercase;
  letter-spacing: 0.03em;
}
.pl-kpi-val {
  font-size: 13px;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
  font-family: 'Tajawal', 'Cairo', ui-monospace, monospace;
  color: #0f172a;
  line-height: 1.15;
}
.pl-kpi-sub { font-size: 8px; color: #64748b; margin-top: 3px; line-height: 1.2; }
.pl-formula-foot {
  margin: 0;
  font-size: 8.5px;
  color: #64748b;
  text-align: center;
  font-style: italic;
  line-height: 1.3;
}

.pl-detail-block { margin-top: 4px; }
.pl-detail-block .pl-section-title { margin-top: 2px; }

table.pl-grid {
  width: 100%;
  border-collapse: collapse;
  font-size: 9.5px;
  box-shadow: none;
}
table.pl-grid thead th {
  background: #0f172a !important;
  color: #fff !important;
  font-weight: 700;
  font-size: 8px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  padding: 5px 6px !important;
  border: 1px solid #0f172a !important;
  vertical-align: bottom;
}
table.pl-grid thead th.pl-col-desc { text-align: start !important; width: 52%; }
table.pl-grid thead th.pl-col-num { text-align: end !important; white-space: nowrap; }
table.pl-grid tbody td {
  padding: 3px 6px !important;
  border: 1px solid #e2e8f0 !important;
  vertical-align: middle;
  line-height: 1.2;
}
table.pl-grid tbody td.pl-col-desc {
  text-align: start !important;
  font-weight: 500;
  color: #1e293b;
}
table.pl-grid tbody td.pl-col-num {
  text-align: end !important;
  font-variant-numeric: tabular-nums;
  font-family: 'Tajawal', 'Cairo', ui-monospace, monospace;
  white-space: nowrap;
}
table.pl-grid tbody tr.pl-gap td {
  height: 3px;
  padding: 0 !important;
  border: none !important;
  background: transparent !important;
}
table.pl-grid tbody tr.pl-row-group td.pl-col-desc {
  font-weight: 800;
  font-size: 9.5px;
  background: #e2e8f0 !important;
  color: #0f172a;
  border-top: 1.5px solid #94a3b8 !important;
}
table.pl-grid tbody tr.pl-row-group td.pl-col-num {
  font-weight: 800;
  background: #e2e8f0 !important;
  border-top: 1.5px solid #94a3b8 !important;
}
table.pl-grid tbody tr.pl-row-detail td.pl-col-desc { background: #fff; }
table.pl-grid tbody tr.pl-row-detail td.pl-col-num { background: #fff; color: #334155; }
table.pl-grid tbody tr.pl-row-detail.pl-depth-1 td.pl-col-desc { padding-inline-start: 14px !important; font-size: 9px; }
table.pl-grid tbody tr.pl-row-detail.pl-depth-2 td.pl-col-desc { padding-inline-start: 22px !important; font-size: 8.8px; }
table.pl-grid tbody tr.pl-row-detail.pl-depth-3 td.pl-col-desc { padding-inline-start: 30px !important; font-size: 8.6px; }
table.pl-grid tbody tr.pl-row-detail.pl-depth-4 td.pl-col-desc { padding-inline-start: 38px !important; font-size: 8.5px; }
table.pl-grid tbody tr.pl-row-summary td {
  font-weight: 800;
  font-size: 10px;
  background: #f1f5f9 !important;
  border-top: 2px double #0f172a !important;
  padding-top: 5px !important;
  padding-bottom: 5px !important;
}
table.pl-grid tbody tr.pl-row-summary.pl-net td.pl-col-num { font-size: 10.5px; }
table.pl-grid tbody tr:nth-child(even):not(.pl-gap):not(.pl-row-group) td { background: #fafafa; }
table.pl-grid tbody tr.pl-row-detail:nth-child(even) td.pl-col-num { background: #fafafa; }

.pl-density-normal table.pl-grid { font-size: 9px; }
.pl-density-normal table.pl-grid tbody td { padding: 2px 5px !important; }
.pl-density-normal .pl-kpi-val { font-size: 12px; }
.pl-density-dense table.pl-grid { font-size: 8px; }
.pl-density-dense table.pl-grid thead th { padding: 4px 4px !important; font-size: 7.5px; }
.pl-density-dense table.pl-grid tbody td { padding: 1px 4px !important; }
.pl-density-dense .pl-kpi-cell { padding: 5px 4px 4px; }
.pl-density-dense .pl-kpi-val { font-size: 11px; }
.pl-density-dense .pl-section-title { font-size: 10px; margin-bottom: 4px; }
.pl-density-dense .pl-doc-title { font-size: 15px; }

.pl-footer-meta {
  margin-top: 8px;
  font-size: 8px;
  color: #94a3b8;
  text-align: center;
  line-height: 1.25;
}

@media print {
  body { padding: 2mm 4mm !important; }
  .pl-root { max-width: 100% !important; }
  .print-header { margin-bottom: 5px !important; padding-bottom: 5px !important; }
  .print-header h1 { font-size: 14px !important; }
  .print-footer { margin-top: 6px !important; padding-top: 4px !important; font-size: 8px !important; }
  .pl-exec-summary, .pl-detail-block { page-break-inside: avoid; }
  table.pl-grid thead { display: table-header-group; }
  * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
}
`.trim()}function ut(t){const{report:j,selectedMonthNumber:r,monthLabel:o,year:n,lang:p,t:m,amountColumnTitle:u,collapsedGroups:E}=t,P=he(j,E),C=ge(P,E),s=C.some(v=>v.rowType==="item"||v.rowType==="category"),a=r,y=C.length,x=dt(y),w=ct(y),O=`<thead><tr>
    <th class="pl-col-desc">${$(m("reportItem"))}</th>
    <th class="pl-col-num">${$(u)}</th>
    <th class="pl-col-num">${$(m("reportSalesShareMonth"))}</th>
  </tr></thead>`,N=["<tbody>"];C.forEach((v,z)=>{v.rowType==="group"&&z>0&&N.push('<tr class="pl-gap"><td colspan="3"></td></tr>');const K=$(X(v,p)),V=J(le(v,a)),M=B(Ne(v,a));let _="";v.rowType==="summary"?(_="pl-row-summary",v.key==="netProfit"&&(_+=" pl-net")):v.rowType==="group"?_="pl-row-group":_=`pl-row-detail pl-depth-${Math.min(Number(v.depth)||0,4)}`;const c=v.rowType==="summary"&&(v.key==="netProfit"||v.key==="grossProfit")?Number(le(v,a)||0):null,Q=c!=null&&Number.isFinite(c)?` style="color:${c<0?"#b91c1c":"#15803d"}"`:"";N.push(`<tr class="${_}"><td class="pl-col-desc">${K}</td><td class="pl-col-num"${Q}>${$(V)}</td><td class="pl-col-num">${$(M)}</td></tr>`)}),N.push("</tbody>");const A=$(m("reportIncomeStatementTitle")),b=$(pt(m,o,n)),T=$(m("reportPlCurrencyNoteShort")),S=$(m("reportPlPreparedBy")),R=xt(j,a,p,m);return`<div class="pl-root" style="zoom:${x}"><div class="pl-doc ${w}"><h2 class="pl-doc-title">${A}</h2><div class="pl-doc-sub">${$(m("reportGeneral"))}</div><p class="pl-doc-period">${b}</p><p class="pl-doc-note">${T}</p>`+R+`<section class="pl-detail-block"><h3 class="pl-section-title">${$(m(s?"reportPlDetailSectionTitle":"reportPlDetailSectionTitleSummary"))}</h3><table class="pl-grid">${O}${N.join("")}</table></section><p class="pl-footer-meta">${S} · ${$(m("reportPlSinglePageLayout"))}</p></div></div>`}function bt(){return`
.pl-pdf-export-wrap { margin-top: 8px; }
table.pl-pdf-export-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 11px;
  box-shadow: 0 1px 3px rgba(15,23,42,0.08);
  border-radius: 6px;
  overflow: hidden;
}
table.pl-pdf-export-table thead th {
  background: linear-gradient(180deg, #0f172a 0%, #1e3a5f 100%) !important;
  color: #fff !important;
  font-weight: 800;
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  padding: 10px 8px !important;
  border: 1px solid #0f172a !important;
  vertical-align: middle;
}
table.pl-pdf-export-table tbody td {
  padding: 7px 8px !important;
  border: 1px solid #e2e8f0 !important;
  vertical-align: middle;
  line-height: 1.35;
}
table.pl-pdf-export-table tbody td:first-child {
  font-weight: 500;
  color: #1e293b;
  background: #fafbfc !important;
}
table.pl-pdf-export-table tbody td:not(:first-child) {
  text-align: center !important;
  font-variant-numeric: tabular-nums;
  font-family: 'Tajawal', 'Cairo', ui-monospace, monospace;
}
table.pl-pdf-export-table tbody tr.pl-pdf-row-group td {
  font-weight: 800;
  font-size: 11px;
  border-top: 2px solid #94a3b8 !important;
}
table.pl-pdf-export-table tbody tr.pl-pdf-gk-sales td {
  background: linear-gradient(180deg, #dbeafe 0%, #eff6ff 100%) !important;
  color: #1e40af;
}
table.pl-pdf-export-table tbody tr.pl-pdf-gk-purchases td {
  background: linear-gradient(180deg, #fee2e2 0%, #fef2f2 100%) !important;
  color: #991b1b;
}
table.pl-pdf-export-table tbody tr.pl-pdf-gk-expenses td {
  background: linear-gradient(180deg, #ffedd5 0%, #fffbeb 100%) !important;
  color: #9a3412;
}
table.pl-pdf-export-table tbody tr.pl-pdf-row-summary td {
  font-weight: 800;
  font-size: 11px;
  background: linear-gradient(180deg, #e0e7ff 0%, #eef2ff 100%) !important;
  border-top: 2px double #4338ca !important;
  color: #312e81;
}
table.pl-pdf-export-table tbody tr.pl-pdf-row-summary.pl-pdf-net-positive td:not(:first-child) {
  color: #15803d !important;
}
table.pl-pdf-export-table tbody tr.pl-pdf-row-summary.pl-pdf-net-negative td:not(:first-child) {
  color: #b91c1c !important;
}
table.pl-pdf-export-table tbody tr.pl-pdf-row-detail:nth-child(even) td:not(:first-child) {
  background: #f8fafc !important;
}
table.pl-pdf-export-table tbody tr.pl-pdf-row-detail:nth-child(even) td:first-child {
  background: #f1f5f9 !important;
}
@media print {
  table.pl-pdf-export-table { font-size: 10px; }
  table.pl-pdf-export-table thead th { padding: 8px 6px !important; }
  * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
}
`.trim()}const F=["يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"],G=["January","February","March","April","May","June","July","August","September","October","November","December"];function Et(){const{activeCompanyId:t,companies:j}=ze(),{t:r,lang:o}=Me(),n=pe().year,[p,m]=f.useState(()=>pe().year),[u,E]=f.useState(()=>String(pe().month)),[P,C]=f.useState(null),[s,a]=f.useState(2),[y,x]=f.useState({sales:!1,purchases:!1,expenses:!1}),[w,O]=f.useState(""),N=j==null?void 0:j.find(l=>l.id===t),A=o==="en"?(N==null?void 0:N.nameEn)||(N==null?void 0:N.nameAr)||"":(N==null?void 0:N.nameAr)||(N==null?void 0:N.nameEn)||"",{data:b,isLoading:T,error:S,isFetching:R,isPlaceholderData:v}=_e({companyId:t,year:p}),z=f.useMemo(()=>he(b,y),[b,y]);f.useLayoutEffect(()=>{b&&x(Ve(b,s))},[b,p,t,s]);const K=f.useMemo(()=>ge(z,y),[z,y]),V=f.useMemo(()=>Ye(K,w,o),[K,w,o]),M=f.useMemo(()=>u?(o==="ar"?F:G)[Number(u)-1]:"",[u,o]),_=f.useMemo(()=>Array.from({length:6},(l,h)=>n-h),[n]),c=u?Number(u):null,Q=f.useMemo(()=>{const l=o==="ar"?F:G;return[{id:"",label:r("allMonths")},...l.map((h,Y)=>({id:String(Y+1),label:h}))]},[r,o]),U=De();function re(l){x(h=>({...h,[l]:!h[l]}))}function i(l){var h,Y;return b?c?l==="grossProfit"||l==="netProfit"?((h=b.summaryRows.find(H=>H.key===l))==null?void 0:h.months[c-1])||"0":((Y=b.groups.find(H=>H.key===l))==null?void 0:Y.months[c-1])||"0":b.cards[l]||"0":"0"}function d(l){if(!b||l!=="grossProfit"&&l!=="netProfit")return null;const h=Number(i("sales")||0);return!h||h<1e-7?null:(Number(i(l)||0)/h*100).toFixed(1)}const{exportRows:k,plExportRowMeta:D}=f.useMemo(()=>{if(!b)return{exportRows:[],plExportRowMeta:[]};const l=We(K,o,r,u?Number(u):null,u?{amountColumnTitle:`${M} ${p}`}:void 0),h=Je(b,c,K);return{exportRows:l,plExportRowMeta:h}},[b,K,o,r,u,M,p,c]),ee=f.useMemo(()=>{const l=[r("revenueGroup"),r("purchasesGroup"),r("expensesGroup")];return c&&M?(l.push(`${M} ${p}`),l):(me.forEach(h=>l.push(h)),l.push(r("reportAnnualTotal")),l)},[r,c,M,p]);function se(){b&&Ie({data:k,filename:`general-profit-loss-${p}${c?`-m${c}`:""}.xlsx`,companyName:A||void 0,title:c?`${r("reportIncomeStatementTitle")} — ${M} ${p}`:`${r("reportGeneral")} — ${p}`,sheetName:o==="ar"?"ربح وخسارة":"P&L",rtl:o!=="en",headerColor:c?"1e3a5f":"185FA5",profitLossRowMeta:D,money2ColumnKeys:ee,moneyColumnFractionDigits:0})}function we(){b&&Oe({companyName:A||r("reports"),title:c?`${r("reportIncomeStatementTitle")} — ${p}`:`${r("reportGeneral")} — ${p}`,subtitle:c?`${(o==="ar"?F:G)[c-1]}`:"",filename:`general-profit-loss-${p}${c?`-m${c}`:""}.pdf`,landscape:!c,data:k,extraCss:bt(),htmlDir:o==="en"?"ltr":"rtl",htmlLang:o==="en"?"en":"ar",showPageCounter:!c,pageMarginMm:c?8:10,pdfRowMetas:D})}function te(l){return String(l??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")}function $e(){if(!b)return;const l=he(b,y),h=ge(l,y),H=c?(o==="ar"?F:G)[c-1]:"",ne=o==="en"?"en":"ar",oe=o==="en"?"ltr":"rtl";if(c){const W=`${H} ${p}`;ye({title:r("reportIncomeStatementTitle"),companyName:A||r("reports"),subtitle:`${H} ${p}`,landscape:!1,htmlLang:ne,htmlDir:oe,showPageCounter:!1,pageMarginMm:5,extraCss:mt(),body:ut({report:b,selectedMonthNumber:c,monthLabel:H,year:p,lang:o,t:r,amountColumnTitle:W,collapsedGroups:y})});return}const ie=`${me.map(W=>`<th>${te(W)}</th>`).join("")}<th>${te(r("reportAnnualTotal"))}</th><th>${te(r("reportSalesShareYear"))}</th>`,Pe=h.map(W=>{const Te=te(X(W,o)),Ce=(W.months??[]).map(Ae=>`<td>${J(Ae)}</td>`).join("");return`<tr><td>${Te}</td>${Ce}<td>${J(W.total)}</td><td>${B(W.percentOfSalesYear)}</td></tr>`}).join("");ye({title:r("reportGeneral"),companyName:A||r("reports"),subtitle:`${p} · ${r("reportGeneral")}`,landscape:!0,htmlLang:ne,htmlDir:oe,body:`<table><thead><tr><th>${te(r("reportItem"))}</th>${ie}</tr></thead><tbody>${Pe}</tbody></table>`})}return e.jsxs(lt,{children:[e.jsx(st,{state:P,onClose:()=>C(null),companyId:t,year:p,t:r,lang:o}),e.jsxs("div",{className:"flex flex-col gap-4",children:[e.jsxs("div",{className:"nx-page-header",children:[e.jsx("div",{className:"flex-1 min-w-0",children:e.jsx("h2",{className:"font-bold m-0 text-[18px]",children:r("reportGeneral")})}),e.jsxs("div",{className:"flex items-end flex-wrap gap-2 flex-[0_1_auto]",children:[e.jsx(de,{type:"select",label:r("reportYear"),value:p,onChange:l=>m(Number(l.target.value)),children:_.map(l=>e.jsx("option",{value:l,children:l},l))}),!U&&e.jsxs(de,{type:"select",label:r("reportMonth"),value:u,onChange:l=>E(l.target.value),children:[e.jsx("option",{value:"",children:r("allMonths")}),me.map((l,h)=>e.jsx("option",{value:h+1,children:l},l))]}),e.jsxs("div",{className:"nx-toolbar",children:[e.jsx(Z,{size:"sm",onClick:se,disabled:!b,children:r("exportExcel")}),e.jsx(Z,{size:"sm",onClick:we,disabled:!b,children:"طباعة / PDF"}),e.jsx(Z,{size:"sm",onClick:$e,disabled:!b,children:r("print")})]})]})]}),!t&&e.jsx("div",{className:"noorix-surface-card p-5 text-center text-noorix-muted",children:r("pleaseSelectCompany")}),t&&e.jsxs(e.Fragment,{children:[e.jsxs("div",{className:"noorix-surface-card p-4 text-noorix-muted text-[13px]",children:[r("reportClickHint"),e.jsx("div",{className:"mt-2",children:r("reportPlDetailInvoicesHint")}),c&&e.jsx("div",{className:"mt-2",children:r("reportFocusedMonthDesc")})]}),b&&e.jsx("div",{className:L("nx-kpi-container mt-1 transition-opacity duration-200",R&&v&&"pointer-events-none opacity-55"),children:e.jsx("div",{className:"nx-kpi-grid",children:[{key:"sales",label:c?`${(o==="ar"?F:G)[c-1]} — ${r("revenueGroup")}`:r("annualSales")},{key:"purchases",label:c?`${(o==="ar"?F:G)[c-1]} — ${r("purchasesGroup")}`:r("annualPurchases")},{key:"expenses",label:c?`${(o==="ar"?F:G)[c-1]} — ${r("expensesGroup")}`:r("annualExpenses")},{key:"grossProfit",label:r("annualGrossProfit")},{key:"netProfit",label:r("annualNetProfit")}].map(l=>{const h=l.key==="grossProfit"||l.key==="netProfit"?d(l.key):null,Y=Number(i(l.key)||0),H=l.key==="grossProfit"||l.key==="netProfit",ne=ve[String(l.key)]||ve.sales,oe=c?`${(o==="ar"?F:G)[c-1]} · ${p}`:String(p),ie=H&&Y<0;return e.jsxs(g,{color:ne,className:"min-h-[120px]",children:[e.jsx(g.Header,{label:l.label}),e.jsx(g.Value,{value:J(i(l.key)),currency:"SR",color:ie?"var(--noorix-accent-red)":void 0}),e.jsx("div",{className:"min-h-[10px] flex-1 shrink-0","aria-hidden":!0}),e.jsxs(g.Footer,{className:"mt-3 border-t border-noorix-border pt-3 pb-3",children:[e.jsx("span",{className:"min-w-0 flex-1 truncate text-[11px] font-medium text-noorix-muted",children:oe}),h!=null&&e.jsxs("span",{className:L("inline-flex max-w-[min(100%,140px)] shrink-0 truncate rounded px-2 py-0.5 text-[11px] font-bold",Number(h)>0&&"bg-[#eaf3de] text-[#3B6D11]",Number(h)<0&&"bg-[#FCEBEB] text-[#A32D2D]",Number(h)===0&&"bg-noorix-bg-muted text-noorix-muted"),children:[r("reportProfitMargin"),": ",h,"%"]})]})]},`${p}-${u||"all"}-${l.key}`)})})}),T&&e.jsx("div",{className:"noorix-surface-card text-center text-noorix-muted p-6",children:r("loading")}),S&&e.jsx("div",{className:"noorix-surface-card p-5 text-noorix-red",style:{background:"var(--noorix-red-8)"},children:S.message}),!T&&!S&&b&&z.length===0&&e.jsx("div",{className:"noorix-surface-card text-center text-noorix-muted p-6",children:r("reportNoData")}),!T&&!S&&b&&V.length>0&&e.jsx("div",{className:"max-w-[min(100%,1400px)] mx-auto",children:e.jsxs("div",{className:"noorix-surface-card overflow-hidden p-0",children:[U&&e.jsx(Se,{variant:"underline",items:Q,value:u,onChange:E,barClassName:"border-b border-noorix-border"}),e.jsxs("div",{className:"flex flex-col gap-0 border-b border-noorix-border bg-noorix-bg-muted/30 px-3 py-2.5",children:[e.jsxs("div",{className:"flex flex-wrap items-end gap-2",children:[e.jsxs("div",{className:"min-w-[120px] flex-1",children:[e.jsx("div",{className:"text-[11px] font-semibold uppercase tracking-wide text-noorix-muted",children:r("reportPlToolbarPeriod")}),e.jsx("div",{className:"text-[14px] font-bold text-noorix-text",children:c?`${(o==="ar"?F:G)[c-1]} ${p}`:String(p)})]}),e.jsx("div",{className:"flex flex-wrap gap-1",children:[1,2,3].map(l=>e.jsx(Z,{size:"sm",variant:s===l?"primary":"default",type:"button",onClick:()=>a(l),children:r(l===1?"reportPlLevel1":l===2?"reportPlLevel2":"reportPlLevel3")},l))}),e.jsx(de,{type:"text",size:"sm",className:"max-w-[220px] min-w-[140px]",label:r("reportPlRowFilterPlaceholder"),value:w,onChange:l=>O(l.target.value)})]}),e.jsx("div",{className:"mt-1.5 text-[11px] leading-snug text-noorix-muted",children:r("reportPlLevelsHint")})]}),e.jsx(it,{report:b,visibleRows:V,collapsedGroups:y,toggleGroup:re,lang:o,t:r,isMobile:U,selectedMonthNumber:c,monthNames:o==="ar"?F:G,onOpenDetail:l=>C(l)})]})})]})]})]})}export{Et as default};
