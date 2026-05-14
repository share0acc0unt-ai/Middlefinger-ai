import express from 'express';
import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';
import cors from 'cors';

dotenv.config();

const app = express();
const port = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017';
const client = new MongoClient(uri);
let db;

async function connectDB() {
    try {
        await client.connect();
        db = client.db('middlefinger_db');
        console.log('Connected to MongoDB');
    } catch (err) {
        console.error('MongoDB connection error:', err);
    }
}

connectDB();

// Get user data and Decart token
app.get('/api/user/:token', async (req, res) => {
    try {
        const { token } = req.params;
        const { deviceId } = req.query;
        
        const credit = await db.collection('credits').findOne({ 
            tokenkey: token,
            deviceId: deviceId
        });
        
        if (!credit) {
            return res.status(404).json({ error: 'Invalid token key or device ID mismatch' });
        }
        
        // Check if a user is already using it (deviceId exists)
        const isUsed = !!credit.deviceId;
        
        res.json({
            credits: credit.creditunits,
            decartToken: credit.decartToken,
            billingRate: credit.billingRate || 3,
            deviceId: credit.deviceId || 'Not Assigned',
            isUsed: isUsed
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

// Initialize device and credit
app.post('/api/user/init', async (req, res) => {
    try {
        const { deviceId } = req.body;
        if (!deviceId) return res.status(400).json({ error: 'Device ID required' });

        let credit = await db.collection('credits').findOne({ deviceId });
        
        if (!credit) {
            const tokenkey = 'mf-' + Math.random().toString(36).substring(2, 10);
            const defaultTokenDoc = await db.collection('defaultStreamingToken').findOne({ type: 'default' });
            const decartToken = defaultTokenDoc ? defaultTokenDoc.token : 'YOUR_DECART_API_KEY';

            credit = {
                tokenkey,
                creditunits: 0,
                decartToken,
                deviceId,
                billingRate: 2
            };

            await db.collection('credits').insertOne(credit);
        }

        res.json({ tokenkey: credit.tokenkey });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

// Update usage
app.post('/api/user/:token/usage', async (req, res) => {
    try {
        const { token } = req.params;
        const { unitsUsed } = req.body;
        
        const result = await db.collection('credits').findOneAndUpdate(
            { tokenkey: token },
            { $inc: { creditunits: -unitsUsed } },
            { returnDocument: 'after' }
        );
        
        if (!result) {
            return res.status(404).json({ error: 'Token not found' });
        }
        
        res.json({ credits: result.creditunits });
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

// Admin Middleware
const checkAdminPassword = (req, res, next) => {
    const password = req.headers['x-admin-password'];
    if (password === (process.env.ADMIN_PASSWORD || 'lucy_admin_123')) {
        next();
    } else {
        res.status(401).json({ error: 'Unauthorized: Invalid admin password' });
    }
};

// Admin: Auth check
app.post('/api/admin/auth', checkAdminPassword, (req, res) => {
    res.json({ success: true });
});

// Admin: Get all records
app.get('/api/admin/records', checkAdminPassword, async (req, res) => {
    try {
        const records = await db.collection('credits').find({}).toArray();
        res.json(records);
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

// Admin: Update user credit/token
app.post('/api/admin/update', checkAdminPassword, async (req, res) => {
    try {
        const { deviceId, creditunits, decartToken, billingRate } = req.body;
        
        if (!deviceId) return res.status(400).json({ error: 'Device ID required' });
        
        const updateDoc = {};
        if (creditunits !== undefined) updateDoc.creditunits = Number(creditunits);
        if (decartToken !== undefined) updateDoc.decartToken = decartToken;
        if (billingRate !== undefined) updateDoc.billingRate = Number(billingRate);
        
        if (Object.keys(updateDoc).length === 0) {
            return res.status(400).json({ error: 'No fields to update' });
        }

        const result = await db.collection('credits').findOneAndUpdate(
            { deviceId },
            { $set: updateDoc },
            { returnDocument: 'after' }
        );

        if (!result) {
            return res.status(404).json({ error: 'Device ID not found' });
        }

        res.json({ success: true, record: result });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
