import admin from "firebase-admin";
import dotenv from "dotenv";

dotenv.config();

const serviceAccount = {
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
};

try {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
    });
    console.log("Firebase Admin Initialized Successfully");
} catch (error) {
    console.error("Firebase Admin Initialization Failed:", error.message);
}

export default admin;
