import { useEffect, useMemo, useState } from 'react';
import { BellRing, KeyRound, ShieldCheck, ToggleLeft, Trash2, UserPlus, Users } from 'lucide-react';
import { api, type AdminConsoleResponse, type FeatureFlag, type RegisterPayload } from '../services/api';
import { useAuth } from '../contexts/AuthContext';

export function AdminPanel() {
  const { applyFeatureFlags } = useAuth();
  const [consoleData, setConsoleData] = useState<AdminConsoleResponse | null>(null);
  const [featureDraft, setFeatureDraft] = useState<FeatureFlag[]>([]);
  const [newUser, setNewUser] = useState({
    role: 'farmer' as 'farmer' | 'admin',
    name: '',
    phone: '',
    email: '',
    password: '',
  });
  const [otpSessionToken, setOtpSessionToken] = useState('');
  const [otp, setOtp] = useState('');
  const [actionOtpSessionToken, setActionOtpSessionToken] = useState('');
  const [actionOtp, setActionOtp] = useState('');
  const [actionOtpProofToken, setActionOtpProofToken] = useState('');
  const [activeUserActionId, setActiveUserActionId] = useState('');
  const [activeNotificationActionId, setActiveNotificationActionId] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const hasFeatureChanges = useMemo(() => {
    if (!consoleData) return false;
    return JSON.stringify(consoleData.features) !== JSON.stringify(featureDraft);
  }, [consoleData, featureDraft]);

  const loadConsole = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await api.getAdminConsole();
      setConsoleData(response);
      setFeatureDraft(response.features);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to load admin console.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadConsole();
  }, []);

  const requestOtp = async () => {
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const response = await api.requestAdminActionOtp('system_control');
      setOtpSessionToken(response.otpSessionToken);
      setMessage(
        response.debugOtp
          ? `OTP sent. Local development OTP: ${response.debugOtp}`
          : 'OTP sent to the admin email. Verify it to apply feature changes.',
      );
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to request OTP.');
    } finally {
      setSaving(false);
    }
  };

  const requestActionOtp = async () => {
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const response = await api.requestAdminActionOtp('system_control');
      setActionOtpSessionToken(response.otpSessionToken);
      setActionOtp('');
      setActionOtpProofToken('');
      setMessage(
        response.debugOtp
          ? `Admin action OTP sent. Local development OTP: ${response.debugOtp}`
          : 'Admin action OTP sent. Verify to unlock user and notification changes.',
      );
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to request admin action OTP.');
    } finally {
      setSaving(false);
    }
  };

  const verifyActionOtp = async () => {
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const verification = await api.verifyAdminActionOtp({
        otpSessionToken: actionOtpSessionToken,
        otp: actionOtp,
      });
      setActionOtpProofToken(verification.otpProofToken);
      setActionOtp('');
      setActionOtpSessionToken('');
      setMessage('Admin action verification successful. You can now create/update/delete users and notifications.');
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to verify admin action OTP.');
    } finally {
      setSaving(false);
    }
  };

  const requireActionProof = () => {
    if (!actionOtpProofToken) {
      setError('Verify admin action OTP first to perform this operation.');
      return null;
    }
    return actionOtpProofToken;
  };

  const handleSaveFeatures = async () => {
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const verification = await api.verifyAdminActionOtp({ otpSessionToken, otp });
      const response = await api.updateFeatureFlags(
        featureDraft.map((feature) => ({ key: feature.key, enabled: feature.enabled })),
        verification.otpProofToken,
      );

      applyFeatureFlags(response.features);
      setConsoleData((prev) => (prev ? { ...prev, features: response.features } : prev));
      setFeatureDraft(response.features);
      setOtpSessionToken('');
      setOtp('');
      setMessage('Feature updates applied successfully.');
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to save feature changes.');
    } finally {
      setSaving(false);
    }
  };

  const handleCreateUser = async () => {
    const proofToken = requireActionProof();
    if (!proofToken) return;
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const payload: RegisterPayload =
        newUser.role === 'farmer'
          ? {
              role: 'farmer',
              name: newUser.name.trim(),
              phone: newUser.phone.trim(),
              email: '',
              password: '',
            }
          : {
              role: 'admin',
              name: newUser.name.trim(),
              phone: '',
              email: newUser.email.trim(),
              password: newUser.password,
            };

      await api.createAdminUser(payload, proofToken);
      setMessage('User created successfully.');
      setNewUser({
        role: 'farmer',
        name: '',
        phone: '',
        email: '',
        password: '',
      });
      await loadConsole();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to create user.');
      if (requestError instanceof Error && requestError.message.toLowerCase().includes('otp')) {
        setActionOtpProofToken('');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleToggleStatus = async (userId: string, currentStatus: string) => {
    const proofToken = requireActionProof();
    if (!proofToken) return;
    setActiveUserActionId(userId);
    setError('');
    setMessage('');
    try {
      const nextStatus = currentStatus === 'active' ? 'disabled' : 'active';
      await api.updateAdminUser(userId, { status: nextStatus as 'active' | 'disabled' }, proofToken);
      setMessage(`User status changed to ${nextStatus}.`);
      await loadConsole();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to update user status.');
      if (requestError instanceof Error && requestError.message.toLowerCase().includes('otp')) {
        setActionOtpProofToken('');
      }
    } finally {
      setActiveUserActionId('');
    }
  };

  const handleDeleteUser = async (userId: string) => {
    const proofToken = requireActionProof();
    if (!proofToken) return;
    setActiveUserActionId(userId);
    setError('');
    setMessage('');
    try {
      await api.deleteAdminUser(userId, proofToken);
      setMessage('User deleted successfully.');
      await loadConsole();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to delete user.');
      if (requestError instanceof Error && requestError.message.toLowerCase().includes('otp')) {
        setActionOtpProofToken('');
      }
    } finally {
      setActiveUserActionId('');
    }
  };

  const handleDeleteNotification = async (notificationId: string) => {
    const proofToken = requireActionProof();
    if (!proofToken) return;
    setActiveNotificationActionId(notificationId);
    setError('');
    setMessage('');
    try {
      await api.deleteAdminNotification(notificationId, proofToken);
      setMessage('Notification deleted successfully.');
      await loadConsole();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to delete notification.');
      if (requestError instanceof Error && requestError.message.toLowerCase().includes('otp')) {
        setActionOtpProofToken('');
      }
    } finally {
      setActiveNotificationActionId('');
    }
  };

  if (loading) {
    return <div className="container mx-auto p-6 text-lg font-semibold text-[#294833]">Loading admin console...</div>;
  }

  if (!consoleData) {
    return <div className="container mx-auto p-6 text-[#9f3e2c]">{error || 'Admin console is unavailable.'}</div>;
  }

  return (
    <div className="container mx-auto space-y-6 p-4">
      <div className="rounded-[28px] border border-[#d7e2c8] bg-[linear-gradient(135deg,#f6fbf2_0%,#edf5df_52%,#fff5df_100%)] p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.28em] text-[#6f8b56]">Admin workspace</p>
            <h1 className="mt-3 text-3xl font-black text-[#17321f]">System control and live access overview</h1>
            <p className="mt-3 max-w-3xl text-[#4c6b4f]">
              Admin sign-in is protected by email OTP. Sensitive feature changes below require a fresh OTP before they can be applied.
            </p>
          </div>
          <div className="rounded-2xl border border-[#d7e2c8] bg-white/80 px-4 py-3 text-sm text-[#35513a]">
            Signed in as <span className="font-bold">{consoleData.currentUser.name}</span>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <div className="rounded-2xl border bg-white p-4 shadow-sm">
          <p className="text-sm text-gray-500">Total users</p>
          <p className="mt-2 text-3xl font-black text-[#17321f]">{consoleData.stats.totalUsers}</p>
        </div>
        <div className="rounded-2xl border bg-white p-4 shadow-sm">
          <p className="text-sm text-gray-500">Admins</p>
          <p className="mt-2 text-3xl font-black text-[#17321f]">{consoleData.stats.admins}</p>
        </div>
        <div className="rounded-2xl border bg-white p-4 shadow-sm">
          <p className="text-sm text-gray-500">Farmers</p>
          <p className="mt-2 text-3xl font-black text-[#17321f]">{consoleData.stats.farmers}</p>
        </div>
        <div className="rounded-2xl border bg-white p-4 shadow-sm">
          <p className="text-sm text-gray-500">Notifications</p>
          <p className="mt-2 text-3xl font-black text-[#17321f]">{consoleData.stats.totalAlerts}</p>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <section className="space-y-6">
          <div className="rounded-2xl border bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2 text-[#17321f]">
              <Users size={20} />
              <h2 className="text-2xl font-black">Registered users</h2>
            </div>
            <div className="mt-4 rounded-2xl border border-[#dce9d4] bg-[#f8fcf4] p-4">
              <p className="mb-3 flex items-center gap-2 text-sm font-bold text-[#2b4f2e]">
                <UserPlus size={16} />
                Add new user
              </p>
              <div className="grid gap-3 md:grid-cols-2">
                <select
                  value={newUser.role}
                  onChange={(event) =>
                    setNewUser((prev) => ({
                      ...prev,
                      role: event.target.value as 'farmer' | 'admin',
                      phone: '',
                      email: '',
                      password: '',
                    }))
                  }
                  className="rounded-xl border border-[#ccd9c6] bg-white px-3 py-2 text-sm text-[#254128]"
                >
                  <option value="farmer">Farmer</option>
                  <option value="admin">Admin</option>
                </select>
                <input
                  value={newUser.name}
                  onChange={(event) => setNewUser((prev) => ({ ...prev, name: event.target.value }))}
                  placeholder="Name"
                  className="rounded-xl border border-[#ccd9c6] bg-white px-3 py-2 text-sm text-[#254128]"
                />
                {newUser.role === 'farmer' ? (
                  <input
                    value={newUser.phone}
                    onChange={(event) => setNewUser((prev) => ({ ...prev, phone: event.target.value }))}
                    placeholder="Phone number"
                    className="rounded-xl border border-[#ccd9c6] bg-white px-3 py-2 text-sm text-[#254128]"
                  />
                ) : (
                  <>
                    <input
                      value={newUser.email}
                      onChange={(event) => setNewUser((prev) => ({ ...prev, email: event.target.value }))}
                      placeholder="Admin email"
                      className="rounded-xl border border-[#ccd9c6] bg-white px-3 py-2 text-sm text-[#254128]"
                    />
                    <input
                      type="password"
                      value={newUser.password}
                      onChange={(event) => setNewUser((prev) => ({ ...prev, password: event.target.value }))}
                      placeholder="Admin password"
                      className="rounded-xl border border-[#ccd9c6] bg-white px-3 py-2 text-sm text-[#254128]"
                    />
                  </>
                )}
              </div>
              <button
                type="button"
                onClick={() => void handleCreateUser()}
                disabled={
                  saving
                  || !newUser.name.trim()
                  || (newUser.role === 'farmer' ? !newUser.phone.trim() : !newUser.email.trim() || newUser.password.length < 8)
                }
                className="mt-3 rounded-xl bg-[#2f6b32] px-4 py-2 text-sm font-bold text-white transition hover:bg-[#28592b] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? 'Saving...' : 'Create user'}
              </button>
            </div>
            <div className="mt-4 overflow-auto">
              <table className="w-full min-w-[700px] text-left text-sm">
                <thead>
                  <tr className="border-b bg-gray-50">
                    <th className="p-3">Name</th>
                    <th className="p-3">Role</th>
                    <th className="p-3">Phone</th>
                    <th className="p-3">Email</th>
                    <th className="p-3">Status</th>
                    <th className="p-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {consoleData.users.map((user) => (
                    <tr key={user.id} className="border-b">
                      <td className="p-3">{user.name}</td>
                      <td className="p-3 capitalize">{user.role}</td>
                      <td className="p-3 text-gray-600">{user.phone || '-'}</td>
                      <td className="p-3 text-gray-600">{user.email || '-'}</td>
                      <td className="p-3 capitalize">{user.status}</td>
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            disabled={activeUserActionId === user.id}
                            onClick={() => void handleToggleStatus(user.id, user.status)}
                            className="rounded-lg border border-[#cad9c5] bg-white px-2 py-1 text-xs font-semibold text-[#345737] hover:bg-[#eef6e8] disabled:opacity-60"
                          >
                            {user.status === 'active' ? 'Disable' : 'Enable'}
                          </button>
                          <button
                            type="button"
                            disabled={activeUserActionId === user.id}
                            onClick={() => void handleDeleteUser(user.id)}
                            className="inline-flex items-center gap-1 rounded-lg border border-[#efc9c0] bg-[#fff5f2] px-2 py-1 text-xs font-semibold text-[#9c3f32] hover:bg-[#ffece7] disabled:opacity-60"
                          >
                            <Trash2 size={12} />
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-2xl border bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2 text-[#17321f]">
              <BellRing size={20} />
              <h2 className="text-2xl font-black">Recent notifications</h2>
            </div>
            <div className="mt-4 space-y-3">
              {consoleData.alerts.map((alert) => (
                <div key={alert.id} className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-semibold text-[#17321f]">{alert.title}</p>
                    <div className="flex items-center gap-2">
                      <span className="rounded-full bg-white px-2 py-1 text-xs font-semibold uppercase text-gray-600">{alert.type}</span>
                      <button
                        type="button"
                        disabled={activeNotificationActionId === alert.id}
                        onClick={() => void handleDeleteNotification(alert.id)}
                        className="inline-flex items-center gap-1 rounded-lg border border-[#efc9c0] bg-[#fff5f2] px-2 py-1 text-xs font-semibold text-[#9c3f32] hover:bg-[#ffece7] disabled:opacity-60"
                      >
                        <Trash2 size={12} />
                        Delete
                      </button>
                    </div>
                  </div>
                  <p className="mt-2 text-sm text-gray-600">{alert.message}</p>
                  <p className="mt-2 text-xs text-gray-400">{new Date(alert.createdAt).toLocaleString()}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border bg-white p-5 shadow-sm">
            <h2 className="text-2xl font-black text-[#17321f]">Audit trail</h2>
            <div className="mt-3 max-h-[360px] space-y-2 overflow-auto">
              {consoleData.auditLog.length ? (
                consoleData.auditLog.map((entry) => (
                  <article key={entry.id} className="rounded-xl border border-gray-100 bg-gray-50 p-3">
                    <p className="text-sm font-semibold text-[#17321f]">{entry.action}</p>
                    <p className="text-xs text-gray-700">{entry.detail}</p>
                    <p className="mt-1 text-[11px] text-gray-500">{new Date(entry.createdAt).toLocaleString()}</p>
                  </article>
                ))
              ) : (
                <p className="rounded-xl bg-gray-50 p-3 text-sm text-gray-500">No audit records yet.</p>
              )}
            </div>
          </div>
        </section>

        <section className="space-y-6">
          <div className="rounded-2xl border bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2 text-[#17321f]">
              <KeyRound size={20} />
              <h2 className="text-2xl font-black">Admin action verification</h2>
            </div>
            <p className="mt-2 text-sm text-gray-600">
              User management and notification delete actions now require a verified OTP proof token.
            </p>

            {actionOtpProofToken ? (
              <div className="mt-4 rounded-xl border border-[#cfe3c8] bg-[#f2f9ef] px-4 py-3 text-sm font-semibold text-[#35513a]">
                Admin action token is active for this session.
              </div>
            ) : null}

            {!actionOtpSessionToken ? (
              <button
                type="button"
                onClick={() => void requestActionOtp()}
                disabled={saving}
                className="mt-4 inline-flex items-center gap-2 rounded-2xl bg-[#2f6b32] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#255428] disabled:cursor-not-allowed disabled:opacity-60"
              >
                <KeyRound size={16} />
                Request action OTP
              </button>
            ) : (
              <div className="mt-4 rounded-2xl border border-[#d7e2c8] bg-[#f8fbf3] p-4">
                <label className="block space-y-2">
                  <span className="text-sm font-semibold text-[#314a30]">Enter OTP</span>
                  <input
                    value={actionOtp}
                    onChange={(event) => setActionOtp(event.target.value)}
                    maxLength={6}
                    className="w-full rounded-2xl border border-[#d2ddc5] bg-white px-4 py-3 tracking-[0.25em] outline-none"
                    placeholder="123456"
                  />
                </label>
                <div className="mt-4 flex gap-3">
                  <button
                    type="button"
                    disabled={saving || actionOtp.length < 6}
                    onClick={() => void verifyActionOtp()}
                    className="inline-flex items-center gap-2 rounded-2xl bg-[#ff7a1a] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#ef6c0d] disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    <ShieldCheck size={16} />
                    Verify action OTP
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setActionOtpSessionToken('');
                      setActionOtp('');
                    }}
                    className="rounded-2xl border border-gray-200 px-4 py-3 text-sm font-semibold text-gray-600"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="rounded-2xl border bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2 text-[#17321f]">
              <ToggleLeft size={20} />
              <h2 className="text-2xl font-black">Feature switches</h2>
            </div>
            <p className="mt-2 text-sm text-gray-600">
              Changing system modules is treated as a sensitive action and requires OTP verification.
            </p>

            <div className="mt-4 space-y-3">
              {featureDraft.map((feature) => (
                <label key={feature.key} className="flex items-start justify-between gap-4 rounded-2xl border border-gray-100 bg-gray-50 p-4">
                  <div>
                    <p className="font-semibold text-[#17321f]">{feature.title}</p>
                    <p className="mt-1 text-sm text-gray-600">{feature.description}</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={feature.enabled}
                    onChange={(event) =>
                      setFeatureDraft((prev) =>
                        prev.map((item) => (item.key === feature.key ? { ...item, enabled: event.target.checked } : item)),
                      )
                    }
                    className="mt-1 h-5 w-5"
                  />
                </label>
              ))}
            </div>

            {error && <div className="mt-4 rounded-2xl border border-[#f0c5ba] bg-[#fff2ef] px-4 py-3 text-sm font-medium text-[#9f3e2c]">{error}</div>}
            {message && <div className="mt-4 rounded-2xl border border-[#cfe3c8] bg-[#f2f9ef] px-4 py-3 text-sm font-medium text-[#35513a]">{message}</div>}

            {!otpSessionToken ? (
              <button
                type="button"
                disabled={!hasFeatureChanges || saving}
                onClick={() => void requestOtp()}
                className="mt-5 inline-flex items-center gap-2 rounded-2xl bg-[#2f6b32] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#255428] disabled:cursor-not-allowed disabled:opacity-60"
              >
                <KeyRound size={16} />
                {hasFeatureChanges ? 'Request OTP to apply changes' : 'No pending feature changes'}
              </button>
            ) : (
              <div className="mt-5 rounded-2xl border border-[#d7e2c8] bg-[#f8fbf3] p-4">
                <label className="block space-y-2">
                  <span className="text-sm font-semibold text-[#314a30]">Enter OTP</span>
                  <input
                    value={otp}
                    onChange={(event) => setOtp(event.target.value)}
                    maxLength={6}
                    className="w-full rounded-2xl border border-[#d2ddc5] bg-white px-4 py-3 tracking-[0.25em] outline-none"
                    placeholder="123456"
                  />
                </label>
                <div className="mt-4 flex gap-3">
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => void handleSaveFeatures()}
                    className="inline-flex items-center gap-2 rounded-2xl bg-[#ff7a1a] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#ef6c0d] disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    <ShieldCheck size={16} />
                    Verify OTP and save
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setOtpSessionToken('');
                      setOtp('');
                      setMessage('');
                    }}
                    className="rounded-2xl border border-gray-200 px-4 py-3 text-sm font-semibold text-gray-600"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
