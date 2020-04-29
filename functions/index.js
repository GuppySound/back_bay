// The Cloud Functions for Firebase SDK to create Cloud Functions and setup triggers.
const functions = require('firebase-functions');

// The Firebase Admin SDK to access the Firebase Realtime Database.
const admin = require('firebase-admin');
admin.initializeApp();

exports.updateIndex = functions.firestore
.document('users_development/{userId}')
.onCreate((snap, context) => {
    const userId = context.params.userId
    console.log(snap);
    const user = snap.data()

    const searchableIndex = createIndex(user.spotify_display_name)

    const db = admin.firestore()
    return db.collection('users_development').doc(userId).update(
        {'searchableIndex': searchableIndex}
    )
})

function createIndex(name){
    const arr = name.toLowerCase().split('');
    const searchableIndex = {}

    let prevKey = '';
    for (const char of arr){
        const key = prevKey + char;
        searchableIndex[key] = true;
        prevKey = key
    }
    return searchableIndex
}