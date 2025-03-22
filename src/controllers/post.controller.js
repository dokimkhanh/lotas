import ErrorResponse from '../utils/errorResponse.js';
import asyncHandler from '../middlewares/async.middleware.js';
import Post from '../models/post.model.js';
import User from '../models/user.model.js';
import Comment from '../models/comment.model.js';
import Notification from '../models/notification.model.js';
import path from 'path';

// @desc    Get all posts
// @route   GET /api/v1/posts
// @access  Private
const getPosts = asyncHandler(async (req, res, next) => {
  // Lấy danh sách người dùng bị chặn
  const blockedUsers = req.user.blockedUsers;

  // Lấy danh sách bài viết không thuộc về người dùng bị chặn
  const posts = await Post.find({
    user: { $nin: blockedUsers },
    privacy: 'public',
    isStory: false,
    isReel: false,
  })
    .sort({ createdAt: -1 })
    .populate('user', 'name username avatar')
    .populate({
      path: 'comments',
      select: 'content user createdAt',
      options: { limit: 3 },
      populate: {
        path: 'user',
        select: 'name username avatar',
      },
    });

  res.status(200).json({
    success: true,
    count: posts.length,
    data: posts,
  });
});

// @desc    Get single post
// @route   GET /api/v1/posts/:id
// @access  Private
const getPost = asyncHandler(async (req, res, next) => {
  const post = await Post.findById(req.params.id)
    .populate('user', 'name username avatar')
    .populate({
      path: 'comments',
      select: 'content user createdAt',
      populate: {
        path: 'user',
        select: 'name username avatar',
      },
    });

  if (!post) {
    return next(
      new ErrorResponse(`Không tìm thấy bài viết với id ${req.params.id}`, 404)
    );
  }

  // Kiểm tra nếu bài viết thuộc về người dùng bị chặn
  if (req.user.blockedUsers.includes(post.user._id)) {
    return next(
      new ErrorResponse('Bạn đã bị người dùng này chặn', 403)
    );
  }

  // Kiểm tra nếu bài viết là private và không thuộc về người dùng hiện tại
  if (post.privacy === 'private' && post.user._id.toString() !== req.user.id) {
    return next(
      new ErrorResponse('Không có quyền truy cập bài viết này', 403)
    );
  }

  res.status(200).json({
    success: true,
    data: post,
  });
});

// @desc    Create post
// @route   POST /api/v1/posts
// @access  Private
const createPost = asyncHandler(async (req, res, next) => {
  // Thêm user vào req.body
  req.body.user = req.user.id;

  // Nếu bài viết là story, đặt thời gian hết hạn là 24 giờ
  if (req.body.isStory) {
    req.body.storyExpireAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
  }

  const post = await Post.create(req.body);

  res.status(201).json({
    success: true,
    data: post,
  });
});

// @desc    Update post
// @route   PUT /api/v1/posts/:id
// @access  Private
const updatePost = asyncHandler(async (req, res, next) => {
  let post = await Post.findById(req.params.id);

  if (!post) {
    return next(
      new ErrorResponse(`Không tìm thấy bài viết với id ${req.params.id}`, 404)
    );
  }

  // Kiểm tra nếu người dùng là chủ sở hữu bài viết
  if (post.user.toString() !== req.user.id) {
    return next(
      new ErrorResponse('Không có quyền cập nhật bài viết này', 401)
    );
  }

  post = await Post.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  });

  res.status(200).json({
    success: true,
    data: post,
  });
});

// @desc    Delete post
// @route   DELETE /api/v1/posts/:id
// @access  Private
const deletePost = asyncHandler(async (req, res, next) => {
  const post = await Post.findById(req.params.id);

  if (!post) {
    return next(
      new ErrorResponse(`Không tìm thấy bài viết với id ${req.params.id}`, 404)
    );
  }

  // Kiểm tra nếu người dùng là chủ sở hữu bài viết
  if (post.user.toString() !== req.user.id && req.user.role !== 'admin') {
    return next(
      new ErrorResponse('Không có quyền xóa bài viết này', 401)
    );
  }

  await post.remove();

  res.status(200).json({
    success: true,
    data: {},
  });
});

// @desc    Like post
// @route   PUT /api/v1/posts/:id/like
// @access  Private
const likePost = asyncHandler(async (req, res, next) => {
  const post = await Post.findById(req.params.id);

  if (!post) {
    return next(
      new ErrorResponse(`Không tìm thấy bài viết với id ${req.params.id}`, 404)
    );
  }

  // Kiểm tra nếu bài viết đã được thích
  if (post.likes.includes(req.user.id)) {
    return next(
      new ErrorResponse('Bạn đã thích bài viết này rồi', 400)
    );
  }

  // Thêm người dùng vào danh sách likes
  await Post.findByIdAndUpdate(req.params.id, {
    $push: { likes: req.user.id },
  });

  // Tạo thông báo nếu người thích không phải là chủ bài viết
  if (post.user.toString() !== req.user.id) {
    await Notification.create({
      recipient: post.user,
      sender: req.user.id,
      type: 'like',
      post: post._id,
      content: 'đã thích bài viết của bạn',
    });
  }

  res.status(200).json({
    success: true,
    data: {},
  });
});

