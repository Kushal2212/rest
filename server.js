import dotenv from "dotenv";
import { app } from "./app.js";
import dbconnect from "./src/db/connection.js";

dotenv.config({
  path: "./.env",
});

dbconnect().then(() => {
  app.listen(process.env.PORT || 8000, () => {
    console.log(`Server is running on Port:${process.env.PORT}`);
  })
})
.catch((error)=>{
    console.log("Error connecting to db", error)
})