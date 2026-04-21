const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const { Low, JSONFile } = require('lowdb');
const { nanoid } = require('nanoid');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();
app.use(bodyParser.json());
app.use(cors());

const adapter = new JSONFile('db.json');
const db = new Low(adapter);

async function initDB(){
  await db.read();
  db.data ||= { users: [], services: [], bookings: [] };
  await db.write();
}
initDB();

const JWT_SECRET = 'change_this_dev_secret';

// Utility: priority scoring formula documented in LaTeX in README, implemented here.
function computePriority(service) {
  // service has fields: price (number), estimatedTimeHours (number), urgency (0-1), clientImportance (0-1)
  // weights:
  const wPrice = 0.5;
  const wUrgency = 0.3;
  const wClient = 0.2;
  // Use logarithmic scaling for price to reduce dominance, plus inverse time factor.
  const priceTerm = Math.log10(Math.max(1, service.price)); // NASA Power-of-Ten friendly: log10
  const timeFactor = 1 / Math.max(0.1, service.estimatedTimeHours);
  const score = wPrice * priceTerm * timeFactor + wUrgency * service.urgency + wClient * service.clientImportance;
  return score;
}

// Auth (very simple) ----------------
app.post('/api/register', async (req, res) => {
  const { name, email, password, isSelfEmployed } = req.body;
  await db.read();
  if (db.data.users.find(u => u.email === email)) return res.status(400).json({ error: 'Email exists' });
  const hashed = await bcrypt.hash(password, 10);
  const user = { id: nanoid(), name, email, password: hashed, isSelfEmployed: !!isSelfEmployed, verified: false };
  db.data.users.push(user);
  await db.write();
  res.json({ ok: true, userId: user.id });
});

app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  await db.read();
  const user = db.data.users.find(u => u.email === email);
  if (!user) return res.status(400).json({ error: 'no user' });
  const match = await bcrypt.compare(password, user.password);
  if (!match) return res.status(400).json({ error: 'bad pass' });
  const token = jwt.sign({ id: user.id }, JWT_SECRET, { expiresIn: '7d' });
  res.json({ token, user: { id: user.id, name: user.name, verified: user.verified } });
});

function authMiddleware(req, res, next){
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).json({ error: 'no auth' });
  const token = auth.replace('Bearer ', '');
  try{
    const data = jwt.verify(token, JWT_SECRET);
    req.userId = data.id;
    next();
  }catch(e){
    return res.status(401).json({ error: 'invalid token' });
  }
}

// Self-employed user creates services
app.post('/api/services', authMiddleware, async (req, res) =>{
  const payload = req.body;
  await db.read();
  const owner = db.data.users.find(u => u.id === req.userId);
  if(!owner || !owner.isSelfEmployed) return res.status(403).json({ error: 'not allowed' });
  const service = {
    id: nanoid(),
    ownerId: owner.id,
    title: payload.title,
    description: payload.description || '',
    price: Number(payload.price) || 0,
    estimatedTimeHours: Number(payload.estimatedTimeHours) || 1,
    urgency: Math.max(0, Math.min(1, Number(payload.urgency) || 0)),
    clientImportance: Math.max(0, Math.min(1, Number(payload.clientImportance) || 0)),
    createdAt: Date.now()
  };
  service.priorityScore = computePriority(service);
  db.data.services.push(service);
  await db.write();
  res.json({ ok:true, service });
});

// List services (public)
app.get('/api/services', async (req, res)=>{
  await db.read();
  const services = db.data.services.map(s => ({...s})).sort((a,b)=> b.priorityScore - a.priorityScore);
  res.json({ services });
});

// Book a service
app.post('/api/book', authMiddleware, async (req,res)=>{
  const { serviceId, whenISO } = req.body;
  await db.read();
  const service = db.data.services.find(s=>s.id===serviceId);
  if(!service) return res.status(404).json({ error: 'no service' });
  const booking = {
    id: nanoid(),
    serviceId,
    clientId: req.userId,
    whenISO,
    createdAt: Date.now(),
    status: 'requested'
  };
  db.data.bookings.push(booking);
  await db.write();
  res.json({ ok:true, booking });
});

// Endpoint: prioritize services for a specific self-employed user (recompute)
app.get('/api/my/services/prioritize', authMiddleware, async (req,res)=>{
  await db.read();
  const myServices = db.data.services.filter(s=>s.ownerId === req.userId);
  myServices.forEach(s=> s.priorityScore = computePriority(s));
  myServices.sort((a,b)=> b.priorityScore - a.priorityScore);
  await db.write();
  res.json({ services: myServices });
});

// Simple verification endpoint: admin toggles verified (in prod replace with proper flow)
app.post('/api/admin/verify', async (req,res)=>{
  const { userId, verified } = req.body;
  await db.read();
  const user = db.data.users.find(u=>u.id===userId);
  if(!user) return res.status(404).json({ error: 'no user' });
  user.verified = !!verified;
  await db.write();
  res.json({ ok:true, user });
});

// Basic health
app.get('/api/health', (req,res)=> res.json({ ok:true }));

const PORT = process.env.PORT || 4000;
app.listen(PORT, ()=> console.log('Server listening on', PORT));