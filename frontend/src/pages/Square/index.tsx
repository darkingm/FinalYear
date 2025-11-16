import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';
import { RootState } from '../../store';
import {
  FiHeart,
  FiMessageCircle,
  FiShare2,
  FiImage,
  FiSend,
  FiMoreVertical,
} from 'react-icons/fi';
import toast from 'react-hot-toast';

interface Post {
  id: string;
  userId: string;
  username: string;
  userAvatar: string;
  content: string;
  images?: string[];
  likes: number;
  comments: number;
  shares: number;
  isLiked: boolean;
  createdAt: string;
}

const SquarePage = () => {
  const { t } = useTranslation();
  const { user, isAuthenticated } = useSelector((state: RootState) => state.auth);
  const [posts, setPosts] = useState<Post[]>([]);
  const [newPost, setNewPost] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchPosts();
  }, []);

  const fetchPosts = async () => {
    // Mock data for now - will connect to backend later
    const mockPosts: Post[] = [
      {
        id: '1',
        userId: 'user1',
        username: 'cryptotrader_pro',
        userAvatar: 'https://ui-avatars.com/api/?name=Crypto+Trader&background=random',
        content: 'Just bought 0.5 BTC! 🚀 The market is looking bullish today. What are your thoughts?',
        images: [],
        likes: 142,
        comments: 23,
        shares: 8,
        isLiked: false,
        createdAt: '2 hours ago',
      },
      {
        id: '2',
        userId: 'user2',
        username: 'blockchain_enthusiast',
        userAvatar: 'https://ui-avatars.com/api/?name=Blockchain+Fan&background=random',
        content: 'Check out this amazing NFT I just acquired! 🎨✨',
        images: ['https://picsum.photos/600/400?random=1'],
        likes: 89,
        comments: 15,
        shares: 5,
        isLiked: true,
        createdAt: '5 hours ago',
      },
      {
        id: '3',
        userId: 'user3',
        username: 'defi_master',
        userAvatar: 'https://ui-avatars.com/api/?name=DeFi+Master&background=random',
        content: 'New to DeFi? Here are my top 5 tips for beginners:\n1. Start small\n2. DYOR (Do Your Own Research)\n3. Use hardware wallets\n4. Diversify your portfolio\n5. Stay updated with crypto news',
        images: [],
        likes: 256,
        comments: 47,
        shares: 32,
        isLiked: false,
        createdAt: '1 day ago',
      },
    ];
    setPosts(mockPosts);
  };

  const handleCreatePost = async () => {
    if (!isAuthenticated) {
      toast.error('Please login to create a post');
      return;
    }

    if (!newPost.trim()) {
      toast.error('Post content cannot be empty');
      return;
    }

    setLoading(true);
    try {
      // TODO: Connect to backend API
      // const response = await axios.post('/api/v1/social/posts', { content: newPost });
      
      // Mock: Add new post to the top
      const mockNewPost: Post = {
        id: `post-${Date.now()}`,
        userId: user?.id || 'current-user',
        username: user?.username || 'Anonymous',
        userAvatar: `https://ui-avatars.com/api/?name=${user?.username || 'User'}&background=random`,
        content: newPost,
        images: [],
        likes: 0,
        comments: 0,
        shares: 0,
        isLiked: false,
        createdAt: 'Just now',
      };

      setPosts([mockNewPost, ...posts]);
      setNewPost('');
      toast.success('Post created successfully!');
    } catch (error) {
      toast.error('Failed to create post');
    } finally {
      setLoading(false);
    }
  };

  const handleLike = (postId: string) => {
    if (!isAuthenticated) {
      toast.error('Please login to like posts');
      return;
    }

    setPosts(posts.map(post => {
      if (post.id === postId) {
        return {
          ...post,
          isLiked: !post.isLiked,
          likes: post.isLiked ? post.likes - 1 : post.likes + 1,
        };
      }
      return post;
    }));
  };

  const handleComment = (postId: string) => {
    if (!isAuthenticated) {
      toast.error('Please login to comment');
      return;
    }
    toast.info('Comment feature coming soon!');
  };

  const handleShare = (postId: string) => {
    toast.success('Post link copied to clipboard!');
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8">
      <div className="max-w-4xl mx-auto px-4">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2">
            {t('square.title') || 'Square'}
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            {t('square.subtitle') || 'Connect with the crypto community'}
          </p>
        </motion.div>

        {/* Create Post */}
        {isAuthenticated && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-6 mb-6"
          >
            <div className="flex items-start space-x-4">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold">
                {user?.username?.charAt(0).toUpperCase() || 'U'}
              </div>
              <div className="flex-1">
                <textarea
                  value={newPost}
                  onChange={(e) => setNewPost(e.target.value)}
                  placeholder="What's on your mind?"
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  rows={3}
                />
                <div className="flex items-center justify-between mt-4">
                  <button className="flex items-center space-x-2 text-gray-600 dark:text-gray-400 hover:text-blue-500 dark:hover:text-blue-400 transition">
                    <FiImage className="w-5 h-5" />
                    <span className="text-sm">Add Image</span>
                  </button>
                  <button
                    onClick={handleCreatePost}
                    disabled={loading || !newPost.trim()}
                    className="flex items-center space-x-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
                  >
                    <FiSend className="w-4 h-4" />
                    <span>Post</span>
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* Posts Feed */}
        <div className="space-y-6">
          {posts.map((post, index) => (
            <motion.div
              key={post.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: isAuthenticated ? 0.2 + index * 0.1 : 0.1 + index * 0.1 }}
              className="bg-white dark:bg-gray-800 rounded-xl shadow-md overflow-hidden"
            >
              {/* Post Header */}
              <div className="p-6 pb-4">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center space-x-3">
                    <img
                      src={post.userAvatar}
                      alt={post.username}
                      className="w-12 h-12 rounded-full"
                    />
                    <div>
                      <h3 className="font-semibold text-gray-900 dark:text-white">
                        @{post.username}
                      </h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {post.createdAt}
                      </p>
                    </div>
                  </div>
                  <button className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
                    <FiMoreVertical className="w-5 h-5" />
                  </button>
                </div>

                {/* Post Content */}
                <p className="text-gray-900 dark:text-white whitespace-pre-wrap mb-4">
                  {post.content}
                </p>

                {/* Post Images */}
                {post.images && post.images.length > 0 && (
                  <div className="mb-4 rounded-xl overflow-hidden">
                    <img
                      src={post.images[0]}
                      alt="Post content"
                      className="w-full h-auto"
                    />
                  </div>
                )}
              </div>

              {/* Post Actions */}
              <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-around">
                  <button
                    onClick={() => handleLike(post.id)}
                    className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition ${
                      post.isLiked
                        ? 'text-red-500 bg-red-50 dark:bg-red-900/20'
                        : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                    }`}
                  >
                    <FiHeart className={`w-5 h-5 ${post.isLiked ? 'fill-current' : ''}`} />
                    <span className="font-medium">{post.likes}</span>
                  </button>
                  <button
                    onClick={() => handleComment(post.id)}
                    className="flex items-center space-x-2 px-4 py-2 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition"
                  >
                    <FiMessageCircle className="w-5 h-5" />
                    <span className="font-medium">{post.comments}</span>
                  </button>
                  <button
                    onClick={() => handleShare(post.id)}
                    className="flex items-center space-x-2 px-4 py-2 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition"
                  >
                    <FiShare2 className="w-5 h-5" />
                    <span className="font-medium">{post.shares}</span>
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Login Prompt for Non-authenticated Users */}
        {!isAuthenticated && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="fixed bottom-8 right-8 bg-blue-600 text-white px-6 py-3 rounded-full shadow-lg"
          >
            <a href="/auth" className="font-medium">
              Login to create posts →
            </a>
          </motion.div>
        )}
      </div>
    </div>
  );
};

export default SquarePage;

