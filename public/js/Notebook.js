// eto es un icono
const ICONO_NOTEBOOK = '<svg viewBox="0 0 48 48" width="48" height="48" fill="none" stroke="#2f6aa3" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="11" width="30" height="20" rx="2"/><path d="M4 37h40"/></svg>';

class Notebook {
    // "datos" es un objeto tal como lo manda GET /api/notebooks
    constructor(datos) {
        this.id = datos.id;
        this.numero = datos.numero;
        this.color = datos.color;                 // 'blanca' o 'negra'
        this.estado = datos.estado;               // 'libre', 'ocupada' o 'en_reparacion'
        this.enPoderDe = datos.en_poder_de;       // nombre de quien la tiene (o null)
        // La API manda los programas y defectos como texto: los pasamos a arrays
        this.programas = datos.programas ? datos.programas.split(', ') : [];
        this.defectos = datos.defectos ? datos.defectos.split('; ') : [];
    }

    // consultas/metodos  
    estaLibre() {
        return this.estado === 'libre';
    }

    esBlanca() {
        return this.color === 'blanca';
    }

    tienePrograma(nombre) {
        return this.programas.includes(nombre);
    }

    textoEstado() {
        const textos = { libre: 'Disponible', ocupada: 'Ocupada', en_reparacion: 'En reparación' };
        return textos[this.estado];
    }

    // pal buscador, coincide con el número, el color, un programa o quien la tiene
    coincideCon(texto) {
        const t = texto.toLowerCase().trim();
        return ('notebook ' + this.numero).includes(t) ||
               this.color.includes(t) ||
               this.programas.some(p => p.toLowerCase().includes(t)) ||
               (this.enPoderDe || '').toLowerCase().includes(t);
    }

    // acá hay dom
    generarHTML() {
        const tarjeta = document.createElement('article');
        tarjeta.classList.add('notebook-card', 'estado-' + this.estado.replace('_', '-'));
        tarjeta.dataset.id = this.id;

        const icono = document.createElement('div');
        icono.classList.add('icono');
        icono.innerHTML = ICONO_NOTEBOOK;           // texto fijo, no viene de la base

        const titulo = document.createElement('h3');
        titulo.textContent = 'Notebook ' + this.numero;
        const insignia = document.createElement('span');
        insignia.classList.add('insignia');
        insignia.textContent = this.textoEstado();
        const fila = document.createElement('div');
        fila.classList.add('fila-titulo');
        fila.append(titulo, insignia);

        const detalle = document.createElement('p');
        detalle.classList.add('detalle');
        detalle.textContent = (this.esBlanca() ? 'Blanca · alto rendimiento' : 'Negra') +
                              (this.enPoderDe ? ' · En poder de ' + this.enPoderDe : '');

        const programas = document.createElement('p');
        programas.classList.add('programas');
        programas.textContent = this.programas.join(' · ');

        const info = document.createElement('div');
        info.classList.add('info');
        info.append(fila, detalle, programas);

        // aca hace q solo se muestren las fallas aprobadas por el admin.
        const tooltip = document.createElement('div');
        tooltip.classList.add('tooltip');
        tooltip.setAttribute('role', 'tooltip');
        if (this.defectos.length > 0) {
            const aviso = document.createElement('strong');
            aviso.textContent = 'Antes de elegirla:';
            const lista = document.createElement('ul');
            this.defectos.forEach(texto => {
                const item = document.createElement('li');
                item.textContent = texto;
                lista.appendChild(item);
            });
            tooltip.append(aviso, lista);
        } else {
            tooltip.textContent = 'Sin problemas reportados';
        }

        tarjeta.append(icono, info, tooltip);
        return tarjeta;
    }
}