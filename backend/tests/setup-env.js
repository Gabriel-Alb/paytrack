// Loaded before imports: never read a developer's .env or database during tests.
process.env.NODE_ENV = 'test';
process.env.SERVICE_LOCK_ENABLED = 'false';
process.env.DATABASE_CLIENT = 'sqlite';
process.env.DATABASE_PATH = ':memory:';
process.env.FRONTEND_ORIGIN = 'http://localhost:5173';
