import { useState, useRef, useEffect } from 'react'
import api from '../lib/axios'
import { Avatar, Badge, Banner, Button, Card, CardBody, Spinner } from '../components/ui'
import useAuthStore from '../store/auth'

const ROLE_PERMISSIONS = {
  Admin: {
    canDo: ['Mark attendance (single & bulk)', 'Submit & view ratings', 'Create social tasks', 'Verify proofs', 'View all reports & analytics', 'Manage sessions', 'View audit logs', 'Schedule meetings', 'Manage all users'],
    cannotDo: ['Nothing — full access to all resources'],
  },
  'Senior TL': {
    canDo: ['Manage TLs, Captains, Interns', 'Create social tasks', 'Verify proofs', 'View department reports', 'Mark attendance for team', 'Submit ratings to TLs'],
    cannotDo: ['Access other departments', 'View audit logs', 'Revoke admin sessions'],
  },
  TL: {
    canDo: ['Manage Captains and Interns', 'Submit ratings to Captains', 'Mark attendance', 'Verify proofs', 'Schedule team meetings'],
    cannotDo: ['Create social tasks', 'View admin-level reports', "Access Senior TL's team data"],
  },
  Captain: {
    canDo: ['Manage Interns directly', 'Submit ratings to Interns', 'Verify proof submissions', 'Mark intern attendance'],
    cannotDo: ['Create social tasks', 'View TL-level reports', "Access other captains' interns"],
  },
  Intern: {
    canDo: ['View own attendance', 'View own ratings history', 'Upload proof submissions', 'View own notifications', 'Attend meetings'],
    cannotDo: ['Submit ratings', 'Create tasks', "View other users' data", 'Access reports'],
  },
};

const ROLE_LABEL_TO_API = {
  'Admin': 'ADMIN', 'Senior TL': 'SENIOR_TL', 'TL': 'TL', 'Captain': 'CAPTAIN', 'Intern': 'INTERN',
};

const FAQS = [
  { q: 'How does the rating system work?', a: 'Ratings are **permanent and immutable** — each one is stored as a new row. Only direct managers can rate their reports.' },
  { q: 'What happens to proof images after verification?', a: 'After a proof is verified, the image file is **auto-deleted after 24 hours** via a scheduled cron job.' },
  { q: 'How does attendance marking work?', a: 'Single and bulk marking both supported. Records are immutable — corrections create new rows that are audit-logged.' },
  { q: 'What is session management?', a: 'You can view all your active devices, revoke individual sessions, or revoke all at once.' },
  { q: 'How does the hierarchy model work?', a: 'Five tiers: Admin → Senior TL → TL → Captain → Intern. Ownership is validated with a SQL recursive CTE that walks the manager chain.' },
  { q: 'What is logged in the audit trail?', a: 'Every sensitive action: actor, action type, resource, old/new values, IP, user agent, timestamp.' },
];

const QUICK_ACTIONS = [
  { label: 'Submit rating', icon: '⭐', prompt: 'How do I submit a rating?' },
  { label: 'Create task', icon: '🎯', prompt: 'How do I create a social task?' },
  { label: 'Upload proof', icon: '📤', prompt: 'How do I upload proof for a task?' },
  { label: 'Verify proof', icon: '✓', prompt: 'How do I verify a proof submission?' },
  { label: 'Mark attendance', icon: '📅', prompt: 'How do I mark attendance?' },
];

