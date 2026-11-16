-- Plantilla: Usuario de solo lectura para exploración del agente (MySQL / MariaDB)
-- IMPORTANTE: Este script debe ser ejecutado por UNA PERSONA con privilegios de administrador
-- en la base de desarrollo (nunca por el agente ni en producción).
-- Reemplaza <DB_NAME> y <CAMBIAR_PASSWORD_SEGURA>.

CREATE USER IF NOT EXISTS 'agent_ro'@'%' IDENTIFIED BY '<CAMBIAR_PASSWORD_SEGURA>';

-- En MySQL/MariaDB, GRANT SELECT ON <DB_NAME>.* aplica automáticamente a todas las tablas futuras del esquema.
GRANT SELECT, SHOW VIEW ON `<DB_NAME>`.* TO 'agent_ro'@'%';

-- Si el motor soporta READ ONLY por cuenta (MySQL 8.0+): evitar cualquier DDL/DML accidental
REVOKE INSERT, UPDATE, DELETE, CREATE, DROP, ALTER, INDEX, REFERENCES, CREATE TEMPORARY TABLES, LOCK TABLES, EXECUTE
  ON `<DB_NAME>`.* FROM 'agent_ro'@'%';

FLUSH PRIVILEGES;
