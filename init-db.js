import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';

dotenv.config();

const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017';
const client = new MongoClient(uri);

async function init() {
    try {
        await client.connect();
        const db = client.db('middlefinger_db');
        const credits = db.collection('credits');

        // Dummy credit record
        const dummyCredit = {
            tokenkey: 'mf-test-token',
            creditunits: 1000,
            decartToken: 'YOUR_DECART_API_KEY',
            deviceId: '00:00:00:00:00:00',
            billingRate: 3
        };

        const result = await credits.updateOne(
            { tokenkey: dummyCredit.tokenkey },
            { $set: dummyCredit },
            { upsert: true }
        );

        console.log('Successfully initialized credits table.');
        console.log('Token Key: mf-test-token');
        console.log('Units: 1000');
    } catch (err) {
        console.error('Error:', err);
    } finally {
        await client.close();
    }
}

init();
