const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');
const { app } = require('electron');

// Directorio de almacenamiento para persistencia en Electron
let userDataPath;
try {
    userDataPath = app ? app.getPath('userData') : path.join(__dirname, '../../');
} catch (e) {
    userDataPath = path.join(__dirname, '../../');
}

if (!fs.existsSync(userDataPath)) {
    fs.mkdirSync(userDataPath, { recursive: true });
}

const dbPath = path.join(userDataPath, 'gestion_legajos.sqlite');
console.log('Ruta de Base de Datos SQLite:', dbPath);

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Inicializar tablas
function inicializarBaseDatos() {
    // 1. Tabla de turnos / jornadas diarias
    db.exec(`
        CREATE TABLE IF NOT EXISTS turnos_legajos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            fecha TEXT UNIQUE NOT NULL,
            estatus TEXT DEFAULT 'abierto',
            admin_id INTEGER,
            finalizado_por TEXT,
            finalizado_en TEXT,
            created_at TEXT,
            updated_at TEXT
        );
    `);

    // 2. Tabla de empleados / usuarios (inicia en limpio)
    db.exec(`
        CREATE TABLE IF NOT EXISTS empleados (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            turno TEXT,
            estatus INTEGER DEFAULT 1,
            created_at TEXT
        );
    `);

    // 3. Tabla de delegaciones
    db.exec(`
        CREATE TABLE IF NOT EXISTS delegaciones (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nombre TEXT NOT NULL,
            estatus INTEGER DEFAULT 1,
            created_at TEXT
        );
    `);

    // 4. Tabla de registros de legajos
    db.exec(`
        CREATE TABLE IF NOT EXISTS auditoria_legajos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            turno_legajo_id INTEGER NOT NULL,
            usuario_id INTEGER,
            delegacion_id INTEGER,
            volumen TEXT NOT NULL,
            legajos_iniciales TEXT,
            legajos_finales TEXT,
            numero_hojas INTEGER DEFAULT 0,
            estado TEXT DEFAULT 'en proceso',
            observaciones TEXT,
            creado_por TEXT,
            created_at TEXT,
            updated_at TEXT,
            FOREIGN KEY (turno_legajo_id) REFERENCES turnos_legajos(id) ON DELETE CASCADE,
            FOREIGN KEY (delegacion_id) REFERENCES delegaciones(id) ON DELETE SET NULL
        );
    `);

    // 5. Tabla pivote para múltiples empleados por legajo
    db.exec(`
        CREATE TABLE IF NOT EXISTS auditoria_legajo_usuarios (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            auditoria_legajo_id INTEGER NOT NULL,
            usuario_id INTEGER NOT NULL,
            created_at TEXT,
            updated_at TEXT,
            FOREIGN KEY (auditoria_legajo_id) REFERENCES auditoria_legajos(id) ON DELETE CASCADE,
            FOREIGN KEY (usuario_id) REFERENCES empleados(id) ON DELETE CASCADE
        );
    `);

    // Sembrar únicamente las 19 delegaciones oficiales
    sembrarDelegaciones();
}

function sembrarDelegaciones() {
    const totalDelegaciones = db.prepare('SELECT COUNT(*) as total FROM delegaciones').get().total;
    if (totalDelegaciones === 0) {
        const delegacionesOficiales = [
            'TUXTLA GUTIÉRREZ', 'TAPACHULA', 'SAN CRISTÓBAL DE LAS CASAS', 'COMITÁN DE DOMÍNGUEZ',
            'VILLAFLORES', 'PALENQUE', 'PICHUCALCO', 'TONALÁ', 'OCOSINGO', 'HUIXTLA',
            'CINTALAPA', 'ARRIAGA', 'CHIAPA DE CORZO', 'BERRIOZÁBAL', 'MOTOZINTLA',
            'REFORMA', 'YAJALÓN', 'VENUSTIANO CARRANZA', 'BOCHIL'
        ];
        const stmt = db.prepare("INSERT INTO delegaciones (nombre, estatus, created_at) VALUES (?, 1, datetime('now', 'localtime'))");
        const insertMany = db.transaction((lista) => {
            for (const d of lista) stmt.run(d);
        });
        insertMany(delegacionesOficiales);
        console.log('Delegaciones oficiales sembradas.');
    }
}

inicializarBaseDatos();

module.exports = db;