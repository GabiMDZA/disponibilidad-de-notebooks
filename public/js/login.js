//pantalla login

// acá hay BOM, si ya hay una sesión guardada, vamos d1 al dashboard
if (Usuario.desdeSesion()) {
    location.href = 'dashboard.html';
}

document.addEventListener('DOMContentLoaded', () => {
    // acá hay DOM, seleccionamos los elementos que vamos a usar
    const vistas = document.querySelectorAll('.vista');
    const formLogin = document.getElementById('form-login');
    const formRegistro = document.getElementById('form-registro');
    const msgLogin = document.getElementById('msg-login');
    const msgRegistro = document.getElementById('msg-registro');

    // Muestra una sola vista (login, registro o recuperar) y limpia los mensajes
    function mostrar(nombre) {
        vistas.forEach(v => { v.hidden = v.id !== 'vista-' + nombre; });
        document.querySelectorAll('.mensaje').forEach(m => { m.textContent = ''; });
    }

    function mensaje(elemento, texto, tipo) {
        elemento.textContent = texto;
        elemento.className = 'mensaje ' + tipo;
    }

    // Manda un POST a la API y devuelve { ok, data }
    async function post(url, datos) {
        try {
            const respuesta = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(datos)
            });
            return { ok: respuesta.ok, data: await respuesta.json() };
        } catch (error) {
            return { ok: false, data: { error: 'No se pudo conectar con el servidor' } };
        }
    }

    // Links que cambian de vista ("registro", "login", "recuperar contra")
    document.querySelectorAll('[data-ir]').forEach(el => {
        el.addEventListener('click', () => mostrar(el.dataset.ir));
    });

    // coso login
    formLogin.addEventListener('submit', async (e) => {
        e.preventDefault();
        const boton = formLogin.querySelector('.boton');
        const dni = document.getElementById('login-dni').value.trim();
        const contrasena = document.getElementById('login-clave').value;

        boton.disabled = true;
        const { ok, data } = await post('/api/login', { dni, contrasena });
        boton.disabled = false;

        if (!ok) return mensaje(msgLogin, data.error, 'error');

        // para mantener iniciada la sesion (bom)
       const usuario = new Usuario(data.id, data.nombre, data.apellido, data.dni, data.rol);
usuario.guardarSesion(document.getElementById('recordar').checked);
location.href = 'dashboard.html';
    });

    // registro
    formRegistro.addEventListener('submit', async (e) => {
        e.preventDefault();
        const boton = formRegistro.querySelector('.boton');
        const datos = {
            nombre: document.getElementById('reg-nombre').value.trim(),
            apellido: document.getElementById('reg-apellido').value.trim(),
            dni: document.getElementById('reg-dni').value.trim(),
            contrasena: document.getElementById('reg-clave').value,
            rol: document.getElementById('reg-rol').value
        };

        boton.disabled = true;
        const { ok, data } = await post('/api/registro', datos);
        boton.disabled = false;

        if (!ok) return mensaje(msgRegistro, data.error, 'error');

        // cuenta creada
        formRegistro.reset();
        mostrar('login');
        document.getElementById('login-dni').value = datos.dni;
        mensaje(msgLogin, 'Cuenta creada. Ingresá con tu contraseña.', 'ok');
    });
});