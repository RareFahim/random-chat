// ============================================================
// RANDOM CHAT
// REAL STRANGER CHAT + AI COMPANION FALLBACK
// DEVELOPED BY FAHIM
// ============================================================


// ============================================================
// SUPABASE CONFIGURATION
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
// AI COMPANION CONFIGURATION
// ============================================================

const AI_WORKER_URL =
    "https://random-chat-ai.elitesnipex13.workers.dev/api/chat";


// ============================================================
// AI FALLBACK SETTINGS
// ============================================================

// 5 minutes = 300,000 milliseconds

const AI_FALLBACK_TIME =
    15 * 1000;

// ============================================================
// PAGE ELEMENTS
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
// CREATE / GET ANONYMOUS USER ID
// ============================================================

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


// ============================================================
// APP STATE
// ============================================================

let currentRoomId = null;

let strangerId = null;

let isSearching = false;

let searchTimer = null;

let aiFallbackTimer = null;

let realtimeChannel = null;

let chatMode = null;


// AI conversation history.

let aiMessages = [];


// Prevent multiple AI requests at once.

let isAiThinking = false;


// ============================================================
// SHOW SCREEN
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


    // --------------------------------------------------------
    // CLEAN OLD STATE
    // --------------------------------------------------------

    cleanupChat();


    currentRoomId = null;

    strangerId = null;

    chatMode = null;

    aiMessages = [];

    isSearching = true;


    showScreen(searchingScreen);


    try {

        // ----------------------------------------------------
        // Remove any old queue entry.
        // ----------------------------------------------------

        await supabaseClient
            .from("waiting_users")
            .delete()
            .eq(
                "user_id",
                userId
            );


        // ----------------------------------------------------
        // Add ourselves to the waiting queue.
        // ----------------------------------------------------

        const {
            error
        } =
            await supabaseClient
                .from("waiting_users")
                .insert({

                    user_id: userId,

                    matched_room_id: null,

                    stranger_id: null

                });


        if (error) {
            throw error;
        }


        // ----------------------------------------------------
        // Check immediately.
        // ----------------------------------------------------

        await checkForMatch();


        // ----------------------------------------------------
        // Keep checking every second.
        // ----------------------------------------------------

        if (isSearching) {

            searchTimer =
                setInterval(
                    checkForMatch,
                    1000
                );


            // ------------------------------------------------
            // START 5-MINUTE AI FALLBACK TIMER
            // ------------------------------------------------

            aiFallbackTimer =
                setTimeout(
                    startAiCompanion,
                    AI_FALLBACK_TIME
                );

        }


    } catch (error) {

        console.error(
            "Search error:",
            error
        );


        stopSearch();


        alert(
            "Could not start searching.\n\n" +
            (
                error.message ||
                "Unknown error"
            )
        );


        showScreen(homeScreen);

    }

}


// ============================================================
// CHECK FOR A REAL MATCH
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
                "find_match",
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


        // ----------------------------------------------------
        // STILL NO REAL PERSON
        // ----------------------------------------------------

        if (
            !match.room_id ||
            !match.stranger_id
        ) {
            return;
        }


        // ----------------------------------------------------
        // REAL STRANGER FOUND 🎉
        // ----------------------------------------------------

        currentRoomId =
            match.room_id;


        strangerId =
            match.stranger_id;


        chatMode =
            "real";


        stopSearch();


        // Remove our waiting entry.

        await supabaseClient
            .from("waiting_users")
            .delete()
            .eq(
                "user_id",
                userId
            );


        await openRealChat();


    } catch (error) {

        console.error(
            "Match error:",
            error
        );


        // Don't immediately destroy the search because of
        // a temporary network problem.

    }

}


// ============================================================
// STOP SEARCHING
// ============================================================

function stopSearch() {

    isSearching = false;


    if (searchTimer) {

        clearInterval(
            searchTimer
        );

        searchTimer = null;

    }


    if (aiFallbackTimer) {

        clearTimeout(
            aiFallbackTimer
        );

        aiFallbackTimer = null;

    }

}


