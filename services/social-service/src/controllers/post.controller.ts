import { Request, Response } from 'express';
import Post from '../models/Post.model';
import Comment from '../models/Comment.model';
import { redisClient } from '../utils/redis';
import { publishEvent } from '../utils/rabbitmq';
import logger from '../utils/logger';

const CACHE_TTL = 300; // 5 minutes

export class PostController {
  // Create post
  static async createPost(req: Request, res: Response) {
    try {
      const userId = req.headers['x-user-id'] as string;
      const username = req.headers['x-user-name'] as string || 'Anonymous';
      
      const { content, images, visibility, tags } = req.body;

      const post = await Post.create({
        userId,
        username,
        content,
        images: images || [],
        visibility: visibility || 'PUBLIC',
        tags: tags || [],
      });

      // Publish event
      await publishEvent('post.created', {
        postId: post.id,
        userId,
        content: content.substring(0, 100),
      });

      res.status(201).json({
        success: true,
        data: post,
      });
    } catch (error: any) {
      logger.error('Create post error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to create post',
        details: error.message,
      });
    }
  }

  // Get feed (public posts)
  static async getFeed(req: Request, res: Response) {
    try {
      const { page = 1, limit = 20 } = req.query;

      const pageNum = parseInt(page as string);
      const limitNum = parseInt(limit as string);
      const skip = (pageNum - 1) * limitNum;

      // Try cache
      const cacheKey = `feed:${page}:${limit}`;
      const cached = await redisClient.get(cacheKey);
      
      if (cached) {
        return res.json({
          success: true,
          data: JSON.parse(cached),
          cached: true,
        });
      }

      const [posts, total] = await Promise.all([
        Post.find({ visibility: 'PUBLIC', isDeleted: false })
          .sort({ isPinned: -1, createdAt: -1 })
          .skip(skip)
          .limit(limitNum)
          .lean(),
        Post.countDocuments({ visibility: 'PUBLIC', isDeleted: false }),
      ]);

      const result = {
        posts,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages: Math.ceil(total / limitNum),
          hasMore: pageNum * limitNum < total,
        },
      };

      // Cache result
      await redisClient.setEx(cacheKey, CACHE_TTL, JSON.stringify(result));

      res.json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      logger.error('Get feed error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch feed',
      });
    }
  }

  // Get post by ID
  static async getPostById(req: Request, res: Response) {
    try {
      const { id } = req.params;

      const post = await Post.findOne({ _id: id, isDeleted: false });

      if (!post) {
        return res.status(404).json({
          success: false,
          error: 'Post not found',
        });
      }

      res.json({
        success: true,
        data: post,
      });
    } catch (error: any) {
      logger.error('Get post error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch post',
      });
    }
  }

  // Get user's posts
  static async getUserPosts(req: Request, res: Response) {
    try {
      const { userId } = req.params;
      const { page = 1, limit = 20 } = req.query;

      const pageNum = parseInt(page as string);
      const limitNum = parseInt(limit as string);
      const skip = (pageNum - 1) * limitNum;

      const [posts, total] = await Promise.all([
        Post.find({ userId, isDeleted: false })
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limitNum)
          .lean(),
        Post.countDocuments({ userId, isDeleted: false }),
      ]);

      res.json({
        success: true,
        data: {
          posts,
          pagination: {
            page: pageNum,
            limit: limitNum,
            total,
            totalPages: Math.ceil(total / limitNum),
          },
        },
      });
    } catch (error: any) {
      logger.error('Get user posts error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch user posts',
      });
    }
  }

  // Update post
  static async updatePost(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const userId = req.headers['x-user-id'] as string;
      const { content, images, visibility, tags } = req.body;

      const post = await Post.findOne({ _id: id, isDeleted: false });

      if (!post) {
        return res.status(404).json({
          success: false,
          error: 'Post not found',
        });
      }

      if (post.userId !== userId) {
        return res.status(403).json({
          success: false,
          error: 'Not authorized to update this post',
        });
      }

      if (content !== undefined) post.content = content;
      if (images !== undefined) post.images = images;
      if (visibility !== undefined) post.visibility = visibility;
      if (tags !== undefined) post.tags = tags;
      post.isEdited = true;

      await post.save();

      // Clear cache
      await redisClient.del('feed:*');

      res.json({
        success: true,
        data: post,
      });
    } catch (error: any) {
      logger.error('Update post error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update post',
      });
    }
  }

  // Delete post
  static async deletePost(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const userId = req.headers['x-user-id'] as string;

      const post = await Post.findOne({ _id: id, isDeleted: false });

      if (!post) {
        return res.status(404).json({
          success: false,
          error: 'Post not found',
        });
      }

      if (post.userId !== userId) {
        return res.status(403).json({
          success: false,
          error: 'Not authorized to delete this post',
        });
      }

      post.isDeleted = true;
      await post.save();

      // Also soft delete all comments
      await Comment.updateMany(
        { postId: id },
        { $set: { isDeleted: true } }
      );

      // Clear cache
      await redisClient.del('feed:*');

      res.json({
        success: true,
        message: 'Post deleted successfully',
      });
    } catch (error: any) {
      logger.error('Delete post error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to delete post',
      });
    }
  }

  // Like/Unlike post
  static async toggleLike(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const userId = req.headers['x-user-id'] as string;

      const post = await Post.findOne({ _id: id, isDeleted: false });

      if (!post) {
        return res.status(404).json({
          success: false,
          error: 'Post not found',
        });
      }

      const likeIndex = post.likes.indexOf(userId);

      if (likeIndex > -1) {
        // Unlike
        post.likes.splice(likeIndex, 1);
      } else {
        // Like
        post.likes.push(userId);

        // Publish event
        if (post.userId !== userId) {
          await publishEvent('post.liked', {
            postId: post.id,
            postOwnerId: post.userId,
            likedBy: userId,
          });
        }
      }

      await post.save();

      res.json({
        success: true,
        data: {
          liked: likeIndex === -1,
          likesCount: post.likes.length,
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

  // Share post
  static async sharePost(req: Request, res: Response) {
    try {
      const { id } = req.params;

      const post = await Post.findOne({ _id: id, isDeleted: false });

      if (!post) {
        return res.status(404).json({
          success: false,
          error: 'Post not found',
        });
      }

      post.shares += 1;
      await post.save();

      res.json({
        success: true,
        data: {
          shares: post.shares,
        },
      });
    } catch (error: any) {
      logger.error('Share post error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to share post',
      });
    }
  }

  // Search posts
  static async searchPosts(req: Request, res: Response) {
    try {
      const { q, page = 1, limit = 20 } = req.query;

      if (!q) {
        return res.json({
          success: true,
          data: { posts: [], pagination: { total: 0 } },
        });
      }

      const pageNum = parseInt(page as string);
      const limitNum = parseInt(limit as string);
      const skip = (pageNum - 1) * limitNum;

      const [posts, total] = await Promise.all([
        Post.find({
          $text: { $search: q as string },
          visibility: 'PUBLIC',
          isDeleted: false,
        })
          .sort({ score: { $meta: 'textScore' } })
          .skip(skip)
          .limit(limitNum)
          .lean(),
        Post.countDocuments({
          $text: { $search: q as string },
          visibility: 'PUBLIC',
          isDeleted: false,
        }),
      ]);

      res.json({
        success: true,
        data: {
          posts,
          pagination: {
            page: pageNum,
            limit: limitNum,
            total,
            totalPages: Math.ceil(total / limitNum),
          },
        },
      });
    } catch (error: any) {
      logger.error('Search posts error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to search posts',
      });
    }
  }
}

