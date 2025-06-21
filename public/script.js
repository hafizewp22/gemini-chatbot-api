const form = document.getElementById('chat-form');
const input = document.getElementById('user-input');
const chatBox = document.getElementById('chat-box');
const welcomeScreen = document.getElementById('welcome-screen');

form.addEventListener('submit', function (e) {
  e.preventDefault();

  // Hide the welcome screen on the first interaction
  if (welcomeScreen && !welcomeScreen.classList.contains('hidden')) {
    welcomeScreen.classList.add('hidden');
  }

  const userMessage = input.value.trim();
  if (!userMessage) return;

  appendMessage('user', userMessage);
  input.value = ''; // Clear input field immediately

  sendMessageToServer(userMessage);
});

function sendMessageToServer(messageText) {
  // Add loading state to the UI to disable interactions like editing
  document.body.classList.add('is-loading');

  // Show loading indicator
  appendMessage('bot-loading', '');

  // Send the message to the backend
  fetch('/api/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    // The backend expects a body like: { "message": { "userMessage": "Actual text" } }
    body: JSON.stringify({ message: { userMessage: messageText } }),
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
    })
    .finally(() => {
      // Remove loading state from UI and chat
      document.body.classList.remove('is-loading');
      removeLoadingIndicator();
    });
}

function removeLoadingIndicator() {
  const loader = document.querySelector('.loading-indicator');
  if (loader) {
    loader.remove();
  }
}

function openInCodePen(code, lang) {
  const data = {
    title: "Gemini Code Assist Snippet",
    html: lang === 'html' ? code : '',
    css: lang === 'css' ? code : '',
    js: (lang === 'javascript' || lang === 'js') ? code : '',
  };

  const form = document.createElement('form');
  form.action = 'https://codepen.io/pen/define';
  form.method = 'POST';
  form.target = '_blank';
  form.style.display = 'none';

  const input = document.createElement('input');
  input.type = 'hidden';
  input.name = 'data';
  input.value = JSON.stringify(data);

  form.appendChild(input);
  document.body.appendChild(form);
  form.submit();
  document.body.removeChild(form);
}

function handleEdit(buttonEl) {
  const wrapper = buttonEl.closest('.user-message-wrapper');
  const messageDiv = wrapper.querySelector('.message.user');
  const originalText = messageDiv.textContent;

  // Store the original content to restore on cancel
  const originalContent = messageDiv.innerHTML;

  // Create edit UI
  messageDiv.innerHTML = `
      <textarea class="edit-textarea">${originalText}</textarea>
      <div class="edit-controls">
          <button class="save-edit-btn">Save & Submit</button>
          <button class="cancel-edit-btn">Cancel</button>
      </div>
  `;
  buttonEl.style.display = 'none';

  const saveBtn = messageDiv.querySelector('.save-edit-btn');
  const cancelBtn = messageDiv.querySelector('.cancel-edit-btn');
  const textarea = messageDiv.querySelector('.edit-textarea');
  textarea.focus();
  textarea.selectionStart = textarea.selectionEnd = textarea.value.length;

  const cleanup = () => {
    saveBtn.removeEventListener('click', onSave);
    cancelBtn.removeEventListener('click', onCancel);
  };

  const onSave = () => {
    const newText = textarea.value.trim();
    cleanup();

    if (newText && newText !== originalText) {
      // Restore message appearance
      messageDiv.innerHTML = '';
      messageDiv.textContent = newText;
      buttonEl.style.display = '';

      // Remove all subsequent messages
      let nextEl = wrapper.nextElementSibling;
      while (nextEl) {
        const toRemove = nextEl;
        nextEl = nextEl.nextElementSibling;
        toRemove.remove();
      }

      // Resubmit
      sendMessageToServer(newText);
    } else {
      // No change or empty, so just cancel
      onCancel();
    }
  };

  const onCancel = () => {
    cleanup();
    messageDiv.innerHTML = originalContent;
    buttonEl.style.display = '';
  };

  saveBtn.addEventListener('click', onSave);
  cancelBtn.addEventListener('click', onCancel);
}

