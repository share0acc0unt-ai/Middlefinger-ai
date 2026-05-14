import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';

dotenv.config();

const uri = process.env.MONGODB_URI;

async function testConnection() {
    console.log(`Attempting to connect to IONOS MongoDB...`);
    console.log(`URI: ${uri.replace(/:([^:@]+)@/, ':****@')}`); // Mask password

    const client = new MongoClient(uri, { serverSelectionTimeoutMS: 5000 });

    try {
        await client.connect();
        console.log('✅ Successfully connected to MongoDB remotely!');
        
        const db = client.db('middlefinger_db');
        const collections = await db.listCollections().toArray();
        
        console.log('Collections in middlefinger_db:');
        if (collections.length === 0) {
            console.log('  (Database is currently empty - this is normal for a fresh install!)');
        } else {
            collections.forEach(c => console.log(`  - ${c.name}`));
        }
    } catch (err) {
        console.error('❌ Connection Failed!');
        console.error(err.message);
    } finally {
        await client.close();
        process.exit(0);
    }
}

testConnection();
