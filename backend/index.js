const express = require('express');
const cors = require('cors');
const catalyst = require('zcatalyst-sdk-node');

const app = express();
app.use(cors());
app.use(express.json());

// Middleware to initialize Catalyst per request (Required for Advanced I/O / AppSail)
app.use((req, res, next) => {
  try {
    res.locals.catalyst = catalyst.initialize(req);
    next();
  } catch (err) {
    // Local dev fallback if not running via Catalyst CLI
    next();
  }
});

// Helper for sending success
const sendSuccess = (res, data) => res.json({ status: 'success', data });
// Helper for sending error
const sendError = (res, message, status = 400) => res.status(status).json({ status: 'failure', message });

// --- Students Profile ---
app.post('/students', async (req, res) => {
  try {
    const { user_zuid, name, email, department, year, bio, available_time, subjects } = req.body;
    const cat = res.locals.catalyst;
    const datastore = cat.datastore();
    
    // In a real Catalyst app, you would check if the student exists by user_zuid
    // For now, let's just insert it to a 'Students' table.
    let rowData = {
      user_zuid, name, email, department, year, bio, available_time,
      subjects: JSON.stringify(subjects || [])
    };
    
    // Simulate DB insert
    const table = datastore.table('Students');
    // If we were checking for existing:
    const query = `SELECT * FROM Students WHERE user_zuid = '${user_zuid}'`;
    let zcql = cat.zcql();
    let existing = await zcql.executeZCQLQuery(query);
    
    let student_id;
    if (existing.length > 0) {
      student_id = existing[0].Students.ROWID;
      rowData.ROWID = student_id;
      await table.updateRow(rowData);
    } else {
      const insertResp = await table.insertRow(rowData);
      student_id = insertResp.ROWID;
    }
    
    sendSuccess(res, { student_id });
  } catch (err) {
    console.error(err);
    sendError(res, err.message || 'Error saving profile');
  }
});

app.get('/students/:id', async (req, res) => {
  try {
    const cat = res.locals.catalyst;
    const row = await cat.datastore().table('Students').getRow(req.params.id);
    const data = row;
    try { data.subjects = JSON.parse(data.subjects); } catch(e) {}
    sendSuccess(res, data);
  } catch (err) {
    sendError(res, err.message);
  }
});

// --- Match ---
app.get('/match/:id', async (req, res) => {
  try {
    const cat = res.locals.catalyst;
    const me = await cat.datastore().table('Students').getRow(req.params.id);
    
    let mySubjects = [];
    try { mySubjects = JSON.parse(me.subjects); } catch(e) {}

    // Find others in same department
    const query = `SELECT * FROM Students WHERE department = '${me.department}' AND ROWID != '${me.ROWID}'`;
    const others = await cat.zcql().executeZCQLQuery(query);
    
    const matches = others.map(r => {
      const p = r.Students;
      let pSubj = [];
      try { pSubj = JSON.parse(p.subjects); } catch(e) {}
      const shared = pSubj.filter(s => mySubjects.includes(s));
      return {
        student_id: p.ROWID,
        name: p.name,
        department: p.department,
        year: p.year,
        available_time: p.available_time,
        shared_subjects: shared,
        match_score: shared.length * 10
      };
    }).sort((a,b) => b.match_score - a.match_score);
    
    sendSuccess(res, matches);
  } catch (err) {
    sendError(res, err.message);
  }
});

// --- Chat Requests ---
app.post('/chat-requests', async (req, res) => {
  try {
    const { sender_id, receiver_id } = req.body;
    const cat = res.locals.catalyst;
    await cat.datastore().table('ChatRequests').insertRow({
      sender_id, receiver_id, status: 'pending'
    });
    sendSuccess(res, true);
  } catch (err) { sendError(res, err.message); }
});

app.get('/chat-requests/:id', async (req, res) => {
  try {
    const cat = res.locals.catalyst;
    const myId = req.params.id;
    const zcql = cat.zcql();
    
    const incQ = await zcql.executeZCQLQuery(`SELECT * FROM ChatRequests INNER JOIN Students ON ChatRequests.sender_id = Students.ROWID WHERE ChatRequests.receiver_id = '${myId}'`);
    const incoming = incQ.map(r => ({
      ROWID: r.ChatRequests.ROWID,
      sender_name: r.Students.name,
      status: r.ChatRequests.status
    }));
    
    const outQ = await zcql.executeZCQLQuery(`SELECT * FROM ChatRequests INNER JOIN Students ON ChatRequests.receiver_id = Students.ROWID WHERE ChatRequests.sender_id = '${myId}'`);
    const outgoing = outQ.map(r => ({
      ROWID: r.ChatRequests.ROWID,
      receiver_name: r.Students.name,
      status: r.ChatRequests.status
    }));
    
    sendSuccess(res, { incoming, outgoing });
  } catch (err) { sendError(res, err.message); }
});

