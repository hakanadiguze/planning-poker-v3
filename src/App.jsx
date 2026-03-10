import { useState, useEffect } from "react";
import { db, auth } from "./firebase";
import { ref, set, onValue, remove, update, push } from "firebase/database";
import {
  createUserWithEmailAndPassword, signInWithEmailAndPassword,
  signOut, onAuthStateChanged, updateProfile
} from "firebase/auth";

const CARDS = ["1", "2", "3", "5", "8", "13", "21", "Huge", "?"];
const CARD_COLORS = {
  "1": "#0D9488", "2": "#0EA5E9", "3": "#8B5CF6", "5": "#F59E0B",
  "8": "#EF4444", "13": "#F97316", "21": "#EC4899", "Huge": "#374151", "?": "#6366F1"
};

const generateCode = () => Math.random().toString(36).substring(2, 8).toUpperCase();
const getBaseUrl = () => window.location.origin;

// ── Color tokens ───────────────────────────────────────────────────
const C = {
  bg: "#F0FDFC",           // very light teal bg
  surface: "#FFFFFF",      // white cards
  surface2: "#F0FDFC",     // light teal for inner boxes
  border: "#99F6E4",       // teal border
  border2: "#E2E8F0",      // soft gray border
  teal: "#0D9488",         // primary teal
  tealLight: "#CCFBF1",    // light teal bg
  orange: "#F97316",       // accent orange
  orangeLight: "#FFF7ED",  // light orange bg
  text: "#0F172A",         // dark text
  sub: "#64748B",          // muted text
  sub2: "#94A3B8",         // lighter muted
  red: "#EF4444",
  green: "#10B981",
  greenLight: "#D1FAE5",
};

// ── Global styles — injected once at module load ──────────────────
(() => {
  if (document.getElementById("pp-styles")) return;
  const style = document.createElement("style");
  style.id = "pp-styles";
  style.innerHTML = `
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { background: ${C.bg}; font-family: 'Inter', 'Segoe UI', sans-serif; }
    input, select, button, textarea { font-family: inherit; }
    ::-webkit-scrollbar { width: 4px; } ::-webkit-scrollbar-track { background: transparent; }
    ::-webkit-scrollbar-thumb { background: ${C.border}; border-radius: 4px; }
    .card-hover:hover { transform: translateY(-6px) scale(1.04) !important; box-shadow: 0 8px 24px rgba(13,148,136,0.25) !important; }
    .btn-hover:hover { opacity: 0.88; }
    .team-row:hover { background: ${C.tealLight} !important; }
  `;
  document.head.appendChild(style);
})();

// ── Shared component styles ────────────────────────────────────────
const s = {
  // Layout
  fullPage: { minHeight: "100vh", background: C.bg, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "16px" },
  splitPage: { minHeight: "100vh", background: C.bg, display: "flex", flexDirection: "column", padding: "16px 20px", maxWidth: "100%" },

  // Cards / surfaces
  surface: { background: C.surface, borderRadius: 16, boxShadow: "0 1px 4px rgba(0,0,0,0.08), 0 4px 16px rgba(13,148,136,0.07)", border: `1px solid ${C.border}` },
  innerBox: { background: C.surface2, borderRadius: 12, border: `1px solid ${C.border}`, padding: "16px" },

  // Typography
  pageTitle: { color: C.text, fontSize: 26, fontWeight: 800, letterSpacing: -0.5 },
  sectionTitle: { color: C.teal, fontSize: 12, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase" },
  body: { color: C.sub, fontSize: 13, lineHeight: 1.6 },

  // Inputs
  input: { width: "100%", padding: "10px 14px", background: C.surface, border: `1.5px solid ${C.border2}`, borderRadius: 10, color: C.text, fontSize: 14, outline: "none", transition: "border 0.2s" },

  // Buttons
  btnPrimary: { background: C.teal, color: "#fff", border: "none", borderRadius: 10, padding: "11px 24px", fontSize: 14, fontWeight: 700, cursor: "pointer", width: "100%", transition: "opacity 0.15s" },
  btnOrange: { background: C.orange, color: "#fff", border: "none", borderRadius: 10, padding: "11px 24px", fontSize: 14, fontWeight: 700, cursor: "pointer", width: "100%", transition: "opacity 0.15s" },
  btnOutline: { background: "transparent", color: C.teal, border: `1.5px solid ${C.teal}`, borderRadius: 10, padding: "10px 24px", fontSize: 14, fontWeight: 600, cursor: "pointer", width: "100%", transition: "all 0.15s" },
  btnGhost: { background: "transparent", color: C.sub, border: `1px solid ${C.border2}`, borderRadius: 10, padding: "9px 20px", fontSize: 13, cursor: "pointer", width: "100%", transition: "all 0.15s" },
  btnSmall: { background: C.teal, color: "#fff", border: "none", borderRadius: 8, padding: "8px 16px", fontSize: 13, fontWeight: 700, cursor: "pointer" },
  btnIconAdd: { background: C.teal, color: "#fff", border: "none", borderRadius: 10, width: 42, height: 42, fontSize: 22, fontWeight: 700, cursor: "pointer", flexShrink: 0 },

  // Tags / badges
  badge: { background: C.tealLight, color: C.teal, padding: "4px 12px", borderRadius: 20, fontSize: 12, fontWeight: 600, whiteSpace: "nowrap" },
  badgeOrange: { background: C.orangeLight, color: C.orange, padding: "4px 12px", borderRadius: 20, fontSize: 12, fontWeight: 600, whiteSpace: "nowrap" },
  chip: { background: C.tealLight, color: C.teal, padding: "3px 10px", borderRadius: 8, fontSize: 12, fontWeight: 700, letterSpacing: 1.5 },

  // Misc
  divider: { height: 1, background: C.border2, margin: "12px 0" },
  error: { color: C.red, fontSize: 12, marginTop: 6 },
  label: { color: C.sub, fontSize: 11, fontWeight: 600, letterSpacing: 0.8, display: "block", marginBottom: 5 },
};

// ── ResultsPanel ───────────────────────────────────────────────────
function ResultsPanel({ votes, members, tally, mostVoted, highest, lowest }) {
  const voteValues = Object.values(votes);
  if (!voteValues.length) return null;
  return (
    <div style={{ ...s.innerBox, marginTop: 14 }}>
      <p style={{ ...s.sectionTitle, marginBottom: 10, textAlign: "center" }}>📊 Results</p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8, marginBottom: 12 }}>
        {[{ val: mostVoted, lbl: "Most Voted" }, { val: highest ?? "—", lbl: "Highest" }, { val: lowest ?? "—", lbl: "Lowest" }].map(({ val, lbl }) => (
          <div key={lbl} style={{ background: C.surface, borderRadius: 10, padding: "10px 6px", textAlign: "center", border: `1px solid ${C.border}` }}>
            <div style={{ color: C.orange, fontSize: 22, fontWeight: 800 }}>{val}</div>
            <div style={{ color: C.sub2, fontSize: 10, marginTop: 2 }}>{lbl}</div>
          </div>
        ))}
      </div>
      {Object.entries(tally).sort((a, b) => b[1] - a[1]).map(([card, count]) => (
        <div key={card} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5 }}>
          <span style={{ background: CARD_COLORS[card] || "#888", color: "#fff", width: 30, textAlign: "center", padding: "2px 4px", borderRadius: 5, fontSize: 11, fontWeight: 700, flexShrink: 0 }}>{card}</span>
          <div style={{ flex: 1, background: C.border2, borderRadius: 4, height: 14, overflow: "hidden" }}>
            <div style={{ width: `${(count / Math.max(members.length, 1)) * 100}%`, height: "100%", borderRadius: 4, background: CARD_COLORS[card] || "#888", transition: "width 0.8s ease" }} />
          </div>
          <span style={{ color: C.sub2, fontSize: 11, width: 44, textAlign: "right" }}>{count} vote{count > 1 ? "s" : ""}</span>
        </div>
      ))}
    </div>
  );
}

