require('dotenv').config();
const express = require('express');
const app = express();
const cors = require('cors')
const port = process.env.PORT || 5000;
const { MongoClient, ServerApiVersion } = require('mongodb');

//middlewars
app.use(cors());
app.use(express.json())
    ///💞💞💞💞💞💞//////
    //const uri = "mongodb+srv://${process.}:<db_password>@cluster0.eoybt2t.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";
const uri = `mongodb+srv://${process.env.DB_USER_NAME}:${process.env.DB_USER_PASS}@cluster0.eoybt2t.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function run() {
    try {
        // Connect the client to the server	(optional starting in v4.7)
        await client.connect();
        /////✌️✌️jotho kaj ar vitorei✌️✌️/////
        const jobCollection = client.db('lost&found').collection('items')
            //job api///()
        app.get('/items', async(req, res) => {
                const cursor = jobCollection.find()
                const result = await cursor.toArray()
                res.send(result)
            })
            /////✌️✌️✌️✌️/////

        // Send a ping to confirm a successful connection
        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        //   await client.close();
    }
}
run().catch(console.dir);

//////💞💞💞💞💞//////



app.get('/', (req, res) => {
    res.send('Carrer Code Cooking!')
})

app.listen(port, () => {
    console.log(`Career Code Server is Running on port ${port}`)
})