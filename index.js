const express = require("express");
const bodyParser = require("body-parser");
const multer = require("multer");
const bcrypt = require("bcryptjs");
const { MongoClient, ServerApiVersion } = require("mongodb");
const cookieParser = require("cookie-parser");
const pug = require("pug");
const path = require("path");
const { auth } = require("./authorize");
const crypto = require("crypto");
const fs = require("fs");
const http = require("http");
const createWebSocketServer = require("./websocketServer"); // Import WebSocket server
const WebSocket = require("ws");
const { Console } = require("console");
const run = process.env.RUN;
const favicon = toString(path.join(__dirname, "/assets/images/favicon.ico"));

let webURL;
let wsURL;

if (run == "replit") {
  webURL =
    "https://0a6fdb98-b50a-49c7-950a-d0819e477728-00-18ck1q89xklz3.worf.replit.dev:3000/";
  console.log("Web URL is on Replit");
  wsURL =
    "https://0a6fdb98-b50a-49c7-950a-d0819e477728-00-18ck1q89xklz3.worf.replit.dev:8080/";
} else if (run == "local") {
  webURL = "http://localhost:3000/";
  wsURL = "http://localhost:8080/";
  console.log("Web URL is local");
} else {
  console.log(
    "Error: RUN environment variable not set to 'replit' or 'local'.",
  );
  console.error("You sold blud");
}

const uri =
  "mongodb+srv://Josh:Password@chatapp.hvuyebo.mongodb.net/?retryWrites=true&w=majority&appName=chatapp";

const secretKey = crypto.randomBytes(32);

const icon = path.join(__dirname, "/assets/images/favicon.ico");

console.log("secretkey is: ", secretKey);

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

client.connect();

const db = client.db("dev");
const users = client.db("dev").collection("users");
const sessions = client.db("dev").collection("sessions");
const chats = client.db("dev").collection("chats");

const app = express();
const server = http.createServer(app);
const wsPort = 8080;

app.use(cookieParser());
app.use("/static", express.static("static"));
const upload = multer();
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(upload.array());
app.use(express.json()); // For parsing application/json

const login = fs.readFileSync("pages/login.html", "utf8");
const signup = fs.readFileSync("pages/signup.html", "utf8");
const blocked = fs.readFileSync("pages/blocked.html", "utf8");
const changeBday = fs.readFileSync("pages/changeBday.html", "utf8");
const homepage = fs.readFileSync("pages/homepage.html", "utf8");

// Compile pug template(s)
const dashboard = pug.compileFile("./templates/dashboard.pug");

app.get("/", (req, res) => {
  console.log("user conected (root)");
  res.sendFile(icon);
  res.end(homepage);
});

app.get("/createacc", (req, res) => {
  console.log("2");
  if (req.cookies.sessionId) {
    res.redirect("/dashboard");
    return;
  } else {
    res.sendFile(icon);
    res.end(signup);
  }
});

app.get("/login", (req, res) => {
  if (req.cookies.sessionId) {
    res.redirect("/dashboard");
    return;
  }
  res.sendFile(icon);
  res.end(login);
});

app.post("/login", async (req, res) => {
  var userQuery = users.findOne({ username: req.body.username });
  userQuery.then((user) => {
    if (!user) {
      res.sendFile(icon);
      res.writeHead(400);
      res.end();
      return;
    }
    bcrypt.compare(req.body.password, user.password, (err, result) => {
      if (result) {
        var session = generateSessionId(req.body.username);
        res.cookie("sessionId", session);
        res.writeHead(200);
      } else {
        res.writeHead(400);
      }
      res.sendFile(icon);
      res.end();
    });
  });
});

