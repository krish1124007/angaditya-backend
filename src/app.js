import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import {admin_router} from "./routers/admin.router.js"
import {user_router} from "./routers/user.router.js"

dotenv.config();

const app = express();
app.use(express.json());
app.use(cors({ origin: "*" }));




// Routes
app.use("/api/v1/admin",admin_router);
app.use("/api/v1/user",user_router);


export {app}
