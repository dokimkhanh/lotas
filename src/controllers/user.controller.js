import ErrorResponse from '../utils/errorResponse.js';
import asyncHandler from '../middlewares/async.middleware.js';
import User from '../models/user.model.js';
import Post from '../models/post.model.js';
import Notification from '../models/notification.model.js';
import path from 'path';

// @desc    Get all users
// @route   GET /api/v1/users
// @access  Private/Admin
const getUsers = asyncHandler(async (req, res, next) => {
  res.status(200).json(res.advancedResults);
});

// @desc    Get single user
// @route   GET /api/v1/users/:id
// @access  Private
const getUser = asyncHandler(async (req, res, next) => {
  const user = await User.findById(req.params.id);

  if (!user) {
    return next(
      new ErrorResponse(`Không tìm thấy người dùng với id ${req.params.id}`, 404)
    );
  }

  // Kiểm tra nếu người dùng đã bị chặn
  if (user.blockedUsers.includes(req.user.id)) {
    return next(
      new ErrorResponse('Bạn đã bị người dùng này chặn', 403)
    );
  }

  res.status(200).json({
    success: true,
    data: user,
  });
});

// @desc    Follow user
// @route   PUT /api/v1/users/:id/follow
// @access  Private
const followUser = asyncHandler(async (req, res, next) => {
  // Kiểm tra nếu người dùng đang cố gắng tự theo dõi chính mình
  if (req.params.id === req.user.id) {
    return next(new ErrorResponse('Bạn không thể tự theo dõi chính mình', 400));
  }

  const userToFollow = await User.findById(req.params.id);

  if (!userToFollow) {
    return next(
      new ErrorResponse(`Không tìm thấy người dùng với id ${req.params.id}`, 404)
    );
  }

  // Kiểm tra nếu người dùng đã bị chặn
  if (userToFollow.blockedUsers.includes(req.user.id)) {
    return next(
      new ErrorResponse('Bạn đã bị người dùng này chặn', 403)
    );
  }

  // Kiểm tra nếu đã theo dõi người dùng này rồi
  if (userToFollow.followers.includes(req.user.id)) {
    return next(
      new ErrorResponse('Bạn đã theo dõi người dùng này rồi', 400)
    );
  }

  // Thêm người dùng vào danh sách followers
  await User.findByIdAndUpdate(req.params.id, {
    $push: { followers: req.user.id },
  });

  // Thêm người dùng vào danh sách following
  await User.findByIdAndUpdate(req.user.id, {
    $push: { following: req.params.id },
  });

  // Tạo thông báo
  await Notification.create({
    recipient: req.params.id,
    sender: req.user.id,
    type: 'follow',
    content: 'đã theo dõi bạn',
  });

  res.status(200).json({
    success: true,
    data: {},
  });
});

// @desc    Unfollow user
// @route   PUT /api/v1/users/:id/unfollow
// @access  Private
const unfollowUser = asyncHandler(async (req, res, next) => {
  // Kiểm tra nếu người dùng đang cố gắng tự hủy theo dõi chính mình
  if (req.params.id === req.user.id) {
    return next(new ErrorResponse('Bạn không thể tự hủy theo dõi chính mình', 400));
  }

  const userToUnfollow = await User.findById(req.params.id);

  if (!userToUnfollow) {
    return next(
      new ErrorResponse(`Không tìm thấy người dùng với id ${req.params.id}`, 404)
    );
  }

  // Kiểm tra nếu chưa theo dõi người dùng này
  if (!userToUnfollow.followers.includes(req.user.id)) {
    return next(
      new ErrorResponse('Bạn chưa theo dõi người dùng này', 400)
    );
  }

  // Xóa người dùng khỏi danh sách followers
  await User.findByIdAndUpdate(req.params.id, {
    $pull: { followers: req.user.id },
  });

  // Xóa người dùng khỏi danh sách following
  await User.findByIdAndUpdate(req.user.id, {
    $pull: { following: req.params.id },
  });

  res.status(200).json({
    success: true,
    data: {},
  });
});

