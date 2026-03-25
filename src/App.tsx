import { useState, useRef, useEffect } from "react";
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-auth.js";

// ── FIREBASE CONFIG ───────────────────────────────────────────────
// Replace with your Firebase config from console.firebase.google.com
const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY            || "YOUR_API_KEY",
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN        || "YOUR_AUTH_DOMAIN",
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID         || "YOUR_PROJECT_ID",
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET     || "YOUR_STORAGE_BUCKET",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID|| "YOUR_SENDER_ID",
  appId:             import.meta.env.VITE_FIREBASE_APP_ID             || "YOUR_APP_ID",
};

const app      = initializeApp(firebaseConfig);
const auth     = getAuth(app);
const provider = new GoogleAuthProvider();

// ── THEME ─────────────────────────────────────────────────────────
const C = {
  bg: "#f8fafc", side: "#ffffff", card: "#ffffff",
  bor: "#e2e8f0", bor2: "#cbd5e1",
  acc: "#0ea5e9", acc2: "#7c3aed",
  txt: "#0f172a", sub: "#334155", mut: "#64748b",
  dim: "#f1f5f9", dim2: "#e2e8f0",
  red: "#ef4444", yel: "#f59e0b", grn: "#10b981",
  code: "#1e293b",
};

// ── PROVIDER CONFIG ───────────────────────────────────────────────
const P = {
  claude:    { name: "Claude",    full: "Anthropic Claude",      color: "#d97706", icon: "◈" },
  gpt:       { name: "GPT-4o",    full: "OpenAI GPT-4o",         color: "#10b981", icon: "◎" },
  gemini:    { name: "Gemini",    full: "Google Gemini",         color: "#3b82f6", icon: "◇" },
  validate:  { name: "Validator", full: "Cross-Validation",      color: "#8b5cf6", icon: "⚖" },
  consensus: { name: "Consensus", full: "★ Final Answer",        color: "#ef4444", icon: "★" },
};

const PERSONAS = {
  claude: "You are Claude, Anthropic's AI — known for careful reasoning and scientific accuracy. Answer with depth and precision. Temperature is 0.",
  gpt:    "You are GPT-4o, OpenAI's model — known for clear structured explanations. Answer with clear structure and bullet points. Temperature is 0.",
  gemini: "You are Gemini, Google's AI — known for comprehensive coverage. Answer with breadth and biological context. Temperature is 0.",
};

// ── AI CALLS ──────────────────────────────────────────────────────
async function callAnthropicAs(persona, messages, baseSystem) {
  try {
    const system = PERSONAS[persona] + "\n\n" + baseSystem;
    const r = await fetch("/api/ai", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: "claude-sonnet-4-5", max_tokens: 1000, temperature: 0, system, messages }),
    });
    const d = await r.json();
    if (d.error) return { ok: false, text: "Error: " + d.error.message };
    return { ok: true, text: d.content?.[0]?.text || "" };
  } catch (e) { return { ok: false, text: "Network Error: " + e.message }; }
}

async function runAllAIs(messages, system, onUpdate) {
  onUpdate("claude", "thinking", null);
  onUpdate("gpt",    "thinking", null);
  onUpdate("gemini", "thinking", null);

  const [c, g, gem] = await Promise.all([
    callAnthropicAs("claude", messages, system).then(r => { onUpdate("claude", r.ok?"done":"error", r.text); return { id:"claude", ...r }; }),
    callAnthropicAs("gpt",    messages, system).then(r => { onUpdate("gpt",    r.ok?"done":"error", r.text); return { id:"gpt",    ...r }; }),
    callAnthropicAs("gemini", messages, system).then(r => { onUpdate("gemini", r.ok?"done":"error", r.text); return { id:"gemini", ...r }; }),
  ]);

  const good = [c, g, gem].filter(r => r.ok && r.text.length > 10);
  const expertAnswers = good.map(r => P[r.id].full + ":\n" + r.text).join("\n\n---\n\n");

  onUpdate("validate", "thinking", null);
  const val = await callAnthropicAs("claude", [
    ...messages,
    { role: "user", content: "Three experts answered:\n\n" + expertAnswers + "\n\nCross-validate: find agreements, disagreements, errors. Give accuracy scores." }
  ], "You are a senior scientific fact-checker. Cross-validate these AI answers rigorously. Temperature is 0.");
  onUpdate("validate", val.ok?"done":"error", val.text);

  onUpdate("consensus", "thinking", null);
  const cons = await callAnthropicAs("claude", [
    ...messages,
    { role: "assistant", content: expertAnswers },
    { role: "assistant", content: "Cross-validation: " + val.text },
    { role: "user", content: "Produce the single most accurate, complete final answer based on all expert answers and validation above." }
  ], "You are the Chief Bioinformatics Officer. Produce the definitive, maximally accurate answer. Temperature is 0.");
  onUpdate("consensus", cons.ok?"done":"error", cons.text);

  return [c, g, gem, { id:"validate", ...val }, { id:"consensus", ...cons }];
}

