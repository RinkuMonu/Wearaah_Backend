
import express from "express";
import { testRedis, testWelcome } from "../../controllers/Test Controller/test.controller.js";
const testRouter = express.Router();

testRouter.get("/welcome", testWelcome);
testRouter.get("/test_redis", testRedis);
export default testRouter;

