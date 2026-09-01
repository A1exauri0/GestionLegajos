const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
    obtenerEstado: (fecha) => ipcRenderer.invoke('obtener-estado', fecha),
    iniciarTurno: (fecha) => ipcRenderer.invoke('iniciar-turno', fecha),
    guardarRegistro: (datos) => ipcRenderer.invoke('guardar-registro', datos),
    actualizarRegistro: (id, datos) => ipcRenderer.invoke('actualizar-registro', { id, datos }),
    marcarFinalizado: (id) => ipcRenderer.invoke('marcar-finalizado', id),
    eliminarRegistro: (id) => ipcRenderer.invoke('eliminar-registro', id),
    finalizarTurno: (turnoId) => ipcRenderer.invoke('finalizar-turno', turnoId),
    reabrirTurno: (turnoId) => ipcRenderer.invoke('reabrir-turno', turnoId),
    exportarExcel: (turnoId) => ipcRenderer.invoke('exportar-excel', turnoId)
});