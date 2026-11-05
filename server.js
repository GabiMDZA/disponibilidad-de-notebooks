// importar las librerías
const express = require('express');
const path = require('path');
const mysql = require('mysql2');

// crear la aplicación Express
const app = express();
const PORT = 3000;

// conexion a mysql
const conexion = mysql.createConnection({
    host: 'localhost',
    port: 3306,
    user: 'root',
    password: 'root',
    database: 'notebooks'
});

conexion.connect((error) => {
    if (error) {
        console.error('Error al conectar a MySQL:', error);
        return;
    }
    console.log('¡Conectado a la base de datos de notebooks!');
});

// MIDDLEWARE
app.use(express.json());                                      // leer JSON que manda el front
app.use(express.static(path.join(__dirname, 'public')));      // servir archivos estáticos

// RUTA PRINCIPAL - Envía el HTML
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// listado de notebooks (lee de MySQL)
app.get('/api/notebooks', (req, res) => {
    // Cada notebook trae: quién la tiene (si está ocupada), sus programas
    // y sus defectos aprobados
    const sql = `
        SELECT n.id, n.numero, n.color, n.estado,
               CONCAT(u.nombre, ' ', u.apellido) AS en_poder_de,
               (SELECT GROUP_CONCAT(pr.nombre SEPARATOR ', ')
                  FROM notebook_programas np
                  JOIN programas pr ON pr.id = np.programa_id
                 WHERE np.notebook_id = n.id) AS programas,
               (SELECT GROUP_CONCAT(r.descripcion SEPARATOR '; ')
                  FROM reportes r
                 WHERE r.notebook_id = n.id AND r.estado = 'aprobado') AS defectos
        FROM notebooks n
        LEFT JOIN prestamos p ON p.notebook_id = n.id AND p.fecha_devolucion IS NULL
        LEFT JOIN usuarios u ON u.id = p.usuario_id
        ORDER BY n.numero`;
    conexion.query(sql, (error, resultados) => {
        if (error) {
            console.error(error);
            return res.status(500).json({ error: 'Error al leer las notebooks' });
        }
        res.json(resultados);
    });
});

// lista de programas (para el filtro del catálogo)
app.get('/api/programas', (req, res) => {
    conexion.query('SELECT id, nombre FROM programas ORDER BY nombre', (error, resultados) => {
        if (error) {
            console.error(error);
            return res.status(500).json({ error: 'Error al leer los programas' });
        }
        res.json(resultados);
    });
});

// registro de usuarios nuevos
app.post('/api/registro', (req, res) => {
    const { nombre, apellido, dni, contrasena, rol } = req.body;

    // todos los campos son obligatorios
    if (!nombre || !apellido || !dni || !contrasena || !rol) {
        return res.status(400).json({ error: 'Completá todos los campos' });
    }

    // solo se puede registrar como estudiante o profesor (el admin se carga en el SQL)
    if (rol !== 'estudiante' && rol !== 'profesor') {
        return res.status(400).json({ error: 'Rol no válido' });
    }

    const sql = 'INSERT INTO usuarios (nombre, apellido, dni, contrasena, rol) VALUES (?, ?, ?, ?, ?)';
    conexion.query(sql, [nombre, apellido, dni, contrasena, rol], (error, resultado) => {
        if (error) {
            // ER_DUP_ENTRY = el DNI ya existe (la columna es UNIQUE)
            if (error.code === 'ER_DUP_ENTRY') {
                return res.status(409).json({ error: 'Ese DNI ya está registrado' });
            }
            console.error(error);
            return res.status(500).json({ error: 'Error al registrar el usuario' });
        }
        res.status(201).json({ mensaje: 'Usuario registrado', id: resultado.insertId });
    });
});

// login (busca el DNI y la contraseña)
app.post('/api/login', (req, res) => {
    const { dni, contrasena } = req.body;

    if (!dni || !contrasena) {
        return res.status(400).json({ error: 'Ingresá tu DNI y contraseña' });
    }

    // no pedimos la contra en el SELECT, no tiene que volver al navegador
    const sql = 'SELECT id, nombre, apellido, dni, rol FROM usuarios WHERE dni = ? AND contrasena = ?';
    conexion.query(sql, [dni, contrasena], (error, resultados) => {
        if (error) {
            console.error(error);
            return res.status(500).json({ error: 'Error al iniciar sesión' });
        }
        if (resultados.length === 0) {
            return res.status(401).json({ error: 'DNI o contraseña incorrectos' });
        }
        res.json(resultados[0]);   // devuelve id, nombre, apellido, dni, rol
    });
});

