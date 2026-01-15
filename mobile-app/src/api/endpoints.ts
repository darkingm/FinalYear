// Auth
export const authEndpoints = {
  register: '/auth/register',
  login: '/auth/login',
  refresh: '/auth/refresh',
  forgotPassword: '/auth/forgot-password',
  verifyOTP: '/auth/verify-otp',
  verifyEmail: '/auth/verify-email',
  resendOTP: '/auth/resend-otp',
};

// Products
export const productEndpoints = {
  list: '/products',
  featured: '/products/featured',
  detail: (id: string) => `/products/${id}`,
  search: '/products/suggestions',
  like: (id: string) => `/products/${id}/like`,
};

// Cart
export const cartEndpoints = {
  get: '/cart',
  add: '/cart',
  update: (id: string) => `/cart/${id}`,
  remove: (id: string) => `/cart/${id}`,
  clear: '/cart',
};

// Orders
export const orderEndpoints = {
  create: '/orders',
  list: '/orders',
  recent: '/orders/recent',
  detail: (id: string) => `/orders/${id}`,
  cancel: (id: string) => `/orders/${id}/cancel`,
};

// Vouchers
export const voucherEndpoints = {
  list: '/vouchers',
  validate: '/vouchers/validate',
  apply: '/vouchers/apply',
  byCode: (code: string) => `/vouchers/${code}`,
};

// Payments (now merged into order-service)
export const paymentEndpoints = {
  vnpayCreate: '/payments/vnpay/create',
  vnpayStatus: (paymentId: string) => `/payments/vnpay/${paymentId}/status`,
  coinPayment: '/payments/coin',
  // P2P endpoints moved to /p2p (not /payments/p2p)
  p2pList: '/p2p',
  p2pCreate: '/p2p',
  p2pDetail: (id: string) => `/p2p/${id}`,
  p2pProof: (id: string) => `/p2p/${id}/proof`,
  p2pCancel: (id: string) => `/p2p/${id}/cancel`,
};

// Users
export const userEndpoints = {
  profile: '/users/profile',
  updateProfile: '/users/profile',
  uploadAvatar: '/users/profile/avatar',
  balances: (userId: string) => `/users/${userId}/balances`,
  addBalance: (userId: string) => `/users/${userId}/balances/add`,
  withdraw: (userId: string) => `/users/${userId}/withdraw`,
};

// Coins
export const coinEndpoints = {
  top10: '/coins/top10',
  all: '/coins',
  search: '/coins/search',
  detail: (coinId: string) => `/coins/${coinId}`,
  history: (coinId: string) => `/coins/${coinId}/history`,
};

// Chat
export const chatEndpoints = {
  conversations: '/chat',
  conversation: (id: string) => `/chat/${id}`,
  messages: (conversationId: string) => `/chat/${conversationId}/messages`,
  create: '/chat',
  close: (id: string) => `/chat/${id}/close`,
  unreadCount: '/chat/unread/count',
};

// Social (now merged into chat-service)
export const socialEndpoints = {
  // Posts
  feed: '/social/posts/feed',
  postDetail: (id: string) => `/social/posts/${id}`,
  userPosts: (userId: string) => `/social/posts/user/${userId}`,
  createPost: '/social/posts',
  updatePost: (id: string) => `/social/posts/${id}`,
  deletePost: (id: string) => `/social/posts/${id}`,
  likePost: (id: string) => `/social/posts/${id}/like`,
  sharePost: (id: string) => `/social/posts/${id}/share`,
  searchPosts: '/social/posts/search',
  // Comments
  postComments: (postId: string) => `/social/comments/post/${postId}`,
  createComment: '/social/comments',
  updateComment: (id: string) => `/social/comments/${id}`,
  deleteComment: (id: string) => `/social/comments/${id}`,
  likeComment: (id: string) => `/social/comments/${id}/like`,
};


