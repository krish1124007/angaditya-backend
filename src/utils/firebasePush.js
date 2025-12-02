import admin from "../config/firebase.js";

export const sendFirebaseNotification = async (token, title, body, data = {}) => {
    if (!token) {
        console.log("No device token provided for notification");
        return;
    }

    const message = {
        notification: {
            title,
            body,
        },
        data,
        token,
    };

    try {
        const response = await admin.messaging().send(message);
        console.log("Successfully sent message:", response);
        return response;
    } catch (error) {
        console.log("Error sending message:", error);
        return null;
    }
};