// pa elegir una notebook (solo profesores y admin)
app.post('/api/elegir', (req, res) => {
    const { usuario_id, notebook_id } = req.body;

    if (!usuario_id || !notebook_id) {
        return res.status(400).json({ error: 'Faltan datos' });
    }

    // paso 1: ver que rol tiene el usuario (lo leemos de la base, no del navegador)
    conexion.query('SELECT rol FROM usuarios WHERE id = ?', [usuario_id], (error, usuarios) => {
        if (error) {
            console.error(error);
            return res.status(500).json({ error: 'Error al verificar el usuario' });
        }
        if (usuarios.length === 0) {
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }
        if (usuarios[0].rol === 'estudiante') {
            return res.status(403).json({ error: 'Los estudiantes no pueden elegir notebooks' });
        }

        // paso 2: marcarla ocupada solo si sigue libre (evita que dos personas se la queden)
        const sqlOcupar = "UPDATE notebooks SET estado = 'ocupada' WHERE id = ? AND estado = 'libre'";
        conexion.query(sqlOcupar, [notebook_id], (error, resultado) => {
            if (error) {
                console.error(error);
                return res.status(500).json({ error: 'Error al elegir la notebook' });
            }
            // affectedRows = 0 significa que no estaba libre: alguien se la ganó
            if (resultado.affectedRows === 0) {
                return res.status(409).json({ error: 'Esa notebook ya no está disponible' });
            }

            // paso 3: registrar el préstamo
            const sqlPrestamo = 'INSERT INTO prestamos (notebook_id, usuario_id) VALUES (?, ?)';
            conexion.query(sqlPrestamo, [notebook_id, usuario_id], (error) => {
                if (error) {
                    console.error(error);
                    return res.status(500).json({ error: 'Error al registrar el préstamo' });
                }
                res.json({ mensaje: 'Notebook elegida' });
            });
        });
    });
});

// pa devolver una notebook
app.post('/api/devolver', (req, res) => {
    const { usuario_id, notebook_id } = req.body;

    if (!usuario_id || !notebook_id) {
        return res.status(400).json({ error: 'Faltan datos' });
    }

    // paso 1: cerrar el préstamo activo de ESE usuario para ESA notebook
    const sqlCerrar = `UPDATE prestamos SET fecha_devolucion = NOW()
                       WHERE notebook_id = ? AND usuario_id = ? AND fecha_devolucion IS NULL`;
    conexion.query(sqlCerrar, [notebook_id, usuario_id], (error, resultado) => {
        if (error) {
            console.error(error);
            return res.status(500).json({ error: 'Error al devolver la notebook' });
        }
        if (resultado.affectedRows === 0) {
            return res.status(404).json({ error: 'Esa notebook no la tenés vos' });
        }

        // paso 2: volver a dejarla libre
        conexion.query("UPDATE notebooks SET estado = 'libre' WHERE id = ?", [notebook_id], (error) => {
            if (error) {
                console.error(error);
                return res.status(500).json({ error: 'Error al liberar la notebook' });
            }
            res.json({ mensaje: 'Notebook devuelta' });
        });
    });
});

//"Mis notebooks": las que tiene el usuario ahora
app.get('/api/mis-notebooks/:usuario_id', (req, res) => {
    const sql = `SELECT n.id, n.numero, n.color, p.fecha_retiro
                 FROM prestamos p
                 JOIN notebooks n ON n.id = p.notebook_id
                 WHERE p.usuario_id = ? AND p.fecha_devolucion IS NULL
                 ORDER BY n.numero`;
    conexion.query(sql, [req.params.usuario_id], (error, resultados) => {
        if (error) {
            console.error(error);
            return res.status(500).json({ error: 'Error al leer tus notebooks' });
        }
        res.json(resultados);
    });
});

// verificar en la base que el usuario sea admin
// si lo es, ejecuta "siEsAdmin"; si no, responde con error
function verificarAdmin(usuario_id, res, siEsAdmin) {
    conexion.query('SELECT rol FROM usuarios WHERE id = ?', [usuario_id], (error, usuarios) => {
        if (error) {
            console.error(error);
            return res.status(500).json({ error: 'Error al verificar el usuario' });
        }
        if (usuarios.length === 0 || usuarios[0].rol !== 'admin') {
            return res.status(403).json({ error: 'Solo el admin puede hacer esto' });
        }
        siEsAdmin();
    });
}

