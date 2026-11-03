import Link from "next/link";
import { Button } from "@devmentor/ui/components/button";

export default function AdminPreview() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center gap-6 px-6 py-16">
      <p className="text-sm font-medium text-muted-foreground">DevMentor</p>
      <h1 className="text-3xl font-semibold tracking-tight">Panel administracyjny</h1>
      <p className="text-muted-foreground">
        Podgląd interfejsu. Funkcje administracyjne będą dostępne po wdrożeniu logowania i uprawnień.
      </p>
      <div className="flex flex-wrap gap-3">
        <Button asChild><Link href="/">Wróć do strony głównej</Link></Button>
        <Button variant="outline" disabled>Wkrótce</Button>
      </div>
    </main>
  );
}
