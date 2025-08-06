import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { LRUCache } from "lru-cache";
import { registerEmailVerificationMail } from "../helper/nodemailer.js";
import { query } from "../config/db.js";

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = "7d";

// LRU-cache
// suggested to use temp table instead
const pendingVerifications = new LRUCache({
    max: 1000,           // max 1000 entries
    maxAge: 1000 * 60 * 3,  // optional: expire entries after 3 minutes
});
// automatically deletes after its age
const pendingPasswordResets = new LRUCache({
    max: 1000,
    maxAge: 1000 * 60 * 3,
})

// Password regex pattern for validation ( 8 - 15 characters, 1 uppercase, 1 lowercase, 1 number, 1 special character)
const passwordRegex =
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@.#$!%*?&])[A-Za-z\d@.#$!%*?&]{8,15}$/;

// some utility functions
// 1. to check if email exists
const emailExists = async (email) => {
    const result = await query(`SELECT email FROM users WHERE email = $1`, [
        email,
    ]);
    // if (result.rows.length == 0) {
    //     return false;
    // }
    // return true;
    return result.rowCount > 0;
};
// 2. to check if username exists
const usernameExists = async (name) => {
    const result = await query(`SELECT name FROM users WHERE name = $1`, [name]);
    return result.rowCount > 0;
};
// 3. to generate 6-digit verification code
const generateCode = () => Math.floor(100000 + Math.random() * 900000).toString();



// i) to generate a real-time email-based PIN or code verification, similar to OTP (One-Time Password) systems
const requestVerificationCode = async (req, res) => {
    const { name, email, password, ward_name } = req.body;
    const role = 'user';

    // check if user already exits
    // case_1: If email exists
    // if yes later you can redirect to login
    if (await emailExists(email)) {
        return res.status(400).json({
            success: false,
            message: `Your email is already registered. Please login instead.`,
        });
    }

    // case_2: If username exists
    // request for another username
    if (await usernameExists(name)) {
        return res.status(400).json({
            success: false,
            message: `User already exists for provided ${name}. Please try again with new one.`,
        });
    }

    // password regex test
    if (!passwordRegex.test(password)) {
        return res.status(400).json({
            success: false,
            message:
                "Password must be of (8-15) characters withat least one uppercase letter, one lowercase letter,one number and one special character!",
        });
    }

    //hash user password
    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(password, salt);

    //generate code
    const code = generateCode();
    const expiresAt = Date.now() + 1000 * 60 * 3;
    //store in hashMap
    pendingVerifications.set(email, {
        name,
        password_hash,
        role,
        ward_name,
        code
    });

    try {
        const info = await registerEmailVerificationMail(email, code);
        if (info.accepted && info.accepted.length > 0) {
            res.status(200).json({
                success: true,
                message: 'Verification email sent successfully.',
                expiresAt
            });
        } else {
            res.status(500).json({
                success: false,
                message: 'Email sending failed. Please try again.'
            });
        }

    } catch (err) {
        console.error("error in sending verification code!", err);
        res.status(500).json({
            success: false,
            message: 'Some error occured! Please try again'
        });
    }
};

// ii) verify code and then register user
const verifyCodeAndRegister = async (req, res) => {
    const { email, code } = req.body;

    // Get record from the LRU cache
    const record = pendingVerifications.get(email);

    if (!record) {
        return res.status(400).json({
            success: false,
            message: 'Verification code expired or not found.',
        });
    }

    if (record.code !== code) {
        return res.status(400).json({
            success: false,
            message: 'Invalid verification code.',
        });
    }

    const { name, password_hash, role, ward_name } = record;
    try {
        // to get ward_id
        const getWard_id = await query(`SELECT id FROM wards WHERE name = $1`, [ward_name]);
        const ward_id = getWard_id.rows[0].id;

        // user register query
        const registerQuery = `
        INSERT INTO users (name, email, password_hash, role, ward_id)
        VALUES ($1, $2, $3, $4, $5) 
        RETURNING id, name, email, role
        `;

        const newUser = await query(
            registerQuery,
            [name, email, password_hash, role, ward_id]
        );

        // Remove from cache after successful registration
        pendingVerifications.delete(email);

        if (newUser.rowCount === 1) {
            res.status(201).json({
                success: true,
                message: "User registered successfully"
            });
        } else {
            res.status(400).json({
                success: false,
                message: "Unable to register User"
            });
        }
    } catch (err) {
        console.error("error in registering user!", err);
        res.status(500).json({
            success: false,
            message: 'Some error occured! Please try again'
        });
    }
};

