const SUPABASE_URL = "https://wvwuvpgcdydtdivwitog.supabase.co";
const SUPABASE_KEY = "sb_publishable_ok3gIUiVSKNk_xE28hl5ug_nUkKQ7Sv";


/* =========================================
   ELEMENTS
========================================= */

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


/* =========================================
   USER STATE
========================================= */

let userId = crypto.randomUUID();

let currentRoomId = null;

let searchTimer = null;

let messageTimer = null;

let isSearching = false;


/* =========================================
   SUPABASE REST API
========================================= */

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

        let errorMessage = text;

        try {

            const data = JSON.parse(text);

            errorMessage =
                data.message ||
                data.details ||
                data.hint ||
                data.error ||
                text;

        } catch (error) {
            // Keep original message
        }


        throw new Error(
            `Supabase ${response.status}: ${errorMessage}`
        );
    }


    if (!text) {
        return null;
    }


    try {
        return JSON.parse(text);
    } catch (error) {
        return null;
    }
}


/* =========================================
   RPC CALL
========================================= */

async function findOrCreateChat() {

    const response = await fetch(
        `${SUPABASE_URL}/rest/v1/rpc/find_or_create_chat`,
        {
            method: "POST",

            headers: {
                "apikey": SUPABASE_KEY,
                "Authorization": `Bearer ${SUPABASE_KEY}`,
                "Content-Type": "application/json",
                "Accept": "application/json"
            },

            body: JSON.stringify({
                p_user_id: userId
            })
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
                data.error ||
                text;

        } catch (error) {}


        throw new Error(
            `Supabase ${response.status}: ${message}`
        );
    }


    if (!text) {
        return null;
    }


    return JSON.parse(text);
}


/* =========================================
   SCREEN MANAGEMENT
========================================= */

function showScreen(screen) {

    homeScreen.classList.add("hidden");

    searchingScreen.classList.add("hidden");

    chatScreen.classList.add("hidden");

    screen.classList.remove("hidden");
}


/* =========================================
   START SEARCH
========================================= */

async function startSearching() {

    if (isSearching) {
        return;
    }


    isSearching = true;


    showScreen(searchingScreen);


    try {

        /*
          Remove an old waiting entry
          for this user.
        */

        await api(
            `waiting_users?user_id=eq.${userId}`,
            {
                method: "DELETE"
            }
        );


        /*
          Put this user into the queue.
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
          Try to find a stranger.
        */

        await checkForMatch();


        /*
          Keep checking until matched.
        */

        searchTimer = setInterval(
            checkForMatch,
            2000
        );

    } catch (error) {

        console.error(
            "Search error:",
            error
        );


        stopSearching();


        alert(
            "Could not start chat.\n\n" +
            error.message
        );


        showScreen(homeScreen);
    }
}


/* =========================================
   CHECK FOR MATCH
========================================= */

async function checkForMatch() {

    if (!isSearching) {
        return;
    }


    try {

        const result =
            await findOrCreateChat();


        console.log(
            "Match result:",
            result
        );


        /*
          RPC returns an array because
          the function returns TABLE.
        */

        if (
            !result ||
            !Array.isArray(result) ||
            result.length === 0
        ) {

            return;
        }


        const match = result[0];


        /*
          No stranger yet.

          The RPC deliberately returns NULL
          when nobody is waiting.
        */

        if (
            !match ||
            !match.room_id ||
            !match.stranger_id
        ) {

            return;
        }


        /*
          MATCH FOUND!
        */

        currentRoomId =
            match.room_id;


        console.log(
            "Matched!",
            currentRoomId
        );


        stopSearching();


        openChat();

    } catch (error) {

        console.error(
            "Matching error:",
            error
        );


        stopSearching();


        alert(
            "Matching failed.\n\n" +
            error.message
        );


        showScreen(homeScreen);
    }
}


/* =========================================
   STOP SEARCHING
========================================= */

function stopSearching() {

    isSearching = false;


    if (searchTimer) {

        clearInterval(searchTimer);

        searchTimer = null;
    }
}


/* =========================================
   OPEN CHAT
========================================= */

async function openChat() {

    showScreen(chatScreen);


    messagesBox.innerHTML = `
        <div class="welcome">
            You are now connected with a stranger.<br>
            Say hello 👋
        </div>
    `;


    await loadMessages();


    /*
      Temporary message polling.

      We will replace this with true
      Supabase Realtime after the matching
      system is confirmed working.
    */

    startMessagePolling();


    messageInput.focus();
}


/* =========================================
   LOAD MESSAGES
========================================= */

async function loadMessages() {

    if (!currentRoomId) {
        return;
    }


    try {

        const messages = await api(
            `messages?select=id,room_id,sender_id,message,created_at&room_id=eq.${currentRoomId}&order=created_at.asc`
        );


        if (!messages) {
            return;
        }


        renderMessages(messages);

    } catch (error) {

        console.error(
            "Message loading error:",
            error
        );
    }
}


/* =========================================
   MESSAGE POLLING
========================================= */

function startMessagePolling() {

    stopMessagePolling();


    messageTimer = setInterval(
        loadMessages,
        1500
    );
}


function stopMessagePolling() {

    if (messageTimer) {

        clearInterval(messageTimer);

        messageTimer = null;
    }
}


/* =========================================
   RENDER MESSAGES
========================================= */

function renderMessages(messages) {

    messagesBox.innerHTML = "";


    if (messages.length === 0) {

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
}


/* =========================================
   SEND MESSAGE
========================================= */

async function sendMessage() {

    const text =
        messageInput.value.trim();


    if (!text) {
        return;
    }


    if (!currentRoomId) {

        alert(
            "There is no active chat."
        );

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


        messageInput.value = "";


        await loadMessages();


        messageInput.focus();

    } catch (error) {

        console.error(
            "Send message error:",
            error
        );


        alert(
            "Message could not be sent.\n\n" +
            error.message
        );
    }
}


/* =========================================
   DISPLAY MESSAGE
========================================= */

function addMessage(text, mine) {

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


/* =========================================
   CANCEL SEARCH
========================================= */

async function cancelSearch() {

    stopSearching();


    try {

        await api(
            `waiting_users?user_id=eq.${userId}`,
            {
                method: "DELETE"
            }
        );

    } catch (error) {

        console.error(
            "Cancel search error:",
            error
        );
    }


    showScreen(homeScreen);
}


/* =========================================
   DISCONNECT
========================================= */

async function disconnect() {

    stopSearching();

    stopMessagePolling();


    try {

        await api(
            `waiting_users?user_id=eq.${userId}`,
            {
                method: "DELETE"
            }
        );

    } catch (error) {

        console.error(
            "Disconnect error:",
            error
        );
    }


    currentRoomId = null;


    showScreen(homeScreen);
}


/* =========================================
   NEXT STRANGER
========================================= */

async function nextStranger() {

    await disconnect();


    /*
      Generate a new anonymous identity.
    */

    userId =
        crypto.randomUUID();


    await startSearching();
}


/* =========================================
   REPORT
========================================= */

function reportStranger() {

    alert(
        "Report system will be added next."
    );
}


/* =========================================
   BUTTON EVENTS
========================================= */

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


/* =========================================
   ENTER TO SEND
========================================= */

messageInput.addEventListener(
    "keydown",
    event => {

        if (event.key === "Enter") {

            event.preventDefault();

            sendMessage();
        }
    }
);
