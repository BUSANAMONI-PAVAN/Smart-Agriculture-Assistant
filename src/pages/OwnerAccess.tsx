import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, ShieldAlert, UserCheck, UserX } from 'lucide-react';
import { api, type AuthUser, type OwnerStatusResponse } from '../services/api';
import { useAuth } from '../contexts/AuthContext';

export function OwnerAccess() {
  const navigate = useNavigate();
  const { acceptSession, isAuthenticated, canAccessAdmin, logout } = useAuth();
  const [credentials, setCredentials] = useState({
    name: 'peeter',
    password: 'peeter',
  });
  const [ownerStatus, setOwnerStatus] = useState<OwnerStatusResponse | null>(null);
  const [pendingAdmins, setPendingAdmins] = useState<AuthUser[]>([]);
  const [busyUserId, setBusyUserId] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const ownerLoggedIn = Boolean(isAuthenticated && canAccessAdmin);

  const loadOwnerData = async () => {
    if (!ownerLoggedIn) return;
    setLoading(true);
    setError('');
    try {
      const [status, pending] = await Promise.all([
        api.ownerStatus(),
        api.ownerPendingAdmins(),
      ]);
      setOwnerStatus(status);
      setPendingAdmins(Array.isArray(pending.pendingAdmins) ? pending.pendingAdmins : []);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to load owner data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadOwnerData();
  }, [ownerLoggedIn]);

  const handleOwnerLogin = async () => {
    setLoading(true);
    setError('');
    setMessage('');
    try {
      const session = await api.ownerLogin({
        name: credentials.name.trim(),
        password: credentials.password,
      });
      acceptSession(session);
      setMessage('Owner session started.');
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Owner login failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleDecision = async (userId: string, decision: 'approve' | 'deny') => {
    setBusyUserId(userId);
    setError('');
    setMessage('');
    try {
      if (decision === 'approve') {
        await api.ownerApproveAdmin(userId);
        setMessage('Admin signup approved.');
      } else {
        await api.ownerDenyAdmin(userId);
        setMessage('Admin signup denied.');
      }
      await loadOwnerData();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Action failed.');
    } finally {
      setBusyUserId('');
    }
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,#e9f2ff_0%,#e7efe2_42%,#edf5e8_100%)] px-4 py-8">
      <div className="mx-auto w-full max-w-5xl space-y-6">
        <section className="rounded-3xl border border-[#d8e4d0] bg-white/85 p-6 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#597055]">Owner Session</p>
          <h1 className="mt-3 text-3xl font-black text-[#1f3a22]">Separate owner console</h1>
          <p className="mt-2 text-sm text-[#4f6652]">
            Manage pending admin signups in a dedicated owner area using owner credentials.
          </p>
        </section>

        {!ownerLoggedIn ? (
          <section className="rounded-3xl border border-[#d8e4d0] bg-white/90 p-6 shadow-sm">
            <h2 className="text-xl font-black text-[#1f3a22]">Owner login</h2>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <label className="space-y-2">
                <span className="text-sm font-semibold text-[#35513a]">Name</span>
                <input
                  value={credentials.name}
                  onChange={(event) => setCredentials((prev) => ({ ...prev, name: event.target.value }))}
                  className="w-full rounded-xl border border-[#cfdbc9] bg-white px-4 py-3 text-sm outline-none"
                />
              </label>
              <label className="space-y-2">
                <span className="text-sm font-semibold text-[#35513a]">Password</span>
                <input
                  type="password"
                  value={credentials.password}
                  onChange={(event) => setCredentials((prev) => ({ ...prev, password: event.target.value }))}
                  className="w-full rounded-xl border border-[#cfdbc9] bg-white px-4 py-3 text-sm outline-none"
                />
              </label>
            </div>
            <div className="mt-4 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => void handleOwnerLogin()}
                disabled={loading || !credentials.name.trim() || !credentials.password}
                className="rounded-xl bg-[#2f6b32] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#28592b] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? 'Signing in...' : 'Start owner session'}
              </button>
              <button
                type="button"
                onClick={() => navigate('/login')}
                className="rounded-xl border border-[#c8d8c1] px-5 py-3 text-sm font-semibold text-[#35513a]"
              >
                Back to normal login
              </button>
            </div>
          </section>
        ) : (
          <>
            <section className="rounded-3xl border border-[#d8e4d0] bg-white/90 p-6 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-xl font-black text-[#1f3a22]">Owner controls</h2>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => void loadOwnerData()}
                    className="rounded-xl border border-[#c8d8c1] px-4 py-2 text-sm font-semibold text-[#35513a]"
                  >
                    Refresh
                  </button>
                  <button
                    type="button"
                    onClick={() => navigate('/admin')}
                    className="rounded-xl border border-[#c8d8c1] px-4 py-2 text-sm font-semibold text-[#35513a]"
                  >
                    Open admin panel
                  </button>
                  <button
                    type="button"
                    onClick={() => void logout()}
                    className="rounded-xl border border-[#efc9c0] bg-[#fff5f2] px-4 py-2 text-sm font-semibold text-[#9c3f32]"
                  >
                    End owner session
                  </button>
                </div>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-3">
                <div className="rounded-xl border border-[#d9e4d1] bg-[#f7fbf4] p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[#6b8667]">Environment</p>
                  <p className="mt-1 text-sm font-bold text-[#26462a]">{ownerStatus?.environment || 'Unknown'}</p>
                </div>
                <div className="rounded-xl border border-[#d9e4d1] bg-[#f7fbf4] p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[#6b8667]">Owner email</p>
                  <p className="mt-1 text-sm font-bold text-[#26462a]">{ownerStatus?.ownerEmail || 'Not set'}</p>
                </div>
                <div className="rounded-xl border border-[#d9e4d1] bg-[#f7fbf4] p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[#6b8667]">SMTP</p>
                  <p className="mt-1 text-sm font-bold text-[#26462a]">
                    {ownerStatus?.emailTransportConfigured ? 'Ready' : 'Not configured'}
                  </p>
                </div>
              </div>
            </section>

            <section className="rounded-3xl border border-[#d8e4d0] bg-white/90 p-6 shadow-sm">
              <div className="flex items-center gap-2">
                <ShieldAlert size={18} className="text-[#7a5d1d]" />
                <h2 className="text-xl font-black text-[#1f3a22]">Pending admin approvals</h2>
              </div>
              <div className="mt-4 space-y-3">
                {pendingAdmins.length ? (
                  pendingAdmins.map((entry) => (
                    <div key={entry.id} className="rounded-2xl border border-[#d9e4d1] bg-[#f7fbf4] p-4">
                      <p className="text-base font-bold text-[#1f3a22]">{entry.name}</p>
                      <p className="text-sm text-[#4e6652]">{entry.email}</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button
                          type="button"
                          disabled={busyUserId === entry.id}
                          onClick={() => void handleDecision(entry.id, 'approve')}
                          className="inline-flex items-center gap-2 rounded-xl bg-[#2f6b32] px-4 py-2 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          <UserCheck size={15} />
                          Approve
                        </button>
                        <button
                          type="button"
                          disabled={busyUserId === entry.id}
                          onClick={() => void handleDecision(entry.id, 'deny')}
                          className="inline-flex items-center gap-2 rounded-xl border border-[#efc9c0] bg-[#fff5f2] px-4 py-2 text-sm font-bold text-[#9c3f32] disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          <UserX size={15} />
                          Deny
                        </button>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="rounded-xl border border-[#d9e4d1] bg-[#f7fbf4] p-4 text-sm text-[#4e6652]">
                    No pending admin signup requests.
                  </p>
                )}
              </div>
            </section>
          </>
        )}

        {error ? (
          <div className="rounded-2xl border border-[#efc9c0] bg-[#fff5f2] px-4 py-3 text-sm font-semibold text-[#9c3f32]">
            {error}
          </div>
        ) : null}

        {message ? (
          <div className="rounded-2xl border border-[#cfe3c8] bg-[#f2f9ef] px-4 py-3 text-sm font-semibold text-[#35513a]">
            <div className="inline-flex items-center gap-2">
              <CheckCircle2 size={16} />
              {message}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
