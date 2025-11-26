import jwt from "jsonwebtoken";
import { asyncHandler } from "../utils/asyncHandler.js";
import { returnCode } from "../utils/returnCode.js";

export const auth = asyncHandler(async (req, res, next) => {
    const token =
        req.cookies?.token ||
        req.header("Authorization")?.replace("Bearer ", "");

    if (!token) {
        return returnCode(res, 401, false, "Unauthorized: Token missing", null);
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SEC);
        req.user = decoded;   // Attach full payload (id, email, role, whatever you stored)
        next();
    } catch (err) {
        return returnCode(res, 401, false, "Invalid or expired token", null);
    }
});
