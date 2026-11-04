class Usuario {
    constructor(id, nombre, apellido, dni, rol) {
        this.id = id;
        this.nombre = nombre;
        this.apellido = apellido;
        this.dni = dni;
        this.rol = rol;   // 'estudiante', 'profesor' o 'admin'
    }

    // Consultas
    nombreCompleto() {
        return this.nombre + ' ' + this.apellido;
    }

    esAdmin() {
        return this.rol === 'admin';
    }

    esProfesor() {
        return this.rol === 'profesor';
    }

    esEstudiante() {
        return this.rol === 'estudiante';
    }

    // solo los profes y admin pueden elegir notebooks
    puedeElegir() {
        return this.esProfesor() || this.esAdmin();
    }

/// guarda la sesión en localStorage o sessionStorage según recordar
    guardarSesion(recordar) {
        Usuario.cerrarSesion();   // limpiamos cualquier sesión anterior
        const almacen = recordar ? localStorage : sessionStorage;
        almacen.setItem('usuario', JSON.stringify({
            id: this.id, nombre: this.nombre, apellido: this.apellido, dni: this.dni, rol: this.rol
        }));
    }

    // Devuelve un Usuario con la sesión guardada, o null si no hay
    static desdeSesion() {
        const guardado = localStorage.getItem('usuario') || sessionStorage.getItem('usuario');
        if (!guardado) return null;
        try {
            const d = JSON.parse(guardado);
            return new Usuario(d.id, d.nombre, d.apellido, d.dni, d.rol);
        } catch (error) {
            return null;
        }
    }

    static cerrarSesion() {
        localStorage.removeItem('usuario');
        sessionStorage.removeItem('usuario');
    }
}