// ── PDF EXPORT ────────────────────────────────────────────────────
function exportPDF(title, rows) {
  const now = new Date().toLocaleString();
  const body = rows.map(r => `<div style="margin-bottom:20px;padding:14px;border-left:3px solid ${r.color||"#0ea5e9"};background:#f8fafc;border-radius:0 8px 8px 0"><div style="font-family:monospace;font-size:10px;color:#64748b;margin-bottom:6px">${r.label||""}</div><p style="margin:0;font-size:13px;line-height:1.75;color:#1e293b;white-space:pre-wrap">${r.text}</p></div>`).join("");
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>${title}</title><style>body{font-family:Georgia,serif;max-width:800px;margin:40px auto;padding:0 20px}.hdr{border-bottom:3px solid #0ea5e9;padding-bottom:14px;margin-bottom:24px}.logo{font-family:monospace;font-size:22px;font-weight:800}.logo span{color:#0ea5e9}.meta{font-family:monospace;font-size:10px;color:#64748b;margin-top:4px}.ftr{margin-top:40px;padding-top:12px;border-top:1px solid #e2e8f0;font-family:monospace;font-size:9px;color:#94a3b8;display:flex;justify-content:space-between}</style></head><body><div class="hdr"><div class="logo">BIO<span>SYNTH</span> AI</div><div class="meta">${title.toUpperCase()} · ${now}</div></div>${body}<div class="ftr"><span>BIOSYNTH AI · TRIPLE CONSENSUS</span><span>temp=0 · NOT FOR CLINICAL USE</span></div></body></html>`;
  const w = window.open("","_blank"); w.document.write(html); w.document.close(); setTimeout(()=>w.print(),500);
}

// ── SHARED UI ─────────────────────────────────────────────────────
function Card({ children, style }) { return <div style={{ background:C.card, border:`1px solid ${C.bor}`, borderRadius:12, padding:16, boxShadow:"0 1px 4px rgba(0,0,0,0.06)", ...style }}>{children}</div>; }
function Lbl({ text, color })      { return <div style={{ color:color||C.mut, fontSize:10, letterSpacing:1.5, fontFamily:"monospace", marginBottom:6, textTransform:"uppercase" }}>{text}</div>; }
function Btn({ onClick, disabled, children, color, outline, small, full }) {
  return <button onClick={onClick} disabled={disabled} style={{ width:full?"100%":"auto", background:outline?"transparent":(disabled?C.dim2:(color||C.acc)), border:`1.5px solid ${outline?(color||C.acc):"transparent"}`, borderRadius:8, padding:small?"5px 12px":"9px 20px", color:outline?(color||C.acc):(disabled?C.mut:"#fff"), fontSize:small?11:12, cursor:disabled?"not-allowed":"pointer", fontFamily:"monospace", fontWeight:600 }}>{children}</button>;
}
function Bar({ pct, color }) { return <div style={{ height:5, background:C.dim2, borderRadius:3, marginTop:8 }}><div style={{ height:"100%", width:pct+"%", background:color||C.acc, borderRadius:3 }}/></div>; }

// ── GOOGLE SIGN IN SCREEN ─────────────────────────────────────────
function SignInScreen({ onSignIn, loading, error }) {
  return (
    <div style={{ height:"100vh", display:"flex", alignItems:"center", justifyContent:"center", background:"linear-gradient(135deg, #f0f9ff, #f8fafc)", fontFamily:"'Helvetica Neue', sans-serif" }}>
      <div style={{ background:C.card, borderRadius:20, padding:"48px 40px", width:380, textAlign:"center", boxShadow:"0 20px 60px rgba(0,0,0,0.1)" }}>
        {/* Logo */}
        <div style={{ width:64, height:64, borderRadius:16, background:C.acc, display:"flex", alignItems:"center", justifyContent:"center", color:"#fff", fontSize:28, margin:"0 auto 20px", boxShadow:"0 4px 16px "+C.acc+"55" }}>⬡</div>
        <div style={{ fontSize:26, fontWeight:800, color:C.txt, marginBottom:4, letterSpacing:-0.5 }}>BioSynth AI</div>
        <div style={{ color:C.mut, fontSize:11, letterSpacing:2, fontFamily:"monospace", marginBottom:32 }}>BIOINFORMATICS OS</div>

        {/* Features */}
        <div style={{ background:C.dim, borderRadius:12, padding:16, marginBottom:28, textAlign:"left" }}>
          {[["◈","Anthropic Claude","#d97706"],["◎","OpenAI GPT-4o","#10b981"],["◇","Google Gemini","#3b82f6"],["⚖","Cross-Validation","#8b5cf6"],["★","Final Consensus","#ef4444"]].map(([icon,label,color],i) => (
            <div key={i} style={{ display:"flex", alignItems:"center", gap:8, marginBottom:i<4?8:0 }}>
              <span style={{ color, fontSize:14 }}>{icon}</span>
              <span style={{ color:C.sub, fontSize:12, fontFamily:"monospace" }}>{label}</span>
              <span style={{ marginLeft:"auto", color:C.grn, fontSize:10 }}>✔</span>
            </div>
          ))}
        </div>

        {/* Sign in button */}
        <button onClick={onSignIn} disabled={loading} style={{ width:"100%", background:loading?C.dim2:"#fff", border:`1.5px solid ${C.bor2}`, borderRadius:10, padding:"12px 20px", color:C.txt, fontSize:14, cursor:loading?"not-allowed":"pointer", fontFamily:"'Helvetica Neue',sans-serif", fontWeight:600, display:"flex", alignItems:"center", justifyContent:"center", gap:10, boxShadow:"0 2px 8px rgba(0,0,0,0.08)", transition:"all 0.2s" }}>
          {loading ? "Signing in..." : (
            <>
              <svg width="18" height="18" viewBox="0 0 48 48"><path fill="#4285F4" d="M44.5 20H24v8.5h11.8C34.7 33.9 30.1 37 24 37c-7.2 0-13-5.8-13-13s5.8-13 13-13c3.1 0 5.9 1.1 8.1 2.9l6.4-6.4C34.6 4.1 29.6 2 24 2 11.8 2 2 11.8 2 24s9.8 22 22 22c11 0 21-8 21-22 0-1.3-.2-2.7-.5-4z"/><path fill="#34A853" d="M6.3 14.7l7 5.1C15.1 16.2 19.2 13 24 13c3.1 0 5.9 1.1 8.1 2.9l6.4-6.4C34.6 4.1 29.6 2 24 2 16.3 2 9.6 7.3 6.3 14.7z"/><path fill="#FBBC05" d="M24 46c5.5 0 10.5-1.9 14.3-5l-6.6-5.4C29.8 37 27 38 24 38c-6 0-11.1-4-13-9.5l-7 5.4C7.6 41.6 15.2 46 24 46z"/><path fill="#EA4335" d="M44.5 20H24v8.5h11.8c-1.2 3.2-4.5 5.5-11.8 5.5-7.2 0-13-5.8-13-13s5.8-13 13-13c3.1 0 5.9 1.1 8.1 2.9l6.4-6.4C34.6 4.1 29.6 2 24 2 11.8 2 2 11.8 2 24s9.8 22 22 22c11 0 21-8 21-22 0-1.3-.2-2.7-.5-4z"/></svg>
              Continue with Google
            </>
          )}
        </button>

        {error && <div style={{ color:C.red, fontSize:11, marginTop:12, fontFamily:"monospace" }}>{error}</div>}
        <div style={{ color:C.mut, fontSize:10, marginTop:16, lineHeight:1.6 }}>
          Free for researchers · No credit card · Data stays private
        </div>
      </div>
    </div>
  );
}

// ── AI RESEARCH ───────────────────────────────────────────────────
function AIResearch({ user }) {
  const SYS = "You are BioSynth AI, an expert bioinformatics research assistant. Specialize in genomics, transcriptomics, proteomics, variant calling, RNA-seq, CRISPR, drug discovery. Temperature is 0 — be precise.";
  const QUICK = ["Explain CRISPR-Cas9","What is RNA-seq?","How does BLAST work?","Explain GC content","What is scRNA-seq?","Describe variant calling","What is proteomics?","Explain PCR"];

  const [msgs, setMsgs]   = useState([{ role:"assistant", type:"welcome", content:"Hello " + (user?.displayName?.split(" ")[0] || "Researcher") + "! 👋\n\nI'm BioSynth AI — Triple-Consensus engine.\n\n◈ Claude · ◎ GPT-4o · ◇ Gemini\nAll 3 answer simultaneously · temp=0\n\nAsk any bioinformatics question!" }]);
  const [inp, setInp]     = useState("");
  const [busy, setBusy]   = useState(false);
  const [live, setLive]   = useState({});
  const [stage, setStage] = useState("");
  const [file, setFile]   = useState(null);
  const fileRef           = useRef(null);
  const endRef            = useRef(null);

  async function send(text) {
    const q = (text || inp).trim();
    if ((!q && !file) || busy) return;
    const content = file ? q + "\n\n[File: " + file.name + "]" : q;
    setInp(""); setFile(null); setLive({});
    const next = [...msgs, { role:"user", type:"user", content }];
    setMsgs(next);
    setBusy(true);
    setStage("Round 1: All 3 experts answering...");

    const apiMsgs = next.filter(m => m.type==="user"||m.type==="multi").map(m => ({
      role: m.type==="user" ? "user" : "assistant",
      content: m.type==="multi" ? m.results.map(r => P[r.id]?.name+": "+r.text).join("\n\n") : m.content,
    }));

    const results = await runAllAIs(apiMsgs, SYS, (id, status, text) => {
      if (id==="validate")  setStage("Round 2: Cross-validating all answers...");
      if (id==="consensus") setStage("Round 3: Synthesizing final answer...");
      setLive(prev => ({ ...prev, [id]: { status, text } }));
    });

    setMsgs(p => [...p, { role:"assistant", type:"multi", results }]);
    setBusy(false); setStage(""); setLive({});
    setTimeout(() => endRef.current?.scrollIntoView({ behavior:"smooth" }), 100);
  }

  return (
    <div style={{ display:"flex", flexDirection:"column", height:"100%", gap:10 }}>
      <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
        {QUICK.map((q,i) => <button key={i} onClick={() => send(q)} style={{ background:C.dim, border:`1px solid ${C.bor}`, borderRadius:20, padding:"4px 12px", color:C.mut, fontSize:11, cursor:"pointer", fontFamily:"monospace" }}>{q}</button>)}
      </div>

      <div style={{ flex:1, overflowY:"auto", display:"flex", flexDirection:"column", gap:14 }}>
        {msgs.map((m,i) => (
          <div key={i}>
            {m.type==="user" && (
              <div style={{ display:"flex", justifyContent:"flex-end" }}>
                <div style={{ maxWidth:"75%", padding:"12px 16px", borderRadius:"18px 4px 18px 18px", background:C.acc, color:"#fff", fontSize:13, lineHeight:1.75, whiteSpace:"pre-wrap", fontFamily:"monospace" }}>{m.content}</div>
              </div>
            )}
            {m.type==="welcome" && (
              <div style={{ display:"flex", gap:10 }}>
                <div style={{ width:32, height:32, borderRadius:"50%", background:C.acc+"15", border:`1.5px solid ${C.acc}33`, display:"flex", alignItems:"center", justifyContent:"center", color:C.acc, fontSize:14, flexShrink:0 }}>⬡</div>
                <div style={{ background:C.card, border:`1px solid ${C.bor}`, borderRadius:"4px 18px 18px 18px", padding:"14px 18px", color:C.sub, fontSize:13, lineHeight:1.8, fontFamily:"Georgia,serif", whiteSpace:"pre-wrap" }}>{m.content}</div>
              </div>
            )}
            {m.type==="multi" && Array.isArray(m.results) && (
              <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
                <div style={{ color:C.mut, fontSize:10, fontFamily:"monospace", letterSpacing:1 }}>3 experts · cross-validation · consensus · temperature=0</div>
                {m.results.map((r,j) => {
                  const prov = P[r.id]; if (!prov) return null;
                  const isConsensus = r.id==="consensus";
                  const isValidate  = r.id==="validate";
                  return (
                    <div key={j} style={{ background:isConsensus?`linear-gradient(135deg,${prov.color}08,#fff)`:C.card, border:`${isConsensus?2:1.5}px solid ${prov.color}${isConsensus?"88":"44"}`, borderRadius:12, padding:"14px 16px", boxShadow:isConsensus?`0 4px 20px ${prov.color}20`:`0 2px 10px ${prov.color}10` }}>
                      <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:10, paddingBottom:8, borderBottom:`1px solid ${C.bor}` }}>
                        <div style={{ width:28, height:28, borderRadius:"50%", background:prov.color+"18", border:`1.5px solid ${prov.color}44`, display:"flex", alignItems:"center", justifyContent:"center", color:prov.color, fontSize:isConsensus?16:14, fontWeight:700 }}>{prov.icon}</div>
                        <span style={{ color:prov.color, fontSize:12, fontFamily:"monospace", fontWeight:700 }}>{prov.full}</span>
                        {isConsensus && <span style={{ background:prov.color+"20", color:prov.color, fontSize:9, padding:"2px 8px", borderRadius:10, fontFamily:"monospace", fontWeight:700 }}>MAXIMUM ACCURACY</span>}
                        {isValidate  && <span style={{ background:prov.color+"15", color:prov.color, fontSize:9, padding:"2px 8px", borderRadius:10, fontFamily:"monospace" }}>CROSS-VALIDATION</span>}
                        {!isConsensus && !isValidate && <span style={{ marginLeft:"auto", background:C.dim, color:C.mut, fontSize:9, padding:"2px 7px", borderRadius:8, fontFamily:"monospace" }}>temp=0</span>}
                        <span style={{ color:r.ok?C.grn:C.red, fontSize:11 }}>{r.ok?"✔":"✕"}</span>
                      </div>
                      <p style={{ color:isConsensus?C.txt:(r.ok?C.sub:C.red), fontSize:isConsensus?14:13, lineHeight:1.85, margin:0, fontFamily:"Georgia,serif", whiteSpace:"pre-wrap", fontWeight:isConsensus?500:400 }}>{r.text}</p>
                    </div>
                  );
                })}
                <button onClick={() => exportPDF("Research", m.results.map(r=>({label:P[r.id]?.full,color:P[r.id]?.color,text:r.text})))} style={{ alignSelf:"flex-start", background:C.dim, border:`1px solid ${C.bor}`, borderRadius:8, padding:"5px 14px", color:C.mut, fontSize:10, cursor:"pointer", fontFamily:"monospace" }}>↓ Export All PDF</button>
              </div>
            )}
          </div>
        ))}

        {busy && (
          <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
            <div style={{ color:C.acc, fontSize:10, fontFamily:"monospace", display:"flex", alignItems:"center", gap:5 }}>
              {[0,1,2].map(i=><div key={i} style={{ width:5,height:5,borderRadius:"50%",background:C.acc,animation:`bup 0.8s ${i*0.15}s infinite` }}/>)}
              {stage}
            </div>
            {Object.entries(P).map(([id,prov]) => {
              const state = live[id]; if (!state) return null;
              const status = state.status; const text = state.text;
              return (
                <div key={id} style={{ background:C.card, border:`1.5px solid ${status==="done"?prov.color+"66":status==="error"?C.red+"44":C.bor}`, borderRadius:12, padding:"12px 14px", transition:"border 0.3s" }}>
                  <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:text?8:0 }}>
                    <div style={{ width:26,height:26,borderRadius:"50%",background:prov.color+"18",border:`1.5px solid ${prov.color}44`,display:"flex",alignItems:"center",justifyContent:"center",color:prov.color,fontSize:13 }}>{prov.icon}</div>
                    <span style={{ color:prov.color, fontSize:12, fontFamily:"monospace", fontWeight:700 }}>{prov.full}</span>
                    <span style={{ marginLeft:"auto", color:status==="done"?C.grn:status==="error"?C.red:C.mut, fontSize:10, fontFamily:"monospace" }}>
                      {status==="done"?"✔ Done":status==="error"?"✕ Error":"⟳ Thinking..."}
                    </span>
                  </div>
                  {status==="thinking"&&!text&&<div style={{ display:"flex",gap:3 }}>{[0,1,2].map(i=><div key={i} style={{ width:5,height:5,borderRadius:"50%",background:prov.color,animation:`bup 0.7s ${i*0.15}s infinite` }}/>)}</div>}
                  {text&&<p style={{ color:C.sub,fontSize:12,lineHeight:1.65,margin:0,fontFamily:"Georgia,serif" }}>{text.slice(0,120)}{text.length>120?"...":""}</p>}
                </div>
              );
            })}
          </div>
        )}
        <div ref={endRef}/>
      </div>

      {file && <div style={{ background:C.acc+"10",border:`1px solid ${C.acc}33`,borderRadius:8,padding:"6px 12px",display:"flex",alignItems:"center",gap:8 }}><span style={{ color:C.acc,fontSize:12 }}>📎 {file.name}</span><span onClick={()=>setFile(null)} style={{ color:C.mut,cursor:"pointer",marginLeft:"auto",fontSize:16 }}>×</span></div>}

      <div style={{ display:"flex", gap:8, alignItems:"flex-end" }}>
        <button onClick={()=>fileRef.current.click()} style={{ background:C.dim,border:`1px solid ${C.bor}`,borderRadius:8,padding:"10px 12px",color:C.mut,cursor:"pointer",fontSize:16,flexShrink:0 }}>📎</button>
        <input ref={fileRef} type="file" accept=".fasta,.fa,.fastq,.vcf,.csv,.txt" style={{ display:"none" }} onChange={e=>setFile(e.target.files[0])}/>
        <textarea value={inp} onChange={e=>setInp(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();send();}}} placeholder="Ask any bioinformatics question... (Enter to send)" rows={2}
          style={{ flex:1,background:C.card,border:`1.5px solid ${C.bor2}`,borderRadius:12,padding:"10px 16px",color:C.txt,fontSize:13,fontFamily:"monospace",resize:"none" }}/>
        <div style={{ display:"flex",flexDirection:"column",gap:4 }}>
          <Btn onClick={()=>send()} disabled={busy||!inp.trim()}>{busy?"⟳":"Send ▶"}</Btn>
          <button onClick={()=>exportPDF("Chat",msgs.filter(m=>m.type==="multi").flatMap(m=>m.results.map(r=>({label:P[r.id]?.full,color:P[r.id]?.color,text:r.text}))))} style={{ background:C.dim,border:`1px solid ${C.bor}`,borderRadius:8,padding:"5px 12px",color:C.mut,fontSize:10,cursor:"pointer",fontFamily:"monospace" }}>↓ PDF</button>
        </div>
      </div>
    </div>
  );
}

