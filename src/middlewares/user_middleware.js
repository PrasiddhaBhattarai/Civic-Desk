const isRoleUser = (req, res, next) => {
    if (req.userInfo.role !== 'user') {
        return res.status(403).json({
            success : false,
            message : 'Acess denied! General user only allowed.'
        });
    };
    next();
};

export {isRoleUser};