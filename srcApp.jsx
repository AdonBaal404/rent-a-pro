import React, { useEffect, useState } from 'react';

const API = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

export default function App(){
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [token, setToken] = useState(localStorage.getItem('token')||'');
  const [services, setServices] = useState([]);
  const [myServices, setMyServices] = useState([]);
  const [newService, setNewService] = useState({ title:'', price:50, estimatedTimeHours:1, urgency:0.2, clientImportance:0.2 });

  useEffect(()=>{ fetchServices(); }, []);

  async function fetchServices(){
    const res = await fetch(API + '/services');
    const j = await res.json();
    setServices(j.services || []);
  }

  async function register(){
    await fetch(API + '/register', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ name:'Demo', email, password, isSelfEmployed:true }) });
    alert('registered - now login');
  }

  async function login(){
    const res = await fetch(API + '/login', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ email, password }) });
    const j = await res.json();
    if(j.token){ setToken(j.token); localStorage.setItem('token', j.token); }
    else alert('login failed');
  }

  async function createService(){
    const res = await fetch(API + '/services', { method:'POST', headers:{ 'Content-Type':'application/json', 'Authorization': 'Bearer ' + token }, body: JSON.stringify(newService) });
    const j = await res.json();
    if(j.ok) { alert('service created'); setNewService({ title:'', price:50, estimatedTimeHours:1, urgency:0.2, clientImportance:0.2 }); fetchMyServices(); fetchServices(); }
    else alert('error ' + JSON.stringify(j));
  }

  async function fetchMyServices(){
    const res = await fetch(API + '/my/services/prioritize', { headers:{ 'Authorization': 'Bearer ' + token } });
    const j = await res.json();
    setMyServices(j.services || []);
  }

  return (
    <div style={{ fontFamily:'system-ui,Arial', padding:20 }}>
      <h1>Schedus - Prototype</h1>
      <section style={{ border:'1px solid #ddd', padding:10, marginBottom:10 }}>
        <h2>Auth</h2>
        <input placeholder="email" value={email} onChange={e=>setEmail(e.target.value)} />
        <input placeholder="password" type="password" value={password} onChange={e=>setPassword(e.target.value)} />
        <button onClick={register}>Register (self-employed)</button>
        <button onClick={login}>Login</button>
        <button onClick={()=>{ setToken(''); localStorage.removeItem('token'); }}>Logout</button>
      </section>

      <section style={{ border:'1px solid #ddd', padding:10, marginBottom:10 }}>
        <h2>Create Service</h2>
        <input placeholder="title" value={newService.title} onChange={e=>setNewService({...newService, title:e.target.value})} />
        <input placeholder="price" value={newService.price} onChange={e=>setNewService({...newService, price: Number(e.target.value) })} />
        <input placeholder="hours" value={newService.estimatedTimeHours} onChange={e=>setNewService({...newService, estimatedTimeHours: Number(e.target.value) })} />
        <input placeholder="urgency 0..1" value={newService.urgency} onChange={e=>setNewService({...newService, urgency: Number(e.target.value) })} />
        <input placeholder="clientImportance 0..1" value={newService.clientImportance} onChange={e=>setNewService({...newService, clientImportance: Number(e.target.value) })} />
        <button onClick={createService}>Create</button>
      </section>

      <section style={{ border:'1px solid #ddd', padding:10, marginBottom:10 }}>
        <h2>All Services (sorted by computed priority)</h2>
        <button onClick={fetchServices}>Refresh</button>
        <ul>
          {services.map(s=> (
            <li key={s.id} style={{ marginBottom:8 }}>
              <strong>{s.title}</strong> — €{s.price} — est {s.estimatedTimeHours}h — score {Number(s.priorityScore).toFixed(3)}
              <div>{s.description}</div>
            </li>
          ))}
        </ul>
      </section>

      <section style={{ border:'1px solid #ddd', padding:10 }}>
        <h2>My Services (recomputed)</h2>
        <button onClick={fetchMyServices}>Recompute & Refresh</button>
        <ul>
          {myServices.map(s=> (
            <li key={s.id}>{s.title} — score {Number(s.priorityScore).toFixed(4)}</li>
          ))}
        </ul>
      </section>

    </div>
  );
}