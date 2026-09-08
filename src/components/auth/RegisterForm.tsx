"use client";

import { useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Icon } from "@/components/ui/Icon";
import { apiPost, RequestError } from "@/lib/client";
import { cn } from "@/lib/utils";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD = 8;

/** Điểm mạnh mật khẩu: dài >= 8, có chữ thường/hoa, số và ký tự đặc biệt. */
function strengthOf(password: string): 0 | 1 | 2 | 3 | 4 {
  if (!password) return 0;
  let score = 0;
  if (password.length >= MIN_PASSWORD) score++;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
  if (/\d/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;
  return Math.min(score, 4) as 0 | 1 | 2 | 3 | 4;
}

const STRENGTH_COLOR = ["", "var(--mark-bad)", "var(--mark-warn)", "var(--mark-warn)", "var(--mark-ok)"];

export function RegisterForm() {
  const t = useTranslations("auth");

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [touched, setTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState<string | null>(null);

  const badName = touched && name.trim() === "";
  const badEmail = touched && !EMAIL_RE.test(email.trim());
  const badPassword = touched && password.length < MIN_PASSWORD;
  const mismatch = touched && confirm !== password;
  const matched = confirm !== "" && confirm === password;
  const strength = strengthOf(password);
  const strengthLabel = [null, t("register_sWeak"), t("register_sFair"), t("register_sGood"), t("register_sStrong")][
    strength
  ];

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setTouched(true);
    setError(null);
    if (name.trim() === "" || !EMAIL_RE.test(email.trim()) || password.length < MIN_PASSWORD || confirm !== password) {
      setError(t("register_errFix"));
      return;
    }

    setSubmitting(true);
    try {
      await apiPost("/api/auth/register", {
        name: name.trim(),
        email: email.trim(),
        password,
      });
      setDone(name.trim());
    } catch (requestError) {
      setError(
        requestError instanceof RequestError ? requestError.message : t("register_errFix"),
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="auth" data-od-id="register-screen">
      <div className="brand" data-od-id="brand-lockup">
        <div className="brand-mark" aria-hidden="true">
          N
        </div>
        <div>
          <div className="brand-name">Northport WMS</div>
          <div className="brand-sub">Warehouse Core</div>
        </div>
      </div>

      <div className="card">
        {done ? (
          <div className="done show" data-od-id="register-success">
            <div className="done-ico">
              <Icon name="check" size={22} stroke={2.4} />
            </div>
            <div className="done-h">{t("register_doneH")}</div>
            <p className="done-p">
              <b>{done}</b> — {t("register_tierStaff")}
            </p>
            <Link className="btn-primary" href="/login">
              {t("register_doneCta")}
            </Link>
          </div>
        ) : (
          <>
            <h1 className="card-title">{t("register_title")}</h1>
            <p className="card-sub">{t("register_sub")}</p>

            <div className={cn("err", error && "show")} role="alert">
              <Icon name="alert" size={14} stroke={2} />
              <span>{error}</span>
            </div>

            <form onSubmit={submit} noValidate>
              <div className="fld">
                <div className="fld-label">
                  <label htmlFor="name">{t("register_nameLabel")}</label>
                </div>
                <div className="wrap">
                  <Icon name="user" size={15} stroke={1.7} />
                  <input
                    className="inp"
                    id="name"
                    type="text"
                    autoComplete="name"
                    placeholder={t("register_namePh")}
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    aria-invalid={badName || undefined}
                  />
                </div>
                <div className={cn("hint", badName && "show")}>{t("register_nameReq")}</div>
              </div>

              <div className="fld">
                <div className="fld-label">
                  <label htmlFor="email">{t("register_emailLabel")}</label>
                </div>
                <div className="wrap">
                  <Icon name="mail" size={15} stroke={1.7} />
                  <input
                    className="inp"
                    id="email"
                    type="email"
                    autoComplete="email"
                    placeholder="name@northport.ops"
                    spellCheck={false}
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    aria-invalid={badEmail || undefined}
                  />
                </div>
                <div className={cn("hint", badEmail && "show")}>{t("register_emailReq")}</div>
              </div>

              <div className="fld">
                <div className="fld-label">
                  <label htmlFor="password">{t("register_pwLabel")}</label>
                  {strengthLabel && (
                    <span className="strength-label" style={{ color: STRENGTH_COLOR[strength] }}>
                      {strengthLabel}
                    </span>
                  )}
                </div>
                <div className="wrap">
                  <Icon name="lock" size={15} stroke={1.7} />
                  <input
                    className="inp pw"
                    id="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    aria-invalid={badPassword || undefined}
                  />
                  <button
                    className="peek"
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-pressed={showPassword}
                    aria-label={showPassword ? t("register_hidePw") : t("register_showPw")}
                  >
                    <Icon name={showPassword ? "eyeOff" : "eye"} size={16} stroke={1.7} />
                  </button>
                </div>
                <div className="meter" aria-hidden="true">
                  {[1, 2, 3, 4].map((step) => (
                    <i
                      key={step}
                      style={{
                        background: strength >= step ? STRENGTH_COLOR[strength] : "var(--surface-press)",
                      }}
                    />
                  ))}
                </div>
                <div className="meter-note">{t("register_pwRule")}</div>
                <div className={cn("hint", badPassword && "show")}>{t("register_pwReq")}</div>
              </div>

              <div className="fld">
                <div className="fld-label">
                  <label htmlFor="confirm">{t("register_pw2Label")}</label>
                </div>
                <div className="wrap">
                  <Icon name="lock" size={15} stroke={1.7} />
                  <input
                    className="inp pw"
                    id="confirm"
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    placeholder="••••••••"
                    value={confirm}
                    onChange={(event) => setConfirm(event.target.value)}
                    aria-invalid={mismatch || undefined}
                  />
                </div>
                <div className={cn("hint", mismatch && "show")}>{t("register_pw2Req")}</div>
                <div className={cn("ok-note", matched && !mismatch && "show")}>
                  <Icon name="check" size={13} stroke={2.4} />
                  <span>{t("register_pwMatch")}</span>
                </div>
              </div>

              {/* Mọi tài khoản mới đều là STAFF — ràng buộc ở cả API. */}
              <div className="notice" data-od-id="role-notice">
                <span className="notice-ico">
                  <Icon name="shield" size={13} stroke={1.8} />
                </span>
                <span className="notice-txt">
                  {t("register_notice", { tier: t("register_tierStaff") })}
                </span>
              </div>

              <button className="btn-primary" type="submit" disabled={submitting} data-od-id="cta-register">
                {t("register_createAccount")}
              </button>
            </form>

            <div className="foot">
              <span>{t("register_haveAccount")}</span> <Link href="/login">{t("register_signIn")}</Link>
            </div>
          </>
        )}
      </div>

      <p className="legal">
        <span>{t("register_legal")}</span>
      </p>
    </main>
  );
}
