// firebase-config.js
const firebaseConfig = {
    apiKey: "AIzaSyCPGv5Fbkp9ZS2vBh4ivJFANQDTNe7_vV0",
    authDomain: "responding-team-app.firebaseapp.com",
    projectId: "responding-team-app",
    storageBucket: "responding-team-app.firebasestorage.app",
    messagingSenderId: "540539276056",
    appId: "1:540539276056:web:c2ee4e3f3caed12bd76c6d"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();