/**
 * Screen 2 — Problem / relate. Quiet, conversational, no slogans.
 * Three short lines the user has literally muttered out loud at
 * some point. The point is recognition, not persuasion.
 */

import { i18n } from "#i18n";

const QUESTIONS = ["q1", "q2", "q3"] as const;

export function ProblemScreen() {
  return (
    <div className="animate-in fade-in-0 slide-in-from-right-2 flex flex-col gap-5 duration-300 ease-(--ease-out)">
      <div className="animate-in fade-in-0 slide-in-from-bottom-1 fill-mode-both flex flex-col gap-1.5 duration-300 ease-(--ease-out)">
        <h2 className="text-foreground text-lg font-semibold tracking-tight">
          {i18n.t("onboarding.v2.problem.title")}
        </h2>
      </div>

      <ul className="flex flex-col gap-2">
        {QUESTIONS.map((q, i) => (
          <li
            key={q}
            className="animate-in fade-in-0 slide-in-from-bottom-2 fill-mode-both text-foreground/85 leading-snug ease-(--ease-out)"
            style={{ animationDelay: `${150 + i * 140}ms` }}
          >
            <span className="text-muted-foreground/60 mr-2 text-[13px] select-none">—</span>
            <span className="text-[13.5px]">{i18n.t(`onboarding.v2.problem.questions.${q}`)}</span>
          </li>
        ))}
      </ul>

      <p
        className="text-muted-foreground animate-in fade-in-0 fill-mode-both border-border/60 mt-1 border-t pt-3 text-[12px] leading-relaxed duration-500 ease-(--ease-out)"
        style={{ animationDelay: "650ms" }}
      >
        {i18n.t("onboarding.v2.problem.footer")}
      </p>
    </div>
  );
}
