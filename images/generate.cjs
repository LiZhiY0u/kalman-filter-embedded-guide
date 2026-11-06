// Deterministic teaching figures. Run: node images/generate.cjs
const fs = require('node:fs');
const path = require('node:path');
const out = __dirname;
const colors = {truth:'#334155',measure:'#d97706',predict:'#2563eb',fused:'#059669'};
const esc=s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;');
const text=(x,y,s,size=18,color='#334155')=>`<text x="${x}" y="${y}" font-size="${size}" fill="${color}">${esc(s)}</text>`;
const line=(x,y,a,b,c='#cbd5e1',dash='')=>`<line x1="${x}" y1="${y}" x2="${a}" y2="${b}" stroke="${c}" stroke-width="1.5" ${dash?'stroke-dasharray="'+dash+'"':''}/>`;
function doc(title,sub,body){return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="720" viewBox="0 0 1200 720"><rect width="1200" height="720" fill="#fff"/><g font-family="Microsoft YaHei, Noto Sans CJK SC, sans-serif">${text(48,48,title,28)}${text(48,82,sub,17,'#64748b')}${body}</g></svg>`;}
function plot(box,xmin,xmax,ymin,ymax,xlabel,ylabel){let {x,y,w,h}=box; let X=v=>x+(v-xmin)/(xmax-xmin)*w,Y=v=>y+h-(v-ymin)/(ymax-ymin)*h;let s='';for(let i=0;i<=5;i++){let a=xmin+(xmax-xmin)*i/5,b=ymin+(ymax-ymin)*i/5;s+=line(X(a),y,X(a),y+h,'#e2e8f0')+text(X(a)-12,y+h+28,a.toFixed(1),15);s+=line(x,Y(b),x+w,Y(b),'#e2e8f0')+text(x-55,Y(b)+5,b.toFixed(1),15);} s+=text(x+w-100,y+h+60,xlabel,17)+text(x,y-18,ylabel,17);return {X,Y,s};}
function curve(p,data,color,dash=''){return `<path d="${data.map(([x,y],i)=>(i?'L':'M')+p.X(x).toFixed(2)+','+p.Y(y).toFixed(2)).join(' ')}" fill="none" stroke="${color}" stroke-width="3" ${dash?'stroke-dasharray="'+dash+'"':''}/>`;}
function legend(x,y,items){return items.map(([label,c,d],i)=>line(x+i*270,y,x+i*270+35,y,c,d)+text(x+45+i*270,y+6,label,17)).join('');}
const files=[];function save(name,title,sub,body){fs.writeFileSync(path.join(out,name+'.svg'),doc(title,sub,body));files.push(name);}

// 1. Gaussian fusion: prior N(12,4), independent observation z=13, R=1.
let p=plot({x:105,y:160,w:1010,h:365},6,18,0,.5,'位置 x / m','概率密度 / (1/m)');
const gaussian=(m,v)=>Array.from({length:481},(_,i)=>{let x=6+i/40;return [x,Math.exp(-((x-m)**2)/(2*v))/Math.sqrt(2*Math.PI*v)];});
let body=p.s+curve(p,gaussian(12,4),colors.predict)+curve(p,gaussian(13,1),colors.measure)+curve(p,gaussian(12.8,.8),colors.fused);
body+=legend(105,120,[['预测：均值 12，方差 4',colors.predict],['测量似然：z=13，R=1',colors.measure],['后验：均值 12.8，方差 0.8',colors.fused]]);
body+=text(105,627,'K = 4 / (4 + 1) = 0.8；估计更靠近测量，且后验分布更窄。',21);
body+=text(105,666,'高斯、独立误差示例；橙线是随状态变化的测量似然，不是第二份真实状态分布。',17,'#64748b');
save('01-variance-fusion','方差怎样决定融合结果','分布越窄，表示误差越集中；曲线高度不是“传感器准确率”。',body);

// 2. A single position prediction followed by correction, shared time axis.
p=plot({x:105,y:160,w:1010,h:365},0,1.2,9,15,'时间 / s','位置 / m');
body=p.s+legend(105,120,[['模型预测',colors.predict],['传感器测量',colors.measure],['修正后的估计',colors.fused]]);
body+=curve(p,[[0,10],[1,12]],colors.predict,'8 5');
for(const [v,c,label,dy] of [[12,colors.predict,'预测 12 m',30],[13,colors.measure,'测量 13 m',-18],[12.8,colors.fused,'融合 12.8 m',18]]){body+=`<circle cx="${p.X(1)}" cy="${p.Y(v)}" r="6" fill="${c}"/>`+text(p.X(1)-200,p.Y(v)+dy,label,18,c);}
body+=line(p.X(1)+22,p.Y(12),p.X(1)+22,p.Y(12.8),colors.fused);
body+=text(105,625,'预测：10 m + 2 m/s × 1 s = 12 m',21)+text(105,664,'修正：12 + 0.8 × (13 − 12) = 12.8 m；竖直修正是更新估计，不是小车瞬间跳动。',18);
save('02-predict-correct','数据发展方向：沿模型预测，再由测量修正','假设一秒内匀速；同一时刻的预测、测量与后验估计是三个不同的量。',body);

// 3. Random-walk data with seeded Gaussian increments, fixed Q and R.
let seed=20261101;function uniform(){seed=(Math.imul(seed,1664525)+1013904223)>>>0;return (seed+.5)/4294967296;}function normal(){return Math.sqrt(-2*Math.log(uniform()))*Math.cos(2*Math.PI*uniform());}
const samples=[];let truth=25,x=25,P=1;for(let k=0;k<=100;k++){if(k)truth+=.1*normal();let z=truth+.2*normal();let pred=x;P+=.01;let gain=P/(P+.04);x+=gain*(z-x);P*=1-gain;samples.push({t:k*.1,truth,z,pred,x,P});}
const values=samples.flatMap(d=>[d.truth,d.z,d.x]);const lo=Math.floor(Math.min(...values)*2)/2-.2,hi=Math.ceil(Math.max(...values)*2)/2+.2;
p=plot({x:105,y:160,w:1010,h:365},0,10,lo,hi,'时间 / s','温度 / ℃');
body=p.s+legend(105,120,[['模拟真值',colors.truth],['带噪测量',colors.measure],['卡尔曼估计',colors.fused]]);
body+=curve(p,samples.map(d=>[d.t,d.truth]),colors.truth)+curve(p,samples.map(d=>[d.t,d.z]),colors.measure)+curve(p,samples.map(d=>[d.t,d.x]),colors.fused);
body+=text(105,626,'模型：xₖ = xₖ₋₁ + wₖ；Q = 0.01 ℃²，R = 0.04 ℃²，采样间隔 0.1 s。',20);
body+=text(105,665,'固定随机种子生成；融合仍有误差，也可能短时偏离真值，不能以平滑程度代替精度评价。',17,'#64748b');
save('03-temperature-series','连续采样：测量跳动，估计随数据逐轮更新','模拟数据，非传感器实测；过程噪声和测量噪声采用独立高斯模型。',body);
fs.writeFileSync(path.join(out,'temperature-simulation.csv'),'time_s,true_c,measured_c,predicted_c,estimated_c,variance_c2\n'+samples.map(d=>[d.t,d.truth,d.z,d.pred,d.x,d.P].join(',')).join('\n'));

// 4. Uncertainty growth and reduction in scalar random-walk filter.
let pp=1;const saw=[[0,pp]];for(let k=1;k<=12;k++){let pm=pp+.2;saw.push([k,pm]);pp=pm*.25/(pm+.25);saw.push([k,pp]);}
p=plot({x:105,y:160,w:1010,h:365},0,12,0,1.3,'采样序号 k','误差方差 / ℃²');
body=p.s+curve(p,saw,colors.predict);
for(let k=1;k<=12;k++){let i=k*2;body+=`<circle cx="${p.X(k)}" cy="${p.Y(saw[i][1])}" r="4" fill="${colors.fused}"/>`;}
body+=legend(105,120,[['预测：不确定性增加',colors.predict],['测量修正后',colors.fused]]);
body+=text(105,625,'示例：P⁻ = P + Q，Q = 0.2；P = P⁻R / (P⁻ + R)，R = 0.25。',21);
body+=text(105,665,'连线用于展示更新顺序；竖直下降是同一时刻的测量更新，稳态方差不会无限降到零。',17,'#64748b');
save('04-uncertainty-cycle','每轮更新：先扩大不确定性，再用测量缩小','这张图表示估计误差方差，不是温度自身的波动；参数与上一张图独立。',body);

async function render(){
  let sharp;
  try { sharp=require('sharp'); }
  catch(e){console.log('SVG generated. PNG renderer unavailable: '+e.message);return;}
  for(const name of files)await sharp(path.join(out,name+'.svg')).png().toFile(path.join(out,name+'.png'));
  console.log('Generated '+files.length+' SVG and PNG figures.');
}
render().catch(e=>{console.error(e);process.exitCode=1;});
