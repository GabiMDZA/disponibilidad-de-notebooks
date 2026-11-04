class Catalogo {
    constructor(contenedorId) {
        this.contenedor = document.getElementById(contenedorId);
        this.notebooks = [];                              // array de objetos Notebook
        this.filtros = { color: '', estado: '', programa: '', texto: '' };
        this.seleccionadas = new Set();                   // ids de las notebooks marcadas para elegir
        this.puedeElegir = false;                         // true solo pa profesor y admin
        this.alCambiarSeleccion = null;                   // funcion que avisa cuando cambia la selección
    }

    // Pide las notebooks a la API y las convierte en objetos Notebook
    async cargar() {
        const respuesta = await fetch('/api/notebooks');
        if (!respuesta.ok) throw new Error('No se pudo leer el catálogo');
        const datos = await respuesta.json();
        this.notebooks = datos.map(d => new Notebook(d));

        // Si una notebook marcada ya no está libre, se saca de la selección
        this.seleccionadas.forEach(id => {
            const n = this.notebooks.find(x => x.id === id);
            if (!n || !n.estaLibre()) this.seleccionadas.delete(id);
        });
        this.renderizar();
    }

    setFiltro(nombre, valor) {
        this.filtros[nombre] = valor;
        this.renderizar();
    }

    // Cantidad de notebooks por estado (para las tarjetas de resumen)
    contar() {
        const c = { total: this.notebooks.length, libre: 0, ocupada: 0, en_reparacion: 0 };
        this.notebooks.forEach(n => c[n.estado]++);
        return c;
    }

    notebooksFiltradas() {
        const { color, estado, programa, texto } = this.filtros;
        return this.notebooks.filter(n =>
            (!color || n.color === color) &&
            (!estado || n.estado === estado) &&
            (!programa || n.tienePrograma(programa)) &&
            (!texto || n.coincideCon(texto))
        );
    }

    // Dibuja las tarjetas en el DOM
    renderizar() {
        this.contenedor.innerHTML = '';
        const lista = this.notebooksFiltradas();

        if (lista.length === 0) {
            const vacio = document.createElement('p');
            vacio.classList.add('vacio');
            vacio.textContent = 'No hay notebooks con esos filtros. Probá cambiarlos.';
            this.contenedor.appendChild(vacio);
        }

        lista.forEach(n => {
            const tarjeta = n.generarHTML();
            // Solo se pueden marcar las libres, y solo si el rol puede elegir
            if (this.puedeElegir && n.estaLibre()) {
                tarjeta.classList.add('elegible');
                tarjeta.classList.toggle('seleccionada', this.seleccionadas.has(n.id));
                tarjeta.addEventListener('click', () => this.alternar(n.id));
            }
            this.contenedor.appendChild(tarjeta);
        });

        if (this.alCambiarSeleccion) this.alCambiarSeleccion();
    }

    alternar(id) {
        if (this.seleccionadas.has(id)) this.seleccionadas.delete(id);
        else this.seleccionadas.add(id);
        this.renderizar();
    }

    // Elige las notebooks marcadas, de a una (la API recibe una por pedido)
    async elegirSeleccionadas(usuarioId) {
        let elegidas = 0;
        const errores = [];

        for (const id of this.seleccionadas) {
            const n = this.notebooks.find(x => x.id === id);
            try {
                const respuesta = await fetch('/api/elegir', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ usuario_id: usuarioId, notebook_id: id })
                });
                const data = await respuesta.json();
                if (respuesta.ok) elegidas++;
                else errores.push('Notebook ' + n.numero + ': ' + data.error);
            } catch (error) {
                errores.push('Notebook ' + n.numero + ': no se pudo conectar con el servidor');
            }
        }
        this.seleccionadas.clear();
        return { elegidas, errores };
    }
}