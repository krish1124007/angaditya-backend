import mongoose from "mongoose";

const HOLeaderSnapshotSchema = new mongoose.Schema({
    positive_total_balance: {
        type: Number,
        default: 0
    },
    negative_total_balance: {
        type: Number,
        default: 0
    },
    positive_total_commission: {
        type: Number,
        default: 0
    },
    negative_total_commission: {
        type: Number,
        default: 0
    },
    ho_balance: {
        type: Number,
        default: 0
    },
    positive_count: {
        type: Number,
        default: 0
    },
    negative_count: {
        type: Number,
        default: 0
    },
    snapshot_date: {
        type: Date,
        required: true,
        unique: true
    }
}, { timestamps: true });

export const HOLeaderSnapshot = mongoose.model("HOLeaderSnapshot", HOLeaderSnapshotSchema);
