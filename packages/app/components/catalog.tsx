"use client";
import { useState } from "react";
import { mentorSpecialties } from "./mentor-specialties";
import type { FormEvent, JSX } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import type { Mentor } from "@devmentor/core";
import { Button } from "@devmentor/ui/components/button";
import { Input } from "@devmentor/ui/components/input";
import { Field, LoadState, Badge } from "./shared";
import { formText, money, useResource } from "./api-client";
export function MentorCard({ mentor }: { mentor: Mentor }): JSX.Element {
  const initials = mentor.name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2);
  return (
    <article className="mentor-card">
      <div className="mentor-portrait">
        <span className="monogram" aria-hidden="true">
          {initials}
        </span>
        <Badge>Zweryfikowany profil</Badge>
      </div>
      <div className="mentor-card-body">
        <span className="eyebrow">{mentor.specialty}</span>
        <h2>
          <Link href={`/mentors/${mentor.id}`}>{mentor.name}</Link>
        </h2>
        <p>{mentor.headline}</p>
        <p className="subtle">
          {mentor.years} lat doświadczenia · {mentor.languages.join(" / ")}
        </p>
        <span className="rating">
          {mentor.rating > 0
            ? `★ ${mentor.rating.toFixed(1)} / 5`
            : "Nowy mentor — poznaj profil"}
        </span>
        <div className="mentor-price">
          <strong>
            {money(mentor.priceMinor, mentor.currency)}
            <small>za sesję 50 min</small>
          </strong>
          <Button variant="outline" asChild>
            <Link href={`/mentors/${mentor.id}`}>
              Poznajmy się <span aria-hidden="true">↗</span>
            </Link>
          </Button>
        </div>
      </div>
    </article>
  );
}
export function Catalog(): JSX.Element {
  const params = useSearchParams();
  const initialQuery = params.get("q");
  const [query, setQuery] = useState(() =>
    new URLSearchParams(initialQuery ? { q: initialQuery } : {}).toString(),
  );
  const data = useResource<Mentor[]>(`/mentors?${query}`);
  const nextCursor = data.nextCursor;
  function filter(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const search = new URLSearchParams();
    for (const key of ["q", "specialty", "language", "sort"]) {
      const value = formText(form, key);
      if (value) search.set(key, value);
    }
    const max = formText(form, "maxPriceMinor");
    if (max) search.set("maxPriceMinor", (BigInt(max) * 100n).toString());
    setQuery(search.toString());
  }
  return (
    <>
      <form className="filters" onSubmit={filter}>
        <Field label="Czego chcesz się nauczyć?">
          <Input
            name="q"
            defaultValue={params.get("q") ?? ""}
            maxLength={100}
            placeholder="Technologia, kierunek, imię…"
          />
        </Field>
        <Field label="Specjalizacja">
          <select name="specialty" className="select">
            <option value="">Wszystkie</option>
            {mentorSpecialties.map((specialty) => (
              <option key={specialty.value} value={specialty.value}>
                {specialty.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Język">
          <select name="language" className="select">
            <option value="">Dowolny</option>
            <option value="pl">Polski</option>
            <option value="en">Angielski</option>
          </select>
        </Field>
        <Field label="Budżet (PLN / sesja)">
          <Input
            name="maxPriceMinor"
            type="number"
            min="0"
            max="500"
            step="1"
            placeholder="do 500"
          />
        </Field>
        <Button>Znajdź</Button>
        <Field label="Sortowanie">
          <select name="sort" className="select">
            <option value="recommended">Polecani</option>
            <option value="price">Cena rosnąco</option>
            <option value="experience">Doświadczenie</option>
          </select>
        </Field>
      </form>
      <LoadState {...data} retry={data.reload}>
        <p className="muted mb-5 text-sm">
          {data.data?.length ?? 0} mentorów w tym zestawie wyników
        </p>
        {data.data?.length ? (
          <div className="mentor-grid">
            {data.data.map((mentor) => (
              <MentorCard key={mentor.id} mentor={mentor} />
            ))}
          </div>
        ) : (
          <section className="empty-state">
            <h2>Jeszcze nie ma takiego dopasowania.</h2>
            <p>Zmień frazę lub usuń filtry i sprawdź ponownie.</p>
            <Button
              variant="outline"
              className="mt-5"
              onClick={() => setQuery("")}
            >
              Pokaż wszystkich mentorów
            </Button>
          </section>
        )}
        {nextCursor && (
          <Button
            className="mt-6"
            variant="outline"
            onClick={() => {
              const next = new URLSearchParams(query);
              next.set("cursor", nextCursor);
              setQuery(next.toString());
            }}
          >
            Następna strona
          </Button>
        )}
      </LoadState>
    </>
  );
}
