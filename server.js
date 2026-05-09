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
        
        if (!result.value) {
            return res.status(404).json({ error: 'Token not found' });
        }
        
        res.json({ credits: result.value.creditunits });
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
