# Gestión y Auditoría de Legajos 📁⚡

Aplicación de escritorio autónoma, desarrollada con **Electron** y base de datos local **SQLite (`better-sqlite3`)**, diseñada para el control diario, registro, asignación y auditoría de legajos y volúmenes con soporte 100% offline.

---

## 🚀 Características Principales

- **Control de Jornadas y Turnos Diarios**:
  - Apertura, finalización y reapertura de turnos por fecha.
  - **Detección inteligente de turnos previos**: Al iniciar la aplicación en una nueva fecha, detecta si la jornada anterior quedó abierta y ofrece finalizarla automáticamente.
  - **Arrastre automático de pendientes**: Al iniciar un nuevo turno, los legajos no concluidos del día anterior se traspasan automáticamente en estado `en proceso`, conservando empleados asignados, delegación, volumen y avance.

- **Captura Rápida y Múltiples Empleados**:
  - Selector de empleados con acumulación dinámica de etiquetas/chips por legajo.
  - Catálogo preconfigurado con las 19 delegaciones oficiales.
  - Control de estados en tiempo real (`en proceso`, `finalizado`, `pendiente`).
  - Acción rápida con confirmación para marcar registros como finalizados (`✔`).

- **Catálogo Interactivo de Empleados / Usuarios**:
  - Módulo modal para dar de alta, buscar, editar y eliminar empleados.
  - Sincronización instantánea con los formularios de captura y edición.

- **Exportación a Excel (`.xlsx`)**:
  - Generación de reportes formateados mediante `exceljs` con encabezados estilizados, colores oficiales de celdas por estado y diálogo nativo para guardar en disco.

- **100% Offline y Portable**:
  - Sin dependencias de internet o enlaces CDN. Todos los recursos (Bootstrap, jQuery, SweetAlert2, Material Design Icons y fuentes de iconos `.woff2`) están integrados localmente.

---

## 📂 Estructura del Proyecto

```
GestionLegajos/
├── package.json               # Configuración de dependencias y scripts de empaquetado
├── main.js                    # Proceso principal de Electron y registro de canales IPC
├── preload.js                 # Puente seguro (contextBridge) entre UI y NodeJS
├── src/
│   ├── database/
│   │   ├── connection.js      # Conexión SQLite, llaves foráneas, modo WAL y tablas
│   │   └── delegaciones_seed.json # Semilla de las 19 delegaciones oficiales
│   ├── controllers/
│   │   └── AuditoriaLegajosController.js # Lógica de negocio, turnos, arrastre y CRUDs
│   ├── utils/
│   │   └── ExportadorExcel.js # Generación y formato del reporte Excel .xlsx
│   ├── assets/
│   │   ├── css/               # bootstrap.min.css, materialdesignicons.min.css, app.css
│   │   ├── fonts/             # Fuentes locales de iconos (materialdesignicons-webfont.woff2)
│   │   └── js/                # jquery.min.js, sweetalert2.all.min.js, app.js
│   └── views/
│       └── index.html         # Vista principal de la aplicación
└── dist/                      # Salidas de compilación y ejecutable portable (.exe)
```

---

## 🛠️ Instalación y Modo Desarrollo

Requisitos: **Node.js (v18+)** y **NPM**.

```bash
# 1. Clonar o ingresar al directorio del proyecto
cd c:\laragon\www\GestionLegajos

# 2. Instalar dependencias
npm install

# 3. Ejecutar en modo desarrollo
npm start
```

---

## 📦 Compilación del Ejecutable (.exe)

Para compilar el archivo ejecutable portable para Windows:

```bash
npm run dist
```

El archivo generado se creará en la carpeta `dist/`:
- **Ejecutable Portable**: `dist/Gestion de Legajos 1.0.0.exe`
- **Carpeta Descomprimida**: `dist/win-unpacked/Gestion de Legajos.exe`

---

## 💾 Ubicación de la Base de Datos SQLite

- **Al usar el ejecutable `.exe`**:
  `%APPDATA%\gestion-legajos\gestion_legajos.sqlite`
  *(Ruta: `C:\Users\<TuUsuario>\AppData\Roaming\gestion-legajos\gestion_legajos.sqlite`)*
- **En modo desarrollo (`npm start`)**:
  `gestion_legajos.sqlite` en la raíz del proyecto.