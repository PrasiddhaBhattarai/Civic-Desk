const isRoleAdmin = (req, res, next) => {
    const allowedRoles = ['ward_admin', 'municipality_admin'];
    if (!allowedRoles.includes(req.userInfo.role)) {
        return res.status(403).json({
            success : false,
            message : 'Acess denied! Admin rights required'
        });
    };
    next();
};

export {isRoleAdmin};