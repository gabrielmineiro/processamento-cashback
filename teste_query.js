const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('meu_banco.db');

db.serialize(() => {
  db.run(`
    DROP TABLE IF  EXISTS teste;
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      value DECIMAL(10,2),
      percentage_cashback DECIMAL(3,2),
      status TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

  `);
});

/* db.run("INSERT INTO orders(nome) VALUES (?)", ["Gabriel"]);

db.each("SELECT * FROM orders", (err, row) => {
  console.log(row);
}); */