// @desc    Block user
// @route   PUT /api/v1/users/:id/block
// @access  Private
const blockUser = asyncHandler(async (req, res, next) => {
  // Kiểm tra nếu người dùng đang cố gắng tự chặn chính mình
  if (req.params.id === req.user.id) {
    return next(new ErrorResponse('Bạn không thể tự chặn chính mình', 400));
  }

  const userToBlock = await User.findById(req.params.id);

  if (!userToBlock) {
    return next(
      new ErrorResponse(`Không tìm thấy người dùng với id ${req.params.id}`, 404)
    );
  }

  // Kiểm tra nếu đã chặn người dùng này rồi
  if (req.user.blockedUsers.includes(req.params.id)) {
    return next(
      new ErrorResponse('Bạn đã chặn người dùng này rồi', 400)
    );
  }

  // Thêm người dùng vào danh sách bị chặn
  await User.findByIdAndUpdate(req.user.id, {
    $push: { blockedUsers: req.params.id },
  });

  // Nếu đang theo dõi người dùng này, hủy theo dõi
  if (userToBlock.followers.includes(req.user.id)) {
    await User.findByIdAndUpdate(req.params.id, {
      $pull: { followers: req.user.id },
    });

    await User.findByIdAndUpdate(req.user.id, {
      $pull: { following: req.params.id },
    });
  }

  // Nếu người dùng này đang theo dõi mình, hủy theo dõi
  if (req.user.followers.includes(req.params.id)) {
    await User.findByIdAndUpdate(req.user.id, {
      $pull: { followers: req.params.id },
    });

    await User.findByIdAndUpdate(req.params.id, {
      $pull: { following: req.user.id },
    });
  }

  res.status(200).json({
    success: true,
    data: {},
  });
});

// @desc    Unblock user
// @route   PUT /api/v1/users/:id/unblock
// @access  Private
const unblockUser = asyncHandler(async (req, res, next) => {
  // Kiểm tra nếu người dùng đang cố gắng tự bỏ chặn chính mình
  if (req.params.id === req.user.id) {
    return next(new ErrorResponse('Bạn không thể tự bỏ chặn chính mình', 400));
  }

  const userToUnblock = await User.findById(req.params.id);

  if (!userToUnblock) {
    return next(
      new ErrorResponse(`Không tìm thấy người dùng với id ${req.params.id}`, 404)
    );
  }

  // Kiểm tra nếu chưa chặn người dùng này
  if (!req.user.blockedUsers.includes(req.params.id)) {
    return next(
      new ErrorResponse('Bạn chưa chặn người dùng này', 400)
    );
  }

  // Xóa người dùng khỏi danh sách bị chặn
  await User.findByIdAndUpdate(req.user.id, {
    $pull: { blockedUsers: req.params.id },
  });

  res.status(200).json({
    success: true,
    data: {},
  });
});

// @desc    Get user posts
// @route   GET /api/v1/users/:id/posts
// @access  Private
const getUserPosts = asyncHandler(async (req, res, next) => {
  const user = await User.findById(req.params.id);

  if (!user) {
    return next(
      new ErrorResponse(`Không tìm thấy người dùng với id ${req.params.id}`, 404)
    );
  }

  // Kiểm tra nếu người dùng đã bị chặn
  if (user.blockedUsers.includes(req.user.id)) {
    return next(
      new ErrorResponse('Bạn đã bị người dùng này chặn', 403)
    );
  }

  const posts = await Post.find({ user: req.params.id, privacy: 'public' })
    .sort({ createdAt: -1 })
    .populate('user', 'name username avatar');

  res.status(200).json({
    success: true,
    count: posts.length,
    data: posts,
  });
});

// @desc    Update profile
// @route   PUT /api/v1/users/profile
// @access  Private
const updateProfile = asyncHandler(async (req, res, next) => {
  const fieldsToUpdate = {
    name: req.body.name,
    bio: req.body.bio,
    location: req.body.location,
    website: req.body.website,
  };

  const user = await User.findByIdAndUpdate(req.user.id, fieldsToUpdate, {
    new: true,
    runValidators: true,
  });

  res.status(200).json({
    success: true,
    data: user,
  });
});

// @desc    Upload avatar
// @route   PUT /api/v1/users/avatar
// @access  Private
const uploadAvatar = asyncHandler(async (req, res, next) => {
  if (!req.files) {
    return next(new ErrorResponse('Vui lòng tải lên một tệp', 400));
  }

  const file = req.files.file;

  // Kiểm tra nếu tệp là hình ảnh
  if (!file.mimetype.startsWith('image')) {
    return next(new ErrorResponse('Vui lòng tải lên một hình ảnh', 400));
  }

  // Kiểm tra kích thước tệp
  if (file.size > process.env.MAX_FILE_UPLOAD) {
    return next(
      new ErrorResponse(
        `Vui lòng tải lên một hình ảnh nhỏ hơn ${process.env.MAX_FILE_UPLOAD}`,
        400
      )
    );
  }

  // Tạo tên tệp tùy chỉnh
  file.name = `avatar_${req.user.id}${path.parse(file.name).ext}`;

  file.mv(`${process.env.FILE_UPLOAD_PATH}/${file.name}`, async (err) => {
    if (err) {
      console.error(err);
      return next(new ErrorResponse('Lỗi khi tải lên tệp', 500));
    }

    await User.findByIdAndUpdate(req.user.id, { avatar: file.name });

    res.status(200).json({
      success: true,
      data: file.name,
    });
  });
});

// Xuất tất cả các hàm từ một nơi duy nhất ở cuối file
export {
  getUsers,
  getUser,
  followUser,
  unfollowUser,
  blockUser,
  unblockUser,
  getUserPosts,
  updateProfile,
  uploadAvatar
};