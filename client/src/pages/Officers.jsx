import { useCallback, useEffect, useState } from 'react';

import { createOfficer, getUsers, setUserPassword, toggleUserActive } from '../lib/api.js';
import { Header, Notice } from './Assets.jsx';
import { CheckIcon, EyeIcon, EyeOffIcon, KeyIcon } from '../components/icons.jsx';

/**
 * Officer logins — administrator only.
 *
 * The administrator assigns each officer a login ID (an email) and a password
 * here, and hands them over out of band. The officer then signs in on the
 * ordinary login page. Nothing on this screen is self-service: an officer can
 * neither create an account nor choose their own password.
 */
export default function Officers() {
  const [users, setUsers] = useState(null);
  const [error, setError] = useState(null);
  const [flash, setFlash] = useState(null);
  const [resetting, setResetting] = useState(null); // userId whose password form is open

  const load = useCallback(async () => {
    setError(null);
    try {
      const { users: list } = await getUsers();
      setUsers(list);
    } catch (err) {
      setError(err.message || 'Could not load accounts.');
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const say = (msg) => {
    setFlash(msg);
    setTimeout(() => setFlash(null), 6000);
  };

  async function toggle(u) {
    try {
      await toggleUserActive(u.userId);
      say(u.active ? `${u.name} can no longer sign in.` : `${u.name} can sign in again.`);
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  const officers = (users || []).filter((u) => u.role !== 'ADMIN');

  return (
    <section className="space-y-7">
      <Header
        eyebrow="Access"
        title="Officer logins"
        subtitle="Assign each officer a login ID and password. Hand the credentials over in person — the officer signs in with them on the login page."
      />

      {error && <Notice tone="error">{error}</Notice>}
      {flash && (
        <div className="flex items-center gap-2 rounded-2xl border border-attributed-bright bg-attributed-tint px-4 py-3 text-sm font-semibold text-attributed-deep">
          <CheckIcon size={15} />
          {flash}
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,380px)_1fr]">
        <CreateForm
          onCreated={(u) => {
            say(`Login assigned: ${u.name} signs in as ${u.email}.`);
            load();
          }}
        />

        <div className="card overflow-hidden">
          <div className="border-b border-line bg-surface px-5 py-3.5 text-xs font-bold uppercase tracking-wider text-ink-muted">
            Accounts ({officers.length})
          </div>
          {users === null ? (
            <p className="px-5 py-6 text-sm text-ink-muted">Loading…</p>
          ) : officers.length === 0 ? (
            <p className="px-5 py-6 text-sm text-ink-muted">No officer accounts yet.</p>
          ) : (
            <ul className="divide-y divide-line">
              {officers.map((u) => (
                <li key={u.userId} className="px-5 py-4">
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                    <div className="min-w-0 flex-1 basis-48">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-ink">{u.name}</span>
                        <span className="pill bg-muted text-ink-muted">{u.roleLabel}</span>
                        {!u.active && (
                          <span className="pill bg-danger-tint text-danger-deep">
                            Access revoked
                          </span>
                        )}
                      </div>
                      <div className="mono mt-1 truncate text-xs text-ink-muted">
                        {u.email || 'no login ID'}
                      </div>
                      {u.dept && <div className="mt-0.5 text-xs text-ink-faint">{u.dept}</div>}
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <button
                        type="button"
                        className="btn-ghost !px-3 !py-1.5 text-xs"
                        onClick={() => setResetting(resetting === u.userId ? null : u.userId)}
                      >
                        <KeyIcon size={13} />
                        Set password
                      </button>
                      <button
                        type="button"
                        className="btn-ghost !px-3 !py-1.5 text-xs"
                        onClick={() => toggle(u)}
                      >
                        {u.active ? 'Revoke access' : 'Restore access'}
                      </button>
                    </div>
                  </div>
                  {resetting === u.userId && (
                    <PasswordForm
                      user={u}
                      onDone={() => {
                        setResetting(null);
                        say(`New password assigned to ${u.name}.`);
                      }}
                      onCancel={() => setResetting(null)}
                    />
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}

/* -- create ------------------------------------------------------------------ */

const EMPTY = { name: '', dept: '', email: '', password: '' };

function CreateForm({ onCreated }) {
  const [form, setForm] = useState(EMPTY);
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const u = await createOfficer(form);
      setForm(EMPTY);
      setShow(false);
      onCreated(u);
    } catch (err) {
      setError(err.message || 'Could not assign the login.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="card space-y-4 p-5" noValidate>
      <div>
        <h3 className="text-base font-bold text-ink">Assign a new officer</h3>
        <p className="mt-1 text-xs leading-relaxed text-ink-muted">
          Creates the account, its login and its encryption keys in one step.
        </p>
      </div>

      <Field label="Full name">
        <input
          className="input"
          value={form.name}
          onChange={set('name')}
          placeholder="Officer U-052"
          required
        />
      </Field>
      <Field label="Department (optional)">
        <input className="input" value={form.dept} onChange={set('dept')} placeholder="Signals" />
      </Field>
      <Field label="Login ID (email)">
        <input
          className="input"
          type="email"
          autoComplete="off"
          autoCapitalize="none"
          spellCheck="false"
          value={form.email}
          onChange={set('email')}
          placeholder="u052@example.gov"
          required
        />
      </Field>
      <Field label="Password">
        <PasswordInput
          value={form.password}
          onChange={set('password')}
          show={show}
          setShow={setShow}
        />
      </Field>

      {error && (
        <p
          role="alert"
          className="rounded-xl bg-danger-tint px-3.5 py-2.5 text-sm text-danger-deep"
        >
          {error}
        </p>
      )}

      <button type="submit" className="btn-accent h-11 w-full" disabled={busy}>
        {busy ? 'Assigning…' : 'Assign login'}
      </button>
    </form>
  );
}

/* -- reset ------------------------------------------------------------------- */

function PasswordForm({ user, onDone, onCancel }) {
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await setUserPassword(user.userId, password);
      onDone();
    } catch (err) {
      setError(err.message || 'Could not set the password.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={submit}
      className="mt-3 space-y-2 rounded-2xl border border-line bg-surface p-3"
      noValidate
    >
      <div className="text-xs font-semibold text-ink-muted">
        New password for <span className="mono text-ink">{user.email}</span>
      </div>
      <div className="flex flex-wrap gap-2">
        <div className="min-w-[200px] flex-1">
          <PasswordInput
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            show={show}
            setShow={setShow}
            autoFocus
          />
        </div>
        <button type="submit" className="btn-accent !px-4" disabled={busy}>
          {busy ? 'Saving…' : 'Save'}
        </button>
        <button type="button" className="btn-ghost !px-4" onClick={onCancel}>
          Cancel
        </button>
      </div>
      {error && <p className="text-xs font-semibold text-danger-deep">{error}</p>}
    </form>
  );
}

/* -- bits -------------------------------------------------------------------- */

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-ink-faint">
        {label}
      </span>
      {children}
    </label>
  );
}

function PasswordInput({ value, onChange, show, setShow, autoFocus }) {
  return (
    <div className="relative">
      <input
        className="input pr-11"
        type={show ? 'text' : 'password'}
        autoComplete="new-password"
        value={value}
        onChange={onChange}
        placeholder="At least 8 characters"
        minLength={8}
        required
        autoFocus={autoFocus}
      />
      <button
        type="button"
        onClick={() => setShow(!show)}
        aria-label={show ? 'Hide password' : 'Show password'}
        className="absolute inset-y-0 right-0 grid w-11 place-items-center text-ink-faint hover:text-ink"
      >
        {show ? <EyeOffIcon size={16} /> : <EyeIcon size={16} />}
      </button>
    </div>
  );
}