// iii) login which then returns jwt in cookie
const loginUser = async (req, res) => {
    const { email, password } = req.body;

    try {
        const result = await query(`SELECT * FROM users WHERE email = $1`, [email]);

        const user = result.rows[0];
        if (!user) {
            console.log("user not found");
            return res.status(401).json({
                success: false,
                message: "Invalid credentials"
            })
        };

        const match = await bcrypt.compare(password, user.password_hash);
        if (!match) {
            console.log("password don't match");
            return res.status(401).json({
                success: false,
                message: "Invalid credentials"
            })
        };

        // create a user token
        const accessToken = jwt.sign(
            {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role,
                ward_id: user.ward_id
            },
            JWT_SECRET,
            { expiresIn: JWT_EXPIRES_IN }
        );

        res.cookie("jwt", accessToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: "strict",
            maxAge: 7 * 24 * 60 * 60 * 1000,
        })
            .json({
                success: true,
                message: "Login successful",
                user: {
                    id: user.id,
                    name: user.name,
                    role: user.role
                },
            });
    } catch (err) {
        cconsole.error("error in user login!", err);
        res.status(500).json({
            success: false,
            message: 'Some error occured! Please try again'
        });

    }
};

// iv) change password
const changePassword = async (req, res) => {
    try {
        const userId = req.userInfo.id;

        // extract old and new password
        const { oldPassword, newPassword } = req.body;

        // find the current logged in user
        const result = await query(`SELECT * FROM users WHERE id = $1`, [userId]);

        const user = result.rows[0];

        if (!user) {
            return res.status(400).json({
                success: false,
                message: 'user not found'
            });
        };

        //check if the old password is correct
        const isPasswordMatch = await bcrypt.compare(oldPassword, user.password_hash);

        if (!isPasswordMatch) {
            return res.status(400).json({
                success: false,
                message: 'old password is incorrect! Please try agian.'
            });
        };

        //hash the new passwrod
        const salt = await bcrypt.genSalt(10);
        const newpassword_hash = await bcrypt.hash(newPassword, salt);

        // update user password
        const updateQuery = `
                            UPDATE users
                            SET password_hash = $1
                            WHERE id = $2
                            RETURNING id, name, email
                            `;

        const updatedUserResult = await query(updateQuery, [newpassword_hash, userId]);

        if (updatedUserResult.rowCount === 1) {
            res.status(200).json({
                success: true,
                message: 'Password changed successfully.'
            });
        } else {
            res.status(400).json({
                success: false,
                message: "Unable to change password"
            });
        }
    } catch (err) {
        console.error("error in changing password.", err);
        res.status(500).json({
            success: false,
            message: 'Some error occured! Please try again'
        });
    }
};

