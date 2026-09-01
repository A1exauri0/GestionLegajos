const db = require('../database/connection');

class AuditoriaLegajosController {

    /**
     * Obtiene el estado completo de la vista para la fecha seleccionada.
     */
    static obtenerEstado(fecha) {
        if (!fecha) {
            // Buscar turno abierto más reciente o usar hoy
            const turnoAbierto = db.prepare(`
                SELECT * FROM turnos_legajos WHERE estatus = 'abierto' ORDER BY fecha DESC LIMIT 1
            `).get();

            if (turnoAbierto) {
                fecha = turnoAbierto.fecha;
            } else {
                fecha = new Date().toISOString().split('T')[0];
            }
        }

        let turnoActual = db.prepare('SELECT * FROM turnos_legajos WHERE fecha = ?').get(fecha) || null;
        let registros = [];
        let totalEmpleados = 0;

        if (turnoActual) {
            // Obtener registros de legajos con delegación
            registros = db.prepare(`
                SELECT a.*, d.nombre as delegacion_nombre
                FROM auditoria_legajos a
                LEFT JOIN delegaciones d ON a.delegacion_id = d.id
                WHERE a.turno_legajo_id = ?
                ORDER BY a.id ASC
            `).all(turnoActual.id);

            const legajoIds = registros.map(r => r.id);

            if (legajoIds.length > 0) {
                // Obtener usuarios asignados desde la tabla pivote
                const placeholders = legajoIds.map(() => '?').join(',');
                const usuariosPivote = db.prepare(`
                    SELECT alu.auditoria_legajo_id, e.id as usuario_id, e.name as usuario_nombre
                    FROM auditoria_legajo_usuarios alu
                    JOIN empleados e ON alu.usuario_id = e.id
                    WHERE alu.auditoria_legajo_id IN (${placeholders})
                `).all(...legajoIds);

                const usuariosPorLegajo = {};
                for (const u of usuariosPivote) {
                    if (!usuariosPorLegajo[u.auditoria_legajo_id]) {
                        usuariosPorLegajo[u.auditoria_legajo_id] = [];
                    }
                    usuariosPorLegajo[u.auditoria_legajo_id].push(u);
                }

                const todosUsuariosIds = new Set();

                for (const r of registros) {
                    let users = usuariosPorLegajo[r.id] || [];
                    if (users.length === 0 && r.usuario_id) {
                        const fallback = db.prepare('SELECT id, name FROM empleados WHERE id = ?').get(r.usuario_id);
                        if (fallback) {
                            users = [{ usuario_id: fallback.id, usuario_nombre: fallback.name }];
                        }
                    }
                    r.usuarios = users;
                    r.usuario_ids = users.map(u => u.usuario_id);
                    r.empleado_nombre = users.map(u => u.usuario_nombre).join(', ');

                    r.usuario_ids.forEach(uId => todosUsuariosIds.add(uId));
                }

                totalEmpleados = todosUsuariosIds.size;
            }
        }

        // Totales y KPIs
        const totalVolumenes = registros.length;
        const totalHojas = registros.reduce((sum, r) => sum + (Number(r.numero_hojas) || 0), 0);
        const totalFinalizados = registros.filter(r => r.estado === 'finalizado').length;
        const totalEnProceso = registros.filter(r => r.estado === 'en proceso').length;
        const totalPendientes = registros.filter(r => r.estado === 'pendiente').length;

        // Catálogos
        const empleados = db.prepare('SELECT id, name, turno FROM empleados WHERE estatus = 1 ORDER BY name ASC').all();
        const delegaciones = db.prepare('SELECT id, nombre FROM delegaciones WHERE estatus = 1 ORDER BY nombre ASC').all();

        // Histórico de turnos (últimos 30)
        const historicoTurnos = db.prepare(`
            SELECT t.id, t.fecha, t.estatus, t.finalizado_en, t.finalizado_por,
                   COUNT(a.id) as total_carpetas,
                   COALESCE(SUM(a.numero_hojas), 0) as total_hojas
            FROM turnos_legajos t
            LEFT JOIN auditoria_legajos a ON t.id = a.turno_legajo_id
            GROUP BY t.id, t.fecha, t.estatus, t.finalizado_en, t.finalizado_por
            ORDER BY t.fecha DESC
            LIMIT 30
        `).all();

        return {
            fecha,
            turnoActual,
            registros,
            totalVolumenes,
            totalHojas,
            totalEmpleados,
            totalFinalizados,
            totalEnProceso,
            totalPendientes,
            empleados,
            delegaciones,
            historicoTurnos
        };
    }

