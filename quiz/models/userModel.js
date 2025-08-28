const mariadb = require('mariadb');

/*
 * Dieses Modul kapselt die Datenbankzugriffe für Benutzer. Es stellt
 * Methoden zum Anlegen, Auslesen, Aktualisieren und Löschen von
 * Benutzern bereit. Der Connection‑Pool wird von außen übergeben,
 * sodass der Aufrufer die Lebensdauer der Verbindungen steuern kann.
 */

class UserModel {
  constructor(pool) {
    this.pool = pool;
  }

  async getAllUsers() {
    let conn;
    try {
      conn = await this.pool.getConnection();
      return await conn.query('SELECT username, role FROM users');
    } finally {
      if (conn) conn.release();
    }
  }

  async getUser(username) {
    let conn;
    try {
      conn = await this.pool.getConnection();
      const rows = await conn.query(
        'SELECT * FROM users WHERE LOWER(username) = LOWER(?)',
        [username]
      );
      return rows[0] || null;
    } finally {
      if (conn) conn.release();
    }
  }

  async createUser(username, password, role) {
    let conn;
    try {
      conn = await this.pool.getConnection();
      await conn.query(
        'INSERT INTO users (username, password, role) VALUES (?, ?, ?)',
        [username, password, role]
      );
    } finally {
      if (conn) conn.release();
    }
  }

  async updatePassword(username, newPassword) {
    let conn;
    try {
      conn = await this.pool.getConnection();
      await conn.query(
        'UPDATE users SET password = ? WHERE LOWER(username) = LOWER(?)',
        [newPassword, username]
      );
    } finally {
      if (conn) conn.release();
    }
  }

  async deleteUser(username) {
    let conn;
    try {
      conn = await this.pool.getConnection();
      await conn.query(
        'DELETE FROM users WHERE LOWER(username) = LOWER(?)',
        [username]
      );
    } finally {
      if (conn) conn.release();
    }
  }
}

module.exports = UserModel;
