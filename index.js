const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const app = express();
const port = process.env.PORT || 5000;
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
require("dotenv").config();
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const nodemailer = require("nodemailer");
const mg = require("nodemailer-mailgun-transport");

app.use(cors());
const corsConfig = {
  origin: "*",
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE"],
};

app.use(cors(corsConfig));
app.options("*", cors(corsConfig));
app.use(express.json());
app.use(function (req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept,authorization"
  );
  next();
});
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.rpxyo.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverApi: ServerApiVersion.v1,
});

//verifying token
const verifyJWT = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).send({ message: "UnAuthorized Access" });
  }
  const token = authHeader.split(" ")[1];
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, function (err, decoded) {
    if (err) {
      return res.status(401).send({ message: "Invalid Token" });
    }
    req.decoded = decoded;
    next();
  });
};

//sending mail through mailgun
const auth = {
  auth: {
    api_key: "c9dfd494118badc0e6f858572fc88f0a-27a562f9-3551a8ac",
    domain: "sandbox2ee96933452d4682b1e24787a401ec73.mailgun.org",
  },
};

const nodemailerMailgun = nodemailer.createTransport(mg(auth));

function sendOrderMail(order) {
  const {
    address,
    number,
    quantity,
    name,
    productName,
    email,
    price,
    transactionId,
  } = order;

  var emailSend = {
    from: "ventrac@gmail.com",
    to: email,
    subject: `Your order for ${productName} is is Confirmed`,
    text: `Your order for ${productName} is is Confirmed`,
    html: `
      <div>
        <p> Hello ${name}, </p>
        <h3 style="color:green">Your order for ${productName} is confirmed</h3>
        <p>Your Ordered Quantity: ${quantity}</p>
        <p>Price: $${price}</p>
        <h3>Our Address</h3>
        <p>Andor Killa Bandorban</p>
        <p>Bangladesh</p>
        <a href="https://web.programming-hero.com/">unsubscribe</a>
      </div>
    `,
  };
  nodemailerMailgun.sendMail(emailSend, (err, info) => {
    if (err) {
      console.log(err);
    } else {
      console.log(info);
    }
  });
}

