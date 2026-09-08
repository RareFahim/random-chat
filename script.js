// ============================================================
// RANDOM CHAT - VERSION 2
// ============================================================


// ============================================================
// SUPABASE
// ============================================================

const SUPABASE_URL =
    "https://wvwuvpgcdydtdivwitog.supabase.co";

const SUPABASE_KEY =
    "sb_publishable_ok3gIUiVSKNk_xE28hl5ug_nUkKQ7Sv";


const supabaseClient =
    window.supabase.createClient(
        SUPABASE_URL,
        SUPABASE_KEY
    );


// ============================================================
// ELEMENTS
// ============================================================

const homeScreen =
    document.getElementById("homeScreen");

const searchingScreen =
    document.getElementById("searchingScreen");

const chatScreen =
    document.getElementById("chatScreen");


const startBtn =
    document.getElementById("startBtn");

const cancelSearchBtn =
    document.getElementById("cancelSearchBtn");

const nextBtn =
    document.getElementById("nextBtn");

const reportBtn =
    document.getElementById("reportBtn");

const sendBtn =
    document.getElementById("sendBtn");

const messageInput =
    document.getElementById("messageInput");

const messagesBox =
    document.getElementById("messages");

const connectionStatus =
    document.getElementById("connectionStatus");


// ============================================================
// USER STATE
// ============================================================

// Store anonymous ID in browser.
// Refreshing the page won't create a new identity.

let userId =
    localStorage.getItem("randomChatUserId");


if (!userId) {

    userId =
        crypto.randomUUID();

    localStorage.setItem(
        "randomChatUserId",
        userId
    );

}


let currentRoomId = null;

let strangerId = null;

let isSearching = false;

let searchTimer = null;

let realtimeChannel = null;

let lastMessageCount = 0;


// ============================================================
// SCREEN MANAGEMENT
// ============================================================

function showScreen(screen) {

    homeScreen.classList.add("hidden");

    searchingScreen.classList.add("hidden");

    chatScreen.classList.add("hidden");


    screen.classList.remove("hidden");

}


// ============================================================
// START SEARCHING
// ============================================================