// @desc    Unlike post
// @route   PUT /api/v1/posts/:id/unlike
// @access  Private
const unlikePost = asyncHandler(async (req, res, next) => {
  const post = await Post.findById(req.params.id);

  if (!post) {
    return next(
      new ErrorResponse(`Không tìm thấy bài viết với id ${req.params.id}`, 404)
    );
  }

  // Kiểm tra nếu bài viết chưa được thích
  if (!post.likes.includes(req.user.id)) {
    return next(
      new ErrorResponse('Bạn chưa thích bài viết này', 400)
    );
  }

  await Post.findByIdAndUpdate(req.params.id, {
    $pull: { likes: req.user.id },
  });

  res.status(200).json({
    success: true,
    data: {},
  });
});

// @desc    Upload post image
// @route   PUT /api/v1/posts/:id/image
// @access  Private
const uploadPostImage = asyncHandler(async (req, res, next) => {
  const post = await Post.findById(req.params.id);

  if (!post) {
    return next(
      new ErrorResponse(`Không tìm thấy bài viết với id ${req.params.id}`, 404)
    );
  }

  // Kiểm tra nếu người dùng là chủ sở hữu bài viết
  if (post.user.toString() !== req.user.id) {
    return next(
      new ErrorResponse('Không có quyền cập nhật bài viết này', 401)
    );
  }

  if (!req.files) {
    return next(new ErrorResponse('Vui lòng tải lên một tệp', 400));
  }

  const file = req.files.file;

  if (!file.mimetype.startsWith('image')) {
    return next(new ErrorResponse('Vui lòng tải lên một hình ảnh', 400));
  }

  if (file.size > process.env.MAX_FILE_UPLOAD) {
    return next(
      new ErrorResponse(
        `Vui lòng tải lên một hình ảnh nhỏ hơn ${process.env.MAX_FILE_UPLOAD}`,
        400
      )
    );
  }

  file.name = `post_${post._id}${path.parse(file.name).ext}`;

  file.mv(`${process.env.FILE_UPLOAD_PATH}/${file.name}`, async (err) => {
    if (err) {
      console.error(err);
      return next(new ErrorResponse('Lỗi khi tải lên tệp', 500));
    }

    await Post.findByIdAndUpdate(req.params.id, { image: file.name });

    res.status(200).json({
      success: true,
      data: file.name,
    });
  });
});

// @desc    Get feed posts
// @route   GET /api/v1/posts/feed
// @access  Private
const getFeedPosts = asyncHandler(async (req, res, next) => {
  const following = req.user.following;

  const blockedUsers = req.user.blockedUsers;

  const posts = await Post.find({
    $or: [
      { user: { $in: following, $nin: blockedUsers } },
      { user: req.user.id },
    ],
    privacy: 'public',
    isStory: false,
    isReel: false,
  })
    .sort({ createdAt: -1 })
    .populate('user', 'name username avatar')
    .populate({
      path: 'comments',
      select: 'content user createdAt',
      options: { limit: 3 },
      populate: {
        path: 'user',
        select: 'name username avatar',
      },
    });

  res.status(200).json({
    success: true,
    count: posts.length,
    data: posts,
  });
});

// @desc    Get stories
// @route   GET /api/v1/posts/stories
// @access  Private
const getStories = asyncHandler(async (req, res, next) => {
  const following = req.user.following;

  const blockedUsers = req.user.blockedUsers;

  const stories = await Post.find({
    $or: [
      { user: { $in: following, $nin: blockedUsers } },
      { user: req.user.id },
    ],
    isStory: true,
    storyExpireAt: { $gt: Date.now() },
  })
    .sort({ createdAt: -1 })
    .populate('user', 'name username avatar');

  res.status(200).json({
    success: true,
    count: stories.length,
    data: stories,
  });
});

// @desc    Get reels
// @route   GET /api/v1/posts/reels
// @access  Private
const getReels = asyncHandler(async (req, res, next) => {
  const blockedUsers = req.user.blockedUsers;

  const reels = await Post.find({
    user: { $nin: blockedUsers },
    isReel: true,
  })
    .sort({ createdAt: -1 })
    .populate('user', 'name username avatar')
    .populate({
      path: 'comments',
      select: 'content user createdAt',
      options: { limit: 3 },
      populate: {
        path: 'user',
        select: 'name username avatar',
      },
    });

  res.status(200).json({
    success: true,
    count: reels.length,
    data: reels,
  });
});