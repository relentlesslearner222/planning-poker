const { createRoomManager } = require('../roomManager');

function makeIo() {
  const emitted = {};
  const roomEmitted = {};
  return {
    to: (roomId) => ({
      emit: (event, data) => {
        if (!roomEmitted[roomId]) roomEmitted[roomId] = [];
        roomEmitted[roomId].push({ event, data });
      }
    }),
    _roomEmitted: roomEmitted,
    _emitted: emitted
  };
}

function makeSocket(id) {
  const received = [];
  return {
    id,
    emit: (event, data) => received.push({ event, data }),
    join: jest.fn(),
    leave: jest.fn(),
    _received: received
  };
}

describe('roomManager', () => {
  let io, rm;

  beforeEach(() => {
    io = makeIo();
    rm = createRoomManager(io);
  });

  describe('joinRoom', () => {
    it('creates room and makes first joiner host', () => {
      const s = makeSocket('s1');
      rm.joinRoom(s, 'room1', 'Alice');
      const room = rm.getRooms().get('room1');
      expect(room).toBeDefined();
      expect(room.hostId).toBe('s1');
      expect(room.participants.size).toBe(1);
    });

    it('emits room:joined with isHost=true for first joiner', () => {
      const s = makeSocket('s1');
      rm.joinRoom(s, 'room1', 'Alice');
      const joined = s._received.find((e) => e.event === 'room:joined');
      expect(joined).toBeDefined();
      expect(joined.data.isHost).toBe(true);
    });

    it('second joiner is not host', () => {
      const s1 = makeSocket('s1');
      const s2 = makeSocket('s2');
      rm.joinRoom(s1, 'room1', 'Alice');
      rm.joinRoom(s2, 'room1', 'Bob');
      const joined = s2._received.find((e) => e.event === 'room:joined');
      expect(joined.data.isHost).toBe(false);
    });

    it('emits error for missing roomId', () => {
      const s = makeSocket('s1');
      rm.joinRoom(s, '', 'Alice');
      const err = s._received.find((e) => e.event === 'error');
      expect(err).toBeDefined();
    });
  });

  describe('castVote', () => {
    it('records vote for participant', () => {
      const s = makeSocket('s1');
      rm.joinRoom(s, 'room1', 'Alice');
      rm.castVote(s, '5');
      const room = rm.getRooms().get('room1');
      expect(room.participants.get('s1').vote).toBe('5');
    });

    it('rejects vote after reveal', () => {
      const host = makeSocket('s1');
      rm.joinRoom(host, 'room1', 'Alice');
      rm.castVote(host, '3');
      rm.revealVotes(host);
      rm.castVote(host, '8');
      const err = host._received.find((e) => e.event === 'error' && e.data.message.includes('reset'));
      expect(err).toBeDefined();
    });
  });

  describe('revealVotes', () => {
    it('sets revealed=true and emits vote:revealed', () => {
      const host = makeSocket('s1');
      rm.joinRoom(host, 'room1', 'Alice');
      rm.castVote(host, '8');
      rm.revealVotes(host);
      const room = rm.getRooms().get('room1');
      expect(room.revealed).toBe(true);
      const revealEvent = io._roomEmitted['room1'].find((e) => e.event === 'vote:revealed');
      expect(revealEvent).toBeDefined();
    });

    it('rejects reveal from non-host', () => {
      const host = makeSocket('s1');
      const guest = makeSocket('s2');
      rm.joinRoom(host, 'room1', 'Alice');
      rm.joinRoom(guest, 'room1', 'Bob');
      rm.revealVotes(guest);
      const err = guest._received.find((e) => e.event === 'error');
      expect(err).toBeDefined();
    });
  });

  describe('resetVotes', () => {
    it('clears all votes and revealed flag', () => {
      const host = makeSocket('s1');
      rm.joinRoom(host, 'room1', 'Alice');
      rm.castVote(host, '5');
      rm.revealVotes(host);
      rm.resetVotes(host);
      const room = rm.getRooms().get('room1');
      expect(room.revealed).toBe(false);
      expect(room.participants.get('s1').vote).toBeNull();
    });
  });

  describe('timer', () => {
    beforeEach(() => jest.useFakeTimers());
    afterEach(() => jest.useRealTimers());

    it('clamps durationMs to [10000, 300000]', () => {
      const host = makeSocket('s1');
      rm.joinRoom(host, 'room1', 'Alice');
      rm.startTimer(host, 5000); // below min
      const room = rm.getRooms().get('room1');
      expect(room.timer.totalDuration).toBe(10000);
      rm.cancelTimer(host);
    });

    it('ticks down and stops at 0', () => {
      const host = makeSocket('s1');
      rm.joinRoom(host, 'room1', 'Alice');
      rm.startTimer(host, 10000);
      jest.advanceTimersByTime(10200);
      const room = rm.getRooms().get('room1');
      expect(room.timer.remaining).toBe(0);
      expect(room.timer.running).toBe(false);
    });

    it('cancelTimer stops timer and resets remaining', () => {
      const host = makeSocket('s1');
      rm.joinRoom(host, 'room1', 'Alice');
      rm.startTimer(host, 60000);
      rm.cancelTimer(host);
      const room = rm.getRooms().get('room1');
      expect(room.timer.running).toBe(false);
      expect(room.timer.remaining).toBe(0);
    });

    it('rejects timer start from non-host', () => {
      const host = makeSocket('s1');
      const guest = makeSocket('s2');
      rm.joinRoom(host, 'room1', 'Alice');
      rm.joinRoom(guest, 'room1', 'Bob');
      rm.startTimer(guest, 30000);
      const err = guest._received.find((e) => e.event === 'error');
      expect(err).toBeDefined();
    });
  });

  describe('leaveRoom', () => {
    it('destroys room when last participant leaves', () => {
      const s = makeSocket('s1');
      rm.joinRoom(s, 'room1', 'Alice');
      rm.leaveRoom(s);
      expect(rm.getRooms().has('room1')).toBe(false);
    });

    it('re-assigns host when host leaves', () => {
      const host = makeSocket('s1');
      const guest = makeSocket('s2');
      rm.joinRoom(host, 'room1', 'Alice');
      rm.joinRoom(guest, 'room1', 'Bob');
      rm.leaveRoom(host);
      const room = rm.getRooms().get('room1');
      expect(room.hostId).toBe('s2');
    });
  });
});
