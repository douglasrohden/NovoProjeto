-- Executar como superuser, na pasta web/:
--   psql -U postgres -f scripts/create-db-user.sql
-- Password = POSTGRES_PASSWORD no .env (padrão: change_me)

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'app_user') THEN
    CREATE ROLE app_user WITH LOGIN PASSWORD 'change_me';
  ELSE
    ALTER ROLE app_user WITH PASSWORD 'change_me';
  END IF;
END
$$;

-- Ignorar erro se a base já existir
CREATE DATABASE documents OWNER app_user;

GRANT ALL PRIVILEGES ON DATABASE documents TO app_user;