async function startSearching() {

    if (isSearching) {
        return;
    }


    isSearching = true;

    currentRoomId = null;

    strangerId = null;


    showScreen(searchingScreen);


    try {

        // Remove old waiting entry.

        await supabaseClient
            .from("waiting_users")
            .delete()
            .eq("user_id", userId);


        // Add ourselves to queue.

        const { error: insertError } =
            await supabaseClient
                .from("waiting_users")
                .insert({
                    user_id: userId
                });


        if (insertError) {
            throw insertError;
        }


        // Check immediately.

        await checkForMatch();


        // Continue checking.

        searchTimer =
            setInterval(
                checkForMatch,
                1500
            );

    } catch (error) {

        console.error(
            "Start search error:",
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


// ============================================================
// CHECK FOR MATCH
// ============================================================

async function checkForMatch() {

    if (!isSearching) {
        return;
    }


    try {

        const {
            data,
            error
        } =
            await supabaseClient.rpc(
                "find_or_create_chat",
                {
                    p_user_id: userId
                }
            );


        if (error) {
            throw error;
        }


        if (
            !data ||
            data.length === 0
        ) {
            return;
        }


        const match =
            data[0];


        // Nobody found yet.

        if (
            !match.room_id ||
            !match.stranger_id
        ) {
            return;
        }


        // MATCH FOUND 🎉

        currentRoomId =
            match.room_id;

        strangerId =
            match.stranger_id;


        stopSearching();


        await openChat();


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


// ============================================================
// STOP SEARCHING
// ============================================================

function stopSearching() {

    isSearching = false;


    if (searchTimer) {

        clearInterval(searchTimer);

        searchTimer = null;

    }

}


// ============================================================
// OPEN CHAT
// ============================================================

async function openChat() {

    showScreen(chatScreen);


    connectionStatus.textContent =
        "● Connected";


    messagesBox.innerHTML = `
        <div class="system-message">
            🎉 You are connected with a stranger.
            <br>
            Say hello 👋
        </div>
    `;


    lastMessageCount = 0;


    // Load existing messages.

    await loadMessages();


    // Subscribe to instant messages.

    subscribeToMessages();


    messageInput.focus();

}


// ============================================================
// LOAD MESSAGES
// ============================================================

async function loadMessages() {

    if (!currentRoomId) {
        return;
    }


    const {
        data,
        error
    } =
        await supabaseClient
            .from("messages")
            .select("*")
            .eq(
                "room_id",
                currentRoomId
            )
            .order(
                "created_at",
                {
                    ascending: true
                }
            );


    if (error) {

        console.error(
            "Load messages error:",
            error
        );

        return;

    }


    renderMessages(
        data || []
    );

}


// ============================================================
// RENDER MESSAGES
// ============================================================

function renderMessages(messages) {

    messagesBox.innerHTML = "";


    if (messages.length === 0) {

        messagesBox.innerHTML = `
            <div class="system-message">
                🎉 You are connected with a stranger.
                <br>
                Say hello 👋
            </div>
        `;

        return;

    }


    messages.forEach(
        message => {

            addMessage(
                message.message,
                message.sender_id === userId
            );

        }
    );


    lastMessageCount =
        messages.length;

}


// ============================================================
// ADD ONE MESSAGE
// ============================================================

function addMessage(text, mine) {

    const wrapper =
        document.createElement("div");


    wrapper.className =
        mine
            ? "message mine"
            : "message";


    const bubble =
        document.createElement("div");


    bubble.className =
        "bubble";


    // Safe against HTML injection.

    bubble.textContent =
        text;


    wrapper.appendChild(bubble);

    messagesBox.appendChild(wrapper);


    messagesBox.scrollTop =
        messagesBox.scrollHeight;

}


// ============================================================
// SUPABASE REALTIME
// ============================================================

function subscribeToMessages() {

    unsubscribeRealtime();


    realtimeChannel =
        supabaseClient
            .channel(
                `room-${currentRoomId}`
            )
            .on(

                "postgres_changes",

                {
                    event: "INSERT",

                    schema: "public",

                    table: "messages",

                    filter:
                        `room_id=eq.${currentRoomId}`

                },

                payload => {

                    const message =
                        payload.new;


                    // Don't duplicate our own message.
                    // It was already added instantly.

                    if (
                        message.sender_id === userId
                    ) {
                        return;
                    }


                    addMessage(
                        message.message,
                        false
                    );


                    lastMessageCount++;

                }

            )
            .subscribe(
                status => {

                    console.log(
                        "Realtime status:",
                        status
                    );

                }
            );

}


// ============================================================
// UNSUBSCRIBE REALTIME
// ============================================================

function unsubscribeRealtime() {

    if (realtimeChannel) {

        supabaseClient.removeChannel(
            realtimeChannel
        );

        realtimeChannel = null;

    }

}


// ============================================================
// SEND MESSAGE
// ============================================================

async function sendMessage() {

    const text =
        messageInput.value.trim();


    if (!text) {
        return;
    }


    if (!currentRoomId) {

        alert(
            "No active chat."
        );

        return;

    }


    // Clear immediately.

    messageInput.value = "";


    try {

        const {
            data,
            error
        } =
            await supabaseClient
                .from("messages")
                .insert({

                    room_id:
                        currentRoomId,

                    sender_id:
                        userId,

                    message:
                        text

                })
                .select()
                .single();


        if (error) {
            throw error;
        }


        // Show our message instantly.

        addMessage(
            data.message,
            true
        );


        lastMessageCount++;


    } catch (error) {

        console.error(
            "Send message error:",
            error
        );


        // Restore text if sending failed.

        messageInput.value =
            text;


        alert(
            "Message could not be sent.\n\n" +
            error.message
        );

    }


    messageInput.focus();

}


// ============================================================
// CANCEL SEARCH
// ============================================================

async function cancelSearch() {

    stopSearching();


    try {

        await supabaseClient
            .from("waiting_users")
            .delete()
            .eq(
                "user_id",
                userId
            );

    } catch (error) {

        console.error(error);

    }


    showScreen(homeScreen);

}


// ============================================================
// NEXT STRANGER
// ============================================================

async function nextStranger() {

    unsubscribeRealtime();

    stopSearching();


    currentRoomId = null;

    strangerId = null;


    await startSearching();

}


// ============================================================
// REPORT
// ============================================================

function reportStranger() {

    alert(
        "🚧 Report system is coming soon.\n\n" +
        "For now, you can click Next to leave this conversation."
    );

}


// ============================================================
// EVENTS
// ============================================================

startBtn.addEventListener(
    "click",
    startSearching
);


cancelSearchBtn.addEventListener(
    "click",
    cancelSearch
);


nextBtn.addEventListener(
    "click",
    nextStranger
);


reportBtn.addEventListener(
    "click",
    reportStranger
);


sendBtn.addEventListener(
    "click",
    sendMessage
);


// ============================================================
// ENTER TO SEND
// ============================================================

messageInput.addEventListener(
    "keydown",
    event => {

        if (
            event.key === "Enter" &&
            !event.shiftKey
        ) {

            event.preventDefault();

            sendMessage();

        }

    }
);


// ============================================================
// PAGE CLEANUP
// ============================================================

window.addEventListener(
    "beforeunload",
    () => {

        unsubscribeRealtime();

    }
);
