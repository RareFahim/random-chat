// ============================================================
// RANDOM CHAT
// COMPLETE MATCHING + REALTIME CHAT SYSTEM
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

let realtimeChannel = null;


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


    // Reset old local chat state.

    currentRoomId = null;

    strangerId = null;

    isSearching = true;


    showScreen(searchingScreen);


    try {

        // ----------------------------------------------------
        // Remove any old queue entry for this user.
        // ----------------------------------------------------

        await supabaseClient
            .from("waiting_users")
            .delete()
            .eq(
                "user_id",
                userId
            );


        // ----------------------------------------------------
        // Add ourselves as a NEW waiting user.
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


        // Check immediately.

        await checkForMatch();


        // Keep checking while searching.

        if (isSearching) {

            searchTimer =
                setInterval(
                    checkForMatch,
                    1000
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
            error.message
        );


        showScreen(homeScreen);

    }

}


// ============================================================
// CHECK FOR A MATCH
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
        // STILL NO PERSON ONLINE
        // ----------------------------------------------------

        if (
            !match.room_id ||
            !match.stranger_id
        ) {
            return;
        }


        // ----------------------------------------------------
        // REAL MATCH FOUND 🎉
        // ----------------------------------------------------

        currentRoomId =
            match.room_id;


        strangerId =
            match.stranger_id;


        stopSearch();


        // Remove our waiting entry.
        // The room is already safely created.

        await supabaseClient
            .from("waiting_users")
            .delete()
            .eq(
                "user_id",
                userId
            );


        await openChat();


    } catch (error) {

        console.error(
            "Match error:",
            error
        );


        stopSearch();


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

function stopSearch() {

    isSearching = false;


    if (searchTimer) {

        clearInterval(
            searchTimer
        );

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
// LOAD ROOM MESSAGES
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


    wrapper.appendChild(bubble);


    messagesBox.appendChild(wrapper);


    messagesBox.scrollTop =
        messagesBox.scrollHeight;

}


// ============================================================
// REALTIME MESSAGES
// ============================================================

function subscribeToMessages() {

    unsubscribeRealtime();


    realtimeChannel =
        supabaseClient

            .channel(
                "room-" + currentRoomId
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


                    // Ignore our own message because
                    // we already display it instantly.

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


    if (!currentRoomId) {

        alert(
            "You are not connected to anyone."
        );

        return;

    }


    // Disable button while sending.

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


        // Clear input.

        messageInput.value = "";


        // Display immediately.

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
            error.message
        );

    }


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

    // Stop current realtime connection.

    unsubscribeRealtime();


    currentRoomId = null;

    strangerId = null;


    // Start completely fresh.

    await startSearching();

}


// ============================================================
// REPORT BUTTON
// ============================================================

function reportStranger() {

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

        unsubscribeRealtime();

    }

);
