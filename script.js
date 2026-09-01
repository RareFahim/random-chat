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
let realtimeChannel = null;
let isSearching = false;


/* =========================
   SUPABASE API
========================= */

async function api(path, options = {}) {

  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/${path}`,
    {
      ...options,

      headers: {
        "apikey": SUPABASE_KEY,
        "Authorization": `Bearer ${SUPABASE_KEY}`,
        "Content-Type": "application/json",
        "Accept": "application/json",
        "Prefer": "return=representation",
        ...(options.headers || {})
      }
    }
  );

  const text = await response.text();

  if (!response.ok) {

    let message = text;

    try {
      const data = JSON.parse(text);

      message =
        data.message ||
        data.details ||
        data.hint ||
        text;

    } catch (error) {}

    throw new Error(
      `Supabase ${response.status}: ${message}`
    );
  }

  return text ? JSON.parse(text) : null;
}


/* =========================
   SCREEN
========================= */

function showScreen(screen) {

  homeScreen.classList.add("hidden");
  searchingScreen.classList.add("hidden");
  chatScreen.classList.add("hidden");

  screen.classList.remove("hidden");
}


/* =========================
   START SEARCH
========================= */

async function startSearching() {

  if (isSearching) {
    return;
  }

  isSearching = true;

  showScreen(searchingScreen);

  try {

    /*
      Make sure this browser doesn't
      already have an old waiting entry.
    */

    await api(
      `waiting_users?user_id=eq.${userId}`,
      {
        method: "DELETE"
      }
    );


    /*
      Add ourselves to waiting queue.
    */

    await api(
      "waiting_users",
      {
        method: "POST",

        body: JSON.stringify({
          user_id: userId
        })
      }
    );


    /*
      Check for another person.
    */

    searchTimer =
      setInterval(findStranger, 2000);

    await findStranger();

  } catch (error) {

    console.error(error);

    isSearching = false;

    clearInterval(searchTimer);

    alert(
      "Could not start chat.\n\n" +
      error.message
    );

    showScreen(homeScreen);
  }
}


/* =========================
   FIND STRANGER
========================= */

async function findStranger() {

  if (!isSearching) {
    return;
  }

  try {

    /*
      Find the oldest person waiting
      who is NOT ourselves.
    */

    const users = await api(
      `waiting_users?select=id,user_id,created_at&user_id=neq.${userId}&order=created_at.asc&limit=1`
    );


    if (!users || users.length === 0) {
      return;
    }


    const stranger = users[0];


    /*
      Before creating a room, check whether
      a room already exists between these users.
    */

    const existingRooms = await api(
      `chat_rooms?select=id,user1_id,user2_id&or=(and(user1_id.eq.${userId},user2_id.eq.${stranger.user_id}),and(user1_id.eq.${stranger.user_id},user2_id.eq.${userId}))&limit=1`
    );


    let room;


    if (existingRooms && existingRooms.length > 0) {

      room = existingRooms[0];

    } else {

      /*
        Create a new room.
      */

      const rooms = await api(
        "chat_rooms",
        {
          method: "POST",

          body: JSON.stringify({
            user1_id: userId,
            user2_id: stranger.user_id
          })
        }
      );

      if (!rooms || rooms.length === 0) {
        throw new Error(
          "Chat room was not created."
        );
      }

      room = rooms[0];
    }


    currentRoomId = room.id;


    /*
      Remove both users from waiting queue.
    */

    await api(
      `waiting_users?id=eq.${stranger.id}`,
      {
        method: "DELETE"
      }
    );

    await api(
      `waiting_users?user_id=eq.${userId}`,
      {
        method: "DELETE"
      }
    );


    clearInterval(searchTimer);

    isSearching = false;

    openChat();

  } catch (error) {

    console.error(
      "Matching error:",
      error
    );

    clearInterval(searchTimer);

    isSearching = false;

    alert(
      "Matching failed.\n\n" +
      error.message
    );

    showScreen(homeScreen);
  }
}


/* =========================
   OPEN CHAT
========================= */

async function openChat() {

  messagesBox.innerHTML = `
    <div class="welcome">
      You are now connected with a stranger.<br>
      Say hello 👋
    </div>
  `;

  showScreen(chatScreen);

  await loadMessages();

  subscribeToMessages();

  messageInput.focus();
}


/* =========================
   LOAD OLD MESSAGES
========================= */

async function loadMessages() {

  if (!currentRoomId) {
    return;
  }

  try {

    const messages = await api(
      `messages?select=id,room_id,sender_id,message,created_at&room_id=eq.${currentRoomId}&order=created_at.asc`
    );

    messagesBox.innerHTML = "";

    if (!messages || messages.length === 0) {

      messagesBox.innerHTML = `
        <div class="welcome">
          You are now connected with a stranger.<br>
          Say hello 👋
        </div>
      `;

      return;
    }

    messages.forEach(message => {

      addMessage(
        message.message,
        message.sender_id === userId
      );

    });

  } catch (error) {

    console.error(
      "Load messages error:",
      error
    );
  }
}


/* =========================
   REALTIME MESSAGES
========================= */

function subscribeToMessages() {

  /*
    The Supabase Realtime JavaScript client
    will be added in the next step.

    For now, messages are saved correctly
    and can be loaded from the database.
  */

}


/* =========================
   SEND MESSAGE
========================= */

async function sendMessage() {

  const text =
    messageInput.value.trim();

  if (!text) {
    return;
  }

  if (!currentRoomId) {

    alert("There is no active chat.");

    return;
  }

  try {

    const result = await api(
      "messages",
      {
        method: "POST",

        body: JSON.stringify({
          room_id: currentRoomId,
          sender_id: userId,
          message: text
        })
      }
    );


    /*
      Display our own message immediately.
    */

    addMessage(text, true);

    messageInput.value = "";

    messageInput.focus();

  } catch (error) {

    console.error(error);

    alert(
      "Message could not be sent.\n\n" +
      error.message
    );
  }
}


/* =========================
   DISPLAY MESSAGE
========================= */

function addMessage(text, mine) {

  const welcome =
    messagesBox.querySelector(".welcome");

  if (welcome) {
    welcome.remove();
  }


  const wrapper =
    document.createElement("div");

  wrapper.className =
    `message ${mine ? "mine" : ""}`;


  const bubble =
    document.createElement("div");

  bubble.className = "bubble";

  bubble.textContent = text;


  wrapper.appendChild(bubble);

  messagesBox.appendChild(wrapper);


  messagesBox.scrollTop =
    messagesBox.scrollHeight;
}


/* =========================
   CANCEL SEARCH
========================= */

async function cancelSearch() {

  clearInterval(searchTimer);

  isSearching = false;

  try {

    await api(
      `waiting_users?user_id=eq.${userId}`,
      {
        method: "DELETE"
      }
    );

  } catch (error) {

    console.error(error);

  }

  showScreen(homeScreen);
}


/* =========================
   DISCONNECT
========================= */

async function disconnect() {

  clearInterval(searchTimer);

  isSearching = false;

  if (realtimeChannel) {
    realtimeChannel = null;
  }

  currentRoomId = null;

  showScreen(homeScreen);
}


/* =========================
   NEXT
========================= */

async function nextStranger() {

  await disconnect();

  userId = crypto.randomUUID();

  await startSearching();
}


/* =========================
   REPORT
========================= */

function reportStranger() {

  alert(
    "Report system will be connected soon."
  );
}


/* =========================
   BUTTON EVENTS
========================= */

startBtn.addEventListener(
  "click",
  startSearching
);

cancelSearchBtn.addEventListener(
  "click",
  cancelSearch
);

sendBtn.addEventListener(
  "click",
  sendMessage
);

nextBtn.addEventListener(
  "click",
  nextStranger
);

reportBtn.addEventListener(
  "click",
  reportStranger
);


/* =========================
   ENTER TO SEND
========================= */

messageInput.addEventListener(
  "keydown",
  function(event) {

    if (event.key === "Enter") {

      event.preventDefault();

      sendMessage();
    }
  }
);
