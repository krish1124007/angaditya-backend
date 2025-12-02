import { asyncHandler } from "../utils/asyncHandler";
import { returnCode } from "../utils/returnCode";
import { User } from "../models/user.model";


const sendNotification = async (transaction_id , user_id)=>{

  const { token, title, body, metadata } = req.body;
  if (!Expo.isExpoPushToken(token)) {
    throw new Error("Invalid push token", 400);
  }

  const message = {
    to: token,
    sound: "default",
    title: title,
    body: body,
    data: metadata || {},
  };

  const tickets = await expo.sendPushNotificationsAsync([message]);

  return res.status(200).json(tickets);
   

}