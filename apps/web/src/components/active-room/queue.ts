export const PRELOAD_QUEUE_SIZE = 5;

function arraysEqual(left: number[], right: number[]) {
  if (left.length !== right.length) {
    return false;
  }

  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) {
      return false;
    }
  }

  return true;
}

export function reconcileCandidateQueue(previousQueue: number[], rankedCandidateIds: number[]) {
  const rankedSet = new Set(rankedCandidateIds);
  const kept = previousQueue.filter((tmdbId) => rankedSet.has(tmdbId));
  const keptSet = new Set(kept);

  const next = [...kept];
  for (const tmdbId of rankedCandidateIds) {
    if (!keptSet.has(tmdbId)) {
      next.push(tmdbId);
    }
  }

  return arraysEqual(previousQueue, next) ? previousQueue : next;
}

function resolveSocialInsertionOffset(tmdbId: number, likes: number) {
  return 1 + ((tmdbId + likes) % 3);
}

export function injectLikedCandidatesIntoQueue({
  queue,
  likedCandidateIds,
  likeCountsByMovie
}: {
  queue: number[];
  likedCandidateIds: number[];
  likeCountsByMovie: Map<number, number>;
}) {
  let nextQueue = queue;

  for (const tmdbId of likedCandidateIds) {
    if (nextQueue.includes(tmdbId)) {
      continue;
    }

    const likes = likeCountsByMovie.get(tmdbId) ?? 0;
    const offset = resolveSocialInsertionOffset(tmdbId, likes);
    const insertIndex = Math.min(nextQueue.length, Math.max(1, offset));

    const before = nextQueue.slice(0, insertIndex);
    const after = nextQueue.slice(insertIndex);
    nextQueue = [...before, tmdbId, ...after];
  }

  return arraysEqual(queue, nextQueue) ? queue : nextQueue;
}

export type CandidateQueueAction =
  | {
      type: "reset";
    }
  | {
      type: "reconcile";
      rankedCandidateIds: number[];
    }
  | {
      type: "inject_likes";
      likedCandidateIds: number[];
      likeCountsByMovie: Map<number, number>;
    }
  | {
      type: "inject_batch";
      tmdbIds: number[];
      startIndex: number;
    }
  | {
      type: "remove";
      tmdbId: number;
    }
  | {
      type: "prepend";
      tmdbId: number;
    };

export function candidateQueueReducer(queue: number[], action: CandidateQueueAction) {
  if (action.type === "reset") {
    return queue.length > 0 ? [] : queue;
  }

  if (action.type === "reconcile") {
    return reconcileCandidateQueue(queue, action.rankedCandidateIds);
  }

  if (action.type === "inject_likes") {
    return injectLikedCandidatesIntoQueue({
      queue,
      likedCandidateIds: action.likedCandidateIds,
      likeCountsByMovie: action.likeCountsByMovie
    });
  }

  if (action.type === "inject_batch") {
    let nextQueue = queue;
    const existing = new Set(nextQueue);
    let insertIndex = Math.min(nextQueue.length, action.startIndex);

    for (const tmdbId of action.tmdbIds) {
      if (existing.has(tmdbId)) {
        continue;
      }

      existing.add(tmdbId);
      const before = nextQueue.slice(0, insertIndex);
      const after = nextQueue.slice(insertIndex);
      nextQueue = [...before, tmdbId, ...after];
      insertIndex += 1;
    }

    return arraysEqual(queue, nextQueue) ? queue : nextQueue;
  }

  if (action.type === "remove") {
    const nextQueue = queue.filter((tmdbId) => tmdbId !== action.tmdbId);
    return arraysEqual(queue, nextQueue) ? queue : nextQueue;
  }

  if (action.type === "prepend") {
    if (queue.includes(action.tmdbId)) {
      return queue;
    }

    return [action.tmdbId, ...queue];
  }

  return queue;
}