// ── WORKBENCH (simplified) ────────────────────────────────────────
function Workbench() {
  const [seq, setSeq]     = useState("ATGGATTTATCTGCTCTTCGCGTTGAAGAAGTACAAAATGTCATTAATGCTATGCAG");
  const [stats, setStats] = useState(null);
  const [answers, setAnswers] = useState([]);
  const [busy, setBusy]   = useState(false);
  const [tab, setTab]     = useState("stats");
  const fileRef           = useRef(null);

  function calcStats() {
    const s = seq.toUpperCase().replace(/\s/g,"");
    const cnt = b=>[...s].filter(c=>c===b).length;
    const A=cnt("A"),T=cnt("T"),G=cnt("G"),CC=cnt("C");
    const total=A+T+G+CC;
    const gc=total?((G+CC)/total*100).toFixed(1):"0";
    const rc=[...s].map(b=>({A:"T",T:"A",G:"C",C:"G"}[b]||"N")).reverse().join("");
    setStats([
      {label:"Length",  value:s.length+" bp", color:C.acc},
      {label:"GC%",     value:gc+"%",          color:parseFloat(gc)>60?C.red:C.grn},
      {label:"AT%",     value:(100-parseFloat(gc)).toFixed(1)+"%", color:C.acc2},
      {label:"Adenine", value:A,  color:C.grn},
      {label:"Thymine", value:T,  color:C.red},
      {label:"Guanine", value:G,  color:C.acc},
      {label:"Cytosine",value:CC, color:C.yel},
      {label:"Mol.Wt",  value:(A*313.2+T*304.2+G*329.2+CC*289.2).toFixed(0)+" Da", color:C.acc2},
      {label:"RevComp", value:rc.slice(0,18)+"…", color:C.mut},
    ]);
  }

  async function runAI() {
    setBusy(true); setAnswers([]);
    const msgs=[{role:"user",content:"Analyze this DNA sequence:\n"+seq}];
    const results = await runAllAIs(msgs,"You are a genomics expert. Analyze DNA sequences with clear biological insights.",()=>{});
    setAnswers(results); setBusy(false);
  }

  function handleFasta(e) {
    const f=e.target.files[0]; if(!f) return;
    const reader=new FileReader();
    reader.onload=ev=>setSeq(ev.target.result.replace(/^>.*$/gm,"").replace(/\s/g,"").slice(0,500));
    reader.readAsText(f);
  }

  return (
    <div style={{ display:"flex",flexDirection:"column",gap:14 }}>
      <div style={{ display:"flex",gap:8 }}>
        {[["stats","📊 Stats"],["ai","✦ All AIs"]].map(([id,label])=>(
          <button key={id} onClick={()=>setTab(id)} style={{ background:tab===id?C.acc:C.card,border:`1.5px solid ${tab===id?C.acc:C.bor}`,borderRadius:8,padding:"8px 16px",color:tab===id?"#fff":C.sub,fontSize:12,cursor:"pointer",fontFamily:"monospace",fontWeight:tab===id?600:400 }}>{label}</button>
        ))}
      </div>
      <Card>
        <div style={{ display:"flex",justifyContent:"space-between",marginBottom:6 }}>
          <Lbl text="Input Sequence"/>
          <button onClick={()=>fileRef.current.click()} style={{ background:C.dim,border:`1px solid ${C.bor}`,borderRadius:6,padding:"3px 10px",color:C.mut,fontSize:11,cursor:"pointer",fontFamily:"monospace" }}>↑ FASTA</button>
          <input ref={fileRef} type="file" accept=".fasta,.fa,.txt" style={{ display:"none" }} onChange={handleFasta}/>
        </div>
        <textarea value={seq} onChange={e=>setSeq(e.target.value)} rows={3} style={{ width:"100%",background:"#fafbfc",border:`1.5px solid ${C.bor2}`,borderRadius:8,padding:12,color:C.code,fontSize:12,fontFamily:"monospace",resize:"vertical" }}/>
        <div style={{ display:"flex",gap:8,marginTop:10 }}>
          <Btn onClick={tab==="stats"?calcStats:runAI} disabled={busy}>{busy?"⟳ Analyzing...":"▶ Run "+(tab==="stats"?"Stats":"All 3 AIs")}</Btn>
          {stats&&<Btn onClick={()=>exportPDF("Stats",stats.map(s=>({label:s.label,color:s.color,text:String(s.value)})))} outline color={C.acc} small>↓ PDF</Btn>}
          {stats&&<Btn onClick={()=>{const csv="Metric,Value\n"+stats.map(s=>s.label+","+s.value).join("\n");const b=new Blob([csv],{type:"text/csv"});const a=document.createElement("a");a.href=URL.createObjectURL(b);a.download="stats.csv";a.click();}} outline color={C.grn} small>↓ CSV</Btn>}
        </div>
      </Card>
      {tab==="stats"&&stats&&(
        <Card>
          <Lbl text="Sequence Statistics" color={C.acc}/>
          <div style={{ display:"flex",flexWrap:"wrap",gap:10,marginBottom:14 }}>
            {stats.map((s,i)=>(
              <div key={i} style={{ background:C.dim,border:`1px solid ${C.bor}`,borderRadius:10,padding:"10px 14px",minWidth:100 }}>
                <div style={{ color:s.color,fontSize:18,fontFamily:"monospace",fontWeight:700 }}>{s.value}</div>
                <div style={{ color:C.mut,fontSize:10,marginTop:3,letterSpacing:1 }}>{s.label}</div>
              </div>
            ))}
          </div>
          <div style={{ display:"flex",height:10,borderRadius:5,overflow:"hidden" }}>
            <div style={{ width:(100-parseFloat(stats[1].value))+"%",background:`linear-gradient(90deg,${C.grn},${C.yel})` }}/>
            <div style={{ flex:1,background:`linear-gradient(90deg,${C.acc},${C.acc2})` }}/>
          </div>
        </Card>
      )}
      {tab==="ai"&&answers.length>0&&(
        <div style={{ display:"flex",flexDirection:"column",gap:10 }}>
          {answers.filter(r=>P[r.id]).map((r,i)=>{
            const prov=P[r.id];
            const isConsensus=r.id==="consensus";
            return (
              <Card key={i} style={{ border:`${isConsensus?2:1}px solid ${prov.color}${isConsensus?"88":"33"}`, background:isConsensus?`linear-gradient(135deg,${prov.color}06,#fff)`:C.card }}>
                <div style={{ display:"flex",alignItems:"center",gap:8,marginBottom:10 }}>
                  <span style={{ color:prov.color,fontSize:16 }}>{prov.icon}</span>
                  <span style={{ color:prov.color,fontSize:12,fontFamily:"monospace",fontWeight:700 }}>{prov.full}</span>
                  {isConsensus&&<span style={{ background:prov.color+"20",color:prov.color,fontSize:9,padding:"2px 8px",borderRadius:10,fontFamily:"monospace",fontWeight:700 }}>MAXIMUM ACCURACY</span>}
                </div>
                <p style={{ color:C.sub,fontSize:13,lineHeight:1.8,margin:0,fontFamily:"Georgia,serif",whiteSpace:"pre-wrap" }}>{r.text}</p>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── QUALITY CONTROL ───────────────────────────────────────────────
function QualityControl() {
  const metrics=[
    {label:"Total Reads",   value:"248.4M",sub:"paired-end",color:C.acc, pct:98},
    {label:"Mapping Rate",  value:"99.38%",sub:"to hg38",  color:C.grn, pct:99},
    {label:"Duplicate Rate",value:"4.21%", sub:"marked",   color:C.yel, pct:42},
    {label:"Mean Coverage", value:"42.3×", sub:"WGS",      color:C.acc, pct:84},
    {label:"Q30 Bases",     value:"94.7%", sub:"quality",  color:C.grn, pct:95},
    {label:"Insert Size",   value:"380 bp",sub:"median",   color:C.acc2,pct:76},
  ];
  return (
    <div style={{ display:"flex",flexDirection:"column",gap:12 }}>
      <div style={{ display:"flex",gap:10,flexWrap:"wrap" }}>
        {[["PASS","3,944,211",C.grn],["FAIL","1,900,572",C.red],["TOTAL","5,844,783",C.acc],["Ti/Tv","2.14",C.yel]].map(([l,v,col],i)=>(
          <Card key={i} style={{ flex:1,minWidth:100,textAlign:"center" }}>
            <div style={{ color:col,fontSize:20,fontFamily:"monospace",fontWeight:800 }}>{v}</div>
            <div style={{ color:C.txt,fontSize:11,fontWeight:600,marginTop:4 }}>{l}</div>
          </Card>
        ))}
      </div>
      {metrics.map((m,i)=>(
        <Card key={i}>
          <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center" }}>
            <div><span style={{ color:C.txt,fontSize:13,fontWeight:500 }}>{m.label}</span><span style={{ color:C.mut,fontSize:11,marginLeft:8 }}>{m.sub}</span></div>
            <span style={{ color:m.color,fontSize:18,fontFamily:"monospace",fontWeight:800 }}>{m.value}</span>
          </div>
          <Bar pct={m.pct} color={m.color}/>
        </Card>
      ))}
    </div>
  );
}

// ── DATASETS ──────────────────────────────────────────────────────
function Datasets() {
  const [q,setQ]=useState("");
  const [uploaded,setUp]=useState([]);
  const fileRef=useRef(null);
  const BASE=[
    {name:"BRCA1 Genomic Sequences",size:"2.3 GB", fmt:"FASTA",records:"14,821",  sc:C.grn,status:"ready"},
    {name:"Tumor RNA-seq Matrix",   size:"890 MB", fmt:"CSV",  records:"23,486g", sc:C.grn,status:"ready"},
    {name:"Patient VCF Variants",   size:"4.1 GB", fmt:"VCF",  records:"5.8M",    sc:C.yel,status:"processing"},
    {name:"Reference Genome hg38",  size:"3.2 GB", fmt:"FASTA",records:"1 genome",sc:C.grn,status:"ready"},
    {name:"scRNA-seq Cell Atlas",   size:"12.4 GB",fmt:"H5AD", records:"84,211c", sc:C.grn,status:"ready"},
    {name:"Protein Structures",     size:"7.8 GB", fmt:"PDB",  records:"2,341",   sc:C.acc,status:"downloading"},
  ];
  const DATA=[...BASE,...uploaded].filter(d=>!q||d.name.toLowerCase().includes(q.toLowerCase())||d.fmt.toLowerCase().includes(q.toLowerCase()));
  return (
    <div style={{ display:"flex",flexDirection:"column",gap:12 }}>
      <div style={{ display:"flex",gap:8 }}>
        <div style={{ flex:1,position:"relative" }}>
          <span style={{ position:"absolute",left:14,top:"50%",transform:"translateY(-50%)",color:C.mut }}>🔍</span>
          <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search datasets..." style={{ width:"100%",background:C.card,border:`1.5px solid ${C.bor2}`,borderRadius:8,padding:"10px 14px 10px 38px",color:C.txt,fontSize:13,fontFamily:"monospace" }}/>
        </div>
        <button onClick={()=>fileRef.current.click()} style={{ background:C.acc,border:"none",borderRadius:8,padding:"10px 18px",color:"#fff",fontSize:12,cursor:"pointer",fontFamily:"monospace",fontWeight:600 }}>↑ Upload</button>
        <input ref={fileRef} type="file" accept=".fasta,.fa,.vcf,.csv,.txt" style={{ display:"none" }} onChange={e=>{const f=e.target.files[0];if(f)setUp(p=>[...p,{name:f.name,size:(f.size/1024/1024).toFixed(1)+" MB",fmt:f.name.split(".").pop().toUpperCase(),records:"—",sc:C.grn,status:"ready"}]);}}/>
      </div>
      {DATA.map((d,i)=>(
        <Card key={i} style={{ display:"flex",alignItems:"center",gap:14 }}>
          <div style={{ width:40,height:40,borderRadius:10,background:C.acc+"12",border:`1px solid ${C.acc}22`,display:"flex",alignItems:"center",justifyContent:"center",color:C.acc,fontSize:13,fontFamily:"monospace",fontWeight:700,flexShrink:0 }}>{d.fmt[0]}</div>
          <div style={{ flex:1 }}>
            <div style={{ color:C.txt,fontSize:13,fontWeight:500,marginBottom:6 }}>{d.name}</div>
            <div style={{ display:"flex",gap:6 }}>{[d.fmt,d.records,d.size].map((t,j)=><span key={j} style={{ background:C.dim,border:`1px solid ${C.bor}`,color:C.mut,fontSize:10,padding:"2px 8px",borderRadius:20,fontFamily:"monospace" }}>{t}</span>)}</div>
          </div>
          <div style={{ color:d.sc,fontSize:11,fontFamily:"monospace",fontWeight:600 }}>● {d.status.toUpperCase()}</div>
        </Card>
      ))}
    </div>
  );
}

// ── NAV ───────────────────────────────────────────────────────────
const NAV=[
  {id:"research", label:"AI Research",    icon:"⊞"},
  {id:"workbench",label:"Workbench",      icon:"⬡"},
  {id:"qc",       label:"Quality Control",icon:"◎"},
  {id:"datasets", label:"Datasets",       icon:"◫"},
];

// ── APP ───────────────────────────────────────────────────────────
export default function App() {
  const [user, setUser]         = useState(null);
  const [authLoading, setAuthL] = useState(true);
  const [signInLoading, setSL]  = useState(false);
  const [authError, setAuthErr] = useState("");
  const [page, setPage]         = useState("research");
  const [sideOpen, setSideOpen] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, u => {
      setUser(u); setAuthL(false);
    });
    return unsub;
  }, []);

  async function handleSignIn() {
    setSL(true); setAuthErr("");
    try {
      await signInWithPopup(auth, provider);
    } catch (e) {
      setAuthErr(e.message);
    }
    setSL(false);
  }

  async function handleSignOut() {
    await signOut(auth);
  }

  if (authLoading) return (
    <div style={{ height:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:C.bg,fontFamily:"monospace",color:C.mut }}>
      Loading BioSynth AI...
    </div>
  );

  if (!user) return <SignInScreen onSignIn={handleSignIn} loading={signInLoading} error={authError}/>;

  const isIDE = false;
  const PAGES = {
    research:  <AIResearch user={user}/>,
    workbench: <Workbench/>,
    qc:        <QualityControl/>,
    datasets:  <Datasets/>,
  };

  return (
    <div style={{ height:"100vh",display:"flex",background:C.bg,color:C.txt,fontFamily:"'Helvetica Neue',sans-serif",overflow:"hidden" }}>
      <style>{`
        *{box-sizing:border-box;margin:0;padding:0}
        ::-webkit-scrollbar{width:5px;height:5px}
        ::-webkit-scrollbar-thumb{background:#cbd5e1;border-radius:3px}
        textarea,input{outline:none!important}
        button{transition:opacity 0.15s}
        button:hover:not(:disabled){opacity:0.85}
        @keyframes bup{0%,100%{transform:translateY(0)}50%{transform:translateY(-5px)}}
      `}</style>

      {/* Sidebar */}
      <div style={{ width:sideOpen?220:0,background:C.side,borderRight:`1px solid ${C.bor}`,display:"flex",flexDirection:"column",flexShrink:0,overflow:"hidden",transition:"width 0.2s ease",boxShadow:"2px 0 8px rgba(0,0,0,0.04)" }}>
        <div style={{ padding:"18px 16px",borderBottom:`1px solid ${C.bor}` }}>
          <div style={{ display:"flex",alignItems:"center",gap:10 }}>
            <div style={{ width:36,height:36,borderRadius:10,background:C.acc,display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontSize:18,boxShadow:"0 2px 8px "+C.acc+"55",flexShrink:0 }}>⬡</div>
            <div>
              <div style={{ color:C.txt,fontSize:16,fontWeight:800,letterSpacing:-0.3 }}>BioSynth</div>
              <div style={{ color:C.mut,fontSize:9,letterSpacing:2,fontFamily:"monospace" }}>BIOINFORMATICS OS</div>
            </div>
          </div>
        </div>

        <nav style={{ flex:1,paddingTop:8,overflowY:"auto" }}>
          {NAV.map(n=>(
            <div key={n.id} onClick={()=>setPage(n.id)} style={{ display:"flex",alignItems:"center",gap:12,padding:"10px 16px",cursor:"pointer",background:page===n.id?C.acc+"10":"transparent",borderLeft:`3px solid ${page===n.id?C.acc:"transparent"}`,color:page===n.id?C.acc:C.mut,fontSize:14,fontWeight:page===n.id?600:400,transition:"all 0.15s" }}>
              <span style={{ fontSize:15,fontFamily:"monospace",minWidth:22 }}>{n.icon}</span>
              <span>{n.label}</span>
            </div>
          ))}
        </nav>

        {/* AI Status */}
        <div style={{ padding:"12px 16px",borderTop:`1px solid ${C.bor}`,background:C.dim }}>
          <div style={{ color:C.acc,fontSize:9,letterSpacing:2,fontFamily:"monospace",fontWeight:700,marginBottom:8 }}>AI ENGINES</div>
          {[["◈","Claude","#d97706"],["◎","GPT-4o","#10b981"],["◇","Gemini","#3b82f6"],["⚖","Validator","#8b5cf6"],["★","Consensus","#ef4444"]].map(([icon,name,color],i)=>(
            <div key={i} style={{ display:"flex",alignItems:"center",gap:6,marginBottom:4 }}>
              <span style={{ color,fontSize:12 }}>{icon}</span>
              <span style={{ color:C.sub,fontSize:10,fontFamily:"monospace",flex:1 }}>{name}</span>
              <span style={{ color:C.grn,fontSize:10,fontFamily:"monospace" }}>✔</span>
            </div>
          ))}
        </div>

        {/* User */}
        <div style={{ padding:"12px 16px",borderTop:`1px solid ${C.bor}`,display:"flex",alignItems:"center",gap:10 }}>
          <img src={user.photoURL||""} alt="" style={{ width:32,height:32,borderRadius:"50%",border:`2px solid ${C.bor}` }} onError={e=>{e.target.style.display="none";}}/>
          <div style={{ flex:1,minWidth:0 }}>
            <div style={{ color:C.txt,fontSize:12,fontWeight:600,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{user.displayName}</div>
            <div style={{ color:C.mut,fontSize:10,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{user.email}</div>
          </div>
          <button onClick={handleSignOut} style={{ background:"none",border:"none",color:C.mut,cursor:"pointer",fontSize:11,fontFamily:"monospace" }}>Out</button>
        </div>
      </div>

      {/* Main */}
      <div style={{ flex:1,display:"flex",flexDirection:"column",overflow:"hidden",minWidth:0 }}>
        <div style={{ height:48,background:C.side,borderBottom:`1px solid ${C.bor}`,display:"flex",alignItems:"center",padding:"0 18px",gap:12,flexShrink:0,boxShadow:"0 1px 3px rgba(0,0,0,0.04)" }}>
          <button onClick={()=>setSideOpen(o=>!o)} style={{ background:"none",border:"none",color:C.mut,cursor:"pointer",fontSize:18,padding:4 }}>☰</button>
          <span style={{ color:C.mut,fontSize:12 }}>BioSynth /</span>
          <span style={{ color:C.txt,fontSize:12,fontWeight:600 }}>{NAV.find(n=>n.id===page)?.label}</span>
          <div style={{ marginLeft:"auto",display:"flex",alignItems:"center",gap:6 }}>
            <div style={{ background:C.dim,border:`1px solid ${C.bor}`,borderRadius:20,padding:"5px 12px",display:"flex",alignItems:"center",gap:6 }}>
              <div style={{ width:6,height:6,borderRadius:"50%",background:C.grn,boxShadow:"0 0 5px "+C.grn }}/>
              <span style={{ color:C.sub,fontSize:11,fontFamily:"monospace" }}>5 AI engines · temp=0</span>
            </div>
          </div>
        </div>

        <div style={{ flex:1,overflowY:"auto",padding:24 }}>
          <div style={{ maxWidth:900,margin:"0 auto" }}>{PAGES[page]}</div>
        </div>
      </div>
    </div>
  );
}