app.post("/signup", async (req, res) => {
  try {
    const userexists = await users.findOne({ username: req.body.username });
    if (userexists) {
      console.log("User already exists");
      res.status(400).json({ message: "User already exists" }); // Send JSON response for error
    } else {
      bcrypt.hash(req.body.password, 10, async (err, hash) => {
        if (err) {
          console.error("Error hashing password:", err);
          res.status(500).json({ message: "Internal Server Error" });
          return;
        }

        var user = {
          username: req.body.username,
          password: hash,
          birthday: req.body.bday,
          chats: [],
        };

        await users.insertOne(user);
        var session = generateSessionId(req.body.username);
        res.cookie("sessionId", session);
        res.status(200).json({ message: "Account created successfully" }); // Send JSON response for success
      });
    }
  } catch (error) {
    console.error("Error during signup:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

app.get("/updateBirthday", (req, res) => {
  auth(req, res, (authData) => {
    res.sendFile(icon);
    res.end(changeBday);
  });
});

app.get("/dashboard", async (req, res) => {
  auth(req, res, async (authData) => {
    try {
      // Get user data
      var userData = await users.findOne({ username: authData.user });

      // Get chat names from user data
      var chatNames = userData.chats || []; // Default to empty array if no chats are found

      // Render the dashboard with chat names
      var html = dashboard({
        name: userData.username,
        birthday: userData.birthday,
        chats: chatNames,
      });
      res.sendFile(icon);
      res.end(html);
    } catch (error) {
      console.error("Error loading dashboard:", error);
      res.status(500).send("Internal Server Error");
    }
  });
});

app.get("/chats/:chatname", async (req, res) => {
  const chatname = req.params.chatname;

  // Use the auth function to verify the user
  auth(req, res, async (authData) => {
    // Check if the user has access to the requested chat
    if (!authData.chats.includes(chatname)) {
      return res.status(403).send("Access denied");
    }

    // Fetch chat messages
    const chatCollection = client.db("dev").collection(chatname);
    const messages = await chatCollection.find({ type: "msg" }).toArray();
    let formattedMessages = ""; // Declare outside the if-else block

    if (messages.length > 0) {
      // Check if there are messages in the array
      formattedMessages = messages
        .map((msg) => {
          const username = msg.username || "Unknown";
          const content = msg.content || "No content";
          return `<p><strong>${username}:</strong> ${content}</p>`;
        })
        .join("\n");
    } else {
      console.log("No messages found");
      formattedMessages = ""; // Default to an empty string if there are no messages
    }

    // Prepare the HTML content
    const defaultContent = `
      <html>
      <head>
        <link rel="stylesheet" href="/styles/style.css">
        <title>Convo: ${chatname}</title>
        <link rel="icon" href="/favicon.ico" type="image/x-icon">
      </head>
      <body>
        <h1>Chat: ${chatname}</h1>
        <div id="messages">${formattedMessages}</div>
        <form id="messageForm" method="POST" action="/messages/${chatname}">
          <input type="text" id="messageInput" name="message" placeholder="Message">
          <input type="submit" name="submit">
        </form>
        <script>
          const ws = new WebSocket(\`${wsURL}\`);
const messagesDiv = document.getElementById('messages');
const messageForm = document.getElementById('messageForm');
const messageInput = document.getElementById('messageInput');
const chatname = "${chatname}";
const username = "${authData.user}";

ws.onmessage = event => {
    let data;

    if (typeof event.data === 'string') {
        data = event.data;
    } else if (event.data instanceof Blob) {
        const reader = new FileReader();
        reader.onload = () => {
            data = reader.result;
            processMessage(data);
        };
        reader.readAsText(event.data);
        return;
    } else if (event.data instanceof ArrayBuffer) {
        data = new TextDecoder().decode(event.data);
    } else {
        console.error('Unsupported WebSocket message type:', event.data);
        return;
    }

    processMessage(data);
};

function processMessage(data) {
    try {
        const parsedData = JSON.parse(data);
        const { chatname: incomingChatname, username: incomingUsername, content } = parsedData;

        if (incomingChatname && incomingUsername && content) {
            if (incomingChatname === chatname) {
                const messageElement = document.createElement('div');
                messageElement.innerHTML = \`<strong>\${incomingUsername}:</strong> \${content} <br> <br>\`;
                messagesDiv.appendChild(messageElement);

            }
        } else {
            console.error('Incomplete message data:', parsedData);
        }
    } catch (error) {
        console.error('Error parsing message data:', error);
    }
}

messageForm.addEventListener('submit', event => {
    event.preventDefault();
    if (messageInput.value.trim() !== '') {
    return
    }
    var formData = new FormData(messageForm);
    fetch("/messages/${chatname}", {
    method: "POST",
    body: formData,
    header: {
      "Content-Type": "multipart/form-data"
    }
  })

    const message = messageInput.value;
    if (message && username) {
        ws.send(JSON.stringify({ chatname, username, content: message }));
        messageInput.value = '';
    }
});

ws.onopen = () => {
    console.log('WebSocket connection established');
};

ws.onerror = (error) => {
    console.error('WebSocket error:', error);
};

ws.onclose = () => {
    console.log('WebSocket connection closed');
};

        </script>
      </body>
      </html>
    `;

    res.send(defaultContent);
  });
});

app.post("/createchats", async (req, res) => {
  console.log("e");
  try {
    await auth(req, res, async (authData) => {
      try {
        const { chatname, password } = req.body;

        // Check if the chat collection already exists
        const existingChat = await client
          .db("dev")
          .listCollections({ name: chatname })
          .toArray();
        if (existingChat.length > 0) {
          // Verify password
          const chatCollection = client.db("dev").collection(chatname);
          const chatData = await chatCollection.findOne({ type: "meta" });
          if (chatData && chatData.password === password) {
            const result = await users.updateOne(
              { username: authData.user },
              { $push: { chats: chatname } },
            );
            console.log(`${result.modifiedCount} document(s) updated.`);
            return res.redirect("/dashboard");
          } else {
            return res
              .status(400)
              .send(
                'Invalid password, <a href="/dashboard">Click to go to the dashboard</a>',
              );
          }
        } else {
          // Create the new chat collection
          await client.db("dev").createCollection(chatname);

          // Insert chat metadata (including password)
          const chatCollection = client.db("dev").collection(chatname);
          const chats = client.db("dev").collection("chats");
          await chatCollection.insertOne({
            name: chatname,
            password,
            type: "meta",
          });

          // Update user's chat list
          await users.updateOne(
            { username: authData.user },
            { $push: { chats: chatname } },
          );
          return res.redirect("/dashboard");
        }
      } catch (error) {
        console.error("Error during chat operation:", error);
        if (!res.headersSent) {
          return res
            .status(500)
            .send(
              'Internal Server Error, <a href="/dashboard">Click to go to the dashboard</a>',
            );
        }
      }
    });
  } catch (error) {
    console.error("Unexpected error in /createchats endpoint:", error);
    if (!res.headersSent) {
      return res.status(500).send("Internal Server Error");
    }
  }
});

app.get("/logout", (req, res) => {
  sessions.deleteOne({ uuid: req.cookies.sessionId });
  res.clearCookie("sessionId");
  res.writeHead(200);
  res.sendFile(icon);
  res.end("<p>You have logged out</p>");
});

app.post("/messages/:chatname", (req, res) => {
  console.log("message recieved");
  auth(req, res, async (authData) => {
    const chatname = req.params.chatname;
    const message = req.body.message;
    const username = authData.user;

    const chatCollection = client.db("dev").collection(chatname);

    console.log(chatname, message, username);

    await chatCollection.insertOne({
      username,
      content: message,
      type: "msg",
    });

    const formattedMessage = JSON.stringify({
      chatname,
      content: `<p><strong>${username}:</strong> ${message}</p>`,
    });

    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(formattedMessage);
      }
    });

    res.redirect(`/chats/${chatname}`);
  });
});

app.post("/updateUser", (req, res) => {
  auth(req, res, (authData) => {
    users.updateOne(
      { username: authData.user },
      {
        $set: {
          birthday: {
            month: req.body.month,
            day: req.body.day,
            year: req.body.year,
          },
        },
      },
    );
    res.sendFile(icon);
    res.end();
  });
});

app.get("/favicon.ico", (req, res) => {
  console.log("favicon");
  res.sendFile(icon);
});

function generateSessionId(username) {
  var uuid = crypto.randomUUID();
  sessions.insertOne({
    uuid: uuid,
    user: username,
    role: "user",
  });
  return uuid;
}

// Create a WebSocket server
const wss = new WebSocket.Server({ server });

wss.on("connection", (socket) => {
  console.log("New client connected");

  socket.on("message", (message) => {
    console.log("!!!");
    console.log(`Received: ${message}`);

    // Broadcast the message to all connected clients
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  });

  socket.on("close", () => {
    console.log("Client disconnected");
  });
});

// Start ws the server on port 8080
server.listen(8080, () => {
  console.log("WS Server is listening on port 8080");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server started on port ${PORT}`);
});
