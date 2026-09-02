"use client";

import {
  FormEvent,
  useState,
} from "react";

import { useRouter } from "next/navigation";

export default function AdminLoginPage() {
  const router =
    useRouter();

  const [
    password,
    setPassword,
  ] =
    useState("");

  const [
    error,
    setError,
  ] =
    useState("");

  const [
    loading,
    setLoading,
  ] =
    useState(false);

  async function handleSubmit(
    event: FormEvent
  ) {
    event.preventDefault();

    setLoading(true);
    setError("");

    try {
      const response =
        await fetch(
          "/api/admin/login",
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify({
                password,
              }),
          }
        );

      const data =
        (await response.json()) as {
          success?: boolean;
          error?: string;
        };

      if (
        !response.ok ||
        !data.success
      ) {
        setError(
          data.error ??
            "Não foi possível entrar."
        );

        return;
      }

      router.push(
        "/admin/pedidos"
      );

      router.refresh();
    }
    catch {
      setError(
        "Não foi possível entrar."
      );
    }
    finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#fffdf9] px-5">
      <div className="w-full max-w-md rounded-[28px] border border-[#eadfd9] bg-white p-8 shadow-xl">
        <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-[#a0742b]">
          Bio Florais
        </p>

        <h1 className="mt-3 font-serif text-4xl font-semibold text-[#422347]">
          Área Administrativa
        </h1>

        <p className="mt-3 text-sm leading-6 text-[#756674]">
          Entre com a senha administrativa.
        </p>

        <form
          onSubmit={
            handleSubmit
          }
          className="mt-7"
        >
          <label className="text-sm font-bold text-[#422347]">
            Senha
          </label>

          <input
            type="password"
            value={
              password
            }
            onChange={
              (event) =>
                setPassword(
                  event.target.value
                )
            }
            className="mt-2 w-full rounded-xl border border-[#dfd1d9] px-4 py-3 outline-none focus:border-[#63326d]"
            autoFocus
          />

          {error && (
            <p className="mt-3 text-sm font-bold text-red-600">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={
              loading
            }
            className="mt-6 w-full rounded-full bg-[#63326d] px-6 py-3 font-extrabold text-white"
          >
            {loading
              ? "Entrando..."
              : "Entrar"}
          </button>
        </form>
      </div>
    </main>
  );
}