    /**
     * Inicia el turno diario y arrastra automáticamente los pendientes del turno anterior.
     */
    static iniciarTurno(fecha) {
        if (!fecha) throw new Error('La fecha es requerida.');

        const turnoExistente = db.prepare('SELECT * FROM turnos_legajos WHERE fecha = ?').get(fecha);
        let turnoId;

        if (turnoExistente) {
            if (turnoExistente.estatus === 'finalizado') {
                return {
                    success: false,
                    message: `El turno del día ${fecha} ya fue finalizado previamente.`
                };
            }
            turnoId = turnoExistente.id;
        } else {
            const res = db.prepare(`
                INSERT INTO turnos_legajos (fecha, estatus, created_at, updated_at)
                VALUES (?, 'abierto', datetime('now', 'localtime'), datetime('now', 'localtime'))
            `).run(fecha);
            turnoId = res.lastInsertRowid;
        }

        // Arrastrar pendientes si el turno no tiene registros
        let pendientesArrastrados = 0;
        const totalRegistrosHoy = db.prepare('SELECT COUNT(*) as total FROM auditoria_legajos WHERE turno_legajo_id = ?').get(turnoId).total;

        if (totalRegistrosHoy === 0) {
            const turnoAnterior = db.prepare(`
                SELECT * FROM turnos_legajos WHERE fecha < ? ORDER BY fecha DESC LIMIT 1
            `).get(fecha);

            if (turnoAnterior) {
                const pendientes = db.prepare(`
                    SELECT * FROM auditoria_legajos WHERE turno_legajo_id = ? AND estado = 'pendiente'
                `).all(turnoAnterior.id);

                const stmtInsertLegajo = db.prepare(`
                    INSERT INTO auditoria_legajos (
                        turno_legajo_id, usuario_id, delegacion_id, volumen,
                        legajos_iniciales, legajos_finales, numero_hojas,
                        estado, observaciones, created_at, updated_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, 'en proceso', ?, datetime('now', 'localtime'), datetime('now', 'localtime'))
                `);

                const stmtInsertPivote = db.prepare(`
                    INSERT INTO auditoria_legajo_usuarios (auditoria_legajo_id, usuario_id, created_at, updated_at)
                    VALUES (?, ?, datetime('now', 'localtime'), datetime('now', 'localtime'))
                `);

                const copiarTransaccion = db.transaction((listaPendientes) => {
                    for (const p of listaPendientes) {
                        const nuevo = stmtInsertLegajo.run(
                            turnoId, p.usuario_id, p.delegacion_id, p.volumen,
                            p.legajos_iniciales, p.legajos_finales, p.numero_hojas, p.observaciones
                        );
                        const nuevoId = nuevo.lastInsertRowid;

                        const usuariosPivote = db.prepare(`
                            SELECT usuario_id FROM auditoria_legajo_usuarios WHERE auditoria_legajo_id = ?
                        `).all(p.id);

                        if (usuariosPivote.length > 0) {
                            for (const up of usuariosPivote) {
                                stmtInsertPivote.run(nuevoId, up.usuario_id);
                            }
                        } else if (p.usuario_id) {
                            stmtInsertPivote.run(nuevoId, p.usuario_id);
                        }
                        pendientesArrastrados++;
                    }
                });

                copiarTransaccion(pendientes);
            }
        }

        let mensaje = `Turno del día ${fecha} iniciado exitosamente.`;
        if (pendientesArrastrados > 0) {
            mensaje += ` Se arrastraron ${pendientesArrastrados} legajo(s) pendiente(s) del turno anterior.`;
        }

        return {
            success: true,
            message: mensaje,
            fecha
        };
    }

