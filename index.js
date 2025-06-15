require('dotenv').config();
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');

const app = express();
const port = process.env.PORT || 5000;

// Middleware - CORS 


app.use(cors({
    origin: [
        'http://localhost:5173',
        'https://lost-and-found-website-8c162.web.app', // your frontend
        'https://lost-and-found-website-8c162.firebaseapp.com', // firebase fallback
        'https://lost-and-found-hazel.vercel.app', // backend URL 1
        'https://lost-and-found-arih3ceii-belals-projects-258f0a6a.vercel.app' // backend URL 2
    ],
    credentials: true
}));


app.use(express.json());
app.use(cookieParser());

//
const verifyJWT = (req, res, next) => {
    const token = req.cookies.token;
    if (!token) {
        return res.status(401).json({ message: 'Unauthorized access: No token' });
    }

    jwt.verify(token, process.env.JWT_SECRET_KEY, (err, decoded) => {
        if (err) {
            return res.status(401).json({ message: 'Unauthorized access: Invalid token' });
        }
        req.decoded = decoded; // req.decoded.userEmail 
        next();
    });
};

// MongoDB connection URI
const uri = `mongodb+srv://${process.env.DB_USER_NAME}:${process.env.DB_USER_PASS}@cluster0.eoybt2t.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function run() {
    try {
        //await client.connect();
        console.log("MongoDB Connected");

        const itemCollection = client.db('lost&found').collection('items');
        const recoveredCollection = client.db('lost&found').collection('recovered');

        // JWT Token 
        app.post('/jwt', (req, res) => {
            const user = req.body;
            if (!user.email) {
                return res.status(400).json({ message: "Email is required" });
            }
            const token = jwt.sign({ userEmail: user.email }, process.env.JWT_SECRET_KEY, { expiresIn: '20d' });

            const cookieOptions = {
                httpOnly: true,
                secure: process.env.NODE_ENV === "production",
                sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
            };

            res.cookie('token', token, cookieOptions);
            res.json({ success: true, token });
        });

        // Items GET (JWT middleware ব্যবহার)
        app.get('/items', verifyJWT, async(req, res) => {
            const userEmail = req.query.email;
            if (userEmail !== req.decoded.userEmail) {
                return res.status(403).json({ message: 'Forbidden access' });
            }
            const query = userEmail ? { userEmail } : {};
            const items = await itemCollection.find(query).toArray();
            res.json(items);
        });

        // Home page latest 6 items
        app.get('/items/home', async(req, res) => {
            const items = await itemCollection.find().sort({ _id: -1 }).limit(6).toArray();
            res.json(items);
        });

        // Single item by id
        app.get('/items/:id', async(req, res) => {
            const id = req.params.id;
            const item = await itemCollection.findOne({ _id: new ObjectId(id) });
            res.json(item);
        });

        // Add new item (JWT middleware)
        app.post('/items', async(req, res) => {
            const item = req.body;
            const result = await itemCollection.insertOne(item);
            res.json(result);
        });

        // Update item (JWT middleware)
        app.put('/items/:id', verifyJWT, async(req, res) => {
            const id = req.params.id;
            const updatedItem = req.body;
            const result = await itemCollection.updateOne({ _id: new ObjectId(id) }, { $set: updatedItem });
            res.json(result);
        });

        // Delete item (JWT middleware)
        app.delete('/items/:id', async(req, res) => {
            const id = req.params.id;
            const result = await itemCollection.deleteOne({ _id: new ObjectId(id) });
            res.json(result);
        });

        // Mark item as recovered
        app.patch('/items/:id', async(req, res) => {
            const id = req.params.id;
            const { recoveredLocation, recoveredDate } = req.body;
            const result = await itemCollection.updateOne({ _id: new ObjectId(id) }, {
                $set: {
                    status: 'recovered',
                    recoveredLocation,
                    recoveredDate,
                },
            });
            res.json(result);
        });

        // Save recovered item (JWT middleware)
        app.post('/recovered', verifyJWT, async(req, res) => {
            const recoveredData = req.body;
            const result = await recoveredCollection.insertOne(recoveredData);
            res.json(result);
        });

        // Get recovered items by user email (JWT middleware)
        app.get('/recovered', verifyJWT, async(req, res) => {
            const email = req.query.email;
            // Validate email from token vs query
            if (email !== req.decoded.userEmail) {
                return res.status(403).json({ message: 'Forbidden access' });
            }
            // Match recoveredBy.email
            const query = { "recoveredBy.email": email };
            const items = await recoveredCollection.find(query).toArray();
            res.json(items);
        });


        // Root endpoint
        app.get('/', (req, res) => {
            res.send('Lost & Found Server is Running!');
        });

    } catch (err) {
        console.error(err);
    }
}


run().catch(console.dir);


app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});