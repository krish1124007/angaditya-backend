import axios from "axios";

export const sendNotification = async (expoToken, title, body) => {
  try {
    if (!expoToken) {
      console.error("Expo token missing");
      return;
    }

    const payload = {
      to: expoToken,
      sound: "default",
      title,
      body,
    };

    const response = await axios.post(
      "https://exp.host/--/api/v2/push/send",
      payload,
      {
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    console.log("Notification Sent:", response.data);
    return response.data;
  } catch (error) {
    console.error(
      "Notification Error:",
      error.response?.data || error.message
    );
  }
};
