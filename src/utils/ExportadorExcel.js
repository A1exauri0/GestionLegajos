const ExcelJS = require('exceljs');
const db = require('../database/connection');
const { dialog } = require('electron');
const path = require('path');

class ExportadorExcel {

    /**
     * Genera y guarda un reporte en Excel formateado idéntico a la muestra.
     */
    static async exportarTurno(turnoId, ventanaPadre) {
        const turno = db.prepare('SELECT * FROM turnos_legajos WHERE id = ?').get(turnoId);
        if (!turno) throw new Error('Turno no encontrado.');

        const registros = db.prepare(`
            SELECT a.*, d.nombre as delegacion_nombre
            FROM auditoria_legajos a
            LEFT JOIN delegaciones d ON a.delegacion_id = d.id
            WHERE a.turno_legajo_id = ?
            ORDER BY a.id ASC
        `).all(turno.id);

        const legajoIds = registros.map(r => r.id);
        const usuariosPorLegajo = {};

        if (legajoIds.length > 0) {
            const placeholders = legajoIds.map(() => '?').join(',');
            const usuariosPivote = db.prepare(`
                SELECT alu.auditoria_legajo_id, e.name as usuario_nombre
                FROM auditoria_legajo_usuarios alu
                JOIN empleados e ON alu.usuario_id = e.id
                WHERE alu.auditoria_legajo_id IN (${placeholders})
            `).all(...legajoIds);

            for (const u of usuariosPivote) {
                if (!usuariosPorLegajo[u.auditoria_legajo_id]) {
                    usuariosPorLegajo[u.auditoria_legajo_id] = [];
                }
                usuariosPorLegajo[u.auditoria_legajo_id].push(u.usuario_nombre);
            }
        }

        for (const r of registros) {
            const names = usuariosPorLegajo[r.id] || [];
            if (names.length === 0 && r.usuario_id) {
                const fallback = db.prepare('SELECT name FROM empleados WHERE id = ?').get(r.usuario_id);
                if (fallback) names.push(fallback.name);
            }
            r.empleado_nombre = names.join(' / ');
        }

        const workbook = new ExcelJS.Workbook();
        workbook.creator = 'Sistema Gestion Legajos';
        workbook.created = new Date();

        const worksheet = workbook.addWorksheet('Auditoria Legajos', {
            views: [{ showGridLines: true }]
        });

        // Título A1
        worksheet.mergeCells('A1:G1');
        const tituloCell = worksheet.getCell('A1');
        tituloCell.value = `AUDITORÍA DE LEGAJOS - FECHA: ${turno.fecha} (${turno.estatus.toUpperCase()})`;
        tituloCell.font = { bold: true, size: 13, color: { argb: 'FF1E3C72' } };
        tituloCell.alignment = { horizontal: 'left', vertical: 'middle' };

        // Encabezados fila 3
        const headers = [
            { col: 'A', title: 'Empleado(s)', color: 'FFE9ECEF', align: 'left' },
            { col: 'B', title: 'Delegación', color: 'FFE2E8F0', align: 'left' },
            { col: 'C', title: 'Volumen', color: 'FFE0A86E', align: 'center' },
            { col: 'D', title: 'LEGAJOS INICIALES', color: 'FFF5E09E', align: 'center' },
            { col: 'E', title: 'LEGAJOS FINALES', color: 'FFF5E09E', align: 'center' },
            { col: 'F', title: 'No. Hojas', color: 'FFB6D7F2', align: 'center' },
            { col: 'G', title: 'Estado', color: 'FFE0E0E0', align: 'center' }
        ];

        headers.forEach(h => {
            const cell = worksheet.getCell(`${h.col}3`);
            cell.value = h.title;
            cell.font = { bold: true, size: 10 };
            cell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: h.color }
            };
            cell.alignment = { horizontal: h.align, vertical: 'middle' };
        });

        let fila = 4;
        for (const r of registros) {
            worksheet.getCell(`A${fila}`).value = r.empleado_nombre;
            worksheet.getCell(`B${fila}`).value = r.delegacion_nombre || '-';
            worksheet.getCell(`C${fila}`).value = r.volumen;
            worksheet.getCell(`D${fila}`).value = r.legajos_iniciales || '';
            worksheet.getCell(`E${fila}`).value = r.legajos_finales || '';
            worksheet.getCell(`F${fila}`).value = r.numero_hojas > 0 ? r.numero_hojas : '';
            
            const cellEstado = worksheet.getCell(`G${fila}`);
            cellEstado.value = r.estado;

            // Alineaciones
            worksheet.getCell(`C${fila}`).alignment = { horizontal: 'center', vertical: 'middle' };
            worksheet.getCell(`D${fila}`).alignment = { horizontal: 'center', vertical: 'middle' };
            worksheet.getCell(`E${fila}`).alignment = { horizontal: 'center', vertical: 'middle' };
            worksheet.getCell(`F${fila}`).alignment = { horizontal: 'right', vertical: 'middle' };
            cellEstado.alignment = { horizontal: 'center', vertical: 'middle' };

            // Color del estado
            let bgEstado = 'FFFFFFFF';
            let fgEstado = 'FF000000';
            if (r.estado === 'finalizado' || r.estado === 'terminado') {
                bgEstado = 'FF92C15E';
                fgEstado = 'FFFFFFFF';
            } else if (r.estado === 'en proceso') {
                bgEstado = 'FFFFF3CD';
                fgEstado = 'FF856404';
            } else if (r.estado === 'pendiente') {
                bgEstado = 'FFF8D7DA';
                fgEstado = 'FF721C24';
            }

            cellEstado.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgEstado } };
            cellEstado.font = { bold: true, color: { argb: fgEstado } };

            fila++;
        }

        const finFila = Math.max(4, fila - 1);

        // Bordes delgados
        const thinBorder = {
            top: { style: 'thin', color: { argb: 'FFB0BEC5' } },
            left: { style: 'thin', color: { argb: 'FFB0BEC5' } },
            bottom: { style: 'thin', color: { argb: 'FFB0BEC5' } },
            right: { style: 'thin', color: { argb: 'FFB0BEC5' } }
        };

        for (let f = 3; f <= finFila; f++) {
            ['A', 'B', 'C', 'D', 'E', 'F', 'G'].forEach(col => {
                worksheet.getCell(`${col}${f}`).border = thinBorder;
            });
        }

        // Anchos de columna
        worksheet.getColumn('A').width = 32;
        worksheet.getColumn('B').width = 22;
        worksheet.getColumn('C').width = 14;
        worksheet.getColumn('D').width = 20;
        worksheet.getColumn('E').width = 20;
        worksheet.getColumn('F').width = 15;
        worksheet.getColumn('G').width = 18;

        // Diálogo para guardar archivo
        const { canceled, filePath } = await dialog.showSaveDialog(ventanaPadre, {
            title: 'Guardar Reporte de Legajos en Excel',
            defaultPath: `Auditoria_Legajos_${turno.fecha}.xlsx`,
            filters: [{ name: 'Archivos de Excel (*.xlsx)', extensions: ['xlsx'] }]
        });

        if (canceled || !filePath) {
            return { success: false, message: 'Exportación cancelada.' };
        }

        await workbook.xlsx.writeFile(filePath);

        return {
            success: true,
            message: `Reporte guardado exitosamente en:\n${filePath}`,
            filePath
        };
    }
}

module.exports = ExportadorExcel;