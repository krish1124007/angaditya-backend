import {
    createAdmin,
    loginAdmin,
    getAllTransactions,
    getTodayTransactions,
    createBranch,
    updateBranch,
    deleteBranch,
    getAllBranches,
    disableAllbranch,
    enableAllbranch,
    disableBrach
} from "../controllers/amdin.controller.js";
import { Router } from "express";
import { auth } from "../middlewares/auth.js";


const router = Router();

router.route("/create-admin").post(createAdmin);
router.route("/login-admin").post(loginAdmin);
router.route("/get-all-transactions").get(auth,getAllTransactions);
router.route("/get-today-transactions").get(auth,getTodayTransactions);
router.route("/create-branch").post(auth,createBranch);
router.route("/update-branch").post(auth,updateBranch);
router.route("/delete-branch").post(auth,deleteBranch);
router.route("/get-all-branches").get(auth,getAllBranches);
router.route("/disable-all-branch").post(auth,disableAllbranch);
router.route("/enable-all-branch").post(auth,enableAllbranch);
router.route("/disable-branch").post(auth,disableBrach);


export const admin_router = router;