async function run() {
  try {
    await client.connect();
    //all collections
    const toolsCollection = client.db("ventrac").collection("tools");
    const ordersCollection = client.db("ventrac").collection("orders");
    const usersCollection = client.db("ventrac").collection("users");
    const reviewsCollection = client.db("ventrac").collection("reviews");
    const paymentCollection = client.db("ventrac").collection("payments");

    /* --------api section started--------- */

    //get all tools
    app.get("/tools", async (req, res) => {
      const tools = await toolsCollection.find({}).toArray();
      res.send(tools);
    });

    //post tools
    app.post("/tools", verifyJWT, async (req, res) => {
      const tool = req.body;
      const result = await toolsCollection.insertOne(tool);
      res.send(result);
    });

    //get a single tool by id
    app.get("/tools/:id", verifyJWT, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: ObjectId(id) };
      const tool = await toolsCollection.findOne(filter);
      res.send(tool);
    });

    //stripe
    app.post("/create-payment-intent", verifyJWT, async (req, res) => {
      const { price } = req.body;
      const amount = price * 100;
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: "usd",
        payment_method_types: ["card"],
      });
      res.send({
        clientSecret: paymentIntent.client_secret,
      });
    });

    //post orders
    app.post("/orders", verifyJWT, async (req, res) => {
      const order = req.body;
      sendOrderMail(order);
      const result = await ordersCollection.insertOne(order);
      res.send(result);
    });

    //update orders
    app.patch("/orders/:id", verifyJWT, async (req, res) => {
      const id = req.params.id;
      const payment = req.body;
      const filter = { _id: ObjectId(id) };
      const updateDoc = {
        $set: {
          paid: true,
          transactionId: payment.transactionId,
        },
      };
      const result = await paymentCollection.insertOne(payment);
      const updatedOrder = await ordersCollection.updateOne(filter, updateDoc);
      res.send(updateDoc);
    });

    //post reviews
    app.post("/reviews", async (req, res) => {
      const review = req.body;
      const result = await reviewsCollection.insertOne(review);
      res.send(result);
    });

    //get all reviews
    app.get("/reviews", async (req, res) => {
      const reviews = await reviewsCollection.find({}).toArray();
      res.send(reviews);
    });

    //update quantity
    app.put("/tools/:id", verifyJWT, async (req, res) => {
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

    //get all users
    app.get("/users", verifyJWT, async (req, res) => {
      const users = await usersCollection.find({}).toArray();
      res.send(users);
    });

    //get a specific user by email
    app.get("/user", verifyJWT, async (req, res) => {
      const email = req.query.email;
      const query = { email: email };
      const cursor = usersCollection.find(query);
      const result = await cursor.toArray();
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
      const token = jwt.sign(
        { email: email },
        process.env.ACCESS_TOKEN_SECRET,
        {
          expiresIn: "1d",
        }
      );
      res.send({ result, token });
    });

    //get admin
    app.get("/admin/:email", verifyJWT, async (req, res) => {
      const email = req.params.email;
      const user = await usersCollection.findOne({ email: email });
      const isAdmin = user.role === "admin";
      res.send({ admin: isAdmin });
    });

    //admin role
    app.put("/user/admin/:email", verifyJWT, async (req, res) => {
      const email = req.params.email;
      const requester = req.decoded.email;
      const requesterAccount = await usersCollection.findOne({
        email: requester,
      });
      if (requesterAccount.role === "admin") {
        const filter = { email: email };
        const updatedDoc = {
          $set: { role: "admin" },
        };
        const result = await usersCollection.updateOne(filter, updatedDoc);
        res.send(result);
      } else {
        res.status(403).send({ message: "Forbidden" });
      }
    });

    //get orders by specific user
    app.get("/orders", verifyJWT, async (req, res) => {
      const email = req.query.email;
      const decodedEmail = req.decoded.email;
      if (email === decodedEmail) {
        const query = { email: email };
        const cursor = ordersCollection.find(query);
        const result = await cursor.toArray();
        res.send(result);
      } else {
        return res.status(403).send({ message: "Forbidden Access" });
      }
    });

    //get orders by specific id
    app.get("/orders/:id", verifyJWT, async (req, res) => {
      const id = req.params.id;
      const query = { _id: ObjectId(id) };
      const order = await ordersCollection.findOne(query);
      res.send(order);
    });

    //get all orders
    app.get("/all-orders", verifyJWT, async (req, res) => {
      const orders = await ordersCollection.find({}).toArray();
      res.send(orders);
    });

    //update a order
    app.put("/all-orders/:id", verifyJWT, async (req, res) => {
      const id = req.params.id;
      const newStatus = req.body;
      const query = { _id: ObjectId(id) };
      const options = { upsert: true };
      const updatedDoc = {
        $set: {
          status: newStatus.status,
        },
      };
      const result = await ordersCollection.updateOne(
        query,
        updatedDoc,
        options
      );
      res.send(result);
    });

    //Delete a order
    app.delete("/order/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: ObjectId(id) };
      const result = await ordersCollection.deleteOne(query);
      res.send(result);
    });

    //Delete a tool
    app.delete("/tool/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: ObjectId(id) };
      const result = await toolsCollection.deleteOne(query);
      res.send(result);
    });

    /* --------api section ended--------- */
  } finally {
  }
}
run().catch(console.dir);

//send email notification for testing purposes
// app.post("/send-email", async (req, res) => {
//   const order = req.body;
//   sendOrderMail(order);
//   res.send({ status: "success" });
// });

app.get("/", (req, res) => {
  res.send("Hello World!");
});

app.listen(port, () => {
  console.log(`project listening on port ${port}`);
});
