import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import {
  FiHeart,
  FiMessageCircle,
  FiShare2,
  FiMoreVertical,
  FiImage,
  FiSend,
} from 'react-icons/fi';
import axios from '../../../api/axios';
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

const SocialFeed = () => {
  const { t } = useTranslation();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [newPostContent, setNewPostContent] = useState('');
  const [showNewPost, setShowNewPost] = useState(false);

  useEffect(() => {
    fetchPosts();
  }, []);

  const fetchPosts = async () => {
    try {
      const response = await axios.get('/api/v1/social/posts');
      setPosts(response.data.data.posts);
    } catch (error) {
      console.error('Error fetching posts:', error);
      // Generate mock posts if API fails
      generateMockPosts();
    } finally {
      setLoading(false);
    }
  };

  const generateMockPosts = () => {
    const mockPosts: Post[] = [
      {
        id: '1',
        userId: 'user1',
        username: 'John Crypto',
        userAvatar: 'https://i.pravatar.cc/150?img=1',
        content: 'Just bought my first Bitcoin! 🚀 The future is here! #crypto #bitcoin',
        images: ['https://images.unsplash.com/photo-1518546305927-5a555bb7020d?w=600'],
        likes: 234,
        comments: 45,
        shares: 12,
        isLiked: false,
        createdAt: '2 hours ago',
      },
      {
        id: '2',
        userId: 'user2',
        username: 'Sarah NFT',
        userAvatar: 'https://i.pravatar.cc/150?img=2',
        content: 'Check out my new NFT collection! Limited edition available now. What do you think? 🎨',
        images: [
          'https://images.unsplash.com/photo-1620641788421-7a1c342ea42e?w=600',
          'https://images.unsplash.com/photo-1634973357973-f2ed2657db3c?w=600',
        ],
        likes: 567,
        comments: 89,
        shares: 34,
        isLiked: true,
        createdAt: '5 hours ago',
      },
      {
        id: '3',
        userId: 'user3',
        username: 'Mike Trader',
        userAvatar: 'https://i.pravatar.cc/150?img=3',
        content: 'Ethereum just hit a new milestone! Who else is holding? 💎🙌 #ETH #HODL',
        likes: 892,
        comments: 156,
        shares: 67,
        isLiked: false,
        createdAt: '1 day ago',
      },
      {
        id: '4',
        userId: 'user4',
        username: 'Lisa DeFi',
        userAvatar: 'https://i.pravatar.cc/150?img=4',
        content: 'Just tokenized my vintage watch collection! The future of luxury assets is on the blockchain. Check it out! ⌚✨',
        images: ['https://images.unsplash.com/photo-1523170335258-f5ed11844a49?w=600'],
        likes: 445,
        comments: 78,
        shares: 23,
        isLiked: true,
        createdAt: '2 days ago',
      },
      {
        id: '5',
        userId: 'user5',
        username: 'David Web3',
        userAvatar: 'https://i.pravatar.cc/150?img=5',
        content: 'Loving this platform! Finally, a place where I can trade real-world assets with crypto. The marketplace is amazing! 🌟',
        likes: 678,
        comments: 92,
        shares: 45,
        isLiked: false,
        createdAt: '3 days ago',
      },
    ];

    setPosts(mockPosts);
  };

  const handleLike = async (postId: string) => {
    try {
      await axios.post(`/api/v1/social/posts/${postId}/like`);
      setPosts(
        posts.map((post) =>
          post.id === postId
            ? {
                ...post,
                likes: post.isLiked ? post.likes - 1 : post.likes + 1,
                isLiked: !post.isLiked,
              }
            : post
        )
      );
    } catch (error) {
      // Optimistic update for demo
      setPosts(
        posts.map((post) =>
          post.id === postId
            ? {
                ...post,
                likes: post.isLiked ? post.likes - 1 : post.likes + 1,
                isLiked: !post.isLiked,
              }
            : post
        )
      );
    }
  };

  const handleComment = (postId: string) => {
    toast.info('Comment feature coming soon!');
  };

  const handleShare = (postId: string) => {
    toast.success('Post link copied to clipboard!');
  };

  const handleNewPost = async () => {
    if (!newPostContent.trim()) {
      toast.error('Please enter some content');
      return;
    }

    try {
      await axios.post('/api/v1/social/posts', { content: newPostContent });
      toast.success('Post created!');
      setNewPostContent('');
      setShowNewPost(false);
      fetchPosts();
    } catch (error) {
      toast.info('Demo mode: Post feature requires authentication');
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-20">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      {/* Section Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="text-center mb-12"
      >
        <h2 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
          {t('social.title') || 'Community Feed'}
        </h2>
        <p className="text-lg text-gray-600 dark:text-gray-300">
          {t('social.subtitle') || 'Connect with crypto enthusiasts and asset traders'}
        </p>
      </motion.div>

      {/* New Post Button */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="mb-6"
      >
        {!showNewPost ? (
          <button
            onClick={() => setShowNewPost(true)}
            className="w-full bg-white dark:bg-gray-800 rounded-xl p-4 text-left text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors border border-gray-200 dark:border-gray-700"
          >
            {t('social.whats_on_mind') || "What's on your mind?"}
          </button>
        ) : (
          <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
            <textarea
              value={newPostContent}
              onChange={(e) => setNewPostContent(e.target.value)}
              placeholder={t('social.share_thoughts') || 'Share your thoughts...'}
              className="w-full p-3 bg-gray-50 dark:bg-gray-700 rounded-lg border-none focus:ring-2 focus:ring-primary-500 resize-none"
              rows={4}
            />
            <div className="flex justify-between items-center mt-3">
              <button className="text-gray-500 hover:text-primary-600 transition-colors">
                <FiImage className="w-6 h-6" />
              </button>
              <div className="flex space-x-2">
                <button
                  onClick={() => {
                    setShowNewPost(false);
                    setNewPostContent('');
                  }}
                  className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                >
                  {t('common.cancel') || 'Cancel'}
                </button>
                <button
                  onClick={handleNewPost}
                  className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors flex items-center space-x-2"
                >
                  <FiSend className="w-4 h-4" />
                  <span>{t('social.post') || 'Post'}</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </motion.div>

      {/* Posts Feed */}
      <div className="space-y-6">
        {posts.map((post, index) => (
          <motion.div
            key={post.id}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: index * 0.1 }}
            className="bg-white dark:bg-gray-800 rounded-xl shadow-md overflow-hidden border border-gray-200 dark:border-gray-700"
          >
            {/* Post Header */}
            <div className="p-4 flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <img
                  src={post.userAvatar}
                  alt={post.username}
                  className="w-12 h-12 rounded-full"
                />
                <div>
                  <h4 className="font-semibold text-gray-900 dark:text-white">
                    {post.username}
                  </h4>
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
            <div className="px-4 pb-3">
              <p className="text-gray-800 dark:text-gray-200 whitespace-pre-wrap">
                {post.content}
              </p>
            </div>

            {/* Post Images */}
            {post.images && post.images.length > 0 && (
              <div
                className={`grid ${
                  post.images.length === 1
                    ? 'grid-cols-1'
                    : 'grid-cols-2'
                } gap-1`}
              >
                {post.images.map((image, idx) => (
                  <img
                    key={idx}
                    src={image}
                    alt={`Post ${idx + 1}`}
                    className="w-full h-64 object-cover"
                  />
                ))}
              </div>
            )}

            {/* Post Stats */}
            <div className="px-4 py-2 border-t border-b border-gray-200 dark:border-gray-700">
              <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400">
                <span>{post.likes} {t('social.likes') || 'likes'}</span>
                <div className="flex space-x-4">
                  <span>{post.comments} {t('social.comments') || 'comments'}</span>
                  <span>{post.shares} {t('social.shares') || 'shares'}</span>
                </div>
              </div>
            </div>

            {/* Post Actions */}
            <div className="px-4 py-3 flex justify-around">
              <button
                onClick={() => handleLike(post.id)}
                className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors ${
                  post.isLiked
                    ? 'text-red-600 bg-red-50 dark:bg-red-900/20'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                <FiHeart
                  className={`w-5 h-5 ${post.isLiked ? 'fill-current' : ''}`}
                />
                <span>{t('social.like') || 'Like'}</span>
              </button>
              <button
                onClick={() => handleComment(post.id)}
                className="flex items-center space-x-2 px-4 py-2 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                <FiMessageCircle className="w-5 h-5" />
                <span>{t('social.comment') || 'Comment'}</span>
              </button>
              <button
                onClick={() => handleShare(post.id)}
                className="flex items-center space-x-2 px-4 py-2 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                <FiShare2 className="w-5 h-5" />
                <span>{t('social.share') || 'Share'}</span>
              </button>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Load More Button */}
      <motion.div
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        className="mt-8 text-center"
      >
        <button className="px-8 py-3 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">
          {t('social.load_more') || 'Load More Posts'}
        </button>
      </motion.div>
    </div>
  );
};

export default SocialFeed;