// crear un reporte (cualquier usuario). queda "pendiente" hasta que lo apruebe el admin
app.post('/api/reportes', (req, res) => {
    const { usuario_id, notebook_id, descripcion } = req.body;

    if (!usuario_id || !notebook_id || !descripcion || !descripcion.trim()) {
        return res.status(400).json({ error: 'Completá la descripción del problema' });
    }
    if (descripcion.length > 255) {
        return res.status(400).json({ error: 'La descripción es muy larga (máximo 255 caracteres)' });
    }

    const sql = 'INSERT INTO reportes (notebook_id, usuario_id, descripcion) VALUES (?, ?, ?)';
    conexion.query(sql, [notebook_id, usuario_id, descripcion.trim()], (error) => {
        if (error) {
            // ER_NO_REFERENCED_ROW_2 = la notebook o el usuario no existe
            if (error.code === 'ER_NO_REFERENCED_ROW_2') {
                return res.status(404).json({ error: 'La notebook o el usuario no existe' });
            }
            console.error(error);
            return res.status(500).json({ error: 'Error al enviar el reporte' });
        }
        res.status(201).json({ mensaje: 'Reporte enviado, queda pendiente de aprobación' });
    });
});

// "Mis reportes": los reportes que hizo el usuario y en qué estado están
app.get('/api/mis-reportes/:usuario_id', (req, res) => {
    const sql = `SELECT r.id, r.descripcion, r.estado, r.fecha, n.numero AS notebook_numero
                 FROM reportes r
                 JOIN notebooks n ON n.id = r.notebook_id
                 WHERE r.usuario_id = ?
                 ORDER BY r.fecha DESC`;
    conexion.query(sql, [req.params.usuario_id], (error, resultados) => {
        if (error) {
            console.error(error);
            return res.status(500).json({ error: 'Error al leer tus reportes' });
        }
        res.json(resultados);
    });
});

// reportes pendientes (solo admin): /api/reportes/pendientes?usuario_id=1
app.get('/api/reportes/pendientes', (req, res) => {
    verificarAdmin(req.query.usuario_id, res, () => {
        const sql = `SELECT r.id, r.descripcion, r.fecha,
                            n.numero AS notebook_numero,
                            CONCAT(u.nombre, ' ', u.apellido) AS reportado_por
                     FROM reportes r
                     JOIN notebooks n ON n.id = r.notebook_id
                     JOIN usuarios u ON u.id = r.usuario_id
                     WHERE r.estado = 'pendiente'
                     ORDER BY r.fecha`;
        conexion.query(sql, (error, resultados) => {
            if (error) {
                console.error(error);
                return res.status(500).json({ error: 'Error al leer los reportes' });
            }
            res.json(resultados);
        });
    });
});

// aprobar o rechazar un reporte (solo admin)
app.put('/api/reportes/:id', (req, res) => {
    const { usuario_id, estado } = req.body;

    if (estado !== 'aprobado' && estado !== 'rechazado') {
        return res.status(400).json({ error: 'Estado no válido' });
    }

    verificarAdmin(usuario_id, res, () => {
        conexion.query('UPDATE reportes SET estado = ? WHERE id = ?', [estado, req.params.id], (error, resultado) => {
            if (error) {
                console.error(error);
                return res.status(500).json({ error: 'Error al actualizar el reporte' });
            }
            if (resultado.affectedRows === 0) {
                return res.status(404).json({ error: 'Reporte no encontrado' });
            }
            res.json({ mensaje: 'Reporte ' + estado });
        });
    });
});

// dar de alta una notebook (solo admin)
app.post('/api/admin/notebooks', (req, res) => {
    const { usuario_id, numero, color } = req.body;

    if (!numero || !Number.isInteger(Number(numero)) || Number(numero) <= 0) {
        return res.status(400).json({ error: 'Ingresá un número de notebook válido' });
    }
    if (color !== 'blanca' && color !== 'negra') {
        return res.status(400).json({ error: 'El color tiene que ser blanca o negra' });
    }

    verificarAdmin(usuario_id, res, () => {
        conexion.query('INSERT INTO notebooks (numero, color) VALUES (?, ?)', [numero, color], (error, resultado) => {
            if (error) {
                // ER_DUP_ENTRY = ya existe una notebook con ese numero (la columna es UNIQUE)
                if (error.code === 'ER_DUP_ENTRY') {
                    return res.status(409).json({ error: 'Ya existe una notebook con ese número' });
                }
                console.error(error);
                return res.status(500).json({ error: 'Error al crear la notebook' });
            }
            res.status(201).json({ mensaje: 'Notebook creada', id: resultado.insertId });
        });
    });
});

