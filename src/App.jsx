import { useState, useEffect } from "react";
import { db, auth } from "./firebase";
import { ref, set, onValue, remove, update, push } from "firebase/database";
import {
  createUserWithEmailAndPassword, signInWithEmailAndPassword,
  signOut, onAuthStateChanged, updateProfile
} from "firebase/auth";

const CARDS = ["1", "2", "3", "5", "8", "13", "21", "Huge", "?"];
const CARD_COLORS = {
  "1": "#4ECDC4", "2": "#45B7D1", "3": "#96CEB4", "5": "#FFEAA7",
  "8": "#DDA0DD", "13": "#F0A500", "21": "#FF6B6B", "Huge": "#2D3436", "?": "#6C63FF"
};

const generateCode = () => Math.random().toString(36).substring(2, 8).toUpperCase();
const getBaseUrl = () => window.location.origin;

// ── Styles ─────────────────────────────────────────────────────────
const s = {
  page: { minHeight: "100vh", background: "#0f0f1a", display: "flex", alignItems: "flex-start", justifyContent: "center", fontFamily: "'Georgia', serif", padding: "30px 16px" },
  card: { background: "#1a1a2e", borderRadius: 20, padding: "40px 36px", width: "100%", maxWidth: 460, textAlign: "center", boxShadow: "0 20px 60px rgba(0,0,0,0.5)", marginTop: 40 },
  title: { color: "#fff", fontSize: 28, margin: "0 0 4px", fontWeight: 800, letterSpacing: 1 },
  sub: { color: "#444", fontSize: 13, marginBottom: 28 },
  field: { textAlign: "left", marginBottom: 16 },
  label: { color: "#555", fontSize: 11, display: "block", marginBottom: 6, letterSpacing: 1 },
  input: { width: "100%", padding: "11px 14px", background: "#0f0f1a", border: "1px solid #2a2a3e", borderRadius: 9, color: "#fff", fontSize: 14, outline: "none", boxSizing: "border-box" },
  btn: { background: "#F0A500", color: "#1a1a2e", border: "none", borderRadius: 50, padding: "13px 32px", fontSize: 15, fontWeight: 700, cursor: "pointer", width: "100%", transition: "opacity 0.2s", marginTop: 4 },
  btnGhost: { background: "transparent", color: "#555", border: "1px solid #2a2a3e", borderRadius: 50, padding: "10px 24px", fontSize: 13, cursor: "pointer", width: "100%", marginTop: 8 },
  btnSmall: { background: "#F0A500", color: "#1a1a2e", border: "none", borderRadius: 8, padding: "8px 16px", fontSize: 13, fontWeight: 700, cursor: "pointer" },
  header: { display: "flex", alignItems: "center", justifyContent: "space-between", background: "#1a1a2e", borderRadius: 12, padding: "11px 18px", marginBottom: 20, gap: 12, flexWrap: "wrap" },
  badge: { background: "#0f0f1a", color: "#F0A500", padding: "5px 13px", borderRadius: 20, fontSize: 12, fontWeight: 600, whiteSpace: "nowrap" },
  error: { color: "#EF476F", fontSize: 12, marginTop: 8, textAlign: "left" },
  teamCard: { background: "#0f0f1a", borderRadius: 12, padding: "16px 18px", marginBottom: 10, display: "flex", alignItems: "center", justifyContent: "space-between", border: "1px solid #1e1e30" },
  codeBox: { background: "#0f0f1a", border: "2px dashed #F0A500", borderRadius: 12, padding: "16px", textAlign: "center", marginBottom: 16 },
  modeBox: { background: "#0f0f1a", borderRadius: 16, padding: "22px", marginBottom: 12, textAlign: "left", border: "1px solid #1e1e30" },
};