// ── VoteCardGrid (for SM and Observer views) ───────────────────────
function VoteCardGrid({ members, votes, revealed }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 10, justifyContent: "center" }}>
      {members.map(p => (
        <div key={p} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
          <div style={{
            width: 58, height: 82, borderRadius: 10,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: revealed && votes[p] ? (votes[p] === "Huge" ? 13 : 20) : 18,
            fontWeight: 800,
            background: revealed && votes[p] ? CARD_COLORS[votes[p]] || C.sub : C.surface2,
            color: revealed && votes[p] ? "#fff" : C.border2,
            border: `2px solid ${revealed && votes[p] ? CARD_COLORS[votes[p]] || C.sub : C.border}`,
            transition: "all 0.4s ease",
            boxShadow: revealed && votes[p] ? `0 4px 12px ${CARD_COLORS[votes[p]]}44` : "none",
          }}>
            {revealed && votes[p] ? votes[p] : "?"}
          </div>
          <span style={{ fontSize: 11, color: C.sub, maxWidth: 64, textAlign: "center", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p}</span>
          {votes[p] && !revealed && <span style={{ fontSize: 9, color: C.green }}>✓</span>}
          {!votes[p] && <span style={{ fontSize: 9, color: C.sub2 }}>…</span>}
        </div>
      ))}
    </div>
  );
}

