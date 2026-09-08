"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { useTranslations } from "next-intl";
import { Icon } from "@/components/ui/Icon";
import { cn } from "@/lib/utils";
import { HOME_ROUTE } from "@/lib/rbac";

const DEMO = { identifier: "admin", password: "123" };

export function LoginForm() {
  const t = useTranslations("auth");
  const router = useRouter();
  const params = useSearchParams();

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [touched, setTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const missingUser = touched && identifier.trim() === "";
  const missingPassword = touched && password === "";

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setTouched(true);
    setError(null);
    if (identifier.trim() === "" || password === "") return;

    setSubmitting(true);
    try {
      const result = await signIn("credentials", {
        identifier: identifier.trim(),
        password,
        redirect: false,
      });
      if (result?.error) {
        setError(t("login_badCreds"));
        return;
      }
      // callbackUrl do proxy gắn khi người dùng bị chặn ở một trang cụ thể.
      const callbackUrl = params.get("callbackUrl");
      router.replace(callbackUrl && callbackUrl.startsWith("/") ? callbackUrl : HOME_ROUTE);
      router.refresh();
    } catch {
      setError(t("login_badCreds"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="auth" data-od-id="login-screen">
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
        <h1 className="card-title">{t("login_title")}</h1>
        <p className="card-sub">{t("login_sub")}</p>

        <div className={cn("err", error && "show")} role="alert">
          <Icon name="alert" size={14} stroke={2} />
          <span>{error}</span>
        </div>

        <form onSubmit={submit} noValidate>
          <div className="fld">
            <div className="fld-label">
              <label htmlFor="identifier">{t("login_userLabel")}</label>
            </div>
            <div className="wrap">
              <Icon name="mail" size={15} stroke={1.7} />
              <input
                className="inp"
                id="identifier"
                name="identifier"
                type="text"
                autoComplete="username"
                placeholder={t("login_userPh")}
                spellCheck={false}
                value={identifier}
                onChange={(event) => setIdentifier(event.target.value)}
                aria-invalid={missingUser || undefined}
              />
            </div>
            <div className={cn("hint", missingUser && "show")}>{t("login_userReq")}</div>
          </div>

          <div className="fld">
            <div className="fld-label">
              <label htmlFor="password">{t("login_pwLabel")}</label>
            </div>
            <div className="wrap">
              <Icon name="lock" size={15} stroke={1.7} />
              <input
                className="inp pw"
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                placeholder="••••••••"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                aria-invalid={missingPassword || undefined}
              />
              <button
                className="peek"
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                aria-pressed={showPassword}
                aria-label={showPassword ? t("login_hidePw") : t("login_showPw")}
              >
                <Icon name={showPassword ? "eyeOff" : "eye"} size={16} stroke={1.7} />
              </button>
            </div>
            <div className={cn("hint", missingPassword && "show")}>{t("login_pwReq")}</div>
          </div>

          <div className="row-between">
            <label className="check">
              <input type="checkbox" defaultChecked />
              <span>{t("login_remember")}</span>
            </label>
            <button
              type="button"
              onClick={() => setError(t("login_forgotMsg"))}
              style={{ color: "var(--primary-ink)", fontWeight: 500, fontSize: 12.5 }}
            >
              {t("login_forgot")}
            </button>
          </div>

          <button className="btn-primary" type="submit" disabled={submitting} data-od-id="cta-sign-in">
            {submitting ? t("login_signingIn") : t("login_signIn")}
          </button>
        </form>

        <button
          className="demo"
          type="button"
          data-od-id="demo-credentials"
          onClick={() => {
            setIdentifier(DEMO.identifier);
            setPassword(DEMO.password);
            setError(null);
          }}
        >
          <span className="demo-ico">
            <Icon name="shield" size={14} stroke={1.8} />
          </span>
          <span className="demo-main">
            <span className="demo-h">{t("login_demoLabel")}</span>
            <span className="demo-v">admin / 123</span>
          </span>
          <span className="demo-cta">{t("login_demoFill")}</span>
        </button>

        <div className="foot">
          <span>{t("login_noAccount")}</span> <Link href="/register">{t("login_createOne")}</Link>
        </div>
      </div>

      <p className="legal">
        <span>{t("login_legal")}</span>
        <br />
        <span className="num">Northport WMS Core v4.2</span>
      </p>
    </main>
  );
}
