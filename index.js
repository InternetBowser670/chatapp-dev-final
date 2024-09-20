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
const WebSocket = require("ws");
const run = process.argv[2];
const stylesheet = path.join(__dirname, "/assets/style/style.css");
const metascraper = require("metascraper")([
  require("metascraper-image")(),
  require("metascraper-title")(),
  require("metascraper-description")(),
  require("metascraper-url")(),
]);

const { fetchUrlPreview } = require("@internetbowser/linkpreview");

const wsPort = 8080;

let webURL;
let wsURL;

if (run == "replit") {
  webURL =
    "https://0a6fdb98-b50a-49c7-950a-d0819e477728-00-18ck1q89xklz3.worf.replit.dev:3000/";
  console.log("Web URL is on Replit");
  wsURL = `https://0a6fdb98-b50a-49c7-950a-d0819e477728-00-18ck1q89xklz3.worf.replit.dev:${wsPort}/`;
} else if (run == "local") {
  webURL = "http://localhost:3000/";
  wsURL = `http://localhost:${wsPort}/`;
  console.log("Web URL is local");
} else {
  console.log(
    "Error: RUN environment variable not set to 'replit' or 'local'.",
  );
  throw new "Run not set to 'replit' or 'local'. in the cli args."();
}

fetchUrlPreview("https://google.com").then((previewHtml) => {
  console.log("google: ", previewHtml);
});

const uri =
  "mongodb+srv://Josh:Password@chatapp.hvuyebo.mongodb.net/?retryWrites=true&w=majority&appName=chatapp";

const secretKey = crypto.randomBytes(32);

const icon = path.join(__dirname, "/assets/images/favicon.ico");
const settingsGear = path.join(__dirname, "/assets/images/settings.png");
const trashcan = path.join(__dirname, "/assets/images/trashcan.png");

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

app.use(cookieParser());
app.use("/static", express.static("static"));
const upload = multer();
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(upload.array());
app.use(express.json());

const login = fs.readFileSync("pages/login.html", "utf8");
const updateUsername = fs.readFileSync("pages/changeName.html", "utf8");
const signup = fs.readFileSync("pages/signup.html", "utf8");
const blocked = fs.readFileSync("pages/blocked.html", "utf8");
const changeBday = fs.readFileSync("pages/changeBday.html", "utf8");
const homepage = fs.readFileSync("pages/homepage.html", "utf8");
const settings = fs.readFileSync("pages/settings.html", "utf8");
const scroll = path.join(__dirname, "/static/scroll.js");

// Compile pug template(s)
const dashboard = pug.compileFile("./templates/dashboard.pug");

app.get("/", (req, res) => {
  res.sendFile(icon);
  res.end(homepage);
});

async function formatMessagesWithPreviews(messages) {
  const urlRegex = /(https?:\/\/[^\s]+)/g;

  const formattedMessagesPromises = messages.map(async (msg) => {
    const username = msg.username || "Unknown";
    let content = msg.content || "No content";

    const urls = content.match(urlRegex);
    if (urls) {
      for (const url of urls) {
        try {
          const previewHtml = await fetchUrlPreview(url);
          content = content.replace(url, previewHtml);
        } catch (error) {
          console.error("Error fetching URL preview:", error);
        }
      }
    }

    // Return the formatted message with or without the preview
    return `<p><strong>${username}:</strong> ${content}</p>`;
  });

  // Wait for all promises to resolve and join the results into a single string
  const formattedMessages = await Promise.all(formattedMessagesPromises);
  return formattedMessages.join("\n");
}


function authorizeWithPass(req, res, authData) {
  var userQuery = users.findOne({ username: authData.user });
  return userQuery.then((user) => {
    if (!user) {
      res.sendFile(icon);
      res.writeHead(400);
      res.end();
      return false; // Return false if user not found
    } else {
      return new Promise((resolve, reject) => {
        bcrypt.compare(req.body.password, user.password, (err, result) => {
          if (err) {
            reject(err); // Handle bcrypt errors
          } else if (result) {
            resolve(true); // Resolve with true if password matches
          } else {
            resolve(false); // Resolve with false if password doesn't match
          }
        });
      });
    }
  });
}

