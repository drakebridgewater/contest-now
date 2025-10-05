const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 3001;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir);
}

// Serve static files from uploads directory
app.use('/uploads', express.static(uploadsDir));

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// Initialize SQLite database
let db;
let dbReady = false;

try {
  db = new sqlite3.Database('./..data/contest.db', (err) => {
    if (err) {
      console.error('Error opening database:', err);
      dbReady = false;
    } else {
      console.log('Connected to SQLite database');
      dbReady = true;
      initializeDatabase();
    }
  });
} catch (err) {
  console.error('Failed to create database connection:', err);
  dbReady = false;
}

// Create tables if they don't exist
function initializeDatabase() {
  db.run(`
    CREATE TABLE IF NOT EXISTS entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      entry_name TEXT NOT NULL,
      contestant_name TEXT NOT NULL,
      contest_type TEXT NOT NULL CHECK(contest_type IN ('dessert', 'cocktail', 'appetizer')),
      photo_path TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `, (err) => {
    if (err) console.error('Error creating entries table:', err);
  });

  db.run(`
    CREATE TABLE IF NOT EXISTS votes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      voter_name TEXT NOT NULL,
      entry_id INTEGER NOT NULL,
      appearance_rating INTEGER NOT NULL CHECK(appearance_rating >= 1 AND appearance_rating <= 5),
      texture_rating INTEGER NOT NULL CHECK(texture_rating >= 1 AND texture_rating <= 5),
      flavor_rating INTEGER NOT NULL CHECK(flavor_rating >= 1 AND flavor_rating <= 5),
      comment TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (entry_id) REFERENCES entries(id),
      UNIQUE(voter_name, entry_id)
    )
  `, (err) => {
    if (err) console.error('Error creating votes table:', err);
  });
}

// API Routes

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Contest API is running' });
});

// Get all entries
app.get('/api/entries', (req, res) => {
  if (!dbReady || !db) {
    res.status(500).json({ error: 'Database not available' });
    return;
  }

  db.all('SELECT * FROM entries ORDER BY created_at DESC', [], (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }

    // Add full URL to photo paths
    const entries = rows.map(row => ({
      ...row,
      photo: `http://localhost:${PORT}/uploads/${path.basename(row.photo_path)}`
    }));

    res.json(entries);
  });
});

// Submit new entry (with base64 image)
app.post('/api/entries', (req, res) => {
  const { entry_name, contestant_name, contest_type, photo } = req.body;

  if (!entry_name || !contestant_name || !contest_type || !photo) {
    res.status(400).json({ error: 'Missing required fields (entry_name, contestant_name, contest_type, photo)' });
    return;
  }

  if (!['dessert', 'cocktail', 'appetizer'].includes(contest_type)) {
    res.status(400).json({ error: 'Invalid contest_type. Must be dessert, cocktail, or appetizer' });
    return;
  }

  // Extract base64 data and save as file
  const matches = photo.match(/^data:image\/([a-zA-Z]*);base64,([^\"]*)/);
  if (!matches) {
    res.status(400).json({ error: 'Invalid image format' });
    return;
  }

  const imageType = matches[1];
  const base64Data = matches[2];
  const filename = `${Date.now()}-${Math.round(Math.random() * 1E9)}.${imageType}`;
  const filepath = path.join(uploadsDir, filename);

  // Write file
  fs.writeFile(filepath, base64Data, 'base64', (err) => {
    if (err) {
      res.status(500).json({ error: 'Failed to save image' });
      return;
    }

    // Save to database
    db.run(
      'INSERT INTO entries (entry_name, contestant_name, contest_type, photo_path) VALUES (?, ?, ?, ?)',
      [entry_name, contestant_name, contest_type, filename],
      function(err) {
        if (err) {
          res.status(500).json({ error: err.message });
          return;
        }

        res.json({
          id: this.lastID,
          entry_name,
          contestant_name,
          contest_type,
          photo: `http://localhost:${PORT}/uploads/${filename}`,
          created_at: new Date().toISOString()
        });
      }
    );
  });
});

// Get all votes for a specific voter
app.get('/api/votes/:voterName', (req, res) => {
  const { voterName } = req.params;

  db.all(
    'SELECT * FROM votes WHERE voter_name = ?',
    [voterName],
    (err, rows) => {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }

      // Format as object with entry_id as key
      const votes = {};
      rows.forEach(row => {
        votes[row.entry_id] = {
          appearance_rating: row.appearance_rating || row.rating || 0,
          texture_rating: row.texture_rating || row.rating || 0,
          flavor_rating: row.flavor_rating || row.rating || 0,
          comment: row.comment || ''
        };
      });

      res.json(votes);
    }
  );
});

// Submit or update a vote
app.post('/api/votes', (req, res) => {
  const { voter_name, entry_id, appearance_rating, texture_rating, flavor_rating, comment } = req.body;

  if (!voter_name || !entry_id || appearance_rating === undefined || texture_rating === undefined || flavor_rating === undefined) {
    res.status(400).json({ error: 'Missing required fields (voter_name, entry_id, appearance_rating, texture_rating, flavor_rating)' });
    return;
  }

  // Validate all ratings are between 1 and 5
  const ratings = [appearance_rating, texture_rating, flavor_rating];
  if (ratings.some(rating => rating < 1 || rating > 5)) {
    res.status(400).json({ error: 'All ratings must be between 1 and 5' });
    return;
  }

  db.run(
    `INSERT INTO votes (voter_name, entry_id, appearance_rating, texture_rating, flavor_rating, comment, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
     ON CONFLICT(voter_name, entry_id)
     DO UPDATE SET appearance_rating = ?, texture_rating = ?, flavor_rating = ?, comment = ?, updated_at = CURRENT_TIMESTAMP`,
    [voter_name, entry_id, appearance_rating, texture_rating, flavor_rating, comment || '',
     appearance_rating, texture_rating, flavor_rating, comment || ''],
    function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }

      res.json({
        success: true,
        voter_name,
        entry_id,
        appearance_rating,
        texture_rating,
        flavor_rating,
        comment: comment || ''
      });
    }
  );
});