const KB = {
  rating: '**Submitting a Rating**\n\n1. Go to Ratings from the sidebar\n2. Select a team member directly below you in the hierarchy\n3. Enter a score (1-5) and optional remarks\n4. Submit — ratings are permanent and cannot be edited',
  task: '**Creating a Social Task**\n\n1. Go to Tasks → New task (Admin / Senior TL only)\n2. Set a title, description, platform, and deadline\n3. Interns receive a notification and can upload proof\n4. Captains / TLs verify the submissions',
  proof: '**Uploading Proof for a Task**\n\n1. Open the task assigned to you\n2. Click **Upload proof** and select a screenshot\n3. The file is submitted for verification\n4. You\'ll receive a notification once verified',
  verify: '**Verifying a Proof Submission**\n\n1. Go to Tasks → View proofs (Captain / TL / Senior TL / Admin)\n2. Review the submitted screenshot\n3. Click **Verify** to approve',
  attendance: '**Marking Attendance**\n\n1. Go to Attendance from the sidebar\n2. Select the team member(s) — use **Bulk Mark** for multiple\n3. Choose status: Present / Absent / Half Day\n4. Add optional remarks and submit',
  reports: '**Viewing Reports & Analytics**\n\n- **Attendance Summary** — counts by role/status\n- **Rating Summary** — average scores per role\n- **Task Completion** — verified vs pending per task\n- **Top Performers** — ranked by rating\n- **Attendance Trends** — monthly distribution\n- **CSV Exports** — download raw data',
  session: '**Managing Sessions**\n\n1. Go to Sessions from the user menu\n2. View all active devices\n3. Click **Revoke** to log out a specific device\n4. Use **Revoke all** for everything except current',
  default: 'I can help with: ratings, social tasks, proof verification, attendance, sessions, reports, the role hierarchy, and audit logs. Pick a topic or ask away.',
};

function getKBResponse(text) {
  const t = (text || '').toLowerCase();
  if (t.includes('rating') || t.includes('rate')) return KB.rating;
  if (t.includes('social task') || t.includes('create task')) return KB.task;
  if (t.includes('upload proof') || t.includes('proof')) return KB.proof;
  if (t.includes('verify')) return KB.verify;
  if (t.includes('attendance') || t.includes('mark')) return KB.attendance;
  if (t.includes('report') || t.includes('analytic')) return KB.reports;
  if (t.includes('session')) return KB.session;
  return KB.default;
}

function renderRich(text) {
  if (!text) return null;
  // Minimal markdown: **bold** and \n line breaks.
  const parts = [];
  let buf = '';
  let i = 0;
  let key = 0;
  while (i < text.length) {
    if (text[i] === '*' && text[i + 1] === '*') {
      const end = text.indexOf('**', i + 2);
      if (end === -1) { buf += text[i++]; continue; }
      if (buf) { parts.push(buf); buf = ''; }
      parts.push(<strong key={key++}>{text.slice(i + 2, end)}</strong>);
      i = end + 2;
    } else if (text[i] === '\n') {
      if (buf) { parts.push(buf); buf = ''; }
      parts.push(<br key={key++} />);
      i++;
    } else {
      buf += text[i++];
    }
  }
  if (buf) parts.push(buf);
  return parts;
}

