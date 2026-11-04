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
        tbody.innerHTML = '<tr><td colspan="4">Cargando...</td></tr>';
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
                    new Date(p.fecha_retiro).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })
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
        tbody.innerHTML = '<tr><td colspan="4">Cargando...</td></tr>';
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

    // Inicializar cargando la primera sección
    cargarReportes();
});