// cambiar el estado de una notebook: libre o en reparacion (solo admin)
// si alguien la tenia, se le cierra el prestamo (es una devolucion forzada)
app.put('/api/admin/notebooks/:id/estado', (req, res) => {
    const { usuario_id, estado } = req.body;

    if (estado !== 'libre' && estado !== 'en_reparacion') {
        return res.status(400).json({ error: 'El estado tiene que ser libre o en_reparacion' });
    }

    verificarAdmin(usuario_id, res, () => {
        // paso 1: cerrar el prestamo activo, si lo hay
        const sqlCerrar = 'UPDATE prestamos SET fecha_devolucion = NOW() WHERE notebook_id = ? AND fecha_devolucion IS NULL';
        conexion.query(sqlCerrar, [req.params.id], (error) => {
            if (error) {
                console.error(error);
                return res.status(500).json({ error: 'Error al cerrar el préstamo' });
            }

            // paso 2: cambiar el estado
            conexion.query('UPDATE notebooks SET estado = ? WHERE id = ?', [estado, req.params.id], (error, resultado) => {
                if (error) {
                    console.error(error);
                    return res.status(500).json({ error: 'Error al cambiar el estado' });
                }
                if (resultado.affectedRows === 0) {
                    return res.status(404).json({ error: 'Notebook no encontrada' });
                }
                res.json({ mensaje: 'Notebook ahora está ' + estado });
            });
        });
    });
});

// eliminar una notebook (solo admin): /api/admin/notebooks/5?usuario_id=1
// sus prestamos, reportes y programas se borran solos (ON DELETE CASCADE)
app.delete('/api/admin/notebooks/:id', (req, res) => {
    verificarAdmin(req.query.usuario_id, res, () => {
        conexion.query('DELETE FROM notebooks WHERE id = ?', [req.params.id], (error, resultado) => {
            if (error) {
                console.error(error);
                return res.status(500).json({ error: 'Error al eliminar la notebook' });
            }
            if (resultado.affectedRows === 0) {
                return res.status(404).json({ error: 'Notebook no encontrada' });
            }
            res.json({ mensaje: 'Notebook eliminada' });
        });
    });
});

// PRESTAMOS 

// quien tiene cada notebook ahora (solo admin): /api/admin/prestamos?usuario_id=1
app.get('/api/admin/prestamos', (req, res) => {
    verificarAdmin(req.query.usuario_id, res, () => {
        const sql = `SELECT n.numero AS notebook_numero, n.color,
                            CONCAT(u.nombre, ' ', u.apellido) AS usuario,
                            u.rol, p.fecha_retiro
                     FROM prestamos p
                     JOIN notebooks n ON n.id = p.notebook_id
                     JOIN usuarios u ON u.id = p.usuario_id
                     WHERE p.fecha_devolucion IS NULL
                     ORDER BY n.numero`;
        conexion.query(sql, (error, resultados) => {
            if (error) {
                console.error(error);
                return res.status(500).json({ error: 'Error al leer los préstamos' });
            }
            res.json(resultados);
        });
    });
});

// PROGRAMAS (solo admin)

// crear un programa
app.post('/api/admin/programas', (req, res) => {
    const { usuario_id, nombre } = req.body;

    if (!nombre || !nombre.trim()) {
        return res.status(400).json({ error: 'Ingresá el nombre del programa' });
    }
    if (nombre.trim().length > 60) {
        return res.status(400).json({ error: 'El nombre es muy largo (máximo 60 caracteres)' });
    }

    verificarAdmin(usuario_id, res, () => {
        conexion.query('INSERT INTO programas (nombre) VALUES (?)', [nombre.trim()], (error, resultado) => {
            if (error) {
                // ER_DUP_ENTRY = ya existe un programa con ese nombre (la columna es UNIQUE)
                if (error.code === 'ER_DUP_ENTRY') {
                    return res.status(409).json({ error: 'Ese programa ya existe' });
                }
                console.error(error);
                return res.status(500).json({ error: 'Error al crear el programa' });
            }
            res.status(201).json({ mensaje: 'Programa creado', id: resultado.insertId });
        });
    });
});

