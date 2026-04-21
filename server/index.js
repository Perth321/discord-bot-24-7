const express = require('express');
const cors = require('cors');
const Database = require('better-sqlite3');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// ===== Middleware =====
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json());

// ===== Database Setup (SQLite) =====
const db = new Database(path.join(__dirname, 'config.db'));

// สร้างตาราง config
db.exec(`
  CREATE TABLE IF NOT EXISTS config (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  )
`);

// ค่า default
const defaults = {
  translationEnabled: 'true',
  voiceChannelIds: '[]',
  notificationChannelId: '',
};

// ใส่ค่า default ถ้ายังไม่มี
const insertDefault = db.prepare('INSERT OR IGNORE INTO config (key, value) VALUES (?, ?)');
for (const [key, value] of Object.entries(defaults)) {
  insertDefault.run(key, value);
}

// ===== Helper functions =====
function getConfigValue(key) {
  const row = db.prepare('SELECT value FROM config WHERE key = ?').get(key);
  return row ? row.value : null;
}

function setConfigValue(key, value) {
  db.prepare('INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)').run(key, String(value));
}

function getAllConfig() {
  const translationEnabled = getConfigValue('translationEnabled') === 'true';
  const voiceChannelIds = JSON.parse(getConfigValue('voiceChannelIds') || '[]');
  const notificationChannelId = getConfigValue('notificationChannelId') || null;

  return {
    translationEnabled,
    voiceChannelIds,
    notificationChannelId,
  };
}

// ===== API Routes =====

// GET /api/config - ดึง config ทั้งหมด
app.get('/api/config', (req, res) => {
  try {
    const config = getAllConfig();
    res.json(config);
  } catch (error) {
    console.error('[GET /api/config]', error.message);
    res.status(500).json({ error: 'Failed to get config' });
  }
});

// POST /api/config - อัปเดต config
app.post('/api/config', (req, res) => {
  try {
    const { translationEnabled, voiceChannelIds, notificationChannelId } = req.body;

    if (typeof translationEnabled === 'boolean') {
      setConfigValue('translationEnabled', translationEnabled);
    }

    if (Array.isArray(voiceChannelIds)) {
      setConfigValue('voiceChannelIds', JSON.stringify(voiceChannelIds));
    }

    if (notificationChannelId !== undefined) {
      setConfigValue('notificationChannelId', notificationChannelId || '');
    }

    const config = getAllConfig();
    res.json({ success: true, config });
  } catch (error) {
    console.error('[POST /api/config]', error.message);
    res.status(500).json({ error: 'Failed to update config' });
  }
});

// POST /api/config/toggle-translation - toggle translation เปิด/ปิด
app.post('/api/config/toggle-translation', (req, res) => {
  try {
    const current = getConfigValue('translationEnabled') === 'true';
    const newValue = !current;
    setConfigValue('translationEnabled', newValue);
    res.json({ success: true, translationEnabled: newValue });
  } catch (error) {
    console.error('[POST /api/config/toggle-translation]', error.message);
    res.status(500).json({ error: 'Failed to toggle translation' });
  }
});

// GET /api/health - health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ===== Error handling =====
app.use((err, req, res, next) => {
  console.error('[Server Error]', err.message);
  res.status(500).json({ error: 'Internal server error' });
});

// ===== Start server =====
app.listen(PORT, '0.0.0.0', () => {
  console.log(`[Server] Running on port ${PORT}`);
  console.log(`[Server] API available at http://localhost:${PORT}/api`);
});

module.exports = app;
