import { useState, useEffect } from "react";
import { db, auth } from "./firebase";
import { ref, set, onValue, remove, update, push } from "firebase/database";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile
} from "firebase/auth";

const CARDS = ["1", "2", "3", "5", "8", "13", "21", "Huge"];
const CARD_COLORS = {
  "1": "#4ECDC4", "2": "#45B7D1", "3": "#96CEB4",
  "5": "#FFEAA7", "8": "#DDA0DD", "13": "#F0A500",
  "21": "#FF6B6B", "Huge": "#2D3436"
};

const generateCode = () => Math.random().toString(36).substring(2, 8).toUpperCase();

// ── Styles ────────────────────────────────────────────────────────
const s = {
  page: { minHeight: "100vh", background: "#0f0f1a", display: "flex", alignItems: "flex-start", justifyContent: "center", fontFamily: "'Georgia', serif", padding: "30px 16px" },
  card: { background: "#1a1a2e", borderRadius: 20, padding: "40px 36px", width: "100%", maxWidth: 440, textAlign: "center", boxShadow: "0 20px 60px rgba(0,0,0,0.5)", marginTop: 40 },
  title: { color: "#fff", fontSize: 28, margin: "0 0 4px", fontWeight: 800, letterSpacing: 1 },
  sub: { color: "#444", fontSize: 13, marginBottom: 28 },
  field: { textAlign: "left", marginBottom: 16 },
  label: { color: "#555", fontSize: 11, display: "block", marginBottom: 6, letterSpacing: 1 },
  input: { width: "100%", padding: "11px 14px", background: "#0f0f1a", border: "1px solid #2a2a3e", borderRadius: 9, color: "#fff", fontSize: 14, outline: "none", boxSizing: "border-box" },
  btn: { background: "#F0A500", color: "#1a1a2e", border: "none", borderRadius: 50, padding: "13px 32px", fontSize: 15, fontWeight: 700, cursor: "pointer", width: "100%", transition: "opacity 0.2s", marginTop: 4 },
  btnOutline: { background: "transparent", color: "#F0A500", border: "1px solid #F0A500", borderRadius: 50, padding: "11px 32px", fontSize: 14, fontWeight: 600, cursor: "pointer", width: "100%", marginTop: 8 },
  btnGhost: { background: "transparent", color: "#555", border: "1px solid #2a2a3e", borderRadius: 50, padding: "10px 24px", fontSize: 13, cursor: "pointer", width: "100%", marginTop: 8 },
  btnSmall: { background: "#F0A500", color: "#1a1a2e", border: "none", borderRadius: 8, padding: "8px 16px", fontSize: 13, fontWeight: 700, cursor: "pointer" },
  header: { display: "flex", alignItems: "center", justifyContent: "space-between", background: "#1a1a2e", borderRadius: 12, padding: "11px 18px", marginBottom: 20, gap: 12, flexWrap: "wrap" },
  badge: { background: "#0f0f1a", color: "#F0A500", padding: "5px 13px", borderRadius: 20, fontSize: 12, fontWeight: 600, whiteSpace: "nowrap" },
  error: { color: "#EF476F", fontSize: 12, marginTop: 8, textAlign: "left" },
  teamCard: { background: "#0f0f1a", borderRadius: 12, padding: "16px 18px", marginBottom: 10, display: "flex", alignItems: "center", justifyContent: "space-between", border: "1px solid #1e1e30", transition: "background 0.2s" },
  codeBox: { background: "#0f0f1a", border: "2px dashed #F0A500", borderRadius: 12, padding: "16px", textAlign: "center", marginBottom: 16 },
};

