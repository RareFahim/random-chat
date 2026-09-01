const SUPABASE_URL = "https://wvwuvpgcdydtdivwitog.supabase.co";
const SUPABASE_KEY = "sb_publishable_ok3gIUiVSKNk_xE28hl5ug_nUkKQ7Sv";

const homeScreen = document.getElementById("homeScreen");
const searchingScreen = document.getElementById("searchingScreen");
const chatScreen = document.getElementById("chatScreen");

const startBtn = document.getElementById("startBtn");
const cancelSearchBtn = document.getElementById("cancelSearchBtn");
const nextBtn = document.getElementById("nextBtn");
const reportBtn = document.getElementById("reportBtn");
const sendBtn = document.getElementById("sendBtn");
const messageInput = document.getElementById("messageInput");
const messagesBox = document.getElementById("messages");

let userId = crypto.randomUUID();
let currentRoomId = null;
let searchTimer = null;

function showScreen(screen) {
  homeScreen.classList.add("hidden");
  searchingScreen.classList.add("hidden");
  chatScreen.classList.add("hidden");

  screen.classList.remove("hidden");
}

async function api(path, options = {}) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...options,
    headers: {
      "apikey": SUPABASE_KEY,
      "Authorization": `Bearer ${SUPABASE_KEY}`,
      "Content-Type": "application/json",
      "Prefer": "return=representation",
      ...(options.headers || {})
    }
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error);
  }

  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

async function startSearching() {
  showScreen(searchingScreen);

  try {
    await api("waiting_users", {
      method: "POST",
      body: JSON.stringify({
        user_id: userId
      })
    });

    searchTimer = setInterval(findStranger, 2500);
    await findStranger();

  } catch (error) {
    console.error(error);
    alert("Could not start chat. Please try again.");
    showScreen(homeScreen);
  }
}

async function findStranger() {
  try {
    const users = await api(
      `waiting_users?select=id,user_id,created_at&user_id=neq.${userId}&order=created_at.asc&limit=1`
    );

    if (!users || users.length === 0) {
      return;
    }

    const stranger = users[0];

    await api("chat_rooms", {
      method: "POST",
      body: JSON.stringify({
        user1_id: userId,
        user2_id: stranger.user_id
      })
    }).then(async rooms => {

      const room = rooms[0];

      currentRoomId = room.id;

      await api(`waiting_users?id=eq.${stranger.id}`, {
        method: "DELETE"
      });

      await api(`waiting_users?user_id=eq.${userId}`, {
        method: "DELETE"
      });

      clearInterval(searchTimer);

      openChat();
    });

  } catch (error) {
    console.error(error);
  }
}

function openChat() {
  messagesBox.innerHTML = `
    <div class="welcome">
      You are now connected with a stranger.<br>
      Say hello 👋
    </div>
  `;

  showScreen(chatScreen);
}

async function sendMessage() {
  const text = messageInput.value.trim();

  if (!text || !currentRoomId) {
    return;
  }

  try {
    await api("messages", {
      method: "POST",
      body: JSON.stringify({
        room_id: currentRoomId,
        sender_id: userId,
        message: text
      })
    });

    addMessage(text, true);
    messageInput.value = "";
    messageInput.focus();

  } catch (error) {
    console.error(error);
    alert("Message could not be sent.");
  }
}

function addMessage(text, mine) {
  const welcome = messagesBox.querySelector(".welcome");

  if (welcome) {
    welcome.remove();
  }

  const wrapper = document.createElement("div");
  wrapper.className = `message ${mine ? "mine" : ""}`;

  const bubble = document.createElement("div");
  bubble.className = "bubble";
  bubble.textContent = text;

  wrapper.appendChild(bubble);
  messagesBox.appendChild(wrapper);

  messagesBox.scrollTop = messagesBox.scrollHeight;
}

async function disconnect() {
  clearInterval(searchTimer);

  if (currentRoomId) {
    await api(`messages?room_id=eq.${currentRoomId}`, {
      method: "DELETE"
    }).catch(() => {});

    await api(`chat_rooms?id=eq.${currentRoomId}`, {
      method: "DELETE"
    }).catch(() => {});
  }

  currentRoomId = null;
  showScreen(homeScreen);
}

async function nextStranger() {
  await disconnect();

  userId = crypto.randomUUID();

  startSearching();
}

async function reportStranger() {
  alert("Thank you. The report feature will be connected to the database next.");
}

startBtn.addEventListener("click", startSearching);

cancelSearchBtn.addEventListener("click", () => {
  clearInterval(searchTimer);

  api(`waiting_users?user_id=eq.${userId}`, {
    method: "DELETE"
  }).catch(() => {});

  showScreen(homeScreen);
});

sendBtn.addEventListener("click", sendMessage);

messageInput.addEventListener("keydown", event => {
  if (event.key === "Enter") {
    sendMessage();
  }
});

nextBtn.addEventListener("click", nextStranger);

reportBtn.addEventListener("click", reportStranger);