    /**
     * Guarda un nuevo legajo admitiendo múltiples personas asignadas.
     */
    static guardarRegistro(datos) {
        const { turno_legajo_id, usuario_ids, delegacion_id, volumen, legajos_iniciales, legajos_finales, numero_hojas, estado } = datos;

        const turno = db.prepare('SELECT * FROM turnos_legajos WHERE id = ?').get(turno_legajo_id);
        if (!turno) return { success: false, message: 'Turno no encontrado.' };
        if (turno.estatus === 'finalizado') return { success: false, message: 'El turno está finalizado y no permite modificaciones.' };

        const uIds = Array.isArray(usuario_ids) ? usuario_ids.map(Number).filter(Boolean) : [];
        if (uIds.length === 0) {
            return { success: false, message: 'Debes seleccionar al menos un empleado.' };
        }

        if (!volumen || !volumen.trim()) {
            return { success: false, message: 'El campo Volumen es obligatorio.' };
        }

        const primerUsuarioId = uIds[0];
        const est = estado || 'en proceso';

        const stmtLegajo = db.prepare(`
            INSERT INTO auditoria_legajos (
                turno_legajo_id, usuario_id, delegacion_id, volumen,
                legajos_iniciales, legajos_finales, numero_hojas, estado,
                created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now', 'localtime'), datetime('now', 'localtime'))
        `);

        const stmtPivote = db.prepare(`
            INSERT INTO auditoria_legajo_usuarios (auditoria_legajo_id, usuario_id, created_at, updated_at)
            VALUES (?, ?, datetime('now', 'localtime'), datetime('now', 'localtime'))
        `);

        let nuevoId;
        const guardarTx = db.transaction(() => {
            const res = stmtLegajo.run(
                turno_legajo_id, primerUsuarioId, delegacion_id ? Number(delegacion_id) : null,
                volumen.trim(), legajos_iniciales ? legajos_iniciales.trim() : null,
                legajos_finales ? legajos_finales.trim() : null,
                numero_hojas ? Number(numero_hojas) : 0, est
            );
            nuevoId = res.lastInsertRowid;

            for (const uid of [...new Set(uIds)]) {
                stmtPivote.run(nuevoId, uid);
            }
        });

        guardarTx();

        return {
            success: true,
            message: 'Registro agregado correctamente.',
            id: nuevoId
        };
    }

    /**
     * Alterna o marca un legajo directamente como finalizado.
     */
    static marcarFinalizado(id) {
        const registro = db.prepare('SELECT * FROM auditoria_legajos WHERE id = ?').get(id);
        if (!registro) return { success: false, message: 'Registro no encontrado.' };

        const turno = db.prepare('SELECT * FROM turnos_legajos WHERE id = ?').get(registro.turno_legajo_id);
        if (turno && turno.estatus === 'finalizado') {
            return { success: false, message: 'El turno se encuentra finalizado.' };
        }

        const nuevoEstado = (registro.estado === 'finalizado') ? 'en proceso' : 'finalizado';

        db.prepare(`
            UPDATE auditoria_legajos SET estado = ?, updated_at = datetime('now', 'localtime') WHERE id = ?
        `).run(nuevoEstado, id);

        return {
            success: true,
            message: nuevoEstado === 'finalizado' ? 'Legajo marcado como finalizado.' : 'Legajo marcado en proceso.',
            nuevo_estado: nuevoEstado
        };
    }

