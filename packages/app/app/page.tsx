import Link from "next/link";
import { withAppServices } from "@/server/services";

export default async function Home() {
  const info = await withAppServices(({ applicationInfo }) => applicationInfo);
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center gap-6 px-6 py-16">
      <p className="text-sm font-medium text-muted-foreground">Rozwijaj się krok po kroku</p>
      <h1 className="text-5xl font-semibold tracking-tight">{info.name}</h1>
      <p className="text-xl text-muted-foreground">{info.description}</p>
      <Link href="/admin" className="w-fit text-sm font-medium underline underline-offset-4">
        Zobacz podgląd panelu
      </Link>
    </main>
  );
}
