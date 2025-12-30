import {
    createUser,
    loginUser,
    createTransaction,
    myAllTransactions,
    allMyReciveTransactions,
    updateTransaction,
    updateTrsactionDetail,
    deleteTransaction,
    isIEnable,
    updateTheUser,
    getDashboardData,
    saveLogs
} from "../controllers/user.controller.js";
import { Router } from "express";
import { auth } from "../middlewares/auth.js";

const router = Router();

router.post("/create-user", createUser);
router.post("/login-user", loginUser);
router.post("/create-transaction", auth, createTransaction);
router.get("/my-all-transaction", auth, myAllTransactions);
router.get("/all-my-recive-transaction", auth, allMyReciveTransactions);
router.post("/update-transaction/:id", auth, updateTransaction);
router.put("/update-transaction-detail/:id", auth, updateTrsactionDetail);
router.post("/delete-transaction/:id", auth, deleteTransaction);
router.post("/is-i-enable", auth, isIEnable);
router.post("/update-user", auth, updateTheUser)
router.get("/dashboard-data", auth, getDashboardData)
router.post("/save-log", auth, saveLogs)


export const user_router = router;

