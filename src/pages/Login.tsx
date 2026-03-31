import { FormEvent, ReactNode, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowRight, KeyRound, Lock, Mail, Phone, ShieldCheck, Tractor, UserRound } from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../contexts/AuthContext';

type AuthMode = 'login' | 'register';
type AuthRole = 'farmer' | 'admin';

type FarmerForm = {
  name: string;
  phone: string;
  email: string;
};

type AdminForm = {
  name: string;
  email: string;
  password: string;
};

const INITIAL_FARMER_FORM: FarmerForm = {
  name: '',
  phone: '',
  email: '',
};

const INITIAL_ADMIN_FORM: AdminForm = {
  name: '',
  email: '',
  password: '',
};

function UnderlineField({
  label,
  icon,
  children,
}: {
  label: string;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-[0.84rem] font-semibold uppercase tracking-[0.08em] text-white/84">{label}</span>
      <div className="flex items-center gap-3 border-b border-white/60 pb-2.5">
        <span className="text-white/78">{icon}</span>
        {children}
      </div>
    </label>
  );
}

export function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { acceptSession, canAccessAdmin, isAuthenticated } = useAuth();
  const [role, setRole] = useState<AuthRole>('farmer');
  const [farmerForm, setFarmerForm] = useState<FarmerForm>(INITIAL_FARMER_FORM);
  const [adminForm, setAdminForm] = useState<AdminForm>(INITIAL_ADMIN_FORM);
  const [otp, setOtp] = useState('');
  const [otpSessionToken, setOtpSessionToken] = useState('');
  const [otpRecipientEmail, setOtpRecipientEmail] = useState('');
  const [otpPurposeLabel, setOtpPurposeLabel] = useState<'login' | 'register'>('login');
  const [notice, setNotice] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const mode: AuthMode = location.pathname === '/register' ? 'register' : 'login';
  const inOtpStep = role === 'admin' && Boolean(otpSessionToken);
  const isFarmer = role === 'farmer';

  useEffect(() => {
    if (isAuthenticated) {
      navigate(canAccessAdmin ? '/admin' : '/dashboard', { replace: true });
    }
  }, [canAccessAdmin, isAuthenticated, navigate]);

  const resetOtpState = () => {
    setOtpSessionToken('');
    setOtp('');
    setOtpRecipientEmail('');
    setNotice('');
  };

  const handleModeSwitch = (nextMode: AuthMode) => {
    setError('');
    setNotice('');
    resetOtpState();
    navigate(nextMode === 'register' ? '/register' : '/login');
  };

  const handleRoleSwitch = (nextRole: AuthRole) => {
    setRole(nextRole);
    setError('');
    setNotice('');
    resetOtpState();
  };

  const handleFarmerSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    setNotice('');

    try {
      const session =
        mode === 'register'
          ? await api.farmerRegister({ name: farmerForm.name, phone: farmerForm.phone, email: farmerForm.email || undefined })
          : await api.farmerLogin({ phone: farmerForm.phone });

      acceptSession(session);
      navigate('/dashboard', { replace: true });
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to continue right now.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAdminChallenge = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    setNotice('');

    try {
      const response =
        mode === 'register'
          ? await api.adminRegister({
              name: adminForm.name,
              email: adminForm.email,
              password: adminForm.password,
            })
          : await api.adminLogin({
              email: adminForm.email,
              password: adminForm.password,
            });

      setOtpPurposeLabel(mode);
      setOtpSessionToken(response.otpSessionToken);
      setOtpRecipientEmail(String(response.recipientEmail || ''));
      setOtp('');
      setNotice(response.message);

      if (!response.delivered) {
        const reason = response.deliveryError || 'OTP email delivery is delayed.';
        setError(`${reason} If OTP arrives, enter it below, or tap Resend OTP.`);
        return;
      }
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to send OTP right now.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleVerifyOtp = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    setNotice('');

    try {
      const session = await api.verifyAdminOtp({
        otpSessionToken,
        otp,
      });

      acceptSession(session);
      navigate('/admin', { replace: true });
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'OTP verification failed.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleResendOtp = async () => {
    setSubmitting(true);
    setError('');
    setNotice('');

    try {
      const response = await api.resendAdminOtp({ otpSessionToken });
      setOtpSessionToken(response.otpSessionToken);
      setOtpRecipientEmail(String(response.recipientEmail || otpRecipientEmail));
      setNotice(response.message);
      if (!response.delivered) {
        const reason = response.deliveryError || 'OTP email delivery is delayed.';
        setError(`${reason} If OTP arrives, enter it below and tap Verify OTP.`);
        return;
      }
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to resend OTP.');
    } finally {
      setSubmitting(false);
    }
  };

  const heading = inOtpStep
    ? `Verify ${otpPurposeLabel === 'register' ? 'Signup' : 'Login'}`
    : mode === 'register'
      ? 'Create account'
      : 'Login';
  const subtitle = inOtpStep
    ? otpRecipientEmail
      ? `Enter the 6-digit code sent to ${otpRecipientEmail} to finish ${otpPurposeLabel}.`
      : `Enter the 6-digit code sent to your admin mailbox to finish ${otpPurposeLabel}.`
    : isFarmer
      ? mode === 'register'
        ? 'Farmer signup with name and phone number.'
        : 'Phone-only login for farmers.'
      : mode === 'register'
        ? 'Admin signup with secure email OTP verification.'
        : 'Admin login with email, password, and OTP.';

  const primaryButtonLabel = inOtpStep
    ? 'Verify OTP'
    : isFarmer
      ? mode === 'register'
        ? 'Create farmer account'
        : 'Log in'
      : mode === 'register'
        ? 'Send signup OTP'
        : 'Send login OTP';

  const switchLine = inOtpStep
    ? null
    : mode === 'register'
      ? isFarmer
        ? 'Already registered?'
        : 'Already an admin?'
      : isFarmer
        ? "Don't have a farmer account?"
        : "Don't have an admin account?";

  const switchAction = inOtpStep ? null : mode === 'register' ? 'Login' : 'Register';

  return (
    <div className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top,#7c58a8_0%,#56397d_40%,#2c265f_100%)]">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-x-0 bottom-0 h-[42%] bg-[linear-gradient(180deg,transparent_0%,rgba(20,15,54,0.2)_20%,rgba(18,12,44,0.62)_100%)]" />
        <div className="absolute left-[-10%] bottom-0 h-[34%] w-[42%] bg-[#2b2357]/85 [clip-path:polygon(0_100%,18%_58%,36%_74%,54%_42%,72%_65%,100%_100%)]" />
        <div className="absolute left-[18%] bottom-0 h-[28%] w-[34%] bg-[#3c2d6b]/88 [clip-path:polygon(0_100%,22%_56%,44%_68%,64%_30%,82%_58%,100%_100%)]" />
        <div className="absolute right-[-6%] bottom-0 h-[38%] w-[44%] bg-[#241b4d]/88 [clip-path:polygon(0_100%,20%_66%,38%_80%,55%_46%,74%_62%,100%_100%)]" />
        <div className="absolute left-[6%] top-[14%] h-10 w-24 rounded-full bg-white/10 blur-sm" />
        <div className="absolute left-[18%] top-[17%] h-7 w-16 rounded-full bg-[#ffc3ea26] blur-sm" />
        <div className="absolute right-[16%] top-[15%] h-10 w-24 rounded-full bg-white/12 blur-sm" />
        <div className="absolute right-[10%] top-[18%] h-8 w-20 rounded-full bg-[#ffd2a626] blur-sm" />
        <div className="absolute bottom-[18%] right-[10%] h-24 w-36 rounded-[44%_44%_14%_14%] bg-[#2e214f]/88" />
        <div className="absolute bottom-[24%] right-[11.5%] h-10 w-20 rounded-[50%_50%_0_0] bg-[#3d2c67]/85 [clip-path:polygon(0_100%,14%_42%,50%_0,86%_42%,100%_100%)]" />
        <div className="absolute bottom-[18.8%] right-[13.8%] h-3 w-4 rounded-sm bg-[#ffcb74] shadow-[0_0_20px_rgba(255,203,116,0.8)]" />
        <div className="absolute bottom-[18.8%] right-[11.6%] h-3 w-4 rounded-sm bg-[#ffcb74] shadow-[0_0_20px_rgba(255,203,116,0.8)]" />
        <div className="absolute bottom-[28%] right-[8.6%] h-12 w-10 rounded-full bg-[#ffffff16] blur-md" />
        <div className="absolute bottom-[30%] right-[8.8%] h-4 w-6 rounded-full bg-[#ffffff18] blur-sm" />
        <div className="absolute bottom-[10%] left-[4%] h-44 w-44 rounded-full bg-[#ffb8d61a] blur-3xl" />
        <div className="absolute bottom-[10%] right-[2%] h-44 w-44 rounded-full bg-[#f0d29f1f] blur-3xl" />
      </div>

      <div className="relative z-10 flex min-h-screen items-center justify-center px-4 py-8">
        <div className="w-full max-w-[430px] rounded-[26px] border border-white/35 bg-[linear-gradient(180deg,rgba(255,255,255,0.16),rgba(255,255,255,0.06))] px-6 py-6 shadow-[0_28px_80px_rgba(15,10,45,0.34)] backdrop-blur-xl sm:px-8 sm:py-7">
          <div className="flex flex-wrap justify-center gap-2">
            <button
              type="button"
              onClick={() => handleModeSwitch('login')}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                mode === 'login' ? 'bg-white text-[#4b3f84] shadow-md' : 'bg-white/10 text-white/88 hover:bg-white/16'
              }`}
            >
              Login
            </button>
            <button
              type="button"
              onClick={() => handleModeSwitch('register')}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                mode === 'register' ? 'bg-white text-[#4b3f84] shadow-md' : 'bg-white/10 text-white/88 hover:bg-white/16'
              }`}
            >
              Sign Up
            </button>
          </div>

          {!inOtpStep && (
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              <button
                type="button"
                onClick={() => handleRoleSwitch('farmer')}
                className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition ${
                  isFarmer ? 'bg-[#ffffff1f] text-white ring-1 ring-white/40' : 'bg-transparent text-white/74 hover:bg-white/10'
                }`}
              >
                <Tractor size={15} />
                Farmer
              </button>
              <button
                type="button"
                onClick={() => handleRoleSwitch('admin')}
                className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition ${
                  !isFarmer ? 'bg-[#ffffff1f] text-white ring-1 ring-white/40' : 'bg-transparent text-white/74 hover:bg-white/10'
                }`}
              >
                <ShieldCheck size={15} />
                Admin
              </button>
            </div>
          )}

          <div className="mt-6 text-center">
            <h1 className="font-[var(--font-sans-app)] text-[1.85rem] font-extrabold tracking-[-0.04em] text-white sm:text-[2.05rem]">
              {heading}
            </h1>
            <p className="mx-auto mt-3 max-w-[290px] text-[0.92rem] leading-6 text-white/76">{subtitle}</p>
          </div>

          {notice && (
            <div className="mt-5 rounded-2xl border border-white/18 bg-white/10 px-4 py-3 text-center text-sm font-semibold text-white/92">
              {notice}
            </div>
          )}

          {!inOtpStep && isFarmer && (
            <form onSubmit={handleFarmerSubmit} className="mt-7 space-y-5">
              {mode === 'register' && (
                <UnderlineField label="Name" icon={<UserRound size={17} />}>
                  <input
                    value={farmerForm.name}
                    onChange={(event) => setFarmerForm((prev) => ({ ...prev, name: event.target.value }))}
                    required
                    placeholder="Enter name"
                    className="w-full bg-transparent text-[0.98rem] text-white outline-none placeholder:text-white/48"
                  />
                </UnderlineField>
              )}

              {mode === 'register' && (
                <UnderlineField label="Email (Optional)" icon={<Mail size={17} />}>
                  <input
                    type="email"
                    value={farmerForm.email}
                    onChange={(event) => setFarmerForm((prev) => ({ ...prev, email: event.target.value }))}
                    placeholder="Enter email for alerts"
                    className="w-full bg-transparent text-[0.98rem] text-white outline-none placeholder:text-white/48"
                  />
                </UnderlineField>
              )}

              <UnderlineField label="Phone Number" icon={<Phone size={17} />}>
                <input
                  value={farmerForm.phone}
                  onChange={(event) => setFarmerForm((prev) => ({ ...prev, phone: event.target.value }))}
                  required
                  placeholder="Enter phone number"
                  className="w-full bg-transparent text-[0.98rem] text-white outline-none placeholder:text-white/48"
                />
              </UnderlineField>

              {error && <div className="rounded-2xl border border-[#ffc7ca66] bg-[#7f243320] px-4 py-3 text-sm font-medium text-[#ffe8e9]">{error}</div>}

              <button
                type="submit"
                disabled={submitting}
                className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-white text-[0.97rem] font-bold text-[#473f83] shadow-[0_18px_34px_rgba(255,255,255,0.16)] transition hover:bg-[#f6f2ff] disabled:cursor-not-allowed disabled:opacity-70"
              >
                {submitting ? 'verifying...' : primaryButtonLabel}
                <ArrowRight size={18} />
              </button>
            </form>
          )}

          {!inOtpStep && !isFarmer && (
            <form onSubmit={handleAdminChallenge} className="mt-7 space-y-5">
              {mode === 'register' && (
                <UnderlineField label="Name" icon={<ShieldCheck size={17} />}>
                  <input
                    value={adminForm.name}
                    onChange={(event) => setAdminForm((prev) => ({ ...prev, name: event.target.value }))}
                    required
                    placeholder="Enter name"
                    className="w-full bg-transparent text-[0.98rem] text-white outline-none placeholder:text-white/48"
                  />
                </UnderlineField>
              )}

              <UnderlineField label="Email" icon={<Mail size={17} />}>
                <input
                  type="email"
                  value={adminForm.email}
                  onChange={(event) => setAdminForm((prev) => ({ ...prev, email: event.target.value }))}
                  required
                  placeholder="Enter email"
                  className="w-full bg-transparent text-[0.98rem] text-white outline-none placeholder:text-white/48"
                />
              </UnderlineField>

              <UnderlineField label="Password" icon={<Lock size={17} />}>
                <input
                  type="password"
                  value={adminForm.password}
                  onChange={(event) => setAdminForm((prev) => ({ ...prev, password: event.target.value }))}
                  required
                  placeholder="Enter password"
                  className="w-full bg-transparent text-[0.98rem] text-white outline-none placeholder:text-white/48"
                />
              </UnderlineField>

              {error && <div className="rounded-2xl border border-[#ffc7ca66] bg-[#7f243320] px-4 py-3 text-sm font-medium text-[#ffe8e9]">{error}</div>}

              <button
                type="submit"
                disabled={submitting}
                className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-white text-[0.97rem] font-bold text-[#473f83] shadow-[0_18px_34px_rgba(255,255,255,0.16)] transition hover:bg-[#f6f2ff] disabled:cursor-not-allowed disabled:opacity-70"
              >
                {submitting ? 'Sending OTP...' : primaryButtonLabel}
                <ArrowRight size={18} />
              </button>
            </form>
          )}

          {inOtpStep && (
            <form onSubmit={handleVerifyOtp} className="mt-7 space-y-5">
              <UnderlineField label="OTP Code" icon={<KeyRound size={17} />}>
                <input
                  value={otp}
                  onChange={(event) => setOtp(event.target.value)}
                  inputMode="numeric"
                  maxLength={6}
                  required
                  placeholder="Enter 6-digit OTP"
                  className="w-full bg-transparent text-[0.98rem] text-white outline-none placeholder:text-white/48"
                />
              </UnderlineField>

              {error && <div className="rounded-2xl border border-[#ffc7ca66] bg-[#7f243320] px-4 py-3 text-sm font-medium text-[#ffe8e9]">{error}</div>}

              <button
                type="submit"
                disabled={submitting}
                className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-white text-[0.97rem] font-bold text-[#473f83] shadow-[0_18px_34px_rgba(255,255,255,0.16)] transition hover:bg-[#f6f2ff] disabled:cursor-not-allowed disabled:opacity-70"
              >
                {submitting ? 'Verifying...' : primaryButtonLabel}
                <ArrowRight size={18} />
              </button>

              <div className="flex items-center justify-center gap-4 text-sm font-semibold text-white/84">
                <button
                  type="button"
                  onClick={() => {
                    resetOtpState();
                    setError('');
                  }}
                  className="transition hover:text-white"
                >
                  Back
                </button>
                <button type="button" onClick={() => void handleResendOtp()} className="transition hover:text-white">
                  Resend OTP
                </button>
              </div>
            </form>
          )}

          {!inOtpStep && switchLine && switchAction && (
            <div className="mt-7 text-center text-sm text-white/82">
              <span>{switchLine} </span>
              <button
                type="button"
                onClick={() => handleModeSwitch(mode === 'register' ? 'login' : 'register')}
                className="font-semibold text-white transition hover:text-white/78"
              >
                {switchAction}
              </button>
              <div className="mt-3 text-xs text-white/70">
                <button
                  type="button"
                  onClick={() => navigate('/owner')}
                  className="font-semibold uppercase tracking-[0.08em] text-white/84 transition hover:text-white"
                >
                  Owner Access
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
