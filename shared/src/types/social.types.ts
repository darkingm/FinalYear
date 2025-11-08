export enum PostStatus {
  ACTIVE = 'ACTIVE',
  HIDDEN = 'HIDDEN',
  DELETED = 'DELETED',
  REPORTED = 'REPORTED',
}

export enum PostType {
  TEXT = 'TEXT',
  IMAGE = 'IMAGE',
  VIDEO = 'VIDEO',
  LINK = 'LINK',
}

export interface IPost {
  id: string;
  authorId: string;
  authorName: string;
  authorAvatar?: string;
  type: PostType;
  content: string;
  images?: string[];
  videoUrl?: string;
  linkUrl?: string;
  linkTitle?: string;
  linkDescription?: string;
  linkImage?: string;
  status: PostStatus;
  likes: number;
  commentsCount: number;
  sharesCount: number;
  views: number;
  tags?: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface IComment {
  id: string;
  postId: string;
  authorId: string;
  authorName: string;
  authorAvatar?: string;
  content: string;
  parentCommentId?: string;
  likes: number;
  repliesCount: number;
  createdAt: Date;
  updatedAt: Date;
  deleted: boolean;
}

export interface IPostLike {
  postId: string;
  userId: string;
  createdAt: Date;
}

export interface ICommentLike {
  commentId: string;
  userId: string;
  createdAt: Date;
}

export interface ICreatePostRequest {
  type: PostType;
  content: string;
  images?: string[];
  videoUrl?: string;
  linkUrl?: string;
  tags?: string[];
}

export interface IUpdatePostRequest {
  content?: string;
  status?: PostStatus;
  tags?: string[];
}

export interface ICreateCommentRequest {
  postId: string;
  content: string;
  parentCommentId?: string;
}

export interface IPostFeed {
  posts: IPost[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

