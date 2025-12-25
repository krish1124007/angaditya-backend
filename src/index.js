import { app } from "./app.js";
import { connectDB } from "./db/index.js";
import { initScheduler } from "./services/scheduler.service.js";



connectDB().then(
    () => {
        // Initialize the daily branch snapshot scheduler
        initScheduler();

        app.listen(process.env.PORT || 5000, () => {
            console.log("Server running on port 5000")
        })
    }
).catch((err) => {
    console.log(err)
})

