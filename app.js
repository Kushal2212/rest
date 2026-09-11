import express from "express"
import cors from "cors"

const app = express();

app.use(cors({
    origin: process.env.CORS_ORIGIN,
    credentails: true
}))

//middleware 
app.use(express.json({limit:"16kb"}))
app.use(express.urlencoded({extended: true, limit:"16kb"}))
app.use(express.static("public"))

//route
app.get("/",(req, res) =>{
    res.send(`Hello world!`)
})


export {app}