function appendMessage(sender, text) {
  const msg = document.createElement('div');

  if (sender === 'bot-loading') {
    msg.classList.add('message', 'bot', 'loading-indicator');
    msg.innerHTML = `<div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div>`;
    chatBox.appendChild(msg);
    chatBox.scrollTop = chatBox.scrollHeight;
    return;
  }

  msg.classList.add('message', sender);

  if (sender === 'user') {
    const wrapper = document.createElement('div');
    wrapper.classList.add('user-message-wrapper');

    const editBtn = document.createElement('button');
    editBtn.classList.add('edit-btn');
    editBtn.innerHTML = '✏️';
    editBtn.title = 'Edit & Submit';

    msg.textContent = text;

    wrapper.appendChild(editBtn);
    wrapper.appendChild(msg);
    chatBox.appendChild(wrapper);

  } else { // sender === 'bot'
    // A more robust Markdown to HTML converter for bot messages
    let html = '';
    const lines = text.split('\n');
    let inTable = false;
    let inList = false;
    let inCodeBlock = false;
    let codeLang = '';
    let codeContent = '';

    // Helper function to process inline formatting like bold, italic, and code
    const processInline = (str) => str
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/`(.*?)`/g, (match, p1) => {
        // Sanitize the content to prevent XSS before wrapping in <code>
        const sanitized = p1.replace(/</g, "&lt;").replace(/>/g, "&gt;");
        return `<code>${sanitized}</code>`;
      });

    for (let i = 0; i < lines.length; i++) {
      let line = lines[i];

      // Code block detection (```)
      if (line.trim().startsWith('```')) {
        if (inCodeBlock) {
          // Closing the code block
          const sanitizedCode = codeContent.replace(/</g, "&lt;").replace(/>/g, "&gt;");
          const lang = codeLang || 'text';
          let tryItButtonHTML = '';
          if (['javascript', 'js', 'html', 'css'].includes(lang)) {
            tryItButtonHTML = `<button class="try-it-btn" data-lang="${lang}">Try It</button>`;
          }

          html += `<div class="code-block-wrapper">
                      <div class="code-block-header">
                          <span class="code-lang">${lang}</span>
                          <div class="code-block-buttons">
                              ${tryItButtonHTML}
                              <button class="copy-code-btn">Copy</button>
                          </div>
                      </div>
                      <pre><code class="language-${lang}">${sanitizedCode.trim()}</code></pre></div>`;
          inCodeBlock = false;
          codeContent = '';
          codeLang = '';
        } else {
          // Starting a new code block
          if (inList) { html += '</ul>'; inList = false; }
          if (inTable) { html += '</tbody></table></div>'; inTable = false; }
          inCodeBlock = true;
          codeLang = line.trim().substring(3).toLowerCase();
        }
        continue;
      }
      if (inCodeBlock) { codeContent += line + '\n'; continue; }

      // Table detection (header row + separator row)
      if (line.startsWith('|') && lines[i + 1] && lines[i + 1].match(/\|.*-.*\|/)) {
        if (inList) { html += '</ul>'; inList = false; } // Close previous list
        if (!inTable) {
          html += '<div class="table-wrapper"><table>';
          inTable = true;
          // Process Header
          const headers = line.slice(1, -1).split('|');
          html += `<thead><tr>${headers.map(h => `<th>${processInline(h.trim())}</th>`).join('')}</tr></thead><tbody>`;
          i++; // Skip separator line
          continue;
        }
      }

      // Table row
      if (inTable && line.startsWith('|')) {
        const cells = line.slice(1, -1).split('|');
        html += `<tr>${cells.map(c => `<td>${processInline(c.trim())}</td>`).join('')}</tr>`;
        continue;
      }

      // End of table
      if (inTable) { html += '</tbody></table></div>'; inTable = false; }

      // List detection (lines starting with * or -)
      if (line.match(/^(\* |\- )/)) {
        if (!inList) { html += '<ul>'; inList = true; }
        html += `<li>${processInline(line.substring(2))}</li>`;
        continue;
      }

      // End of list
      if (inList) { html += '</ul>'; inList = false; }

      // Subheading detection (line ends with a colon and is not a list item)
      if (line.trim().endsWith(':') && !line.match(/^(\* |\- )/)) {
        html += `<p><strong>${processInline(line.trim())}</strong></p>`;
        continue;
      }

      // Regular paragraph
      if (line.trim() !== '') { html += `<p>${processInline(line)}</p>`; }
    }

    // Close any open tags at the end of the message
    if (inTable) { html += '</tbody></table></div>'; }
    if (inList) { html += '</ul>'; }
    if (inCodeBlock) { // In case of unclosed block
      const sanitizedCode = codeContent.replace(/</g, "&lt;").replace(/>/g, "&gt;");
      html += `<div class="code-block-wrapper"><pre><code class="language-${codeLang}">${sanitizedCode.trim()}</code></pre></div>`;
    }

    msg.innerHTML = html;

    const wrapper = document.createElement('div');
    wrapper.classList.add('bot-message-wrapper');

    const copyBtn = document.createElement('button');
    copyBtn.classList.add('copy-msg-btn');
    copyBtn.innerHTML = '📋';
    copyBtn.title = 'Copy response';

    wrapper.appendChild(msg);
    wrapper.appendChild(copyBtn);
    chatBox.appendChild(wrapper);
  }

  // Apply syntax highlighting to any new code blocks
  msg.querySelectorAll('pre code').forEach((block) => {
    hljs.highlightElement(block);
  });

  chatBox.scrollTop = chatBox.scrollHeight;
}

chatBox.addEventListener('click', (e) => {
  const target = e.target;

  // Handle Edit Button
  if (target.classList.contains('edit-btn')) {
    handleEdit(target);
    return;
  }

  // Handle Copy Code Button
  if (target.classList.contains('copy-code-btn')) {
    const wrapper = target.closest('.code-block-wrapper');
    const code = wrapper.querySelector('code');
    navigator.clipboard.writeText(code.innerText).then(() => {
      target.textContent = 'Copied!';
      setTimeout(() => {
        target.textContent = 'Copy';
      }, 2000);
    }).catch(err => {
      console.error('Failed to copy code: ', err);
      target.textContent = 'Error';
    });
    return;
  }

  // Handle Try It Button
  if (target.classList.contains('try-it-btn')) {
    const wrapper = target.closest('.code-block-wrapper');
    const code = wrapper.querySelector('code').innerText;
    const lang = target.dataset.lang;
    openInCodePen(code, lang);
    return;
  }

  // Handle Copy Message Button
  if (target.classList.contains('copy-msg-btn')) {
    const wrapper = target.closest('.bot-message-wrapper');
    const message = wrapper.querySelector('.message.bot');
    navigator.clipboard.writeText(message.innerText).then(() => {
      target.textContent = 'Copied!';
      setTimeout(() => {
        target.innerHTML = '📋'; // Restore icon
      }, 2000);
    }).catch(err => {
      console.error('Failed to copy message:', err);
      target.textContent = 'Error';
    });
    return;
  }
});
