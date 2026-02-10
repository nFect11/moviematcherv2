import { describe, expect, it } from "vitest";
import { injectLikedCandidatesIntoQueue, reconcileCandidateQueue } from "./queue";

describe("reconcileCandidateQueue", () => {
  it("keeps existing order and appends missing ranked ids", () => {
    expect(reconcileCandidateQueue([10, 30], [10, 20, 30, 40])).toEqual([10, 30, 20, 40]);
  });

  it("removes candidates that are no longer ranked", () => {
    expect(reconcileCandidateQueue([10, 20, 30], [20, 40])).toEqual([20, 40]);
  });
});

describe("injectLikedCandidatesIntoQueue", () => {
  it("inserts newly liked candidates 1-3 slots after the current card", () => {
    const queue = [100, 200, 300, 400];
    const likesByMovie = new Map<number, number>([[500, 2]]);
    const nextQueue = injectLikedCandidatesIntoQueue({
      queue,
      likedCandidateIds: [500],
      likeCountsByMovie: likesByMovie
    });

    const insertIndex = nextQueue.indexOf(500);
    expect(insertIndex).toBeGreaterThanOrEqual(1);
    expect(insertIndex).toBeLessThanOrEqual(3);
    expect(nextQueue[0]).toBe(100);
  });

  it("does not duplicate a movie already in queue", () => {
    const queue = [100, 200, 300];
    const likesByMovie = new Map<number, number>([[200, 5]]);
    expect(
      injectLikedCandidatesIntoQueue({
        queue,
        likedCandidateIds: [200],
        likeCountsByMovie: likesByMovie
      })
    ).toEqual(queue);
  });
});
