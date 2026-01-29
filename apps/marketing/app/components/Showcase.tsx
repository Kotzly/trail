import { marketingCopy } from "@trail/content";

export function Showcase() {
  const { showcase } = marketingCopy;

  return (
    <section
      id="showcase"
      className="mx-auto flex max-w-6xl flex-col items-center px-6 py-16 text-center reveal"
    >
      <p className="trail-eyebrow">Showcase</p>
      <h2 className="trail-title mt-4">{showcase.title}</h2>
      <p className="trail-copy mt-4 max-w-2xl">{showcase.subtitle}</p>
      <figure className="mt-10 w-full max-w-5xl overflow-hidden rounded-[32px] border border-stroke/30 bg-surface/60 shadow-elev-1">
        <video
          className="h-auto w-full object-cover"
          autoPlay
          loop
          muted
          playsInline
        >
          <source src="/assets/showcase.mp4" type="video/mp4" />
        </video>
      </figure>
    </section>
  );
}
