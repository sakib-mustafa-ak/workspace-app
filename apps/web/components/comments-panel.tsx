'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { MessageSquare, Send, Trash2, Pencil, X, Check } from 'lucide-react';
import { commentsApi, type Comment } from '@/lib/comments';
import { useAuth } from '@/contexts/auth-context';

type Props = {
  boardId: string;
};

export function CommentsPanel({ boardId }: Props) {
  const { user } = useAuth();
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [content, setContent] = useState('');
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');

  useEffect(() => {
    commentsApi.list(boardId)
      .then(setComments)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [boardId]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!content.trim()) return;
    try {
      const created = await commentsApi.create(boardId, {
        content: content.trim(),
        parentId: replyTo ?? undefined,
      });
      setComments((prev) => [...prev, created]);
      setContent('');
      setReplyTo(null);
    } catch { /* handled */ }
  }

  async function handleEdit(commentId: string) {
    if (!editContent.trim()) return;
    try {
      const updated = await commentsApi.update(boardId, commentId, {
        content: editContent.trim(),
      });
      setComments((prev) => prev.map((c) => (c.id === commentId ? updated : c)));
      setEditingId(null);
    } catch { /* handled */ }
  }

  async function handleDelete(commentId: string) {
    try {
      await commentsApi.delete(boardId, commentId);
      setComments((prev) => prev.filter((c) => c.id !== commentId));
    } catch { /* handled */ }
  }

  const rootComments = comments.filter((c) => !c.parentId);
  const replies = (parentId: string) => comments.filter((c) => c.parentId === parentId);

  return (
    <div className="flex h-full flex-col border-l border-surface-800 bg-surface-900">
      <div className="flex items-center gap-2 border-b border-surface-800 px-4 py-3">
        <MessageSquare size={16} className="text-surface-400" />
        <h3 className="text-sm font-medium">Comments</h3>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {loading ? (
          <div className="flex justify-center py-8">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-surface-600 border-t-primary-500" />
          </div>
        ) : rootComments.length === 0 ? (
          <p className="py-8 text-center text-xs text-surface-500">No comments yet</p>
        ) : (
          rootComments.map((comment) => (
            <div key={comment.id}>
              <CommentRow
                comment={comment}
                userId={user?.id}
                isEditing={editingId === comment.id}
                editContent={editContent}
                onStartEdit={() => { setEditingId(comment.id); setEditContent(comment.content); }}
                onCancelEdit={() => setEditingId(null)}
                onEditChange={setEditContent}
                onSaveEdit={() => handleEdit(comment.id)}
                onDelete={() => handleDelete(comment.id)}
                onReply={() => setReplyTo(comment.id)}
              />
              {replies(comment.id).map((reply) => (
                <div key={reply.id} className="ml-4 mt-2">
                  <CommentRow
                    comment={reply}
                    userId={user?.id}
                    isEditing={editingId === reply.id}
                    editContent={editContent}
                    onStartEdit={() => { setEditingId(reply.id); setEditContent(reply.content); }}
                    onCancelEdit={() => setEditingId(null)}
                    onEditChange={setEditContent}
                    onSaveEdit={() => handleEdit(reply.id)}
                    onDelete={() => handleDelete(reply.id)}
                    onReply={() => {}}
                  />
                </div>
              ))}
            </div>
          ))
        )}
      </div>

      <form onSubmit={handleSubmit} className="border-t border-surface-800 p-3">
        {replyTo && (
          <div className="mb-2 flex items-center justify-between rounded bg-surface-800 px-2 py-1">
            <span className="text-xs text-surface-400">Replying to comment</span>
            <button type="button" onClick={() => setReplyTo(null)} title="Cancel reply" aria-label="Cancel reply">
              <X size={12} className="text-surface-500" />
            </button>
          </div>
        )}
        <div className="flex gap-2">
          <input
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Write a comment…"
            className="flex-1 rounded-lg border border-surface-700 bg-surface-800 px-3 py-2 text-xs outline-none focus:border-primary-500"
          />
          <button
            type="submit"
            disabled={!content.trim()}
            title="Send comment"
            aria-label="Send comment"
            className="rounded-lg bg-primary-600 p-2 text-white hover:bg-primary-500 disabled:opacity-50"
          >
            <Send size={14} />
          </button>
        </div>
      </form>
    </div>
  );
}

function CommentRow({
  comment,
  userId,
  isEditing,
  editContent,
  onStartEdit,
  onCancelEdit,
  onEditChange,
  onSaveEdit,
  onDelete,
  onReply,
}: {
  comment: Comment;
  userId?: string;
  isEditing: boolean;
  editContent: string;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onEditChange: (v: string) => void;
  onSaveEdit: () => void;
  onDelete: () => void;
  onReply: () => void;
}) {
  const isOwner = userId === comment.userId;
  const authorName = comment.author?.displayName || 'Unknown';
  const avatarInitial = (authorName.charAt(0) || '?').toUpperCase();

  return (
    <div className="rounded-lg border border-surface-800 bg-surface-950 p-3">
      {isEditing ? (
        <div className="space-y-2">
          <textarea
            value={editContent}
            onChange={(e) => onEditChange(e.target.value)}
            className="w-full rounded-lg border border-surface-700 bg-surface-800 px-2 py-1.5 text-xs outline-none focus:border-primary-500"
            rows={2}
          />
          <div className="flex gap-1.5">
            <button onClick={onSaveEdit} className="rounded bg-primary-600 px-2 py-1 text-xs text-white">
              <Check size={12} />
            </button>
            <button onClick={onCancelEdit} className="rounded bg-surface-700 px-2 py-1 text-xs text-surface-300">
              <X size={12} />
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-2">
            {comment.author?.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={comment.author.avatarUrl}
                alt={authorName}
                className="h-6 w-6 shrink-0 rounded-full object-cover"
              />
            ) : (
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary-500/30 to-primary-700/30 text-caption font-bold text-primary-300">
                {avatarInitial}
              </div>
            )}
            <span className="text-xs font-semibold text-warm-300">{authorName}</span>
            <span className="text-caption text-surface-500">
              {new Date(comment.createdAt).toLocaleString()}
            </span>
            {comment.editedAt && <span className="text-caption text-surface-600">(edited)</span>}
            {isOwner && (
              <div className="ml-auto flex gap-1 shrink-0">
                <button onClick={onStartEdit} title="Edit comment" aria-label="Edit comment" className="text-surface-500 hover:text-surface-300">
                  <Pencil size={12} />
                </button>
                <button onClick={onDelete} title="Delete comment" aria-label="Delete comment" className="text-surface-500 hover:text-red-400">
                  <Trash2 size={12} />
                </button>
              </div>
            )}
          </div>
          <p className="mt-1.5 text-xs text-surface-200">{comment.content}</p>
          <div className="mt-1.5 flex items-center gap-2">
            {!comment.parentId && (
              <button onClick={onReply} className="text-caption text-surface-500 hover:text-surface-300">
                Reply
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
