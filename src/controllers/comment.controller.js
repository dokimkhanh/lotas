import ErrorResponse from '../utils/errorResponse.js';
import asyncHandler from '../middlewares/async.middleware.js';
import Comment from '../models/comment.model.js';
import Post from '../models/post.model.js';
import User from '../models/user.model.js';
import Notification from '../models/notification.model.js';

// @desc    Get comments for a post
// @route   GET /api/v1/posts/:postId/comments
// @access  Private
const getComments = asyncHandler(async (req, res, next) => {
  const post = await Post.findById(req.params.postId);

  if (!post) {
    return next(
      new ErrorResponse(`Không tìm thấy bài viết với id ${req.params.postId}`, 404)
    );
  }

  // Kiểm tra nếu bài viết thuộc về người dùng bị chặn
  if (req.user.blockedUsers.includes(post.user.toString())) {
    return next(
      new ErrorResponse('Bạn đã bị người dùng này chặn', 403)
    );
  }

  const comments = await Comment.find({ post: req.params.postId, parent: null })
    .sort({ createdAt: -1 })
    .populate('user', 'name username avatar')
    .populate({
      path: 'replies',
      populate: {
        path: 'user',
        select: 'name username avatar',
      },
    });

  res.status(200).json({
    success: true,
    count: comments.length,
    data: comments,
  });
});

// @desc    Get single comment
// @route   GET /api/v1/comments/:id
// @access  Private
const getComment = asyncHandler(async (req, res, next) => {
  const comment = await Comment.findById(req.params.id)
    .populate('user', 'name username avatar')
    .populate({
      path: 'replies',
      populate: {
        path: 'user',
        select: 'name username avatar',
      },
    });

  if (!comment) {
    return next(
      new ErrorResponse(`Không tìm thấy bình luận với id ${req.params.id}`, 404)
    );
  }

  // Kiểm tra nếu bình luận thuộc về người dùng bị chặn
  if (req.user.blockedUsers.includes(comment.user.toString())) {
    return next(
      new ErrorResponse('Bạn đã bị người dùng này chặn', 403)
    );
  }

  res.status(200).json({
    success: true,
    data: comment,
  });
});

// @desc    Add comment to post
// @route   POST /api/v1/posts/:postId/comments
// @access  Private
const addComment = asyncHandler(async (req, res, next) => {
  const post = await Post.findById(req.params.postId);

  if (!post) {
    return next(
      new ErrorResponse(`Không tìm thấy bài viết với id ${req.params.postId}`, 404)
    );
  }

  // Kiểm tra nếu bài viết thuộc về người dùng bị chặn
  if (req.user.blockedUsers.includes(post.user.toString())) {
    return next(
      new ErrorResponse('Bạn đã bị người dùng này chặn', 403)
    );
  }

  // Thêm user và post vào req.body
  req.body.user = req.user.id;
  req.body.post = req.params.postId;

  const comment = await Comment.create(req.body);

  // Tạo thông báo nếu người bình luận không phải là chủ bài viết
  if (post.user.toString() !== req.user.id) {
    await Notification.create({
      recipient: post.user,
      sender: req.user.id,
      type: 'comment',
      post: post._id,
      comment: comment._id,
      content: 'đã bình luận về bài viết của bạn',
    });
  }

  res.status(201).json({
    success: true,
    data: comment,
  });
});

// @desc    Add reply to comment
// @route   POST /api/v1/comments/:id/replies
// @access  Private
const addReply = asyncHandler(async (req, res, next) => {
  const parentComment = await Comment.findById(req.params.id);

  if (!parentComment) {
    return next(
      new ErrorResponse(`Không tìm thấy bình luận với id ${req.params.id}`, 404)
    );
  }

  // Kiểm tra nếu bình luận thuộc về người dùng bị chặn
  if (req.user.blockedUsers.includes(parentComment.user.toString())) {
    return next(
      new ErrorResponse('Bạn đã bị người dùng này chặn', 403)
    );
  }

  // Thêm user, post và parent vào req.body
  req.body.user = req.user.id;
  req.body.post = parentComment.post;
  req.body.parent = req.params.id;

  const reply = await Comment.create(req.body);

  // Thêm reply vào danh sách replies của comment cha
  await Comment.findByIdAndUpdate(req.params.id, {
    $push: { replies: reply._id },
  });

  // Tạo thông báo nếu người trả lời không phải là chủ bình luận
  if (parentComment.user.toString() !== req.user.id) {
    await Notification.create({
      recipient: parentComment.user,
      sender: req.user.id,
      type: 'comment',
      post: parentComment.post,
      comment: reply._id,
      content: 'đã trả lời bình luận của bạn',
    });
  }

  res.status(201).json({
    success: true,
    data: reply,
  });
});

