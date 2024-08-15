const { MongoClient, ServerApiVersion } = require("mongodb")
const fs = require("fs")

const uri = "mongodb+srv://Josh:Password@chatapp.hvuyebo.mongodb.net/?retryWrites=true&w=majority&appName=chatapp";

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

client.connect();

const db = client.db("dev").collection("users")
const sessions = client.db("dev").collection("sessions")

const blocked = fs.readFileSync("pages/blocked.html", "utf8")

exports.auth = async function(req, res, callback) {
  try {
      const authData = await sessions.findOne({ uuid: req.cookies.sessionId });
      if (authData && authData.role === "user") {
          const user = await db.findOne({ username: authData.user });
          if (user) {
              authData.chats = user.chats; // Attach chat access data
              return callback(authData);
          } else {
              throw new Error("User not found");
          }
      } else {
          throw new Error("Not authorized");
      }
  } catch (error) {
      console.error("Auth error:", error.message);
      if (!res.headersSent) {
          res.writeHead(403);
          res.end(blocked);
      }
  }
}