app.put('/chat-requests/:id', async (req, res) => {
  try {
    const { status } = req.body;
    const cat = res.locals.catalyst;
    await cat.datastore().table('ChatRequests').updateRow({
      ROWID: req.params.id, status
    });
    sendSuccess(res, true);
  } catch (err) { sendError(res, err.message); }
});

// --- Groups ---
app.post('/groups', async (req, res) => {
  try {
    const { group_name, description, max_members, created_by } = req.body;
    const cat = res.locals.catalyst;
    const g = await cat.datastore().table('Groups').insertRow({
      group_name, description, max_members, created_by
    });
    await cat.datastore().table('GroupMembers').insertRow({
      group_id: g.ROWID, student_id: created_by
    });
    sendSuccess(res, g);
  } catch (err) { sendError(res, err.message); }
});

app.get('/groups', async (req, res) => {
  try {
    const cat = res.locals.catalyst;
    const groups = await cat.zcql().executeZCQLQuery(`SELECT * FROM Groups`);
    sendSuccess(res, groups.map(g => g.Groups));
  } catch (err) { sendError(res, err.message); }
});

app.post('/groups/:id/join', async (req, res) => {
  try {
    const { student_id } = req.body;
    const group_id = req.params.id;
    const cat = res.locals.catalyst;
    await cat.datastore().table('GroupMembers').insertRow({ group_id, student_id });
    sendSuccess(res, true);
  } catch (err) { sendError(res, err.message); }
});

// --- Notes ---
app.post('/notes', async (req, res) => {
  try {
    const { group_id, uploaded_by, title, file_url } = req.body;
    const cat = res.locals.catalyst;
    await cat.datastore().table('Notes').insertRow({ group_id, uploaded_by, title, file_url });
    sendSuccess(res, true);
  } catch (err) { sendError(res, err.message); }
});

app.get('/notes/:groupId', async (req, res) => {
  try {
    const cat = res.locals.catalyst;
    const notes = await cat.zcql().executeZCQLQuery(`SELECT * FROM Notes INNER JOIN Students ON Notes.uploaded_by = Students.ROWID WHERE Notes.group_id = '${req.params.groupId}'`);
    sendSuccess(res, notes.map(n => ({
      ROWID: n.Notes.ROWID,
      title: n.Notes.title,
      file_url: n.Notes.file_url,
      uploader_name: n.Students.name
    })));
  } catch (err) { sendError(res, err.message); }
});

// --- Goals ---
app.post('/goals', async (req, res) => {
  try {
    const { student_id, goal_text, target_date } = req.body;
    const cat = res.locals.catalyst;
    await cat.datastore().table('Goals').insertRow({
      student_id, goal_text, target_date, is_completed: false
    });
    sendSuccess(res, true);
  } catch (err) { sendError(res, err.message); }
});

app.get('/goals/:studentId', async (req, res) => {
  try {
    const cat = res.locals.catalyst;
    const goals = await cat.zcql().executeZCQLQuery(`SELECT * FROM Goals WHERE student_id = '${req.params.studentId}'`);
    sendSuccess(res, goals.map(g => {
      let data = g.Goals;
      if (typeof data.is_completed === 'string') data.is_completed = data.is_completed === 'true';
      return data;
    }));
  } catch (err) { sendError(res, err.message); }
});

app.put('/goals/:id', async (req, res) => {
  try {
    const { is_completed } = req.body;
    const cat = res.locals.catalyst;
    await cat.datastore().table('Goals').updateRow({
      ROWID: req.params.id,
      is_completed: is_completed.toString()
    });
    sendSuccess(res, true);
  } catch (err) { sendError(res, err.message); }
});

// For AppSail, start on process.env.X_ZOHO_CATALYST_LISTEN_PORT
const PORT = process.env.X_ZOHO_CATALYST_LISTEN_PORT || 3000;
app.listen(PORT, () => console.log(`StudyMate AppSail listening on port ${PORT}`));

module.exports = app;
