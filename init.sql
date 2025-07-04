CREATE TABLE orders (
    id SERIAL PRIMARY KEY,
    percentage_cashback DECIMAL(3,2) NOT NULL,
    email VARCHAR(100),
    value DECIMAL(10,2),
    status VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);