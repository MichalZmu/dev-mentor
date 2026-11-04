"use client";
import type { FormEvent, JSX } from "react";
import Link from "next/link";
import { Button } from "@devmentor/ui/components/button";
import { Card, CardTitle } from "@devmentor/ui/components/card";
import { Textarea } from "@devmentor/ui/components/textarea";
import { Feedback, Field, LoadState } from "./shared";
import { formText, useAction, useResource } from "./api-client";
interface Goals {
  goal: string;
  level: string;
  description: string;
}
interface Plan {
  id: string;
  goal: string;
  milestones: { id: string; title: string; completed: boolean }[];
  version: number;
}
export function DevelopmentPanel(): JSX.Element {
  const goals = useResource<Goals>("/me/goals");
  const plan = useResource<Plan>("/me/learning-plan");
  const action = useAction();
  function save(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    void action.run(async () => {
      await action.mutate(
        "/me/goals",
        {
          goal: formText(form, "goal"),
          level: formText(form, "level"),
          description: formText(form, "description"),
        },
        "PUT",
      );
      goals.reload();
      plan.reload();
    }, "Cel zapisany. Teraz pora na kolejne małe kroki.");
  }
  const currentPlan = plan.data;
  const completed =
    currentPlan?.milestones.filter((item) => item.completed).length ?? 0;
  const total = currentPlan?.milestones.length ?? 0;
  return (
    <div className="panel-grid">
      <Card>
        <CardTitle>Twój kierunek</CardTitle>
        <p className="muted text-sm mb-5">
          Dobry plan zaczyna się od tego, czego potrzebujesz.
        </p>
        <LoadState {...goals} retry={goals.reload}>
          <form className="form-stack" onSubmit={save}>
            <Field label="Główny cel">
              <select
                name="goal"
                className="select"
                defaultValue={goals.data?.goal ?? "career"}
              >
                <option value="career">Kolejny krok w karierze</option>
                <option value="first-job">Pierwsza praca w IT</option>
                <option value="skills">Rozwój umiejętności</option>
                <option value="project">Konkretny projekt</option>
              </select>
            </Field>
            <Field label="Twój poziom">
              <select
                name="level"
                className="select"
                defaultValue={goals.data?.level ?? "beginner"}
              >
                <option value="beginner">Zaczynam</option>
                <option value="intermediate">Mam już doświadczenie</option>
                <option value="advanced">Zaawansowany</option>
              </select>
            </Field>
            <Field label="Opisz, co chcesz osiągnąć (20–500 znaków)">
              <Textarea
                name="description"
                minLength={20}
                maxLength={500}
                defaultValue={goals.data?.description ?? ""}
                required
              />
            </Field>
            <Button disabled={action.busy}>Zapisz swój cel</Button>
          </form>
        </LoadState>
        <Feedback {...action} />
      </Card>
      <Card>
        <CardTitle>Małe kroki, widoczny postęp</CardTitle>
        <LoadState {...plan} retry={plan.reload}>
          {total > 0 ? (
            <>
              <p className="my-4 text-sm">
                Zrobione: {completed} z {total}
              </p>
              <progress
                aria-label="Postęp planu rozwoju"
                max={total}
                value={completed}
                className="w-full accent-green-800"
              />
              <div className="item-list mt-5">
                {currentPlan?.milestones.map((milestone) => (
                  <label className="check-label" key={milestone.id}>
                    <input
                      type="checkbox"
                      checked={milestone.completed}
                      disabled={action.busy}
                      onChange={(event) => {
                        const checked = event.target.checked;
                        void action.run(async () => {
                          await action.mutate(
                            `/learning-plans/${currentPlan.id}/milestones/${milestone.id}`,
                            {
                              completed: checked,
                              version: currentPlan.version,
                            },
                            "PATCH",
                          );
                          plan.reload();
                        });
                      }}
                    />
                    <span>{milestone.title}</span>
                  </label>
                ))}
              </div>
            </>
          ) : (
            <p className="notice">
              Uzupełnij swój cel, aby zacząć pracę nad planem.
            </p>
          )}
        </LoadState>
        <Link className="text-link inline-block mt-6" href="/mentors">
          Znajdź wsparcie w realizacji planu ↗
        </Link>
      </Card>
    </div>
  );
}