    /**
     * Actualiza un registro existente y sus personas asignadas.
     */
    static actualizarRegistro(id, datos) {
        const { usuario_ids, delegacion_id, volumen, legajos_iniciales, legajos_finales, numero_hojas, estado } = datos;

        const registro = db.prepare('SELECT * FROM auditoria_legajos WHERE id = ?').get(id);
        if (!registro) return { success: false, message: 'Registro no encontrado.' };

        const turno = db.prepare('SELECT * FROM turnos_legajos WHERE id = ?').get(registro.turno_legajo_id);
        if (turno && turno.estatus === 'finalizado') {
            return { success: false, message: 'El turno se encuentra finalizado.' };
        }

        const uIds = Array.isArray(usuario_ids) ? usuario_ids.map(Number).filter(Boolean) : [];
        if (uIds.length === 0) {
            return { success: false, message: 'Debes seleccionar al menos un empleado.' };
        }

        const primerUsuarioId = uIds[0];

        const actualizarTx = db.transaction(() => {
            db.prepare(`
                UPDATE auditoria_legajos SET
                    usuario_id = ?,
                    delegacion_id = ?,
                    volumen = ?,
                    legajos_iniciales = ?,
                    legajos_finales = ?,
                    numero_hojas = ?,
                    estado = ?,
                    updated_at = datetime('now', 'localtime')
                WHERE id = ?
            `).run(
                primerUsuarioId, delegacion_id ? Number(delegacion_id) : null,
                volumen.trim(), legajos_iniciales ? legajos_iniciales.trim() : null,
                legajos_finales ? legajos_finales.trim() : null,
                numero_hojas ? Number(numero_hojas) : 0,
                estado || registro.estado, id
            );

            db.prepare('DELETE FROM auditoria_legajo_usuarios WHERE auditoria_legajo_id = ?').run(id);

            const stmtPivote = db.prepare(`
                INSERT INTO auditoria_legajo_usuarios (auditoria_legajo_id, usuario_id, created_at, updated_at)
                VALUES (?, ?, datetime('now', 'localtime'), datetime('now', 'localtime'))
            `);

            for (const uid of [...new Set(uIds)]) {
                stmtPivote.run(id, uid);
            }
        });

        actualizarTx();

        return {
            success: true,
            message: 'Registro actualizado correctamente.'
        };
    }

    /**
     * Elimina un registro de legajo.
     */
    static eliminarRegistro(id) {
        const registro = db.prepare('SELECT * FROM auditoria_legajos WHERE id = ?').get(id);
        if (!registro) return { success: false, message: 'Registro no encontrado.' };

        const turno = db.prepare('SELECT * FROM turnos_legajos WHERE id = ?').get(registro.turno_legajo_id);
        if (turno && turno.estatus === 'finalizado') {
            return { success: false, message: 'El turno se encuentra finalizado.' };
        }

        const eliminarTx = db.transaction(() => {
            db.prepare('DELETE FROM auditoria_legajo_usuarios WHERE auditoria_legajo_id = ?').run(id);
            db.prepare('DELETE FROM auditoria_legajos WHERE id = ?').run(id);
        });

        eliminarTx();

        return {
            success: true,
            message: 'Registro eliminado correctamente.'
        };
    }

    /**
     * Finaliza el turno del día y pasa los legajos no finalizados a pendiente.
     */
    static finalizarTurno(turnoId) {
        const turno = db.prepare('SELECT * FROM turnos_legajos WHERE id = ?').get(turnoId);
        if (!turno) return { success: false, message: 'Turno no encontrado.' };

        const finalizarTx = db.transaction(() => {
            db.prepare(`
                UPDATE auditoria_legajos
                SET estado = 'pendiente', updated_at = datetime('now', 'localtime')
                WHERE turno_legajo_id = ? AND estado != 'finalizado'
            `).run(turnoId);

            db.prepare(`
                UPDATE turnos_legajos
                SET estatus = 'finalizado', finalizado_en = datetime('now', 'localtime'), updated_at = datetime('now', 'localtime')
                WHERE id = ?
            `).run(turnoId);
        });

        finalizarTx();

        return {
            success: true,
            message: 'El turno diario ha sido finalizado exitosamente. Los registros no marcados han pasado a estado pendiente.'
        };
    }

    /**
     * Reabre un turno diario finalizado.
     */
    static reabrirTurno(turnoId) {
        const turno = db.prepare('SELECT * FROM turnos_legajos WHERE id = ?').get(turnoId);
        if (!turno) return { success: false, message: 'Turno no encontrado.' };

        db.prepare(`
            UPDATE turnos_legajos
            SET estatus = 'abierto', finalizado_en = NULL, updated_at = datetime('now', 'localtime')
            WHERE id = ?
        `).run(turnoId);

        return {
            success: true,
            message: 'El turno ha sido reabierto exitosamente.'
        };
    }
}

module.exports = AuditoriaLegajosController;