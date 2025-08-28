const express = require('express');
const mariadb = require('mariadb');
const fs = require('fs');
const path = require('path');
const http = require('http');
let multer;
try { multer = require('multer'); } catch (e) { multer = null; }
const crypto = require('crypto');
const cors = require('cors');
const session = require('express-session');
const { Server } = require('socket.io');

/*
 * Diese Datei stellt den zentralen Node.js‑Server für den Lern- und LZK‑Trainer
 * bereit. Er implementiert alle HTTP‑Endpunkte, die vom Frontend benötigt
 * werden. Dazu gehören unter anderem das Anmelden von Benutzern, das
 * Auflisten und Bereitstellen von Excel‑Dateien, das Hochladen und
 * Speichern von Dateien sowie eine einfache Benutzerverwaltung. Die
 * Konfiguration der Datenbank erfolgt über Umgebungsvariablen, sodass
 * unterschiedliche Systeme ohne Codeänderungen unterstützt werden. Die
 * MariaDB‑Anbindung basiert auf der offiziellen `mariadb`‑Bibliothek und
 * verwendet einen Connection‑Pool, um mehrere gleichzeitige Anfragen
 * effizient bedienen zu können.
 */

const app = express();
const PORT = process.env.PORT || 8081;

// MariaDB‑Pool konfigurieren. Host, Nutzer, Passwort und Datenbankname
// können über Umgebungsvariablen gesetzt werden, andernfalls werden
// Standardwerte verwendet. Der Connection‑Pool sorgt dafür, dass
// Verbindungen wiederverwendet und sauber beendet werden.
const pool = mariadb.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'quiz_user',
  password: process.env.DB_PASS || '79232138',
  database: process.env.DB_NAME || 'lernquiz',
  connectionLimit: 5
});

// CORS und JSON‑Parsing aktivieren
// Die folgenden absoluten URLs müssen unverändert bleiben.
const allowedOrigins = [
  'http://209.25.141.16:4728',
  'http://209.25.141.16:4533',
  'http://192.168.0.3:8099',
  'http://192.168.0.3:8081'
];

function corsOrigin(origin, callback) {
  if (!origin) return callback(null, true);
  const normalized = origin.replace(/\/$/, '');
  if (allowedOrigins.indexOf(normalized) !== -1) {
    return callback(null, true);
  }
  return callback(new Error('Not allowed by CORS'));
}

const corsOptions = {
  origin: corsOrigin,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  // Admin-Funktionen senden benutzerdefinierte Header, daher explizit freigeben
  allowedHeaders: ['Content-Type', 'X-User-Role', 'X-Filename']
};

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: allowedOrigins, credentials: true } });
const onlineUsers = new Map();
io.on('connection', (socket) => {
  const username = socket.handshake.query.username || 'Unbekannt';
  onlineUsers.set(socket.id, username);
  io.emit('user-list', Array.from(onlineUsers.values()));
  socket.on('chat-message', (msg) => {
    io.emit('chat-message', { user: username, message: String(msg || '') });
  });
  socket.on('disconnect', () => {
    onlineUsers.delete(socket.id);
    io.emit('user-list', Array.from(onlineUsers.values()));
  });
});

app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: process.env.SESSION_SECRET || 'trainer_secret',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false }
}));

// Ordner für Quiz‑Dateien. Im Repo heißt dieser Ordner "files" und hier
// werden sämtliche .xlsx‑Dateien abgelegt, die das Frontend verwenden
// kann. Falls das Verzeichnis nicht existiert, wird es zur Laufzeit
// angelegt, damit Uploads auch auf frischen Installationen funktionieren.
const filesDir = path.join(__dirname, 'files');
if (!fs.existsSync(filesDir)) {
  fs.mkdirSync(filesDir);
}

// Multer konfigurieren, um Dateiuploads entgegenzunehmen. Falls Multer
// nicht verfügbar ist, wird ein Fallback installiert, der Uploads
// deaktiviert, damit der Server weiterhin startet.
let upload;
if (multer) {
  const storage = multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, filesDir);
    },
    filename: (req, file, cb) => {
      // Wenn der Client einen eigenen Dateinamen übermittelt, wird dieser
      // verwendet, andernfalls der Originalname der hochgeladenen Datei.
      const desiredName = req.body.filename ? req.body.filename : file.originalname;
      cb(null, desiredName);
    }
  });
  upload = multer({ storage });
} else {
  upload = { single: function(){ return function(req,res){ res.status(500).json({ error: 'upload_not_supported' }); }; } };
}

