"use client";

import { useEffect, useRef, useState, useTransition, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";
import { addComment, promoteToTip } from "@/app/calendar/actions";
import type { EventComment, TipCategory } from "@/types";

type CommentDisplay = EventComment & { display_name: string };

const CATEGORY_OPTIONS: { value: TipCategory; label: string }[] = [
  { value: "general", label: "General" },
  { value: "parking", label: "Parking" },
  { value: "timing", label: "Timing" },
  { value: "facilities", label: "Facilities" },
  { value: "cost", label: "Cost" },
  { value: "accessibility", label: "Accessibility" },
];

function formatWhen(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function PromoteControl({
  pending,
  onPromote,
}: {
  pending: boolean;
  onPromote: (category: TipCategory) => void;
}) {
  const [category, setCategory] = useState<TipCategory>("general");
  return (
    <div className="mt-1 flex items-center gap-1.5">
      <select
        value={category}
        onChange={(e) => setCategory(e.target.value as TipCategory)}
        disabled={pending}
        className="rounded border border-zinc-200 bg-white px-1 py-0.5 text-[11px] text-zinc-600"
      >
        {CATEGORY_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <button
        type="button"
        disabled={pending}
        onClick={() => onPromote(category)}
        className="text-[11px] font-medium text-rose-600 underline disabled:opacity-50"
      >
        {pending ? "Saving…" : "Promote to tip"}
      </button>
    </div>
  );
}

export default function EventComments({
  eventId,
  groupId,
  currentUserId,
  currentUserName,
  initialComments,
  roster,
}: {
  eventId: string;
  groupId: string | null;
  currentUserId: string;
  currentUserName: string;
  initialComments: CommentDisplay[];
  roster: Record<string, string>;
}) {
  const [comments, setComments] = useState<CommentDisplay[]>(initialComments);
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [promotingId, setPromotingId] = useState<string | null>(null);
  const rosterRef = useRef(roster);
  useEffect(() => {
    rosterRef.current = roster;
  }, [roster]);

  useEffect(() => {
    if (!groupId) return;
    const supabase = createClient();
    const channel = supabase
      .channel(`event-comments-${eventId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "event_comments",
          filter: `event_id=eq.${eventId}`,
        },
        (payload) => {
          const row = payload.new as EventComment;
          if (row.group_id !== groupId) return;
          setComments((prev) =>
            prev.some((c) => c.id === row.id)
              ? prev
              : [
                  ...prev,
                  {
                    ...row,
                    display_name: rosterRef.current[row.user_id] ?? "Someone",
                  },
                ],
          );
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "event_comments",
          filter: `event_id=eq.${eventId}`,
        },
        (payload) => {
          const row = payload.new as EventComment;
          setComments((prev) =>
            prev.map((c) => (c.id === row.id ? { ...c, ...row } : c)),
          );
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [eventId, groupId]);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!groupId) return;
    const trimmed = body.trim();
    if (!trimmed) return;
    setError(null);
    startTransition(async () => {
      const result = await addComment(eventId, groupId, trimmed);
      if (result.error) {
        setError(result.error);
        return;
      }
      if (result.comment) {
        const newComment = result.comment;
        setComments((prev) =>
          prev.some((c) => c.id === newComment.id)
            ? prev
            : [...prev, { ...newComment, display_name: currentUserName }],
        );
        setBody("");
      }
    });
  }

  function handlePromote(commentId: string, category: TipCategory) {
    setPromotingId(commentId);
    setError(null);
    startTransition(async () => {
      const result = await promoteToTip(commentId, category);
      setPromotingId(null);
      if (result.error) {
        setError(result.error);
        return;
      }
      setComments((prev) =>
        prev.map((c) =>
          c.id === commentId
            ? { ...c, promoted_tip_id: result.tipId ?? c.promoted_tip_id }
            : c,
        ),
      );
    });
  }

  if (!groupId) {
    return (
      <p className="text-sm text-zinc-400">
        Join a group to see and post comments.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {comments.length === 0 ? (
        <p className="text-sm text-zinc-400">No comments yet.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {comments.map((c) => (
            <li key={c.id} className="rounded-lg bg-zinc-50 px-3 py-2 text-sm">
              <div className="mb-0.5 flex items-baseline justify-between gap-2">
                <span className="font-medium text-zinc-700">
                  {c.user_id === currentUserId ? "You" : c.display_name}
                </span>
                <span className="text-[11px] text-zinc-400">
                  {formatWhen(c.created_at)}
                </span>
              </div>
              <p className="whitespace-pre-wrap text-zinc-700">{c.body}</p>
              {c.promoted_tip_id ? (
                <p className="mt-1 text-[11px] font-medium text-emerald-700">
                  ✓ Saved as a tip
                </p>
              ) : (
                <PromoteControl
                  pending={promotingId === c.id && isPending}
                  onPromote={(category) => handlePromote(c.id, category)}
                />
              )}
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-2">
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value.slice(0, 1000))}
          maxLength={1000}
          rows={2}
          placeholder="Add a comment…"
          className="rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500"
        />
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-zinc-400">{body.length}/1000</span>
          <button
            type="submit"
            disabled={isPending || !body.trim()}
            className="rounded-full bg-zinc-900 px-4 py-1.5 text-sm font-medium text-white disabled:opacity-50"
          >
            Post
          </button>
        </div>
        {error && <p className="text-xs text-red-600">{error}</p>}
      </form>
    </div>
  );
}
