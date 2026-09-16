import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";

const app = express();

// middleware

app.use(
  cors({
    origin: process.env.CORS_ORIGIN,
    credentials: true,
  })
);

app.use(cookieParser());

app.use(express.json({ limit: "16kb" }));
app.use(
  express.urlencoded({
    extended: true,
    limit: "16kb",
  })
);

app.use(express.static("public"));

// imports routes
import userRouter from "./src/routes/user.route.js";
import VideoRouter from "./src/routes/video.route.js"
import subscriptionRouter  from "./src/routes/subscription.route.js";

// routes
app.use("/api/v1/users", userRouter);
app.use("/api/v1/videos", VideoRouter)
app.use("/api/v1/subscriptions", subscriptionRouter)

export { app };