/**
 * Zentrale Login‑Funktion, die Benutzer gegen die MariaDB verifiziert.
 */
async function handleLogin(req, res) {
  const { username, password } = req.body || {};
  const uname = typeof username === 'string' ? username.trim() : '';
  const pwd = typeof password === 'string' ? password.trim() : '';
  if (!uname || !pwd) {
    return res.status(400).json({ success: false, message: 'Benutzername und Passwort erforderlich.' });
  }
  let conn;
  try {
    conn = await pool.getConnection();
    const rows = await conn.query('SELECT username, password, role FROM users WHERE LOWER(username) = LOWER(?) LIMIT 1', [uname]);
    if (!rows.length) {
      return res.status(401).json({ success: false, message: 'Benutzername falsch.' });
    }
    const stored = String(rows[0].password || '').trim();
    const hashed = crypto.createHash('sha1').update(pwd).digest('hex');
    if (stored !== pwd && stored.toLowerCase() !== hashed.toLowerCase()) {
      return res.status(401).json({ success: false, message: 'Passwort falsch.' });
    }
    req.session.user = { username: rows[0].username, role: rows[0].role };
    return res.json({ success: true, username: rows[0].username, role: rows[0].role });
  } catch (err) {
    console.error('Fehler bei der Anmeldung:', err);
    return res.status(500).json({ success: false, message: 'Datenbankfehler.' });
  } finally {
    if (conn) conn.release();
  }
}

// Root‑Endpunkt (action "login")
app.post('/', (req, res) => {
  if (req.body && req.body.action === 'login') {
    return handleLogin(req, res);
  }
  return res.status(400).json({ success: false, message: 'Unbekannte Aktion.' });
});

app.post('/change-password', async (req, res) => {
  if (!req.session || !req.session.user) {
    return res.status(401).json({ success: false, message: 'Nicht eingeloggt.' });
  }
  const { oldPassword, newPassword } = req.body || {};
  if (!oldPassword || !newPassword) {
    return res.status(400).json({ success: false, message: 'Passwörter erforderlich.' });
  }
  let conn;
  try {
    conn = await pool.getConnection();
    const username = req.session.user.username;
    const rows = await conn.query('SELECT password FROM users WHERE username = ? LIMIT 1', [username]);
    if (!rows.length) {
      return res.status(404).json({ success: false, message: 'Benutzer nicht gefunden.' });
    }
    const stored = String(rows[0].password || '').trim();
    const hashedOld = crypto.createHash('sha1').update(oldPassword).digest('hex');
    if (stored !== oldPassword && stored.toLowerCase() !== hashedOld.toLowerCase()) {
      return res.status(401).json({ success: false, message: 'Altes Passwort falsch.' });
    }
    const hashedNew = crypto.createHash('sha1').update(newPassword).digest('hex');
    try {
      await conn.query('UPDATE users SET password = ? WHERE username = ?', [hashedNew, username]);
    } catch (updateErr) {
      if (updateErr.code === 'ER_DATA_TOO_LONG' || updateErr.code === 'ER_TRUNCATED_WRONG_VALUE_FOR_FIELD') {
        await conn.query('UPDATE users SET password = ? WHERE username = ?', [newPassword, username]);
      } else {
        throw updateErr;
      }
    }
    return res.json({ success: true });
  } catch (err) {
    console.error('Fehler beim Passwort ändern:', err);
    return res.status(500).json({ success: false, message: 'Serverfehler.' });
  } finally {
    if (conn) conn.release();
  }
});

/**
 * GET /files/
 *
 * Listet alle Excel‑Dateien (.xlsx) im Upload‑Verzeichnis auf. Das
 * Frontend nutzt diese Liste, um dem Benutzer die verfügbaren Fragensätze
 * anzuzeigen. Bei einem Fehler wird ein HTTP‑Status 500 ausgegeben.
 */
