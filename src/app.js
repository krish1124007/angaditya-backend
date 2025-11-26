import express from "express";
import http from "http";
import { Server } from "socket.io";
import dotenv from "dotenv";
import cors from "cors";
import { setSocketServer } from "./socket/socket.js";
import {admin_router} from "./routers/admin.router.js"
import {user_router} from "./routers/user.router.js"

dotenv.config();

const app = express();
app.use(express.json());
app.use(cors({ origin: "*" }));

const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] }
});

// Expose io globally through helper
setSocketServer(io);

io.on("connection", (socket) => {
  console.log("New client connected:", socket.id);

  socket.on("disconnect", () => {
    console.log("Client disconnected:", socket.id);
  });
});


// Routes
app.use("/api/v1/admin",admin_router);
app.use("/api/v1/user",user_router);


export {server}
