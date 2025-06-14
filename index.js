require('dotenv').config();
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken') //jwt
const cookieParser = require('cookie-parser') //cookie jwt
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');

const app = express();
const port = process.env.PORT || 5000;

// Middleware
app.use(cors({
    origin: 'http://localhost:5173', //jwt
    credentials: true //jwt
}));
app.use(express.json());

//jwt created
app.use(cookieParser())
    //////////
const logger = (req, res, next) => {
        console.log('inside the logger middlewer')
        next()
    }
    ///////cookies
const cookie = (req, res, next) => {
    const token = req.cookies.token;
    console.log('cookie in the middleware', token)

    if (!token) {
        return res.status(401).send({ message: 'unauthorized access' });
    }

    jwt.verify(token, process.env.JWT_SECRET_KEY, (err, decoded) => {
        if (err) {
            return res.status(401).send({ message: 'unauthorized access' });
        }

        req.decoded = decoded; //  decoded user info req.user 
        next();
    });
};




//firebase token
var admin = require("firebase-admin");

var serviceAccount = require("./firebase.active.json");

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});




const verifyFirebase = async(req, res, next) => {
    const token = req.headers.authorizations;
    const vreify = req.headers.authorizations.split('')[1]
    if (!token) {
        return res.status(401).send({ message: 'unauthorized access' })
    }
    const userIf = await admin.auth().verifyIdToken(token)
    req.tokenEmail = userIf.email
    next()
}

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
            const token = jwt.sign({ userEmail: user.email }, process.env.JWT_SECRET_KEY, {
                expiresIn: '20d'
            });

            console.log(token)
            res.cookie('token', token, {
                httpOnly: true,
                secure: false,
                sameSite: 'Lax',
            })
            res.send({ success: true })
        })

        //  Get all items or filter by user's email
        /*  app.get('/items', cookie, logger, async(req, res) => { //use jwt
             const userEmail = req.query.email;
             console.log('insite lost and found', req.cookies) //jwt
             if (userEmail !== req.decoded.email) {
                 return res.status(403).send({ massege: 'forbidden access' })
             }
             const query = userEmail ? { userEmail } : {};
             const items = await itemCollection.find(query).toArray();
             res.send(items);
         }); */
        app.get('/items', cookie, logger, async(req, res) => { //use jwt
            const userEmail = req.query.email;
            console.log('insite lost and found', req.cookies) //jwt
            if (userEmail !== req.decoded.userEmail) {
                return res.status(403).send({ massege: 'forbidden access' })
            }
            //firebase
            /*     if (req.tokenEmail != userEmail) {
                    return res.status(403).send({ message: 'forbiddem access' })
                } */
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
        app.post('/items', cookie, async(req, res) => {
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
        app.post('/recovered', cookie, async(req, res) => {
            const recoveredData = req.body; // { title, recoveredLocation, recoveredDate, recoveredBy }
            const result = await recoveredCollection.insertOne(recoveredData);
            res.send(result);
        });

        //  Get recovered items by user email
        app.get('/recovered', cookie, async(req, res) => { //use cookies
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
})