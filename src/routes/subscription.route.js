import { Router } from "express";
import { verifyJWT } from "../middleware/auth.middleware.js";
import { 
  getSubscribedChannels, 
  getUserChannelSubscribers, 
  toggleSubscription 
} from "../controller/subscription.controller.js";

const subscriptionRouter = Router();

subscriptionRouter.use(verifyJWT);

subscriptionRouter
  .route("/toggle-subscribe/:channelId")
  .post(toggleSubscription)
  .get(getSubscribedChannels)

subscriptionRouter.route("/u/:subscriberId").get(getUserChannelSubscribers);
export default subscriptionRouter;