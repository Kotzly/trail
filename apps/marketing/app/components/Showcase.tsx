import { marketingCopy } from "@trail/content";

export function Showcase() {
  const { showcase } = marketingCopy;

  return (
    <section className="mx-auto flex max-w-6xl flex-col items-center px-6 py-16 text-center">
      <p className="trail-eyebrow">Showcase</p>
      <h2 className="trail-title mt-4">{showcase.title}</h2>
      <p className="trail-copy mt-4 max-w-2xl">{showcase.subtitle}</p>
      <div className="trail-card mt-10 w-full max-w-4xl p-3">
        <div className="overflow-hidden rounded-2xl border border-stroke/30 bg-base/40">
          <img
            src="/showcase.gif"
            alt="Trail extension showcase"
            className="h-auto w-full object-cover"
          />
        </div>
      </div>
    </section>
  );
}
