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
        ...(options.headers || {})
      }
    }
  );

  const responseText = await response.text();

  if (!response.ok) {

    let errorMessage = responseText;

    try {
      const errorData = JSON.parse(responseText);

      errorMessage =
        errorData.message ||
        errorData.error_description ||
        errorData.details ||
        errorData.hint ||
        responseText;

    } catch (e) {
      // Keep original response
    }

    throw new Error(
      `Supabase error ${response.status}: ${errorMessage}`
    );
  }

  if (!responseText) {
    return null;
  }

  return JSON.parse(responseText);
}


/* =========================
   SCREEN MANAGEMENT
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

    console.log("Starting search...");
    console.log("User ID:", userId);

    /*
      Remove any old waiting entry
      belonging to this browser.
    */

    await api(
      `waiting_users?user_id=eq.${userId}`,
      {
        method: "DELETE"
      }
    );

    /*
      Add this user to waiting_users.
    */

    const waitingUser = await api(
      "waiting_users",
      {
        method: "POST",

        body: JSON.stringify({
          user_id: userId
        })
      }
    );

    console.log("Added to waiting list:", waitingUser);

    /*
      Start checking for another user.
    */

    searchTimer = setInterval(findStranger, 2500);

    await findStranger();

  } catch (error) {

    console.error(error);

    isSearching = false;

    clearInterval(searchTimer);

    showError(
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

    console.log("Looking for stranger...");

    const users = await api(
      `waiting_users?select=id,user_id,created_at&user_id=neq.${userId}&order=created_at.asc&limit=1`
    );

    console.log("Waiting users:", users);

    if (!users || users.length === 0) {
      return;
    }

    const stranger = users[0];

    console.log("Stranger found:", stranger);

    /*
      Create chat room.
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

    console.log("Chat room:", rooms);

    if (!rooms || rooms.length === 0) {
      throw new Error("Chat room was not created.");
    }

    const room = rooms[0];

    currentRoomId = room.id;

    /*
      Remove both users from waiting list.
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

    console.error("Matching error:", error);

    isSearching = false;

    clearInterval(searchTimer);

    showError(
      "Matching failed.\n\n" +
      error.message
    );

    showScreen(homeScreen);
  }
}


/* =========================
   OPEN CHAT
========================= */

function openChat() {

  messagesBox.innerHTML = `
    <div class="welcome">
      You are now connected with a stranger.<br>
      Say hello 👋
    </div>
  `;

  showScreen(chatScreen);

  messageInput.focus();
}


/* =========================
   SEND MESSAGE
========================= */

async function sendMessage() {

  const text = messageInput.value.trim();

  if (!text) {
    return;
  }

  if (!currentRoomId) {
    showError("There is no active chat.");
    return;
  }

  try {

    await api(
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

    addMessage(text, true);

    messageInput.value = "";

    messageInput.focus();

  } catch (error) {

    console.error("Message error:", error);

    showError(
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

  /*
    textContent prevents HTML injection.
  */

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

    console.error(
      "Could not remove waiting user:",
      error
    );
  }

  showScreen(homeScreen);
}


/* =========================
   DISCONNECT
========================= */

async function disconnect() {

  clearInterval(searchTimer);

  isSearching = false;

  if (currentRoomId) {

    try {

      await api(
        `chat_rooms?id=eq.${currentRoomId}`,
        {
          method: "DELETE"
        }
      );

    } catch (error) {

      console.error(
        "Could not delete room:",
        error
      );
    }
  }

  currentRoomId = null;

  showScreen(homeScreen);
}


/* =========================
   NEXT STRANGER
========================= */

async function nextStranger() {

  await disconnect();

  userId = crypto.randomUUID();

  startSearching();
}


/* =========================
   REPORT
========================= */

function reportStranger() {

  alert(
    "Report system will be connected to the database in a later step."
  );
}


/* =========================
   ERROR DISPLAY
========================= */

function showError(message) {

  alert(message);
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
