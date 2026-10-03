"use client";
import { Eye, EyeOff, LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";

export function LoginForm() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const result = await authClient.signIn.email({
      email: String(form.get("email")),
      password: String(form.get("password")),
      rememberMe: false,
    });
    if (result.error) {
      setError("Email atau kata sandi tidak sesuai.");
      setBusy(false);
      return;
    }
    router.replace("/dashboard");
    router.refresh();
  }
  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <label className="label" htmlFor="email">
          Email dinas
        </label>
        <input
          className="field"
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          required
          placeholder="nama@mabeslink.local"
        />
      </div>
      <div>
        <label className="label" htmlFor="password">
          Kata sandi
        </label>
        <div className="relative">
          <input
            className="field pr-11"
            id="password"
            name="password"
            type={show ? "text" : "password"}
            minLength={12}
            autoComplete="current-password"
            required
          />
          <button
            type="button"
            onClick={() => setShow(!show)}
            className="absolute inset-y-0 right-0 grid w-11 place-items-center text-slate-500"
            aria-label={
              show ? "Sembunyikan kata sandi" : "Tampilkan kata sandi"
            }
          >
            {show ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>
      </div>
      {error ? (
        <p
          role="alert"
          className="rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-700"
        >
          {error}
        </p>
      ) : null}
      <Button className="w-full" size="lg" disabled={busy}>
        {busy ? <LoaderCircle className="animate-spin" size={18} /> : null}
        {busy ? "Memeriksa…" : "Masuk"}
      </Button>
    </form>
  );
}
