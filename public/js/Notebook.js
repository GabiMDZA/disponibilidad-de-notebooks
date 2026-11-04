class Notebook {
    constructor(datos) {
        this.id = datos.id;
        this.numero = datos.numero;
        this.color = datos.color;                 // blanca o negra
        this.estado = datos.estado;               // libre, ocupada o en_reparacion
        this.enPoderDe = datos.en_poder_de;       // nombre de quien la tiene (o null)
        // La API manda los programas y defectos como texto: los pasamos a arrays (o sea listas)
        this.programas = datos.programas ? datos.programas.split(', ') : [];
        this.defectos = datos.defectos ? datos.defectos.split('; ') : [];
    }

    // Consultas 
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
        const textos = { libre: 'Libre', ocupada: 'Ocupada', en_reparacion: 'En reparación' };
        return textos[this.estado];
    }

    // acá hay dom
    generarHTML() {
        const tarjeta = document.createElement('article');
        tarjeta.classList.add('notebook-card', 'estado-' + this.estado.replace('_', '-'));
        tarjeta.dataset.id = this.id;

        const titulo = document.createElement('h3');
        titulo.textContent = 'Notebook ' + this.numero;

        const etiqueta = document.createElement('span');
        etiqueta.classList.add('etiqueta', this.color);
        etiqueta.textContent = this.esBlanca() ? 'Blanca · alto rendimiento' : 'Negra';

        const estado = document.createElement('p');
        estado.classList.add('estado');
        estado.textContent = this.textoEstado() + (this.enPoderDe ? ' · ' + this.enPoderDe : '');

        const programas = document.createElement('p');
        programas.classList.add('programas');
        programas.textContent = this.programas.join(', ');

        // eto hace q aparezcan los defectos ya aprobados por el admin
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

        tarjeta.append(titulo, etiqueta, estado, programas, tooltip);
        return tarjeta;
    }
}