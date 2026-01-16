INSERT INTO users (id, email, password_hash, role, display_name)
VALUES ($1, $2, $3, $4, $5)
RETURNING id, email, password_hash, role, display_name, created_at, updated_at;