// @desc    Update comment
// @route   PUT /api/v1/comments/:id
// @access  Private
const updateComment = asyncHandler(async (req, res, next) => {
  let comment = await Comment.findById(req.params.id);

  if (!comment) {
    return next(
      new ErrorResponse(`Không tìm thấy bình luận với id ${req.params.id}`, 404)
    );
  }

  // Kiểm tra nếu người dùng là chủ sở hữu bình luận
  if (comment.user.toString() !== req.user.id) {
    return next(
      new ErrorResponse('Không có quyền cập nhật bình luận này', 401)
    );
  }

  comment = await Comment.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  });

  res.status(200).json({
    success: true,
    data: comment,
  });
});

// @desc    Delete comment
// @route   DELETE /api/v1/comments/:id
// @access  Private
const deleteComment = asyncHandler(async (req, res, next) => {
  const comment = await Comment.findById(req.params.id);

  if (!comment) {
    return next(
      new ErrorResponse(`Không tìm thấy bình luận với id ${req.params.id}`, 404)
    );
  }

  // Kiểm tra nếu người dùng là chủ sở hữu bình luận
  if (comment.user.toString() !== req.user.id) {
    return next(
      new ErrorResponse('Không có quyền xóa bình luận này', 401)
    );
  }

  await comment.remove();

  // Nếu là reply, xóa khỏi danh sách replies của comment cha
  if (comment.parent) {
    await Comment.findByIdAndUpdate(comment.parent, {
      $pull: { replies: comment._id },
    });
  }

  res.status(200).json({
    success: true,
    data: {},
  });
});

// @desc    Like comment
// @route   PUT /api/v1/comments/:id/like
// @access  Private
const likeComment = asyncHandler(async (req, res, next) => {
  const comment = await Comment.findById(req.params.id);

  if (!comment) {
    return next(
      new ErrorResponse(`Không tìm thấy bình luận với id ${req.params.id}`, 404)
    );
  }

  // Kiểm tra nếu bình luận thuộc về người dùng bị chặn
  if (req.user.blockedUsers.includes(comment.user.toString())) {
    return next(
      new ErrorResponse('Bạn đã bị người dùng này chặn', 403)
    );
  }

  // Kiểm tra nếu đã like bình luận này rồi
  if (comment.likes.includes(req.user.id)) {
    return next(
      new ErrorResponse('Bạn đã thích bình luận này rồi', 400)
    );
  }

  // Thêm người dùng vào danh sách likes
  await Comment.findByIdAndUpdate(req.params.id, {
    $push: { likes: req.user.id },
  });

  // Tạo thông báo nếu người like không phải là chủ bình luận
  if (comment.user.toString() !== req.user.id) {
    await Notification.create({
      recipient: comment.user,
      sender: req.user.id,
      type: 'like',
      post: comment.post,
      comment: comment._id,
      content: 'đã thích bình luận của bạn',
    });
  }

  res.status(200).json({
    success: true,
    data: {},
  });
});

// @desc    Unlike comment
// @route   PUT /api/v1/comments/:id/unlike
// @access  Private
const unlikeComment = asyncHandler(async (req, res, next) => {
  const comment = await Comment.findById(req.params.id);

  if (!comment) {
    return next(
      new ErrorResponse(`Không tìm thấy bình luận với id ${req.params.id}`, 404)
    );
  }

  // Kiểm tra nếu chưa like bình luận này
  if (!comment.likes.includes(req.user.id)) {
    return next(
      new ErrorResponse('Bạn chưa thích bình luận này', 400)
    );
  }

  // Xóa người dùng khỏi danh sách likes
  await Comment.findByIdAndUpdate(req.params.id, {
    $pull: { likes: req.user.id },
  });

  res.status(200).json({
    success: true,
    data: {},
  });
});

export {
  getComments,
  getComment,
  addComment,
  addReply,
  updateComment,
  deleteComment,
  likeComment,
  unlikeComment
};