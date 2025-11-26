import express from "express";
import http from "http";
import { Server } from "socket.io";
import { admin_router } from "./routers/admin.router.js";
import { user_router } from "./routers/user.router.js";
import dotenv from "dotenv";
import cors from "cors"
dotenv.config();

const app = express();
app.use(express.json());
app.use(cors(
  {
    origin:"*"
  }
));

// normal express app → now wrapped into http server
const server = http.createServer(app);

// create socket.io server
const io = new Server(server, {
  cors: {
    origin: "*", // allow Expo / RN
    methods: ["GET", "POST"]
  }
});

// socket.io connection
io.on("connection", (socket) => {
  console.log("New client connected:", socket.id);

  socket.on("disconnect", () => {
    console.log("Client disconnected:", socket.id);
  });
});

// attach io to app so controllers can use it
app.set("io", io);

// MongoDB


// Routes
app.use("/api/v1/admin",admin_router);
app.use("/api/v1/user",user_router);


export {server}
