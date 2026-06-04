const express = require('express');
const router = express.Router();
const db = require('../db');
const { verifyToken } = require('../middleware/auth');

// Validation helpers
const validateIndianPincode = (pincode) => {
  return /^\d{6}$/.test(pincode);
};

const validateIndianPhone = (phone) => {
  return /^\d{10}$/.test(phone);
};

// 1. GET /api/addresses - Get all addresses for current user
router.get('/', verifyToken, async (req, res) => {
  try {
    const result = await db.query(
      'SELECT * FROM addresses WHERE user_id = $1 ORDER BY is_default DESC, created_at DESC',
      [req.user.id]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Fetch addresses error:', error);
    res.status(500).json({ error: 'Failed to fetch addresses' });
  }
});

// 2. GET /api/addresses/default - Get default address for current user
router.get('/default', verifyToken, async (req, res) => {
  try {
    const result = await db.query(
      'SELECT * FROM addresses WHERE user_id = $1 AND is_default = true',
      [req.user.id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'No default address found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Fetch default address error:', error);
    res.status(500).json({ error: 'Failed to fetch default address' });
  }
});

// 3. GET /api/addresses/:id - Get single address
router.get('/:id', verifyToken, async (req, res) => {
  try {
    const result = await db.query(
      'SELECT * FROM addresses WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Address not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Fetch address error:', error);
    res.status(500).json({ error: 'Failed to fetch address' });
  }
});

// 4. POST /api/addresses - Create new address
router.post('/', verifyToken, async (req, res) => {
  try {
    const {
      full_name,
      phone,
      address_line_1,
      address_line_2,
      landmark,
      city,
      state,
      country,
      pincode,
      address_type,
      is_default
    } = req.body;

    // Validation
    if (!full_name || !phone || !address_line_1 || !city || !state || !pincode) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    if (!validateIndianPincode(pincode)) {
      return res.status(400).json({ error: 'Invalid pincode. Must be 6 digits' });
    }

    if (!validateIndianPhone(phone)) {
      return res.status(400).json({ error: 'Invalid phone number. Must be 10 digits' });
    }

    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');

      // If setting as default, unset other defaults
      if (is_default) {
        await client.query(
          'UPDATE addresses SET is_default = false WHERE user_id = $1',
          [req.user.id]
        );
      }

      // Insert new address
      const result = await client.query(
        `INSERT INTO addresses 
        (user_id, full_name, phone, address_line_1, address_line_2, landmark, city, state, country, pincode, address_type, is_default)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        RETURNING *`,
        [
          req.user.id,
          full_name,
          phone,
          address_line_1,
          address_line_2 || null,
          landmark || null,
          city,
          state,
          country || 'India',
          pincode,
          address_type || 'Home',
          is_default || false
        ]
      );

      await client.query('COMMIT');
      res.status(201).json(result.rows[0]);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Create address error:', error);
    res.status(500).json({ error: 'Failed to create address' });
  }
});

// 5. PUT /api/addresses/:id - Update address
router.put('/:id', verifyToken, async (req, res) => {
  try {
    const {
      full_name,
      phone,
      address_line_1,
      address_line_2,
      landmark,
      city,
      state,
      country,
      pincode,
      address_type,
      is_default
    } = req.body;

    // Validation
    if (!validateIndianPincode(pincode)) {
      return res.status(400).json({ error: 'Invalid pincode. Must be 6 digits' });
    }

    if (!validateIndianPhone(phone)) {
      return res.status(400).json({ error: 'Invalid phone number. Must be 10 digits' });
    }

    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');

      // Check if address belongs to user
      const checkResult = await client.query(
        'SELECT id FROM addresses WHERE id = $1 AND user_id = $2',
        [req.params.id, req.user.id]
      );

      if (checkResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Address not found' });
      }

      // If setting as default, unset other defaults
      if (is_default) {
        await client.query(
          'UPDATE addresses SET is_default = false WHERE user_id = $1',
          [req.user.id]
        );
      }

      // Update address
      const result = await client.query(
        `UPDATE addresses 
        SET full_name = $2, phone = $3, address_line_1 = $4, address_line_2 = $5, 
            landmark = $6, city = $7, state = $8, country = $9, pincode = $10, 
            address_type = $11, is_default = $12
        WHERE id = $1 AND user_id = $13
        RETURNING *`,
        [
          req.params.id,
          full_name,
          phone,
          address_line_1,
          address_line_2 || null,
          landmark || null,
          city,
          state,
          country || 'India',
          pincode,
          address_type || 'Home',
          is_default || false,
          req.user.id
        ]
      );

      await client.query('COMMIT');
      res.json(result.rows[0]);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Update address error:', error);
    res.status(500).json({ error: 'Failed to update address' });
  }
});

// 6. DELETE /api/addresses/:id - Delete address
router.delete('/:id', verifyToken, async (req, res) => {
  try {
    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');

      // Check if address belongs to user
      const checkResult = await client.query(
        'SELECT id, is_default FROM addresses WHERE id = $1 AND user_id = $2',
        [req.params.id, req.user.id]
      );

      if (checkResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Address not found' });
      }

      // If deleting default address, set another as default if available
      if (checkResult.rows[0].is_default) {
        await client.query(
          `UPDATE addresses SET is_default = true 
           WHERE id = (
             SELECT id FROM addresses 
             WHERE user_id = $1 AND id != $2 
             ORDER BY created_at DESC 
             LIMIT 1
           )`,
          [req.user.id, req.params.id]
        );
      }

      // Delete address
      await client.query(
        'DELETE FROM addresses WHERE id = $1 AND user_id = $2',
        [req.params.id, req.user.id]
      );

      await client.query('COMMIT');
      res.json({ message: 'Address deleted successfully' });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Delete address error:', error);
    res.status(500).json({ error: 'Failed to delete address' });
  }
});

// 7. PUT /api/addresses/:id/set-default - Set address as default
router.put('/:id/set-default', verifyToken, async (req, res) => {
  try {
    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');

      // Check if address belongs to user
      const checkResult = await client.query(
        'SELECT id FROM addresses WHERE id = $1 AND user_id = $2',
        [req.params.id, req.user.id]
      );

      if (checkResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Address not found' });
      }

      // Unset all defaults
      await client.query(
        'UPDATE addresses SET is_default = false WHERE user_id = $1',
        [req.user.id]
      );

      // Set new default
      await client.query(
        'UPDATE addresses SET is_default = true WHERE id = $1 AND user_id = $2',
        [req.params.id, req.user.id]
      );

      await client.query('COMMIT');
      res.json({ message: 'Default address updated successfully' });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Set default address error:', error);
    res.status(500).json({ error: 'Failed to set default address' });
  }
});

module.exports = router;
