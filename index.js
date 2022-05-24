const express = require("express");
const cors = require("cors");
const app = express();
const port = process.env.PORT || 5000;
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
require("dotenv").config();

app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.rpxyo.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverApi: ServerApiVersion.v1,
});

async function run() {
  try {
    await client.connect();
    const toolsCollection = client.db("ventrac").collection("tools");
    const ordersCollection = client.db("ventrac").collection("orders");
    const usersCollection = client.db("ventrac").collection("users");

    //get all tools
    app.get("/tools", async (req, res) => {
      const tools = await toolsCollection.find({}).toArray();
      res.send(tools);
    });

    //get a single tool by id
    app.get("/tools/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: ObjectId(id) };
      const tool = await toolsCollection.findOne(filter);
      res.send(tool);
    });

    //post orders
    app.post("/orders", async (req, res) => {
      const order = req.body;
      console.log(order);
      const result = await ordersCollection.insertOne(order);
      res.send(result);
    });

    //update quantity
    app.put("/tools/:id", async (req, res) => {
      const id = req.params.id;
      const newTool = req.body;
      const query = { _id: ObjectId(id) };
      const options = { upsert: true };
      const updatedDoc = {
        $set: {
          quantity: newTool.quantity,
        },
      };
      const result = await toolsCollection.updateOne(
        query,
        updatedDoc,
        options
      );
      res.send(result);
    });

    //put all users in database
    app.put("/user/:email", async (req, res) => {
      const email = req.params.email;
      const user = req.body;
      const filter = { email: email };
      const options = { upsert: true };
      const updatedDoc = {
        $set: user,
      };
      const result = await usersCollection.updateOne(
        filter,
        updatedDoc,
        options
      );
      res.send(result);
    });

    //get orders by specific user
    app.get("/orders", async (req, res) => {
      const email = req.query.email;
      const query = { email: email };
      const cursor = ordersCollection.find(query);
      const result = await cursor.toArray();
      res.send(result);
    });

    //Delete a order
    app.delete("/order/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: ObjectId(id) };
      const result = await ordersCollection.deleteOne(query);
      res.send(result);
    });
    //
  } finally {
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Hello World!");
});

app.listen(port, () => {
  console.log(`project listening on port ${port}`);
});
