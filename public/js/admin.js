// Validación con BOM: si no hay sesión o no es admin, se lo patea al dashboard
const usuario = Usuario.desdeSesion();
if (!usuario || !usuario.esAdmin()) {
    location.replace('dashboard.html');
}

document.addEventListener('DOMContentLoaded', () => {
    const $ = (id) => document.getElementById(id);
    $('usuario-admin').textContent = usuario.nombreCompleto();
    $('salir').addEventListener('click', () => { Usuario.cerrarSesion(); location.replace('index.html'); });

    function avisar(texto, tipo) {
        $('mensaje').textContent = texto;
        $('mensaje').className = 'mensaje ' + tipo;
    }

    // Cambio de pestañas en el panel
    document.querySelectorAll('.enlace-menu').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.enlace-menu').forEach(b => b.classList.remove('activo'));
            document.querySelectorAll('.seccion-admin').forEach(s => s.hidden = true);
            btn.classList.add('activo');
            const sec = btn.dataset.seccion;
            $('sec-' + sec).hidden = false;
            $('titulo-seccion').textContent = btn.textContent;
            cargarSeccion(sec);
        });
    });

    async function cargarSeccion(sec) {
        if (sec === 'reportes') cargarReportes();
        if (sec === 'prestamos') cargarPrestamos();
        if (sec === 'notebooks') cargarNotebooksAdmin();
        if (sec === 'usuarios') cargarUsuarios();
        if (sec === 'programas') cargarProgramas();
    }
    // Fin de cambio de pestañas
    // 1. Reportes Pendientes
    async function cargarReportes() {
        const contenedor = $('lista-reportes');
        contenedor.innerHTML = '<p>Cargando...</p>';
        try {
            const res = await fetch(`/api/reportes/pendientes?usuario_id=${usuario.id}`);
            const data = await res.json();
            contenedor.innerHTML = '';
            if (data.length === 0) { contenedor.innerHTML = '<p>No hay reportes pendientes.</p>'; return; }

            data.forEach(r => {
                const div = document.createElement('div');
                div.className = 'tarjeta-admin-item';
                const info = document.createElement('div');
                const titulo = document.createElement('strong');
                titulo.textContent = 'Notebook ' + r.notebook_numero + ' (' + r.reportado_por + ')';
                const desc = document.createElement('p');
                desc.textContent = r.descripcion;
                const fecha = document.createElement('small');
                fecha.textContent = new Date(r.fecha).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' });
                info.append(titulo, desc, fecha);
                div.appendChild(info);

                const btnAprobar = document.createElement('button');
                btnAprobar.className = 'boton'; btnAprobar.textContent = 'Aprobar';
                btnAprobar.onclick = () => cambiarEstadoReporte(r.id, 'aprobado');

                const btnRechazar = document.createElement('button');
                btnRechazar.className = 'boton'; btnRechazar.style.background = 'var(--error)'; btnRechazar.textContent = 'Rechazar';
                btnRechazar.onclick = () => cambiarEstadoReporte(r.id, 'rechazado');

                const acciones = document.createElement('div');
                acciones.style.display = 'flex'; acciones.style.gap = '8px';
                acciones.append(btnAprobar, btnRechazar);
                div.appendChild(acciones);
                contenedor.appendChild(div);
            });
        } catch (e) { avisar('Error al cargar reportes', 'error'); }
    }

    async function cambiarEstadoReporte(id, estado) {
        const res = await fetch(`/api/reportes/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ usuario_id: usuario.id, estado })
        });
        if (res.ok) { avisar('Reporte actualizado', 'ok'); cargarReportes(); }
        else { avisar('No se pudo actualizar', 'error'); }
    }

    // 2. Préstamos Activos
    async function cargarPrestamos() {
        const tbody = $('tabla-prestamos-body');
        tbody.innerHTML = '<tr><td colspan="3">Cargando...</td></tr>';
        try {
            const res = await fetch(`/api/admin/prestamos?usuario_id=${usuario.id}`);
            const data = await res.json();
            tbody.innerHTML = '';
            if (data.length === 0) { tbody.innerHTML = '<tr><td colspan="4">No hay préstamos activos.</td></tr>'; return; }
            data.forEach(p => {
                const tr = document.createElement('tr');
                [
                    'Notebook ' + p.notebook_numero + ' · ' + p.color,
                    p.usuario,
                    p.rol,
                ].forEach(texto => {
                    const td = document.createElement('td');
                    td.textContent = texto;
                    tr.appendChild(td);
                });
                tbody.appendChild(tr);
            });
        } catch (e) { avisar('Error al cargar préstamos', 'error'); }
    }

    // 3. Notebooks Admin
    async function cargarNotebooksAdmin() {
        const contenedor = $('lista-notebooks-admin');
        contenedor.innerHTML = '<p>Cargando...</p>';
        try {
            const res = await fetch('/api/notebooks');
            const data = await res.json();
            contenedor.innerHTML = '';
            data.forEach(n => {
                const div = document.createElement('div');
                div.className = 'tarjeta-admin-item';
                div.innerHTML = `<div><strong>NB-${n.numero}</strong> (${n.color}) - <span class="insignia">${n.estado}</span></div>`;

                const btnRep = document.createElement('button');
                btnRep.className = 'boton'; btnRep.textContent = n.estado === 'en_reparacion' ? 'Poner Libre' : 'Reparación';
                btnRep.onclick = async () => {
                    const nuevoEstado = n.estado === 'en_reparacion' ? 'libre' : 'en_reparacion';
                    await fetch(`/api/admin/notebooks/${n.id}/estado`, {
                        method: 'PUT', headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ usuario_id: usuario.id, estado: nuevoEstado })
                    });
                    cargarNotebooksAdmin();
                };

                const btnDel = document.createElement('button');
                btnDel.className = 'boton'; btnDel.style.background = 'var(--error)'; btnDel.textContent = 'Eliminar';
                btnDel.onclick = async () => {
                    if (!confirm(`¿Borrar notebook ${n.numero}?`)) return;
                    await fetch(`/api/admin/notebooks/${n.id}?usuario_id=${usuario.id}`, { method: 'DELETE' });
                    cargarNotebooksAdmin();
                };

                const acciones = document.createElement('div');
                acciones.style.display = 'flex'; acciones.style.gap = '8px';
                acciones.append(btnRep, btnDel);
                div.appendChild(acciones);
                contenedor.appendChild(div);
            });
        } catch (e) { avisar('Error al cargar notebooks', 'error'); }
    }

    $('form-nueva-nb').onsubmit = async (e) => {
        e.preventDefault();
        const numero = $('nb-numero').value;
        const color = $('nb-color').value;
        const res = await fetch('/api/admin/notebooks', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ usuario_id: usuario.id, numero, color })
        });
        if (res.ok) { $('nb-numero').value = ''; avisar('Notebook creada', 'ok'); cargarNotebooksAdmin(); }
        else { avisar('Error al crear notebook', 'error'); }
    };

    // 4. Usuarios
    async function cargarUsuarios() {
        const tbody = $('tabla-usuarios-body');
        tbody.innerHTML = '<tr><td colspan="3">Cargando...</td></tr>';
        try {
            const res = await fetch(`/api/admin/usuarios?usuario_id=${usuario.id}`);
            const data = await res.json();
            tbody.innerHTML = '';
            data.forEach(u => {
                const tr = document.createElement('tr');
                tr.innerHTML = `<td>${u.nombre} ${u.apellido}</td><td>${u.dni}</td><td>
                    <select onchange="cambiarRol(${u.id}, this.value)">
                        <option value="estudiante" ${u.rol === 'estudiante' ? 'selected' : ''}>Estudiante</option>
                        <option value="profesor" ${u.rol === 'profesor' ? 'selected' : ''}>Profesor</option>
                        <option value="admin" ${u.rol === 'admin' ? 'selected' : ''}>Admin</option>
                    </select>
                </td><td></td>`;

                const tdAcciones = tr.querySelector('td:last-child');
                const btnPass = document.createElement('button');
                btnPass.className = 'enlace'; btnPass.textContent = 'Restablecer clave';
                btnPass.onclick = async () => {
                    const nueva = prompt('Nueva contraseña para ' + u.nombre + ':');
                    if (!nueva) return;
                    const r = await fetch(`/api/admin/usuarios/${u.id}/contrasena`, {
                        method: 'PUT', headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ usuario_id: usuario.id, contrasena: nueva })
                    });
                    if (r.ok) alert('Contraseña actualizada');
                };
                tdAcciones.appendChild(btnPass);
                
                // botón para eliminar (no te podes autoborrar)
                if (u.id !== usuario.id) {
                    const btnDel = document.createElement('button');
                    btnDel.className = 'enlace';
                    btnDel.style.color = 'var(--error)';
                    btnDel.style.marginLeft = '14px';
                    btnDel.textContent = 'Eliminar';
                    btnDel.onclick = async () => {
                        if (!confirm('¿Eliminar a ' + u.nombre + ' ' + u.apellido + '? Se borran también sus reportes y sus notebooks vuelven a quedar libres.')) return;
                        const r = await fetch(`/api/admin/usuarios/${u.id}?usuario_id=${usuario.id}`, { method: 'DELETE' });
                        avisar(r.ok ? 'Usuario eliminado' : 'No se pudo eliminar el usuario', r.ok ? 'ok' : 'error');
                        cargarUsuarios();
                    };
                    tdAcciones.appendChild(btnDel);
                }
                tbody.appendChild(tr);
            });
        } catch (e) { avisar('Error al cargar usuarios', 'error'); }
    }

    window.cambiarRol = async (id, nuevoRol) => {
        const res = await fetch(`/api/admin/usuarios/${id}/rol`, {
            method: 'PUT', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ usuario_id: usuario.id, rol: nuevoRol })
        });
        if (res.ok) avisar('Rol actualizado', 'ok');
        else avisar('No se pudo cambiar el rol', 'error');
    };

        // esto es pa los programas.
    let programaActual = null;   // programa que se está asignando

    async function cargarProgramas() {
        const contenedor = $('lista-programas');
        contenedor.innerHTML = '<p>Cargando...</p>';
        try {
            const res = await fetch('/api/programas');
            const data = await res.json();
            contenedor.innerHTML = '';
            if (data.length === 0) { contenedor.innerHTML = '<p>No hay programas cargados.</p>'; return; }

            data.forEach(p => {
                const div = document.createElement('div');
                div.className = 'tarjeta-admin-item';
                const nombre = document.createElement('strong');
                nombre.textContent = p.nombre;

                const btnAsignar = document.createElement('button');
                btnAsignar.className = 'boton'; btnAsignar.textContent = 'Asignar a notebooks';
                btnAsignar.onclick = () => abrirAsignacion(p);

                const btnDel = document.createElement('button');
                btnDel.className = 'boton'; btnDel.style.background = 'var(--error)'; btnDel.textContent = 'Eliminar';
                btnDel.onclick = async () => {
                    if (!confirm('¿Eliminar el programa ' + p.nombre + '? Se saca de todas las notebooks.')) return;
                    const r = await fetch(`/api/admin/programas/${p.id}?usuario_id=${usuario.id}`, { method: 'DELETE' });
                    avisar(r.ok ? 'Programa eliminado' : 'No se pudo eliminar el programa', r.ok ? 'ok' : 'error');
                    if (programaActual && programaActual.id === p.id) cerrarAsignacion();
                    cargarProgramas();
                };

                const acciones = document.createElement('div');
                acciones.style.display = 'flex'; acciones.style.gap = '8px';
                acciones.append(btnAsignar, btnDel);
                div.append(nombre, acciones);
                contenedor.appendChild(div);
            });
        } catch (e) { avisar('Error al cargar programas', 'error'); }
    }

    $('form-nuevo-programa').onsubmit = async (e) => {
        e.preventDefault();
        const res = await fetch('/api/admin/programas', {
            method: 'POST', headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ usuario_id: usuario.id, nombre: $('programa-nombre').value })
        });
        const data = await res.json();
        if (res.ok) { $('programa-nombre').value = ''; avisar('Programa creado', 'ok'); cargarProgramas(); }
        else { avisar(data.error, 'error'); }
    };

    // panel con una casilla por notebook; las marcadas son las que ya tienen el programa
    async function abrirAsignacion(programa) {
        programaActual = programa;
        $('asignar-titulo').textContent = 'Notebooks que tienen ' + programa.nombre;
        $('asignar-grilla').innerHTML = '<p>Cargando...</p>';
        $('panel-asignar').hidden = false;
        $('panel-asignar').scrollIntoView({ behavior: 'smooth' });
        try {
            const notebooks = await (await fetch('/api/notebooks')).json();
            const tienen = await (await fetch(`/api/admin/programas/${programa.id}/notebooks?usuario_id=${usuario.id}`)).json();
            $('asignar-grilla').innerHTML = '';
            notebooks.forEach(n => {
                const label = document.createElement('label');
                const check = document.createElement('input');
                check.type = 'checkbox';
                check.value = n.id;
                check.checked = tienen.includes(n.id);
                label.append(check, 'NB-' + n.numero + ' · ' + n.color);
                $('asignar-grilla').appendChild(label);
            });
        } catch (e) { avisar('Error al cargar las notebooks', 'error'); }
    }

    function cerrarAsignacion() {
        programaActual = null;
        $('panel-asignar').hidden = true;
    }
    $('asignar-cerrar').onclick = cerrarAsignacion;

    // si falta alguna por marcar, marca todas; si ya están todas, las desmarca
    $('asignar-todas').onclick = () => {
        const checks = Array.from(document.querySelectorAll('#asignar-grilla input'));
        const marcar = checks.some(c => !c.checked);
        checks.forEach(c => c.checked = marcar);
    };

    $('asignar-guardar').onclick = async () => {
        const ids = Array.from(document.querySelectorAll('#asignar-grilla input:checked')).map(c => Number(c.value));
        const res = await fetch(`/api/admin/programas/${programaActual.id}/notebooks`, {
            method: 'PUT', headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ usuario_id: usuario.id, notebook_ids: ids })
        });
        const data = await res.json();
        avisar(res.ok ? data.mensaje : data.error, res.ok ? 'ok' : 'error');
        if (res.ok) cerrarAsignacion();
    };

    // iniciar cargando la primera sección
    cargarReportes();
});