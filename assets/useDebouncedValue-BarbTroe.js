import{r as o}from"./vendor-CTsGBvEK.js";function s(e,t=300){const[r,u]=o.useState(e);return o.useEffect(()=>{const c=setTimeout(()=>u(e),t);return()=>clearTimeout(c)},[e,t]),r}export{s as u};
