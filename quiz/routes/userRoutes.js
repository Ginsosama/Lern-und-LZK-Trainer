const express = require('express');
const crypto = require('crypto');

/*
 * Dieser Router kapselt die Benutzerverwaltung des Lern- und LZK‑Trainers.
 * Alle Aktionen werden über die MariaDB abgewickelt. Für die
 * Funktionen werden Prepared Statements genutzt, um SQL‑Injection zu
 * vermeiden. Die Datenbankverbindung wird über den von server.js
 * übergebenen Connection‑Pool bereitgestellt.
 */

module.exports = function (pool) {
  const router = express.Router();

  function getRole(req) {
    return String(req.headers['x-user-role'] || '').toLowerCase();
  }

  function canManageUsers(role) {
    return role === 'owner' || role === 'admin';
  }

  function canManageTemp(role) {
    return role === 'owner' || role === 'admin' || role === 'trainer';
  }

  const VALID_ROLES = ['owner', 'admin', 'trainer', 'user'];
  const MAX_PASSWORD_LENGTH = 20;
  const MIN_ROLE_LENGTH = 20;
  const TRUNCATION_CODES = [
    'ER_DATA_TOO_LONG',
    'ER_TRUNCATED_WRONG_VALUE_FOR_FIELD',
    'WARN_DATA_TRUNCATED',
    'ER_WARN_DATA_TRUNCATED'
  ];
  const TRUNCATION_ERRNOS = [1406, 1265];
  function isTruncationError(err) {
    return (
      (err && TRUNCATION_CODES.includes(err.code)) ||
      (err && TRUNCATION_ERRNOS.includes(err.errno))
    );
  }
  const PERMISSION_CODES = [
    'ER_ACCESS_DENIED_ERROR',
    'ER_TABLEACCESS_DENIED_ERROR',
    'ER_DBACCESS_DENIED_ERROR'
  ];
  function isPermissionError(err) {
    return err && PERMISSION_CODES.includes(err.code);
  }
  const REQUIRED_ROLE_LENGTH = Math.max(
    MIN_ROLE_LENGTH,
    VALID_ROLES.reduce((m, r) => Math.max(m, r.length), 0)
  );

  async function ensureRoleColumn(length = REQUIRED_ROLE_LENGTH) {
    let conn;
    try {
      conn = await pool.getConnection();
      const rows = await conn.query("SHOW COLUMNS FROM users LIKE 'role'");
      const col = rows && rows[0];
      const match = col && col.Type && col.Type.match(/varchar\((\d+)\)/i);
      const maxLen = match ? parseInt(match[1], 10) : 0;
      if (!match || maxLen < length) {
        await conn.query(`ALTER TABLE users MODIFY role VARCHAR(${length})`);
      }
      return true;
    } catch (e) {
      // Liefert den tatsächlichen Fehler zurück, damit Aufrufer
      // zwischen fehlenden Rechten und anderen Problemen
      // unterscheiden können.
      console.warn('Konnte Rollen-Spalte nicht erweitern:', e.message || e);
      return e || false;
    } finally {
      if (conn) conn.release();
    }
  }

  ensureRoleColumn();

  function isPasswordTruncation(err) {
    const msg = String(err && (err.sqlMessage || err.message) || '').toLowerCase();
    return msg.includes("for column 'password'");
  }

  function mapTruncationMessage(err) {
    const msg = String(err && (err.sqlMessage || err.message) || '').toLowerCase();
    if (msg.includes("for column 'username'")) return 'Benutzername zu lang.';
    if (msg.includes("for column 'password'")) return 'Passwort zu lang.';
    if (msg.includes("for column 'role'")) return 'Rolle zu lang.';
    return 'Ungültige Eingabedaten.';
  }

  /**
   * GET /
   *
   * Gibt eine Liste aller Benutzer aus. Zur Sicherheit werden nur
   * Benutzername und Rolle übertragen, nicht jedoch das Passwort.
   */
  router.get('/', async (req, res) => {
    const role = getRole(req);
    if (!canManageUsers(role)) {
      return res.status(403).json({ error: 'Nicht erlaubt.' });
    }
    let conn;
    try {
      conn = await pool.getConnection();
      const rows = await conn.query('SELECT username, role FROM users');
      res.json(rows);
    } catch (err) {
      console.error('Fehler beim Auslesen der Benutzer:', err);
      res.status(500).json({ error: 'Datenbankfehler' });
    } finally {
      if (conn) conn.release();
    }
  });

  /**
   * POST /
   *
   * Legt einen neuen Benutzer an. Erwartet im Body die Felder
   * username, password und role. Bei Erfolg wird eine Bestätigung
   * zurückgegeben, ansonsten ein entsprechender Fehlerstatus.
   */
  router.post('/', async (req, res) => {
    const requester = getRole(req);
    if (!canManageUsers(requester)) {
      return res.status(403).json({ error: 'Nicht erlaubt.' });
    }

    // Eingaben defensiv normalisieren, um Fehlermeldungen durch
    // führende/anhängende Leerzeichen zu vermeiden und Rollen in
    // Kleinbuchstaben zu prüfen.
    const uname = typeof req.body.username === 'string' ? req.body.username.trim() : '';
    const pwd = typeof req.body.password === 'string' ? req.body.password.trim() : '';
    const role = typeof req.body.role === 'string' ? req.body.role.trim().toLowerCase() : '';

    if (!uname || !pwd || !role) {
      return res.status(400).json({ error: 'Benutzername, Passwort und Rolle sind erforderlich.' });
    }
    if (!VALID_ROLES.includes(role)) {
      return res.status(400).json({ error: 'Ungültige Rolle.' });
    }
    if (pwd.length > MAX_PASSWORD_LENGTH) {
      return res.status(400).json({ error: 'Passwort zu lang.' });
    }

    const roleCheck = await ensureRoleColumn();
    if (roleCheck !== true && isPermissionError(roleCheck)) {
      return res.status(500).json({ error: 'Datenbankberechtigung fehlt.' });
    }

    let conn;
    try {
      conn = await pool.getConnection();
      const existing = await conn.query(
        'SELECT username FROM users WHERE LOWER(username) = LOWER(?)',
        [uname]
      );
      if (existing.length) {
        return res.status(409).json({ error: 'Benutzername existiert bereits.' });
      }

      // Passwörter bevorzugt gehasht speichern. Falls die Spalte der
      // Datenbank zu kurz ist (z.B. VARCHAR(20)), kann das Hashing zu
      // einem "Data too long"- oder "Data truncated"-Fehler führen.
      // In diesem Fall wird auf die ungehashte Variante zurückgegriffen.
      const hashed = crypto.createHash('sha1').update(pwd).digest('hex');
      let insertErr = null;
      try {
        await conn.query(
          'INSERT INTO users (username, password, role) VALUES (?, ?, ?)',
          [uname, hashed, role]
        );
      } catch (err) {
        if (err && isTruncationError(err) && isPasswordTruncation(err)) {
          try {
            await conn.query(
              'INSERT INTO users (username, password, role) VALUES (?, ?, ?)',
              [uname, pwd, role]
            );
          } catch (err2) {
            insertErr = err2;
          }
        } else if (
          err &&
          isTruncationError(err) &&
          String(err.sqlMessage || err.message || '')
            .toLowerCase()
            .includes("for column 'role'")
        ) {
          const altered = await ensureRoleColumn();
          if (altered === true) {
            try {
              await conn.query(
                'INSERT INTO users (username, password, role) VALUES (?, ?, ?)',
                [uname, hashed, role]
              );
            } catch (err2) {
              insertErr = err2;
            }
          } else if (isPermissionError(altered)) {
            return res.status(500).json({ error: 'Datenbankberechtigung fehlt.' });
          } else {
            insertErr = err;
          }
        } else {
          insertErr = err;
        }
      }

      if (insertErr) {
        console.error('Fehler beim Anlegen des Benutzers:', insertErr);
        if (insertErr.code === 'ER_DUP_ENTRY') {
          return res.status(409).json({ error: 'Benutzername existiert bereits.' });
        }
        if (isTruncationError(insertErr)) {
          const msg = mapTruncationMessage(insertErr);
          return res.status(400).json({ error: msg, code: insertErr.code || insertErr.errno });
        }
        if (isPermissionError(insertErr)) {
          return res.status(500).json({ error: 'Datenbankberechtigung fehlt.' });
        }
        return res.status(500).json({
          error: 'Datenbankfehler',
          code: insertErr.code || insertErr.errno || null
        });
      }

      res.json({ message: 'Benutzer erfolgreich erstellt.' });
    } catch (err) {
      console.error('Fehler beim Anlegen des Benutzers:', err);
      if (isPermissionError(err)) {
        return res.status(500).json({ error: 'Datenbankberechtigung fehlt.' });
      }
      res.status(500).json({
        error: 'Datenbankfehler',
        code: err.code || err.errno || null
      });
    } finally {
      if (conn) conn.release();
    }
  });

  /**
   * PUT /:username/password
   *
   * Ändert das Passwort eines Benutzers. Erwartet im Body das Feld
   * password. Der Benutzername wird aus der URL entnommen. Die Rolle
   * bleibt unverändert.
   */
  router.put('/:username/password', async (req, res) => {
    const requester = getRole(req);
    if (!canManageUsers(requester)) {
      return res.status(403).json({ error: 'Nicht erlaubt.' });
    }
  const { username } = req.params;
  const { password } = req.body;
  if (!password) {
    return res.status(400).json({ error: 'Neues Passwort erforderlich.' });
  }
  if (password.length > MAX_PASSWORD_LENGTH) {
    return res.status(400).json({ error: 'Passwort zu lang.' });
  }
  const hashed = crypto.createHash('sha1').update(password).digest('hex');
    let conn;
    try {
      conn = await pool.getConnection();
      const existing = await conn.query(
        'SELECT role FROM users WHERE LOWER(username) = LOWER(?)',
        [username]
      );
      if (!existing.length) {
        return res.status(404).json({ error: 'Benutzer nicht gefunden.' });
      }
      try {
        await conn.query(
          'UPDATE users SET password = ? WHERE LOWER(username) = LOWER(?)',
          [hashed, username]
        );
      } catch (err) {
        if (isTruncationError(err) && isPasswordTruncation(err)) {
          await conn.query(
            'UPDATE users SET password = ? WHERE LOWER(username) = LOWER(?)',
            [password, username]
          );
        } else {
          throw err;
        }
      }
      res.json({ message: 'Passwort erfolgreich geändert.' });
    } catch (err) {
      console.error('Fehler beim Ändern des Passworts:', err);
      if (isTruncationError(err)) {
        const msg = mapTruncationMessage(err);
        return res.status(400).json({ error: msg, code: err.code || err.errno });
      }
      if (isPermissionError(err)) {
        return res.status(500).json({ error: 'Datenbankberechtigung fehlt.' });
      }
      res.status(500).json({ error: 'Datenbankfehler' });
    } finally {
      if (conn) conn.release();
    }
  });

  /**
   * PUT /:username
   *
   * Aktualisiert Benutzernamen, Passwort und Rolle eines vorhandenen Benutzers.
   * Es können einzelne oder alle Felder geändert werden. Wird kein Feld
   * angegeben, wird ein Fehler zurückgegeben.
   */
  router.put('/:username', async (req, res) => {
    const requester = getRole(req);
    if (!canManageUsers(requester)) {
      return res.status(403).json({ error: 'Nicht erlaubt.' });
    }
  const { username } = req.params;
  const { newUsername, newPassword, role } = req.body;
  if (!newUsername && !newPassword && !role) {
    return res.status(400).json({ error: 'Keine Aktualisierungsdaten übergeben.' });
  }
  if (newPassword && String(newPassword).trim().length > MAX_PASSWORD_LENGTH) {
    return res.status(400).json({ error: 'Passwort zu lang.' });
  }
  const roleCheck2 = await ensureRoleColumn();
  if (roleCheck2 !== true && isPermissionError(roleCheck2)) {
    return res.status(500).json({ error: 'Datenbankberechtigung fehlt.' });
  }
  let conn;
    try {
      conn = await pool.getConnection();
      const existingUser = await conn.query(
        'SELECT role FROM users WHERE LOWER(username) = LOWER(?)',
        [username]
      );
      if (!existingUser.length) {
        return res.status(404).json({ error: 'Benutzer nicht gefunden.' });
      }
      const targetRole = existingUser[0].role;
      if (requester === 'admin' && (targetRole === 'admin' || targetRole === 'owner')) {
        return res.status(403).json({ error: 'Nicht erlaubt.' });
      }
      if (role) {
        if (!VALID_ROLES.includes(role)) {
          return res.status(400).json({ error: 'Ungültige Rolle.' });
        }
        if (requester === 'admin' && (role === 'owner' || role === 'admin')) {
          return res.status(403).json({ error: 'Nicht erlaubt.' });
        }
      }
      if (newUsername) {
        const existing = await conn.query(
          'SELECT username FROM users WHERE LOWER(username) = LOWER(?)',
          [newUsername]
        );
        if (existing.length) {
          return res.status(409).json({ error: 'Benutzername existiert bereits.' });
        }
      }
      const fields = [];
      const values = [];
      const fallbackValues = [];
      if (newUsername) {
        fields.push('username = ?');
        values.push(newUsername);
        fallbackValues.push(newUsername);
      }
      if (newPassword) {
        fields.push('password = ?');
        const hashedNew = crypto.createHash('sha1').update(newPassword).digest('hex');
        values.push(hashedNew);
        fallbackValues.push(newPassword);
      }
      if (role) {
        fields.push('role = ?');
        values.push(role);
        fallbackValues.push(role);
      }
      values.push(username);
      fallbackValues.push(username);
      let result;
      try {
        result = await conn.query(
          'UPDATE users SET ' + fields.join(', ') + ' WHERE LOWER(username) = LOWER(?)',
          values
        );
      } catch (err) {
        if (isTruncationError(err) && newPassword && isPasswordTruncation(err)) {
          result = await conn.query(
            'UPDATE users SET ' + fields.join(', ') + ' WHERE LOWER(username) = LOWER(?)',
            fallbackValues
          );
        } else if (
          isTruncationError(err) &&
          String(err.sqlMessage || err.message || '')
            .toLowerCase()
            .includes("for column 'role'")
        ) {
          const altered = await ensureRoleColumn();
          if (altered === true) {
            result = await conn.query(
              'UPDATE users SET ' + fields.join(', ') + ' WHERE LOWER(username) = LOWER(?)',
              values
            );
          } else if (isPermissionError(altered)) {
            throw altered;
          } else {
            throw err;
          }
        } else {
          throw err;
        }
      }
      if (result.affectedRows === 0) {
        return res.status(404).json({ error: 'Benutzer nicht gefunden.' });
      }
      res.json({ message: 'Benutzer aktualisiert.' });
    } catch (err) {
      console.error('Fehler beim Aktualisieren des Benutzers:', err);
      if (isTruncationError(err)) {
        const msg = mapTruncationMessage(err);
        return res.status(400).json({ error: msg, code: err.code || err.errno });
      }
      if (isPermissionError(err)) {
        return res.status(500).json({ error: 'Datenbankberechtigung fehlt.' });
      }
      res.status(500).json({ error: 'Datenbankfehler' });
    } finally {
      if (conn) conn.release();
    }
  });

  /**
   * DELETE /:username
   *
   * Löscht einen Benutzer anhand des Benutzernamens. Wenn der Benutzer
   * nicht existiert, wird ein 404 zurückgegeben.
   */
  router.delete('/:username', async (req, res) => {
    const requester = getRole(req);
    if (!canManageUsers(requester)) {
      return res.status(403).json({ error: 'Nicht erlaubt.' });
    }
    const { username } = req.params;
    let conn;
    try {
      conn = await pool.getConnection();
      const existing = await conn.query(
        'SELECT role FROM users WHERE LOWER(username) = LOWER(?)',
        [username]
      );
      if (!existing.length) {
        return res.status(404).json({ error: 'Benutzer nicht gefunden.' });
      }
      const targetRole = existing[0].role;
      if (requester === 'admin' && (targetRole === 'admin' || targetRole === 'owner')) {
        return res.status(403).json({ error: 'Nicht erlaubt.' });
      }
      await conn.query(
        'DELETE FROM users WHERE LOWER(username) = LOWER(?)',
        [username]
      );
      res.json({ message: 'Benutzer erfolgreich gelöscht.' });
    } catch (err) {
      console.error('Fehler beim Löschen des Benutzers:', err);
      res.status(500).json({ error: 'Datenbankfehler' });
    } finally {
      if (conn) conn.release();
    }
  });

  /**
   * POST /temp
   *
   * Legt einen temporären Benutzer mit Ablaufdatum an. Die Dauer wird
   * als Anzahl von Tagen übergeben und in der Datenbank relativ zum
   * aktuellen Datum gespeichert.
   */
  router.post('/temp', async (req, res) => {
    const requester = getRole(req);
    if (!canManageTemp(requester)) {
      return res.status(403).json({ error: 'Nicht erlaubt.' });
    }
    const { username, password, expires } = req.body || {};
    const days = parseInt(expires, 10);
    if (!username || !password || !days) {
      return res.status(400).json({ error: 'Benutzername, Passwort und Ablaufdauer erforderlich.' });
    }
    let conn;
    try {
      conn = await pool.getConnection();
      await conn.query(
        'CREATE TABLE IF NOT EXISTS temp_users (username VARCHAR(255) PRIMARY KEY, password VARCHAR(255), expires_at DATETIME)'
      );
      await conn.query(
        'INSERT INTO temp_users (username, password, expires_at) VALUES (?, ?, DATE_ADD(NOW(), INTERVAL ? DAY))',
        [username, password, days]
      );
      res.json({ message: 'Temporärer Benutzer erstellt.' });
    } catch (err) {
      console.error('Fehler beim Anlegen des temporären Benutzers:', err);
      res.status(500).json({ error: 'Datenbankfehler' });
    } finally {
      if (conn) conn.release();
    }
  });

  return router;
};