// eliminar un programa: se saca de todas las notebooks (ON DELETE CASCADE)
app.delete('/api/admin/programas/:id', (req, res) => {
    verificarAdmin(req.query.usuario_id, res, () => {
        conexion.query('DELETE FROM programas WHERE id = ?', [req.params.id], (error, resultado) => {
            if (error) {
                console.error(error);
                return res.status(500).json({ error: 'Error al eliminar el programa' });
            }
            if (resultado.affectedRows === 0) {
                return res.status(404).json({ error: 'Programa no encontrado' });
            }
            res.json({ mensaje: 'Programa eliminado' });
        });
    });
});

// ids de las notebooks que tienen un programa: /api/admin/programas/3/notebooks?usuario_id=1
app.get('/api/admin/programas/:id/notebooks', (req, res) => {
    verificarAdmin(req.query.usuario_id, res, () => {
        conexion.query('SELECT notebook_id FROM notebook_programas WHERE programa_id = ?', [req.params.id], (error, resultados) => {
            if (error) {
                console.error(error);
                return res.status(500).json({ error: 'Error al leer las notebooks del programa' });
            }
            res.json(resultados.map(fila => fila.notebook_id));
        });
    });
});

// guardar en qué notebooks está el programa (reemplaza la lista anterior)
app.put('/api/admin/programas/:id/notebooks', (req, res) => {
    const { usuario_id, notebook_ids } = req.body;

    if (!Array.isArray(notebook_ids) || !notebook_ids.every(n => Number.isInteger(n))) {
        return res.status(400).json({ error: 'Lista de notebooks no válida' });
    }
    const ids = [...new Set(notebook_ids)];   // sin repetidos

    verificarAdmin(usuario_id, res, () => {
        // paso 1: borrar las asignaciones actuales de este programa
        conexion.query('DELETE FROM notebook_programas WHERE programa_id = ?', [req.params.id], (error) => {
            if (error) {
                console.error(error);
                return res.status(500).json({ error: 'Error al actualizar el programa' });
            }
            if (ids.length === 0) {
                return res.json({ mensaje: 'El programa quedó sin notebooks' });
            }

            // paso 2: insertar las nuevas (un solo INSERT con varias filas)
            const filas = ids.map(id => [id, req.params.id]);
            conexion.query('INSERT INTO notebook_programas (notebook_id, programa_id) VALUES ?', [filas], (error) => {
                if (error) {
                    // ER_NO_REFERENCED_ROW_2 = el programa o alguna notebook no existe
                    if (error.code === 'ER_NO_REFERENCED_ROW_2') {
                        return res.status(404).json({ error: 'El programa o alguna notebook no existe' });
                    }
                    console.error(error);
                    return res.status(500).json({ error: 'Error al asignar el programa' });
                }
                res.json({ mensaje: 'Programa asignado a ' + ids.length + (ids.length === 1 ? ' notebook' : ' notebooks') });
            });
        });
    });
});

// MI CUENTA (cada usuario edita sus propios datos)

// cambiar nombre y apellido
app.put('/api/usuarios/:id', (req, res) => {
    const { nombre, apellido } = req.body;

    if (!nombre || !nombre.trim() || !apellido || !apellido.trim()) {
        return res.status(400).json({ error: 'Completá el nombre y el apellido' });
    }
    if (nombre.trim().length > 50 || apellido.trim().length > 50) {
        return res.status(400).json({ error: 'Nombre y apellido: máximo 50 caracteres' });
    }

    conexion.query('UPDATE usuarios SET nombre = ?, apellido = ? WHERE id = ?', [nombre.trim(), apellido.trim(), req.params.id], (error, resultado) => {
        if (error) {
            console.error(error);
            return res.status(500).json({ error: 'Error al guardar los datos' });
        }
        if (resultado.affectedRows === 0) {
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }
        res.json({ mensaje: 'Datos actualizados' });
    });
});

// cambiar la propia contraseña (hay que mandar la actual)
app.put('/api/usuarios/:id/contrasena', (req, res) => {
    const { actual, nueva } = req.body;

    if (!actual || !nueva || !nueva.trim()) {
        return res.status(400).json({ error: 'Completá las dos contraseñas' });
    }
    if (nueva.length > 100) {
        return res.status(400).json({ error: 'La contraseña es muy larga (máximo 100 caracteres)' });
    }

    // el WHERE incluye la contraseña actual: si no coincide, no se actualiza nada
    conexion.query('UPDATE usuarios SET contrasena = ? WHERE id = ? AND contrasena = ?', [nueva, req.params.id, actual], (error, resultado) => {
        if (error) {
            console.error(error);
            return res.status(500).json({ error: 'Error al cambiar la contraseña' });
        }
        if (resultado.affectedRows === 0) {
            return res.status(401).json({ error: 'La contraseña actual es incorrecta' });
        }
        res.json({ mensaje: 'Contraseña actualizada' });
    });
});

