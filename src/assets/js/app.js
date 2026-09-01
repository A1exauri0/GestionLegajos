$(document).ready(function () {
    let estadoGlobal = null;

    // Helper para agregar chip de usuario en contenedores
    function agregarChipUsuario(contenedor, id, nombre) {
        if (!id || !nombre) return;
        id = String(id);
        if (contenedor.find(`input[value="${id}"]`).length > 0) return;

        const chipHtml = `
            <span class="chip-usuario">
                <span>${$('<div>').text(nombre).html()}</span>
                <input type="hidden" name="usuario_ids[]" value="${id}">
                <i class="mdi mdi-close btn-quitar-usuario" title="Quitar empleado"></i>
            </span>
        `;
        contenedor.append(chipHtml);
    }

    // Modal helpers
    function abrirModalEdicion() {
        $('#modalEditarRegistro').fadeIn(200);
        $('body').addClass('modal-open');
    }

    function cerrarModalEdicion() {
        $('#modalEditarRegistro').fadeOut(150);
        $('body').removeClass('modal-open');
    }

    // Cargar datos de la fecha
    async function cargarEstado(fecha = null) {
        try {
            const estado = await window.api.obtenerEstado(fecha);
            estadoGlobal = estado;
            renderizarVista(estado);
        } catch (err) {
            Swal.fire({ icon: 'error', title: 'Error', text: err.message });
        }
    }

    // Renderizar la vista
    function renderizarVista(data) {
        $('#inputFechaTurno').val(data.fecha);

        // Badge y botones de turno
        if (!data.turnoActual) {
            $('#badgeTurnoEstado').removeClass().addClass('badge badge-secondary px-2 py-1').text('Sin Iniciar');
            $('#btnIniciarTurno').show();
            $('#btnFinalizarTurno').hide();
            $('#btnReabrirTurno').hide();
            $('#seccionFormularioCaptura').hide();
        } else if (data.turnoActual.estatus === 'abierto') {
            $('#badgeTurnoEstado').removeClass().addClass('badge badge-success px-2 py-1').text('Turno Abierto');
            $('#btnIniciarTurno').hide();
            $('#btnFinalizarTurno').show();
            $('#btnReabrirTurno').hide();
            $('#seccionFormularioCaptura').show();
            $('#inputTurnoLegajoId').val(data.turnoActual.id);
        } else {
            $('#badgeTurnoEstado').removeClass().addClass('badge badge-danger px-2 py-1').text('Turno Finalizado');
            $('#btnIniciarTurno').hide();
            $('#btnFinalizarTurno').hide();
            $('#btnReabrirTurno').show();
            $('#seccionFormularioCaptura').hide();
        }

        // KPIs
        $('#kpiVolumenes').text(data.totalVolumenes.toLocaleString());
        $('#kpiHojas').text(data.totalHojas.toLocaleString());
        $('#kpiEmpleados').text(data.totalEmpleados);
        $('#kpiFinalizados').text(`${data.totalFinalizados} Fin.`);
        $('#kpiEnProceso').text(`${data.totalEnProceso} Proc.`);
        $('#kpiPendientes').text(`${data.totalPendientes} Pend.`);
        $('#footerTotalHojas').text(data.totalHojas.toLocaleString());

        // Llenar selects de empleados y delegaciones
        const $selectEmpReg = $('#selectEmpleadoRegistro').empty().append('<option value="">-- Seleccionar Empleado --</option>');
        const $selectEmpMod = $('#selectEmpleadoModal').empty().append('<option value="">-- Seleccionar Empleado --</option>');
        data.empleados.forEach(emp => {
            $selectEmpReg.append(`<option value="${emp.id}">${emp.name}</option>`);
            $selectEmpMod.append(`<option value="${emp.id}">${emp.name}</option>`);
        });

        const $selectDelReg = $('#inputDelegacionId').empty().append('<option value="">-- Seleccionar --</option>');
        const $selectDelMod = $('#editDelegacionId').empty().append('<option value="">-- Sin Delegación --</option>');
        data.delegaciones.forEach(del => {
            $selectDelReg.append(`<option value="${del.id}">${del.nombre}</option>`);
            $selectDelMod.append(`<option value="${del.id}">${del.nombre}</option>`);
        });

        // Tabla Principal
        const $tbody = $('#tbodyLegajos').empty();
        const esTurnoAbierto = data.turnoActual && data.turnoActual.estatus === 'abierto';

        if (data.registros.length === 0) {
            $tbody.append(`
                <tr>
                    <td colspan="8" class="text-center text-muted py-4">
                        <i class="mdi mdi-folder-open-outline" style="font-size: 28px;"></i>
                        <p class="mb-0 mt-1">No hay registros de legajos para este día.</p>
                    </td>
                </tr>
            `);
        } else {
            data.registros.forEach(reg => {
                let claseEstado = 'celda-estado-proceso';
                if (reg.estado === 'finalizado') claseEstado = 'celda-estado-finalizado';
                else if (reg.estado === 'pendiente') claseEstado = 'celda-estado-pendiente';

                let usuariosHtml = '';
                if (reg.usuarios && reg.usuarios.length > 1) {
                    usuariosHtml = '<div class="d-flex flex-column">';
                    reg.usuarios.forEach(u => {
                        usuariosHtml += `<span class="badge badge-light border text-left text-dark px-1 py-0 mb-1" style="font-size: 0.8rem; font-weight: 600;"><i class="mdi mdi-account-circle text-primary"></i> ${u.usuario_nombre}</span>`;
                    });
                    usuariosHtml += '</div>';
                } else {
                    usuariosHtml = `<span>${reg.empleado_nombre || '-'}</span>`;
                }

                let accionesHtml = '';
                if (esTurnoAbierto) {
                    const btnCheckClass = reg.estado === 'finalizado' ? 'btn-success text-white' : 'btn-outline-success';
                    accionesHtml = `
                        <button type="button" class="btn btn-xs ${btnCheckClass} py-0 px-2 btn-marcar-finalizado" data-id="${reg.id}" data-nombre="${reg.empleado_nombre}" data-volumen="${reg.volumen}" title="Marcar finalizado">
                            <i class="mdi mdi-check-bold"></i>
                        </button>
                        <button type="button" class="btn btn-xs btn-outline-primary py-0 px-2 btn-editar ml-1" data-id="${reg.id}" title="Editar">
                            <i class="mdi mdi-pencil"></i>
                        </button>
                        <button type="button" class="btn btn-xs btn-outline-danger py-0 px-2 btn-eliminar ml-1" data-id="${reg.id}" data-nombre="${reg.empleado_nombre}" data-volumen="${reg.volumen}" title="Eliminar">
                            <i class="mdi mdi-trash-can"></i>
                        </button>
                    `;
                } else {
                    accionesHtml = `<span class="text-muted" style="font-size: 0.75rem;">Solo lectura</span>`;
                }

                $tbody.append(`
                    <tr id="fila-${reg.id}">
                        <td class="font-weight-bold text-dark">${usuariosHtml}</td>
                        <td class="text-secondary font-weight-bold">${reg.delegacion_nombre || '-'}</td>
                        <td class="text-center font-weight-bold">${reg.volumen}</td>
                        <td class="text-center">${reg.legajos_iniciales || '-'}</td>
                        <td class="text-center">${reg.legajos_finales || '-'}</td>
                        <td class="text-right font-weight-bold">${reg.numero_hojas > 0 ? Number(reg.numero_hojas).toLocaleString() : ''}</td>
                        <td class="${claseEstado}">${reg.estado}</td>
                        <td class="text-center" style="white-space: nowrap;">${accionesHtml}</td>
                    </tr>
                `);
            });
        }

        // Historial
        const $tbodyHist = $('#tbodyHistorico').empty();
        if (data.historicoTurnos.length === 0) {
            $tbodyHist.append('<tr><td colspan="6" class="text-center text-muted py-2">Sin historial disponible.</td></tr>');
        } else {
            data.historicoTurnos.forEach(h => {
                const badgeStatus = h.estatus === 'finalizado' ? '<span class="badge badge-danger">Finalizado</span>' : '<span class="badge badge-success">Abierto</span>';
                $tbodyHist.append(`
                    <tr>
                        <td class="font-weight-bold">${h.fecha}</td>
                        <td class="text-center">${badgeStatus}</td>
                        <td class="text-right font-weight-bold">${h.total_carpetas}</td>
                        <td class="text-right text-primary font-weight-bold">${Number(h.total_hojas).toLocaleString()}</td>
                        <td>${h.finalizado_en || '-'}</td>
                        <td class="text-center">
                            <button type="button" class="btn btn-xs btn-outline-info py-0 px-2 btn-ver-turno-hist" data-fecha="${h.fecha}">
                                <i class="mdi mdi-eye"></i> Ver
                            </button>
                        </td>
                    </tr>
                `);
            });
        }
    }

    // Eventos de selección de empleados (chips acumulados)
    $('#selectEmpleadoRegistro').on('change', function () {
        const id = $(this).val();
        const nombre = $(this).find('option:selected').text();
        if (id) {
            agregarChipUsuario($('#contenedorUsuariosRegistro'), id, nombre);
            $(this).val('');
        }
    });

    $('#selectEmpleadoModal').on('change', function () {
        const id = $(this).val();
        const nombre = $(this).find('option:selected').text();
        if (id) {
            agregarChipUsuario($('#contenedorUsuariosModal'), id, nombre);
            $(this).val('');
        }
    });

    $(document).on('click', '.btn-quitar-usuario', function () {
        $(this).closest('.chip-usuario').remove();
    });

    // Eventos de Fecha y Turnos
    $('#inputFechaTurno').on('change', function () {
        cargarEstado($(this).val());
    });

    $('#btnRecargar').on('click', function () {
        cargarEstado($('#inputFechaTurno').val());
    });

    $(document).on('click', '.btn-ver-turno-hist', function () {
        const fecha = $(this).data('fecha');
        cargarEstado(fecha);
    });

    // Iniciar Turno
    $('#btnIniciarTurno').on('click', async function () {
        const fechaVal = $('#inputFechaTurno').val();
        const confirm = await Swal.fire({
            title: '¿Iniciar Turno del Día?',
            text: `Se iniciará la jornada para la fecha ${fechaVal}`,
            icon: 'question',
            showCancelButton: true,
            confirmButtonColor: '#28a745',
            cancelButtonColor: '#6c757d',
            confirmButtonText: 'Sí, Iniciar Turno',
            cancelButtonText: 'Cancelar'
        });

        if (confirm.isConfirmed) {
            const res = await window.api.iniciarTurno(fechaVal);
            if (res.success) {
                Swal.fire({ icon: 'success', title: 'Turno Iniciado', text: res.message, timer: 1200, showConfirmButton: false });
                cargarEstado(fechaVal);
            } else {
                Swal.fire({ icon: 'error', title: 'Error', text: res.message });
            }
        }
    });

    // Finalizar Turno
    $('#btnFinalizarTurno').on('click', async function () {
        if (!estadoGlobal || !estadoGlobal.turnoActual) return;
        const confirm = await Swal.fire({
            title: '¿Finalizar Turno del Día?',
            text: 'Los registros que no hayan finalizado pasarán automáticamente a estado pendiente.',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            cancelButtonColor: '#6c757d',
            confirmButtonText: 'Sí, Finalizar Turno',
            cancelButtonText: 'Cancelar'
        });

        if (confirm.isConfirmed) {
            const res = await window.api.finalizarTurno(estadoGlobal.turnoActual.id);
            if (res.success) {
                Swal.fire({ icon: 'success', title: 'Turno Finalizado', text: res.message, timer: 1200, showConfirmButton: false });
                cargarEstado($('#inputFechaTurno').val());
            } else {
                Swal.fire({ icon: 'error', title: 'Error', text: res.message });
            }
        }
    });

    // Reabrir Turno
    $('#btnReabrirTurno').on('click', async function () {
        if (!estadoGlobal || !estadoGlobal.turnoActual) return;
        const confirm = await Swal.fire({
            title: '¿Reabrir Turno?',
            text: 'El turno volverá a estar abierto para edición.',
            icon: 'question',
            showCancelButton: true,
            confirmButtonColor: '#f0ad4e',
            cancelButtonColor: '#6c757d',
            confirmButtonText: 'Sí, Reabrir',
            cancelButtonText: 'Cancelar'
        });

        if (confirm.isConfirmed) {
            const res = await window.api.reabrirTurno(estadoGlobal.turnoActual.id);
            if (res.success) {
                Swal.fire({ icon: 'success', title: 'Turno Reabierto', text: res.message, timer: 1000, showConfirmButton: false });
                cargarEstado($('#inputFechaTurno').val());
            } else {
                Swal.fire({ icon: 'error', title: 'Error', text: res.message });
            }
        }
    });

    // Guardar nuevo registro
    $('#formNuevoLegajo').on('submit', async function (e) {
        e.preventDefault();
        const uIds = [];
        $('#contenedorUsuariosRegistro input[name="usuario_ids[]"]').each(function () {
            uIds.push($(this).val());
        });

        if (uIds.length === 0) {
            Swal.fire({ icon: 'warning', title: 'Empleado requerido', text: 'Debes seleccionar al menos un empleado.' });
            return;
        }

        const datos = {
            turno_legajo_id: $('#inputTurnoLegajoId').val(),
            usuario_ids: uIds,
            delegacion_id: $('#inputDelegacionId').val(),
            volumen: $('#inputVolumen').val(),
            legajos_iniciales: $('#inputLegajosIniciales').val(),
            legajos_finales: $('#inputLegajosFinales').val(),
            numero_hojas: $('#inputNumeroHojas').val(),
            estado: $('#selectEstado').val()
        };

        const res = await window.api.guardarRegistro(datos);
        if (res.success) {
            $('#contenedorUsuariosRegistro').empty();
            $('#selectEmpleadoRegistro').val('');
            $('#inputVolumen').val('');
            $('#inputLegajosIniciales').val('');
            $('#inputLegajosFinales').val('');
            $('#inputNumeroHojas').val('');
            Swal.fire({ icon: 'success', title: 'Guardado', text: res.message, timer: 900, showConfirmButton: false });
            cargarEstado($('#inputFechaTurno').val());
        } else {
            Swal.fire({ icon: 'error', title: 'Error', text: res.message });
        }
    });

    // Marcar como Finalizado
    $(document).on('click', '.btn-marcar-finalizado', async function () {
        const id = $(this).data('id');
        const nombre = $(this).data('nombre');
        const volumen = $(this).data('volumen');
        const esFinalizado = $(this).hasClass('btn-success');

        const titulo = esFinalizado ? '¿Cambiar a en proceso?' : '¿Marcar como finalizado?';
        const texto = esFinalizado
            ? `El legajo de ${nombre} (Vol. ${volumen}) volverá a estar en proceso.`
            : `¿Confirmas que el legajo de ${nombre} (Vol. ${volumen}) ha finalizado?`;
        const confirmBtn = esFinalizado ? 'Sí, pasar a en proceso' : 'Sí, marcar como finalizado';
        const btnColor = esFinalizado ? '#f0ad4e' : '#28a745';

        const confirm = await Swal.fire({
            title: titulo,
            text: texto,
            icon: 'question',
            showCancelButton: true,
            confirmButtonColor: btnColor,
            cancelButtonColor: '#6c757d',
            confirmButtonText: confirmBtn,
            cancelButtonText: 'Cancelar'
        });

        if (confirm.isConfirmed) {
            const res = await window.api.marcarFinalizado(id);
            if (res.success) {
                Swal.fire({ icon: 'success', title: 'Estado actualizado', text: res.message, timer: 800, showConfirmButton: false });
                cargarEstado($('#inputFechaTurno').val());
            } else {
                Swal.fire({ icon: 'error', title: 'Error', text: res.message });
            }
        }
    });

    // Abrir modal de edición
    $(document).on('click', '.btn-editar', function () {
        const id = $(this).data('id');
        const reg = estadoGlobal.registros.find(r => r.id === id);
        if (!reg) return;

        $('#editId').val(reg.id);
        $('#contenedorUsuariosModal').empty();
        $('#selectEmpleadoModal').val('');

        if (reg.usuarios && reg.usuarios.length > 0) {
            reg.usuarios.forEach(u => {
                agregarChipUsuario($('#contenedorUsuariosModal'), u.usuario_id, u.usuario_nombre);
            });
        }

        $('#editDelegacionId').val(reg.delegacion_id || '');
        $('#editVolumen').val(reg.volumen);
        $('#editIniciales').val(reg.legajos_iniciales || '');
        $('#editFinales').val(reg.legajos_finales || '');
        $('#editHojas').val(reg.numero_hojas || 0);
        $('#editEstado').val(reg.estado);

        abrirModalEdicion();
    });

    // Cerrar modal
    $(document).on('click', '.btn-cerrar-modal', cerrarModalEdicion);
    $(document).on('click', '#modalEditarRegistro', function (e) {
        if ($(e.target).is('#modalEditarRegistro')) cerrarModalEdicion();
    });

    // Guardar edición
    $('#formEditarLegajo').on('submit', async function (e) {
        e.preventDefault();
        const id = $('#editId').val();
        const uIds = [];
        $('#contenedorUsuariosModal input[name="usuario_ids[]"]').each(function () {
            uIds.push($(this).val());
        });

        if (uIds.length === 0) {
            Swal.fire({ icon: 'warning', title: 'Empleado requerido', text: 'Debes seleccionar al menos un empleado.' });
            return;
        }

        const datos = {
            usuario_ids: uIds,
            delegacion_id: $('#editDelegacionId').val(),
            volumen: $('#editVolumen').val(),
            legajos_iniciales: $('#editIniciales').val(),
            legajos_finales: $('#editFinales').val(),
            numero_hojas: $('#editHojas').val(),
            estado: $('#editEstado').val()
        };

        const res = await window.api.actualizarRegistro(id, datos);
        if (res.success) {
            cerrarModalEdicion();
            Swal.fire({ icon: 'success', title: 'Actualizado', text: res.message, timer: 900, showConfirmButton: false });
            cargarEstado($('#inputFechaTurno').val());
        } else {
            Swal.fire({ icon: 'error', title: 'Error', text: res.message });
        }
    });

    // Eliminar registro
    $(document).on('click', '.btn-eliminar', async function () {
        const id = $(this).data('id');
        const nombre = $(this).data('nombre');
        const volumen = $(this).data('volumen');

        const confirm = await Swal.fire({
            title: '¿Eliminar registro?',
            text: `Se eliminará el legajo de ${nombre} (Vol. ${volumen})`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            cancelButtonColor: '#6c757d',
            confirmButtonText: 'Sí, eliminar',
            cancelButtonText: 'Cancelar'
        });

        if (confirm.isConfirmed) {
            const res = await window.api.eliminarRegistro(id);
            if (res.success) {
                Swal.fire({ icon: 'success', title: 'Eliminado', text: res.message, timer: 800, showConfirmButton: false });
                cargarEstado($('#inputFechaTurno').val());
            } else {
                Swal.fire({ icon: 'error', title: 'Error', text: res.message });
            }
        }
    });

    // Exportar a Excel
    $('#btnExportarExcel').on('click', async function () {
        if (!estadoGlobal || !estadoGlobal.turnoActual) {
            Swal.fire({ icon: 'info', title: 'Sin turno', text: 'No hay turno activo para exportar.' });
            return;
        }

        const btn = $(this);
        btn.prop('disabled', true).html('<i class="mdi mdi-spin mdi-loading"></i> Exportando...');

        try {
            const res = await window.api.exportarExcel(estadoGlobal.turnoActual.id);
            btn.prop('disabled', false).html('<i class="mdi mdi-file-excel-box"></i> Exportar a Excel');

            if (res.success) {
                Swal.fire({ icon: 'success', title: 'Exportado', text: res.message });
            }
        } catch (err) {
            btn.prop('disabled', false).html('<i class="mdi mdi-file-excel-box"></i> Exportar a Excel');
            Swal.fire({ icon: 'error', title: 'Error al exportar', text: err.message });
        }
    });

    // Inicializar cargando el día actual
    cargarEstado();
});