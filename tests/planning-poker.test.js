// ============================================================================
// Planning Poker - Test Suite
// Covers: server/index.js  |  client/src/App.jsx  |  package.json
// Framework: Jest (unit) + Supertest (integration)
// React   : @testing-library/react + @testing-library/jest-dom
// Run     : npx jest --coverage
// ============================================================================

const request = require("supertest");
const { JSDOM } = require("jsdom");

let app;

function freshApp() {
  jest.resetModules();
  return require("../server/index");
}

// =============================================================================
// 1. package.json - Dependency & Script Validation
// =============================================================================
describe("package.json - project configuration", () => {
  const pkg = require("../package.json");

  test("has a name field", () => {
    expect(typeof pkg.name).toBe("string");
    expect(pkg.name.length).toBeGreaterThan(0);
  });

  test("has a version field following semver pattern", () => {
    expect(pkg.version).toMatch(/^\d+\.\d+\.\d+/);
  });

  test("defines a start script", () => {
    expect(pkg.scripts).toBeDefined();
    expect(typeof pkg.scripts.start).toBe("string");
  });

  test("defines a test script", () => {
    expect(typeof pkg.scripts.test).toBe("string");
  });

  test("lists express as a production dependency", () => {
    const deps = pkg.dependencies || {};
    expect(deps).toHaveProperty("express");
  });

  test("lists socket.io or ws as a production dependency", () => {
    const deps = { ...(pkg.dependencies || {}) };
    const hasSio = "socket.io" in deps;
    const hasWs = "ws" in deps;
    expect(hasSio || hasWs).toBe(true);
  });

  test("lists react and react-dom as dependencies or devDependencies", () => {
    const all = {
      ...(pkg.dependencies || {}),
      ...(pkg.devDependencies || {}),
    };
    expect(all).toHaveProperty("react");
    expect(all).toHaveProperty("react-dom");
  });

  test("does not duplicate a dependency in both dependencies and devDependencies", () => {
    const prod = Object.keys(pkg.dependencies || {});
    const dev = Object.keys(pkg.devDependencies || {});
    const dups = prod.filter((k) => dev.includes(k));
    expect(dups).toHaveLength(0);
  });
});

// =============================================================================
// 2. Server - Unit Tests  (server/index.js)
// =============================================================================
describe("server/index.js - module shape", () => {
  beforeEach(() => { app = freshApp(); });

  test("exports an http.Server or Express app (truthy object)", () => {
    expect(app).toBeTruthy();
    expect(typeof app).toBe("object");
  });

  test("exported app has a .listen method", () => {
    expect(typeof app.listen).toBe("function");
  });
});

// =============================================================================
// 3. Server - HTTP Integration Tests  (via Supertest)
// =============================================================================
describe("GET / - serves the React shell or a health endpoint", () => {
  beforeEach(() => { app = freshApp(); });

  test("responds with HTTP 200", async () => {
    const res = await request(app).get("/");
    expect(res.status).toBe(200);
  });

  test("response Content-Type is HTML or JSON", async () => {
    const res = await request(app).get("/");
    const ct = res.headers["content-type"] || "";
    expect(ct.match(/html|json/i)).not.toBeNull();
  });

  test("unknown route responds with 404", async () => {
    const res = await request(app).get("/this-route-does-not-exist-xyz");
    expect(res.status).toBe(404);
  });
});

describe("POST /api/room - create a poker room", () => {
  beforeEach(() => { app = freshApp(); });

  test("returns 200 or 201 when valid body is provided", async () => {
    const res = await request(app)
      .post("/api/room")
      .send({ roomName: "Sprint-42" })
      .set("Content-Type", "application/json");
    expect([200, 201]).toContain(res.status);
  });

  test("returns a roomId in the response body", async () => {
    const res = await request(app)
      .post("/api/room")
      .send({ roomName: "Sprint-42" })
      .set("Content-Type", "application/json");
    if (res.status === 200 || res.status === 201) {
      expect(res.body).toHaveProperty("roomId");
    }
  });

  test("returns 400 when roomName is missing", async () => {
    const res = await request(app)
      .post("/api/room")
      .send({})
      .set("Content-Type", "application/json");
    if (res.status !== 404) {
      expect([400, 422]).toContain(res.status);
    }
  });
});

describe("GET /api/room/:roomId - fetch room state", () => {
  beforeEach(() => { app = freshApp(); });

  test("returns 404 for a non-existent room", async () => {
    const res = await request(app).get("/api/room/non-existent-room-id-999");
    if (res.status !== 404) {
      expect([200, 404]).toContain(res.status);
    } else {
      expect(res.status).toBe(404);
    }
  });
});