async function handleMessage(chatname, username, content) {
  let preview = null;
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const urls = content.match(urlRegex);

  if (urls && urls.length > 0) {
    const url = urls[0]; // Only preview the first URL for simplicity
    try {
      // Dynamically import 'got'
      const got = (await import("got")).default;

      const { body: html, url: fetchedUrl } = await got(url);
      const metadata = await metascraper({ html, url: fetchedUrl });
      preview = {
        title: metadata.title,
        description: metadata.description,
        image: metadata.image,
      };
    } catch (error) {
      console.error("Failed to fetch link preview:", error);
    }
  }

  return preview;
}

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
    } else {
      bcrypt.compare(req.body.password, user.password, (err, result) => {
        if (result) {
          var session = generateSessionId(
            req.body.username,
            userQuery.originalName,
          );
          res.cookie("sessionId", session);
          res.writeHead(200);
        } else {
          res.writeHead(403);
        }
        res.sendFile(icon);
        res.end();
      });
    }
  });
});

app.get("/assets/images/settings.png", (req, res) => {
  res.sendFile(settingsGear);
});

app.post("/signup", async (req, res) => {
  try {
    const userexists =
      (await users.findOne({ username: req.body.username })) +
      (await users.findOne({ originalName: req.body.username }));
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
          originalName: req.body.username,
          password: hash,
          birthday: req.body.bday,
          chats: [],
        };

        await users.insertOne(user);
        var session = generateSessionId(req.body.username, req.body.username);
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
    console.log("page accesed")
    console.log( await formatMessagesWithPreviews(messages))
    //formattedMessages = await formatMessagesWithPreviews(messages) !TO BE DONE LATER!
    // Prepare the HTML content
    const defaultContent = `
      <html>
      <head>
        <link rel="stylesheet" href="/styles/main">
        <title>Convo: ${chatname}</title>
        <link rel="icon" href="/favicon.ico" type="image/x-icon">
      </head>
      <body>
        <h1>Chat: ${chatname} | <a href="/dashboard">Dashboard</a></h1>
        <div id="messages" class="scrollable styleDiv">${formattedMessages}</div>
        <br>
        <form id="messageForm" method="POST" action="/messages/${chatname}">
          <input type="text" width=100% id="messageInput" autocomplete="off" readonly 
onfocus="this.removeAttribute('readonly');" name="message" name="message" placeholder="Message">
          <input type="submit" name="submit">
        </form>
        <script>
  let ws;
if (!ws || ws.readyState !== WebSocket.OPEN) {
    ws = new WebSocket(\`${wsURL}\`);
}
  const messagesDiv = document.getElementById('messages');
  const messageForm = document.getElementById('messageForm');
  const messageInput = document.getElementById('messageInput');
  const chatname = "${chatname}";
  const username = "${authData.user}";

  // Scroll to the bottom of the messages container
  function scrollToBottom() {
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
  }
  scrollToBottom();

  // Handle incoming WebSocket messages
  ws.onmessage = (event) => {
    console.log("WS RECEIVED MESSAGE");

    if (event.data instanceof Blob) {
        // If the message is a Blob, convert it to text first
        const reader = new FileReader();
        reader.onload = () => {
            try {
                const data = JSON.parse(reader.result);
                console.log(data);  // Log the data
                processMessage(data);  // Call processMessage once
            } catch (error) {
                console.error('Error parsing message:', error);
            }
        };
        reader.readAsText(event.data);
    } else {
        try {
            const data = JSON.parse(event.data);
            console.log(data);  // Log the data
            processMessage(data);  // Call processMessage once
        } catch (error) {
            console.error('Error parsing message:', error);
        }
    }

    // Ensure scrollToBottom is only called once, after handling the message
    scrollToBottom();
};

  // Function to handle the parsed message data
  function processMessage(data) {
    const { chatname: incomingChatname, username: incomingUsername, content } = data;
    console.log(chatname, username, content)
    // Check if the message is for the current chatroom
    if (incomingChatname === chatname) {
      const messageElement = document.createElement('div');
      const br = document.createElement('br');
      messageElement.innerHTML = \`<strong>\${incomingUsername}:</strong> \${content}\`;
      console.log(\`<strong>\${incomingUsername}:</strong> \${content}\`)
      // Append the new message to the chat window
      messagesDiv.appendChild(messageElement);
      messagesDiv.appendChild(br);
      // Scroll to the bottom
      scrollToBottom();
    }
  }

  // Handle message submission
  messageForm.addEventListener('submit', (event) => {
    event.preventDefault();

    // Optionally, submit the message to the server (if you want to save it on the backend)
      const formData = new FormData(messageForm); // Capture form data
    console.log("formdata: ", [...formData.entries()]); // Log the form data

    fetch(\`/messages/${chatname}\`, {
      method: 'POST',
      body: formData
    })


    const message = messageInput.value.trim();
    if (message) {
      // Send message to server via WebSocket
      ws.send(JSON.stringify({ chatname, username, content: message }));

      // Clear input field after sending
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
  res.end(homepage);
});

app.post("/messages/:chatname", (req, res) => {
  auth(req, res, async (authData) => {
    const chatname = req.params.chatname;
    const message = req.body.message;
    const username = authData.user;
    const chatCollection = client.db("dev").collection(chatname);

    await chatCollection.insertOne({
      username,
      content: message,
      type: "msg",
    });

    const formattedMessage = JSON.stringify({
      chatname,
      username,
      content: `<p><strong>${username}:</strong> ${message}</p>`,
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

app.post("/updateUsername", (req, res) => {
  auth(req, res, async (authData) => {
    try {
      // Use async/await for authorizeWithPass since it's asynchronous
      const isPasswordCorrect = await authorizeWithPass(req, res, authData);
      if (isPasswordCorrect) {
        const result = await users.updateOne(
          { originalName: authData.originalName },
          { $set: { username: req.body.name } }, // Update operation
        );
        // Check if the document was updated
        if (result.modifiedCount > 0) {
          res.sendFile(icon); // Respond with the icon file
          console.log("w");
          sessions.deleteOne({ uuid: req.cookies.sessionId });
          res.clearCookie("sessionId");
          res.sendFile(icon);
          var session = generateSessionId(req.body.name, authData.originalName);
          res.cookie("sessionId", session);
          res.end(login);
        } else {
          res.status(400).send("No document was updated");
          console.log("nah");
        }
      } else {
        res.json({ message: "Incorrect Password" });
      }
    } catch (error) {
      console.error(error); // Log any errors
      res.status(500).send("Error updating username");
    }
  });
});

app.get("/styles/main", (req, res) => {
  res.sendFile(stylesheet);
});

app.get("/ping", (req, res) => {
  res.send("pong"); // Respond quickly
});

app.get("/favicon.ico", (req, res) => {
  res.sendFile(icon);
});

app.get("/changename", (req, res) => {
  auth(req, res, async (authData) => {
    res.end(updateUsername);
  });
});

app.get("/settings", (req, res) => {
  auth(req, res, async (authData) => {
    if (authData.user) {
      res.end(settings);
    }
  });
});

app.get("/assets/trashcan.png", (req, res) => {
  res.sendFile(trashcan);
});

app.post("/deletechat/:chatname", (req, res) => {
  const chatname = req.params.chatname;
  auth(req, res, async (authData) => {
    const username = authData.user;
    users.updateOne(
      { username: username }, // Find the user by username
      { $pull: { chats: chatname } }, // Remove the chat from the 'chats' array
    );

    res.redirect(dashboard);
  });
});

app.get("/scripts/scroll", (req, res) => {
  res.sendFile(scroll);
});

function generateSessionId(username, originalName) {
  var uuid = crypto.randomUUID();
  sessions.insertOne({
    uuid: uuid,
    originalName,
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

// Start ws the server on wsport
server.listen(wsPort, () => {
  console.log(`WS Server is listening on port ${wsPort}`);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server started on port ${PORT}`);
});
