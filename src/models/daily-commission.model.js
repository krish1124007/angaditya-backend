import mongoose from "mongoose";

const DailyCommissionSchema = new mongoose.Schema({
    branch_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Branch",
        required: true
    },
    branch_name: {
        type: String,
        required: true
    },
    amount: {
        type: Number,
        required: true
    },
    date: {
        type: Date,
        required: true,
        default: () => {
            const now = new Date();
            now.setHours(0, 0, 0, 0);
            return now;
        }
    }
}, { timestamps: true });

// Prevent duplicate entries for the same branch on the same day
DailyCommissionSchema.index({ branch_id: 1, date: 1 }, { unique: true });

export const DailyCommission = mongoose.model("DailyCommission", DailyCommissionSchema);
