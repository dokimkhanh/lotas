import jwt from 'jsonwebtoken';
import asyncHandler from './async.middleware.js';
import ErrorResponse from '../utils/errorResponse.js';
import User from '../models/user.model.js';

// Bảo vệ routes
const protect = asyncHandler(async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    // Lấy token từ header
    token = req.headers.authorization.split(' ')[1];
  } else if (req.cookies.token) {
    // Lấy token từ cookie
    token = req.cookies.token;
  }

  // Kiểm tra token tồn tại
  if (!token) {
    return next(new ErrorResponse('Không có quyền truy cập vào route này', 401));
  }

  try {
    // Xác thực token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    req.user = await User.findById(decoded.id);

    next();
  } catch (err) {
    return next(new ErrorResponse('Không có quyền truy cập vào route này', 401));
  }
});

// Cấp quyền truy cập cho các vai trò
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return next(
        new ErrorResponse(
          `Vai trò ${req.user.role} không có quyền truy cập vào route này`,
          403
        )
      );
    }
    next();
  };
};

export { protect, authorize };