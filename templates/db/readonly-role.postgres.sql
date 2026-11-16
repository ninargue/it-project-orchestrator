-- Plantilla: Rol de solo lectura para exploración del agente (PostgreSQL / Supabase)
-- IMPORTANTE: Este script debe ser ejecutado por UNA PERSONA con privilegios de administrador
-- en la base de desarrollo (nunca por el agente ni en producción).
-- Reemplaza <SCHEMA> (por defecto: public), <DB_NAME> y <CAMBIAR_PASSWORD_SEGURA>.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'agent_ro') THEN
    CREATE ROLE agent_ro WITH LOGIN PASSWORD '<CAMBIAR_PASSWORD_SEGURA>' NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT;
  END IF;
END
$$;

-- Forzar modo solo lectura a nivel de sesión/rol (defensa en profundidad)
ALTER ROLE agent_ro SET default_transaction_read_only = on;

GRANT CONNECT ON DATABASE "<DB_NAME>" TO agent_ro;
GRANT USAGE ON SCHEMA <SCHEMA> TO agent_ro;
GRANT SELECT ON ALL TABLES IN SCHEMA <SCHEMA> TO agent_ro;
GRANT SELECT ON ALL SEQUENCES IN SCHEMA <SCHEMA> TO agent_ro;

-- Garantizar que las tablas y secuencias creadas en futuras migraciones también sean legibles por agent_ro
ALTER DEFAULT PRIVILEGES IN SCHEMA <SCHEMA>
  GRANT SELECT ON TABLES TO agent_ro;

ALTER DEFAULT PRIVILEGES IN SCHEMA <SCHEMA>
  GRANT SELECT ON SEQUENCES TO agent_ro;

-- Nota: Si el esquema usa otro rol propietario para las migraciones (ej. app_migrator),
-- ejecutar también:
-- ALTER DEFAULT PRIVILEGES FOR ROLE <MIGRATOR_ROLE> IN SCHEMA <SCHEMA>
--   GRANT SELECT ON TABLES TO agent_ro;
