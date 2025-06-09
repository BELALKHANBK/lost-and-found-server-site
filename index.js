require('dotenv').config();
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken')
const cookieParser = require('cookie-parser')
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');

const app = express();
const port = process.env.PORT || 5000;

// Middleware
app.use(cors({
    origin: ['http://localhost:5173'],
    credentials: true
}));
app.use(express.json());
app.use(cookieParser())
const logger = (req, res, next) => {
    console.log('inside the logger middlewer')
    next()
}
const cookie = (req, res, next) => {
    const token = req.cookies.token; //  এটা আগে define করো
    console.log('cookie in the middleware', token)

    if (!token) {
        return res.status(401).send({ message: 'unauthorized access' });
    }

    jwt.verify(token, process.env.JWT_SECRET_KEY, (err, decoded) => {
        if (err) {
            return res.status(401).send({ message: 'unauthorized access' });
        }

        req.decoded = decoded; //  decoded user info req.user এ রাখো
        next(); //  সব কিছু ঠিক থাকলে পরবর্তী middleware বা route এ যাও
    });
};


// MongoDB Connection URI
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
        await client.connect();
        console.log(" MongoDB Connected");

        const itemCollection = client.db('lost&found').collection('items');
        const recoveredCollection = client.db('lost&found').collection('recovered');

        //jsonwebtoken
        app.post('/jwt', async(req, res) => {
            const user = req.body
                //token created
            const token = jwt.sign(user, process.env.JWT_SECRET_KEY, {
                expiresIn: '7d'
            })
            console.log(token)
            res.cookie('token', token, {
                httpOnly: true,
                secure: false,
                sameSite: 'Lax',

            })
            res.send({ success: true })
        })

        //  Get all items or filter by user's email
        app.get('/items', cookie, async(req, res) => {
            const userEmail = req.query.email;
            console.log('insite lost and found', req.cookies)
            const query = userEmail ? { userEmail } : {};
            const items = await itemCollection.find(query).toArray();
            res.send(items);
        });

        //  Get latest 6 items for home page
        app.get('/items/home', async(req, res) => {
            const items = await itemCollection.find().sort({ _id: -1 }).limit(6).toArray();
            res.send(items);
        });

        //  Get single item
        app.get('/items/:id', async(req, res) => {
            const id = req.params.id;
            const item = await itemCollection.findOne({ _id: new ObjectId(id) });
            res.send(item);
        });

        //  Add new item
        app.post('/items', async(req, res) => {
            const item = req.body;
            const result = await itemCollection.insertOne(item);
            res.send(result);
        });

        //  Update item
        app.put('/items/:id', async(req, res) => {
            const id = req.params.id;
            const updatedItem = req.body;
            const result = await itemCollection.updateOne({ _id: new ObjectId(id) }, { $set: updatedItem });
            res.send(result);
        });

        //  Delete item
        app.delete('/items/:id', async(req, res) => {
            const id = req.params.id;
            const result = await itemCollection.deleteOne({ _id: new ObjectId(id) });
            res.send(result);
        });

        //  Mark item as recovered (in items collection)
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
            res.send(result);
        });

        // Save recovered item to recoveredCollection
        app.post('/recovered', async(req, res) => {
            const recoveredData = req.body; // { title, recoveredLocation, recoveredDate, recoveredBy }
            const result = await recoveredCollection.insertOne(recoveredData);
            res.send(result);
        });

        //  Get recovered items by user email
        app.get('/recovered', cookie, async(req, res) => {
            const email = req.query.email;
            const query = { "recoveredBy.email": email };
            const items = await recoveredCollection.find(query).toArray();
            res.send(items);
        });



    } finally {
        // Optional: await client.close();
    }
}
run().catch(console.dir);

// Root
app.get('/', (req, res) => {
    res.send(' Lost & Found Server is Running!');
});

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});