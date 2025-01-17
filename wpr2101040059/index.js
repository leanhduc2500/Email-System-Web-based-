const express = require('express');
const mysql = require('mysql2');
const cookieParser = require('cookie-parser');
const bodyParser = require('body-parser');
const jwt = require('jsonwebtoken');
const path = require('path');
const app = express();

const SECRET_KEY = '05012003'; 

const db = mysql.createConnection({
  host: 'localhost',
  user: 'wpr',
  password: 'fit2024',
  database: 'wpr2101040059' 
});

db.connect((err) => {
  if (err) {
    console.error('Database connection failed:', err.stack);
    return;
  }
  console.log('Connected to MySQL database');
});

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());

const authenticateJWT = (req, res, next) => {
  const token = req.cookies.authToken;
  if (token) {
    jwt.verify(token, SECRET_KEY, (err, user) => {
      if (err) {
        return res.redirect('/signin');
      }
      req.user = user; 
      next();
    });
  } else {
    res.redirect('/signin');
  }
};

// Route: Sign In (GET and POST)

app.get('/', (req, res) => {
  const token = req.cookies.authToken; 
  if (token) {
    jwt.verify(token, SECRET_KEY, (err, user) => {
      if (err) {
        return res.render('signin'); 
      }
      
      return res.redirect('/inbox');
    });
  } else {
 e
    res.render('signin');
  }
});

app.get('/signin', (req, res) => {
  const token = req.cookies.authToken; 
  if (token) {
    jwt.verify(token, SECRET_KEY, (err, user) => {
      if (err) {
        return res.render('signin'); 
      }
      return res.redirect('/inbox');
    });
  } else {
    res.render('signin');
  }
});


app.post('/signin', (req, res) => {
  const { email, password } = req.body;
  const query = 'SELECT * FROM users WHERE email = ? AND password = ?';
  db.query(query, [email, password], (err, results) => {
    if (err) throw err;
    if (results.length > 0) {
      const user = { id: results[0].id, full_name: results[0].full_name };
      const token = jwt.sign(user, SECRET_KEY, { expiresIn: '1h' });
      res.cookie('authToken', token, { httpOnly: true });
      res.redirect('/inbox');
    } else {
      res.render('signin', { error: 'Invalid email or password' });
    }
  });
});

// Route: Sign Up (GET and POST)
app.get('/signup', (req, res) => {
  res.render('signup');
});

app.post('/signup', (req, res) => {
  const { full_name, email, password, confirmPassword } = req.body;
  if (password.length < 6){
    return res.render('signup', { error: 'Passwords length must greater than 6 letters' });
  }
  if (password !== confirmPassword) {
    return res.render('signup', { error: 'Password confirm failed. Re-enter the password!' });
  }
  const query = 'INSERT INTO users (full_name, email, password) VALUES (?, ?, ?)';
  db.query(query, [full_name, email, password], (err, results) => {
    if (err) {
      if (err.code === 'ER_DUP_ENTRY') {
        return res.render('signup', { error: 'Email already exists' });
      }
      throw err;
    }
    res.render('signin', { message: 'Account created successfully! Please sign in.' });
  });
});


