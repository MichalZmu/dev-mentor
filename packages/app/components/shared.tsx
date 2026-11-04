"use client";
import Link from "next/link";
import type { JSX, ReactNode } from "react";
import { useEffect } from "react";
import { Button } from "@devmentor/ui/components/button";
import { Input } from "@devmentor/ui/components/input";
import { useResource, type PaginatedResource } from "./api-client";
import type { UserProfile } from "@devmentor/core";

export function AccountNav(): JSX.Element {
  const account = useResource<UserProfile>("/me");
  const config = useResource<{ mode: string }>("/config");
  useEffect(() => {
    window.addEventListener("devmentor-auth-change", account.reload);
    return () =>
      window.removeEventListener("devmentor-auth-change", account.reload);
  }, [account.reload]);
  return (
    <nav aria-label="Konto" className="flex items-center gap-3">
      {config.data?.mode === "demo" && (
        <span
          className="badge"
          title="Lokalny tryb demonstracyjny bez prawdziwych płatności"
        >
          Demo
        </span>
      )}
      <Link href="/mentors" className="nav-link">
        Znajdź mentora
      </Link>
      {account.data ? (
        <Button asChild>
          <Link href="/dashboard">Mój panel</Link>
        </Button>
      ) : (
        <Button variant="outline" asChild>
          <Link href="/auth">Zaloguj się</Link>
        </Button>
      )}
    </nav>
  );
}
export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}): JSX.Element {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {hint && <span className="field-hint">{hint}</span>}
    </label>
  );
}
export function TextField({
  label,
  name,
  defaultValue,
  type = "text",
  required = true,
  minLength,
  maxLength,
  min,
  max,
  placeholder,
}: {
  label: string;
  name: string;
  defaultValue?: string;
  type?: string;
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  min?: string;
  max?: string;
  placeholder?: string;
}): JSX.Element {
  return (
    <Field label={label}>
      <Input
        name={name}
        type={type}
        required={required}
        {...(defaultValue === undefined ? {} : { defaultValue })}
        {...(minLength === undefined ? {} : { minLength })}
        {...(maxLength === undefined ? {} : { maxLength })}
        {...(min === undefined ? {} : { min })}
        {...(max === undefined ? {} : { max })}
        {...(placeholder === undefined ? {} : { placeholder })}
      />
    </Field>
  );
}
export function Feedback({
  busy,
  error,
  notice,
}: {
  busy?: boolean;
  error?: string;
  notice?: string;
}): JSX.Element {
  return (
    <div aria-live="polite" aria-atomic="true">
      {busy && (
        <p role="status" className="notice">
          Trwa zapisywanie…
        </p>
      )}
      {error && (
        <p role="alert" className="notice notice-error">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="notice notice-success">
          {notice}
        </p>
      )}
    </div>
  );
}
export function LoadState({
  loading,
  error,
  retry,
  empty = false,
  children,
}: {
  loading: boolean;
  error: string;
  retry: () => void;
  empty?: boolean;
  children: ReactNode;
}): JSX.Element {
  if (loading)
    return (
      <p role="status" className="notice skeleton">
        Wczytywanie danych…
      </p>
    );
  if (error)
    return (
      <div className="notice notice-error" role="alert">
        <p>{error}</p>
        <Button variant="outline" onClick={retry}>
          Spróbuj ponownie
        </Button>
        <Link className="text-link" href="/auth">
          Zaloguj się lub utwórz konto
        </Link>
      </div>
    );
  if (empty)
    return <p className="notice">Nie ma jeszcze danych do wyświetlenia.</p>;
  return <>{children}</>;
}
export function Badge({ children }: { children: ReactNode }): JSX.Element {
  return <span className="badge">{children}</span>;
}
export function Status({ value }: { value: string }): JSX.Element {
  const labels: Record<string, string> = {
    held: "Termin wstępnie zarezerwowany",
    confirmed: "Potwierdzona",
    completed: "Zakończona",
    cancelled: "Anulowana",
    expired: "Rezerwacja wygasła",
    pending: "W toku",
    paid: "Opłacona",
    failed: "Nieudana",
    requested: "Zlecony",
    succeeded: "Zrealizowany",
    none: "Brak",
    approved: "Zatwierdzona",
    rejected: "Odrzucona",
    open: "Otwarta",
    resolved: "Rozwiązana",
    active: "Aktywny",
    paused: "Wstrzymany",
  };
  return <Badge>{labels[value] ?? value}</Badge>;
}

export function Pagination({
  label,
  pageNumber,
  hasPrevious,
  nextCursor,
  loading,
  error,
  previousPage,
  nextPage,
}: Pick<
  PaginatedResource<unknown>,
  | "pageNumber"
  | "hasPrevious"
  | "nextCursor"
  | "loading"
  | "error"
  | "previousPage"
  | "nextPage"
> & { label: string }): JSX.Element | null {
  if (!hasPrevious && !nextCursor) return null;
  return (
    <nav
      aria-label={`Stronicowanie: ${label}`}
      aria-busy={loading}
      className="actions mt-5"
    >
      <Button
        type="button"
        variant="outline"
        disabled={!hasPrevious || loading}
        onClick={previousPage}
      >
        Poprzednia strona
      </Button>
      <span
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="subtle"
      >
        Strona {pageNumber}
      </span>
      <Button
        type="button"
        variant="outline"
        disabled={!nextCursor || loading || Boolean(error)}
        onClick={nextPage}
      >
        Następna strona
      </Button>
    </nav>
  );
}
