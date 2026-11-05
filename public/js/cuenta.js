const usuario = Usuario.desdeSesion();
if (!usuario) location.replace('index.html');   // :v 

const ROLES = { estudiante: 'Estudiante', profesor: 'Profesor/a', admin: 'Administrador/a' };

class PaginaCuenta {
  constructor(usuario) {
    this.usuario = usuario;
    this.mensaje = document.getElementById('mensaje');
    this.formClave = document.getElementById('form-clave');
  }

  avisar(texto, tipo) {
    this.mensaje.textContent = texto;
    this.mensaje.className = 'mensaje ' + tipo;
    this.mensaje.hidden = false;
  }

  // muestra los datos del usuario en el encabezado, el perfil y el formulario
  mostrarDatos() {
    const u = this.usuario;
    document.getElementById('avatar').textContent = u.nombre.charAt(0).toUpperCase();
    document.getElementById('usuario-nombre').textContent = u.nombreCompleto();
    document.getElementById('usuario-rol').textContent = ROLES[u.rol];

    document.getElementById('perfil-avatar').textContent = u.nombre.charAt(0).toUpperCase();
    document.getElementById('perfil-nombre').textContent = u.nombreCompleto();
    document.getElementById('perfil-rol').textContent = ROLES[u.rol] + ' · DNI ' + u.dni;

    document.getElementById('nombre').value = u.nombre;
    document.getElementById('apellido').value = u.apellido;
    document.getElementById('dni').value = u.dni;
    document.getElementById('rol').value = ROLES[u.rol];
  }

  // cuántas notebooks tiene ahora y cuántos reportes hizo (rutas que ya existen)
  cargarResumen() {
    this.contar('/api/mis-notebooks/' + this.usuario.id, 'dato-notebooks');
    this.contar('/api/mis-reportes/' + this.usuario.id, 'dato-reportes');
  }

  contar(url, idElemento) {
    fetch(url)
      .then((res) => res.json())
      .then((lista) => {
        if (Array.isArray(lista)) document.getElementById(idElemento).textContent = lista.length;
      })
      .catch(() => {});   // si falla, queda el guión
  }

  // PUT /api/usuarios/:id
  guardarDatos(evento) {
    evento.preventDefault();
    const nombre = document.getElementById('nombre').value.trim();
    const apellido = document.getElementById('apellido').value.trim();

    fetch('/api/usuarios/' + this.usuario.id, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nombre, apellido })
    })
      .then((res) => res.json().then((datos) => ({ ok: res.ok, datos })))
      .then(({ ok, datos }) => {
        if (!ok) { this.avisar(datos.error, 'error'); return; }
        // actualizamos la sesión en el mismo lugar donde estaba guardada (BOM)
        const recordar = localStorage.getItem('usuario') !== null;
        this.usuario = new Usuario(this.usuario.id, nombre, apellido, this.usuario.dni, this.usuario.rol);
        this.usuario.guardarSesion(recordar);
        this.mostrarDatos();
        this.avisar('Datos actualizados', 'ok');
      })
      .catch(() => this.avisar('No se pudo conectar con el servidor', 'error'));
  }

  // PUT /api/usuarios/:id/contrasena
  cambiarContrasena(evento) {
    evento.preventDefault();
    const actual = document.getElementById('clave-actual').value;
    const nueva = document.getElementById('clave-nueva').value;

    fetch('/api/usuarios/' + this.usuario.id + '/contrasena', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ actual, nueva })
    })
      .then((res) => res.json().then((datos) => ({ ok: res.ok, datos })))
      .then(({ ok, datos }) => {
        if (!ok) { this.avisar(datos.error, 'error'); return; }
        this.cerrarFormClave();
        this.avisar('Contraseña actualizada', 'ok');
      })
      .catch(() => this.avisar('No se pudo conectar con el servidor', 'error'));
  }

  abrirFormClave() {
    this.formClave.hidden = false;
    document.getElementById('clave-actual').focus();
  }

  cerrarFormClave() {
    this.formClave.reset();
    this.formClave.hidden = true;
  }

  iniciar() {
    this.mostrarDatos();
    this.cargarResumen();
    document.getElementById('form-datos').addEventListener('submit', (e) => this.guardarDatos(e));
    this.formClave.addEventListener('submit', (e) => this.cambiarContrasena(e));
    document.getElementById('btn-cambiar-clave').addEventListener('click', () => this.abrirFormClave());
    document.getElementById('btn-cancelar-clave').addEventListener('click', () => this.cerrarFormClave());
  }
}

// menú lateral (igual que en el dashboard)
function armarMenu(usuario) {
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
  new PaginaCuenta(usuario).iniciar();
}