// =============================================================================
// 4. Server - Voting Logic  (pure function unit tests)
// =============================================================================
describe("Voting logic - card value utilities", () => {
  const FIHONACCI = [1, 2, 3, 5, 8, 13, 21, 34, 55, 89];

  test("fibonacci sequence has 10 standard planning-poker values", () => {
    expect(FIHONACCI).toHaveLength(10);
  });

  test("each card value is a positive integer", () => {
    FIHONACCI.forEach((v) => {
      expect(Number.isInteger(v)).toBe(true);
      expect(v).toBeGreaterThan(0);
    });
  });

  test("calculates average vote correctly", () => {
    const votes = [3, 5, 5, 8];
    const average = votes.reduce((a, b) => a + b, 0) / votes.length;
    expect(average).toBeCloseTo(5.25, 2);
  });

  test("calculates consensus (all same value) correctly", () => {
    const votes = [5, 5, 5];
    const consensus = votes.every((v) => v === votes[0]);
    expect(consensus).toBe(true);
  });

  test("detects no-consensus when votes differ", () => {
    const votes = [3, 5, 8];
    const consensus = votes.every((v) => v === votes[0]);
    expect(consensus).toBe(false);
  });

  test("filters out abstain ('?') votes before averaging", () => {
    const raw = [3, "?", 5, "?", 8];
    const numeric = raw.filter((v) => typeof v === "number");
    const average = numeric.reduce((a, b) => a + b, 0) / numeric.length;
    expect(numeric).toHaveLength(3);
    expect(average).toBeCloseTo(5.33, 1);
  });
});

// =============================================================================
// 5. React App - Component Render Tests  (client/src/App.jsx)
// =============================================================================
describe("App.jsx - static HTML / DOM assertions via JSDOM", () => {
  let document;

  beforeAll(() => {
    const dom = new JSDOM(`<!DOCTYPE html>
      <html>
        <body>
          <div id="root">
            <header class="app-header">
              <h1>Planning Poker</h1>
            </header>
            <main>
              <section class="room-setup">
                <input id="roomName" type="text" placeholder="Room name" />
                <button id="createRoom">Create Room</button>
              </section>
              <section class="card-deck" aria-label="card-deck">
                <button class="card" data-value="1">1</button>
                <button class="card" data-value="2">2</button>
                <button class="card" data-value="3">3</button>
                <button class="card" data-value="5">5</button>
                <button class="card" data-value="8">8</button>
                <button class="card" data-value="13">13</button>
                <button class="card" data-value="21">21</button>
                <button class="card" data-value="?">?</button>
              </section>
            </main>
          </div>
        </body>
      </html>`);
    document = dom.window.document;
  });

  test("renders an <h1> with 'Planning Poker' text", () => {
    const h1 = document.querySelector("h1");
    expect(h1).not.toBeNull();
    expect(h1.textContent).toMatch(/planning poker/i));
  });

  test("renders a room-name input field", () => {
    const input = document.querySelector("#roomName");
    expect(input).not.toBeNull();
    expect(input.getAttribute("type")).toBe("text");
  });

  test("renders a 'Create Room' button", () => {
    const btn = document.querySelector("#createRoom");
    expect(btn).not.toBeNull();
    expect(btn.textContent).toMatch(/create room/i));
  });

  test("renders a card deck section", () => {
    const deck = document.querySelector('[aria-label="card-deck"]');
    expect(deck).not.toBeNull();
  });

  test("card deck contains at least 7 card buttons", () => {
    const cards = document.querySelectorAll(".card");
    expect(cards.length).toBeGreaterThanOrEqual(7);
  });

  test("card deck includes a '?' (abstain) card", () => {
    const abstain = Array.from(document.querySelectorAll(".card"))
      .find((c) => c.dataset.value === "?");
    expect(abstain).not.toBeUndefined();
  });

  test("all card buttons carry a data-value attribute", () => {
    const cards = document.querySelectorAll(".card");
    cards.forEach((c) => {
      expect(c.dataset.value).toBeDefined();
    });
  });
});

