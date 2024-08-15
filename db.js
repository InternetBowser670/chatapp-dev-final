
const { MongoClient, ServerApiVersion } = require('mongodb');
const uri = "mongodb+srv://Josh:Password@chatapp.hvuyebo.mongodb.net/?retryWrites=true&w=majority&appName=chatapp";

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

client.connect()

const db = client.db("dev");

(async function() {
  if (process.argv[2] == "find"){
    console.log(process.argv[2])
    console.log(process.argv[3])
    var collection = db.collection(process.argv[3]);
    var records = collection.find({})
    for await (var record of records) {
      console.log(record);
    }
  } else if (process.argv[2] == "delete") {
    if (process.argv[3] = "all"){
      try {

          const collections = await db.listCollections().toArray();
          const dropPromises = collections.map(({ name }) => db.collection(name).drop());
  
          await Promise.all(dropPromises);
          console.log('All collections dropped.');
      } catch (err) {
          console.error(err);
      } finally {
          await client.close();
      }
      return
    }
    var collection = db.collection(process.argv[3])
    await collection.deleteMany({})
    console.log("Deleted " + process.argv[3])
  } 

  client.close();
})()