DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'crm_runtime') THEN
    CREATE ROLE crm_runtime LOGIN PASSWORD 'crm_runtime_password' NOSUPERUSER NOBYPASSRLS;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'crm_test_runtime') THEN
    CREATE ROLE crm_test_runtime LOGIN PASSWORD 'crm_test_runtime_password' NOSUPERUSER NOBYPASSRLS;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'crm_ingress') THEN
    CREATE ROLE crm_ingress LOGIN PASSWORD 'crm_ingress_password' NOSUPERUSER NOBYPASSRLS;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'crm_worker') THEN
    CREATE ROLE crm_worker LOGIN PASSWORD 'crm_worker_password' NOSUPERUSER NOBYPASSRLS;
  END IF;
END
$$;

DO $$
BEGIN
  EXECUTE format('GRANT CONNECT ON DATABASE %I TO crm_runtime', current_database());
  EXECUTE format('GRANT CONNECT ON DATABASE %I TO crm_test_runtime', current_database());
  EXECUTE format('GRANT CONNECT ON DATABASE %I TO crm_ingress', current_database());
  EXECUTE format('GRANT CONNECT ON DATABASE %I TO crm_worker', current_database());
END
$$;
GRANT USAGE ON SCHEMA public TO crm_runtime;
GRANT USAGE ON SCHEMA public TO crm_test_runtime;
GRANT USAGE ON SCHEMA public TO crm_ingress;
GRANT USAGE ON SCHEMA public TO crm_worker;