// Delete an entry and its associated votes
app.delete('/api/entries/:id', (req, res) => {
  const entryId = req.params.id;

  if (!entryId || isNaN(entryId)) {
    res.status(400).json({ error: 'Invalid entry ID' });
    return;
  }

  if (!dbReady || !db) {
    res.status(500).json({ error: 'Database not available' });
    return;
  }

  // First, get the entry to delete the photo file
  db.get('SELECT photo_path FROM entries WHERE id = ?', [entryId], (err, row) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }

    if (!row) {
      res.status(404).json({ error: 'Entry not found' });
      return;
    }

    // Delete the photo file if it exists
    const photoPath = path.join(uploadsDir, row.photo_path);
    if (fs.existsSync(photoPath)) {
      try {
        fs.unlinkSync(photoPath);
      } catch (err) {
        console.error('Error deleting photo file:', err);
      }
    }

    // Delete votes first (foreign key constraint)
    db.run('DELETE FROM votes WHERE entry_id = ?', [entryId], (err) => {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }

      // Then delete the entry
      db.run('DELETE FROM entries WHERE id = ?', [entryId], function(err) {
        if (err) {
          res.status(500).json({ error: err.message });
          return;
        }

        if (this.changes === 0) {
          res.status(404).json({ error: 'Entry not found' });
          return;
        }

        res.json({
          success: true,
          message: 'Entry and associated votes deleted successfully',
          deletedEntryId: entryId
        });
      });
    });
  });
});

