import { server } from "./app.js";
import { connectDB} from "./db/index.js";



connectDB().then(
    ()=>{
        server.listen(process.env.PORT || 5000,()=>{
            console.log("Server running on port 5000")
        })
    }
).catch((err)=>{
    console.log(err)
})

