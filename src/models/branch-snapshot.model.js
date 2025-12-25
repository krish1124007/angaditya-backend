import mongoose from "mongoose";

const BranchSnapshotSchema = new mongoose.Schema({
    branch_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Branch",
        required: true
    },
    branch_name: {
        type: String,
        required: true
    },
    opening_balance: {
        type: Number,
        default: 0
    },
    total_commision: {
        type: Number,
        default: 0
    },
    today_commision: {
        type: Number,
        default: 0
    },
    snapshot_date: {
        type: Date,
        required: true
    }
}, { timestamps: true });

// Create compound index to prevent duplicate snapshots for same branch on same day
BranchSnapshotSchema.index({ branch_id: 1, snapshot_date: 1 }, { unique: true });

export const BranchSnapshot = mongoose.model("BranchSnapshot", BranchSnapshotSchema);
