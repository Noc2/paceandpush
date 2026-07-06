ALTER TABLE mobile_auth_exchanges
  ALTER COLUMN platform DROP NOT NULL,
  ALTER COLUMN label DROP NOT NULL;
