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
    disableBrach,
    getTrasactionBranchWise,
    giveTheTractionPermision,
    updateAdmin,
    enableBranch,
    getAllUserLogs,
    getUser,
    deleteAllUser,
    deleteUser,
    updateUser,
    deleteAllTransactions,
    triggerBranchSnapshot,
    getBranchSnapshots,
    getLatestSnapshots,
    createRelationShip,
    createTransaction,
    getDateRangeReport
} from "../controllers/amdin.controller.js";
import { Router } from "express";
import { auth } from "../middlewares/auth.js";


const router = Router();

router.route("/create-admin").post(createAdmin);
router.route("/login-admin").post(loginAdmin);
router.route("/get-all-transactions").post(auth, getAllTransactions);  // Changed to POST to support request body
router.route("/get-today-transactions").get(auth, getTodayTransactions);
router.route("/create-branch").post(auth, createBranch);
router.route("/update-branch").post(auth, updateBranch);
router.route("/delete-branch").post(auth, deleteBranch);
router.route("/get-all-branches").post(auth, getAllBranches);  // Changed to POST to support request body
router.route("/disable-all-branch").post(auth, disableAllbranch);
router.route("/enable-all-branch").post(auth, enableAllbranch);
router.route("/disable-branch").post(auth, disableBrach);
router.route("/get-transaction-branch-wise").post(auth, getTrasactionBranchWise);
router.route("/give-transaction-permission").post(auth, giveTheTractionPermision);
router.route("/update-admin").post(auth, updateAdmin);
router.route("/enable-branch").post(auth, enableBranch);
router.route("/get-all-user-logs").post(auth, getAllUserLogs);
router.route("/get-user").post(auth, getUser);
router.route("/delete-all-user").post(auth, deleteAllUser);
router.route("/delete-user").post(auth, deleteUser);
router.route("/update-user").post(auth, updateUser);
router.route("/delete-all-transaction").post(auth, deleteAllTransactions);

// Branch Snapshot Routes
router.route("/trigger-snapshot").post(auth, triggerBranchSnapshot);
router.route("/get-snapshots").post(auth, getBranchSnapshots);
router.route("/get-latest-snapshots").get(auth, getLatestSnapshots);
router.route("/create-relationship").post(auth, createRelationShip);
router.route("/create-transaction").post(auth, createTransaction);
router.route("/get-date-range-report").post(auth, getDateRangeReport);

export const admin_router = router;