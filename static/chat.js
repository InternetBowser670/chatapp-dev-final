// chat.js
let ws;
if (!ws || ws.readyState !== WebSocket.OPEN) {
  ws = new WebSocket(`${wsURL}`);
}

const messagesDiv = document.getElementById('messages');
const messageForm = document.getElementById('messageForm');
const messageInput = document.getElementById('messageInput');
const chatname = "{{chatname}}";
const username = "{{authData.user}}";

// Scroll to the bottom of the messages container
function scrollToBottom() {
  messagesDiv.scrollTop = messagesDiv.scrollHeight;
}
scrollToBottom();

ws.onmessage = (event) => {
  console.log("WS RECEIVED MESSAGE");

  if (event.data instanceof Blob) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        console.log(data);
        processMessage(data);
      } catch (error) {
        console.error('Error parsing message:', error);
      }
    };
    reader.readAsText(event.data);
  } else {
    try {
      const data = JSON.parse(event.data);
      console.log(data);
      processMessage(data);
    } catch (error) {
      console.error('Error parsing message:', error);
    }
  }
  scrollToBottom();
};

function processMessage(data) {
  const { chatname: incomingChatname, username: incomingUsername, content } = data;
  if (incomingChatname === chatname) {
    const messageElement = document.createElement('div');
    const br = document.createElement('br');
    messageElement.innerHTML = `<strong>${incomingUsername}:</strong> ${content}`;
    messagesDiv.appendChild(messageElement);
    messagesDiv.appendChild(br);
    scrollToBottom();
  }
}

messageForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const formData = new FormData(messageForm);
  console.log("formdata: ", [...formData.entries()]);
  fetch(`/messages/${chatname}`, { method: 'POST', body: formData });

  const message = messageInput.value.trim();
  if (message) {
    ws.send(JSON.stringify({ chatname, username, content: message }));
    messageInput.value = '';
  }
});

ws.onopen = () => console.log('WebSocket connection established');
ws.onerror = (error) => console.error('WebSocket error:', error);
ws.onclose = () => console.log('WebSocket connection closed');

async function applySavedColors() {
  try {
    const response = await fetch('/get-colors', { method: 'GET', headers: { 'Content-Type': 'application/json' } });
    if (response.ok) {
      const colors = await response.json();
      const color1 = colors.color1 || '#1c0166';
      const color2 = colors.color2 || '#100038';
      document.documentElement.style.backgroundImage = `linear-gradient(${color1}, ${color2})`;
    } else {
      console.error('Failed to fetch colors.');
    }
  } catch (error) {
    console.error('Error fetching colors:', error);
  }
}
window.addEventListener('load', applySavedColors);
