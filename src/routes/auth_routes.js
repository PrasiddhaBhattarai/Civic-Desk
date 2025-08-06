import express from "express";
import { authMiddleware } from "../middlewares/auth_middleware.js";
import {
    requestVerificationCode,
    verifyCodeAndRegister,
    loginUser,
    changePassword,
    requestPasswordReset,
    resetPassword,
    logoutUser,
    getUser
} from "../controllers/auth_controller.js"

const router = express.Router();

router.post("/register", requestVerificationCode);
router.post("/register-verify", verifyCodeAndRegister);

router.post("/login", loginUser);

router.post("/change-password", authMiddleware, changePassword);

router.post("/forgot-password", requestPasswordReset);
router.post("/reset-password", resetPassword);

router.post("/logout", logoutUser);

router.get("/user/:id", authMiddleware, getUser);


export default router;