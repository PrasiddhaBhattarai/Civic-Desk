import jwt from "jsonwebtoken";

const authMiddleware = (req, res, next) => {
    // Get token from cookie instead of Authorization header
    const token = req.cookies.jwt;
    // console.log(token);

    if (!token) {
        return res.status(401).json({
            success : false,
            message : 'Access denied. No token provided. Please login to continue.'
        });
    }

    // decode the token
    try {
        const decodedTokenInfo = jwt.verify(token, process.env.JWT_SECRET);
        req.userInfo = decodedTokenInfo;
        next();
        
    } catch (error) {
        // Clear the invalid cookie
        res.clearCookie('jwt');
        
        return res.status(401).json({
            success : false,
            message : 'Invalid or expired token. Please login again.'
        });
    }
};

export {authMiddleware};