const posts = [];
const moderationQueue = [];

export function createPost(payload = {}) {
  const post = {
    id: `${Date.now()}-${Math.round(Math.random() * 10000)}`,
    userId: String(payload.userId || 'anonymous'),
    text: String(payload.text || '').slice(0, 1200),
    imageUrl: payload.imageUrl ? String(payload.imageUrl) : null,
    tags: Array.isArray(payload.tags) ? payload.tags.map((tag) => String(tag).toLowerCase()).slice(0, 8) : [],
    status: 'published',
    createdAt: new Date().toISOString(),
  };

  const shouldModerate = /spam|loan scam|betting/i.test(post.text);
  if (shouldModerate) {
    post.status = 'pending-review';
    moderationQueue.unshift({ postId: post.id, reason: 'keyword-flag', createdAt: new Date().toISOString() });
  }

  posts.unshift(post);
  if (posts.length > 400) posts.length = 400;
  return post;
}

export function listPosts() {
  return posts.slice(0, 120);
}

export function listModerationQueue() {
  return moderationQueue.slice(0, 80);
}