// USUARIOS

// listar usuarios (solo admin): /api/admin/usuarios?usuario_id=1
app.get('/api/admin/usuarios', (req, res) => {
    verificarAdmin(req.query.usuario_id, res, () => {
        conexion.query('SELECT id, nombre, apellido, dni, rol FROM usuarios ORDER BY apellido, nombre', (error, resultados) => {
            if (error) {
                console.error(error);
                return res.status(500).json({ error: 'Error al leer los usuarios' });
            }
            res.json(resultados);
        });
    });
});

// cambiar el rol de un usuario (solo admin). asi se crean mas admins
app.put('/api/admin/usuarios/:id/rol', (req, res) => {
    const { usuario_id, rol } = req.body;

    if (rol !== 'estudiante' && rol !== 'profesor' && rol !== 'admin') {
        return res.status(400).json({ error: 'Rol no válido' });
    }
    // el admin no puede cambiarse el rol a si mismo (para no quedarse sin admins)
    if (Number(req.params.id) === Number(usuario_id)) {
        return res.status(400).json({ error: 'No podés cambiar tu propio rol' });
    }

    verificarAdmin(usuario_id, res, () => {
        conexion.query('UPDATE usuarios SET rol = ? WHERE id = ?', [rol, req.params.id], (error, resultado) => {
            if (error) {
                console.error(error);
                return res.status(500).json({ error: 'Error al cambiar el rol' });
            }
            if (resultado.affectedRows === 0) {
                return res.status(404).json({ error: 'Usuario no encontrado' });
            }
            res.json({ mensaje: 'Rol cambiado a ' + rol });
        });
    });
});

// restablecer la contraseña de un usuario (solo admin)
app.put('/api/admin/usuarios/:id/contrasena', (req, res) => {
    const { usuario_id, contrasena } = req.body;

    if (!contrasena || !contrasena.trim()) {
        return res.status(400).json({ error: 'Ingresá la nueva contraseña' });
    }

    verificarAdmin(usuario_id, res, () => {
        conexion.query('UPDATE usuarios SET contrasena = ? WHERE id = ?', [contrasena.trim(), req.params.id], (error, resultado) => {
            if (error) {
                console.error(error);
                return res.status(500).json({ error: 'Error al cambiar la contraseña' });
            }
            if (resultado.affectedRows === 0) {
                return res.status(404).json({ error: 'Usuario no encontrado' });
            }
            res.json({ mensaje: 'Contraseña actualizada' });
        });
    });
});

// eliminar un usuario (solo admin): /api/admin/usuarios/9?usuario_id=1
// las notebooks que tenia prestadas vuelven a quedar libres
app.delete('/api/admin/usuarios/:id', (req, res) => {
    if (Number(req.params.id) === Number(req.query.usuario_id)) {
        return res.status(400).json({ error: 'No podés eliminarte a vos mismo' });
    }

    verificarAdmin(req.query.usuario_id, res, () => {
        // paso 1: liberar las notebooks que tenia en su poder
        const sqlLiberar = `UPDATE notebooks SET estado = 'libre'
                            WHERE id IN (SELECT notebook_id FROM prestamos
                                         WHERE usuario_id = ? AND fecha_devolucion IS NULL)`;
        conexion.query(sqlLiberar, [req.params.id], (error) => {
            if (error) {
                console.error(error);
                return res.status(500).json({ error: 'Error al liberar sus notebooks' });
            }

            // paso 2: borrar el usuario (sus prestamos y reportes se borran por CASCADE)
            conexion.query('DELETE FROM usuarios WHERE id = ?', [req.params.id], (error, resultado) => {
                if (error) {
                    console.error(error);
                    return res.status(500).json({ error: 'Error al eliminar el usuario' });
                }
                if (resultado.affectedRows === 0) {
                    return res.status(404).json({ error: 'Usuario no encontrado' });
                }
                res.json({ mensaje: 'Usuario eliminado' });
            });
        });
    });
});

// iniciar el servidor
app.listen(PORT, () => {
    console.log(`💻 Notebooks en http://localhost:${PORT}`);
});