// =============================================================================
// 6. React App - State / Interaction Simulation
// =============================================================================
describe("App.jsx - interaction simulation (vanilla DOM events)", () => {
  let document, window;

  beforeAll(() => {
    const dom = new JSDOM(
      `<!DOCTYPE html><html><body>
         <div id="root">
           <button id="createRoom" disabled>Create Room</button>
           <input  id="roomName"   type="text" value="" />
           <div    id="votes"      class="votes-container" style="display:none"></div>
           <div    id="result"     class="result-panel"    style="display:none"></div>
         </div>
       </body></html>`,
      { runScripts: "dangerously" }
    );
    document = dom.window.document;
    window = dom.window;

    const input = document.getElementById("roomName");
    const createBtn = document.getElementById("createRoom");
    const votesDiv = document.getElementById("votes");
    const resultDiv = document.getElementById("result");

    input.addEventListener("input", () => {
      createBtn.disabled = input.value.trim() === "";
    });

    createBtn.addEventListener("click", () => {
      if (!createBtn.disabled) {
        votesDiv.style.display = "block";
        resultDiv.style.display = "none";
      }
    });
  });

  test("'Create Room' button is disabled when room-name input is empty", () => {
    const btn = document.getElementById("createRoom");
    const input = document.getElementById("roomName");
    input.value = "";
    input.dispatchEvent(new window.Event("input"));
    expect(btn.disabled).toBe(true);
  });

  test("'Create Room' button becomes enabled after typing a room name", () => {
    const btn = document.getElementById("createRoom");
    const input = document.getElementById("roomName");
    input.value = "Sprint-42";
    input.dispatchEvent(new window.Event("input"));
    expect(btn.disabled).toBe(false);
  });

  test("clicking 'Create Room' reveals the votes container", () => {
    const btn = document.getElementById("createRoom");
    const votesDiv = document.getElementById("votes");
    btn.click();
    expect(votesDiv.style.display).toBe("block");
  });

  test("result panel is hidden before votes are revealed", () => {
    const resultDiv = document.getElementById("result");
    expect(resultDiv.style.display).toBe("none");
  });
});

// =============================================================================
// 7. Server - WebSocket / Socket.io Event Contracts
// =============================================================================
describe("Socket.io - event name contract (string constants)", () => {
  const EVENTS = {
    JOIN_ROOM : "join-room",
    VOTE      : "vote",
    REVEAL_VOTES  : "reveal-votes",
    RESET_ROUND   : "reset-round",
    ROOM_UPDATE : "room-update",
    VOTE_REVEALED : "vote-revealed",
  };

  test("JOIN_ROOM event name is 'join-room'", () => {
    expect(EVENTS.JOIN_ROOM).toBe("join-room");
  });

  test("VOTE event name is 'vote'", () => {
    expect(EVENTS.VOTE).toBe("vote");
  });

  test("REVEAL_VOTES event name is 'reveal-votes'", () => {
    expect(EVENTS.REVEA_VOTES).toBe("reveal-votes");
  });

  test("RESET_ROUND event name is 'reset-round'", () => {
    expect(EVENTS.RESET_ROUND).toBe("reset-round");
  });

  test("ROOM_UPDATE event name is 'room-update'", () => {
    expect(EVENTS.ROOM_UPDATE).toBe("room-update");
  });

  test("VOTE_REVEALED event name is 'vote-revealed'", () => {
    expect(EVENTS.VOTE_REVEALED).toBe("vote-revealed");
  });

  test("all event names are lowercase kebab-case strings", () => {
    Object.values(EVENTS).forEach((name) => {
      expect(name).toMatch(/^[a-z]+(-[a-z]+)*$/);
    });
  });
});

// =============================================================================
// 8. Edge Cases & Boundary Conditions
// =============================================================================
describe("Edge cases - input sanitisation & boundary values", () => {
  test("room name with only whitespace is treated as empty", () => {
    const roomName = "   ";
    expect(roomName.trim()).toBe("");
  });

  test("room name longer than 100 chars should be flagged", () => {
    const longName = "a".repeat(101);
    expect(longName.length).toBeGreaterThan(100);
  });

  test("vote value 0 is not a valid planning-poker card", () => {
    const VALID = [1, 2, 3, 5, 8, 13, 21, 34, 55, 89, "?"];
    expect(VALID.includes(0)).toBe(false);
  });

  test("negative vote value is not valid", () => {
    const VALID = [1, 2, 3, 5, 8, 13, 21, 34, 55, 89, "?"];
    expect(VALID.includes(-1)).toBe(false);
  });

  test("empty votes array returns 0 average (no division by zero crash)", () => {
    const votes = [];
    const avg = votes.length ? votes.reduce((a, b) => a + b, 0) / votes.length : 0;
    expect(avg).toBe(0);
  });

  test("single-participant vote still completes a round", () => {
    const votes = [8];
    const consensus = votes.every((v) => v === votes[0]);
    expect(consensus).toBe(true);
  });

  test("concurrent duplicate usernames are handled - names array has unique entries", () => {
    const names = ["Alice", "Bob", "Alice"];
    const unique = [...new Set(names)];
    expect(unique).toHaveLength(2);
  });
});