export default function App() {
  // Auth
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  // View
  const [view, setView] = useState("role"); // role | howTo | smMode | smAuth | smDashboard | smSession | devJoin | devSession | obsJoin | obsSession

  // SM auth
  const [authMode, setAuthMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [authError, setAuthError] = useState("");

  // Guest SM
  const [guestName, setGuestName] = useState("");

  // SM data
  const [myTeams, setMyTeams] = useState({});
  const [newTeamName, setNewTeamName] = useState("");
  const [selectedTeam, setSelectedTeam] = useState(null);
  const [newMember, setNewMember] = useState("");
  const [session, setSession] = useState({});
  const [editingStory, setEditingStory] = useState(false);
  const [storyDraft, setStoryDraft] = useState("");
  const [copiedCode, setCopiedCode] = useState(false);

  // Dev
  const [devCode, setDevCode] = useState("");
  const [devCodeError, setDevCodeError] = useState("");
  const [devTeamData, setDevTeamData] = useState(null);
  const [devName, setDevName] = useState("");
  const [selectedCard, setSelectedCard] = useState(null);
  const [submitted, setSubmitted] = useState(false);

  // Observer
  const [obsCode, setObsCode] = useState("");
  const [obsCodeError, setObsCodeError] = useState("");
  const [obsTeamData, setObsTeamData] = useState(null);

  // ── Auth listener ─────────────────────────────────────────────
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setAuthLoading(false);
      if (u) setView("smDashboard");
    });
    return () => unsub();
  }, []);

  // ── Load SM teams (both account and guest) ───────────────────
  useEffect(() => {
    if (view !== "smDashboard" && view !== "smSession") return;
    const smId = user ? user.uid : `guest_${guestName.trim().replace(/\s/g, "_")}`;
    if (!smId) return;
    const unsub = onValue(ref(db, `teams/${smId}`), (snap) => {
      setMyTeams(snap.val() || {});
    });
    return () => unsub();
  }, [view, user, guestName]);

  // ── Load session ──────────────────────────────────────────────
  useEffect(() => {
    if (!selectedTeam) return;
    const unsub = onValue(ref(db, `sessions/${selectedTeam.id}`), (snap) => {
      const data = snap.val() || {};
      setSession(prev => {
        if (prev.revealed === true && data.revealed === false) {
          setSelectedCard(null);
          setSubmitted(false);
        }
        return data;
      });
    });
    return () => unsub();
  }, [selectedTeam]);

  // ── Dev: listen to team session by code ───────────────────────
  useEffect(() => {
    if (view !== "devSession" || !devTeamData) return;
    const unsub = onValue(ref(db, `sessions/${devTeamData.teamId}`), (snap) => {
      const data = snap.val() || {};
      setSession(prev => {
        if (prev.revealed === true && data.revealed === false) {
          setSelectedCard(null);
          setSubmitted(false);
        }
        return data;
      });
    });
    return () => unsub();
  }, [view, devTeamData]);

  // ── SM Auth ───────────────────────────────────────────────────
  const handleAuth = async () => {
    setAuthError("");
    try {
      if (authMode === "register") {
        if (!displayName.trim()) { setAuthError("Please enter your name."); return; }
        const cred = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(cred.user, { displayName: displayName.trim() });
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (e) {
      const msgs = {
        "auth/email-already-in-use": "This email is already registered.",
        "auth/invalid-email": "Invalid email address.",
        "auth/weak-password": "Password must be at least 6 characters.",
        "auth/invalid-credential": "Wrong email or password.",
      };
      setAuthError(msgs[e.code] || e.message);
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    setView("role");
    setSelectedTeam(null);
    setMyTeams({});
    setSession({});
  };

  // ── Guest SM ──────────────────────────────────────────────────
  const handleGuestContinue = () => {
    if (!guestName.trim()) return;
    setView("smDashboard");
  };

  // ── SM: Team management ───────────────────────────────────────
  const getSmId = () => user ? user.uid : `guest_${guestName.trim().replace(/\s/g, "_")}`;
  const getSmLabel = () => user ? (user.displayName || user.email) : guestName;

  const handleCreateTeam = async () => {
    if (!newTeamName.trim()) return;
    const smId = getSmId();
    const code = generateCode();
    const newRef = push(ref(db, `teams/${smId}`));
    await set(newRef, { name: newTeamName.trim(), members: {}, code });
    // Also index by code for quick lookup
    await set(ref(db, `codes/${code}`), { teamId: newRef.key, smId });
    setNewTeamName("");
  };

  const handleDeleteTeam = async (teamId, code) => {
    const smId = getSmId();
    await remove(ref(db, `teams/${smId}/${teamId}`));
    await remove(ref(db, `sessions/${teamId}`));
    if (code) await remove(ref(db, `codes/${code}`));
  };

  const handleSelectTeam = (teamId, teamData) => {
    setSelectedTeam({ id: teamId, ...teamData });
    setView("smSession");
    onValue(ref(db, `sessions/${teamId}/revealed`), (snap) => {
      if (snap.val() === null) {
        set(ref(db, `sessions/${teamId}/revealed`), false);
        set(ref(db, `sessions/${teamId}/story`), "User story to estimate...");
      }
    }, { onlyOnce: true });
  };

  const handleAddMember = async () => {
    if (!newMember.trim() || !selectedTeam) return;
    const smId = getSmId();
    await set(ref(db, `teams/${smId}/${selectedTeam.id}/members/${newMember.trim()}`), true);
    setNewMember("");
  };

  const handleRemoveMember = async (memberName) => {
    const smId = getSmId();
    await remove(ref(db, `teams/${smId}/${selectedTeam.id}/members/${memberName}`));
    await remove(ref(db, `sessions/${selectedTeam.id}/votes/${memberName}`));
  };

  const handleReveal = () => update(ref(db, `sessions/${selectedTeam.id}`), { revealed: true });
  const handleReset = async () => {
    await set(ref(db, `sessions/${selectedTeam.id}/votes`), null);
    await set(ref(db, `sessions/${selectedTeam.id}/revealed`), false);
  };
  const handleStoryChange = (s) => update(ref(db, `sessions/${selectedTeam.id}`), { story: s });

  const copyCode = (code) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  // ── Dev: lookup team by code ───────────────────────────────────
  const handleDevLookup = async () => {
    const code = devCode.trim().toUpperCase();
    if (!code) return;
    setDevCodeError("");

    onValue(ref(db, `codes/${code}`), (snap) => {
      const data = snap.val();
      if (!data) {
        setDevCodeError("❌ Team not found. Check the code and try again.");
        return;
      }
      // Load team data
      onValue(ref(db, `teams/${data.smId}/${data.teamId}`), (teamSnap) => {
        const team = teamSnap.val();
        if (!team) {
          setDevCodeError("❌ Team not found.");
          return;
        }
        setDevTeamData({ teamId: data.teamId, smId: data.smId, ...team });
      }, { onlyOnce: true });
    }, { onlyOnce: true });
  };

  const handleDevJoin = () => {
    if (!devName || !devTeamData) return;
    // Init session if needed
    onValue(ref(db, `sessions/${devTeamData.teamId}/revealed`), (snap) => {
      if (snap.val() === null) {
        set(ref(db, `sessions/${devTeamData.teamId}/revealed`), false);
        set(ref(db, `sessions/${devTeamData.teamId}/story`), "User story to estimate...");
      }
    }, { onlyOnce: true });
    setView("devSession");
  };

  const handleSubmitVote = async () => {
    if (!selectedCard || !devTeamData) return;
    await set(ref(db, `sessions/${devTeamData.teamId}/votes/${devName}`), selectedCard);
    setSubmitted(true);
  };

  // ── Observer: listen to session by code ─────────────────────
  useEffect(() => {
    if (view !== "obsSession" || !obsTeamData) return;
    const unsub = onValue(ref(db, `sessions/${obsTeamData.teamId}`), (snap) => {
      setSession(snap.val() || {});
    });
    return () => unsub();
  }, [view, obsTeamData]);

  // ── Observer: lookup team by code ────────────────────────────
  const handleObsLookup = () => {
    const code = obsCode.trim().toUpperCase();
    if (!code) return;
    setObsCodeError("");
    onValue(ref(db, `codes/${code}`), (snap) => {
      const data = snap.val();
      if (!data) { setObsCodeError("❌ Team not found. Check the code."); return; }
      onValue(ref(db, `teams/${data.smId}/${data.teamId}`), (teamSnap) => {
        const team = teamSnap.val();
        if (!team) { setObsCodeError("❌ Team not found."); return; }
        setObsTeamData({ teamId: data.teamId, smId: data.smId, ...team });
      }, { onlyOnce: true });
    }, { onlyOnce: true });
  };

  // ── Derived session data ───────────────────────────────────────
  const smId = getSmId();
  const liveTeamData = user
    ? myTeams[selectedTeam?.id]
    : selectedTeam;
  const liveMembers = liveTeamData?.members ? Object.keys(liveTeamData.members) : [];
  const devMembers = devTeamData?.members ? Object.keys(devTeamData.members) : [];

  const votes = session.votes || {};
  const revealed = session.revealed || false;
  const story = session.story || "";
  const voteValues = Object.values(votes);
  const numericVotes = voteValues.filter(v => v !== "Huge").map(Number);
  const tally = voteValues.reduce((acc, v) => { acc[v] = (acc[v] || 0) + 1; return acc; }, {});
  const mostVoted = Object.entries(tally).sort((a, b) => b[1] - a[1])[0]?.[0];
  const highest = numericVotes.length ? Math.max(...numericVotes) : null;
  const lowest = numericVotes.length ? Math.min(...numericVotes) : null;
  const highestVoter = Object.entries(votes).find(([, v]) => v === String(highest))?.[0];
  const lowestVoter = Object.entries(votes).find(([, v]) => v === String(lowest))?.[0];
  const activeMembers = view === "devSession" ? devMembers : liveMembers;
  const votedCount = Object.keys(votes).length;

  if (authLoading) return (
    <div style={{ ...s.page, alignItems: "center" }}>
      <p style={{ color: "#F0A500", fontSize: 18 }}>🃏 Loading...</p>
    </div>
  );

  // ══════════════════════════════════════════════════════════════
  // HOW TO USE
  // ══════════════════════════════════════════════════════════════
  if (view === "howTo") return (
    <div style={s.page}>
      <div style={{ ...s.card, maxWidth: 560, textAlign: "left" }}>
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div style={{ fontSize: 40 }}>📖</div>
          <h1 style={{ ...s.title, fontSize: 22 }}>How to Use Planning Poker</h1>
        </div>

        {/* SM Section */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <span style={{ fontSize: 20 }}>🎯</span>
            <h2 style={{ color: "#F0A500", fontSize: 15, margin: 0, fontWeight: 700 }}>Scrum Master</h2>
          </div>
          {[
            { icon: "1️⃣", text: "Choose Guest (quick, no account) or Account (permanent teams)." },
            { icon: "2️⃣", text: "Create a team and add your developers by name." },
            { icon: "3️⃣", text: "Each team gets a 6-digit code like ABC123. Share this code with your team." },
            { icon: "4️⃣", text: "Click on a team to open the session. Write the story to estimate and wait for votes." },
            { icon: "5️⃣", text: "When everyone has voted, click Reveal Votes to see results." },
            { icon: "6️⃣", text: "Click New Round to reset and start the next story." },
          ].map(({ icon, text }) => (
            <div key={icon} style={{ display: "flex", gap: 12, marginBottom: 10, alignItems: "flex-start" }}>
              <span style={{ fontSize: 16, flexShrink: 0 }}>{icon}</span>
              <p style={{ color: "#aaa", fontSize: 13, margin: 0, lineHeight: 1.6 }}>{text}</p>
            </div>
          ))}
        </div>

        <div style={{ height: 1, background: "#1e1e30", marginBottom: 24 }} />

        {/* Dev Section */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <span style={{ fontSize: 20 }}>👨‍💻</span>
            <h2 style={{ color: "#45B7D1", fontSize: 15, margin: 0, fontWeight: 700 }}>Developer</h2>
          </div>
          {[
            { icon: "1️⃣", text: "Get the 6-digit team code from your Scrum Master." },
            { icon: "2️⃣", text: "Click Developer on the home screen, enter the code and hit Find." },
            { icon: "3️⃣", text: "Select your name from the list and join the session." },
            { icon: "4️⃣", text: "Pick a card to estimate the story. Your vote is hidden until SM reveals." },
            { icon: "5️⃣", text: "After reveal, wait for SM to start the next round." },
          ].map(({ icon, text }) => (
            <div key={icon} style={{ display: "flex", gap: 12, marginBottom: 10, alignItems: "flex-start" }}>
              <span style={{ fontSize: 16, flexShrink: 0 }}>{icon}</span>
              <p style={{ color: "#aaa", fontSize: 13, margin: 0, lineHeight: 1.6 }}>{text}</p>
            </div>
          ))}
        </div>

        <div style={{ height: 1, background: "#1e1e30", marginBottom: 20 }} />

        {/* Cards info */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <span style={{ fontSize: 20 }}>🃏</span>
            <h2 style={{ color: "#96CEB4", fontSize: 15, margin: 0, fontWeight: 700 }}>Story Points</h2>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {["1","2","3","5","8","13","21","Huge"].map(c => (
              <span key={c} style={{ background: CARD_COLORS[c], color: "#1a1a2e", borderRadius: 6, padding: "4px 10px", fontSize: 13, fontWeight: 700 }}>{c}</span>
            ))}
          </div>
          <p style={{ color: "#555", fontSize: 12, marginTop: 10, lineHeight: 1.6 }}>
            Use Fibonacci numbers to estimate complexity. "Huge" means the story is too large and should be broken down.
          </p>
        </div>

        <button style={s.btn} onClick={() => setView("role")}>← Back to Home</button>
      </div>
    </div>
  );

  // ══════════════════════════════════════════════════════════════
  // ROLE SELECTION
  // ══════════════════════════════════════════════════════════════
  if (view === "role") return (
    <div style={s.page}>
      <div style={s.card}>
        <div style={{ fontSize: 48, marginBottom: 8 }}>🃏</div>
        <h1 style={s.title}>Planning Poker</h1>
        <p style={s.sub}>Sprint estimation for agile teams</p>
        <button style={s.btn} onClick={() => setView("smMode")}>🎯 Scrum Master</button>
        <button style={{ ...s.btn, marginTop: 12, background: "#45B7D1" }} onClick={() => setView("devJoin")}>👨‍💻 Developer</button>
        <button style={{ ...s.btn, marginTop: 12, background: "#96CEB4", color: "#1a1a2e" }} onClick={() => setView("obsJoin")}>👁️ Observer</button>
        <button style={{ ...s.btnGhost, marginTop: 8, borderColor: "#1e1e30", color: "#333" }} onClick={() => setView("howTo")}>❓ How does this work?</button>
        <p style={{ color: "#2a2a3e", fontSize: 11, marginTop: 20 }}>Built by <span style={{ color: "#F0A500" }}>Hakan</span></p>
      </div>
    </div>
  );

  // ══════════════════════════════════════════════════════════════
  // SM MODE SELECTION (Guest vs Account)
  // ══════════════════════════════════════════════════════════════
  if (view === "smMode") return (
    <div style={s.page}>
      <div style={s.card}>
        <div style={{ fontSize: 36, marginBottom: 8 }}>🎯</div>
        <h1 style={s.title}>Scrum Master</h1>
        <p style={s.sub}>How would you like to continue?</p>

        {/* Guest */}
        <div style={{ background: "#0f0f1a", borderRadius: 14, padding: "20px", marginBottom: 12, textAlign: "left" }}>
          <p style={{ color: "#fff", fontWeight: 700, margin: "0 0 4px", fontSize: 15 }}>👤 Guest — No account</p>
          <p style={{ color: "#555", fontSize: 12, margin: "0 0 14px" }}>Quick access. Teams are lost when you close the browser.</p>
          <input style={s.input} placeholder="Your name" value={guestName} onChange={e => setGuestName(e.target.value)} onKeyDown={e => e.key === "Enter" && handleGuestContinue()} />
          <button style={{ ...s.btn, marginTop: 10, opacity: guestName.trim() ? 1 : 0.4 }} onClick={handleGuestContinue} disabled={!guestName.trim()}>
            Continue as Guest →
          </button>
        </div>

        {/* Account */}
        <div style={{ background: "#0f0f1a", borderRadius: 14, padding: "20px", textAlign: "left" }}>
          <p style={{ color: "#fff", fontWeight: 700, margin: "0 0 4px", fontSize: 15 }}>🔐 Account — With password</p>
          <p style={{ color: "#555", fontSize: 12, margin: "0 0 14px" }}>Teams are saved permanently. Sign in anytime.</p>
          <button style={s.btn} onClick={() => setView("smAuth")}>Sign In / Register →</button>
        </div>

        <button style={s.btnGhost} onClick={() => setView("role")}>← Back</button>
      </div>
    </div>
  );

  // ══════════════════════════════════════════════════════════════
  // SM AUTH
  // ══════════════════════════════════════════════════════════════
  if (view === "smAuth") return (
    <div style={s.page}>
      <div style={s.card}>
        <div style={{ fontSize: 36, marginBottom: 8 }}>🔐</div>
        <h1 style={s.title}>Account</h1>
        <p style={s.sub}>{authMode === "login" ? "Sign in to your account" : "Create your account"}</p>

        <div style={{ display: "flex", background: "#0f0f1a", borderRadius: 10, padding: 3, marginBottom: 20 }}>
          {["login", "register"].map(m => (
            <button key={m} onClick={() => { setAuthMode(m); setAuthError(""); }} style={{
              flex: 1, padding: "9px 0", borderRadius: 8, border: "none",
              background: authMode === m ? "#F0A500" : "transparent",
              color: authMode === m ? "#1a1a2e" : "#555",
              fontWeight: authMode === m ? 700 : 400, cursor: "pointer", fontSize: 13,
            }}>
              {m === "login" ? "Sign In" : "Register"}
            </button>
          ))}
        </div>

        {authMode === "register" && (
          <div style={s.field}>
            <label style={s.label}>YOUR NAME</label>
            <input style={s.input} placeholder="e.g. Hakan" value={displayName} onChange={e => setDisplayName(e.target.value)} />
          </div>
        )}
        <div style={s.field}>
          <label style={s.label}>EMAIL</label>
          <input style={s.input} type="email" placeholder="you@company.com" value={email} onChange={e => setEmail(e.target.value)} onKeyDown={e => e.key === "Enter" && handleAuth()} />
        </div>
        <div style={s.field}>
          <label style={s.label}>PASSWORD</label>
          <input style={s.input} type="password" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key === "Enter" && handleAuth()} />
        </div>
        {authError && <p style={s.error}>❌ {authError}</p>}
        <button style={s.btn} onClick={handleAuth}>{authMode === "login" ? "Sign In →" : "Create Account →"}</button>
        <button style={s.btnGhost} onClick={() => setView("smMode")}>← Back</button>
      </div>
    </div>
  );

  // ══════════════════════════════════════════════════════════════
  // SM DASHBOARD
  // ══════════════════════════════════════════════════════════════
  if (view === "smDashboard") {
    const teamsToShow = user ? myTeams : Object.fromEntries(
      Object.entries(myTeams)
    );

    return (
      <div style={s.page}>
        <div style={{ width: "100%", maxWidth: 600 }}>
          <div style={s.header}>
            <span style={s.badge}>🎯 {getSmLabel()}</span>
            <span style={{ color: "#F0A500", fontSize: 20, fontWeight: 700 }}>My Teams</span>
            {user ? (
              <button onClick={handleLogout} style={{ background: "transparent", border: "1px solid #2a2a3e", color: "#555", borderRadius: 20, padding: "5px 14px", cursor: "pointer", fontSize: 12 }}>Sign Out</button>
            ) : (
              <button onClick={() => { setView("smMode"); }} style={{ background: "transparent", border: "1px solid #2a2a3e", color: "#555", borderRadius: 20, padding: "5px 14px", cursor: "pointer", fontSize: 12 }}>Exit</button>
            )}
          </div>

          <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
            <input style={{ ...s.input, flex: 1 }} placeholder="New team name..." value={newTeamName}
              onChange={e => setNewTeamName(e.target.value)} onKeyDown={e => e.key === "Enter" && handleCreateTeam()} />
            <button onClick={handleCreateTeam} style={{ ...s.btnSmall, fontSize: 20, padding: "8px 18px" }}>+</button>
          </div>

          {Object.keys(teamsToShow).length === 0 ? (
            <div style={{ textAlign: "center", padding: "40px 20px", color: "#333" }}>
              <p style={{ fontSize: 32 }}>🏗️</p>
              <p>No teams yet. Create your first team above!</p>
            </div>
          ) : (
            Object.entries(teamsToShow).map(([teamId, team]) => (
              <div key={teamId} style={s.teamCard}>
                <div style={{ flex: 1, cursor: "pointer" }} onClick={() => handleSelectTeam(teamId, team)}>
                  <p style={{ color: "#fff", fontWeight: 700, margin: 0, fontSize: 15 }}>{team.name}</p>
                  <p style={{ color: "#555", fontSize: 12, margin: "3px 0 0" }}>
                    {Object.keys(team.members || {}).length} member{Object.keys(team.members || {}).length !== 1 ? "s" : ""}
                  </p>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  {/* Team code badge */}
                  <div onClick={() => copyCode(team.code)} style={{
                    background: copiedCode === team.code ? "#06D6A0" : "#0f0f1a",
                    border: "1px dashed #F0A500", borderRadius: 8,
                    padding: "4px 10px", cursor: "pointer", transition: "all 0.2s"
                  }}>
                    <span style={{ color: copiedCode === team.code ? "#1a1a2e" : "#F0A500", fontSize: 13, fontWeight: 700, letterSpacing: 2 }}>
                      {copiedCode === team.code ? "✓ Copied!" : team.code}
                    </span>
                  </div>
                  <span style={{ color: "#F0A500", fontSize: 13, cursor: "pointer" }} onClick={() => handleSelectTeam(teamId, team)}>Open →</span>
                  <button onClick={() => handleDeleteTeam(teamId, team.code)} style={{ background: "transparent", border: "none", color: "#333", cursor: "pointer", fontSize: 18 }}
                    onMouseEnter={e => e.target.style.color = "#EF476F"}
                    onMouseLeave={e => e.target.style.color = "#333"}>✕</button>
                </div>
              </div>
            ))
          )}
          <p style={{ color: "#1e1e30", fontSize: 11, marginTop: 32, textAlign: "center" }}>Built by <span style={{ color: "#2a2a3e" }}>Hakan</span></p>
        </div>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════
  // SM SESSION
  // ══════════════════════════════════════════════════════════════
  if (view === "smSession" && selectedTeam) {
    // Always read from myTeams (Firebase live data) for both guest and account
    const currentMembers = myTeams[selectedTeam.id]?.members
      ? Object.keys(myTeams[selectedTeam.id].members)
      : [];

    return (
      <div style={s.page}>
        <div style={{ width: "100%", maxWidth: 920 }}>
          <div style={s.header}>
            <button onClick={() => setView("smDashboard")} style={{ background: "transparent", border: "none", color: "#F0A500", cursor: "pointer", fontSize: 13 }}>← Teams</button>
            {editingStory ? (
              <input autoFocus style={{ ...s.input, flex: 1, margin: "0 12px", fontSize: 13, padding: "8px 12px" }}
                value={storyDraft} onChange={e => setStoryDraft(e.target.value)}
                onBlur={() => { handleStoryChange(storyDraft); setEditingStory(false); }}
                onKeyDown={e => e.key === "Enter" && (handleStoryChange(storyDraft), setEditingStory(false))}
              />
            ) : (
              <span onClick={() => { setStoryDraft(story); setEditingStory(true); }}
                style={{ color: "#ccc", fontSize: 13, flex: 1, textAlign: "center", cursor: "pointer" }}>
                📋 {story} ✏️
              </span>
            )}
            <span style={s.badge}>{votedCount}/{currentMembers.length} voted</span>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 280px", gap: 20 }}>
            <div>
              {/* Team code */}
              <div style={s.codeBox}>
                <p style={{ color: "#555", fontSize: 11, margin: "0 0 6px", letterSpacing: 1 }}>TEAM CODE — share with developers</p>
                <span style={{ color: "#F0A500", fontSize: 32, fontWeight: 800, letterSpacing: 6 }}>{selectedTeam.code}</span>
                <br />
                <button onClick={() => copyCode(selectedTeam.code)} style={{ ...s.btnSmall, marginTop: 10, background: copiedCode === selectedTeam.code ? "#06D6A0" : "#F0A500" }}>
                  {copiedCode === selectedTeam.code ? "✓ Copied!" : "Copy Code"}
                </button>
              </div>

              {/* Vote cards */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(100px, 1fr))", gap: 14, marginBottom: 20 }}>
                {currentMembers.map(p => (
                  <div key={p} style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                    <div style={{
                      width: 76, height: 106, borderRadius: 12,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 26, fontWeight: 800, border: "2px solid #1e1e30",
                      background: revealed && votes[p] ? CARD_COLORS[votes[p]] || "#555" : "#1a1a2e",
                      color: revealed && votes[p] ? "#1a1a2e" : "#2a2a3e",
                      transition: "all 0.5s ease",
                    }}>
                      {revealed && votes[p] ? votes[p] : "?"}
                    </div>
                    <span style={{ fontSize: 12, color: "#666", marginTop: 6 }}>{p}</span>
                    {votes[p] && !revealed && <span style={{ fontSize: 10, color: "#06D6A0" }}>✓ voted</span>}
                    {!votes[p] && <span style={{ fontSize: 10, color: "#EF476F" }}>waiting...</span>}
                  </div>
                ))}
              </div>

              <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
                {!revealed ? (
                  <button style={{ ...s.btn, background: "#F0A500", color: "#1a1a2e", width: "auto", padding: "13px 36px" }} onClick={handleReveal}>🃏 Reveal Votes</button>
                ) : (
                  <button style={{ ...s.btn, background: "#4ECDC4", color: "#1a1a2e", width: "auto", padding: "13px 36px" }} onClick={handleReset}>🔄 New Round</button>
                )}
              </div>

              {revealed && voteValues.length > 0 && (
                <div style={{ background: "#1a1a2e", borderRadius: 14, padding: 20, marginTop: 20, textAlign: "center" }}>
                  <h3 style={{ color: "#F0A500", marginBottom: 14, fontSize: 14, letterSpacing: 1 }}>RESULTS</h3>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12, marginBottom: 16 }}>
                    {[
                      { val: mostVoted, lbl: "Most Voted" },
                      { val: highest ?? "—", lbl: `Highest (${highestVoter || "—"})` },
                      { val: lowest ?? "—", lbl: `Lowest (${lowestVoter || "—"})` },
                    ].map(({ val, lbl }) => (
                      <div key={lbl} style={{ background: "#0f0f1a", borderRadius: 10, padding: "14px 8px" }}>
                        <div style={{ color: "#F0A500", fontSize: 26, fontWeight: 800 }}>{val}</div>
                        <div style={{ color: "#555", fontSize: 11, marginTop: 4 }}>{lbl}</div>
                      </div>
                    ))}
                  </div>
                  {Object.entries(tally).sort((a, b) => b[1] - a[1]).map(([card, count]) => (
                    <div key={card} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 7 }}>
                      <span style={{ background: CARD_COLORS[card] || "#555", width: 34, textAlign: "center", padding: "2px 5px", borderRadius: 5, fontSize: 12, fontWeight: 700, color: "#1a1a2e" }}>{card}</span>
                      <div style={{ flex: 1, background: "#0f0f1a", borderRadius: 4, height: 18 }}>
                        <div style={{ width: `${(count / currentMembers.length) * 100}%`, height: "100%", borderRadius: 4, background: CARD_COLORS[card] || "#555", transition: "width 0.8s ease" }} />
                      </div>
                      <span style={{ color: "#555", fontSize: 11, width: 50, textAlign: "right" }}>{count} vote{count > 1 ? "s" : ""}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Member management */}
            <div style={{ background: "#1a1a2e", borderRadius: 14, padding: 18, height: "fit-content", position: "sticky", top: 20 }}>
              <h3 style={{ color: "#F0A500", fontSize: 13, letterSpacing: 1, margin: "0 0 14px" }}>👥 TEAM MEMBERS</h3>
              <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
                <input style={{ ...s.input, flex: 1, padding: "9px 12px", fontSize: 13 }} placeholder="Add member..."
                  value={newMember} onChange={e => setNewMember(e.target.value)} onKeyDown={e => e.key === "Enter" && handleAddMember()} />
                <button onClick={handleAddMember} style={{ background: "#F0A500", border: "none", borderRadius: 8, padding: "9px 14px", cursor: "pointer", fontWeight: 700, color: "#1a1a2e", fontSize: 18 }}>+</button>
              </div>
              {currentMembers.length === 0 ? (
                <p style={{ color: "#333", fontSize: 12, textAlign: "center", padding: "12px 0" }}>No members yet.</p>
              ) : currentMembers.map(p => (
                <div key={p} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "#0f0f1a", borderRadius: 8, padding: "8px 12px", marginBottom: 7 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ width: 26, height: 26, borderRadius: "50%", background: votes[p] ? "#F0A500" : "#1e1e30", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: votes[p] ? "#1a1a2e" : "#333" }}>
                      {votes[p] ? "✓" : "?"}
                    </div>
                    <span style={{ color: "#ccc", fontSize: 13 }}>{p}</span>
                  </div>
                  <button onClick={() => handleRemoveMember(p)} style={{ background: "transparent", border: "none", color: "#333", cursor: "pointer", fontSize: 16, padding: "2px 6px" }}
                    onMouseEnter={e => e.target.style.color = "#EF476F"}
                    onMouseLeave={e => e.target.style.color = "#333"}>✕</button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════
  // DEVELOPER JOIN
  // ══════════════════════════════════════════════════════════════
  if (view === "devJoin") return (
    <div style={s.page}>
      <div style={s.card}>
        <div style={{ fontSize: 36, marginBottom: 8 }}>👨‍💻</div>
        <h1 style={s.title}>Developer</h1>
        <p style={s.sub}>Enter your team code to join</p>

        <div style={s.field}>
          <label style={s.label}>TEAM CODE</label>
          <div style={{ display: "flex", gap: 8 }}>
            <input style={{ ...s.input, flex: 1, textTransform: "uppercase", letterSpacing: 3, fontSize: 18, textAlign: "center" }}
              placeholder="ABC123" maxLength={6}
              value={devCode} onChange={e => { setDevCode(e.target.value.toUpperCase()); setDevCodeError(""); setDevTeamData(null); setDevName(""); }}
              onKeyDown={e => e.key === "Enter" && handleDevLookup()}
            />
            <button onClick={handleDevLookup} style={{ ...s.btnSmall, fontSize: 13, padding: "11px 16px" }}>Find</button>
          </div>
          {devCodeError && <p style={s.error}>{devCodeError}</p>}
        </div>

        {devTeamData && (
          <div style={{ background: "#0f0f1a", borderRadius: 10, padding: "14px", marginBottom: 16, textAlign: "left" }}>
            <p style={{ color: "#06D6A0", fontSize: 12, margin: "0 0 4px" }}>✓ Team found!</p>
            <p style={{ color: "#fff", fontWeight: 700, margin: 0 }}>{devTeamData.name}</p>
            <p style={{ color: "#555", fontSize: 12, margin: "2px 0 0" }}>{Object.keys(devTeamData.members || {}).length} members</p>
          </div>
        )}

        {devTeamData && (
          <div style={s.field}>
            <label style={s.label}>SELECT YOUR NAME</label>
            <select style={{ ...s.input, cursor: "pointer" }} value={devName} onChange={e => setDevName(e.target.value)}>
              <option value="">— Choose your name —</option>
              {Object.keys(devTeamData.members || {}).map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
        )}

        <button style={{ ...s.btn, opacity: devTeamData && devName ? 1 : 0.4, marginTop: 8 }}
          onClick={handleDevJoin} disabled={!devTeamData || !devName}>
          Join Session →
        </button>
        <button style={s.btnGhost} onClick={() => setView("role")}>← Back</button>
        <p style={{ color: "#2a2a3e", fontSize: 11, marginTop: 20 }}>Built by <span style={{ color: "#F0A500" }}>Hakan</span></p>
      </div>
    </div>
  );

  // ══════════════════════════════════════════════════════════════
  // DEVELOPER SESSION
  // ══════════════════════════════════════════════════════════════
  if (view === "devSession" && devTeamData) return (
    <div style={s.page}>
      <div style={{ width: "100%", maxWidth: 680 }}>
        <div style={s.header}>
          <span style={s.badge}>👨‍💻 {devName}</span>
          <span style={{ color: "#ccc", fontSize: 13, flex: 1, textAlign: "center" }}>📋 {story}</span>
          <span style={s.badge}>{votedCount}/{devMembers.length} voted</span>
        </div>

        {revealed ? (
          <div style={{ background: "#1a2535", color: "#45B7D1", padding: "13px 20px", borderRadius: 10, textAlign: "center", marginBottom: 24, fontSize: 14 }}>
            🃏 Scrum Master revealed the votes!
          </div>
        ) : !submitted ? (
          <p style={{ color: "#555", textAlign: "center", marginBottom: 24, fontSize: 14 }}>Pick your estimate — others can't see your vote yet</p>
        ) : (
          <div style={{ background: "#1a2e1a", color: "#06D6A0", padding: "13px 20px", borderRadius: 10, textAlign: "center", marginBottom: 24, fontSize: 14 }}>
            ✅ Vote submitted! Waiting for Scrum Master to reveal...
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 24 }}>
          {CARDS.map(card => (
            <button key={card} onClick={() => !submitted && !revealed && setSelectedCard(card)}
              disabled={submitted || revealed}
              style={{
                aspectRatio: "2/3", borderRadius: 12,
                border: `2px solid ${selectedCard === card ? CARD_COLORS[card] : "#1e1e30"}`,
                display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                background: selectedCard === card ? CARD_COLORS[card] : "#1a1a2e",
                color: selectedCard === card ? "#1a1a2e" : "#ccc",
                transform: selectedCard === card ? "translateY(-10px) scale(1.06)" : "translateY(0)",
                boxShadow: selectedCard === card ? `0 10px 28px ${CARD_COLORS[card]}55` : "0 2px 8px rgba(0,0,0,0.4)",
                cursor: submitted || revealed ? "not-allowed" : "pointer",
                opacity: (submitted || revealed) && selectedCard !== card ? 0.35 : 1,
                transition: "all 0.2s ease",
              }}>
              <span style={{ fontSize: card === "Huge" ? 18 : 26, fontWeight: 800 }}>{card}</span>
              <span style={{ fontSize: 9, opacity: 0.5, marginTop: 3 }}>pts</span>
            </button>
          ))}
        </div>

        {!submitted && !revealed && (
          <button style={{ ...s.btn, opacity: selectedCard ? 1 : 0.4 }} onClick={handleSubmitVote} disabled={!selectedCard}>
            Submit Vote 🚀
          </button>
        )}

        <div style={{ display: "flex", gap: 14, justifyContent: "center", flexWrap: "wrap", marginTop: 28 }}>
          {devMembers.map(p => (
            <div key={p} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
              <div style={{
                width: 38, height: 38, borderRadius: "50%",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontWeight: 700, fontSize: 13, transition: "all 0.3s",
                background: votes[p] ? "#F0A500" : "#1e1e30",
                color: votes[p] ? "#1a1a2e" : "#444",
                border: p === devName ? "2px solid #F0A500" : "2px solid transparent",
              }}>
                {revealed && votes[p] ? votes[p] : votes[p] ? "✓" : "?"}
              </div>
              <span style={{ fontSize: 10, color: p === devName ? "#F0A500" : "#555" }}>{p}</span>
            </div>
          ))}
        </div>

        {/* Results for developer */}
        {revealed && voteValues.length > 0 && (
          <div style={{ background: "#1a1a2e", borderRadius: 14, padding: 20, marginTop: 24, textAlign: "center" }}>
            <h3 style={{ color: "#F0A500", marginBottom: 14, fontSize: 14, letterSpacing: 1 }}>📊 RESULTS</h3>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12, marginBottom: 16 }}>
              {[
                { val: mostVoted, lbl: "Most Voted" },
                { val: highest ?? "—", lbl: `Highest` },
                { val: lowest ?? "—", lbl: `Lowest` },
              ].map(({ val, lbl }) => (
                <div key={lbl} style={{ background: "#0f0f1a", borderRadius: 10, padding: "14px 8px" }}>
                  <div style={{ color: "#F0A500", fontSize: 26, fontWeight: 800 }}>{val}</div>
                  <div style={{ color: "#555", fontSize: 11, marginTop: 4 }}>{lbl}</div>
                </div>
              ))}
            </div>
            {Object.entries(tally).sort((a, b) => b[1] - a[1]).map(([card, count]) => (
              <div key={card} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 7 }}>
                <span style={{ background: CARD_COLORS[card] || "#555", width: 34, textAlign: "center", padding: "2px 5px", borderRadius: 5, fontSize: 12, fontWeight: 700, color: "#1a1a2e" }}>{card}</span>
                <div style={{ flex: 1, background: "#0f0f1a", borderRadius: 4, height: 18 }}>
                  <div style={{ width: `${(count / devMembers.length) * 100}%`, height: "100%", borderRadius: 4, background: CARD_COLORS[card] || "#555", transition: "width 0.8s ease" }} />
                </div>
                <span style={{ color: "#555", fontSize: 11, width: 50, textAlign: "right" }}>{count} vote{count > 1 ? "s" : ""}</span>
              </div>
            ))}
          </div>
        )}

        <p style={{ color: "#1a1a2e", fontSize: 11, marginTop: 32, textAlign: "center" }}>
          Built by <span style={{ color: "#2a2a3e" }}>Hakan</span>
        </p>
      </div>
    </div>
  );

  // ══════════════════════════════════════════════════════════════
  // OBSERVER JOIN
  // ══════════════════════════════════════════════════════════════
  if (view === "obsJoin") return (
    <div style={s.page}>
      <div style={s.card}>
        <div style={{ fontSize: 36, marginBottom: 8 }}>👁️</div>
        <h1 style={s.title}>Observer</h1>
        <p style={s.sub}>Watch the session — no voting</p>

        <div style={s.field}>
          <label style={s.label}>TEAM CODE</label>
          <div style={{ display: "flex", gap: 8 }}>
            <input style={{ ...s.input, flex: 1, textTransform: "uppercase", letterSpacing: 3, fontSize: 18, textAlign: "center" }}
              placeholder="ABC123" maxLength={6}
              value={obsCode} onChange={e => { setObsCode(e.target.value.toUpperCase()); setObsCodeError(""); setObsTeamData(null); }}
              onKeyDown={e => e.key === "Enter" && handleObsLookup()}
            />
            <button onClick={handleObsLookup} style={{ ...s.btnSmall, fontSize: 13, padding: "11px 16px" }}>Find</button>
          </div>
          {obsCodeError && <p style={s.error}>{obsCodeError}</p>}
        </div>

        {obsTeamData && (
          <div style={{ background: "#0f0f1a", borderRadius: 10, padding: "14px", marginBottom: 16, textAlign: "left" }}>
            <p style={{ color: "#06D6A0", fontSize: 12, margin: "0 0 4px" }}>✓ Team found!</p>
            <p style={{ color: "#fff", fontWeight: 700, margin: 0 }}>{obsTeamData.name}</p>
            <p style={{ color: "#555", fontSize: 12, margin: "2px 0 0" }}>{Object.keys(obsTeamData.members || {}).length} members</p>
          </div>
        )}

        <button style={{ ...s.btn, background: "#96CEB4", color: "#1a1a2e", opacity: obsTeamData ? 1 : 0.4, marginTop: 8 }}
          onClick={() => obsTeamData && setView("obsSession")} disabled={!obsTeamData}>
          Watch Session →
        </button>
        <button style={s.btnGhost} onClick={() => setView("role")}>← Back</button>
        <p style={{ color: "#2a2a3e", fontSize: 11, marginTop: 20 }}>Built by <span style={{ color: "#F0A500" }}>Hakan</span></p>
      </div>
    </div>
  );

  // ══════════════════════════════════════════════════════════════
  // OBSERVER SESSION
  // ══════════════════════════════════════════════════════════════
  if (view === "obsSession" && obsTeamData) {
    const obsMembers = obsTeamData?.members ? Object.keys(obsTeamData.members) : [];
    return (
      <div style={s.page}>
        <div style={{ width: "100%", maxWidth: 680 }}>
          <div style={s.header}>
            <span style={s.badge}>👁️ Observer</span>
            <span style={{ color: "#ccc", fontSize: 13, flex: 1, textAlign: "center" }}>📋 {story}</span>
            <span style={s.badge}>{votedCount}/{obsMembers.length} voted</span>
          </div>

          {!revealed ? (
            <div style={{ background: "#1a2535", color: "#45B7D1", padding: "13px 20px", borderRadius: 10, textAlign: "center", marginBottom: 24, fontSize: 14 }}>
              ⏳ Waiting for Scrum Master to reveal votes...
            </div>
          ) : (
            <div style={{ background: "#1a2e1a", color: "#06D6A0", padding: "13px 20px", borderRadius: 10, textAlign: "center", marginBottom: 24, fontSize: 14 }}>
              🃏 Votes revealed!
            </div>
          )}

          {/* Vote cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(100px, 1fr))", gap: 14, marginBottom: 20 }}>
            {obsMembers.map(p => (
              <div key={p} style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                <div style={{
                  width: 76, height: 106, borderRadius: 12,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 26, fontWeight: 800, border: "2px solid #1e1e30",
                  background: revealed && votes[p] ? CARD_COLORS[votes[p]] || "#555" : "#1a1a2e",
                  color: revealed && votes[p] ? "#1a1a2e" : "#2a2a3e",
                  transition: "all 0.5s ease",
                }}>
                  {revealed && votes[p] ? votes[p] : "?"}
                </div>
                <span style={{ fontSize: 12, color: "#666", marginTop: 6 }}>{p}</span>
                {votes[p] && !revealed && <span style={{ fontSize: 10, color: "#06D6A0" }}>✓ voted</span>}
                {!votes[p] && <span style={{ fontSize: 10, color: "#EF476F" }}>waiting...</span>}
              </div>
            ))}
          </div>

          {/* Results */}
          {revealed && voteValues.length > 0 && (
            <div style={{ background: "#1a1a2e", borderRadius: 14, padding: 20, marginTop: 8, textAlign: "center" }}>
              <h3 style={{ color: "#F0A500", marginBottom: 14, fontSize: 14, letterSpacing: 1 }}>📊 RESULTS</h3>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12, marginBottom: 16 }}>
                {[
                  { val: mostVoted, lbl: "Most Voted" },
                  { val: highest ?? "—", lbl: `Highest` },
                  { val: lowest ?? "—", lbl: `Lowest` },
                ].map(({ val, lbl }) => (
                  <div key={lbl} style={{ background: "#0f0f1a", borderRadius: 10, padding: "14px 8px" }}>
                    <div style={{ color: "#F0A500", fontSize: 26, fontWeight: 800 }}>{val}</div>
                    <div style={{ color: "#555", fontSize: 11, marginTop: 4 }}>{lbl}</div>
                  </div>
                ))}
              </div>
              {Object.entries(tally).sort((a, b) => b[1] - a[1]).map(([card, count]) => (
                <div key={card} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 7 }}>
                  <span style={{ background: CARD_COLORS[card] || "#555", width: 34, textAlign: "center", padding: "2px 5px", borderRadius: 5, fontSize: 12, fontWeight: 700, color: "#1a1a2e" }}>{card}</span>
                  <div style={{ flex: 1, background: "#0f0f1a", borderRadius: 4, height: 18 }}>
                    <div style={{ width: `${(count / obsMembers.length) * 100}%`, height: "100%", borderRadius: 4, background: CARD_COLORS[card] || "#555", transition: "width 0.8s ease" }} />
                  </div>
                  <span style={{ color: "#555", fontSize: 11, width: 50, textAlign: "right" }}>{count} vote{count > 1 ? "s" : ""}</span>
                </div>
              ))}
            </div>
          )}

          <p style={{ color: "#1a1a2e", fontSize: 11, marginTop: 32, textAlign: "center" }}>
            Built by <span style={{ color: "#2a2a3e" }}>Hakan</span>
          </p>
        </div>
      </div>
    );
  }

  return null;
}
