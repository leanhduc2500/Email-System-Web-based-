const mysql = require('mysql2');

const setupDatabase = () => {
  const connection = mysql.createConnection({
    host: 'localhost',
    user: 'wpr',
    password: 'fit2024',
  });

  const databaseName = 'wpr2101040059';

  connection.connect((err) => {
    if (err) throw err;
    console.log('Connected to MySQL');
    
    connection.query(`CREATE DATABASE IF NOT EXISTS ${databaseName}`, (err) => {
      if (err) throw err;
      console.log('Database created or exists already.');

      connection.changeUser({ database: databaseName }, (err) => {
        if (err) throw err;

        const createUserTable = `
          CREATE TABLE IF NOT EXISTS users (
            id INT AUTO_INCREMENT PRIMARY KEY,
            full_name VARCHAR(255),
            email VARCHAR(255) UNIQUE,
            password VARCHAR(255)
          )`;

        const createEmailTable = `
          CREATE TABLE IF NOT EXISTS emails (
            id INT AUTO_INCREMENT PRIMARY KEY,
            sender_id INT,
            receiver_id INT,
            subject VARCHAR(255),
            body TEXT,
            attachment VARCHAR(255),
            sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (sender_id) REFERENCES users(id),
            FOREIGN KEY (receiver_id) REFERENCES users(id)
          )`;

        connection.query(createUserTable, (err) => {
          if (err) throw err;
          console.log('Users table created.');

          connection.query(createEmailTable, (err) => {
            if (err) throw err;
            console.log('Emails table created.');

            const insertUsers = `
              INSERT INTO users (full_name, email, password) VALUES
              ('User One', 'one@yahoo.com', '111111'),
              ('User Two', 'two@outlook.com', '111111'),
              ('User Three', 'three@gmail.com', '111111')`;

            const insertEmails = `
              INSERT INTO emails (sender_id, receiver_id, subject, body) VALUES
              (1, 2, 'Hello', 'It’s me...'),
              (2, 1, 'Reply', 'Yeah, thank you for your email'),
              (1, 3, 'Test Subject', 'I was wondering if after all these years you’d like to meet'),
              (3, 1, 'No Subject', ''),
              (1, 2, 'Meeting', 'To go over everything'),
              (2, 3, 'Greetings', 'Hey, do you know what 1 is talking about?'),
              (3, 1, 'Hello Again', 'Are you ok???'),
              (1, 3, 'Last Email', 'They say that time’s supposed to heal ya, but I ain’t done much healing')`;

            connection.query(insertUsers, (err) => {
              if (err) throw err;
              console.log('Initial users inserted.');

              connection.query(insertEmails, (err) => {
                if (err) throw err;
                console.log('Initial emails inserted.');
                connection.end();
              });
            });
          });
        });
      });
    });
  });
};

setupDatabase();
