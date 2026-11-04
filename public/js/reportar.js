// Lógica de reportar.html: selector de notebook, contador y envío del reporte

const usuario = Usuario.desdeSesion();
if (!usuario) location.replace('index.html'); // sin sesión -> login (entran los tres roles)

class FormularioReporte {
  constructor(usuario) {
    this.usuario = usuario;
    this.form = document.getElementById('form-reporte');
    this.select = document.getElementById('notebook');
    this.textarea = document.getElementById('descripcion');
    this.contador = document.getElementById('contador');
    this.mensaje = document.getElementById('mensaje');
    this.boton = document.getElementById('btn-enviar');
    this.max = 255;

    // contador que se actualiza mientras escribe
    this.textarea.addEventListener('input', () => this.actualizarContador());
    this.form.addEventListener('submit', (e) => {
      e.preventDefault();
      this.enviar();
    });
  }

  actualizarContador() {
    this.contador.textContent = this.textarea.value.length;
  }

  mostrarMensaje(texto, tipo) {
    this.mensaje.textContent = texto;
    this.mensaje.className = 'mensaje ' + tipo; // 'ok' o 'error'
    this.mensaje.hidden = false;
  }

  ocultarMensaje() {
    this.mensaje.hidden = true;
  }

  // Llena el selector con GET /api/notebooks
  cargarNotebooks() {
    fetch('/api/notebooks')
      .then((res) => res.json())
      .then((lista) => {
        if (!Array.isArray(lista)) throw new Error('respuesta inválida');
        this.select.innerHTML = ''; // solo vaciamos con texto fijo
        this.agregarOpcion('', 'Elegí una notebook');
        lista.forEach((n) => {
          const color = n.color === 'blanca' ? 'Blanca' : 'Negra';
          this.agregarOpcion(n.id, 'Notebook ' + n.numero + ' · ' + color);
        });
        this.preseleccionar();
      })
      .catch(() => {
        this.mostrarMensaje('No se pudo conectar con el servidor. ¿Está abierta la página en localhost:3000?', 'error');
      });
  }

  agregarOpcion(valor, texto) {
    const opcion = document.createElement('option');
    opcion.value = valor;
    opcion.textContent = texto;
    this.select.appendChild(opcion);
  }

  // BOM: reportar.html?notebook=7 deja esa notebook elegida
  preseleccionar() {
    const parametros = new URLSearchParams(location.search);
    const id = parametros.get('notebook');
    if (!id) return;
    const existe = Array.from(this.select.options).some((o) => o.value === id);
    if (existe) {
      this.select.value = id;
    } else {
      this.mostrarMensaje('La notebook del enlace no existe. Elegí una de la lista.', 'error');
    }
  }

  // POST /api/reportes
  enviar() {
    this.ocultarMensaje();
    const notebookId = this.select.value;
    const descripcion = this.textarea.value.trim();

    if (!notebookId) {
      this.mostrarMensaje('Elegí una notebook.', 'error');
      return;
    }
    if (descripcion === '') {
      this.mostrarMensaje('Escribí una descripción del problema.', 'error');
      return;
    }

    this.boton.disabled = true;
    fetch('/api/reportes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        usuario_id: this.usuario.id,
        notebook_id: Number(notebookId),
        descripcion: descripcion
      })
    })
      .then((res) =>
        res.json().then((datos) => ({ ok: res.ok, status: res.status, datos }))
      )
      .then((r) => {
        if (r.ok) {
          this.mostrarMensaje('Reporte enviado, queda pendiente de aprobación', 'ok');
          this.limpiar();
        } else if (r.status === 404) {
          this.mostrarMensaje('Esa notebook no existe.', 'error');
        } else {
          this.mostrarMensaje(r.datos.error || 'No se pudo enviar el reporte.', 'error');
        }
      })
      .catch(() => {
        this.mostrarMensaje('No se pudo conectar con el servidor. ¿Está abierta la página en localhost:3000?', 'error');
      })
      .finally(() => {
        this.boton.disabled = false;
      });
  }

  limpiar() {
    this.select.value = '';
    this.textarea.value = '';
    this.actualizarContador();
  }
}

if (usuario) {
  const formulario = new FormularioReporte(usuario);
  formulario.cargarNotebooks();
}
