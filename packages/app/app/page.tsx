import type { JSX } from "react";
import Link from "next/link";
import { Button } from "@devmentor/ui/components/button";
export default function Home(): JSX.Element {
  return (
    <main id="main" tabIndex={-1}>
      <section className="hero shell">
        <div>
          <p className="eyebrow">MENTORING TECHNOLOGICZNY 1:1</p>
          <h1>
            Twój kolejny
            <br />
            krok w IT.
            <br />
            <em>Z dobrym wsparciem.</em>
          </h1>
          <p className="hero-copy">
            Nie musisz odkrywać wszystkiego samodzielnie. Pracuj z praktykiem,
            który pomoże Ci obrać kierunek, rozwiązać problem i ruszyć dalej.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button size="lg" asChild>
              <Link href="/mentors">
                Znajdź swojego mentora <span aria-hidden="true">↗</span>
              </Link>
            </Button>
            <Button variant="outline" size="lg" asChild>
              <Link href="/mentor">Chcę dzielić się wiedzą</Link>
            </Button>
          </div>
          <p className="hero-note">
            50 minut dla Twojego rozwoju. Bez automatycznych zobowiązań.
          </p>
        </div>
        <div className="hero-art" aria-label="Od celu do kolejnego kroku">
          <div className="orbit-label">Małe kroki. Duża zmiana.</div>
          <div className="growth-line">
            <span>
              01
              <br />
              <b>Twój cel</b>
            </span>
            <i aria-hidden="true">↗</i>
            <span>
              02
              <br />
              <b>Wspólny plan</b>
            </span>
            <i aria-hidden="true">↗</i>
            <span>
              03
              <br />
              <b>Twój postęp</b>
            </span>
          </div>
          <div className="art-caption">
            <span className="avatar-stack" aria-hidden="true">
              <b>IT</b>
              <b>UX</b>
              <b>AI</b>
            </span>
            <div>
              <strong>Doświadczenie, które pomaga.</strong>
              <p>Technologia. Kariera. Praktyka.</p>
            </div>
          </div>
          <span className="art-star" aria-hidden="true">
            ✳
          </span>
        </div>
      </section>
      <section className="shell section-block">
        <p className="eyebrow">TWOJA DROGA, TWOJE TEMPO</p>
        <h2 className="section-title">Nad czym chcesz popracować?</h2>
        <div className="path-grid">
          {[
            {
              n: "01",
              title: "Pierwsza praca w IT",
              text: "Ułóż plan nauki, zbuduj portfolio i przygotuj się do rozmów.",
            },
            {
              n: "02",
              title: "Następny poziom",
              text: "Rozwijaj warsztat, podejmuj lepsze decyzje i przygotuj się do awansu.",
            },
            {
              n: "03",
              title: "Konkretny problem",
              text: "Przyjrzyj się architekturze, kodowi lub wyzwaniu ze swojego projektu.",
            },
          ].map((item) => (
            <Link
              href={`/mentors?q=${encodeURIComponent(item.title)}`}
              className="path-card"
              key={item.n}
            >
              <span>{item.n}</span>
              <h3>{item.title}</h3>
              <p>{item.text}</p>
              <b aria-hidden="true">↗</b>
            </Link>
          ))}
        </div>
      </section>
      <section className="how-section">
        <div className="shell">
          <div className="flex flex-wrap items-end justify-between gap-6">
            <div>
              <p className="eyebrow">PROSTO, PO LUDZKU</p>
              <h2 className="section-title">Od rozmowy do działania.</h2>
            </div>
            <Button variant="outline" asChild>
              <Link href="/mentors">Poznaj mentorów</Link>
            </Button>
          </div>
          <ol className="steps-grid">
            <li>
              <span>1</span>
              <h3>Znajdź dopasowanie</h3>
              <p>
                Wybierz specjalizację, poznaj doświadczenie i sprawdź
                dostępność.
              </p>
            </li>
            <li>
              <span>2</span>
              <h3>Spotkajcie się online</h3>
              <p>Wybierz termin, zobacz cenę i opłać pojedynczą sesję.</p>
            </li>
            <li>
              <span>3</span>
              <h3>Zrób kolejny krok</h3>
              <p>
                Zapisz wnioski, realizuj plan i zdecyduj, czego potrzebujesz
                dalej.
              </p>
            </li>
          </ol>
        </div>
      </section>
    </main>
  );
}
