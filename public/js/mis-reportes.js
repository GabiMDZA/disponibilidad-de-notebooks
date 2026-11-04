const usuario = Usuario.desdeSesion();
if (!usuario) location.replace('index.html');   // entran los tres roles

class ListaReportes {
  constructor(usuario) {
    this.usuario = usuario;
    this.contenedor = document.getElementById('lista-reportes');
    this.mensaje = document.getElementById('mensaje');
    this.textos = { pendiente: 'Pendiente', aprobado: 'Aprobado', rechazado: 'Rechazado' };
  }

  mostrarError(texto) {
    this.mensaje.textContent = texto;
    this.mensaje.className = 'mensaje error';
    this.mensaje.hidden = false;
  }

  cargar() {
    fetch('/api/mis-reportes/' + this.usuario.id)
      .then((res) => res.json())
      .then((lista) => {
        if (!Array.isArray(lista)) throw new Error('respuesta inválida');
        this.renderizar(lista);
      })
      .catch(() => {
        this.mostrarError('No se pudo conectar con el servidor. ¿Está abierta la página en localhost:3000?');
      });
  }

  // DOM: una tarjeta por reporte (los textos van con textContent)
  renderizar(lista) {
    this.contenedor.innerHTML = '';   // solo vaciamos, texto fijo

    if (lista.length === 0) {
      const vacio = document.createElement('p');
      vacio.classList.add('vacio');
      vacio.textContent = 'Todavía no reportaste ningún problema.';
      this.contenedor.appendChild(vacio);
      return;
    }

    lista.forEach((r) => {
      const tarjeta = document.createElement('article');
      tarjeta.classList.add('reporte');

      const titulo = document.createElement('strong');
      titulo.textContent = 'Notebook ' + r.notebook_numero;
      const insignia = document.createElement('span');
      insignia.classList.add('insignia', r.estado);
      insignia.textContent = this.textos[r.estado];
      const cabecera = document.createElement('div');
      cabecera.classList.add('reporte-cabecera');
      cabecera.append(titulo, insignia);

      const descripcion = document.createElement('p');
      descripcion.textContent = r.descripcion;

      const fecha = document.createElement('small');
      fecha.textContent = new Date(r.fecha).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' });

      tarjeta.append(cabecera, descripcion, fecha);
      this.contenedor.appendChild(tarjeta);
    });
  }
}

// encabezado y menú lateral (igual que en el dashboard)
function armarMenu(usuario) {
  const roles = { estudiante: 'Estudiante', profesor: 'Profesor/a', admin: 'Administrador/a' };
  document.getElementById('usuario-nombre').textContent = usuario.nombreCompleto();
  document.getElementById('usuario-rol').textContent = roles[usuario.rol];
  document.getElementById('avatar').textContent = usuario.nombre.charAt(0).toUpperCase();
  document.getElementById('menu-admin').hidden = !usuario.esAdmin();   // solo lo ve el admin

  document.getElementById('salir').addEventListener('click', () => {
    Usuario.cerrarSesion();
    location.replace('index.html');
  });
  document.querySelectorAll('[data-pagina]').forEach((boton) => {
    boton.addEventListener('click', () => { location.href = boton.dataset.pagina; });
  });
}

if (usuario) {
  armarMenu(usuario);
  new ListaReportes(usuario).cargar();
}