// ============================================================
// START AI COMPANION
// ============================================================

async function startAiCompanion() {

    // Only start AI if we are STILL searching.

    if (!isSearching) {
        return;
    }


    // --------------------------------------------------------
    // Stop real-person search.
    // --------------------------------------------------------

    stopSearch();


    // --------------------------------------------------------
    // Remove ourselves from waiting queue.
    // --------------------------------------------------------

    try {

        await supabaseClient
            .from("waiting_users")
            .delete()
            .eq(
                "user_id",
                userId
            );

    } catch (error) {

        console.error(
            "AI queue cleanup error:",
            error
        );

    }


    // --------------------------------------------------------
    // Switch to AI mode.
    // --------------------------------------------------------

    currentRoomId = null;

    strangerId = null;

    chatMode =
        "ai";


    aiMessages = [];


    // --------------------------------------------------------
    // OPEN AI CHAT
    // --------------------------------------------------------

    showScreen(chatScreen);


    connectionStatus.textContent =
        "● AI Companion";


    messagesBox.innerHTML = "";


    addSystemMessage(
        "🤖 No strangers are online right now, " +
        "so I'll keep you company 😄"
    );


    setTimeout(
        () => {

            messageInput.focus();

        },
        200
    );

}


// ============================================================
// OPEN REAL CHAT
// ============================================================

async function openRealChat() {

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


    await loadMessages();


    subscribeToMessages();


    setTimeout(
        () => {

            messageInput.focus();

        },
        200
    );

}


// ============================================================
// ADD SYSTEM MESSAGE
// ============================================================

function addSystemMessage(text) {

    const systemMessage =
        document.createElement("div");


    systemMessage.className =
        "system-message";


    systemMessage.textContent =
        text;


    messagesBox.appendChild(
        systemMessage
    );


    messagesBox.scrollTop =
        messagesBox.scrollHeight;

}


// ============================================================
// LOAD REAL ROOM MESSAGES
// ============================================================

async function loadMessages() {

    if (
        !currentRoomId ||
        chatMode !== "real"
    ) {
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
            "Message loading error:",
            error
        );

        return;

    }


    if (
        !data ||
        data.length === 0
    ) {
        return;
    }


    messagesBox.innerHTML = "";


    data.forEach(
        message => {

            addMessage(

                message.message,

                message.sender_id === userId

            );

        }
    );

}


// ============================================================
// ADD MESSAGE TO SCREEN
// ============================================================

function addMessage(
    text,
    mine
) {

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


    // Safe text rendering.

    bubble.textContent =
        text;


    wrapper.appendChild(
        bubble
    );


    messagesBox.appendChild(
        wrapper
    );


    messagesBox.scrollTop =
        messagesBox.scrollHeight;

}


// ============================================================
// REALTIME MESSAGES
// ============================================================

function subscribeToMessages() {

    unsubscribeRealtime();


    if (
        !currentRoomId ||
        chatMode !== "real"
    ) {
        return;
    }


    realtimeChannel =
        supabaseClient

            .channel(
                "room-" +
                currentRoomId
            )

            .on(

                "postgres_changes",

                {

                    event: "INSERT",

                    schema: "public",

                    table: "messages",

                    filter:
                        "room_id=eq." +
                        currentRoomId

                },

                payload => {

                    const message =
                        payload.new;


                    // Ignore our own message.

                    if (
                        message.sender_id === userId
                    ) {
                        return;
                    }


                    addMessage(
                        message.message,
                        false
                    );

                }

            )

            .subscribe(
                status => {

                    console.log(
                        "Realtime:",
                        status
                    );

                }
            );

}


// ============================================================
// REMOVE REALTIME CONNECTION
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


    // ========================================================
    // AI MODE 🤖
    // ========================================================

    if (chatMode === "ai") {

        await sendAiMessage(
            text
        );

        return;

    }


    // ========================================================
    // REAL PERSON MODE 👤
    // ========================================================

    if (
        chatMode !== "real" ||
        !currentRoomId
    ) {

        alert(
            "You are not connected to anyone."
        );

        return;

    }


    await sendRealMessage(
        text
    );

}


