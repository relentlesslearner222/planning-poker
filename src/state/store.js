/**
 * store.js - Reactive state management (observer pattern)
 *
 * State shape:
 * {
 *   stories:      Story[],
 *   activeStoryId: string | null,
 *   participants:  Participant[],
 *   votes:         { [storyId]: { [participantId]: string } },
 *   revealed:      { [storyId]: boolean },
 *   timer: {
 *     duration:   number,   // seconds
 *     remaining:  number,   // seconds left
 *     running:    boolean,
 *     expired:    boolean,
 *   }
 * }
 */

const AVATAR_COLORS = [
  '#6366f1', '#22d3ee', '#10b981', '#f59e0b',
  '#f43f5e', '#a78bfa', '#fb923c', '#34d399',
];

let _uid = 1;
export const uid = () => `id_${Date.now()}_${_uid++}`;

const defaultState = () => ({
  stories: [],
  activeStoryId: null,
  participants: [],
  votes: {},
  revealed: {},
  timer: {
    duration: 60,
    remaining: 60,
    running: false,
    expired: false,
  },
});

export function createStore() {
  let state = defaultState();
  const listeners = new Set();

  const notify = () => listeners.forEach(fn => fn(state));

  const setState = (updater) => {
    state = updater(state);
    notify();
  };

  return {
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },

    getState() { return state; },

    // --- Stories ---
    addStory(name) {
      const story = { id: uid(), name: name.trim() };
      setState(s => ({
        ...s,
        stories: [...s.stories, story],
        activeStoryId: s.activeStoryId ?? story.id,
        votes: { ...s.votes, [story.id]: {} },
        revealed: { ...s.revealed, [story.id]: false },
      }));
    },

    removeStory(id) {
      setState(s => {
        const stories = s.stories.filter(st => st.id !== id);
        const activeStoryId = s.activeStoryId === id
          ? (stories[0]?.id ?? null)
          : s.activeStoryId;
        const votes = { ...s.votes };
        delete votes[id];
        const revealed = { ...s.revealed };
        delete revealed[id];
        return { ...s, stories, activeStoryId, votes, revealed };
      });
    },

    setActiveStory(id) {
      setState(s => ({ ...s, activeStoryId: id }));
    },

    // --- Participants ---
    addParticipant(name) {
      const colorIndex = _uid % AVATAR_COLORS.length;
      const participant = {
        id: uid(),
        name: name.trim(),
        color: AVATAR_COLORS[colorIndex],
        initials: name.trim().split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase(),
      };
      setState(s => ({ ...s, participants: [...s.participants, participant] }));
    },

    removeParticipant(id) {
      setState(s => {
        const participants = s.participants.filter(p => p.id !== id);
        const votes = {};
        Object.keys(s.votes).forEach(storyId => {
          const sv = { ...s.votes[storyId] };
          delete sv[id];
          votes[storyId] = sv;
        });
        return { ...s, participants, votes };
      });
    },

    // --- Voting ---
    castVote(participantId, storyId, value) {
      setState(s => ({
        ...s,
        votes: {
          ...s.votes,
          [storyId]: {
            ...(s.votes[storyId] || {}),
            [participantId]: value,
          },
        },
      }));
    },

    revealVotes(storyId) {
      setState(s => ({ ...s, revealed: { ...s.revealed, [storyId]: true } }));
    },

    resetVotes(storyId) {
      setState(s => ({
        ...s,
        votes: { ...s.votes, [storyId]: {} },
        revealed: { ...s.revealed, [storyId]: false },
      }));
    },

    // --- Timer ---
    setTimerDuration(seconds) {
      setState(s => ({
        ...s,
        timer: { ...s.timer, duration: seconds, remaining: seconds, running: false, expired: false },
      }));
    },

    tickTimer() {
      setState(s => {
        const remaining = Math.max(0, s.timer.remaining - 1);
        return {
          ...s,
          timer: {
            ...s.timer,
            remaining,
            expired: remaining === 0,
            running: remaining > 0 ? s.timer.running : false,
          },
        };
      });
    },

    startTimer() {
      setState(s => ({
        ...s,
        timer: {
          ...s.timer,
          running: true,
          expired: false,
          remaining: s.timer.remaining === 0 ? s.timer.duration : s.timer.remaining,
        },
      }));
    },

    pauseTimer() {
      setState(s => ({ ...s, timer: { ...s.timer, running: false } }));
    },

    resetTimer() {
      setState(s => ({
        ...s,
        timer: { ...s.timer, remaining: s.timer.duration, running: false, expired: false },
      }));
    },
  };
}