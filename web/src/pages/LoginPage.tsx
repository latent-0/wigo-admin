import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { ApiError } from '../api/client';

type Mode = 'otp' | 'password';

export function LoginPage() {
  const { user, requestOtp, verifyOtp, loginWithPassword } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>('otp');
  const [phone, setPhone] = useState('+5215500000001');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [devCode, setDevCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (user) {
    navigate('/dashboard', { replace: true });
  }

  const wrap = async (fn: () => Promise<void>) => {
    setError(null);
    setBusy(true);
    try {
      await fn();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  };

  const onRequestOtp = () =>
    wrap(async () => {
      const { devCode: dc } = await requestOtp(phone);
      setOtpSent(true);
      setDevCode(dc ?? null);
    });

  const onVerify = () =>
    wrap(async () => {
      await verifyOtp(phone, code);
      navigate('/dashboard', { replace: true });
    });

  const onPassword = () =>
    wrap(async () => {
      await loginWithPassword(phone, password);
      navigate('/dashboard', { replace: true });
    });

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="brand brand-lg">
          <span className="brand-mark">W</span>
          <span className="brand-text">WIGO Admin</span>
        </div>
        <p className="muted">Sign in with your WhatsApp number.</p>

        <div className="tabs">
          <button className={mode === 'otp' ? 'tab active' : 'tab'} onClick={() => setMode('otp')}>
            WhatsApp code
          </button>
          <button className={mode === 'password' ? 'tab active' : 'tab'} onClick={() => setMode('password')}>
            Password
          </button>
        </div>

        <label className="field">
          <span>Phone (E.164)</span>
          <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+5215500000001" />
        </label>

        {mode === 'otp' ? (
          <>
            {!otpSent ? (
              <button className="btn btn-primary" disabled={busy} onClick={onRequestOtp}>
                {busy ? 'Sending…' : 'Send WhatsApp code'}
              </button>
            ) : (
              <>
                {devCode && (
                  <div className="dev-hint">
                    Dev code (fake WhatsApp adapter): <strong>{devCode}</strong>
                  </div>
                )}
                <label className="field">
                  <span>6-digit code</span>
                  <input value={code} onChange={(e) => setCode(e.target.value)} inputMode="numeric" maxLength={6} />
                </label>
                <button className="btn btn-primary" disabled={busy} onClick={onVerify}>
                  {busy ? 'Verifying…' : 'Verify & sign in'}
                </button>
              </>
            )}
          </>
        ) : (
          <>
            <label className="field">
              <span>Password</span>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
            </label>
            <button className="btn btn-primary" disabled={busy} onClick={onPassword}>
              {busy ? 'Signing in…' : 'Sign in'}
            </button>
          </>
        )}

        {error && <div className="error-box">{error}</div>}
      </div>
    </div>
  );
}
