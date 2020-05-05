// The Cloud Functions for Firebase SDK to create Cloud Functions and setup triggers.
const functions = require('firebase-functions');

// const topicName = 'YOUR_TOPIC_NAME';
// const data = JSON.stringify({foo: 'bar'});
const {PubSub} = require('@google-cloud/pubsub');
const pubSubClient = new PubSub();

// The Firebase Admin SDK to access the Firebase Realtime Database.
const admin = require('firebase-admin');
admin.initializeApp();

async function publishMessage(data) {
    const dataBuffer = Buffer.from(data);

    const messageId = await pubSubClient.topic("dummy-thicc").publish(dataBuffer);
    console.log(`Message ${messageId} published.`);
}


exports.updateIndexDevelopment = functions.firestore
.document('users/{userId}')
.onCreate((snap, context) => {
    const userId = context.params.userId
    const user = snap.data()

    const searchableIndex = createIndex(user.spotify_display_name)

    const db = admin.firestore()
    return db.collection('users').doc(userId).update(
        {'searchableIndex': searchableIndex}
    )
})

exports.addFollower = functions.https.onCall((data, context) => {
    const db = admin.firestore()
    return db.collection('users').doc(data.followee_id).update(
        {'followers': admin.firestore.FieldValue.arrayUnion(data.follower_id)}
    )
});

exports.removeFollower = functions.https.onCall((data, context) => {
    const db = admin.firestore()
    return db.collection('users').doc(data.followee_id).update(
        {
            'followers': admin.firestore.FieldValue.arrayRemove(data.follower_id),
            'listeners': admin.firestore.FieldValue.arrayRemove(data.follower_id)
        }
    )
});

exports.addListener = functions.https.onCall((data, context) => {
    const db = admin.firestore()
    let usersRef = db.collection('users').where('listeners', 'array-contains', data.listener_id)
    let transaction = db.runTransaction(t => {
        return t.get(usersRef)
            .then(snapshot => {
                snapshot.forEach(doc => {
                    let newListenerCount = (doc.data().n_listeners||1) - 1;
                    t.update(doc, {
                        'listeners': admin.firestore.FieldValue.arrayRemove(data.follower_id),
                        'n_listeners': newListenerCount
                    })
                })
                return
            });
    }).then(result => {
        console.log('Transaction success!');
        return
    }).catch(err => {
        console.log('Transaction failure:', err);
        return
    });
    return db.collection('users').doc(data.listenee_id).update(
        {
            'listeners': admin.firestore.FieldValue.arrayUnion(data.listener_id),
            'n_listeners': admin.firestore.FieldValue.increment(1)
        }
    )
});

exports.removeListener = functions.https.onCall((data, context) => {
    const db = admin.firestore()
    return db.collection('users').doc(data.listenee_id).update(
        {
            'listeners': admin.firestore.FieldValue.arrayRemove(data.listener_id),
            'n_listeners': admin.firestore.FieldValue.increment(-1)
        }
    )
});

exports.scheduledFunction = functions.pubsub.schedule('every 1 minutes').onRun((context) => {
    const db = admin.firestore()

    // repeat with the interval of 5 seconds
    let timerId = setInterval(() => checkListeners(db), 5000);

    // after 45 seconds stop
    setTimeout(() => { clearInterval(timerId); }, 55000);
    return null;
});

function checkListeners(db){
    db.collection('users').where('n_listeners', '>', 0).get()
        .then(snapshot => {
            if (snapshot.empty) {
                return;
            }
            let ids = []
            snapshot.forEach(doc => {
                ids.push(doc.id)
            });
            publishMessage(ids).catch(console.error)
            return;
        })
        .catch(err => {
            console.log('Error getting documents', err);
        });
}

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