// src/components/shared/Login.jsx
import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';

const ROLES = [
  { email:'admin@sentinel.io',    role:'ADMIN',           label:'Arjun Khanna',          title:'System Administrator', color:'#ff4d6d', icon:'◈' },
  { email:'fleet@sentinel.io',    role:'FLEET_MANAGER',   label:'Captain Sofia Navarro', title:'Fleet Commander',      color:'#00c9ff', icon:'◉' },
  { email:'analyst@sentinel.io',  role:'ANALYST',         label:'Dr. Lena Brandt',        title:'Senior Analyst',       color:'#7ee8a2', icon:'◎' },
  { email:'senior@sentinel.io',   role:'SENIOR_OPERATOR', label:'Commander Raj Patel',   title:'Senior Operator',      color:'#ffb347', icon:'◐' },
  { email:'operator@sentinel.io', role:'OPERATOR',        label:'Ensign Yuki Tanaka',    title:'Field Operator',       color:'#00e5a0', icon:'◌' },
];

const STATS = [
  { label:'VESSELS TRACKED', value:'2,847' },
  { label:'FUEL SAVED TODAY', value:'€284K' },
  { label:'ACTIVE ROUTES', value:'1,000+' },
  { label:'UPTIME', value:'99.97%' },
];

function Globe() {
  const canvasRef = useRef(null);
  const animRef = useRef(null);
  const t = useRef(0);
  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width = 380; const H = canvas.height = 380;
    const cx = W/2; const cy = H/2; const r = 150;
    const routes = Array.from({length:35},()=>({
      la1:(Math.random()-.5)*140, lo1:(Math.random()-.5)*360,
      la2:(Math.random()-.5)*140, lo2:(Math.random()-.5)*360,
      prog:Math.random(), spd:.002+Math.random()*.004,
      col:['#00e5a0','#00c9ff','#ff4d6d','#ffb347','#7ee8a2'][Math.floor(Math.random()*5)]
    }));
    function proj(lat,lon,rot){
      const φ=lat*Math.PI/180, λ=(lon+rot)*Math.PI/180;
      const x=r*Math.cos(φ)*Math.sin(λ), y=-r*Math.sin(φ), z=r*Math.cos(φ)*Math.cos(λ);
      return {x:cx+x,y:cy+y,z,v:z>0};
    }
    function draw(rot){
      ctx.clearRect(0,0,W,H);
      const g=ctx.createRadialGradient(cx,cy,0,cx,cy,r*1.4);
      g.addColorStop(0,'rgba(0,229,160,0.04)'); g.addColorStop(1,'transparent');
      ctx.fillStyle=g; ctx.fillRect(0,0,W,H);
      ctx.beginPath(); ctx.arc(cx,cy,r,0,Math.PI*2);
      const sg=ctx.createRadialGradient(cx-r*.3,cy-r*.3,0,cx,cy,r);
      sg.addColorStop(0,'rgba(0,229,160,0.07)'); sg.addColorStop(.5,'rgba(0,15,35,.45)'); sg.addColorStop(1,'rgba(0,3,10,.75)');
      ctx.fillStyle=sg; ctx.fill();
      for(let lat=-60;lat<=60;lat+=30){
        ctx.beginPath(); let f=true;
        for(let lon=-180;lon<=180;lon+=5){const p=proj(lat,lon,rot);if(!p.v){f=true;continue;}f?ctx.moveTo(p.x,p.y):ctx.lineTo(p.x,p.y);f=false;}
        ctx.strokeStyle='rgba(0,229,160,.07)'; ctx.lineWidth=.5; ctx.stroke();
      }
      for(let lon=-180;lon<180;lon+=30){
        ctx.beginPath(); let f=true;
        for(let lat=-90;lat<=90;lat+=5){const p=proj(lat,lon,rot);if(!p.v){f=true;continue;}f?ctx.moveTo(p.x,p.y):ctx.lineTo(p.x,p.y);f=false;}
        ctx.strokeStyle='rgba(0,229,160,.05)'; ctx.lineWidth=.5; ctx.stroke();
      }
      routes.forEach(rt=>{
        const steps=40, pts=[];
        for(let i=0;i<=steps;i++){const t=i/steps;pts.push(proj(rt.la1+(rt.la2-rt.la1)*t,rt.lo1+(rt.lo2-rt.lo1)*t,rot));}
        ctx.beginPath(); let f=true;
        pts.forEach(p=>{if(!p.v){f=true;return;}f?ctx.moveTo(p.x,p.y):ctx.lineTo(p.x,p.y);f=false;});
        ctx.strokeStyle=rt.col+'20'; ctx.lineWidth=.8; ctx.stroke();
        const di=Math.floor(rt.prog*steps);
        if(di<pts.length&&pts[di].v){
          const dp=pts[di];
          ctx.beginPath(); ctx.arc(dp.x,dp.y,2.5,0,Math.PI*2);
          ctx.fillStyle=rt.col; ctx.shadowBlur=8; ctx.shadowColor=rt.col; ctx.fill(); ctx.shadowBlur=0;
        }
        rt.prog=(rt.prog+rt.spd)%1;
      });
      ctx.beginPath(); ctx.arc(cx,cy,r,0,Math.PI*2);
      ctx.strokeStyle='rgba(0,229,160,.18)'; ctx.lineWidth=1.5; ctx.stroke();
    }
    function tick(){t.current+=.003; draw(t.current*20); animRef.current=requestAnimationFrame(tick);}
    tick();
    return ()=>cancelAnimationFrame(animRef.current);
  },[]);
  return <canvas ref={canvasRef} style={{width:380,height:380}}/>;
}

