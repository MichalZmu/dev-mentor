"use client";
import type { JSX } from "react";
import type { Mentor } from "@devmentor/core";
import { Button } from "@devmentor/ui/components/button";
import { LoadState, Feedback } from "./shared";
import { useResource, useAction } from "./api-client";
import { MentorCard } from "./catalog";
export function FavoritesPanel(): JSX.Element {
  const favorites = useResource<Mentor[]>("/me/favorites");
  const action = useAction();
  return (
    <section>
      <h2 className="section-subtitle">Mentorzy, do których chcesz wrócić.</h2>
      <LoadState {...favorites} retry={favorites.reload}>
        {favorites.data?.length ? (
          <div className="panel-grid">
            {favorites.data.map((mentor) => (
              <div key={mentor.id}>
                <MentorCard mentor={mentor} />
                <Button
                  variant="ghost"
                  className="mt-2"
                  disabled={action.busy}
                  onClick={() => {
                    void action.run(async () => {
                      await action.mutate(
                        `/favorites/${mentor.id}`,
                        {},
                        "DELETE",
                      );
                      favorites.reload();
                    }, "Mentor usunięty z ulubionych.");
                  }}
                >
                  Usuń z ulubionych
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <p className="notice">
            Zapisz interesujące osoby z ich profilu, aby łatwiej wrócić do
            wyboru.
          </p>
        )}
      </LoadState>
      <Feedback {...action} />
    </section>
  );
}
