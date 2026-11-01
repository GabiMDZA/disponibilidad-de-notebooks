-- Pegar esto en MySQL workbench, en el puerto 3306
DROP DATABASE IF EXISTS notebooks;

CREATE DATABASE notebooks 
CHARACTER SET utf8mb4 
COLLATE utf8mb4_unicode_ci;

USE notebooks;

-- CREACIÓN DE TABLAS
-- Alumnos, profesores y admins en una sola tabla (se distinguen por su rol).
-- El DNI se usa como username para el login.
CREATE TABLE usuarios (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(50) NOT NULL,
  apellido VARCHAR(50) NOT NULL,
  dni VARCHAR(10) NOT NULL UNIQUE,
  contrasena VARCHAR(100) NOT NULL,
  rol ENUM('alumno', 'profesor', 'admin') NOT NULL
);

-- Las notebooks son Conectar Igualdad: blancas (más pro) y negras (más noobs)
CREATE TABLE notebooks (
  id INT AUTO_INCREMENT PRIMARY KEY,
  numero INT NOT NULL UNIQUE, -- número de etiqueta física
  color ENUM('blanca', 'negra') NOT NULL,
  estado ENUM('libre', 'ocupada', 'en_reparacion') NOT NULL DEFAULT 'libre'
);

CREATE TABLE programas (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(60) NOT NULL UNIQUE
);

-- Relación N:N, qué programas tiene cada notebook.
-- Esta tabla es la que permite el filtro por software.
CREATE TABLE notebook_programas (
  notebook_id INT NOT NULL,
  programa_id INT NOT NULL,
  PRIMARY KEY (notebook_id, programa_id),
  FOREIGN KEY (notebook_id) REFERENCES notebooks (id) ON DELETE CASCADE,
  FOREIGN KEY (programa_id) REFERENCES programas (id) ON DELETE CASCADE
);

-- Cada vez que alguien elige una notebook se crea un préstamo.
-- Mientras fecha_devolucion sea NULL, la notebook sigue siendo suya.
CREATE TABLE prestamos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  notebook_id INT NOT NULL,
  usuario_id INT NOT NULL,
  fecha_retiro DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  fecha_devolucion DATETIME NULL,
  FOREIGN KEY (notebook_id) REFERENCES notebooks (id) ON DELETE CASCADE,
  FOREIGN KEY (usuario_id) REFERENCES usuarios (id) ON DELETE CASCADE
);

-- Problemas reportados. Solo los aprobados se mostrarán.
CREATE TABLE reportes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  notebook_id INT NOT NULL,
  usuario_id INT NOT NULL,
  descripcion VARCHAR(255) NOT NULL,
  estado ENUM('pendiente', 'aprobado', 'rechazado') NOT NULL DEFAULT 'pendiente',
  fecha DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (notebook_id) REFERENCES notebooks (id) ON DELETE CASCADE,
  FOREIGN KEY (usuario_id) REFERENCES usuarios (id) ON DELETE CASCADE
);

-- ==========================================
-- DATOS INICIALES DE PRUEBA
-- ==========================================

INSERT INTO usuarios (nombre, apellido, dni, contrasena, rol) VALUES
  ('Admin', 'Escuela', '10000000', 'admin', 'admin'),
  ('Domingo', 'Britos', '20000001', '1234', 'profesor'),
  ('Gabriela', 'Rios', '20000002', '1234', 'profesor'),
  ('Cristina', 'Iriarte', '20000003', '1234', 'profesor'),
  ('Silvia', 'Fernandez', '30000001', '1234', 'profesor'),
  ('Manuel', 'Acosta', '30000002', '1234', 'alumno'),
  ('Gabriel', 'Altamirano', '30000003', '1234', 'alumno'),
  ('Gustavo', 'Guevara', '30000004', '1234', 'alumno'),
  ('Hector', 'Lin', '30000005', '1234', 'alumno');

