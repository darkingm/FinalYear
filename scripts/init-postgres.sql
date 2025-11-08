-- Create databases for each PostgreSQL service

CREATE DATABASE auth_db;
CREATE DATABASE user_db;
CREATE DATABASE order_db;
CREATE DATABASE payment_db;

-- Grant permissions
GRANT ALL PRIVILEGES ON DATABASE auth_db TO postgres;
GRANT ALL PRIVILEGES ON DATABASE user_db TO postgres;
GRANT ALL PRIVILEGES ON DATABASE order_db TO postgres;
GRANT ALL PRIVILEGES ON DATABASE payment_db TO postgres;

-- Connect to auth_db and create tables
\c auth_db;

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Connect to user_db
\c user_db;

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Connect to order_db
\c order_db;

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Connect to payment_db
\c payment_db;

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