app.get('/files/', (req, res) => {
  fs.readdir(filesDir, (err, files) => {
    if (err) {
      console.error('Fehler beim Lesen des Upload‑Verzeichnisses:', err);
      return res.status(500).json({ error: 'Konnte Dateien nicht lesen.' });
    }
    const xlsxFiles = files.filter(f => f.toLowerCase().endsWith('.xlsx'));
    res.json(xlsxFiles);
  });
});

/**
 * GET /files/:filename
 *
 * Stellt eine konkrete Excel‑Datei bereit. Der Dateiname wird über die
 * URL übergeben und gegen Pfadangriffe abgesichert (path.basename). Falls
 * die Datei nicht existiert, wird ein 404 zurückgegeben. Ansonsten wird
 * die Datei als Download ausgeliefert.
 */
app.get('/files/:filename', (req, res) => {
  const filename = path.basename(req.params.filename);
  const filePath = path.join(filesDir, filename);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'Datei nicht gefunden.' });
  }
  res.sendFile(filePath);
});

/**
 * POST /upload
 *
 * Entgegennahme eines Excel‑Uploads. Das Frontend sendet die Datei per
 * Multipart‑Form‑Data zusammen mit dem gewünschten Dateinamen. Nach dem
 * erfolgreichen Speichern wird eine Bestätigung zurückgegeben. Fehler
 * werden mit Status 500 gemeldet.
 */
app.post('/upload', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Keine Datei empfangen.' });
  }
  // multer hat die Datei bereits im gewünschten Ordner abgelegt
  return res.json({ message: 'Datei erfolgreich hochgeladen!' });
});

/**
 * POST /save
 *
 * Speichert eine bearbeitete Excel‑Datei. Der Client übergibt das
 * Dateibinärformat im Request‑Body sowie den Dateinamen im Header
 * "X‑Filename". Die Datei wird überschrieben oder neu erstellt. Eine
 * Bestätigung wird nach Abschluss zurückgegeben.
 */
app.post('/save', (req, res) => {
  const filename = req.headers['x-filename'];
  if (!filename) {
    return res.status(400).json({ error: 'Header "X‑Filename" fehlt.' });
  }
  const safeName = path.basename(filename);
  const filePath = path.join(filesDir, safeName);
  const chunks = [];
  req.on('data', chunk => chunks.push(chunk));
  req.on('end', () => {
    fs.writeFile(filePath, Buffer.concat(chunks), err => {
      if (err) {
        console.error('Fehler beim Speichern:', err);
        return res.status(500).json({ error: 'Speichern fehlgeschlagen.' });
      }
      return res.json({ message: 'Datei erfolgreich gespeichert.' });
    });
  });
});

/**
 * DELETE /files/:filename
 *
 * Löscht eine vorhandene Excel‑Datei aus dem Verzeichnis. Wird eine nicht
 * existierende Datei angefragt, liefert der Server einen 404‑Status
 * zurück. Andere Fehler werden als 500 gemeldet.
 */
app.delete('/files/:filename', (req, res) => {
  const filename = path.basename(req.params.filename);
  const filePath = path.join(filesDir, filename);
  fs.unlink(filePath, err => {
    if (err) {
      if (err.code === 'ENOENT') {
        return res.status(404).json({ error: 'Datei nicht gefunden.' });
      }
      console.error('Fehler beim Löschen:', err);
      return res.status(500).json({ error: 'Löschen fehlgeschlagen.' });
    }
    return res.json({ message: 'Datei gelöscht.' });
  });
});

app.get('/db-test', async (req, res) => {
  let conn;
  try {
    conn = await pool.getConnection();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false });
  } finally {
    if (conn) conn.release();
  }
});

// Benutzerrouten einbinden. Der Router erhält den Pool, um in den
// Funktionen Datenbankanfragen auszuführen. Sämtliche Benutzeroperationen
// (Auflisten, Erstellen, Löschen, Passwort ändern) werden darüber
// abgewickelt.
if (process.env.DISABLE_USER_ROUTES !== '1') {
  const userRoutes = require('./routes/userRoutes')(pool);
  app.use('/users', userRoutes);
}

// Statische Dateien aus dem Ordner "public" ausliefern. Dort liegen
// index.html, die JavaScript‑Dateien und das CSS für das Frontend.
const publicDir = path.join(__dirname, 'public');
app.use(express.static(publicDir));

// Server starten
server.listen(PORT, () => {
  console.log('Node.js Server läuft auf http://localhost:' + PORT);
});