// Your Firebase config here
const firebaseConfig = {
  apiKey: "AIzaSyAAAa37oWBAH9kRydX9qM55Hgm6L4QlACk",
  authDomain: "chattervista.firebaseapp.com",
  projectId: "chattervista",
  storageBucket: "chattervista.firebasestorage.app",
  messagingSenderId: "1046955961052",
  appId: "1:1046955961052:web:5a6688574cafedc27d6219",
  measurementId: "G-JFPX50FMSQ",
  databaseURL: "https://chattervista-default-rtdb.asia-southeast1.firebasedatabase.app/"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

const auth = firebase.auth();
const db = firebase.database();

// Elements
const authSection = document.getElementById('auth-section');
const chatSection = document.getElementById('chat-section');
const displayNameSpan = document.getElementById('displayName');

const usernameInput = document.getElementById('username');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');

const publicMessagesDiv = document.getElementById('public-messages');
const publicInput = document.getElementById('public-message-input');

const dmSection = document.getElementById('dm-section');
const dmChatsDiv = document.getElementById('dm-chats');
const dmUsernameInput = document.getElementById('dm-username');

const groupsSection = document.getElementById('groups-section');
const groupListDiv = document.getElementById('group-list');
const groupChatArea = document.getElementById('group-chat-area');
const groupChatNameH3 = document.getElementById('group-chat-name');
const groupMessagesDiv = document.getElementById('group-messages');
const groupMessageInput = document.getElementById('group-message-input');
const groupNameInput = document.getElementById('group-name');

let currentUser = null;
let usernameCache = {}; // uid => username cache

let activeDMUser = null;  // uid of DM partner
let activeGroupId = null; // id of group chat active

// Authentication state listener
auth.onAuthStateChanged(async (user) => {
  if (user) {
    currentUser = user;
    authSection.style.display = 'none';
    chatSection.style.display = 'block';

    const username = await getUsername(user.uid);
    displayNameSpan.textContent = username || user.email;

    listenPublicMessages();
    loadGroups();
  } else {
    currentUser = null;
    authSection.style.display = 'block';
    chatSection.style.display = 'none';

    clearUI();
  }
});

// Login function
function login() {
  const email = emailInput.value.trim();
  const password = passwordInput.value;

  if (!email || !password) {
    alert('Please enter email and password.');
    return;
  }
  auth.signInWithEmailAndPassword(email, password)
    .catch(e => alert(e.message));
}

// Register function (with username uniqueness check)
async function register() {
  const username = usernameInput.value.trim();
  const email = emailInput.value.trim();
  const password = passwordInput.value;

  if (!username || !email || !password) {
    alert('Please fill username, email, and password.');
    return;
  }

  // Check if username taken
  const usernameSnapshot = await db.ref('usernames/' + username).get();
  if (usernameSnapshot.exists()) {
    alert('Username already taken, please choose another.');
    return;
  }

  auth.createUserWithEmailAndPassword(email, password)
    .then(cred => {
      const uid = cred.user.uid;

      // Save username => uid
      db.ref('usernames/' + username).set(uid);
      // Save user info
      db.ref('users/' + uid).set({
        username: username,
        email: email
      });

      alert('Registration successful! You can now login.');
      usernameInput.value = '';
      emailInput.value = '';
      passwordInput.value = '';
    })
    .catch(e => alert(e.message));
}

// Logout function
function logout() {
  auth.signOut();
}

// Get username by UID with caching
async function getUsername(uid) {
  if (usernameCache[uid]) return usernameCache[uid];
  const snap = await db.ref('users/' + uid).get();
  if (snap.exists()) {
    const username = snap.val().username;
    usernameCache[uid] = username;
    return username;
  }
  return null;
}

// ----------- Public Chat ------------

function sendPublicMessage() {
  const msg = publicInput.value.trim();
  if (!msg) return;

  db.ref('public_chat').push({
    uid: currentUser.uid,
    text: msg,
    time: Date.now()
  });
  publicInput.value = '';
}

function listenPublicMessages() {
  db.ref('public_chat').on('value', async snapshot => {
    const data = snapshot.val() || {};
    publicMessagesDiv.innerHTML = '';

    // Show messages sorted by time
    const sorted = Object.entries(data).sort((a,b) => a[1].time - b[1].time);

    for (const [key, msg] of sorted) {
      const username = await getUsername(msg.uid);
      const p = document.createElement('p');
      p.innerHTML = `<b>${username || 'Unknown'}:</b> ${escapeHtml(msg.text)}`;
      publicMessagesDiv.appendChild(p);
    }
    publicMessagesDiv.scrollTop = publicMessagesDiv.scrollHeight;
  });
}

// ----------- Direct Messages ------------

function startDM() {
  const otherUsername = dmUsernameInput.value.trim();
  if (!otherUsername) {
    alert('Enter a username to chat with.');
    return;
  }
  if (otherUsername === usernameCache[currentUser.uid]) {
    alert('You cannot DM yourself!');
    return;
  }

  // Get the UID of the other user
  db.ref('usernames/' + otherUsername).get().then(snapshot => {
    if (!snapshot.exists()) {
      alert('User not found.');
      return;
    }
    const otherUID = snapshot.val();

    // Create a unique chat ID for 2 users (sorted)
    const chatId = [currentUser.uid, otherUID].sort().join('_');

    if (document.getElementById('dm-chat-' + chatId)) {
      alert('Chat already open.');
      return;
    }

    // Create DM chat box
    createDMChatBox(chatId, otherUID, otherUsername);
    dmUsernameInput.value = '';
  });
}

function createDMChatBox(chatId, otherUID, otherUsername) {
  const div = document.createElement('div');
  div.id = 'dm-chat-' + chatId;
  div.className = 'dm-chat-box';

  const title = document.createElement('h3');
  title.textContent = 'Chat with ' + otherUsername;
  div.appendChild(title);

  const messagesDiv = document.createElement('div');
  messagesDiv.className = 'messages';
  div.appendChild(messagesDiv);

  const input = document.createElement('input');
  input.placeholder = 'Type a message';
  div.appendChild(input);

  const sendBtn = document.createElement('button');
  sendBtn.textContent = 'Send';
  sendBtn.onclick = () => {
    const msg = input.value.trim();
    if (!msg) return;

    // Save message under dm_chats/{chatId}
    db.ref('dm_chats/' + chatId).push({
      uid: currentUser.uid,
      text: msg,
      time: Date.now()
    });
    input.value = '';
  };
  div.appendChild(sendBtn);

  dmChatsDiv.appendChild(div);

  // Listen for messages
  db.ref('dm_chats/' + chatId).on('value', async snapshot => {
    const data = snapshot.val() || {};
    messagesDiv.innerHTML = '';

    const sorted = Object.entries(data).sort((a,b) => a[1].time - b[1].time);

    for (const [key, msg] of sorted) {
      const username = await getUsername(msg.uid);
      const p = document.createElement('p');
      p.innerHTML = `<b>${username || 'Unknown'}:</b> ${escapeHtml(msg.text)}`;
      messagesDiv.appendChild(p);
    }
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
  });
}

// ----------- Groups ------------

function createGroup() {
  const groupName = groupNameInput.value.trim();
  if (!groupName) {
    alert('Enter a group name.');
    return;
  }

  // Create a new group with current user as creator and member
  const newGroupRef = db.ref('groups').push();
  newGroupRef.set({
    name: groupName,
    members: { [currentUser.uid]: true },
    creator: currentUser.uid
  });

  groupNameInput.value = '';
}

function loadGroups() {
  db.ref('groups').on('value', snapshot => {
    const data = snapshot.val() || {};
    groupListDiv.innerHTML = '';

    // Show only groups user is member of
    for (const id in data) {
      if (data[id].members && data[id].members[currentUser.uid]) {
        const div = document.createElement('div');
        div.className = 'group-item';
        div.textContent = data[id].name;
        div.style.cursor = 'pointer';
        div.onclick = () => openGroupChat(id, data[id].name);
        groupListDiv.appendChild(div);
      }
    }
  });
}

function openGroupChat(groupId, groupName) {
  activeGroupId = groupId;
  groupChatNameH3.textContent = groupName;
  groupChatArea.style.display = 'block';

  groupMessagesDiv.innerHTML = '';
  groupMessageInput.value = '';

  // Listen to group messages
  db.ref('group_chats/' + groupId).on('value', async snapshot => {
    const data = snapshot.val() || {};
    groupMessagesDiv.innerHTML = '';

    const sorted = Object.entries(data).sort((a,b) => a[1].time - b[1].time);

    for (const [key, msg] of sorted) {
      const username = await getUsername(msg.uid);
      const p = document.createElement('p');
      p.innerHTML = `<b>${username || 'Unknown'}:</b> ${escapeHtml(msg.text)}`;
      groupMessagesDiv.appendChild(p);
    }
    groupMessagesDiv.scrollTop = groupMessagesDiv.scrollHeight;
  });
}

function sendGroupMessage() {
  const msg = groupMessageInput.value.trim();
  if (!msg || !activeGroupId) return;

  db.ref('group_chats/' + activeGroupId).push({
    uid: currentUser.uid,
    text: msg,
    time: Date.now()
  });

  groupMessageInput.value = '';
}

function leaveGroup() {
  if (!activeGroupId) return;

  db.ref('groups/' + activeGroupId + '/members/' + currentUser.uid).remove()
    .then(() => {
      alert('You left the group.');
      groupChatArea.style.display = 'none';
      activeGroupId = null;
    });
}

// ------- Helpers -------------

function showSection(section) {
  // Hide all
  document.getElementById('public-section').style.display = 'none';
  document.getElementById('dm-section').style.display = 'none';
  document.getElementById('groups-section').style.display = 'none';

  // Deactivate all tabs
  document.getElementById('tab-public').classList.remove('active');
  document.getElementById('tab-dm').classList.remove('active');
  document.getElementById('tab-groups').classList.remove('active');

  // Show selected
  if(section === 'public') {
    document.getElementById('public-section').style.display = 'block';
    document.getElementById('tab-public').classList.add('active');
  } else if(section === 'dm') {
    document.getElementById('dm-section').style.display = 'block';
    document.getElementById('tab-dm').classList.add('active');
  } else if(section === 'groups') {
    document.getElementById('groups-section').style.display = 'block';
    document.getElementById('tab-groups').classList.add('active');
  }
}

function clearUI() {
  publicMessagesDiv.innerHTML = '';
  dmChatsDiv.innerHTML = '';
  groupListDiv.innerHTML = '';
  groupChatArea.style.display = 'none';
  activeGroupId = null;
  activeDMUser = null;
  displayNameSpan.textContent = '';
  usernameCache = {};
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
