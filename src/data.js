const GL={lofi:'Lo-fi',synthwave:'Synthwave',ambient:'Ambient',pop:'Pop',trap:'Trap',local:'Your music',saavn:'JioSaavn',gaana:'Gaana'};
const SC={min:[0,2,3,5,7,8,10],maj:[0,2,4,5,7,9,11],dor:[0,2,3,5,7,9,10]};
const T={},LOC=[];
[['Neon Rain','Nova Lane','synthwave',108,57,'min',[0,5,2,6],'sawtooth',.5,300,152],['Chrome Horizon','Nova Lane','synthwave',100,55,'min',[0,3,5,4],'sawtooth',.45,260,168],
 ['Coffee at 3AM','Mellow Tide','lofi',76,60,'min',[0,3,5,4],'triangle',.35,30,141],['Rainy Window','Mellow Tide','lofi',82,62,'dor',[0,3,6,4],'triangle',.3,200,127],
 ['Study Loop','Paper Planes','lofi',70,58,'maj',[0,5,3,4],'triangle',.35,120,135],['Drift','Aurora Fields','ambient',60,52,'maj',[0,3,5,4],'sine',.14,180,172],
 ['Deep Focus','Aurora Fields','ambient',56,50,'min',[0,5,3,6],'sine',.12,225,185],['Weightless','Aurora Fields','ambient',64,53,'dor',[0,3,6,4],'triangle',.15,160,158],
 ['Sunday Drive','Kite & Co','pop',118,60,'maj',[0,4,5,3],'triangle',.5,45,148],['Hands Up Tonight','Kite & Co','pop',124,57,'min',[0,5,2,6],'square',.45,335,131],
 ['City Lights','Vera Moon','pop',112,59,'maj',[0,4,5,3],'triangle',.5,15,139],['Gold Teeth','K-Dawg','trap',140,55,'min',[0,0,5,6],'triangle',.4,50,122],
 ['Concrete Dreams','K-Dawg','trap',136,53,'min',[0,2,5,6],'sawtooth',.4,0,129],['Velvet Hours','Vera Moon','lofi',74,57,'min',[0,5,3,6],'triangle',.3,320,146]
].forEach((a,i)=>{const id='t'+(i+1);T[id]={id,title:a[0],artist:a[1],g:a[2],bpm:a[3],root:a[4],sc:a[5],prog:a[6],lead:a[7],dens:a[8],hue:a[9],dur:a[10],seed:i*7+3}});

const art=t=>{const h=t.hue;return 'background:radial-gradient(circle at 72% 28%,hsl('+((h+150)%360)+' 85% 68%) 0 16%,transparent 17%),linear-gradient(135deg,hsl('+h+' 72% 52%),hsl('+((h+55)%360)+' 70% 26%))'};


export {GL,SC,T,art,LOC};
