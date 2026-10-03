const express=require('express'),http=require('http'),{WebSocketServer}=require('ws'),fs=require('fs'),path=require('path'),crypto=require('crypto');
const FILE=process.env.DATA_FILE||path.join(__dirname,'data.json');
let DB={docs:{},keys:{}};try{DB=JSON.parse(fs.readFileSync(FILE,'utf8'))}catch{}
let tm;const save=()=>{clearTimeout(tm);tm=setTimeout(()=>fs.writeFile(FILE,JSON.stringify(DB),()=>{}),500)};
const app=express();const PUB=fs.existsSync(path.join(__dirname,'public','index.html'))?path.join(__dirname,'public'):null;
const INDEX=PUB?path.join(PUB,'index.html'):path.join(__dirname,'index.html');
if(PUB)app.use(express.static(PUB));
app.get('/',(q,r)=>r.sendFile(INDEX));app.get('/health',(q,r)=>r.send('ok'));
const server=http.createServer(app),wss=new WebSocketServer({server,path:'/ws',maxPayload:64*1024});
const subs=new Map(),hash=k=>crypto.createHash('sha256').update(String(k)).digest('hex');
const pushDoc=p=>{const d=DB.docs[p],m=JSON.stringify({sub:p,exists:!!d,data:d||null});(subs.get(p)||[]).forEach(w=>w.readyState===1&&w.send(m))};
const PATH=/^(profiles\/[\w-]{8,40}|rooms\/[A-Z0-9]{4,8})$/;
function can(op,p,uid,data){
  const [col,id]=p.split('/'),d=DB.docs[p];
  if(op==='get'||op==='sub'||op==='unsub')return true;
  if(col==='profiles')return id===uid;
  if(op==='delete')return !d||d.p0===uid;
  if(op==='set')return !d&&data.p0===uid;
  if(op==='update')return !!d&&(d.p0===uid||d.p1===uid||(d.status==='waiting'&&!d.p1&&data.p1===uid));
  return false;
}
wss.on('connection',ws=>{
  let uid=null;const mine=new Set();
  ws.on('message',raw=>{
    let m;try{m=JSON.parse(raw)}catch{return}
    const r=(ok,x)=>ws.send(JSON.stringify({i:m.i,ok,...x}));
    if(m.op==='hello'){
      if(m.id&&DB.keys[m.id]){if(DB.keys[m.id]!==hash(m.key))return r(false,{err:'auth'});uid=m.id;return r(true,{id:uid})}
      uid=crypto.randomUUID();const key=crypto.randomBytes(24).toString('hex');DB.keys[uid]=hash(key);save();return r(true,{id:uid,key});
    }
    if(!uid)return r(false,{err:'auth'});
    if(m.op==='top'){
      const l=Math.min(+m.limit||5,20),a=Object.entries(DB.docs).filter(([k])=>k.startsWith('profiles/')).map(([,v])=>v).sort((x,y)=>(y.wins||0)-(x.wins||0)).slice(0,l).map(v=>({name:v.name,avatar:v.avatar,wins:v.wins||0}));
      return r(true,{docs:a});
    }
    const p=m.path;if(typeof p!=='string'||!PATH.test(p))return r(false,{err:'bad-path'});
    const data=m.data&&typeof m.data==='object'?m.data:{};
    if(JSON.stringify(data).length>30000)return r(false,{err:'too-large'});
    if(!can(m.op,p,uid,data))return r(false,{err:'permission-denied'});
    const d=DB.docs[p];
    switch(m.op){
      case 'get':return r(true,{exists:!!d,data:d||null});
      case 'sub':if(!subs.has(p))subs.set(p,new Set());subs.get(p).add(ws);mine.add(p);r(true,{});return ws.send(JSON.stringify({sub:p,exists:!!d,data:d||null}));
      case 'unsub':subs.get(p)?.delete(ws);mine.delete(p);return r(true,{});
      case 'set':DB.docs[p]={...data,_c:Date.now()};break;
      case 'update':DB.docs[p]={...d,...data};break;
      case 'delete':delete DB.docs[p];break;
      default:return r(false,{err:'bad-op'});
    }
    save();pushDoc(p);r(true,{});
  });
  ws.on('close',()=>mine.forEach(p=>subs.get(p)?.delete(ws)));
});
setInterval(()=>{const old=Date.now()-12*3600e3;for(const [k,v] of Object.entries(DB.docs))if(k.startsWith('rooms/')&&(v._c||0)<old){delete DB.docs[k];pushDoc(k)}save()},3600e3);
setInterval(()=>wss.clients.forEach(w=>w.readyState===1&&w.ping()),30000);
server.listen(process.env.PORT||3000,()=>console.log('Domino server on :'+(process.env.PORT||3000)));
