"use client";
import { useRef, useState } from "react";
import type { FormEvent, JSX } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import type { Conversation, Message, UserProfile } from "@devmentor/core";
import { Button } from "@devmentor/ui/components/button";
import { Card } from "@devmentor/ui/components/card";
import { Textarea } from "@devmentor/ui/components/textarea";
import { Feedback, Field, LoadState, Pagination } from "./shared";
import {
  dateTime,
  useAction,
  useResource,
  usePaginatedResource,
} from "./api-client";
export function MessagesPanel({ user }: { user: UserProfile }): JSX.Element {
  const params = useSearchParams();
  const conversations = usePaginatedResource<Conversation>(
    "/conversations",
    user.id,
  );
  const [selected, setSelected] = useState(params.get("conversation") ?? "");
  const [cursor, setCursor] = useState("");
  const [owner, setOwner] = useState(user.id);
  if (owner !== user.id) {
    setOwner(user.id);
    setSelected("");
    setCursor("");
  }
  const active = selected || conversations.data?.[0]?.id || "";
  const messages = useResource<Message[]>(
    active
      ? `/conversations/${active}/messages${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ""}`
      : null,
    user.id,
    cursor ? 0 : 10_000,
  );
  const nextCursor = messages.nextCursor;
  const action = useAction();
  const [draft, setDraft] = useState("");
  const attempt = useRef({ text: "", id: "" });
  function send(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    void action.run(async () => {
      if (attempt.current.text !== draft) {
        attempt.current = { text: draft, id: crypto.randomUUID() };
      }
      await action.mutate(`/conversations/${active}/messages`, {
        text: draft,
        clientMessageId: attempt.current.id,
      });
      setDraft("");
      attempt.current = { text: "", id: "" };
      setCursor("");
      messages.reload();
    }, "Wiadomość wysłana.");
  }
  return (
    <section>
      <h2 className="section-subtitle">
        Rozmowy, które pomagają ruszyć dalej.
      </h2>
      <LoadState {...conversations} retry={conversations.retry}>
        {conversations.data?.length ? (
          <div className="message-grid">
            <aside aria-label="Twoje rozmowy">
              {conversations.data.map((conversation) => (
                <button
                  className="conversation-button"
                  aria-pressed={active === conversation.id}
                  key={conversation.id}
                  onClick={() => {
                    setSelected(conversation.id);
                    setCursor("");
                  }}
                >
                  <strong>{conversation.mentorName}</strong>
                  <span className="block subtle">Rozmowa o mentoringu</span>
                </button>
              ))}
            </aside>
            <Card>
              {messages.refreshError && (
                <p className="notice" role="status">
                  Nie udało się odświeżyć rozmowy. Ponowimy automatycznie;
                  możesz też wybrać „Odśwież”.
                </p>
              )}
              <LoadState {...messages} retry={messages.reload}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h3 className="font-semibold">Wiadomości</h3>
                  <Button variant="ghost" onClick={messages.reload}>
                    Odśwież
                  </Button>
                </div>
                <div className="message-list" aria-label="Historia rozmowy">
                  {messages.data?.length ? (
                    messages.data.map((message) => (
                      <article
                        className={`message ${message.senderId === user.id ? "mine" : ""}`}
                        key={message.id}
                      >
                        <p className="prose-copy">{message.text}</p>
                        <small>
                          {message.senderId === user.id
                            ? "Ty"
                            : "Uczestnik rozmowy"}{" "}
                          · {dateTime(message.createdAt, user.timezone)}
                        </small>
                      </article>
                    ))
                  ) : (
                    <p className="notice">
                      To początek rozmowy. Przedstaw swój cel i napisz, w czym
                      potrzebujesz wsparcia.
                    </p>
                  )}
                </div>
                <div className="actions">
                  {nextCursor && (
                    <Button
                      variant="outline"
                      onClick={() => setCursor(nextCursor)}
                    >
                      Starsze wiadomości
                    </Button>
                  )}
                  {cursor && (
                    <Button variant="ghost" onClick={() => setCursor("")}>
                      Najnowsze wiadomości
                    </Button>
                  )}
                </div>
              </LoadState>
              <form className="form-stack mt-5" onSubmit={send}>
                <Field label="Twoja wiadomość (do 2000 znaków)">
                  <Textarea
                    name="text"
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    minLength={1}
                    maxLength={2000}
                    required
                  />
                </Field>
                <Feedback {...action} />
                <Button disabled={action.busy || !draft.trim()}>
                  Wyślij wiadomość
                </Button>
              </form>
            </Card>
          </div>
        ) : (
          <div className="empty-state">
            <h3 className="section-subtitle">Zacznijmy od kontaktu.</h3>
            <p>Rozmowę rozpoczniesz z profilu wybranego mentora.</p>
            <Button className="mt-5" asChild>
              <Link href="/mentors">Poznaj mentorów</Link>
            </Button>
          </div>
        )}
      </LoadState>
      <Pagination
        {...conversations}
        label="Rozmowy"
        nextPage={() => {
          setSelected("");
          setCursor("");
          conversations.nextPage();
        }}
        previousPage={() => {
          setSelected("");
          setCursor("");
          conversations.previousPage();
        }}
      />
    </section>
  );
}
