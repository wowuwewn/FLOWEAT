"use client";
import { useEffect, useState } from "react";
import { ServerBackend, type BackendInfo, type OrderBackend } from "@/client/backend";
import { adoptStaffKeyFromHash, operatorKeyStored, saveOperatorKey, saveStaffKey, staffKeyFor } from "@/client/session";
import { Logo } from "@/components/brand/Logo";

export type StaffAuth = "unknown" | "ok" | "needed";

/** Laptop server mode: staff actions need this session's staff key (or the operator key). Device mode: always ok. */
export function useStaffAuth(backend: OrderBackend | null, info: BackendInfo | null, demo: { session: string } | null) {
  const [auth, setAuth] = useState<StaffAuth>("unknown");
  const [authMsg, setAuthMsg] = useState<string | null>(null);
  useEffect(() => {
    if (!info || !demo) return;
    if (info.kind !== "server") return setAuth("ok");
    adoptStaffKeyFromHash(demo.session);
    if (staffKeyFor(demo.session)) return setAuth("ok");
    if (operatorKeyStored() && backend instanceof ServerBackend) {
      backend
        .issueStaffKey(demo.session)
        .then((k) => {
          saveStaffKey(demo.session, k);
          setAuth("ok");
        })
        .catch(() => setAuth("needed"));
      return;
    }
    setAuth("needed");
  }, [info, demo, backend]);
  return { auth, setAuth, authMsg, setAuthMsg };
}

export function StaffAuthForm({ session, backend, msg, setMsg, onOk }: { session: string; backend: OrderBackend | null; msg: string | null; setMsg: (m: string | null) => void; onOk: () => void }) {
  const [keyInput, setKeyInput] = useState("");
  const submit = async () => {
    const v = keyInput.trim();
    if (!v) return;
    setMsg(null);
    try {
      // operator key? → issue this session's staff key with it
      const probe = await fetch(`/api/sessions/${session}/staff-key`, { method: "POST", headers: { "x-floweat-operator": v } });
      if (probe.ok) {
        saveOperatorKey(v);
        saveStaffKey(session, (await probe.json()).staffKey);
        return onOk();
      }
      // otherwise treat it as a staff key and check that the server gives the staff view
      saveStaffKey(session, v);
      const r = await backend!.sessionOrders(session);
      if (r.view === "staff") return onOk();
      saveStaffKey(session, "");
      setMsg("키가 맞지 않아요. 운영자에게 이 세션의 직원 연결 QR을 다시 받아 주세요.");
    } catch {
      setMsg("확인하지 못했어요. 다시 시도해 주세요.");
    }
  };
  return (
    <div className="grid min-h-dvh place-items-center bg-[#11192b] px-5 text-white">
      <form
        className="w-full max-w-md"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <div className="flex items-center gap-2">
          <Logo size={24} tone="white" />
          <p className="text-[14px] font-semibold opacity-80">매장 직원 기기 (모의)</p>
        </div>
        <h1 className="mt-3 text-[24px] font-bold">직원 인증이 필요해요</h1>
        <p className="mt-1 text-[14.5px] leading-relaxed opacity-80">
          세션 {session}의 주문을 완료 처리하려면 운영자가 체험 홈에서 보여 주는 <b>직원 연결 QR</b>을 찍거나, 직원 키를 입력하세요. 세션 코드만으로는 완료할 수 없어요.
        </p>
        <label className="mt-5 block text-[13px] font-semibold opacity-80" htmlFor="staff-key">
          직원 키 또는 운영자 키
        </label>
        <input id="staff-key" value={keyInput} onChange={(e) => setKeyInput(e.target.value)} autoComplete="off" className="mt-1 h-12 w-full rounded-xl bg-white/10 px-4 text-[16px] ring-1 ring-white/20 outline-none focus:ring-white/60" />
        {msg && (
          <p role="alert" className="mt-2 text-[14px] text-[#ffb4b6]">
            {msg}
          </p>
        )}
        <button className="mt-4 h-12 w-full rounded-xl bg-blue text-[16px] font-bold">연결</button>
      </form>
    </div>
  );
}
