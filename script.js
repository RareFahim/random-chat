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
   SUPABASE REQUEST
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

                /*
                  Tell PostgREST to return inserted rows.
                */
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
            // Keep original response
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
   SCREEN MANAGEMENT
========================================= */

function showScreen(screen) {

    homeScreen.classList.add("hidden");

    searchingScreen.classList.add("hidden");

    chatScreen.classList.add("hidden");


    screen.classList.remove("hidden");
}


/* =========================================
   START RANDOM CHAT
========================================= */

async function startSearching() {

    if (isSearching) {
        return;
    }


    isSearching = true;


    showScreen(searchingScreen);


    try {

        /*
          Remove an old waiting entry belonging
          to this browser.
        */

        await api(
            `waiting_users?user_id=eq.${userId}`,
            {
                method: "DELETE"
            }
        );


        /*
          Add this user to the waiting queue.
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


        console.log(
            "Waiting for a stranger...",
            userId
        );


        /*
          Check for another user every 2 seconds.
        */

        searchTimer = setInterval(
            findStranger,
            2000
        );


        /*
          Check immediately too.
        */

        await findStranger();

    } catch (error) {

        console.error(
            "Start chat error:",
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
   FIND STRANGER
========================================= */

async function findStranger() {

    if (!isSearching) {
        return;
    }


    try {

        /*
          Get the oldest person waiting.

          We specifically request user_id
          and only accept a valid value.
        */

        const users = await api(
            `waiting_users?select=id,user_id,created_at&user_id=neq.${userId}&order=created_at.asc&limit=1`
        );


        console.log(
            "People waiting:",
            users
        );


        /*
          Nobody else is waiting.

          This is NORMAL.
        */

        if (!users || users.length === 0) {

            console.log(
                "No stranger available yet."
            );

            return;
        }


        const stranger = users[0];


        /*
          IMPORTANT:
          Never continue if user_id is missing.
        */

        if (
            !stranger ||
            !stranger.id ||
            !stranger.user_id
        ) {

            console.log(
                "Skipping invalid waiting user:",
                stranger
            );

            return;
        }


        console.log(
            "Found stranger:",
            stranger.user_id
        );


        /*
          Create the chat room.

          The database automatically generates
          chat_rooms.id using gen_random_uuid().
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


        console.log(
            "Room response:",
            rooms
        );


        /*
          Make sure Supabase returned a room
          AND that the room has an ID.
        */

        if (
            !rooms ||
            rooms.length === 0 ||
            !rooms[0] ||
            !rooms[0].id
        ) {

            throw new Error(
                "Supabase created no usable chat room ID."
            );
        }


        /*
          Save room ID.
        */

        currentRoomId = rooms[0].id;


        console.log(
            "Chat room ID:",
            currentRoomId
        );


        /*
          Remove the stranger from waiting queue.
        */

        await api(
            `waiting_users?id=eq.${stranger.id}`,
            {
                method: "DELETE"
            }
        );


        /*
          Remove ourselves from waiting queue.
        */

        await api(
            `waiting_users?user_id=eq.${userId}`,
            {
                method: "DELETE"
            }
        );


        /*
          Stop searching.
        */

        stopSearching();


        /*
          Open chat.
        */

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
      Start checking for new messages.
      We will later replace this polling
      with Supabase Realtime.
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


        /*
          Don't erase the current messages
          if the request returns nothing.
        */

        if (!messages) {
            return;
        }


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

    } catch (error) {

        console.error(
            "Load messages error:",
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
        async () => {

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


                /*
                  Redraw messages.

                  This is temporary.
                  Later we'll use Supabase Realtime.
                */

                renderMessages(messages);

            } catch (error) {

                console.error(
                    "Message polling error:",
                    error
                );
            }

        },
        1500
    );
}


/* =========================================
   STOP MESSAGE POLLING
========================================= */

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


        /*
          Clear input.
        */

        messageInput.value = "";


        /*
          Immediately reload messages.
        */

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
   DISPLAY ONE MESSAGE
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
      textContent is used instead of innerHTML
      to prevent users from injecting HTML.
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
   LEAVE CHAT
========================================= */

async function disconnect() {

    stopSearching();

    stopMessagePolling();


    /*
      Remove ourselves from waiting queue.
    */

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


    currentRoomId = null;


    showScreen(homeScreen);
}


/* =========================================
   NEXT STRANGER
========================================= */

async function nextStranger() {

    await disconnect();


    /*
      Generate a completely new anonymous ID.
    */

    userId = crypto.randomUUID();


    /*
      Start searching again.
    */

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