export default function Login() {
  const { login } = useAuth();
  const [email,setEmail] = useState('');
  const [password,setPassword] = useState('');
  const [error,setError] = useState('');
  const [loading,setLoading] = useState(false);
  const [activeRole,setActiveRole] = useState(null);
  const [boot,setBoot] = useState(false);
  useEffect(()=>{setTimeout(()=>setBoot(true),500);},[]);

  const doLogin = async(em,pw)=>{
    setLoading(true); setError('');
    try { await login(em,pw); }
    catch(err){ setError(err.message||'Authentication failed'); }
    finally { setLoading(false); }
  };

  const quickLogin = (u)=>{
    setActiveRole(u.email); setEmail(u.email);
    setTimeout(()=>doLogin(u.email,'Sentinel2025!'),200);
  };

  return (
    <div style={{minHeight:'100vh',background:'#02040c',display:'flex',alignItems:'stretch',fontFamily:'var(--font-body)',overflow:'hidden',opacity:boot?1:0,transition:'opacity .6s ease'}}>
      {/* LEFT */}
      <div style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',background:'linear-gradient(135deg,#020812,#030d1a)',borderRight:'1px solid rgba(0,229,160,.08)',position:'relative',overflow:'hidden',padding:'40px 20px'}}>
        <div style={{position:'absolute',inset:0,backgroundImage:'radial-gradient(circle,rgba(0,229,160,.08) 1px,transparent 1px)',backgroundSize:'40px 40px',opacity:.4}}/>
        <div style={{textAlign:'center',marginBottom:24,zIndex:1}}>
          <div style={{display:'flex',alignItems:'center',justifyContent:'center',gap:12,marginBottom:6}}>
            <div style={{width:44,height:44,borderRadius:10,background:'rgba(0,229,160,.1)',border:'1px solid rgba(0,229,160,.3)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:22}}>🛸</div>
            <div>
              <div style={{fontFamily:'var(--font-display)',fontWeight:900,fontSize:'2rem',letterSpacing:'.15em',color:'#00e5a0',lineHeight:1}}>SENTINEL</div>
              <div style={{fontFamily:'var(--font-mono)',fontSize:'.55rem',color:'rgba(0,229,160,.5)',letterSpacing:'.2em'}}>AERO-SEA OPTIMISATION NETWORK</div>
            </div>
          </div>
        </div>
        <div style={{zIndex:1,marginBottom:28}}><Globe/></div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,width:'100%',maxWidth:320,zIndex:1}}>
          {STATS.map((s,i)=>(
            <div key={i} style={{padding:'12px 14px',background:'rgba(0,229,160,.03)',border:'1px solid rgba(0,229,160,.1)',borderRadius:8,textAlign:'center'}}>
              <div style={{fontFamily:'var(--font-display)',fontWeight:700,fontSize:'1.15rem',color:'#00e5a0'}}>{s.value}</div>
              <div style={{fontFamily:'var(--font-mono)',fontSize:'.52rem',color:'rgba(0,229,160,.4)',letterSpacing:'.07em',marginTop:2}}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* RIGHT */}
      <div style={{width:420,display:'flex',flexDirection:'column',justifyContent:'center',padding:'40px 36px',background:'#030810',position:'relative',overflow:'hidden'}}>
        <div style={{position:'absolute',top:0,right:0,width:80,height:80,borderBottom:'1px solid rgba(0,229,160,.1)',borderLeft:'1px solid rgba(0,229,160,.1)',borderBottomLeftRadius:80,background:'rgba(0,229,160,.02)'}}/>
        <div style={{position:'absolute',bottom:0,left:0,width:80,height:80,borderTop:'1px solid rgba(0,229,160,.1)',borderRight:'1px solid rgba(0,229,160,.1)',borderTopRightRadius:80,background:'rgba(0,229,160,.02)'}}/>

        <div style={{marginBottom:28}}>
          <div style={{fontFamily:'var(--font-display)',fontWeight:700,fontSize:'1.4rem',color:'#fff',letterSpacing:'.05em',marginBottom:4}}>SECURE ACCESS</div>
          <div style={{fontFamily:'var(--font-mono)',fontSize:'.65rem',color:'rgba(255,255,255,.3)'}}>Authenticated personnel only · v2.0</div>
          <div style={{display:'flex',gap:6,marginTop:10}}>
            {['AES-256','JWT','CLASSIFIED'].map(t=>(
              <span key={t} style={{fontFamily:'var(--font-mono)',fontSize:'.52rem',padding:'3px 7px',borderRadius:3,background:'rgba(0,229,160,.06)',border:'1px solid rgba(0,229,160,.15)',color:'rgba(0,229,160,.6)'}}>{t}</span>
            ))}
          </div>
        </div>

        <div style={{marginBottom:18}}>
          {['CREDENTIAL ID','ACCESS CODE'].map((lbl,i)=>(
            <div key={lbl} style={{marginBottom:12}}>
              <label style={{fontFamily:'var(--font-mono)',fontSize:'.6rem',color:'rgba(255,255,255,.35)',textTransform:'uppercase',letterSpacing:'.1em',display:'block',marginBottom:6}}>◈ {lbl}</label>
              <input className="input" type={i===0?'email':'password'} value={i===0?email:password}
                onChange={e=>i===0?setEmail(e.target.value):setPassword(e.target.value)}
                onKeyDown={e=>e.key==='Enter'&&doLogin(email,password)}
                placeholder={i===0?'officer@sentinel.io':'••••••••••••'}
                style={{background:'rgba(0,229,160,.04)',borderColor:'rgba(0,229,160,.15)',color:'#e0ffe8'}}
              />
            </div>
          ))}
          {error&&<div style={{padding:'9px 13px',marginBottom:12,background:'rgba(255,60,90,.08)',border:'1px solid rgba(255,60,90,.25)',borderRadius:6,fontFamily:'var(--font-mono)',fontSize:'.68rem',color:'#ff4d6d'}}>⚠ {error}</div>}
          <button onClick={()=>doLogin(email,password)} disabled={loading||!email||!password}
            style={{width:'100%',padding:13,background:loading?'rgba(0,229,160,.08)':'linear-gradient(135deg,rgba(0,229,160,.15),rgba(0,201,255,.1))',border:'1px solid rgba(0,229,160,.3)',borderRadius:8,color:'#00e5a0',fontFamily:'var(--font-display)',fontWeight:700,fontSize:'.82rem',letterSpacing:'.1em',cursor:loading?'wait':'pointer',transition:'all .2s'}}
            onMouseEnter={e=>{if(!loading)e.currentTarget.style.background='linear-gradient(135deg,rgba(0,229,160,.25),rgba(0,201,255,.18))';}}
            onMouseLeave={e=>{if(!loading)e.currentTarget.style.background='linear-gradient(135deg,rgba(0,229,160,.15),rgba(0,201,255,.1))';}}
          >
            {loading?<span style={{display:'flex',alignItems:'center',justifyContent:'center',gap:8}}><span style={{display:'inline-block',width:13,height:13,border:'2px solid rgba(0,229,160,.3)',borderTopColor:'#00e5a0',borderRadius:'50%',animation:'spin .8s linear infinite'}}/>AUTHENTICATING...</span>:'⚡ INITIATE ACCESS'}
          </button>
        </div>

        <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:16}}>
          <div style={{flex:1,height:1,background:'rgba(255,255,255,.05)'}}/>
          <div style={{fontFamily:'var(--font-mono)',fontSize:'.58rem',color:'rgba(255,255,255,.18)'}}>QUICK ACCESS</div>
          <div style={{flex:1,height:1,background:'rgba(255,255,255,.05)'}}/>
        </div>

        <div style={{display:'flex',flexDirection:'column',gap:6}}>
          {ROLES.map(u=>(
            <button key={u.email} onClick={()=>quickLogin(u)} disabled={loading}
              style={{display:'flex',alignItems:'center',gap:10,padding:'9px 12px',background:activeRole===u.email?u.color+'12':'rgba(255,255,255,.02)',border:`1px solid ${activeRole===u.email?u.color+'40':'rgba(255,255,255,.06)'}`,borderRadius:7,cursor:loading?'wait':'pointer',transition:'all .15s',textAlign:'left'}}
              onMouseEnter={e=>{e.currentTarget.style.borderColor=u.color+'40';e.currentTarget.style.background=u.color+'10';}}
              onMouseLeave={e=>{if(activeRole!==u.email){e.currentTarget.style.borderColor='rgba(255,255,255,.06)';e.currentTarget.style.background='rgba(255,255,255,.02)';}}}
            >
              <div style={{width:30,height:30,borderRadius:6,background:u.color+'15',border:`1px solid ${u.color}30`,display:'flex',alignItems:'center',justifyContent:'center',color:u.color,fontSize:'.85rem',flexShrink:0}}>{u.icon}</div>
              <div style={{flex:1}}>
                <div style={{fontFamily:'var(--font-body)',fontSize:'.8rem',color:'#e0e8ff',fontWeight:600}}>{u.label}</div>
                <div style={{fontFamily:'var(--font-mono)',fontSize:'.58rem',color:u.color+'99',marginTop:1}}>{u.title}</div>
              </div>
              <div style={{color:u.color+'70',fontSize:'.7rem'}}>→</div>
            </button>
          ))}
        </div>
        <div style={{marginTop:20,textAlign:'center'}}>
          <div style={{fontFamily:'var(--font-mono)',fontSize:'.54rem',color:'rgba(255,255,255,.12)',letterSpacing:'.07em'}}>SENTINEL PLATFORM v2.0 · CLASSIFIED · ALL RIGHTS RESERVED</div>
        </div>
        <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
      </div>
    </div>
  );
}