// v) before resetting your password, for verification mails code to your email for verification
// (as in above requestVerificationCode())
const requestPasswordReset = async (req, res) => {
    const { email } = req.body;

    const result = await query(`SELECT id FROM users WHERE email = $1`, [email]);
    const user = result.rows[0];

    if (!user) {
        return res.status(404).json({
            success: false,
            message: 'User not found with this email.',
        });
    }

    const code = generateCode();
    const expiresAt = Date.now() + 1000 * 60 * 3; // 3 minutes

    pendingPasswordResets.set(email, { code });

    try {
        const info = await registerEmailVerificationMail(email, code);
        if (info.accepted && info.accepted.length > 0) {
            return res.status(200).json({
                success: true,
                message: 'Reset verification code sent successfully.',
                expiresAt
            });
        } else {
            return res.status(500).json({
                success: false,
                message: 'Email sending failed. Please try again.'
            });
        }
    } catch (err) {
        console.error("Error sending reset code:", err);
        return res.status(500).json({
            success: false,
            message: 'Something went wrong. Please try again.'
        });
    }
};

// vi) verify code and it resets your password
const resetPassword = async (req, res) => {
    const { email, code, newPassword } = req.body;

    const record = pendingPasswordResets.get(email);

    if (!record) {
        return res.status(400).json({
            success: false,
            message: 'Reset code expired or not requested.',
        });
    }

    if (record.code !== code) {
        return res.status(400).json({
            success: false,
            message: 'Invalid reset code.',
        });
    }

    if (!passwordRegex.test(newPassword)) {
        return res.status(400).json({
            success: false,
            message:
                "Password must be 8–15 characters with at least one uppercase, one lowercase, one number, and one special character.",
        });
    }

    try {
        const salt = await bcrypt.genSalt(10);
        const password_hash = await bcrypt.hash(newPassword, salt);

        const update = await query(
            `UPDATE users SET password_hash = $1 WHERE email = $2`,
            [password_hash, email]
        );

        pendingPasswordResets.delete(email);

        if (update.rowCount === 1) {
            return res.status(200).json({
                success: true,
                message: 'Password reset successfully.',
            });
        } else {
            return res.status(400).json({
                success: false,
                message: 'Failed to reset password. Try again.',
            });
        }
    } catch (err) {
        console.error("Error in password reset:", err);
        return res.status(500).json({
            success: false,
            message: 'Something went wrong. Please try again.',
        });
    }
};

// vii) logout from app
const logoutUser = (req, res) => {
    try {
        // Clear the JWT cookie
        res.clearCookie('jwt');

        res.status(200).json({
            success: true,
            message: "Logged out successfully"
        });
    } catch (error) {
        console.error("Error in user logout!", error);
        res.status(500).json({
            success: false,
            message: 'Some error occurred! Please try again'
        });
    }
};

// viii) get user details
const getUser = async (req, res) => {
    try {
        const requestedUserId = parseInt(req.params.id, 10);
        const user = req.userInfo

        if (Number.isNaN(requestedUserId)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid user ID'
            });
        }

        const result = await query(`
            SELECT u.id, u.name, u.email, u.role, w.name AS ward_number, CONCAT(p.name,' ',p.type) AS palika
            FROM users u
            JOIN wards w ON u.ward_id = w.id
            JOIN palika p ON w.palika_id = p.id
            WHERE u.id = $1 
        `, [requestedUserId]);

        if (result.rowCount === 0) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        const requestedUser = result.rows[0];

        let filteredUser;
        if (user.role === 'ward_admin' || user.role === 'municipality_admin') {
            // Admin: return all except password hash
            filteredUser = requestedUser;
        } else {
            // Regular user: return only name and role
            filteredUser = {
                name: requestedUser.name,
                role: requestedUser.role
            };
            // regular user can see emial of admins
            if (requestedUser.role === 'ward_admin' || requestedUser.role === 'municipality_admin') {
                const { id, ...rest } = requestedUser;
                filteredUser = rest;
            }
        }

        res.status(200).json({
            success: true,
            user: filteredUser
        });

    } catch (error) {
        console.error("Error in get user!", error);
        res.status(500).json({
            success: false,
            message: 'Some error occurred! Please try again'
        });
    }
}

export {
    requestVerificationCode,
    verifyCodeAndRegister,
    loginUser,
    changePassword,
    requestPasswordReset,
    resetPassword,
    logoutUser,
    getUser
};