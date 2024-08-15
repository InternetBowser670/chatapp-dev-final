const WebSocket = require('ws');

const createWebSocketServer = (server) => {
  const wss = new WebSocket.Server({ server });

  wss.on('connection', (ws) => {
    console.log('New client connected');

    ws.on('message', (message) => {
      const data = JSON.parse(message);
      const { chatname, content } = data;

      // Broadcast the message to all clients
      wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify({ chatname, content }));
        }
      });
    });

    ws.on('close', () => {
      console.log('Client disconnected');
    });
  });

  console.log(`WebSocket server started`);
  return wss; // Return the WebSocket server instance
};

module.exports = createWebSocketServer;