// ============================================================
// SEND REAL MESSAGE
// ============================================================

async function sendRealMessage(text) {

    sendBtn.disabled = true;


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


        messageInput.value = "";


        addMessage(
            data.message,
            true
        );


    } catch (error) {

        console.error(
            "Send error:",
            error
        );


        alert(
            "Message could not be sent.\n\n" +
            (
                error.message ||
                "Unknown error"
            )
        );

    }


    sendBtn.disabled = false;


    messageInput.focus();

}




 // ============================================================
// SEND AI MESSAGE
// ============================================================

async function sendAiMessage(text) {

    if (isAiThinking) {
        return;
    }


    isAiThinking = true;

    sendBtn.disabled = true;


    // Show user's message immediately.

    addMessage(
        text,
        true
    );


    // Clear input immediately.

    messageInput.value = "";


    // Save user message in conversation history.

    aiMessages.push({

        role: "user",

        content: text

    });


    // Keep conversation history small.

    aiMessages =
        aiMessages.slice(-12);


    try {

        const response =
            await fetch(
                AI_WORKER_URL,
                {

                    method:
                        "POST",

                    headers: {

                        "Content-Type":
                            "application/json"

                    },

                    body:
                        JSON.stringify({

                            messages:
                                aiMessages

                        })

                }
            );


        const data =
            await response.json();


        if (!response.ok) {

            throw new Error(

                data.error ||
                "AI request failed"

            );

        }


        const aiResponse =
            data.response ||
            "Oops 😭 My brain had a tiny loading moment. Try again?";


        // Show AI response.

        addMessage(
            aiResponse,
            false
        );


        // Save AI response in conversation history.

        aiMessages.push({

            role: "assistant",

            content:
                aiResponse

        });


        aiMessages =
            aiMessages.slice(-12);


    } catch (error) {

        console.error(
            "AI error:",
            error
        );


        addSystemMessage(
            "😭 AI Companion is having a tiny brain break. Try again in a moment."
        );

    }


    isAiThinking = false;

    sendBtn.disabled = false;

    messageInput.focus();

        }    


// ============================================================
// CANCEL SEARCH
// ============================================================

async function cancelSearch() {

    stopSearch();


    try {

        await supabaseClient
            .from("waiting_users")
            .delete()
            .eq(
                "user_id",
                userId
            );

    } catch (error) {

        console.error(
            "Cancel error:",
            error
        );

    }


    showScreen(homeScreen);

}


// ============================================================
// NEXT STRANGER
// ============================================================

   async function nextStranger() {

    // Stop everything from the current chat.

    cleanupChat();


    // Start fresh real-person search.

    await startSearching();

}


// ============================================================
// CLEANUP CHAT
// ============================================================

function cleanupChat() {

    // Stop searching timers.

    stopSearch();


    // Remove realtime connection.

    unsubscribeRealtime();


    // Reset AI request state.

    isAiThinking = false;

}


// ============================================================
// REPORT BUTTON
// ============================================================

function reportStranger() {

    if (chatMode === "ai") {

        alert(
            "😂 You can't report the AI Companion yet. " +
            "If I'm annoying you, just press Next 🌚"
        );

        return;

    }


    alert(

        "⚠️ Report system will be added soon.\n\n" +

        "For now, you can click Next to leave the conversation."

    );

}


// ============================================================
// BUTTON EVENTS
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
// ENTER KEY
// ============================================================

messageInput.addEventListener(

    "keydown",

    event => {

        if (
            event.key === "Enter"
        ) {

            event.preventDefault();

            sendMessage();

        }

    }

);


// ============================================================
// PAGE CLOSE CLEANUP
// ============================================================

window.addEventListener(

    "beforeunload",

    () => {

        cleanupChat();

    }

);         