function ResultsPanel({ votes, members, tally, mostVoted, highest, lowest }) {
  const voteValues = Object.values(votes);
  if (!voteValues.length) return null;
  return (
    <div style={{ background: "#1a1a2e", borderRadius: 14, padding: 20, marginTop: 20, textAlign: "center" }}>
      <h3 style={{ color: "#F0A500", marginBottom: 14, fontSize: 14, letterSpacing: 1 }}>📊 RESULTS</h3>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12, marginBottom: 16 }}>
        {[{ val: mostVoted, lbl: "Most Voted" }, { val: highest ?? "—", lbl: "Highest" }, { val: lowest ?? "—", lbl: "Lowest" }].map(({ val, lbl }) => (
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
            <div style={{ width: `${(count / Math.max(members.length, 1)) * 100}%`, height: "100%", borderRadius: 4, background: CARD_COLORS[card] || "#555", transition: "width 0.8s ease" }} />
          </div>
          <span style={{ color: "#555", fontSize: 11, width: 50, textAlign: "right" }}>{count} vote{count > 1 ? "s" : ""}</span>
        </div>
      ))}
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [view, setView] = useState("role");

  // SM Auth
  const [authMode, setAuthMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [authError, setAuthError] = useState("");
  const [guestName, setGuestName] = useState("");

  // SM Team
  const [myTeams, setMyTeams] = useState({});
  const [newTeamName, setNewTeamName] = useState("");
  const [selectedTeam, setSelectedTeam] = useState(null);
  const [newMember, setNewMember] = useState("");
  const [session, setSession] = useState({});
  const [editingStory, setEditingStory] = useState(false);
  const [storyDraft, setStoryDraft] = useState("");
  const [copiedLink, setCopiedLink] = useState(false);

  // Developer
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

  // Quick Session
  const [quickName, setQuickName] = useState("");
  const [quickSessionId, setQuickSessionId] = useState(null);
  const [quickSession, setQuickSession] = useState({});
  const [quickParticipants, setQuickParticipants] = useState({});
  const [quickIsHost, setQuickIsHost] = useState(false);
  const [quickCard, setQuickCard] = useState(null);
  const [quickSubmitted, setQuickSubmitted] = useState(false);
  const [quickStory, setQuickStory] = useState("");
  const [quickEditStory, setQuickEditStory] = useState(false);
  const [quickJoinName, setQuickJoinName] = useState("");
  const [quickJoinError, setQuickJoinError] = useState("");

  // ── URL hash routing for quick session ───────────────────────
  useEffect(() => {
    const hash = window.location.hash;
    if (hash.startsWith("#/quick/")) {
      const sessionId = hash.replace("#/quick/", "");
      if (sessionId) { setQuickSessionId(sessionId); setView("quickJoin"); }
    }
  }, []);

  // ── Auth ──────────────────────────────────────────────────────
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u); setAuthLoading(false);
      if (u && view === "smAuth") setView("smDashboard");
    });
    return () => unsub();
  }, []);

  // ── Load SM teams ─────────────────────────────────────────────
  useEffect(() => {
    if (view !== "smDashboard" && view !== "smSession") return;
    const smId = user ? user.uid : `guest_${guestName.trim().replace(/\s/g, "_")}`;
    if (!smId) return;
    const unsub = onValue(ref(db, `teams/${smId}`), (snap) => setMyTeams(snap.val() || {}));
    return () => unsub();
  }, [view, user, guestName]);

  // ── SM session ────────────────────────────────────────────────
  useEffect(() => {
    if (!selectedTeam) return;
    const unsub = onValue(ref(db, `sessions/${selectedTeam.id}`), (snap) => {
      const data = snap.val() || {};
      setSession(prev => { if (prev.revealed === true && data.revealed === false) { setSelectedCard(null); setSubmitted(false); } return data; });
    });
    return () => unsub();
  }, [selectedTeam]);

  // ── Dev session ───────────────────────────────────────────────
  useEffect(() => {
    if (view !== "devSession" || !devTeamData) return;
    const unsub = onValue(ref(db, `sessions/${devTeamData.teamId}`), (snap) => {
      const data = snap.val() || {};
      setSession(prev => { if (prev.revealed === true && data.revealed === false) { setSelectedCard(null); setSubmitted(false); } return data; });
    });
    return () => unsub();
  }, [view, devTeamData]);

  // ── Observer session ──────────────────────────────────────────
  useEffect(() => {
    if (view !== "obsSession" || !obsTeamData) return;
    const unsub = onValue(ref(db, `sessions/${obsTeamData.teamId}`), (snap) => setSession(snap.val() || {}));
    return () => unsub();
  }, [view, obsTeamData]);

  // ── Quick session ─────────────────────────────────────────────
  useEffect(() => {
    if (!quickSessionId || !["quickHost", "quickPlayer", "quickJoin"].includes(view)) return;
    const unsub = onValue(ref(db, `quick/${quickSessionId}`), (snap) => {
      const data = snap.val() || {};
      setQuickSession(data);
      setQuickParticipants(data.participants || {});
      // Auto-reset card on new round
      if (data.revealed === false && quickSubmitted) { setQuickCard(null); setQuickSubmitted(false); }
    });
    return () => unsub();
  }, [quickSessionId, view]);

  // ── Quick handlers ────────────────────────────────────────────
  const handleCreateQuickSession = async () => {
    if (!quickName.trim()) return;
    const sessionId = generateCode() + generateCode();
    const hostId = quickName.trim();
    await set(ref(db, `quick/${sessionId}`), {
      host: hostId, story: "What are we estimating?", revealed: false,
      participants: { [hostId]: { name: hostId, voted: false } }
    });
    setQuickSessionId(sessionId); setQuickIsHost(true); setQuickJoinName(hostId);
    window.location.hash = `#/quick/${sessionId}`;
    setView("quickHost");
  };

  const handleJoinQuickSession = async () => {
    const name = quickJoinName.trim();
    if (!name) { setQuickJoinError("Please enter your name."); return; }
    const snap = await new Promise(res => onValue(ref(db, `quick/${quickSessionId}/participants/${name}`), res, { onlyOnce: true }));
    if (snap.val()) { setQuickJoinError("This name is already taken. Choose another."); return; }
    await set(ref(db, `quick/${quickSessionId}/participants/${name}`), { name, voted: false });
    const sessSnap = await new Promise(res => onValue(ref(db, `quick/${quickSessionId}`), res, { onlyOnce: true }));
    const isHost = sessSnap.val()?.host === name;
    setQuickIsHost(isHost);
    setView(isHost ? "quickHost" : "quickPlayer");
  };

  const handleQuickVote = async () => {
    if (!quickCard || !quickJoinName) return;
    await update(ref(db, `quick/${quickSessionId}/participants/${quickJoinName}`), { voted: true, vote: quickCard });
    setQuickSubmitted(true);
  };

  const handleQuickReveal = () => update(ref(db, `quick/${quickSessionId}`), { revealed: true });

  const handleQuickNewRound = async () => {
    const reset = {};
    Object.keys(quickParticipants).forEach(k => { reset[k] = { name: k, voted: false }; });
    await set(ref(db, `quick/${quickSessionId}/participants`), reset);
    await update(ref(db, `quick/${quickSessionId}`), { revealed: false });
    setQuickCard(null); setQuickSubmitted(false);
  };

  const copyQuickLink = () => {
    navigator.clipboard.writeText(`${getBaseUrl()}/#/quick/${quickSessionId}`);
    setCopiedLink(true); setTimeout(() => setCopiedLink(false), 2500);
  };

  // ── SM handlers ───────────────────────────────────────────────
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
      setView("smDashboard");
    } catch (e) {
      const msgs = { "auth/email-already-in-use": "This email is already registered.", "auth/invalid-email": "Invalid email.", "auth/weak-password": "Password must be at least 6 characters.", "auth/invalid-credential": "Wrong email or password." };
      setAuthError(msgs[e.code] || e.message);
    }
  };

  const handleLogout = async () => { await signOut(auth); setView("role"); setSelectedTeam(null); setMyTeams({}); setSession({}); };
  const getSmId = () => user ? user.uid : `guest_${guestName.trim().replace(/\s/g, "_")}`;
  const getSmLabel = () => user ? (user.displayName || user.email) : guestName;

  const handleCreateTeam = async () => {
    if (!newTeamName.trim()) return;
    const code = generateCode();
    const newRef = push(ref(db, `teams/${getSmId()}`));
    await set(newRef, { name: newTeamName.trim(), members: {}, code });
    await set(ref(db, `codes/${code}`), { teamId: newRef.key, smId: getSmId() });
    setNewTeamName("");
  };

  const handleDeleteTeam = async (teamId, code) => {
    await remove(ref(db, `teams/${getSmId()}/${teamId}`));
    await remove(ref(db, `sessions/${teamId}`));
    if (code) await remove(ref(db, `codes/${code}`));
  };

  const handleSelectTeam = (teamId, teamData) => {
    setSelectedTeam({ id: teamId, ...teamData }); setView("smSession");
    onValue(ref(db, `sessions/${teamId}/revealed`), (snap) => {
      if (snap.val() === null) { set(ref(db, `sessions/${teamId}/revealed`), false); set(ref(db, `sessions/${teamId}/story`), "What are we estimating?"); }
    }, { onlyOnce: true });
  };

  const handleAddMember = async () => {
    if (!newMember.trim() || !selectedTeam) return;
    await set(ref(db, `teams/${getSmId()}/${selectedTeam.id}/members/${newMember.trim()}`), true);
    setNewMember("");
  };

  const handleRemoveMember = async (name) => {
    await remove(ref(db, `teams/${getSmId()}/${selectedTeam.id}/members/${name}`));
    await remove(ref(db, `sessions/${selectedTeam.id}/votes/${name}`));
  };

  const lookupTeam = (code, onSuccess, setError) => {
    const c = code.trim().toUpperCase();
    if (!c) return;
    setError("");
    onValue(ref(db, `codes/${c}`), (snap) => {
      const data = snap.val();
      if (!data) { setError("❌ Team not found. Check the code."); return; }
      onValue(ref(db, `teams/${data.smId}/${data.teamId}`), (ts) => {
        const team = ts.val();
        if (!team) { setError("❌ Team not found."); return; }
        onSuccess({ teamId: data.teamId, smId: data.smId, ...team });
      }, { onlyOnce: true });
    }, { onlyOnce: true });
  };

  // ── Derived ───────────────────────────────────────────────────
  const currentMembers = selectedTeam ? Object.keys(myTeams[selectedTeam.id]?.members || {}) : [];
  const devMembers = devTeamData?.members ? Object.keys(devTeamData.members) : [];
  const obsMembers = obsTeamData?.members ? Object.keys(obsTeamData.members) : [];
  const votes = session.votes || {};
  const revealed = session.revealed || false;
  const story = session.story || "";
  const voteValues = Object.values(votes);
  const numericVotes = voteValues.filter(v => v !== "Huge" && v !== "?").map(Number);
  const tally = voteValues.reduce((acc, v) => { acc[v] = (acc[v] || 0) + 1; return acc; }, {});
  const mostVoted = Object.entries(tally).sort((a, b) => b[1] - a[1])[0]?.[0];
  const highest = numericVotes.length ? Math.max(...numericVotes) : null;
  const lowest = numericVotes.length ? Math.min(...numericVotes) : null;
  const votedCount = Object.keys(votes).length;

  const quickMemberList = Object.values(quickParticipants);
  const quickVotes = {};
  quickMemberList.forEach(p => { if (p.vote) quickVotes[p.name] = p.vote; });
  const quickVoteValues = Object.values(quickVotes);
  const quickNumeric = quickVoteValues.filter(v => v !== "Huge" && v !== "?").map(Number);
  const quickTally = quickVoteValues.reduce((acc, v) => { acc[v] = (acc[v] || 0) + 1; return acc; }, {});
  const quickMostVoted = Object.entries(quickTally).sort((a, b) => b[1] - a[1])[0]?.[0];
  const quickHighest = quickNumeric.length ? Math.max(...quickNumeric) : null;
  const quickLowest = quickNumeric.length ? Math.min(...quickNumeric) : null;
  const quickVotedCount = quickMemberList.filter(p => p.voted).length;
  const quickRevealed = quickSession.revealed || false;

  if (authLoading) return <div style={{ ...s.page, alignItems: "center" }}><p style={{ color: "#F0A500" }}>🃏 Loading...</p></div>;

  // ══════════════════════════════════════════════════════════════
  // HOME
  // ══════════════════════════════════════════════════════════════
  if (view === "role") return (
    <div style={s.page}>
      <div style={s.card}>
        <div style={{ fontSize: 48, marginBottom: 8 }}>🃏</div>
        <h1 style={s.title}>Planning Poker</h1>
        <p style={s.sub}>Sprint estimation for agile teams</p>

        <div style={{ ...s.modeBox, border: "1px solid #F0A500", marginBottom: 16 }}>
          <p style={{ color: "#F0A500", fontWeight: 700, fontSize: 15, margin: "0 0 4px" }}>⚡ Quick Session</p>
          <p style={{ color: "#555", fontSize: 12, margin: "0 0 14px" }}>Create a session instantly, share the link — no setup needed.</p>
          <input style={s.input} placeholder="Your name" value={quickName} onChange={e => setQuickName(e.target.value)}
            onKeyDown={e => e.key === "Enter" && quickName.trim() && handleCreateQuickSession()} />
          <button style={{ ...s.btn, opacity: quickName.trim() ? 1 : 0.4, marginTop: 8 }}
            onClick={handleCreateQuickSession} disabled={!quickName.trim()}>
            Create Session & Get Link →
          </button>
        </div>

        <button style={{ ...s.btnGhost, borderColor: "#2a2a3e" }} onClick={() => setView("teamMode")}>👥 Team Session (Advanced)</button>
        <button style={{ ...s.btnGhost, borderColor: "#1e1e30", color: "#333", marginTop: 6 }} onClick={() => setView("howTo")}>❓ How does this work?</button>
        <p style={{ color: "#2a2a3e", fontSize: 11, marginTop: 24 }}>Built by <span style={{ color: "#F0A500" }}>Hakan</span></p>
      </div>
    </div>
  );

  // ══════════════════════════════════════════════════════════════
  // QUICK JOIN (via link)
  // ══════════════════════════════════════════════════════════════
  if (view === "quickJoin") return (
    <div style={s.page}>
      <div style={s.card}>
        <div style={{ fontSize: 36, marginBottom: 8 }}>⚡</div>
        <h1 style={s.title}>Quick Session</h1>
        <p style={s.sub}>You've been invited! Enter your name to join.</p>
        <div style={s.field}>
          <label style={s.label}>YOUR NAME</label>
          <input style={s.input} placeholder="e.g. Mehmet" value={quickJoinName}
            onChange={e => { setQuickJoinName(e.target.value); setQuickJoinError(""); }}
            onKeyDown={e => e.key === "Enter" && handleJoinQuickSession()} autoFocus />
          {quickJoinError && <p style={s.error}>{quickJoinError}</p>}
        </div>
        <button style={{ ...s.btn, opacity: quickJoinName.trim() ? 1 : 0.4 }}
          onClick={handleJoinQuickSession} disabled={!quickJoinName.trim()}>
          Join Session →
        </button>
        <button style={s.btnGhost} onClick={() => { window.location.hash = ""; setView("role"); }}>← Home</button>
      </div>
    </div>
  );

  // ══════════════════════════════════════════════════════════════
  // QUICK HOST
  // ══════════════════════════════════════════════════════════════
  if (view === "quickHost") return (
    <div style={s.page}>
      <div style={{ width: "100%", maxWidth: 820 }}>
        <div style={s.header}>
          <span style={s.badge}>⚡ Host: {quickJoinName}</span>
          {quickEditStory ? (
            <input autoFocus style={{ ...s.input, flex: 1, margin: "0 12px", fontSize: 13, padding: "8px 12px" }}
              value={quickStory} onChange={e => setQuickStory(e.target.value)}
              onBlur={() => { update(ref(db, `quick/${quickSessionId}`), { story: quickStory }); setQuickEditStory(false); }}
              onKeyDown={e => e.key === "Enter" && (update(ref(db, `quick/${quickSessionId}`), { story: quickStory }), setQuickEditStory(false))}
            />
          ) : (
            <span onClick={() => { setQuickStory(quickSession.story || ""); setQuickEditStory(true); }}
              style={{ color: "#ccc", fontSize: 13, flex: 1, textAlign: "center", cursor: "pointer" }}>
              📋 {quickSession.story || "Click to set story"} ✏️
            </span>
          )}
          <span style={s.badge}>{quickVotedCount}/{quickMemberList.length} voted</span>
        </div>

        <div style={s.codeBox}>
          <p style={{ color: "#555", fontSize: 11, margin: "0 0 8px", letterSpacing: 1 }}>SHARE THIS LINK WITH YOUR TEAM</p>
          <p style={{ color: "#ccc", fontSize: 12, margin: "0 0 10px", wordBreak: "break-all" }}>{getBaseUrl()}/#/quick/{quickSessionId}</p>
          <button onClick={copyQuickLink} style={{ ...s.btnSmall, background: copiedLink ? "#06D6A0" : "#F0A500" }}>
            {copiedLink ? "✓ Copied!" : "Copy Link"}
          </button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 260px", gap: 20 }}>
          <div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(88px, 1fr))", gap: 12, marginBottom: 20 }}>
              {quickMemberList.map(p => (
                <div key={p.name} style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                  <div style={{
                    width: 68, height: 96, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 22, fontWeight: 800, border: "2px solid #1e1e30",
                    background: quickRevealed && p.vote ? CARD_COLORS[p.vote] || "#555" : "#1a1a2e",
                    color: quickRevealed && p.vote ? "#1a1a2e" : "#2a2a3e", transition: "all 0.5s ease",
                  }}>
                    {quickRevealed && p.vote ? p.vote : "?"}
                  </div>
                  <span style={{ fontSize: 11, color: "#666", marginTop: 5 }}>{p.name}</span>
                  {p.name === quickSession.host && <span style={{ fontSize: 9, color: "#F0A500" }}>HOST</span>}
                  {p.voted && !quickRevealed && <span style={{ fontSize: 10, color: "#06D6A0" }}>✓ voted</span>}
                  {!p.voted && <span style={{ fontSize: 10, color: "#EF476F" }}>waiting...</span>}
                </div>
              ))}
            </div>

            <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
              {!quickRevealed
                ? <button style={{ ...s.btn, width: "auto", padding: "13px 36px" }} onClick={handleQuickReveal}>🃏 Reveal Votes</button>
                : <button style={{ ...s.btn, background: "#4ECDC4", width: "auto", padding: "13px 36px" }} onClick={handleQuickNewRound}>🔄 New Round</button>
              }
            </div>

            {quickRevealed && quickVoteValues.length > 0 && (
              <ResultsPanel votes={quickVotes} members={quickMemberList} tally={quickTally}
                mostVoted={quickMostVoted} highest={quickHighest} lowest={quickLowest} />
            )}
          </div>

          <div style={{ background: "#1a1a2e", borderRadius: 14, padding: 16, height: "fit-content" }}>
            <h3 style={{ color: "#F0A500", fontSize: 13, letterSpacing: 1, margin: "0 0 12px" }}>🃏 YOUR VOTE</h3>
            {quickSubmitted ? (
              <p style={{ color: "#555", fontSize: 12, textAlign: "center" }}>You voted: <strong style={{ color: "#F0A500" }}>{quickCard}</strong></p>
            ) : quickRevealed ? (
              <p style={{ color: "#555", fontSize: 12, textAlign: "center" }}>Waiting for next round...</p>
            ) : (
              <>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8, marginBottom: 12 }}>
                  {CARDS.map(card => (
                    <button key={card} onClick={() => setQuickCard(card)} style={{
                      padding: "10px 4px", borderRadius: 8,
                      border: `2px solid ${quickCard === card ? CARD_COLORS[card] : "#1e1e30"}`,
                      background: quickCard === card ? CARD_COLORS[card] : "#0f0f1a",
                      color: quickCard === card ? "#1a1a2e" : "#ccc",
                      fontWeight: 700, fontSize: 14, cursor: "pointer",
                    }}>{card}</button>
                  ))}
                </div>
                <button style={{ ...s.btn, opacity: quickCard ? 1 : 0.4 }} onClick={handleQuickVote} disabled={!quickCard}>Submit Vote</button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  // ══════════════════════════════════════════════════════════════
  // QUICK PLAYER
  // ══════════════════════════════════════════════════════════════
  if (view === "quickPlayer") return (
    <div style={s.page}>
      <div style={{ width: "100%", maxWidth: 680 }}>
        <div style={s.header}>
          <span style={s.badge}>⚡ {quickJoinName}</span>
          <span style={{ color: "#ccc", fontSize: 13, flex: 1, textAlign: "center" }}>📋 {quickSession.story || "Waiting..."}</span>
          <span style={s.badge}>{quickVotedCount}/{quickMemberList.length} voted</span>
        </div>

        {quickRevealed ? (
          <div style={{ background: "#1a2535", color: "#45B7D1", padding: "13px 20px", borderRadius: 10, textAlign: "center", marginBottom: 20, fontSize: 14 }}>🃏 Host revealed the votes!</div>
        ) : quickSubmitted ? (
          <div style={{ background: "#1a2e1a", color: "#06D6A0", padding: "13px 20px", borderRadius: 10, textAlign: "center", marginBottom: 20, fontSize: 14 }}>✅ Vote submitted! Waiting for host to reveal...</div>
        ) : (
          <p style={{ color: "#555", textAlign: "center", marginBottom: 20, fontSize: 14 }}>Pick your estimate</p>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 24 }}>
          {CARDS.map(card => (
            <button key={card} onClick={() => !quickSubmitted && !quickRevealed && setQuickCard(card)}
              disabled={quickSubmitted || quickRevealed}
              style={{
                aspectRatio: "2/3", borderRadius: 12,
                border: `2px solid ${quickCard === card ? CARD_COLORS[card] : "#1e1e30"}`,
                display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                background: quickCard === card ? CARD_COLORS[card] : "#1a1a2e",
                color: quickCard === card ? "#1a1a2e" : "#ccc",
                transform: quickCard === card ? "translateY(-8px) scale(1.04)" : "translateY(0)",
                opacity: (quickSubmitted || quickRevealed) && quickCard !== card ? 0.3 : 1,
                cursor: quickSubmitted || quickRevealed ? "not-allowed" : "pointer",
                transition: "all 0.2s ease", fontWeight: 800, fontSize: 22,
              }}>
              {card}
              {card === "?" && <span style={{ fontSize: 9, opacity: 0.6, marginTop: 3 }}>unsure</span>}
            </button>
          ))}
        </div>

        {!quickSubmitted && !quickRevealed && (
          <button style={{ ...s.btn, opacity: quickCard ? 1 : 0.4 }} onClick={handleQuickVote} disabled={!quickCard}>Submit Vote 🚀</button>
        )}

        <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap", marginTop: 24 }}>
          {quickMemberList.map(p => (
            <div key={p.name} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
              <div style={{
                width: 38, height: 38, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
                fontWeight: 700, fontSize: 13, transition: "all 0.3s",
                background: p.voted ? "#F0A500" : "#1e1e30", color: p.voted ? "#1a1a2e" : "#444",
                border: p.name === quickJoinName ? "2px solid #F0A500" : "2px solid transparent",
              }}>
                {quickRevealed && p.vote ? p.vote : p.voted ? "✓" : "?"}
              </div>
              <span style={{ fontSize: 10, color: p.name === quickJoinName ? "#F0A500" : "#555" }}>{p.name}</span>
              {p.name === quickSession.host && <span style={{ fontSize: 9, color: "#6C63FF" }}>host</span>}
            </div>
          ))}
        </div>

        {quickRevealed && quickVoteValues.length > 0 && (
          <ResultsPanel votes={quickVotes} members={quickMemberList} tally={quickTally}
            mostVoted={quickMostVoted} highest={quickHighest} lowest={quickLowest} />
        )}
      </div>
    </div>
  );

  // ══════════════════════════════════════════════════════════════
  // TEAM MODE
  // ══════════════════════════════════════════════════════════════
  if (view === "teamMode") return (
    <div style={s.page}>
      <div style={s.card}>
        <div style={{ fontSize: 36, marginBottom: 8 }}>👥</div>
        <h1 style={s.title}>Team Session</h1>
        <p style={s.sub}>Permanent teams with member management</p>
        <button style={s.btn} onClick={() => setView("smMode")}>🎯 Scrum Master</button>
        <button style={{ ...s.btn, background: "#45B7D1", marginTop: 12 }} onClick={() => setView("devJoin")}>👨‍💻 Developer</button>
        <button style={{ ...s.btn, background: "#96CEB4", color: "#1a1a2e", marginTop: 12 }} onClick={() => setView("obsJoin")}>👁️ Observer</button>
        <button style={s.btnGhost} onClick={() => setView("role")}>← Back</button>
      </div>
    </div>
  );

  // ══════════════════════════════════════════════════════════════
  // HOW TO
  // ══════════════════════════════════════════════════════════════
  if (view === "howTo") return (
    <div style={s.page}>
      <div style={{ ...s.card, maxWidth: 580, textAlign: "left" }}>
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div style={{ fontSize: 40 }}>📖</div>
          <h1 style={{ ...s.title, fontSize: 22 }}>How to Use Planning Poker</h1>
        </div>

        <div style={{ ...s.modeBox, border: "1px solid #F0A500", marginBottom: 14 }}>
          <p style={{ color: "#F0A500", fontWeight: 700, fontSize: 15, margin: "0 0 12px" }}>⚡ Quick Session — Easiest</p>
          {["Enter your name on the home screen and click Create Session.", "Copy the link and share it with your team via chat or email.", "Everyone clicks the link, enters their name and joins instantly.", "As host, set the story you want to estimate.", "Everyone picks a card — votes are hidden until you reveal.", "Click Reveal Votes to show all results at once.", "Click New Round to reset and move to the next story."].map((t, i) => (
            <div key={i} style={{ display: "flex", gap: 10, marginBottom: 6 }}>
              <span style={{ color: "#F0A500", fontWeight: 700, fontSize: 12, flexShrink: 0 }}>{i + 1}.</span>
              <p style={{ color: "#aaa", fontSize: 12, margin: 0, lineHeight: 1.6 }}>{t}</p>
            </div>
          ))}
        </div>

        <div style={{ ...s.modeBox, marginBottom: 14 }}>
          <p style={{ color: "#45B7D1", fontWeight: 700, fontSize: 15, margin: "0 0 4px" }}>👥 Team Session — Advanced</p>
          <p style={{ color: "#555", fontSize: 12, margin: "0 0 12px" }}>Best for recurring teams. Create once, reuse every sprint.</p>

          <p style={{ color: "#F0A500", fontSize: 12, fontWeight: 700, margin: "0 0 6px" }}>🎯 Scrum Master</p>
          {["Choose Guest (quick) or Account (permanent teams — recommended).", "Create a team and add developers by name.", "Each team gets a 6-digit code. Share it with developers & observers.", "Open the session, set the story, reveal votes, manage rounds."].map((t, i) => (
            <div key={i} style={{ display: "flex", gap: 10, marginBottom: 5 }}>
              <span style={{ color: "#555", fontSize: 11, flexShrink: 0 }}>{i + 1}.</span>
              <p style={{ color: "#aaa", fontSize: 12, margin: 0, lineHeight: 1.5 }}>{t}</p>
            </div>
          ))}

          <p style={{ color: "#45B7D1", fontSize: 12, fontWeight: 700, margin: "10px 0 6px" }}>👨‍💻 Developer</p>
          {["Enter the 6-digit team code from your Scrum Master.", "Select your name from the list and join.", "Pick a card — hidden until SM reveals."].map((t, i) => (
            <div key={i} style={{ display: "flex", gap: 10, marginBottom: 5 }}>
              <span style={{ color: "#555", fontSize: 11, flexShrink: 0 }}>{i + 1}.</span>
              <p style={{ color: "#aaa", fontSize: 12, margin: 0, lineHeight: 1.5 }}>{t}</p>
            </div>
          ))}

          <p style={{ color: "#96CEB4", fontSize: 12, fontWeight: 700, margin: "10px 0 4px" }}>👁️ Observer</p>
          <p style={{ color: "#aaa", fontSize: 12, margin: 0 }}>Same team code, no voting. Watch the session and see results when revealed.</p>
        </div>

        <div style={{ ...s.modeBox, marginBottom: 20 }}>
          <p style={{ color: "#96CEB4", fontWeight: 700, fontSize: 15, margin: "0 0 10px" }}>🃏 Story Point Cards</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
            {CARDS.map(c => <span key={c} style={{ background: CARD_COLORS[c], color: c === "Huge" ? "#fff" : "#1a1a2e", borderRadius: 6, padding: "4px 10px", fontSize: 13, fontWeight: 700 }}>{c}</span>)}
          </div>
          <p style={{ color: "#555", fontSize: 12, margin: 0, lineHeight: 1.6 }}>
            Fibonacci numbers represent task complexity. <strong style={{ color: "#aaa" }}>Huge</strong> = too large, break it down. <strong style={{ color: "#6C63FF" }}>?</strong> = unsure, needs discussion.
          </p>
        </div>

        <button style={s.btn} onClick={() => setView("role")}>← Back to Home</button>
      </div>
    </div>
  );

  // ══════════════════════════════════════════════════════════════
  // SM MODE
  // ══════════════════════════════════════════════════════════════
  if (view === "smMode") return (
    <div style={s.page}>
      <div style={s.card}>
        <div style={{ fontSize: 36, marginBottom: 8 }}>🎯</div>
        <h1 style={s.title}>Scrum Master</h1>
        <p style={s.sub}>How would you like to continue?</p>
        <div style={{ ...s.modeBox, marginBottom: 12 }}>
          <p style={{ color: "#fff", fontWeight: 700, margin: "0 0 4px", fontSize: 15 }}>👤 Guest — No account</p>
          <p style={{ color: "#555", fontSize: 12, margin: "0 0 14px" }}>Quick access. Teams lost when you close the browser.</p>
          <input style={s.input} placeholder="Your name" value={guestName} onChange={e => setGuestName(e.target.value)}
            onKeyDown={e => e.key === "Enter" && guestName.trim() && setView("smDashboard")} />
          <button style={{ ...s.btn, marginTop: 10, opacity: guestName.trim() ? 1 : 0.4 }}
            onClick={() => guestName.trim() && setView("smDashboard")} disabled={!guestName.trim()}>
            Continue as Guest →
          </button>
        </div>
        <div style={s.modeBox}>
          <p style={{ color: "#fff", fontWeight: 700, margin: "0 0 4px", fontSize: 15 }}>🔐 Account — With password</p>
          <p style={{ color: "#555", fontSize: 12, margin: "0 0 14px" }}>Teams saved permanently.</p>
          <button style={s.btn} onClick={() => setView("smAuth")}>Sign In / Register →</button>
        </div>
        <button style={s.btnGhost} onClick={() => setView("teamMode")}>← Back</button>
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
        <div style={{ display: "flex", background: "#0f0f1a", borderRadius: 10, padding: 3, marginBottom: 20 }}>
          {["login", "register"].map(m => (
            <button key={m} onClick={() => { setAuthMode(m); setAuthError(""); }} style={{
              flex: 1, padding: "9px 0", borderRadius: 8, border: "none",
              background: authMode === m ? "#F0A500" : "transparent",
              color: authMode === m ? "#1a1a2e" : "#555",
              fontWeight: authMode === m ? 700 : 400, cursor: "pointer", fontSize: 13,
            }}>{m === "login" ? "Sign In" : "Register"}</button>
          ))}
        </div>
        {authMode === "register" && (
          <div style={s.field}><label style={s.label}>YOUR NAME</label>
            <input style={s.input} placeholder="e.g. Hakan" value={displayName} onChange={e => setDisplayName(e.target.value)} />
          </div>
        )}
        <div style={s.field}><label style={s.label}>EMAIL</label>
          <input style={s.input} type="email" placeholder="you@company.com" value={email}
            onChange={e => setEmail(e.target.value)} onKeyDown={e => e.key === "Enter" && handleAuth()} />
        </div>
        <div style={s.field}><label style={s.label}>PASSWORD</label>
          <input style={s.input} type="password" placeholder="••••••••" value={password}
            onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key === "Enter" && handleAuth()} />
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
  if (view === "smDashboard") return (
    <div style={s.page}>
      <div style={{ width: "100%", maxWidth: 600 }}>
        <div style={s.header}>
          <span style={s.badge}>🎯 {getSmLabel()}</span>
          <span style={{ color: "#F0A500", fontSize: 18, fontWeight: 700 }}>My Teams</span>
          {user
            ? <button onClick={handleLogout} style={{ background: "transparent", border: "1px solid #2a2a3e", color: "#555", borderRadius: 20, padding: "5px 14px", cursor: "pointer", fontSize: 12 }}>Sign Out</button>
            : <button onClick={() => setView("teamMode")} style={{ background: "transparent", border: "1px solid #2a2a3e", color: "#555", borderRadius: 20, padding: "5px 14px", cursor: "pointer", fontSize: 12 }}>Exit</button>
          }
        </div>
        <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
          <input style={{ ...s.input, flex: 1 }} placeholder="New team name..." value={newTeamName}
            onChange={e => setNewTeamName(e.target.value)} onKeyDown={e => e.key === "Enter" && handleCreateTeam()} />
          <button onClick={handleCreateTeam} style={{ ...s.btnSmall, fontSize: 20, padding: "8px 18px" }}>+</button>
        </div>
        {Object.keys(myTeams).length === 0 ? (
          <div style={{ textAlign: "center", padding: "40px 20px", color: "#333" }}>
            <p style={{ fontSize: 32 }}>🏗️</p><p>No teams yet. Create your first team above!</p>
          </div>
        ) : Object.entries(myTeams).map(([teamId, team]) => (
          <div key={teamId} style={s.teamCard}>
            <div style={{ flex: 1, cursor: "pointer" }} onClick={() => handleSelectTeam(teamId, team)}>
              <p style={{ color: "#fff", fontWeight: 700, margin: 0, fontSize: 15 }}>{team.name}</p>
              <p style={{ color: "#555", fontSize: 12, margin: "3px 0 0" }}>{Object.keys(team.members || {}).length} members</p>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ border: "1px dashed #F0A500", borderRadius: 8, padding: "4px 10px" }}>
                <span style={{ color: "#F0A500", fontSize: 13, fontWeight: 700, letterSpacing: 2 }}>{team.code}</span>
              </div>
              <span style={{ color: "#F0A500", fontSize: 13, cursor: "pointer" }} onClick={() => handleSelectTeam(teamId, team)}>Open →</span>
              <button onClick={() => handleDeleteTeam(teamId, team.code)}
                style={{ background: "transparent", border: "none", color: "#333", cursor: "pointer", fontSize: 18 }}
                onMouseEnter={e => e.target.style.color = "#EF476F"}
                onMouseLeave={e => e.target.style.color = "#333"}>✕</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  // ══════════════════════════════════════════════════════════════
  // SM SESSION
  // ══════════════════════════════════════════════════════════════
  if (view === "smSession" && selectedTeam) return (
    <div style={s.page}>
      <div style={{ width: "100%", maxWidth: 920 }}>
        <div style={s.header}>
          <button onClick={() => setView("smDashboard")} style={{ background: "transparent", border: "none", color: "#F0A500", cursor: "pointer", fontSize: 13 }}>← Teams</button>
          {editingStory ? (
            <input autoFocus style={{ ...s.input, flex: 1, margin: "0 12px", fontSize: 13, padding: "8px 12px" }}
              value={storyDraft} onChange={e => setStoryDraft(e.target.value)}
              onBlur={() => { update(ref(db, `sessions/${selectedTeam.id}`), { story: storyDraft }); setEditingStory(false); }}
              onKeyDown={e => e.key === "Enter" && (update(ref(db, `sessions/${selectedTeam.id}`), { story: storyDraft }), setEditingStory(false))}
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
            <div style={s.codeBox}>
              <p style={{ color: "#555", fontSize: 11, margin: "0 0 6px", letterSpacing: 1 }}>TEAM CODE — share with developers & observers</p>
              <span style={{ color: "#F0A500", fontSize: 32, fontWeight: 800, letterSpacing: 6 }}>{selectedTeam.code}</span><br />
              <button onClick={() => { navigator.clipboard.writeText(selectedTeam.code); setCopiedLink(true); setTimeout(() => setCopiedLink(false), 2000); }}
                style={{ ...s.btnSmall, marginTop: 10, background: copiedLink ? "#06D6A0" : "#F0A500" }}>
                {copiedLink ? "✓ Copied!" : "Copy Code"}
              </button>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(88px, 1fr))", gap: 12, marginBottom: 20 }}>
              {currentMembers.map(p => (
                <div key={p} style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                  <div style={{
                    width: 68, height: 96, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 22, fontWeight: 800, border: "2px solid #1e1e30",
                    background: revealed && votes[p] ? CARD_COLORS[votes[p]] || "#555" : "#1a1a2e",
                    color: revealed && votes[p] ? "#1a1a2e" : "#2a2a3e", transition: "all 0.5s ease",
                  }}>
                    {revealed && votes[p] ? votes[p] : "?"}
                  </div>
                  <span style={{ fontSize: 11, color: "#666", marginTop: 5 }}>{p}</span>
                  {votes[p] && !revealed && <span style={{ fontSize: 10, color: "#06D6A0" }}>✓ voted</span>}
                  {!votes[p] && <span style={{ fontSize: 10, color: "#EF476F" }}>waiting...</span>}
                </div>
              ))}
            </div>

            <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
              {!revealed
                ? <button style={{ ...s.btn, width: "auto", padding: "13px 36px" }} onClick={() => update(ref(db, `sessions/${selectedTeam.id}`), { revealed: true })}>🃏 Reveal Votes</button>
                : <button style={{ ...s.btn, background: "#4ECDC4", width: "auto", padding: "13px 36px" }}
                    onClick={async () => { await set(ref(db, `sessions/${selectedTeam.id}/votes`), null); await set(ref(db, `sessions/${selectedTeam.id}/revealed`), false); }}>🔄 New Round</button>
              }
            </div>

            {revealed && voteValues.length > 0 && (
              <ResultsPanel votes={votes} members={currentMembers} tally={tally} mostVoted={mostVoted} highest={highest} lowest={lowest} />
            )}
          </div>

          <div style={{ background: "#1a1a2e", borderRadius: 14, padding: 18, height: "fit-content", position: "sticky", top: 20 }}>
            <h3 style={{ color: "#F0A500", fontSize: 13, letterSpacing: 1, margin: "0 0 14px" }}>👥 TEAM MEMBERS</h3>
            <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
              <input style={{ ...s.input, flex: 1, padding: "9px 12px", fontSize: 13 }} placeholder="Add member..."
                value={newMember} onChange={e => setNewMember(e.target.value)} onKeyDown={e => e.key === "Enter" && handleAddMember()} />
              <button onClick={handleAddMember} style={{ background: "#F0A500", border: "none", borderRadius: 8, padding: "9px 14px", cursor: "pointer", fontWeight: 700, color: "#1a1a2e", fontSize: 18 }}>+</button>
            </div>
            {currentMembers.length === 0
              ? <p style={{ color: "#333", fontSize: 12, textAlign: "center" }}>No members yet.</p>
              : currentMembers.map(p => (
                <div key={p} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "#0f0f1a", borderRadius: 8, padding: "8px 12px", marginBottom: 7 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ width: 26, height: 26, borderRadius: "50%", background: votes[p] ? "#F0A500" : "#1e1e30", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: votes[p] ? "#1a1a2e" : "#333" }}>
                      {votes[p] ? "✓" : "?"}
                    </div>
                    <span style={{ color: "#ccc", fontSize: 13 }}>{p}</span>
                  </div>
                  <button onClick={() => handleRemoveMember(p)}
                    style={{ background: "transparent", border: "none", color: "#333", cursor: "pointer", fontSize: 16 }}
                    onMouseEnter={e => e.target.style.color = "#EF476F"}
                    onMouseLeave={e => e.target.style.color = "#333"}>✕</button>
                </div>
              ))
            }
          </div>
        </div>
      </div>
    </div>
  );

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
              placeholder="ABC123" maxLength={6} value={devCode}
              onChange={e => { setDevCode(e.target.value.toUpperCase()); setDevCodeError(""); setDevTeamData(null); setDevName(""); }}
              onKeyDown={e => e.key === "Enter" && lookupTeam(devCode, setDevTeamData, setDevCodeError)} />
            <button onClick={() => lookupTeam(devCode, setDevTeamData, setDevCodeError)} style={{ ...s.btnSmall, fontSize: 13, padding: "11px 16px" }}>Find</button>
          </div>
          {devCodeError && <p style={s.error}>{devCodeError}</p>}
        </div>
        {devTeamData && (
          <>
            <div style={{ background: "#0f0f1a", borderRadius: 10, padding: "14px", marginBottom: 16, textAlign: "left" }}>
              <p style={{ color: "#06D6A0", fontSize: 12, margin: "0 0 4px" }}>✓ Team found!</p>
              <p style={{ color: "#fff", fontWeight: 700, margin: 0 }}>{devTeamData.name}</p>
            </div>
            <div style={s.field}>
              <label style={s.label}>SELECT YOUR NAME</label>
              <select style={{ ...s.input, cursor: "pointer" }} value={devName} onChange={e => setDevName(e.target.value)}>
                <option value="">— Choose your name —</option>
                {Object.keys(devTeamData.members || {}).map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
          </>
        )}
        <button style={{ ...s.btn, opacity: devTeamData && devName ? 1 : 0.4, marginTop: 8 }}
          onClick={() => {
            if (!devTeamData || !devName) return;
            onValue(ref(db, `sessions/${devTeamData.teamId}/revealed`), (snap) => {
              if (snap.val() === null) { set(ref(db, `sessions/${devTeamData.teamId}/revealed`), false); set(ref(db, `sessions/${devTeamData.teamId}/story`), "What are we estimating?"); }
            }, { onlyOnce: true });
            setView("devSession");
          }} disabled={!devTeamData || !devName}>
          Join Session →
        </button>
        <button style={s.btnGhost} onClick={() => setView("teamMode")}>← Back</button>
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
          <div style={{ background: "#1a2535", color: "#45B7D1", padding: "13px 20px", borderRadius: 10, textAlign: "center", marginBottom: 20, fontSize: 14 }}>🃏 Scrum Master revealed the votes!</div>
        ) : !submitted ? (
          <p style={{ color: "#555", textAlign: "center", marginBottom: 20, fontSize: 14 }}>Pick your estimate — others can't see your vote yet</p>
        ) : (
          <div style={{ background: "#1a2e1a", color: "#06D6A0", padding: "13px 20px", borderRadius: 10, textAlign: "center", marginBottom: 20, fontSize: 14 }}>✅ Vote submitted! Waiting for Scrum Master to reveal...</div>
        )}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 24 }}>
          {CARDS.map(card => (
            <button key={card} onClick={() => !submitted && !revealed && setSelectedCard(card)}
              disabled={submitted || revealed}
              style={{
                aspectRatio: "2/3", borderRadius: 12,
                border: `2px solid ${selectedCard === card ? CARD_COLORS[card] : "#1e1e30"}`,
                display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                background: selectedCard === card ? CARD_COLORS[card] : "#1a1a2e",
                color: selectedCard === card ? "#1a1a2e" : "#ccc",
                transform: selectedCard === card ? "translateY(-8px) scale(1.04)" : "translateY(0)",
                opacity: (submitted || revealed) && selectedCard !== card ? 0.3 : 1,
                cursor: submitted || revealed ? "not-allowed" : "pointer",
                transition: "all 0.2s ease", fontWeight: 800, fontSize: 22,
              }}>
              {card}
              {card === "?" && <span style={{ fontSize: 9, opacity: 0.6, marginTop: 3 }}>unsure</span>}
            </button>
          ))}
        </div>
        {!submitted && !revealed && (
          <button style={{ ...s.btn, opacity: selectedCard ? 1 : 0.4 }}
            onClick={async () => { await set(ref(db, `sessions/${devTeamData.teamId}/votes/${devName}`), selectedCard); setSubmitted(true); }}
            disabled={!selectedCard}>Submit Vote 🚀</button>
        )}
        <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap", marginTop: 24 }}>
          {devMembers.map(p => (
            <div key={p} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
              <div style={{ width: 38, height: 38, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 13, transition: "all 0.3s", background: votes[p] ? "#F0A500" : "#1e1e30", color: votes[p] ? "#1a1a2e" : "#444", border: p === devName ? "2px solid #F0A500" : "2px solid transparent" }}>
                {revealed && votes[p] ? votes[p] : votes[p] ? "✓" : "?"}
              </div>
              <span style={{ fontSize: 10, color: p === devName ? "#F0A500" : "#555" }}>{p}</span>
            </div>
          ))}
        </div>
        {revealed && voteValues.length > 0 && (
          <ResultsPanel votes={votes} members={devMembers} tally={tally} mostVoted={mostVoted} highest={highest} lowest={lowest} />
        )}
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
              placeholder="ABC123" maxLength={6} value={obsCode}
              onChange={e => { setObsCode(e.target.value.toUpperCase()); setObsCodeError(""); setObsTeamData(null); }}
              onKeyDown={e => e.key === "Enter" && lookupTeam(obsCode, setObsTeamData, setObsCodeError)} />
            <button onClick={() => lookupTeam(obsCode, setObsTeamData, setObsCodeError)} style={{ ...s.btnSmall, fontSize: 13, padding: "11px 16px" }}>Find</button>
          </div>
          {obsCodeError && <p style={s.error}>{obsCodeError}</p>}
        </div>
        {obsTeamData && (
          <div style={{ background: "#0f0f1a", borderRadius: 10, padding: "14px", marginBottom: 16, textAlign: "left" }}>
            <p style={{ color: "#06D6A0", fontSize: 12, margin: "0 0 4px" }}>✓ Team found!</p>
            <p style={{ color: "#fff", fontWeight: 700, margin: 0 }}>{obsTeamData.name}</p>
          </div>
        )}
        <button style={{ ...s.btn, background: "#96CEB4", color: "#1a1a2e", opacity: obsTeamData ? 1 : 0.4, marginTop: 8 }}
          onClick={() => obsTeamData && setView("obsSession")} disabled={!obsTeamData}>
          Watch Session →
        </button>
        <button style={s.btnGhost} onClick={() => setView("teamMode")}>← Back</button>
      </div>
    </div>
  );

  // ══════════════════════════════════════════════════════════════
  // OBSERVER SESSION
  // ══════════════════════════════════════════════════════════════
  if (view === "obsSession" && obsTeamData) return (
    <div style={s.page}>
      <div style={{ width: "100%", maxWidth: 680 }}>
        <div style={s.header}>
          <span style={s.badge}>👁️ Observer</span>
          <span style={{ color: "#ccc", fontSize: 13, flex: 1, textAlign: "center" }}>📋 {story}</span>
          <span style={s.badge}>{votedCount}/{obsMembers.length} voted</span>
        </div>
        {!revealed ? (
          <div style={{ background: "#1a2535", color: "#45B7D1", padding: "13px 20px", borderRadius: 10, textAlign: "center", marginBottom: 20, fontSize: 14 }}>⏳ Waiting for Scrum Master to reveal votes...</div>
        ) : (
          <div style={{ background: "#1a2e1a", color: "#06D6A0", padding: "13px 20px", borderRadius: 10, textAlign: "center", marginBottom: 20, fontSize: 14 }}>🃏 Votes revealed!</div>
        )}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(88px, 1fr))", gap: 12, marginBottom: 20 }}>
          {obsMembers.map(p => (
            <div key={p} style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
              <div style={{ width: 68, height: 96, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, fontWeight: 800, border: "2px solid #1e1e30", background: revealed && votes[p] ? CARD_COLORS[votes[p]] || "#555" : "#1a1a2e", color: revealed && votes[p] ? "#1a1a2e" : "#2a2a3e", transition: "all 0.5s ease" }}>
                {revealed && votes[p] ? votes[p] : "?"}
              </div>
              <span style={{ fontSize: 11, color: "#666", marginTop: 5 }}>{p}</span>
              {votes[p] && !revealed && <span style={{ fontSize: 10, color: "#06D6A0" }}>✓ voted</span>}
              {!votes[p] && <span style={{ fontSize: 10, color: "#EF476F" }}>waiting...</span>}
            </div>
          ))}
        </div>
        {revealed && voteValues.length > 0 && (
          <ResultsPanel votes={votes} members={obsMembers} tally={tally} mostVoted={mostVoted} highest={highest} lowest={lowest} />
        )}
      </div>
    </div>
  );

  return null;
}