// Get all votes (for admin/results view)
app.get('/api/votes', (req, res) => {
  db.all('SELECT * FROM votes ORDER BY entry_id, voter_name', [], (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

// Get all unique voters with their vote counts
app.get('/api/voters', (req, res) => {
  if (!dbReady || !db) {
    res.status(500).json({ error: 'Database not available' });
    return;
  }

  const query = `
    SELECT
      voter_name,
      COUNT(*) as vote_count,
      MIN(created_at) as first_vote,
      MAX(updated_at) as last_vote
    FROM votes
    GROUP BY voter_name
    ORDER BY voter_name
  `;

  db.all(query, [], (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

// Delete a voter and all their votes
app.delete('/api/voters/:voterName', (req, res) => {
  const voterName = req.params.voterName;

  if (!voterName) {
    res.status(400).json({ error: 'Voter name is required' });
    return;
  }

  if (!dbReady || !db) {
    res.status(500).json({ error: 'Database not available' });
    return;
  }

  // First check if voter exists
  db.get('SELECT COUNT(*) as count FROM votes WHERE voter_name = ?', [voterName], (err, row) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }

    if (row.count === 0) {
      res.status(404).json({ error: 'Voter not found' });
      return;
    }

    // Delete all votes for this voter
    db.run('DELETE FROM votes WHERE voter_name = ?', [voterName], function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }

      res.json({
        success: true,
        message: 'Voter and all their votes deleted successfully',
        deletedVoter: voterName,
        deletedVotes: this.changes
      });
    });
  });
});

// Get results with statistics
app.get('/api/results', (req, res) => {
  if (!dbReady || !db) {
    res.status(500).json({ error: 'Database not available' });
    return;
  }

  const query = `
    SELECT
      e.*,
      COUNT(v.id) as vote_count,
      COALESCE(AVG(CAST(v.appearance_rating AS REAL)), 0) as avg_appearance,
      COALESCE(AVG(CAST(v.texture_rating AS REAL)), 0) as avg_texture,
      COALESCE(AVG(CAST(v.flavor_rating AS REAL)), 0) as avg_flavor,
      COALESCE(AVG(CAST((v.appearance_rating + v.texture_rating + v.flavor_rating) AS REAL) / 3), 0) as average_rating,
      GROUP_CONCAT(
        CASE WHEN v.comment IS NOT NULL AND v.comment != ''
        THEN v.voter_name || ':' || v.comment
        END, '||'
      ) as comments_concat,
      SUM(CASE WHEN v.appearance_rating = 1 THEN 1 ELSE 0 END) as appearance_1_count,
      SUM(CASE WHEN v.appearance_rating = 2 THEN 1 ELSE 0 END) as appearance_2_count,
      SUM(CASE WHEN v.appearance_rating = 3 THEN 1 ELSE 0 END) as appearance_3_count,
      SUM(CASE WHEN v.appearance_rating = 4 THEN 1 ELSE 0 END) as appearance_4_count,
      SUM(CASE WHEN v.appearance_rating = 5 THEN 1 ELSE 0 END) as appearance_5_count,
      SUM(CASE WHEN v.texture_rating = 1 THEN 1 ELSE 0 END) as texture_1_count,
      SUM(CASE WHEN v.texture_rating = 2 THEN 1 ELSE 0 END) as texture_2_count,
      SUM(CASE WHEN v.texture_rating = 3 THEN 1 ELSE 0 END) as texture_3_count,
      SUM(CASE WHEN v.texture_rating = 4 THEN 1 ELSE 0 END) as texture_4_count,
      SUM(CASE WHEN v.texture_rating = 5 THEN 1 ELSE 0 END) as texture_5_count,
      SUM(CASE WHEN v.flavor_rating = 1 THEN 1 ELSE 0 END) as flavor_1_count,
      SUM(CASE WHEN v.flavor_rating = 2 THEN 1 ELSE 0 END) as flavor_2_count,
      SUM(CASE WHEN v.flavor_rating = 3 THEN 1 ELSE 0 END) as flavor_3_count,
      SUM(CASE WHEN v.flavor_rating = 4 THEN 1 ELSE 0 END) as flavor_4_count,
      SUM(CASE WHEN v.flavor_rating = 5 THEN 1 ELSE 0 END) as flavor_5_count
    FROM entries e
    LEFT JOIN votes v ON e.id = v.entry_id
    GROUP BY e.id
    ORDER BY e.contest_type, average_rating DESC, vote_count DESC
  `;

  db.all(query, [], (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }

    const results = rows.map(row => {
      // Parse comments
      const comments = [];
      if (row.comments_concat) {
        const commentPairs = row.comments_concat.split('||');
        commentPairs.forEach(pair => {
          if (pair) {
            const [voter_name, comment] = pair.split(':', 2);
            if (voter_name && comment) {
              comments.push({ voter_name, comment });
            }
          }
        });
      }

      // Build rating distributions for each category
      const appearance_distribution = {
        1: row.appearance_1_count || 0,
        2: row.appearance_2_count || 0,
        3: row.appearance_3_count || 0,
        4: row.appearance_4_count || 0,
        5: row.appearance_5_count || 0
      };

      const texture_distribution = {
        1: row.texture_1_count || 0,
        2: row.texture_2_count || 0,
        3: row.texture_3_count || 0,
        4: row.texture_4_count || 0,
        5: row.texture_5_count || 0
      };

      const flavor_distribution = {
        1: row.flavor_1_count || 0,
        2: row.flavor_2_count || 0,
        3: row.flavor_3_count || 0,
        4: row.flavor_4_count || 0,
        5: row.flavor_5_count || 0
      };

      return {
        id: row.id,
        entry_name: row.entry_name,
        contestant_name: row.contestant_name,
        contest_type: row.contest_type,
        photo: `http://localhost:${PORT}/uploads/${path.basename(row.photo_path)}`,
        vote_count: row.vote_count || 0,
        average_rating: row.average_rating || 0,
        avg_appearance: row.avg_appearance || 0,
        avg_texture: row.avg_texture || 0,
        avg_flavor: row.avg_flavor || 0,
        appearance_distribution,
        texture_distribution,
        flavor_distribution,
        comments
      };
    });

    res.json(results);
  });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🚀 Contest API Server is running!`);
  console.log(`📍 Local: http://localhost:${PORT}`);
  console.log(`📍 Network: http://<your-ip>:${PORT}`);
  console.log(`\nAPI Endpoints:`);
  console.log(`  GET  /api/health - Health check`);
  console.log(`  GET  /api/entries - Get all entries`);
  console.log(`  POST /api/entries - Submit new entry`);
  console.log(`  DELETE /api/entries/:id - Delete entry (admin)`);
  console.log(`  GET  /api/votes/:voterName - Get votes for a voter`);
  console.log(`  POST /api/votes - Submit/update a vote`);
  console.log(`  GET  /api/votes - Get all votes`);
  console.log(`  GET  /api/results - Get results with statistics\n`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  db.close((err) => {
    if (err) {
      console.error('Error closing database:', err);
    } else {
      console.log('\nDatabase connection closed');
    }
    process.exit(0);
  });
});
