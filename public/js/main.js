// acá hay bom leemos la sesión guardada; si no hay, volvemos al login
const usuario = Usuario.desdeSesion();
if (!usuario) {
    location.replace('index.html');
}

document.addEventListener('DOMContentLoaded', async () => {
    if (!usuario) return;
    const $ = (id) => document.getElementById(id);
    const catalogo = new Catalogo('catalogo');
    let misNotebooks = [];   // notebooks que tiene el usuario ahora

    function avisar(texto, tipo) {
        $('mensaje').textContent = texto;
        $('mensaje').className = 'mensaje ' + tipo;
    }

    // Cambia entre "Panel principal" y "Notebooks"
    function mostrarVista(nombre) {
        $('vista-panel').hidden = nombre !== 'panel';
        $('vista-notebooks').hidden = nombre !== 'notebooks';
        document.querySelectorAll('[data-vista]').forEach(b => b.classList.toggle('activo', b.dataset.vista === nombre));
        $('mensaje').textContent = '';
    }
    document.querySelectorAll('[data-vista]').forEach(b => b.addEventListener('click', () => mostrarVista(b.dataset.vista)));
    document.querySelectorAll('[data-ir]').forEach(b => b.addEventListener('click', () => mostrarVista(b.dataset.ir)));
    $('btn-ir-catalogo').addEventListener('click', () => mostrarVista('notebooks'));
    // links a otras páginas (el de admin solo lo ve el admin)
    $('menu-admin').hidden = !usuario.esAdmin();
    document.querySelectorAll('[data-pagina]').forEach(b => b.addEventListener('click', () => { location.href = b.dataset.pagina; }));

    //encabezado y saludo
    const roles = { estudiante: 'Estudiante', profesor: 'Profesor/a', admin: 'Administrador/a' };
    $('usuario-nombre').textContent = usuario.nombreCompleto();
    $('usuario-rol').textContent = roles[usuario.rol];
    $('avatar').textContent = usuario.nombre.charAt(0).toUpperCase();
    $('salir').addEventListener('click', () => {
        Usuario.cerrarSesion();
        location.replace('index.html');
    });

    const hora = new Date().getHours();
    $('saludo').textContent = (hora < 12 ? 'Buen día, ' : hora < 20 ? 'Buenas tardes, ' : 'Buenas noches, ') + usuario.nombre;
    const fecha = new Date().toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' });
    $('fecha').textContent = fecha.charAt(0).toUpperCase() + fecha.slice(1) + ' · Resumen de disponibilidad de las notebooks';

    // Solo profesores y admin pueden elegir
    catalogo.puedeElegir = usuario.puedeElegir();
    $('btn-ir-catalogo').hidden = !usuario.puedeElegir();
    $('ayuda-catalogo').textContent = usuario.puedeElegir()
        ? 'Tocá las notebooks disponibles que necesitás y apretá "Elegir".'
        : 'Podés consultar la disponibilidad y los programas de cada notebook.';
    //panel principal
    function fila(titulo, detalle, boton) {
        const div = document.createElement('div');
        div.classList.add('fila-dato');
        const texto = document.createElement('div');
        const t = document.createElement('strong');
        t.textContent = titulo;
        const d = document.createElement('small');
        d.textContent = detalle;
        texto.append(t, d);
        div.appendChild(texto);
        if (boton) div.appendChild(boton);
        return div;
    }

    function actualizarPanel() {
        const c = catalogo.contar();
        $('stat-libres').textContent = c.libre;
        $('sub-libres').textContent = 'de ' + c.total + ' notebooks';
        $('stat-ocupadas').textContent = c.ocupada;
        $('sub-ocupadas').textContent = misNotebooks.length + ' a tu nombre';
        $('stat-reparacion').textContent = c.en_reparacion;
        $('stat-mias').textContent = misNotebooks.length;
        $('sub-mias').textContent = misNotebooks.length > 0 ? 'devolvelas cuando termines' : 'todavía no elegiste ninguna';

        // Catálogo: resumen y chips
        $('resumen-catalogo').textContent = c.total + ' notebooks registradas · ' + c.libre + ' disponibles en este momento';
        document.querySelector('.chip[data-estado="libre"]').textContent = c.libre + ' disponibles';
        document.querySelector('.chip[data-estado="ocupada"]').textContent = c.ocupada + ' ocupadas';
        document.querySelector('.chip[data-estado="en_reparacion"]').textContent = c.en_reparacion + ' en reparación';

        // Tus notebooks (con botón Devolver)
        const lista = $('lista-mias');
        lista.innerHTML = '';
        if (misNotebooks.length === 0) {
            const vacio = document.createElement('p');
            vacio.classList.add('vacio');
            vacio.textContent = 'No tenés notebooks en tu poder.';
            lista.appendChild(vacio);
        }
        misNotebooks.forEach(m => {
            const boton = document.createElement('button');
            boton.type = 'button';
            boton.classList.add('boton');
            boton.textContent = 'Devolver';
            boton.addEventListener('click', () => devolver(m));
            const retiro = new Date(m.fecha_retiro).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' });
            lista.appendChild(fila('Notebook ' + m.numero + ' · ' + m.color, 'Retirada el ' + retiro, boton));
        });

        // Equipo recomendado: la primera blanca disponible (o cualquier disponible)
        const libres = catalogo.notebooks.filter(n => n.estaLibre());
        const recomendada = libres.find(n => n.esBlanca()) || libres[0];
        $('recomendado').innerHTML = '';
        if (recomendada) {
            $('recomendado').appendChild(recomendada.generarHTML());
        } else {
            const vacio = document.createElement('p');
            vacio.classList.add('vacio');
            vacio.textContent = 'No hay notebooks disponibles en este momento.';
            $('recomendado').appendChild(vacio);
        }

        // Disponibles por tipo
        const blancas = libres.filter(n => n.esBlanca()).length;
        $('tipo-lista').innerHTML = '';
        $('tipo-lista').append(
            fila('Blancas', 'Alto rendimiento', Object.assign(document.createElement('strong'), { textContent: blancas + ' disponibles' })),
            fila('Negras', 'Rendimiento básico', Object.assign(document.createElement('strong'), { textContent: (libres.length - blancas) + ' disponibles' }))
        );
    }

    async function cargarMisNotebooks() {
        const respuesta = await fetch('/api/mis-notebooks/' + usuario.id);
        misNotebooks = respuesta.ok ? await respuesta.json() : [];
    }

    async function recargar() {
        try {
            await catalogo.cargar();
            await cargarMisNotebooks();
            actualizarPanel();
        } catch (error) {
            avisar(error.message + '. Revisá que el servidor esté encendido.', 'error');
        }
    }

    async function devolver(m) {
        if (!confirm('¿Devolver la notebook ' + m.numero + '?')) return;
        try {
            const respuesta = await fetch('/api/devolver', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ usuario_id: usuario.id, notebook_id: m.id })
            });
            const data = await respuesta.json();
            avisar(respuesta.ok ? 'Devolviste la notebook ' + m.numero + '.' : data.error, respuesta.ok ? 'ok' : 'error');
        } catch (error) {
            avisar('No se pudo conectar con el servidor', 'error');
        }
        recargar();
    }

    catalogo.alCambiarSeleccion = () => {
        const n = catalogo.seleccionadas.size;
        $('barra-elegir').hidden = n === 0;
        $('cantidad').textContent = n + (n === 1 ? ' notebook seleccionada' : ' notebooks seleccionadas');
    };

    $('filtro-texto').addEventListener('input', (e) => catalogo.setFiltro('texto', e.target.value));
    ['estado', 'color', 'programa'].forEach(nombre => {
        $('filtro-' + nombre).addEventListener('change', (e) => {
            catalogo.setFiltro(nombre, e.target.value);
            marcarChips();
        });
    });

    // filtrados por estado.
    function marcarChips() {
        document.querySelectorAll('.chip').forEach(c => c.classList.toggle('activo', c.dataset.estado === catalogo.filtros.estado));
    }
    document.querySelectorAll('.chip').forEach(chip => {
        chip.addEventListener('click', () => {
            const nuevo = catalogo.filtros.estado === chip.dataset.estado ? '' : chip.dataset.estado;
            $('filtro-estado').value = nuevo;
            catalogo.setFiltro('estado', nuevo);
            marcarChips();
        });
    });

    try {
        const programas = await (await fetch('/api/programas')).json();
        programas.forEach(p => {
            const opcion = document.createElement('option');
            opcion.value = p.nombre;
            opcion.textContent = p.nombre;
            $('filtro-programa').appendChild(opcion);
        });
    } catch (error) {
        console.error('No se pudieron cargar los programas', error);
    }

    $('btn-elegir').addEventListener('click', async () => {
        const n = catalogo.seleccionadas.size;
        if (!confirm('¿Elegir ' + n + (n === 1 ? ' notebook?' : ' notebooks?'))) return;

        $('btn-elegir').disabled = true;
        const { elegidas, errores } = await catalogo.elegirSeleccionadas(usuario.id);
        $('btn-elegir').disabled = false;

        if (errores.length === 0) avisar('Listo: elegiste ' + elegidas + (elegidas === 1 ? ' notebook.' : ' notebooks.'), 'ok');
        else avisar(errores.join(' · '), 'error');
        recargar();
    });

    recargar();
});