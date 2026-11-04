"use client";
import { useState } from "react";
import type { FormEvent, JSX } from "react";
import type { AuditEntry, Case, UserProfile } from "@devmentor/core";
import { Button } from "@devmentor/ui/components/button";
import { Card, CardTitle } from "@devmentor/ui/components/card";
import { Textarea } from "@devmentor/ui/components/textarea";
import { Feedback, Field, LoadState, Pagination, Status } from "./shared";
import {
  dateTime,
  formText,
  useAction,
  useResource,
  usePaginatedResource,
} from "./api-client";
export function AdminWorkspace(): JSX.Element {
  const me = useResource<UserProfile>("/me");
  return (
    <LoadState {...me} retry={me.reload}>
      {me.data &&
        (me.data.roles.some((role) =>
          ["admin", "moderator", "support"].includes(role),
        ) ? (
          <AdminQueues key={me.data.id} userId={me.data.id} />
        ) : (
          <Card>
            <CardTitle>Ta przestrzeń wymaga dodatkowych uprawnień.</CardTitle>
            <p className="muted mt-3">
              Twoje konto nie ma dostępu do administracji. W razie potrzeby
              skontaktuj się z osobą prowadzącą projekt.
            </p>
          </Card>
        ))}
    </LoadState>
  );
}
function AdminQueues({ userId }: { userId: string }): JSX.Element {
  const [kind, setKind] = useState<"mentor-applications" | "support-tickets">(
    "mentor-applications",
  );
  const [selected, setSelected] = useState("");
  const overview = useResource<Record<string, number>>("/admin/overview");
  const cases = usePaginatedResource<Case>(`/admin/${kind}`, userId);
  return (
    <>
      <div className="metric-grid">
        <div className="metric">
          <strong>{overview.data?.pendingApplications ?? "—"}</strong>
          <span>Zgłoszenia mentorów</span>
        </div>
        <div className="metric">
          <strong>{overview.data?.openTickets ?? "—"}</strong>
          <span>Sprawy wymagające pomocy</span>
        </div>
        <div className="metric">
          <strong>Jawny ślad</strong>
          <span>Każda decyzja z uzasadnieniem</span>
        </div>
      </div>
      <div className="tabs" role="group" aria-label="Kolejki administracji">
        <button
          aria-pressed={kind === "mentor-applications"}
          onClick={() => {
            setKind("mentor-applications");
            setSelected("");
          }}
        >
          Zgłoszenia mentorów
        </button>
        <button
          aria-pressed={kind === "support-tickets"}
          onClick={() => {
            setKind("support-tickets");
            setSelected("");
          }}
        >
          Zgłoszenia pomocy
        </button>
      </div>
      <div className="panel-grid">
        <Card>
          <CardTitle>Kolejka spraw</CardTitle>
          <LoadState {...cases} retry={cases.retry}>
            {cases.data?.length ? (
              <div className="table-scroll mt-5">
                <table className="data-table">
                  <caption className="sr-only">Sprawy do rozpatrzenia</caption>
                  <thead>
                    <tr>
                      <th scope="col">Sprawa</th>
                      <th scope="col">Status</th>
                      <th scope="col">Akcja</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cases.data.map((item) => (
                      <tr key={item.id}>
                        <td>
                          <strong>
                            {typeof item.payload.name === "string"
                              ? item.payload.name
                              : typeof item.payload.category === "string"
                                ? item.payload.category
                                : item.id.slice(0, 8)}
                          </strong>
                          <span className="block subtle">
                            {dateTime(item.createdAt)}
                          </span>
                        </td>
                        <td>
                          <Status value={item.status} />
                        </td>
                        <td>
                          <Button
                            variant="outline"
                            onClick={() => setSelected(item.id)}
                          >
                            Otwórz sprawę
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="notice">
                W tej kolejce nie ma spraw. Wszystko jest na bieżąco.
              </p>
            )}
          </LoadState>
          <Pagination
            {...cases}
            label={
              kind === "mentor-applications"
                ? "Zgłoszenia mentorów"
                : "Zgłoszenia pomocy"
            }
            nextPage={() => {
              setSelected("");
              cases.nextPage();
            }}
            previousPage={() => {
              setSelected("");
              cases.previousPage();
            }}
          />
        </Card>
        {selected ? (
          <CaseReview
            key={selected}
            id={selected}
            updated={() => {
              cases.reload();
              overview.reload();
            }}
          />
        ) : (
          <Card>
            <CardTitle>Każda decyzja ma kontekst.</CardTitle>
            <p className="muted mt-4">
              Wybierz sprawę z kolejki, przeczytaj jej szczegóły i zapisz
              uzasadnienie. Obsługa zgłoszenia nie uruchamia automatycznie
              zwrotu płatności.
            </p>
          </Card>
        )}
      </div>
    </>
  );
}
function CaseReview({
  id,
  updated,
}: {
  id: string;
  updated: () => void;
}): JSX.Element {
  const detail = useResource<{ item: Case; audit: AuditEntry[] }>(
    `/admin/cases/${id}`,
  );
  const action = useAction();
  function decide(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    void action.run(async () => {
      await action.mutate(`/admin/cases/${id}/decision`, {
        action: formText(form, "action"),
        reason: formText(form, "reason"),
        version: detail.data?.item.version,
      });
      detail.reload();
      updated();
    }, "Decyzja zapisana wraz z uzasadnieniem.");
  }
  return (
    <Card>
      <CardTitle>Szczegóły sprawy</CardTitle>
      <LoadState {...detail} retry={detail.reload}>
        {detail.data && (
          <>
            <p className="subtle mt-3">Numer: {detail.data.item.id}</p>
            <Status value={detail.data.item.status} />
            <dl className="mt-5 text-sm">
              {[
                { key: "name", title: "Osoba" },
                { key: "headline", title: "Nagłówek" },
                { key: "bio", title: "Doświadczenie" },
                { key: "specialty", title: "Specjalizacja" },
                { key: "category", title: "Kategoria" },
                { key: "description", title: "Opis sprawy" },
              ].map((field) => {
                const value = detail.data?.item.payload[field.key];
                return typeof value === "string" ? (
                  <div className="data-row" key={field.key}>
                    <dt className="font-semibold">{field.title}</dt>
                    <dd className="prose-copy mt-2">{value}</dd>
                  </div>
                ) : null;
              })}
            </dl>
            {["pending", "open"].includes(detail.data.item.status) ? (
              <form onSubmit={decide} className="form-stack data-row">
                <Field label="Decyzja">
                  <select name="action" className="select">
                    {detail.data.item.kind === "mentor_application" ? (
                      <>
                        <option value="approve">
                          Zatwierdź profil mentora
                        </option>
                        <option value="reject">Odrzuć zgłoszenie</option>
                      </>
                    ) : (
                      <option value="resolve">Rozwiąż zgłoszenie pomocy</option>
                    )}
                  </select>
                </Field>
                <Field label="Uzasadnienie decyzji (10–1000 znaków)">
                  <Textarea
                    name="reason"
                    required
                    minLength={10}
                    maxLength={1000}
                  />
                </Field>
                <Button disabled={action.busy}>Zapisz decyzję</Button>
              </form>
            ) : (
              <p className="notice">
                Decyzja:{" "}
                {detail.data.item.decisionReason ??
                  "Sprawa nie wymaga dalszej decyzji."}
              </p>
            )}
            <h3 className="font-semibold mt-6">Historia zmian</h3>
            {detail.data.audit.length ? (
              detail.data.audit.map((entry) => (
                <article className="data-row text-sm" key={entry.id}>
                  <strong>{entry.action}</strong>
                  <p className="prose-copy">{entry.reason}</p>
                  <p className="subtle">
                    {dateTime(entry.createdAt)} · {entry.actorId}
                  </p>
                </article>
              ))
            ) : (
              <p className="subtle mt-3">Nie zapisano jeszcze decyzji.</p>
            )}
          </>
        )}
      </LoadState>
      <Feedback {...action} />
    </Card>
  );
}
