import { Request, Response } from 'express';
import Comment from '../models/Comment.model';
import Post from '../models/Post.model';
import { publishEvent } from '../utils/rabbitmq';
import logger from '../utils/logger';

export class CommentController {
  // Create comment
  static async createComment(req: Request, res: Response) {
    try {
      const userId = req.headers['x-user-id'] as string;
      const username = req.headers['x-user-name'] as string || 'Anonymous';
      
      const { postId, content, parentCommentId } = req.body;

      // Check if post exists
      const post = await Post.findOne({ _id: postId, isDeleted: false });

      if (!post) {
        return res.status(404).json({
          success: false,
          error: 'Post not found',
        });
      }

      // If replying to a comment, check if parent comment exists
      if (parentCommentId) {
        const parentComment = await Comment.findOne({
          _id: parentCommentId,
          isDeleted: false,
        });

        if (!parentComment) {
          return res.status(404).json({
            success: false,
            error: 'Parent comment not found',
          });
        }
      }

      const comment = await Comment.create({
        postId,
        userId,
        username,
        content,
        parentCommentId,
      });

      // Increment post comment count
      post.commentsCount += 1;
      await post.save();

      // Publish event
      if (post.userId !== userId) {
        await publishEvent('comment.created', {
          commentId: comment.id,
          postId,
          postOwnerId: post.userId,
          commentedBy: userId,
        });
      }

      res.status(201).json({
        success: true,
        data: comment,
      });
    } catch (error: any) {
      logger.error('Create comment error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to create comment',
        details: error.message,
      });
    }
  }

  // Get post comments
  static async getPostComments(req: Request, res: Response) {
    try {
      const { postId } = req.params;
      const { page = 1, limit = 50 } = req.query;

      const pageNum = parseInt(page as string);
      const limitNum = parseInt(limit as string);
      const skip = (pageNum - 1) * limitNum;

      // Get top-level comments (no parent)
      const [comments, total] = await Promise.all([
        Comment.find({
          postId,
          parentCommentId: { $exists: false },
          isDeleted: false,
        })
          .sort({ createdAt: 1 })
          .skip(skip)
          .limit(limitNum)
          .lean(),
        Comment.countDocuments({
          postId,
          parentCommentId: { $exists: false },
          isDeleted: false,
        }),
      ]);

      // Get replies for each comment
      const commentIds = comments.map((c: any) => c._id);
      const replies = await Comment.find({
        parentCommentId: { $in: commentIds },
        isDeleted: false,
      })
        .sort({ createdAt: 1 })
        .lean();

      // Group replies by parent comment
      const repliesMap: any = {};
      replies.forEach((reply: any) => {
        const parentId = reply.parentCommentId;
        if (!repliesMap[parentId]) {
          repliesMap[parentId] = [];
        }
        repliesMap[parentId].push(reply);
      });

      // Attach replies to comments
      const commentsWithReplies = comments.map((comment: any) => ({
        ...comment,
        replies: repliesMap[comment._id] || [],
      }));

      res.json({
        success: true,
        data: {
          comments: commentsWithReplies,
          pagination: {
            page: pageNum,
            limit: limitNum,
            total,
            totalPages: Math.ceil(total / limitNum),
          },
        },
      });
    } catch (error: any) {
      logger.error('Get post comments error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch comments',
      });
    }
  }

  // Update comment
  static async updateComment(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const userId = req.headers['x-user-id'] as string;
      const { content } = req.body;

      const comment = await Comment.findOne({ _id: id, isDeleted: false });

      if (!comment) {
        return res.status(404).json({
          success: false,
          error: 'Comment not found',
        });
      }

      if (comment.userId !== userId) {
        return res.status(403).json({
          success: false,
          error: 'Not authorized to update this comment',
        });
      }

      comment.content = content;
      comment.isEdited = true;
      await comment.save();

      res.json({
        success: true,
        data: comment,
      });
    } catch (error: any) {
      logger.error('Update comment error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update comment',
      });
    }
  }

  // Delete comment
  static async deleteComment(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const userId = req.headers['x-user-id'] as string;

      const comment = await Comment.findOne({ _id: id, isDeleted: false });

      if (!comment) {
        return res.status(404).json({
          success: false,
          error: 'Comment not found',
        });
      }

      if (comment.userId !== userId) {
        return res.status(403).json({
          success: false,
          error: 'Not authorized to delete this comment',
        });
      }

      comment.isDeleted = true;
      await comment.save();

      // Decrement post comment count
      await Post.findByIdAndUpdate(comment.postId, {
        $inc: { commentsCount: -1 },
      });

      // Also delete replies
      await Comment.updateMany(
        { parentCommentId: id },
        { $set: { isDeleted: true } }
      );

      res.json({
        success: true,
        message: 'Comment deleted successfully',
      });
    } catch (error: any) {
      logger.error('Delete comment error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to delete comment',
      });
    }
  }

  // Like/Unlike comment
  static async toggleLike(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const userId = req.headers['x-user-id'] as string;

      const comment = await Comment.findOne({ _id: id, isDeleted: false });

      if (!comment) {
        return res.status(404).json({
          success: false,
          error: 'Comment not found',
        });
      }

      const likeIndex = comment.likes.indexOf(userId);

      if (likeIndex > -1) {
        // Unlike
        comment.likes.splice(likeIndex, 1);
      } else {
        // Like
        comment.likes.push(userId);
      }

      await comment.save();

      res.json({
        success: true,
        data: {
          liked: likeIndex === -1,
          likesCount: comment.likes.length,
        },
      });
    } catch (error: any) {
      logger.error('Toggle like error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to toggle like',
      });
    }
  }
}

