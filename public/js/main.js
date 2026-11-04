const guardado = localStorage.getItem('usuario') || sessionStorage.getItem('usuario');
const usuario = guardado ? JSON.parse(guardado) : null;

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
        localStorage.removeItem('usuario');
        sessionStorage.removeItem('usuario');
        location.replace('index.html');
    });
});