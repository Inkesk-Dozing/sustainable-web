// Firebase Configuration — values are hardcoded (Firebase client config is public by design,
// protected by Firestore security rules, not by key secrecy)
const firebaseConfig = {
    apiKey: "AIzaSyCcrmSuKbwTsUOigbZu_maCQmvf4HQ8ia4",
    authDomain: "krmu-impact-bf09e.firebaseapp.com",
    databaseURL: "https://krmu-impact-bf09e-default-rtdb.firebaseio.com",
    projectId: "krmu-impact-bf09e",
    storageBucket: "krmu-impact-bf09e.firebasestorage.app",
    messagingSenderId: "676855708371",
    appId: "1:676855708371:web:6e5ca271427a61312df226",
    measurementId: "G-2ZHP3D9F8F"
};

// Initialize Firebase
if (typeof firebase !== 'undefined') {
    // Prevent double initialization
    if (!firebase.apps.length) {
        try {
            firebase.initializeApp(firebaseConfig);
            // Expose services globally
            window.authDB = firebase.auth();
            window.db = firebase.firestore();
            window.rtdb = firebase.database();

            // Set auth persistence — try LOCAL first, fall back to SESSION for iOS in-app browsers
            window.authDB.setPersistence(firebase.auth.Auth.Persistence.LOCAL).catch(function () {
                console.warn('LOCAL persistence failed, falling back to SESSION');
                return window.authDB.setPersistence(firebase.auth.Auth.Persistence.SESSION);
            }).catch(function (err) {
                console.warn('Auth persistence setup failed:', err.message);
            });

            console.log('🔥 Firebase initialized');
        } catch (e) {
            console.error('Firebase init error:', e);
        }
    }
} else {
    console.error('Firebase SDK not loaded');
}
