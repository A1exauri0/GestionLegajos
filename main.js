const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const AuditoriaLegajosController = require('./src/controllers/AuditoriaLegajosController');
const ExportadorExcel = require('./src/utils/ExportadorExcel');

let mainWindow;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1360,
        height: 860,
        minWidth: 1024,
        minHeight: 700,
        title: 'Gestión de Legajos - Control de Auditoría',
        backgroundColor: '#f8f9fa',
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false
        }
    });

    mainWindow.loadFile(path.join(__dirname, 'src/views/index.html'));
    mainWindow.setMenuBarVisibility(false);
}

app.whenReady().then(() => {
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});

// IPC Handlers
ipcMain.handle('obtener-estado', async (event, fecha) => {
    return AuditoriaLegajosController.obtenerEstado(fecha);
});

ipcMain.handle('iniciar-turno', async (event, fecha) => {
    return AuditoriaLegajosController.iniciarTurno(fecha);
});

ipcMain.handle('guardar-registro', async (event, datos) => {
    return AuditoriaLegajosController.guardarRegistro(datos);
});

ipcMain.handle('actualizar-registro', async (event, { id, datos }) => {
    return AuditoriaLegajosController.actualizarRegistro(id, datos);
});

ipcMain.handle('marcar-finalizado', async (event, id) => {
    return AuditoriaLegajosController.marcarFinalizado(id);
});

ipcMain.handle('eliminar-registro', async (event, id) => {
    return AuditoriaLegajosController.eliminarRegistro(id);
});

ipcMain.handle('finalizar-turno', async (event, turnoId) => {
    return AuditoriaLegajosController.finalizarTurno(turnoId);
});

ipcMain.handle('reabrir-turno', async (event, turnoId) => {
    return AuditoriaLegajosController.reabrirTurno(turnoId);
});

ipcMain.handle('exportar-excel', async (event, turnoId) => {
    return ExportadorExcel.exportarTurno(turnoId, mainWindow);
});

// Handlers del Catálogo de Empleados
ipcMain.handle('obtener-empleados', async () => {
    return AuditoriaLegajosController.obtenerEmpleados();
});

ipcMain.handle('crear-empleado', async (event, datos) => {
    return AuditoriaLegajosController.crearEmpleado(datos);
});

ipcMain.handle('actualizar-empleado', async (event, { id, datos }) => {
    return AuditoriaLegajosController.actualizarEmpleado(id, datos);
});

ipcMain.handle('eliminar-empleado', async (event, id) => {
    return AuditoriaLegajosController.eliminarEmpleado(id);
});