export default function InternOpsAssistant() {
  const { user } = useAuthStore();
  const roleLabel = user?.role === 'ADMIN' ? 'Admin' : user?.role === 'SENIOR_TL' ? 'Senior TL' : user?.role === 'TL' ? 'TL' : user?.role === 'CAPTAIN' ? 'Captain' : 'Intern';
  const roleApi = ROLE_LABEL_TO_API[roleLabel] || 'INTERN';

  const [open, setOpen] = useState(true);
  const [messages, setMessages] = useState([
    { role: 'bot', content: `Hi! I'm the InternOps assistant. I can help with ratings, tasks, attendance, sessions, and more. Pick a topic below or ask away.`, ts: Date.now() },
  ]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [tab, setTab] = useState('chat'); // 'chat' | 'perms' | 'faq'
  const scrollRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, tab]);

  const send = async (text) => {
    const msg = (text ?? input).trim();
    if (!msg) return;
    setInput('');
    setMessages((m) => [...m, { role: 'user', content: msg, ts: Date.now() }]);
    setSending(true);
    try {
      const res = await api.post('/ai/assistant', { message: msg, role: roleApi, history: messages.slice(-6) });
      const answer = res.data?.answer || KB.default;
      const provider = res.data?.provider ? `\n\n*via ${res.data.provider}${res.data.latencyMs ? ` · ${res.data.latencyMs}ms` : ''}*` : '';
      setMessages((m) => [...m, { role: 'bot', content: answer + provider, ts: Date.now() }]);
    } catch (err) {
      const detail = err.response?.data?.error;
      // Fallback: local KB so it still feels alive.
      const fallback = getKBResponse(msg);
      setMessages((m) => [...m, { role: 'bot', content: detail ? `⚠️ ${detail}\n\n${fallback}` : fallback, ts: Date.now() }]);
    } finally {
      setSending(false);
    }
  };

  const permissions = ROLE_PERMISSIONS[roleLabel];

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-fg">AI Assistant</h1>
          <p className="text-sm text-fg-muted mt-1">Ask about ratings, tasks, attendance, projects, and more. Powered by multi-provider AI (Anthropic · Groq · DeepSeek · Gemini · HF · FastAPI).</p>
        </div>
        <Badge tone="brand" dot>Beta</Badge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Tabs (left rail) */}
        <div className="lg:col-span-1 space-y-2">
          <Card>
            <CardBody className="!p-2">
              {[
                { id: 'chat', label: 'Chat', icon: '💬' },
                { id: 'perms', label: `My role · ${roleLabel}`, icon: '🔐' },
                { id: 'faq', label: 'Quick answers', icon: '⚡' },
              ].map((t) => (
                <button key={t.id} onClick={() => setTab(t.id)}
                        className={['w-full text-left px-3 h-9 rounded-md text-sm font-medium transition-colors flex items-center gap-2', tab === t.id ? 'bg-fg text-fg-inverse' : 'text-fg hover:bg-surface-sunken'].join(' ')}>
                  <span>{t.icon}</span> <span>{t.label}</span>
                </button>
              ))}
            </CardBody>
          </Card>

          {tab === 'chat' && (
            <Card>
              <CardBody className="!p-2">
                <p className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-fg-muted">Quick actions</p>
                <div className="space-y-1">
                  {QUICK_ACTIONS.map((a) => (
                    <button key={a.label} onClick={() => send(a.prompt)}
                            className="w-full text-left px-2.5 py-1.5 rounded-md text-xs text-fg hover:bg-surface-sunken transition-colors flex items-center gap-2">
                      <span>{a.icon}</span><span className="flex-1">{a.label}</span>
                      <svg className="w-3 h-3 text-fg-muted" viewBox="0 0 12 12" fill="currentColor"><path d="M4 2l4 4-4 4" /></svg>
                    </button>
                  ))}
                </div>
              </CardBody>
            </Card>
          )}
        </div>

        {/* Main content */}
        <div className="lg:col-span-2">
          <Card className="overflow-hidden flex flex-col h-[600px]">
            {tab === 'chat' && (
              <>
                <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
                  {messages.map((m, i) => (
                    <div key={i} className={['flex gap-2.5 animate-fade-in', m.role === 'user' ? 'flex-row-reverse' : ''].join(' ')}>
                      {m.role === 'bot' ? (
                        <div className="shrink-0 w-7 h-7 rounded-md bg-gradient-to-br from-fg to-fg/70 text-fg-inverse flex items-center justify-center text-xs font-bold">IO</div>
                      ) : (
                        <Avatar user={user} size="sm" />
                      )}
                      <div className={['max-w-[80%] rounded-md px-3 py-2 text-sm leading-relaxed', m.role === 'user' ? 'bg-fg text-fg-inverse' : 'bg-surface-sunken text-fg'].join(' ')}>
                        {renderRich(m.content)}
                      </div>
                    </div>
                  ))}
                  {sending && (
                    <div className="flex gap-2.5 animate-fade-in">
                      <div className="shrink-0 w-7 h-7 rounded-md bg-gradient-to-br from-fg to-fg/70 text-fg-inverse flex items-center justify-center text-xs font-bold">IO</div>
                      <div className="bg-surface-sunken rounded-md px-3 py-2.5 text-sm text-fg-muted flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-fg-muted animate-pulse" />
                        <span className="w-1.5 h-1.5 rounded-full bg-fg-muted animate-pulse" style={{ animationDelay: '150ms' }} />
                        <span className="w-1.5 h-1.5 rounded-full bg-fg-muted animate-pulse" style={{ animationDelay: '300ms' }} />
                      </div>
                    </div>
                  )}
                </div>
                <form onSubmit={(e) => { e.preventDefault(); send(); }} className="border-t border-border p-3 flex items-center gap-2 bg-surface-raised">
                  <input ref={inputRef} value={input} onChange={(e) => setInput(e.target.value)}
                         placeholder="Ask anything about InternOps…"
                         className="flex-1 bg-surface-sunken border border-border rounded-md h-9 px-3 text-sm placeholder:text-fg-subtle focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 transition-colors" />
                  <Button type="submit" variant="primary" size="md" disabled={!input.trim() || sending} aria-label="Send message">
                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" /></svg>
                  </Button>
                </form>
              </>
            )}

            {tab === 'perms' && (
              <div className="flex-1 overflow-y-auto p-5 space-y-4">
                <div className="flex items-center gap-2.5">
                  <Avatar user={user} size="md" />
                  <div>
                    <div className="text-sm font-semibold text-fg">{user?.fullName || user?.email}</div>
                    <Badge size="sm" tone="brand">{roleLabel}</Badge>
                  </div>
                </div>
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-fg-muted mb-2">Can do</h3>
                  <ul className="space-y-1.5">
                    {permissions.canDo.map((p) => (
                      <li key={p} className="flex items-start gap-2 text-sm text-fg">
                        <span className="shrink-0 w-4 h-4 rounded-full bg-success-100 text-success-700 flex items-center justify-center mt-0.5">
                          <svg className="w-2.5 h-2.5" viewBox="0 0 16 16" fill="currentColor"><path d="M13.5 4.5L6 12L2.5 8.5L3.91 7.09L6 9.17L12.09 3.09L13.5 4.5Z" /></svg>
                        </span>
                        <span>{p}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-fg-muted mb-2">Cannot do</h3>
                  <ul className="space-y-1.5">
                    {permissions.cannotDo.map((p) => (
                      <li key={p} className="flex items-start gap-2 text-sm text-fg-muted">
                        <span className="shrink-0 w-4 h-4 rounded-full bg-danger-100 text-danger-700 flex items-center justify-center mt-0.5">
                          <svg className="w-2.5 h-2.5" viewBox="0 0 16 16" fill="currentColor"><path d="M4.28 3.22a.75.75 0 00-1.06 1.06L6.94 8l-3.72 3.72a.75.75 0 101.06 1.06L8 9.06l3.72 3.72a.75.75 0 101.06-1.06L9.06 8l3.72-3.72a.75.75 0 00-1.06-1.06L8 6.94 4.28 3.22z" /></svg>
                        </span>
                        <span>{p}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            {tab === 'faq' && (
              <div className="flex-1 overflow-y-auto p-5 space-y-2">
                <p className="text-xs text-fg-muted mb-2">Click any question to ask it in chat.</p>
                {FAQS.map((f, i) => (
                  <button key={i} onClick={() => { setTab('chat'); send(f.q); }}
                          className="w-full text-left rounded-md border border-border bg-surface-base p-3 hover:border-border-strong hover:bg-surface-sunken transition-colors">
                    <p className="text-sm font-medium text-fg">{f.q}</p>
                    <p className="text-xs text-fg-muted mt-1 line-clamp-2">{f.a.replace(/\*\*/g, '')}</p>
                  </button>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