// ── Main App ───────────────────────────────────────────────────────
export default function App() {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [view, setView] = useState("role");

  // ── GA page tracking helper ───────────────────────────────────
  const gotoView = (v) => {
    setView(v);
    if (window.gtag) {
      window.gtag('event', 'page_view', { page_title: v, page_path: '/' + v });
    }
  };

  // SM Auth
  const [authMode, setAuthMode] = useState("login");
  const [email, setEmail] = useState(""); const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState(""); const [authError, setAuthError] = useState("");
  const [guestName, setGuestName] = useState("");

  // SM Team
  const [myTeams, setMyTeams] = useState({});
  const [newTeamName, setNewTeamName] = useState("");
  const [selectedTeam, setSelectedTeam] = useState(null);
  const [newMember, setNewMember] = useState("");
  const [session, setSession] = useState({});
  const [editingStory, setEditingStory] = useState(false);
  const [storyDraft, setStoryDraft] = useState("");
  const [copied, setCopied] = useState(false);

  // Developer
  const [devCode, setDevCode] = useState(""); const [devCodeError, setDevCodeError] = useState("");
  const [devTeamData, setDevTeamData] = useState(null); const [devName, setDevName] = useState("");
  const [selectedCard, setSelectedCard] = useState(null); const [submitted, setSubmitted] = useState(false);

  // Observer
  const [obsCode, setObsCode] = useState(""); const [obsCodeError, setObsCodeError] = useState("");
  const [obsTeamData, setObsTeamData] = useState(null);

  // Quick Session
  const [quickName, setQuickName] = useState("");
  const [quickSessionId, setQuickSessionId] = useState(null);
  const [quickSession, setQuickSession] = useState({});
  const [quickParticipants, setQuickParticipants] = useState({});
  const [quickCard, setQuickCard] = useState(null);
  const [quickSubmitted, setQuickSubmitted] = useState(false);
  const [quickStory, setQuickStory] = useState("");
  const [quickEditStory, setQuickEditStory] = useState(false);
  const [quickJoinName, setQuickJoinName] = useState("");
  const [quickJoinRole, setQuickJoinRole] = useState("player"); // player | observer
  const [quickJoinError, setQuickJoinError] = useState("");
  const [quickIsHost, setQuickIsHost] = useState(false);
  const [quickIsObserver, setQuickIsObserver] = useState(false);

  // ── Hash routing ─────────────────────────────────────────────
  useEffect(() => {
    const hash = window.location.hash;
    if (hash.startsWith("#/quick/")) {
      const id = hash.replace("#/quick/", "");
      if (id) { setQuickSessionId(id); gotoView("quickJoin"); }
    }
  }, []);

  // ── Auth ──────────────────────────────────────────────────────
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u); setAuthLoading(false);
      if (u && view === "smAuth") gotoView("smDashboard");
    });
    return () => unsub();
  }, []);

  // ── SM teams ──────────────────────────────────────────────────
  useEffect(() => {
    if (view !== "smDashboard" && view !== "smSession") return;
    const smId = user ? user.uid : `guest_${guestName.trim().replace(/\s/g, "_")}`;
    if (!smId) return;
    const unsub = onValue(ref(db, `teams/${smId}`), snap => setMyTeams(snap.val() || {}));
    return () => unsub();
  }, [view, user, guestName]);

  // ── SM session ────────────────────────────────────────────────
  useEffect(() => {
    if (!selectedTeam) return;
    const unsub = onValue(ref(db, `sessions/${selectedTeam.id}`), snap => {
      const d = snap.val() || {};
      setSession(prev => { if (prev.revealed && !d.revealed) { setSelectedCard(null); setSubmitted(false); } return d; });
    });
    return () => unsub();
  }, [selectedTeam]);

  // ── Dev session ───────────────────────────────────────────────
  useEffect(() => {
    if (view !== "devSession" || !devTeamData) return;
    const unsub = onValue(ref(db, `sessions/${devTeamData.teamId}`), snap => {
      const d = snap.val() || {};
      setSession(prev => { if (prev.revealed && !d.revealed) { setSelectedCard(null); setSubmitted(false); } return d; });
    });
    return () => unsub();
  }, [view, devTeamData]);

  // ── Observer session ──────────────────────────────────────────
  useEffect(() => {
    if (view !== "obsSession" || !obsTeamData) return;
    const unsub = onValue(ref(db, `sessions/${obsTeamData.teamId}`), snap => setSession(snap.val() || {}));
    return () => unsub();
  }, [view, obsTeamData]);

  // ── Quick session ─────────────────────────────────────────────
  useEffect(() => {
    if (!quickSessionId || !["quickHost", "quickPlayer", "quickObserver", "quickJoin"].includes(view)) return;
    const unsub = onValue(ref(db, `quick/${quickSessionId}`), snap => {
      const d = snap.val() || {};
      setQuickSession(d);
      setQuickParticipants(d.participants || {});
      if (d.revealed === false && quickSubmitted) { setQuickCard(null); setQuickSubmitted(false); }
    });
    return () => unsub();
  }, [quickSessionId, view]);

  // ── Quick handlers ────────────────────────────────────────────
  const handleCreateQuickSession = async () => {
    if (!quickName.trim()) return;
    const id = generateCode() + generateCode();
    const host = quickName.trim();
    await set(ref(db, `quick/${id}`), {
      host, story: "What are we estimating?", revealed: false,
      participants: { [host]: { name: host, voted: false } }
    });
    setQuickSessionId(id); setQuickIsHost(true); setQuickIsObserver(false); setQuickJoinName(host);
    window.location.hash = `#/quick/${id}`;
    gotoView("quickHost");
  };

  const handleJoinQuickSession = async () => {
    const name = quickJoinName.trim();
    if (!name) { setQuickJoinError("Please enter your name."); return; }
    if (quickJoinRole === "observer") {
      setQuickIsObserver(true); setQuickIsHost(false);
      gotoView("quickObserver"); return;
    }
    const snap = await new Promise(res => onValue(ref(db, `quick/${quickSessionId}/participants/${name}`), res, { onlyOnce: true }));
    if (snap.val()) { setQuickJoinError("This name is already taken."); return; }
    await set(ref(db, `quick/${quickSessionId}/participants/${name}`), { name, voted: false });
    const sessSnap = await new Promise(res => onValue(ref(db, `quick/${quickSessionId}`), res, { onlyOnce: true }));
    const isHost = sessSnap.val()?.host === name;
    setQuickIsHost(isHost); setQuickIsObserver(false);
    gotoView(isHost ? "quickHost" : "quickPlayer");
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

  const copyLink = (text) => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); };

  // ── SM helpers ────────────────────────────────────────────────
  const handleAuth = async () => {
    setAuthError("");
    try {
      if (authMode === "register") {
        if (!displayName.trim()) { setAuthError("Please enter your name."); return; }
        const cred = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(cred.user, { displayName: displayName.trim() });
      } else { await signInWithEmailAndPassword(auth, email, password); }
      gotoView("smDashboard");
    } catch (e) {
      const msgs = { "auth/email-already-in-use": "Email already registered.", "auth/invalid-email": "Invalid email.", "auth/weak-password": "Min 6 characters.", "auth/invalid-credential": "Wrong email or password." };
      setAuthError(msgs[e.code] || e.message);
    }
  };
  const handleLogout = async () => { await signOut(auth); gotoView("role"); setSelectedTeam(null); setMyTeams({}); setSession({}); };
  const getSmId = () => user ? user.uid : `guest_${guestName.trim().replace(/\s/g, "_")}`;
  const getSmLabel = () => user ? (user.displayName || user.email) : guestName;
  const handleCreateTeam = async () => {
    if (!newTeamName.trim()) return;
    const code = generateCode();
    const nr = push(ref(db, `teams/${getSmId()}`));
    await set(nr, { name: newTeamName.trim(), members: {}, code });
    await set(ref(db, `codes/${code}`), { teamId: nr.key, smId: getSmId() });
    setNewTeamName("");
  };
  const handleDeleteTeam = async (tid, code) => {
    await remove(ref(db, `teams/${getSmId()}/${tid}`)); await remove(ref(db, `sessions/${tid}`));
    if (code) await remove(ref(db, `codes/${code}`));
  };
  const handleSelectTeam = (tid, td) => {
    setSelectedTeam({ id: tid, ...td }); gotoView("smSession");
    onValue(ref(db, `sessions/${tid}/revealed`), snap => {
      if (snap.val() === null) { set(ref(db, `sessions/${tid}/revealed`), false); set(ref(db, `sessions/${tid}/story`), "What are we estimating?"); }
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
    if (!c) return; setError("");
    onValue(ref(db, `codes/${c}`), snap => {
      const d = snap.val();
      if (!d) { setError("❌ Team not found."); return; }
      onValue(ref(db, `teams/${d.smId}/${d.teamId}`), ts => {
        const t = ts.val(); if (!t) { setError("❌ Not found."); return; }
        onSuccess({ teamId: d.teamId, smId: d.smId, ...t });
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

  const quickMemberList = Object.values(quickParticipants).filter(p => p.name);
  const quickVoters = quickMemberList.filter(p => p.name !== quickSession.host || !quickIsObserver);
  const quickVotes = {}; quickMemberList.forEach(p => { if (p.vote) quickVotes[p.name] = p.vote; });
  const quickVoteValues = Object.values(quickVotes);
  const quickNumeric = quickVoteValues.filter(v => v !== "Huge" && v !== "?").map(Number);
  const quickTally = quickVoteValues.reduce((acc, v) => { acc[v] = (acc[v] || 0) + 1; return acc; }, {});
  const quickMostVoted = Object.entries(quickTally).sort((a, b) => b[1] - a[1])[0]?.[0];
  const quickHighest = quickNumeric.length ? Math.max(...quickNumeric) : null;
  const quickLowest = quickNumeric.length ? Math.min(...quickNumeric) : null;
  const quickVotedCount = quickMemberList.filter(p => p.voted).length;
  const quickRevealed = quickSession.revealed || false;

  if (authLoading) return <div style={s.fullPage}><p style={{ color: C.teal, fontSize: 18 }}>🃏 Loading...</p></div>;

  // ── Shared layout wrappers ─────────────────────────────────────
  const Page = ({ children, maxW = 480 }) => (
    <div style={s.fullPage}>
      <div style={{ width: "100%", maxWidth: maxW, ...s.surface, padding: "32px 28px" }}>
        {children}
      </div>
      <p style={{ color: C.sub2, fontSize: 11, marginTop: 16 }}>Built by <span style={{ color: C.teal, fontWeight: 600 }}>Hakan</span></p>
    </div>
  );

  const SessionPage = ({ children, maxW = 960 }) => (
    <div style={{ ...s.splitPage, alignItems: "center" }}>
      <div style={{ width: "100%", maxWidth: maxW }}>
        {children}
      </div>
    </div>
  );

  // ── Top bar for sessions ───────────────────────────────────────
  const TopBar = ({ left, center, right }) => (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: C.surface, borderRadius: 12, padding: "10px 16px", marginBottom: 14, border: `1px solid ${C.border}`, gap: 10, flexWrap: "wrap", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
      <div>{left}</div>
      <div style={{ flex: 1, textAlign: "center", color: C.sub, fontSize: 13 }}>{center}</div>
      <div>{right}</div>
    </div>
  );

  // ══════════════════════════════════════════════════════════════
  // HOME
  // ══════════════════════════════════════════════════════════════
  if (view === "role") return (
    <Page>
      <div style={{ textAlign: "center", marginBottom: 24 }}>
        <div style={{ fontSize: 44, marginBottom: 6 }}>🃏</div>
        <h1 style={s.pageTitle}>Planning Poker</h1>
        <p style={{ ...s.body, marginTop: 4 }}>Sprint estimation for agile teams</p>
      </div>

      {/* Quick Session */}
      <div style={{ background: C.tealLight, borderRadius: 12, padding: "18px", marginBottom: 12, border: `1.5px solid ${C.teal}` }}>
        <p style={{ color: C.teal, fontWeight: 700, fontSize: 15, marginBottom: 4 }}>⚡ Quick Session</p>
        <p style={{ color: C.sub, fontSize: 12, marginBottom: 12 }}>Create instantly, share link, start estimating.</p>
        <input style={s.input} placeholder="Your name" value={quickName} autoFocus
          onChange={e => setQuickName(e.target.value)}
          onKeyDown={e => e.key === "Enter" && quickName.trim() && handleCreateQuickSession()} />
        <button className="btn-hover" style={{ ...s.btnOrange, marginTop: 10, opacity: quickName.trim() ? 1 : 0.45 }}
          onClick={handleCreateQuickSession} disabled={!quickName.trim()}>
          Create Session & Get Link →
        </button>
      </div>

      <button className="btn-hover" style={s.btnOutline} onClick={() => gotoView("teamMode")}>👥 Team Session (Advanced)</button>
      <button className="btn-hover" style={{ ...s.btnGhost, marginTop: 8 }} onClick={() => gotoView("howTo")}>❓ How does this work?</button>
    </Page>
  );

  // ══════════════════════════════════════════════════════════════
  // QUICK JOIN
  // ══════════════════════════════════════════════════════════════
  if (view === "quickJoin") return (
    <Page>
      <div style={{ textAlign: "center", marginBottom: 20 }}>
        <div style={{ fontSize: 36, marginBottom: 6 }}>⚡</div>
        <h1 style={{ ...s.pageTitle, fontSize: 22 }}>You're invited!</h1>
        <p style={{ ...s.body, marginTop: 4 }}>Enter your name and choose how to join</p>
      </div>

      <div style={{ marginBottom: 14 }}>
        <label style={s.label}>YOUR NAME</label>
        <input style={s.input} placeholder="e.g. Mehmet" value={quickJoinName}
          onChange={e => { setQuickJoinName(e.target.value); setQuickJoinError(""); }} autoFocus
          onKeyDown={e => e.key === "Enter" && handleJoinQuickSession()} />
        {quickJoinError && <p style={s.error}>{quickJoinError}</p>}
      </div>

      <div style={{ marginBottom: 16 }}>
        <label style={s.label}>JOIN AS</label>
        <div style={{ display: "flex", gap: 8 }}>
          {[
            { val: "player", icon: "👨‍💻", label: "Participant", desc: "Vote on stories" },
            { val: "observer", icon: "👁️", label: "Observer", desc: "Watch & see results" },
          ].map(opt => (
            <button key={opt.val} onClick={() => setQuickJoinRole(opt.val)} style={{
              flex: 1, padding: "12px 8px", borderRadius: 10, cursor: "pointer", textAlign: "center",
              border: `2px solid ${quickJoinRole === opt.val ? C.teal : C.border2}`,
              background: quickJoinRole === opt.val ? C.tealLight : C.surface,
              transition: "all 0.15s",
            }}>
              <div style={{ fontSize: 20, marginBottom: 3 }}>{opt.icon}</div>
              <div style={{ color: quickJoinRole === opt.val ? C.teal : C.text, fontWeight: 700, fontSize: 13 }}>{opt.label}</div>
              <div style={{ color: C.sub2, fontSize: 11 }}>{opt.desc}</div>
            </button>
          ))}
        </div>
      </div>

      <button className="btn-hover" style={{ ...s.btnPrimary, opacity: quickJoinName.trim() ? 1 : 0.45 }}
        onClick={handleJoinQuickSession} disabled={!quickJoinName.trim()}>
        Join Session →
      </button>
      <button className="btn-hover" style={{ ...s.btnGhost, marginTop: 8 }}
        onClick={() => { window.location.hash = ""; gotoView("role"); }}>← Home</button>
    </Page>
  );

  // ══════════════════════════════════════════════════════════════
  // QUICK HOST
  // ══════════════════════════════════════════════════════════════
  if (view === "quickHost") return (
    <SessionPage>
      <TopBar
        left={<span style={s.badge}>⚡ Host: {quickJoinName}</span>}
        center={
          quickEditStory
            ? <input autoFocus style={{ ...s.input, fontSize: 13, padding: "6px 10px" }} value={quickStory}
                onChange={e => setQuickStory(e.target.value)}
                onBlur={() => { update(ref(db, `quick/${quickSessionId}`), { story: quickStory }); setQuickEditStory(false); }}
                onKeyDown={e => e.key === "Enter" && (update(ref(db, `quick/${quickSessionId}`), { story: quickStory }), setQuickEditStory(false))} />
            : <span onClick={() => { setQuickStory(quickSession.story || ""); setQuickEditStory(true); }} style={{ cursor: "pointer" }}>
                📋 {quickSession.story || "Click to set story"} ✏️
              </span>
        }
        right={<span style={s.badgeOrange}>{quickVotedCount}/{quickMemberList.length} voted</span>}
      />

      <div style={{ display: "grid", gridTemplateColumns: "1fr 240px", gap: 14 }}>
        {/* Left: participants + controls */}
        <div style={{ ...s.surface, padding: "16px" }}>
          {/* Share link */}
          <div style={{ background: C.tealLight, borderRadius: 10, padding: "12px 14px", marginBottom: 14, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
            <div>
              <p style={{ ...s.sectionTitle, marginBottom: 2 }}>Session Link</p>
              <p style={{ color: C.sub, fontSize: 11, wordBreak: "break-all" }}>{getBaseUrl()}/#/quick/{quickSessionId}</p>
            </div>
            <button onClick={() => copyLink(`${getBaseUrl()}/#/quick/${quickSessionId}`)}
              style={{ ...s.btnSmall, background: copied ? C.green : C.teal, flexShrink: 0, fontSize: 12 }}>
              {copied ? "✓ Copied!" : "Copy"}
            </button>
          </div>

          {/* Vote cards */}
          <VoteCardGrid members={quickMemberList.map(p => p.name)} votes={quickVotes} revealed={quickRevealed} />

          <div style={{ display: "flex", justifyContent: "center", marginTop: 14, gap: 10 }}>
            {!quickRevealed
              ? <button className="btn-hover" style={{ ...s.btnPrimary, width: "auto", padding: "10px 28px" }} onClick={handleQuickReveal}>🃏 Reveal Votes</button>
              : <button className="btn-hover" style={{ ...s.btnOrange, width: "auto", padding: "10px 28px" }} onClick={handleQuickNewRound}>🔄 New Round</button>
            }
          </div>

          {quickRevealed && quickVoteValues.length > 0 && (
            <ResultsPanel votes={quickVotes} members={quickMemberList} tally={quickTally}
              mostVoted={quickMostVoted} highest={quickHighest} lowest={quickLowest} />
          )}
        </div>

        {/* Right: host votes */}
        <div style={{ ...s.surface, padding: "16px" }}>
          <p style={{ ...s.sectionTitle, marginBottom: 10 }}>🃏 Your Vote</p>
          {quickSubmitted ? (
            <div style={{ background: C.greenLight, borderRadius: 8, padding: "10px", textAlign: "center" }}>
              <p style={{ color: C.green, fontWeight: 700 }}>Voted: {quickCard}</p>
            </div>
          ) : quickRevealed ? (
            <p style={{ color: C.sub2, fontSize: 12, textAlign: "center" }}>Next round starting...</p>
          ) : (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 6, marginBottom: 10 }}>
                {CARDS.map(card => (
                  <button key={card} className="btn-hover" onClick={() => setQuickCard(card)} style={{
                    padding: "9px 4px", borderRadius: 8, cursor: "pointer", fontWeight: 700, fontSize: 13, textAlign: "center",
                    border: `2px solid ${quickCard === card ? CARD_COLORS[card] : C.border2}`,
                    background: quickCard === card ? CARD_COLORS[card] : C.surface2,
                    color: quickCard === card ? "#fff" : C.text, transition: "all 0.15s",
                  }}>{card}</button>
                ))}
              </div>
              <button className="btn-hover" style={{ ...s.btnPrimary, opacity: quickCard ? 1 : 0.4 }}
                onClick={handleQuickVote} disabled={!quickCard}>Submit</button>
            </>
          )}
        </div>
      </div>
    </SessionPage>
  );

  // ══════════════════════════════════════════════════════════════
  // QUICK PLAYER
  // ══════════════════════════════════════════════════════════════
  if (view === "quickPlayer") return (
    <SessionPage maxW={700}>
      <TopBar
        left={<span style={s.badge}>⚡ {quickJoinName}</span>}
        center={<span>📋 {quickSession.story || "Waiting for story..."}</span>}
        right={<span style={s.badgeOrange}>{quickVotedCount}/{quickMemberList.length} voted</span>}
      />

      <div style={{ display: "grid", gridTemplateColumns: "1fr 200px", gap: 14 }}>
        {/* Cards */}
        <div style={{ ...s.surface, padding: "16px" }}>
          {quickRevealed ? (
            <div style={{ background: C.tealLight, borderRadius: 8, padding: "10px 14px", textAlign: "center", marginBottom: 12 }}>
              <p style={{ color: C.teal, fontWeight: 700 }}>🃏 Host revealed the votes!</p>
            </div>
          ) : quickSubmitted ? (
            <div style={{ background: C.greenLight, borderRadius: 8, padding: "10px 14px", textAlign: "center", marginBottom: 12 }}>
              <p style={{ color: C.green, fontWeight: 700 }}>✅ Submitted! Waiting for reveal...</p>
            </div>
          ) : (
            <p style={{ color: C.sub, fontSize: 13, marginBottom: 12, textAlign: "center" }}>Pick your estimate</p>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10 }}>
            {CARDS.map(card => (
              <button key={card} className={!quickSubmitted && !quickRevealed ? "card-hover" : ""}
                onClick={() => !quickSubmitted && !quickRevealed && setQuickCard(card)}
                disabled={quickSubmitted || quickRevealed}
                style={{
                  aspectRatio: "2/3", borderRadius: 10, cursor: quickSubmitted || quickRevealed ? "default" : "pointer",
                  border: `2px solid ${quickCard === card ? CARD_COLORS[card] : C.border2}`,
                  background: quickCard === card ? CARD_COLORS[card] : C.surface2,
                  color: quickCard === card ? "#fff" : C.text, fontWeight: 800, fontSize: 20,
                  display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                  opacity: (quickSubmitted || quickRevealed) && quickCard !== card ? 0.35 : 1,
                  transform: quickCard === card ? "translateY(-6px) scale(1.04)" : "none",
                  transition: "all 0.15s", boxShadow: quickCard === card ? `0 6px 18px ${CARD_COLORS[card]}44` : "none",
                }}>
                {card}
                {card === "?" && <span style={{ fontSize: 9, opacity: 0.6, marginTop: 2 }}>unsure</span>}
              </button>
            ))}
          </div>

          {!quickSubmitted && !quickRevealed && (
            <button className="btn-hover" style={{ ...s.btnPrimary, marginTop: 12, opacity: quickCard ? 1 : 0.4 }}
              onClick={handleQuickVote} disabled={!quickCard}>Submit Vote 🚀</button>
          )}

          {quickRevealed && quickVoteValues.length > 0 && (
            <ResultsPanel votes={quickVotes} members={quickMemberList} tally={quickTally}
              mostVoted={quickMostVoted} highest={quickHighest} lowest={quickLowest} />
          )}
        </div>

        {/* Who voted */}
        <div style={{ ...s.surface, padding: "14px" }}>
          <p style={{ ...s.sectionTitle, marginBottom: 10 }}>👥 Participants</p>
          {quickMemberList.map(p => (
            <div key={p.name} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <div style={{ width: 30, height: 30, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 12, background: p.voted ? C.teal : C.tealLight, color: p.voted ? "#fff" : C.teal, border: p.name === quickJoinName ? `2px solid ${C.orange}` : "2px solid transparent", transition: "all 0.3s" }}>
                {quickRevealed && p.vote ? p.vote : p.voted ? "✓" : "?"}
              </div>
              <div>
                <p style={{ color: p.name === quickJoinName ? C.orange : C.text, fontSize: 12, fontWeight: p.name === quickJoinName ? 700 : 400 }}>{p.name}</p>
                {p.name === quickSession.host && <p style={{ color: C.teal, fontSize: 9 }}>host</p>}
              </div>
            </div>
          ))}
        </div>
      </div>
    </SessionPage>
  );

  // ══════════════════════════════════════════════════════════════
  // QUICK OBSERVER
  // ══════════════════════════════════════════════════════════════
  if (view === "quickObserver") return (
    <SessionPage maxW={700}>
      <TopBar
        left={<span style={{ ...s.badge, background: "#EDE9FE", color: "#7C3AED" }}>👁️ Observer</span>}
        center={<span>📋 {quickSession.story || "Waiting for story..."}</span>}
        right={<span style={s.badgeOrange}>{quickVotedCount}/{quickMemberList.length} voted</span>}
      />

      <div style={{ display: "grid", gridTemplateColumns: "1fr 200px", gap: 14 }}>
        <div style={{ ...s.surface, padding: "16px" }}>
          {!quickRevealed ? (
            <div style={{ background: C.tealLight, borderRadius: 8, padding: "10px 14px", textAlign: "center", marginBottom: 12 }}>
              <p style={{ color: C.teal }}>⏳ Waiting for host to reveal votes...</p>
            </div>
          ) : (
            <div style={{ background: C.greenLight, borderRadius: 8, padding: "10px 14px", textAlign: "center", marginBottom: 12 }}>
              <p style={{ color: C.green, fontWeight: 700 }}>🃏 Votes revealed!</p>
            </div>
          )}

          <VoteCardGrid members={quickMemberList.map(p => p.name)} votes={quickVotes} revealed={quickRevealed} />

          {quickRevealed && quickVoteValues.length > 0 && (
            <ResultsPanel votes={quickVotes} members={quickMemberList} tally={quickTally}
              mostVoted={quickMostVoted} highest={quickHighest} lowest={quickLowest} />
          )}
        </div>

        <div style={{ ...s.surface, padding: "14px" }}>
          <p style={{ ...s.sectionTitle, marginBottom: 10 }}>👥 Participants</p>
          {quickMemberList.map(p => (
            <div key={p.name} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <div style={{ width: 30, height: 30, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 12, background: p.voted ? C.teal : C.tealLight, color: p.voted ? "#fff" : C.teal, transition: "all 0.3s" }}>
                {quickRevealed && p.vote ? p.vote : p.voted ? "✓" : "?"}
              </div>
              <div>
                <p style={{ color: C.text, fontSize: 12 }}>{p.name}</p>
                {p.name === quickSession.host && <p style={{ color: C.teal, fontSize: 9 }}>host</p>}
              </div>
            </div>
          ))}
        </div>
      </div>
    </SessionPage>
  );

  // ══════════════════════════════════════════════════════════════
  // TEAM MODE
  // ══════════════════════════════════════════════════════════════
  if (view === "teamMode") return (
    <Page>
      <div style={{ textAlign: "center", marginBottom: 20 }}>
        <div style={{ fontSize: 36, marginBottom: 6 }}>👥</div>
        <h1 style={{ ...s.pageTitle, fontSize: 22 }}>Team Session</h1>
        <p style={{ ...s.body, marginTop: 4 }}>Permanent teams, recurring sprints</p>
      </div>
      <button className="btn-hover" style={s.btnPrimary} onClick={() => gotoView("smMode")}>🎯 Scrum Master</button>
      <button className="btn-hover" style={{ ...s.btnOutline, marginTop: 10 }} onClick={() => gotoView("devJoin")}>👨‍💻 Developer</button>
      <button className="btn-hover" style={{ ...s.btnGhost, marginTop: 8, color: "#7C3AED", borderColor: "#DDD6FE" }} onClick={() => gotoView("obsJoin")}>👁️ Observer</button>
      <button className="btn-hover" style={{ ...s.btnGhost, marginTop: 8 }} onClick={() => gotoView("role")}>← Back</button>
    </Page>
  );

  // ══════════════════════════════════════════════════════════════
  // HOW TO
  // ══════════════════════════════════════════════════════════════
  if (view === "howTo") return (
    <div style={s.fullPage}>
      <div style={{ width: "100%", maxWidth: 560, ...s.surface, padding: "28px 28px" }}>
        <div style={{ textAlign: "center", marginBottom: 20 }}>
          <div style={{ fontSize: 36, marginBottom: 6 }}>📖</div>
          <h1 style={{ ...s.pageTitle, fontSize: 22 }}>How to Use Planning Poker</h1>
        </div>

        {[
          { color: C.orange, title: "⚡ Quick Session — Easiest", steps: ["Enter your name → Create Session → get a link.", "Share the link via chat. Everyone clicks it and enters their name.", "Choose to join as Participant (vote) or Observer (watch only).", "Host sets the story, everyone picks a card, host reveals.", "New Round resets everything for the next story."] },
          { color: C.teal, title: "🎯 Scrum Master (Team Session)", steps: ["Choose Guest or Account (recommended for recurring teams).", "Create a team, add developers by name.", "Share the 6-digit code with your team.", "Open session → set story → wait for votes → reveal."] },
          { color: "#2563EB", title: "👨‍💻 Developer", steps: ["Enter the 6-digit code from your SM.", "Select your name and join.", "Pick a card — hidden until SM reveals."] },
          { color: "#7C3AED", title: "👁️ Observer", steps: ["Same 6-digit code, no voting.", "Watch votes and see results when revealed."] },
        ].map(sec => (
          <div key={sec.title} style={{ ...s.innerBox, marginBottom: 10 }}>
            <p style={{ color: sec.color, fontWeight: 700, fontSize: 14, marginBottom: 8 }}>{sec.title}</p>
            {sec.steps.map((step, i) => (
              <div key={i} style={{ display: "flex", gap: 8, marginBottom: 5 }}>
                <span style={{ color: sec.color, fontWeight: 700, fontSize: 12, flexShrink: 0, width: 16 }}>{i + 1}.</span>
                <p style={{ color: C.sub, fontSize: 12, lineHeight: 1.5 }}>{step}</p>
              </div>
            ))}
          </div>
        ))}

        <div style={{ ...s.innerBox, marginBottom: 16 }}>
          <p style={{ color: C.green, fontWeight: 700, fontSize: 14, marginBottom: 8 }}>🃏 Cards</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
            {CARDS.map(c => <span key={c} style={{ background: CARD_COLORS[c], color: "#fff", borderRadius: 6, padding: "3px 9px", fontSize: 12, fontWeight: 700 }}>{c}</span>)}
          </div>
          <p style={{ color: C.sub, fontSize: 12 }}><strong>Huge</strong> = too big, break it down. <strong style={{ color: "#6366F1" }}>?</strong> = unsure, needs discussion.</p>
        </div>

        <button className="btn-hover" style={s.btnPrimary} onClick={() => gotoView("role")}>← Back to Home</button>
      </div>
    </div>
  );

  // ══════════════════════════════════════════════════════════════
  // SM MODE
  // ══════════════════════════════════════════════════════════════
  if (view === "smMode") return (
    <Page>
      <div style={{ textAlign: "center", marginBottom: 20 }}>
        <div style={{ fontSize: 36, marginBottom: 4 }}>🎯</div>
        <h1 style={{ ...s.pageTitle, fontSize: 22 }}>Scrum Master</h1>
      </div>
      <div style={{ ...s.innerBox, marginBottom: 10 }}>
        <p style={{ color: C.text, fontWeight: 700, marginBottom: 4 }}>👤 Guest — No account</p>
        <p style={{ color: C.sub, fontSize: 12, marginBottom: 10 }}>Quick access. Teams lost on browser close.</p>
        <input style={s.input} placeholder="Your name" value={guestName}
          onChange={e => setGuestName(e.target.value)}
          onKeyDown={e => e.key === "Enter" && guestName.trim() && gotoView("smDashboard")} />
        <button className="btn-hover" style={{ ...s.btnOrange, marginTop: 10, opacity: guestName.trim() ? 1 : 0.4 }}
          onClick={() => guestName.trim() && gotoView("smDashboard")} disabled={!guestName.trim()}>
          Continue as Guest →
        </button>
      </div>
      <div style={s.innerBox}>
        <p style={{ color: C.text, fontWeight: 700, marginBottom: 4 }}>🔐 Account</p>
        <p style={{ color: C.sub, fontSize: 12, marginBottom: 10 }}>Teams saved permanently.</p>
        <button className="btn-hover" style={s.btnPrimary} onClick={() => gotoView("smAuth")}>Sign In / Register →</button>
      </div>
      <button className="btn-hover" style={{ ...s.btnGhost, marginTop: 10 }} onClick={() => gotoView("teamMode")}>← Back</button>
    </Page>
  );

  // ══════════════════════════════════════════════════════════════
  // SM AUTH
  // ══════════════════════════════════════════════════════════════
  if (view === "smAuth") return (
    <Page>
      <div style={{ textAlign: "center", marginBottom: 20 }}>
        <div style={{ fontSize: 36, marginBottom: 4 }}>🔐</div>
        <h1 style={{ ...s.pageTitle, fontSize: 22 }}>Account</h1>
      </div>
      <div style={{ display: "flex", background: C.surface2, borderRadius: 10, padding: 3, marginBottom: 16, border: `1px solid ${C.border}` }}>
        {["login", "register"].map(m => (
          <button key={m} onClick={() => { setAuthMode(m); setAuthError(""); }} style={{
            flex: 1, padding: "9px 0", borderRadius: 8, border: "none",
            background: authMode === m ? C.teal : "transparent",
            color: authMode === m ? "#fff" : C.sub, fontWeight: authMode === m ? 700 : 400, cursor: "pointer", fontSize: 13, transition: "all 0.15s",
          }}>{m === "login" ? "Sign In" : "Register"}</button>
        ))}
      </div>
      {authMode === "register" && <><label style={s.label}>YOUR NAME</label><input style={{ ...s.input, marginBottom: 10 }} placeholder="e.g. Hakan" value={displayName} onChange={e => setDisplayName(e.target.value)} /></>}
      <label style={s.label}>EMAIL</label>
      <input style={{ ...s.input, marginBottom: 10 }} type="email" placeholder="you@company.com" value={email} onChange={e => setEmail(e.target.value)} onKeyDown={e => e.key === "Enter" && handleAuth()} />
      <label style={s.label}>PASSWORD</label>
      <input style={{ ...s.input, marginBottom: 6 }} type="password" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key === "Enter" && handleAuth()} />
      {authError && <p style={s.error}>❌ {authError}</p>}
      <button className="btn-hover" style={{ ...s.btnPrimary, marginTop: 10 }} onClick={handleAuth}>{authMode === "login" ? "Sign In →" : "Create Account →"}</button>
      <button className="btn-hover" style={{ ...s.btnGhost, marginTop: 8 }} onClick={() => gotoView("smMode")}>← Back</button>
    </Page>
  );

  // ══════════════════════════════════════════════════════════════
  // SM DASHBOARD
  // ══════════════════════════════════════════════════════════════
  if (view === "smDashboard") return (
    <SessionPage maxW={640}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <span style={s.badge}>🎯 {getSmLabel()}</span>
        <h1 style={{ ...s.pageTitle, fontSize: 20 }}>My Teams</h1>
        {user
          ? <button className="btn-hover" onClick={handleLogout} style={{ background: "transparent", border: `1px solid ${C.border2}`, color: C.sub, borderRadius: 8, padding: "5px 12px", cursor: "pointer", fontSize: 12 }}>Sign Out</button>
          : <button className="btn-hover" onClick={() => gotoView("teamMode")} style={{ background: "transparent", border: `1px solid ${C.border2}`, color: C.sub, borderRadius: 8, padding: "5px 12px", cursor: "pointer", fontSize: 12 }}>Exit</button>
        }
      </div>
      <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
        <input style={{ ...s.input, flex: 1 }} placeholder="New team name..." value={newTeamName}
          onChange={e => setNewTeamName(e.target.value)} onKeyDown={e => e.key === "Enter" && handleCreateTeam()} />
        <button onClick={handleCreateTeam} style={{ ...s.btnIconAdd }}>+</button>
      </div>
      <div style={{ ...s.surface, overflow: "hidden" }}>
        {Object.keys(myTeams).length === 0 ? (
          <div style={{ padding: "32px", textAlign: "center", color: C.sub }}>
            <p style={{ fontSize: 28, marginBottom: 8 }}>🏗️</p><p>No teams yet. Create one above!</p>
          </div>
        ) : Object.entries(myTeams).map(([tid, team], i, arr) => (
          <div key={tid} className="team-row" style={{ display: "flex", alignItems: "center", padding: "14px 16px", borderBottom: i < arr.length - 1 ? `1px solid ${C.border2}` : "none", cursor: "pointer", transition: "background 0.15s" }}>
            <div style={{ flex: 1 }} onClick={() => handleSelectTeam(tid, team)}>
              <p style={{ color: C.text, fontWeight: 700, fontSize: 14 }}>{team.name}</p>
              <p style={{ color: C.sub2, fontSize: 11, marginTop: 2 }}>{Object.keys(team.members || {}).length} members</p>
            </div>
            <span style={{ ...s.chip, marginRight: 12 }}>{team.code}</span>
            <button className="btn-hover" style={{ ...s.btnSmall, fontSize: 12, padding: "6px 14px", marginRight: 8 }} onClick={() => handleSelectTeam(tid, team)}>Open</button>
            <button onClick={() => handleDeleteTeam(tid, team.code)} style={{ background: "transparent", border: "none", color: C.sub2, cursor: "pointer", fontSize: 18, padding: "2px 6px" }}
              onMouseEnter={e => e.target.style.color = C.red} onMouseLeave={e => e.target.style.color = C.sub2}>✕</button>
          </div>
        ))}
      </div>
    </SessionPage>
  );

  // ══════════════════════════════════════════════════════════════
  // SM SESSION
  // ══════════════════════════════════════════════════════════════
  if (view === "smSession" && selectedTeam) return (
    <SessionPage>
      <TopBar
        left={<button onClick={() => gotoView("smDashboard")} style={{ background: "transparent", border: "none", color: C.teal, cursor: "pointer", fontSize: 13, fontWeight: 600 }}>← Teams</button>}
        center={editingStory
          ? <input autoFocus style={{ ...s.input, fontSize: 13, padding: "6px 10px" }} value={storyDraft} onChange={e => setStoryDraft(e.target.value)}
              onBlur={() => { update(ref(db, `sessions/${selectedTeam.id}`), { story: storyDraft }); setEditingStory(false); }}
              onKeyDown={e => e.key === "Enter" && (update(ref(db, `sessions/${selectedTeam.id}`), { story: storyDraft }), setEditingStory(false))} />
          : <span onClick={() => { setStoryDraft(story); setEditingStory(true); }} style={{ cursor: "pointer" }}>📋 {story} ✏️</span>
        }
        right={<span style={s.badgeOrange}>{votedCount}/{currentMembers.length} voted</span>}
      />

      <div style={{ display: "grid", gridTemplateColumns: "1fr 260px", gap: 14 }}>
        <div style={{ ...s.surface, padding: "16px" }}>
          {/* Code */}
          <div style={{ background: C.tealLight, borderRadius: 10, padding: "10px 14px", marginBottom: 14, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <p style={{ ...s.sectionTitle, marginBottom: 2 }}>Team Code</p>
              <span style={{ color: C.teal, fontSize: 22, fontWeight: 800, letterSpacing: 5 }}>{selectedTeam.code}</span>
            </div>
            <button onClick={() => copyLink(selectedTeam.code)}
              style={{ ...s.btnSmall, background: copied ? C.green : C.teal, fontSize: 12 }}>
              {copied ? "✓ Copied!" : "Copy"}
            </button>
          </div>

          <VoteCardGrid members={currentMembers} votes={votes} revealed={revealed} />

          <div style={{ display: "flex", justifyContent: "center", marginTop: 14, gap: 10 }}>
            {!revealed
              ? <button className="btn-hover" style={{ ...s.btnPrimary, width: "auto", padding: "10px 28px" }} onClick={() => update(ref(db, `sessions/${selectedTeam.id}`), { revealed: true })}>🃏 Reveal Votes</button>
              : <button className="btn-hover" style={{ ...s.btnOrange, width: "auto", padding: "10px 28px" }} onClick={async () => { await set(ref(db, `sessions/${selectedTeam.id}/votes`), null); await set(ref(db, `sessions/${selectedTeam.id}/revealed`), false); }}>🔄 New Round</button>
            }
          </div>

          {revealed && voteValues.length > 0 && (
            <ResultsPanel votes={votes} members={currentMembers} tally={tally} mostVoted={mostVoted} highest={highest} lowest={lowest} />
          )}
        </div>

        {/* Members sidebar */}
        <div style={{ ...s.surface, padding: "16px" }}>
          <p style={{ ...s.sectionTitle, marginBottom: 10 }}>👥 Team Members</p>
          <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
            <input style={{ ...s.input, flex: 1, fontSize: 13, padding: "9px 12px" }} placeholder="Add member..."
              value={newMember} onChange={e => setNewMember(e.target.value)} onKeyDown={e => e.key === "Enter" && handleAddMember()} />
            <button onClick={handleAddMember} style={{ ...s.btnIconAdd, width: 38, height: 38, fontSize: 20 }}>+</button>
          </div>
          {currentMembers.length === 0
            ? <p style={{ color: C.sub2, fontSize: 12, textAlign: "center", padding: "12px 0" }}>No members yet.</p>
            : currentMembers.map(p => (
              <div key={p} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: C.surface2, borderRadius: 8, padding: "8px 10px", marginBottom: 6, border: `1px solid ${C.border}` }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ width: 24, height: 24, borderRadius: "50%", background: votes[p] ? C.teal : C.tealLight, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, color: votes[p] ? "#fff" : C.teal }}>
                    {votes[p] ? "✓" : "?"}
                  </div>
                  <span style={{ color: C.text, fontSize: 13 }}>{p}</span>
                </div>
                <button onClick={() => handleRemoveMember(p)} style={{ background: "transparent", border: "none", color: C.sub2, cursor: "pointer", fontSize: 16, padding: "2px 6px" }}
                  onMouseEnter={e => e.target.style.color = C.red} onMouseLeave={e => e.target.style.color = C.sub2}>✕</button>
              </div>
            ))
          }
        </div>
      </div>
    </SessionPage>
  );

  // ══════════════════════════════════════════════════════════════
  // DEV JOIN
  // ══════════════════════════════════════════════════════════════
  if (view === "devJoin") return (
    <Page>
      <div style={{ textAlign: "center", marginBottom: 20 }}>
        <div style={{ fontSize: 36, marginBottom: 4 }}>👨‍💻</div>
        <h1 style={{ ...s.pageTitle, fontSize: 22 }}>Developer</h1>
        <p style={{ ...s.body, marginTop: 4 }}>Enter your team code to join</p>
      </div>
      <label style={s.label}>TEAM CODE</label>
      <div style={{ display: "flex", gap: 8, marginBottom: 6 }}>
        <input style={{ ...s.input, flex: 1, textTransform: "uppercase", letterSpacing: 4, fontSize: 18, textAlign: "center" }}
          placeholder="ABC123" maxLength={6} value={devCode}
          onChange={e => { setDevCode(e.target.value.toUpperCase()); setDevCodeError(""); setDevTeamData(null); setDevName(""); }}
          onKeyDown={e => e.key === "Enter" && lookupTeam(devCode, setDevTeamData, setDevCodeError)} />
        <button onClick={() => lookupTeam(devCode, setDevTeamData, setDevCodeError)} style={s.btnSmall}>Find</button>
      </div>
      {devCodeError && <p style={s.error}>{devCodeError}</p>}
      {devTeamData && (
        <>
          <div style={{ ...s.innerBox, marginTop: 10, marginBottom: 12 }}>
            <p style={{ color: C.green, fontSize: 12, marginBottom: 2 }}>✓ Team found!</p>
            <p style={{ color: C.text, fontWeight: 700 }}>{devTeamData.name}</p>
          </div>
          <label style={s.label}>SELECT YOUR NAME</label>
          <select style={{ ...s.input, marginBottom: 4, cursor: "pointer" }} value={devName} onChange={e => setDevName(e.target.value)}>
            <option value="">— Choose your name —</option>
            {Object.keys(devTeamData.members || {}).map(n => <option key={n} value={n}>{n}</option>)}
          </select>
        </>
      )}
      <button className="btn-hover" style={{ ...s.btnPrimary, marginTop: 12, opacity: devTeamData && devName ? 1 : 0.4 }}
        onClick={() => {
          if (!devTeamData || !devName) return;
          onValue(ref(db, `sessions/${devTeamData.teamId}/revealed`), snap => {
            if (snap.val() === null) { set(ref(db, `sessions/${devTeamData.teamId}/revealed`), false); set(ref(db, `sessions/${devTeamData.teamId}/story`), "What are we estimating?"); }
          }, { onlyOnce: true });
          gotoView("devSession");
        }} disabled={!devTeamData || !devName}>Join Session →</button>
      <button className="btn-hover" style={{ ...s.btnGhost, marginTop: 8 }} onClick={() => gotoView("teamMode")}>← Back</button>
    </Page>
  );

  // ══════════════════════════════════════════════════════════════
  // DEV SESSION
  // ══════════════════════════════════════════════════════════════
  if (view === "devSession" && devTeamData) return (
    <SessionPage maxW={760}>
      <TopBar
        left={<span style={s.badge}>👨‍💻 {devName}</span>}
        center={<span>📋 {story}</span>}
        right={<span style={s.badgeOrange}>{votedCount}/{devMembers.length} voted</span>}
      />

      <div style={{ display: "grid", gridTemplateColumns: "1fr 200px", gap: 14 }}>
        <div style={{ ...s.surface, padding: "16px" }}>
          {revealed
            ? <div style={{ background: C.tealLight, borderRadius: 8, padding: "10px 14px", textAlign: "center", marginBottom: 12 }}><p style={{ color: C.teal, fontWeight: 700 }}>🃏 Scrum Master revealed the votes!</p></div>
            : submitted
              ? <div style={{ background: C.greenLight, borderRadius: 8, padding: "10px 14px", textAlign: "center", marginBottom: 12 }}><p style={{ color: C.green, fontWeight: 700 }}>✅ Submitted! Waiting for reveal...</p></div>
              : <p style={{ color: C.sub, fontSize: 13, textAlign: "center", marginBottom: 12 }}>Pick your estimate</p>
          }

          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10 }}>
            {CARDS.map(card => (
              <button key={card} className={!submitted && !revealed ? "card-hover" : ""}
                onClick={() => !submitted && !revealed && setSelectedCard(card)}
                disabled={submitted || revealed}
                style={{
                  aspectRatio: "2/3", borderRadius: 10,
                  border: `2px solid ${selectedCard === card ? CARD_COLORS[card] : C.border2}`,
                  background: selectedCard === card ? CARD_COLORS[card] : C.surface2,
                  color: selectedCard === card ? "#fff" : C.text,
                  fontWeight: 800, fontSize: 20, cursor: submitted || revealed ? "default" : "pointer",
                  display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                  opacity: (submitted || revealed) && selectedCard !== card ? 0.35 : 1,
                  transform: selectedCard === card ? "translateY(-6px) scale(1.04)" : "none",
                  transition: "all 0.15s", boxShadow: selectedCard === card ? `0 6px 18px ${CARD_COLORS[card]}44` : "none",
                }}>
                {card}
                {card === "?" && <span style={{ fontSize: 9, opacity: 0.6, marginTop: 2 }}>unsure</span>}
              </button>
            ))}
          </div>

          {!submitted && !revealed && (
            <button className="btn-hover" style={{ ...s.btnPrimary, marginTop: 12, opacity: selectedCard ? 1 : 0.4 }}
              onClick={async () => { await set(ref(db, `sessions/${devTeamData.teamId}/votes/${devName}`), selectedCard); setSubmitted(true); }}
              disabled={!selectedCard}>Submit Vote 🚀</button>
          )}

          {revealed && voteValues.length > 0 && (
            <ResultsPanel votes={votes} members={devMembers} tally={tally} mostVoted={mostVoted} highest={highest} lowest={lowest} />
          )}
        </div>

        <div style={{ ...s.surface, padding: "14px" }}>
          <p style={{ ...s.sectionTitle, marginBottom: 10 }}>👥 Team</p>
          {devMembers.map(p => (
            <div key={p} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <div style={{ width: 30, height: 30, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 12, background: votes[p] ? C.teal : C.tealLight, color: votes[p] ? "#fff" : C.teal, border: p === devName ? `2px solid ${C.orange}` : "2px solid transparent", transition: "all 0.3s" }}>
                {revealed && votes[p] ? votes[p] : votes[p] ? "✓" : "?"}
              </div>
              <span style={{ color: p === devName ? C.orange : C.text, fontSize: 12, fontWeight: p === devName ? 700 : 400 }}>{p}</span>
            </div>
          ))}
        </div>
      </div>
    </SessionPage>
  );

  // ══════════════════════════════════════════════════════════════
  // OBSERVER JOIN
  // ══════════════════════════════════════════════════════════════
  if (view === "obsJoin") return (
    <Page>
      <div style={{ textAlign: "center", marginBottom: 20 }}>
        <div style={{ fontSize: 36, marginBottom: 4 }}>👁️</div>
        <h1 style={{ ...s.pageTitle, fontSize: 22 }}>Observer</h1>
        <p style={{ ...s.body, marginTop: 4 }}>Watch the session, no voting</p>
      </div>
      <label style={s.label}>TEAM CODE</label>
      <div style={{ display: "flex", gap: 8, marginBottom: 6 }}>
        <input style={{ ...s.input, flex: 1, textTransform: "uppercase", letterSpacing: 4, fontSize: 18, textAlign: "center" }}
          placeholder="ABC123" maxLength={6} value={obsCode}
          onChange={e => { setObsCode(e.target.value.toUpperCase()); setObsCodeError(""); setObsTeamData(null); }}
          onKeyDown={e => e.key === "Enter" && lookupTeam(obsCode, setObsTeamData, setObsCodeError)} />
        <button onClick={() => lookupTeam(obsCode, setObsTeamData, setObsCodeError)} style={s.btnSmall}>Find</button>
      </div>
      {obsCodeError && <p style={s.error}>{obsCodeError}</p>}
      {obsTeamData && (
        <div style={{ ...s.innerBox, marginTop: 10, marginBottom: 12 }}>
          <p style={{ color: C.green, fontSize: 12, marginBottom: 2 }}>✓ Team found!</p>
          <p style={{ color: C.text, fontWeight: 700 }}>{obsTeamData.name}</p>
        </div>
      )}
      <button className="btn-hover" style={{ ...s.btnPrimary, marginTop: 12, background: "#7C3AED", opacity: obsTeamData ? 1 : 0.4 }}
        onClick={() => obsTeamData && gotoView("obsSession")} disabled={!obsTeamData}>Watch Session →</button>
      <button className="btn-hover" style={{ ...s.btnGhost, marginTop: 8 }} onClick={() => gotoView("teamMode")}>← Back</button>
    </Page>
  );

  // ══════════════════════════════════════════════════════════════
  // OBSERVER SESSION
  // ══════════════════════════════════════════════════════════════
  if (view === "obsSession" && obsTeamData) return (
    <SessionPage maxW={760}>
      <TopBar
        left={<span style={{ background: "#EDE9FE", color: "#7C3AED", padding: "4px 12px", borderRadius: 20, fontSize: 12, fontWeight: 600 }}>👁️ Observer</span>}
        center={<span>📋 {story}</span>}
        right={<span style={s.badgeOrange}>{votedCount}/{obsMembers.length} voted</span>}
      />

      <div style={{ display: "grid", gridTemplateColumns: "1fr 200px", gap: 14 }}>
        <div style={{ ...s.surface, padding: "16px" }}>
          {!revealed
            ? <div style={{ background: C.tealLight, borderRadius: 8, padding: "10px 14px", textAlign: "center", marginBottom: 12 }}><p style={{ color: C.teal }}>⏳ Waiting for SM to reveal...</p></div>
            : <div style={{ background: C.greenLight, borderRadius: 8, padding: "10px 14px", textAlign: "center", marginBottom: 12 }}><p style={{ color: C.green, fontWeight: 700 }}>🃏 Votes revealed!</p></div>
          }
          <VoteCardGrid members={obsMembers} votes={votes} revealed={revealed} />
          {revealed && voteValues.length > 0 && (
            <ResultsPanel votes={votes} members={obsMembers} tally={tally} mostVoted={mostVoted} highest={highest} lowest={lowest} />
          )}
        </div>
        <div style={{ ...s.surface, padding: "14px" }}>
          <p style={{ ...s.sectionTitle, marginBottom: 10 }}>👥 Team</p>
          {obsMembers.map(p => (
            <div key={p} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <div style={{ width: 30, height: 30, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 12, background: votes[p] ? C.teal : C.tealLight, color: votes[p] ? "#fff" : C.teal, transition: "all 0.3s" }}>
                {revealed && votes[p] ? votes[p] : votes[p] ? "✓" : "?"}
              </div>
              <span style={{ color: C.text, fontSize: 12 }}>{p}</span>
            </div>
          ))}
        </div>
      </div>
    </SessionPage>
  );

  return null;
}