-- Compus (1 al 10 blancas, 11 al 20 negras)
INSERT INTO notebooks (numero, color) VALUES
  (1, 'blanca'),  (2, 'blanca'),  (3, 'blanca'),  (4, 'blanca'),  (5, 'blanca'),
  (6, 'blanca'),  (7, 'blanca'),  (8, 'blanca'),  (9, 'blanca'),  (10, 'blanca'),
  (11, 'negra'), (12, 'negra'), (13, 'negra'), (14, 'negra'), (15, 'negra'),
  (16, 'negra'), (17, 'negra'), (18, 'negra'), (19, 'negra'), (20, 'negra');

-- Programas disponibles
INSERT INTO programas (nombre) VALUES
  ('Office'),
  ('Visual Studio Code'),
  ('Git'),
  ('Node.js'),
  ('MySQL Workbench'),
  ('NetBeans'),
  ('Autocad'),
  ('Scratch'),
  ('Python'),
  ('PSeint');

-- Programas básicos: las 20 notebooks tienen Office y Visual Studio Code
INSERT INTO notebook_programas (notebook_id, programa_id)
SELECT n.id, p.id
FROM notebooks n
CROSS JOIN programas p
WHERE p.nombre IN ('Office', 'Visual Studio Code');

-- Las blancas tienen mejores programas (se eliminó el duplicado de Node.js)
INSERT INTO notebook_programas (notebook_id, programa_id)
SELECT n.id, p.id
FROM notebooks n
CROSS JOIN programas p
WHERE n.color = 'blanca'
  AND p.nombre IN ('Node.js', 'MySQL Workbench', 'NetBeans', 'Autocad');

-- Algunas negras tienen programas más básicos
INSERT INTO notebook_programas (notebook_id, programa_id)
SELECT n.id, p.id
FROM notebooks n
CROSS JOIN programas p
WHERE n.numero IN (11, 12, 13, 14)
  AND p.nombre IN ('Scratch', 'Python', 'PSeint');

-- Préstamos activos (fecha_devolucion = NULL): la compu sigue en uso
INSERT INTO prestamos (notebook_id, usuario_id, fecha_retiro) VALUES
  ((SELECT id FROM notebooks WHERE numero = 3), 2, NOW()),   -- Britos
  ((SELECT id FROM notebooks WHERE numero = 4), 2, NOW()),   -- Britos
  ((SELECT id FROM notebooks WHERE numero = 5), 2, NOW()),   -- Britos
  ((SELECT id FROM notebooks WHERE numero = 12), 3, NOW());  -- Fernandez

-- Un préstamo viejo, ya devuelto (sirve de historial)
INSERT INTO prestamos (notebook_id, usuario_id, fecha_retiro, fecha_devolucion) VALUES
  ((SELECT id FROM notebooks WHERE numero = 1), 4, '2026-10-20 08:00:00', '2026-10-20 10:00:00');

-- Las compus con préstamo pasan a "ocupada"
UPDATE notebooks
SET estado = 'ocupada'
WHERE numero IN (3, 4, 5, 12);

-- Compus en reparación
UPDATE notebooks
SET estado = 'en_reparacion'
WHERE numero IN (15, 19);

-- Reportes de ejemplo
INSERT INTO reportes (notebook_id, usuario_id, descripcion, estado) VALUES
  ((SELECT id FROM notebooks WHERE numero = 7), 5, 'Falta la tecla Q', 'aprobado'),
  ((SELECT id FROM notebooks WHERE numero = 7), 3, 'La tecla Enter no anda', 'aprobado'),
  ((SELECT id FROM notebooks WHERE numero = 15), 2, 'La batería dura menos de 10 minutos', 'aprobado'),
  ((SELECT id FROM notebooks WHERE numero = 19), 6, 'Tiene un fondo de pantalla inapropiado', 'aprobado'),
  ((SELECT id FROM notebooks WHERE numero = 8), 8, 'Se traba al abrir el google', 'pendiente'),
  ((SELECT id FROM notebooks WHERE numero = 14), 9, 'No prende', 'pendiente'),
  ((SELECT id FROM notebooks WHERE numero = 2), 7, 'Dice que le falta una tecla pero está completa', 'rechazado');