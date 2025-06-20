const form = document.getElementById('chat-form');
const input = document.getElementById('user-input');
const chatBox = document.getElementById('chat-box');

form.addEventListener('submit', function (e) {
  e.preventDefault();

  const userMessage = input.value.trim();
  if (!userMessage) return;

  appendMessage('user', userMessage);
  input.value = ''; // Clear input field immediately

  // Send the message to the backend
  fetch('/api/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    // The backend expects a body like: { "message": { "userMessage": "Actual text" } }
    body: JSON.stringify({ message: { userMessage: userMessage } }),
  })
    .then(response => {
      if (!response.ok) {
        // If the server response is not OK (e.g., 400, 500), throw an error
        return response.json().then(errData => {
          throw new Error(errData.reply || `HTTP error! status: ${response.status}`);
        });
      }
      return response.json(); // Parse the JSON response from the backend
    })
    .then(data => {
      appendMessage('bot', data.reply); // Display the bot's reply
    })
    .catch(error => {
      console.error('Error fetching chat response:', error);
      appendMessage('bot', `Sorry, something went wrong: ${error.message}`); // Display an error message
    });
});

function appendMessage(sender, text) {
  const msg = document.createElement('div');
  msg.classList.add('message', sender);
  msg.textContent = text;
  chatBox.appendChild(msg);
  chatBox.scrollTop = chatBox.scrollHeight;
}
