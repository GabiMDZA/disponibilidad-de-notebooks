const usuario = Usuario.desdeSesion();

// si no hay sesión, volvemos al login
if (!usuario) {
    location.replace('index.html');
}

document.addEventListener('DOMContentLoaded', () => {
    if (!usuario) return;
    document.getElementById('nombre').textContent = usuario.nombre;
    document.getElementById('rol').textContent = usuario.rol;

    // esto borra la sesión de los dos almacenes y vuelve al login
    document.getElementById('salir').addEventListener('click', () => {
        Usuario.cerrarSesion();
        location.replace('index.html');
    });
});