// Route: Inbox (GET)
app.get('/inbox', authenticateJWT, (req, res) => {
  const itemsPerPage = 10;
  const currentPage = parseInt(req.query.page) || 1;
  const offset = (currentPage - 1) * itemsPerPage;

  const query = `
    SELECT 
      emails.*, 
      sender.full_name AS sender_name, 
      sender.email AS sender_email 
    FROM emails 
    JOIN users AS sender ON emails.sender_id = sender.id 
    WHERE emails.receiver_id = ?
    ORDER BY emails.sent_at DESC 
    LIMIT ? OFFSET ?`;

  db.query(query, [req.user.id, itemsPerPage, offset], (err, results) => {
    if (err) throw err;

    const countQuery = 'SELECT COUNT(*) AS total FROM emails WHERE receiver_id = ?';
    db.query(countQuery, [req.user.id], (err, countResults) => {
      if (err) throw err;

      const totalEmails = countResults[0].total;
      const totalPages = Math.ceil(totalEmails / itemsPerPage);
      const hasPrevPage = currentPage > 1;
      const hasNextPage = currentPage < totalPages;

      res.render('inbox', {
        emails: results,
        currentPage,
        totalPages,
        hasPrevPage,
        hasNextPage
      });
    });
  });
});
// Route: Outbox (GET)
app.get('/outbox', authenticateJWT, (req, res) => {
  const itemsPerPage = 10; 
  const currentPage = parseInt(req.query.page) || 1; 
  const offset = (currentPage - 1) * itemsPerPage; 

  const query = `
    SELECT emails.*, users.full_name AS recipient_name
    FROM emails
    JOIN users ON emails.receiver_id = users.id
    WHERE emails.sender_id = ?
    LIMIT ? OFFSET ?
  `;

  const totalCountQuery = 'SELECT COUNT(*) AS total FROM emails WHERE sender_id = ?';

  db.query(query, [req.user.id, itemsPerPage, offset], (err, results) => {
    if (err) throw err;

    db.query(totalCountQuery, [req.user.id], (err, totalResults) => {
      if (err) throw err;

      const totalEmails = totalResults[0].total; 
      const totalPages = Math.ceil(totalEmails / itemsPerPage); 
      const hasPrevPage = currentPage > 1;
      const hasNextPage = currentPage < totalPages;

      res.render('outbox', {
        emails: results,
        userName: req.user.full_name,
        currentPage,
        totalPages,
        hasPrevPage,
        hasNextPage
      });
    });
  });
});

// Route: Compose (GET and POST)

app.get('/compose', authenticateJWT, (req, res) => {
  db.query('SELECT * FROM users WHERE id != ?', [req.user.id], (err, users) => {
    if (err) throw err;
    res.render('compose', { users, message: null });
  });
});

app.post('/compose', authenticateJWT, (req, res) => {
  const { recipient, subject, body } = req.body;
  

  if (!recipient) {
    return res.render('compose', {
      message: 'Please select a recipient.',
      users: [],
    });
  }

  const emailSubject = subject || '(no subject)';
  const emailBody = body || '(no body)';

  const query = 'INSERT INTO emails (sender_id, receiver_id, subject, body) VALUES (?, ?, ?, ?)';
  
  db.query(query, [req.user.id, recipient, emailSubject, emailBody], (err, results) => {
    if (err) throw err;

    if (req.files && req.files.attachment) {
      const attachment = req.files.attachment;
      const filePath = '/uploads/' + attachment.name;

      attachment.mv(filePath, (err) => {
        if (err) {
          return res.status(500).send('Error uploading file');
        }
      });
    }

    res.render('compose', {
      message: 'Email sent successfully!',
      users,
    });
  });
});

// Route: Email Detail (GET)
app.get('/email-detail/:id', authenticateJWT, (req, res) => {
  const query = `
  SELECT 
    emails.*, 
    sender.full_name AS sender_name, 
    sender.email AS sender_email, 
    receiver.full_name AS receiver_name, 
    receiver.email AS receiver_email 
  FROM emails 
  JOIN users AS sender ON emails.sender_id = sender.id 
  JOIN users AS receiver ON emails.receiver_id = receiver.id 
  WHERE emails.id = ? AND (emails.sender_id = ? OR emails.receiver_id = ?)
`;


  db.query(query, [req.params.id, req.user.id, req.user.id], (err, results) => {
    if (err) throw err;

    if (results.length > 0) {
      res.render('email_detail', { email: results[0] });
    } else {
      res.redirect('/access-denied');
    }
  });

});
// Route: Access Denied (GET)
app.get('/access-denied', (req, res) => {
  res.status(403).render('access-denied');
});
// Route: Sign Out (GET)
app.get('/signout', (req, res) => {
  res.clearCookie('authToken');
  res.redirect('/');
});


app.post('/delete-emails', (req, res) => {
  const idsToDelete = req.body.ids; 

  if (!Array.isArray(idsToDelete) || idsToDelete.length === 0) {
    return res.status(400).json({ error: 'No emails selected for deletion' });
  }

  const deleteQuery = 'DELETE FROM emails WHERE id IN (?)';
  db.query(deleteQuery, [idsToDelete], (err, result) => {
    if (err) {
      console.error('Error deleting emails:', err);
      return res.status(500).json({ error: 'Failed to delete emails' });
    }

    console.log(`Deleted ${result.affectedRows} emails.`);
    res.json({ message: 'Emails deleted successfully' });
  });
});

const PORT = 8000;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
